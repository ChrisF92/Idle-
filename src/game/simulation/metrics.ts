import type { GameState, ResourceId } from '../types'
import { RESOURCE_LABELS } from '../state'
import { idleWorkers } from '../catalog'
import { networkDiagnostics } from '../network'
import { isSystemUnlocked } from '../progression'
import { isResearchBreakthroughIndex } from '../hiveResearch'
import { reportedBestWave } from '../waves'
import { ACT1_CADENCE } from '../cadence'
import { coreStartingLevelAtSlot } from '../coreProgression'
import { cycleBestWave } from '../rebuild'
import type {
  CorePurchaseRecord,
  CoreSpendingSummary,
  EconomyBucket,
  MeaningfulAction,
  MilestoneRecord,
  NetworkSnapshot,
  RebuildRecord,
  SectorRecord,
  SimulationWarning,
  SimulationCombatTelemetry,
  ScrapAllocationBucket,
  SortieRecord,
  StrategyLimitation,
} from './types'
import { median } from './format'
import { aggregateTenWaveBands } from './analysis'

export const TRACKED_WAVES = [
  1, 10, 20, 30, 50, 70, 100, 110, 140, 170, 200, 210, 250, 300,
  400, 500, 600, 700, 800, 900, 1000,
]

export interface MetricsState {
  milestones: MilestoneRecord[]
  sectors: Map<number, SectorRecord>
  corePurchases: CorePurchaseRecord[]
  rebuildLog: RebuildRecord[]
  meaningful: MeaningfulAction[]
  limitations: StrategyLimitation[]
  detailedLog: string[]
  warnings: SimulationWarning[]
  heatEarned: number
  heatSpent: number
  resourceEarned: Record<string, number>
  resourceSpent: Record<string, number>
  resourceSpendByCategory: Record<string, number>
  resourceStarting: Record<string, number>
  lastResources: Record<string, number>
  lastHighest: number
  lastBestWave: number
  lastSecuredWave: number
  seenSecuredWaves: Set<number>
  lastHighestAt: number
  lastMeaningfulAt: number
  lastRebuildActive: number | null
  previousHighestAtRebuild: number
  pendingRepush: { rebuildIndex: number; target: number; start: number } | null
  deathsThisSector: number
  relaunches: number
  lastDocked: boolean
  lastSector: number
  seenUnlocks: Set<string>
  hiveNodesSeen: number
  networkIdleHint: boolean
  idleAcc: number
  sorties: SortieRecord[]
  lastLaunchAt: number
  failedPushStreak: number
  closedBossDurations: Array<{ wave: number; seconds: number }>
  closedBacklogSamples: number[]
  closedTargeting: ReturnType<typeof emptyTargetingTotals>
  currentSortieSalvageRecorded: number
}

function emptySector(sector: number, active: number): SectorRecord {
  return {
    sector,
    firstEntryActive: active,
    firstClearActive: null,
    clearDuration: null,
    deaths: 0,
    relaunches: 0,
    salvageEarned: 0,
    holdSeconds: 0,
    pulseLevelOnClear: null,
    plateLevelOnClear: null,
    bossClearSeconds: null,
  }
}

export function createMetrics(state: GameState): MetricsState {
  const resources: Record<string, number> = { ...state.resources }
  const securedWaves = state.combat.sortieMark?.challengeSortie
    ? []
    : state.combat.packages
        .filter((pkg) => pkg.secured || pkg.rewardPaid)
        .map((pkg) => pkg.wave)
  return {
    milestones: [],
    sectors: new Map(),
    corePurchases: [],
    rebuildLog: [],
    meaningful: [],
    limitations: [],
    detailedLog: [],
    warnings: [],
    heatEarned: 0,
    heatSpent: 0,
    resourceEarned: {},
    resourceSpent: {},
    resourceSpendByCategory: {},
    resourceStarting: { ...resources },
    lastResources: resources,
    lastHighest: Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0),
    lastBestWave: reportedBestWave(state),
    lastSecuredWave: securedWaves.length ? Math.max(...securedWaves) : 0,
    seenSecuredWaves: new Set(securedWaves),
    lastHighestAt: 0,
    lastMeaningfulAt: 0,
    lastRebuildActive: null,
    previousHighestAtRebuild: 0,
    pendingRepush: null,
    deathsThisSector: 0,
    relaunches: 0,
    lastDocked: state.combat.docked,
    lastSector: state.combat.wave,
    seenUnlocks: new Set(),
    hiveNodesSeen: hiveNodes(state),
    networkIdleHint: false,
    idleAcc: 0,
    sorties: [],
    lastLaunchAt: 0,
    failedPushStreak: 0,
    closedBossDurations: [],
    closedBacklogSamples: [],
    closedTargeting: emptyTargetingTotals(),
    currentSortieSalvageRecorded: 0,
  }
}

function hiveNodes(state: GameState): number {
  const c = state.hiveResearch?.completed
  if (!c) return 0
  return (c.material ?? 0) + (c.energy ?? 0) + (c.observation ?? 0) + (c.computation ?? 0)
}

/** Fields observeState compares across a tick. Avoids cloning the whole save. */
export interface ObservePrev {
  salvage: number
  hullLostOnce: boolean
  docked: boolean
  consecutiveLosses: number
  sector: number
  lifetimeCoreRunBuys: number
  prestigeCount: number
  processPurchased: number
  hiveCompleted: Record<string, number> | null
  bossDuration: number
  backlogSamples: number[]
  targeting: ReturnType<typeof targetingTotals>
}

function emptyTargetingTotals() {
  return {
    initialAcquisitions: 0,
    targetSwitches: 0,
    acquisitionDelaySeconds: 0,
    slewDowntimeSeconds: 0,
    activeFiringSeconds: 0,
    shotsFired: 0,
  }
}

function targetingTotals(state: GameState) {
  const total = emptyTargetingTotals()
  for (const unit of state.combat.playerUnits) {
    const row = unit.targetingTelemetry
    if (!row) continue
    total.initialAcquisitions += row.initialAcquisitions ?? 0
    total.targetSwitches += row.targetSwitches ?? 0
    total.acquisitionDelaySeconds += row.acquisitionDelayAccum ?? 0
    total.slewDowntimeSeconds += row.timeSlewLimited ?? 0
    total.activeFiringSeconds += row.timeActivelyFiring ?? 0
    total.shotsFired += row.shotsFired ?? 0
  }
  return total
}

export function captureObservePrev(state: GameState): ObservePrev {
  return {
    salvage: state.resources.salvage ?? 0,
    hullLostOnce: !!state.meta.hullLostOnce,
    docked: state.combat.docked,
    consecutiveLosses: state.combat.consecutiveLosses,
    sector: state.combat.wave,
    lifetimeCoreRunBuys: state.meta.lifetimeCoreRunBuys ?? 0,
    prestigeCount: state.prestige.prestigeCount,
    processPurchased: state.process?.purchased.length ?? 0,
    hiveCompleted: state.hiveResearch?.completed ? { ...state.hiveResearch.completed } : null,
    bossDuration: state.combat.encounterTelemetry?.bossEncounterDuration ?? 0,
    backlogSamples: [
      ...(state.combat.encounterTelemetry?.backlogEnteringBossHold ?? []),
      ...(state.combat.encounterTelemetry?.backlogEnteringCommander ?? []),
    ],
    targeting: targetingTotals(state),
  }
}

function researchBreakthroughs(completed: Record<string, number> | null | undefined): number {
  if (!completed) return 0
  let n = 0
  for (const done of Object.values(completed)) {
    for (let i = 0; i < (done ?? 0); i++) if (isResearchBreakthroughIndex(i)) n += 1
  }
  return n
}

export function addMilestone(
  metrics: MetricsState,
  id: string,
  label: string,
  activeSeconds: number,
  calendarSeconds: number,
): void {
  if (metrics.milestones.some((m) => m.id === id)) return
  metrics.milestones.push({ id, label, activeSeconds, calendarSeconds })
}

export function noteMeaningful(metrics: MetricsState, label: string, activeSeconds: number): void {
  metrics.meaningful.push({ label, activeSeconds })
  metrics.lastMeaningfulAt = activeSeconds
}

export function recordResourceEarn(metrics: MetricsState, key: string, amount: number): void {
  if (!(amount > 0)) return
  metrics.resourceEarned[key] = (metrics.resourceEarned[key] ?? 0) + amount
  if (key === 'heat') metrics.heatEarned += amount
  if (key === 'salvage') metrics.currentSortieSalvageRecorded += amount
}

export function recordResourceSpend(
  metrics: MetricsState,
  key: string,
  amount: number,
  category: string,
): void {
  if (!(amount > 0)) return
  metrics.resourceSpent[key] = (metrics.resourceSpent[key] ?? 0) + amount
  if (key === 'heat') metrics.heatSpent += amount
  if (key === 'scrap') {
    metrics.resourceSpendByCategory[category] =
      (metrics.resourceSpendByCategory[category] ?? 0) + amount
  }
}

/** Capture generation between player decisions. Losses are resets, never purchases. */
export function syncResourceBalances(
  metrics: MetricsState,
  state: Pick<GameState, 'resources'>,
  countPositive = true,
): void {
  for (const [key, value] of Object.entries(state.resources)) {
    const before = metrics.lastResources[key] ?? 0
    const delta = (value ?? 0) - before
    if (countPositive && delta > 0) recordResourceEarn(metrics, key, delta)
    metrics.lastResources[key] = value ?? 0
  }
}

export function observeState(
  metrics: MetricsState,
  state: GameState,
  prev: ObservePrev,
  activeSeconds: number,
  calendarSeconds: number,
  dt: number,
): void {
  syncResourceBalances(metrics, state)

  const sector = state.combat.wave
  if (!metrics.sectors.has(sector)) {
    metrics.sectors.set(
      sector,
      emptySector(sector, state.combat.docked ? activeSeconds : Math.max(0, activeSeconds - dt)),
    )
  }
  const row = metrics.sectors.get(sector)!
  if (!state.combat.docked) row.holdSeconds += 0
  if (idleWorkers(state) > 0 && state.base.workerDrones > 0 && isSystemUnlocked(state, 'network')) {
    metrics.idleAcc += dt
    if (metrics.idleAcc > 60) metrics.networkIdleHint = true
  } else {
    metrics.idleAcc = 0
  }
  const salvageGain = state.resources.salvage - prev.salvage
  if (salvageGain > 0) row.salvageEarned += salvageGain

  const bestWave = reportedBestWave(state)
  if (bestWave > metrics.lastBestWave) {
    const priorBest = metrics.lastBestWave
    for (let wave = priorBest + 1; wave <= bestWave; wave += 1) {
      const entryAt = activeSeconds - dt + dt * ((wave - priorBest) / Math.max(1, bestWave - priorBest))
      if (!metrics.sectors.has(wave)) metrics.sectors.set(wave, emptySector(wave, entryAt))
    }
    metrics.lastBestWave = bestWave
    metrics.lastHighest = bestWave
    metrics.lastHighestAt = activeSeconds
  }

  if (!state.combat.sortieMark?.challengeSortie) {
    const newlySecured = state.combat.packages
      .filter((pkg) => (pkg.secured || pkg.rewardPaid) && !metrics.seenSecuredWaves.has(pkg.wave))
      .sort((a, b) => a.wave - b.wave)
    for (const pkg of newlySecured) {
      const securedRow = metrics.sectors.get(pkg.wave) ?? emptySector(pkg.wave, Math.max(0, activeSeconds - dt))
      if (securedRow.firstClearActive == null) {
        securedRow.firstClearActive = activeSeconds
        securedRow.clearDuration = Math.max(0.001, activeSeconds - securedRow.firstEntryActive)
        securedRow.pulseLevelOnClear = coreStartingLevelAtSlot(state, 0)
        securedRow.plateLevelOnClear = coreStartingLevelAtSlot(state, 1)
        if (pkg.kind === 'boss') {
          const bossDuration = Math.max(
            prev.bossDuration,
            state.combat.encounterTelemetry?.bossEncounterDuration ?? 0,
          )
          securedRow.bossClearSeconds = bossDuration > 0 ? bossDuration : null
          if (bossDuration > 0) metrics.closedBossDurations.push({ wave: pkg.wave, seconds: bossDuration })
        }
      }
      metrics.sectors.set(pkg.wave, securedRow)
      metrics.seenSecuredWaves.add(pkg.wave)
      metrics.lastSecuredWave = Math.max(metrics.lastSecuredWave, pkg.wave)
    }
    for (const wave of TRACKED_WAVES) {
      if (metrics.lastSecuredWave >= wave && !metrics.milestones.some((m) => m.id === `wave-${wave}`)) {
        addMilestone(metrics, `wave-${wave}`, `Wave ${wave}`, activeSeconds, calendarSeconds)
        noteMeaningful(metrics, wave === 1 ? 'First Wave' : `Wave ${wave} secured`, activeSeconds)
      }
    }
  }

  if (state.meta.hullLostOnce && !prev.hullLostOnce) {
    addMilestone(metrics, 'first-defeat', 'First defeat', activeSeconds, calendarSeconds)
    noteMeaningful(metrics, 'First defeat', activeSeconds)
  }

  if (prev.docked && !state.combat.docked) {
    metrics.relaunches += 1
    row.relaunches += 1
    metrics.lastLaunchAt = activeSeconds
    if (metrics.relaunches === 1) {
      addMilestone(metrics, 'first-launch', 'First Launch', activeSeconds, calendarSeconds)
    }
  }
  if (!prev.docked && state.combat.docked && state.combat.lastSortie.outcome) {
    const summary = state.combat.lastSortie
    const unrecordedSalvage = Math.max(0, summary.salvageGained - metrics.currentSortieSalvageRecorded)
    if (unrecordedSalvage > 0) recordResourceEarn(metrics, 'salvage', unrecordedSalvage)
    metrics.currentSortieSalvageRecorded = 0
    const duration = Math.max(0, activeSeconds - metrics.lastLaunchAt)
    metrics.sorties.push({
      index: metrics.sorties.length + 1,
      activeSeconds,
      duration,
      endWave: summary.wave,
      previousBest: summary.previousBest,
      newBest: summary.newBest,
      salvageEarned: summary.salvageGained,
      salvageSpent: summary.salvageSpent,
      scrapEarned: summary.scrapEarned,
      outcome: summary.outcome,
    })
    const meaningful =
      summary.salvageSpent > 0 || summary.wave >= Math.max(1, summary.previousBest * 0.7)
    if (summary.newBest) metrics.failedPushStreak = 0
    else if (meaningful && !metrics.pendingRepush) metrics.failedPushStreak += 1
    metrics.closedBacklogSamples.push(...prev.backlogSamples)
    for (const key of Object.keys(metrics.closedTargeting) as Array<keyof typeof metrics.closedTargeting>) {
      metrics.closedTargeting[key] += prev.targeting[key]
    }
  }
  if (state.combat.consecutiveLosses > prev.consecutiveLosses) {
    const diedAt = prev.sector
    const diedRow = metrics.sectors.get(diedAt) ?? emptySector(diedAt, activeSeconds)
    diedRow.deaths += 1
    metrics.sectors.set(diedAt, diedRow)
    if (diedAt === state.combat.wave) metrics.deathsThisSector += 1
    else metrics.deathsThisSector = 0
  }

  if (state.combat.wave !== metrics.lastSector) {
    metrics.deathsThisSector = 0
    metrics.lastSector = state.combat.wave
  }
  metrics.lastDocked = state.combat.docked

  if ((state.meta.lifetimeCoreRunBuys ?? 0) > 0 && prev.lifetimeCoreRunBuys === 0) {
    addMilestone(metrics, 'first-core-start', 'First Core Level', activeSeconds, calendarSeconds)
  }

  if (!metrics.seenUnlocks.has('workers') && bestWave >= ACT1_CADENCE.workers) {
    addMilestone(metrics, 'workers-unlock', 'Workers', activeSeconds, calendarSeconds)
    metrics.seenUnlocks.add('workers')
    noteMeaningful(metrics, 'Workers unlocked', activeSeconds)
  }

  const unlocks: Array<[string, string]> = [
    ['foundry', 'Foundry'],
    ['furnace', 'Furnace'],
    ['reliquary', 'Relics'],
    ['research', 'Research'],
    ['process', 'Process'],
    ['challenges', 'Challenges'],
  ]
  for (const [id, label] of unlocks) {
    if (metrics.seenUnlocks.has(id)) continue
    if (id === 'foundry' && careerGate(state) < 2) continue
    if (!isSystemUnlocked(state, id as never)) continue
    addMilestone(metrics, `unlock-${id}`, label, activeSeconds, calendarSeconds)
    if (id === 'foundry') addMilestone(metrics, 'foundry-unlock', 'Foundry unlock', activeSeconds, calendarSeconds)
    if (id === 'furnace') addMilestone(metrics, 'furnace-unlock', 'Furnace unlock', activeSeconds, calendarSeconds)
    if (id === 'reliquary') addMilestone(metrics, 'reliquary-unlock', 'Relics unlock', activeSeconds, calendarSeconds)
    if (id === 'research') addMilestone(metrics, 'hive-research-unlock', 'Research unlock', activeSeconds, calendarSeconds)
    if (id === 'process') addMilestone(metrics, 'process-unlock', 'Process unlock', activeSeconds, calendarSeconds)
    if (id === 'challenges') addMilestone(metrics, 'unlock-challenges', 'Challenges', activeSeconds, calendarSeconds)
    metrics.seenUnlocks.add(id)
    noteMeaningful(metrics, `${label} unlocked`, activeSeconds)
  }

  const nodes = hiveNodes(state)
  if (nodes > 0 && metrics.hiveNodesSeen === 0) {
    addMilestone(metrics, 'first-hive-research-node', 'First Hive Research node', activeSeconds, calendarSeconds)
    noteMeaningful(metrics, 'First Hive Research node', activeSeconds)
  }
  const prevBt = researchBreakthroughs(prev.hiveCompleted)
  const nowBt = researchBreakthroughs(state.hiveResearch?.completed)
  if (nowBt > 0 && prevBt === 0) {
    addMilestone(metrics, 'first-research-bt', 'First Research breakthrough', activeSeconds, calendarSeconds)
    noteMeaningful(metrics, 'First Research breakthrough', activeSeconds)
  }
  metrics.hiveNodesSeen = nodes

  if ((state.process?.purchased.length ?? 0) > 0 && prev.processPurchased === 0) {
    addMilestone(metrics, 'first-process-purchase', 'First Process purchase', activeSeconds, calendarSeconds)
  }

  if (state.prestige.prestigeCount > prev.prestigeCount) {
    addMilestone(
      metrics,
      state.prestige.prestigeCount === 1 ? 'first-rebuild' : `rebuild-${state.prestige.prestigeCount}`,
      state.prestige.prestigeCount === 1 ? 'First Rebuild' : `Rebuild #${state.prestige.prestigeCount}`,
      activeSeconds,
      calendarSeconds,
    )
  }

  if (metrics.pendingRepush) {
    const pending = metrics.pendingRepush
    if (cycleBestWave(state) >= pending.target) {
      const rec = metrics.rebuildLog.find((r) => r.index === pending.rebuildIndex)
      if (rec && rec.repushSeconds == null) {
        rec.repushSeconds = activeSeconds - pending.start
        rec.repushRatio =
          rec.previousPushSeconds > 0 ? rec.repushSeconds / rec.previousPushSeconds : null
        rec.newHighestAfter = cycleBestWave(state)
      }
      metrics.pendingRepush = null
    }
  }
}

export function combatTelemetry(metrics: MetricsState, state: GameState): SimulationCombatTelemetry {
  const bosses = [...metrics.closedBossDurations]
  const liveBacklog = state.combat.docked
    ? []
    : [
        ...(state.combat.encounterTelemetry?.backlogEnteringBossHold ?? []),
        ...(state.combat.encounterTelemetry?.backlogEnteringCommander ?? []),
      ]
  const backlog = [...metrics.closedBacklogSamples, ...liveBacklog]
  const targeting = { ...metrics.closedTargeting }
  if (!state.combat.docked) {
    const live = targetingTotals(state)
    for (const key of Object.keys(targeting) as Array<keyof typeof targeting>) targeting[key] += live[key]
  }
  const measuredCoreSeconds =
    targeting.acquisitionDelaySeconds + targeting.slewDowntimeSeconds + targeting.activeFiringSeconds
  return {
    bossFights: bosses.length,
    bossTtks: bosses,
    bossTtkAverage: bosses.length ? bosses.reduce((sum, row) => sum + row.seconds, 0) / bosses.length : null,
    bossTtkPeak: bosses.length ? Math.max(...bosses.map((row) => row.seconds)) : null,
    backlogAverage: backlog.length ? backlog.reduce((sum, n) => sum + n, 0) / backlog.length : null,
    backlogPeak: backlog.length ? Math.max(...backlog) : null,
    ...targeting,
    measuredCoreSeconds,
    acquisitionDelayShare: measuredCoreSeconds > 0 ? targeting.acquisitionDelaySeconds / measuredCoreSeconds : null,
    slewDowntimeShare: measuredCoreSeconds > 0 ? targeting.slewDowntimeSeconds / measuredCoreSeconds : null,
    activeFiringShare: measuredCoreSeconds > 0 ? targeting.activeFiringSeconds / measuredCoreSeconds : null,
  }
}

export function highestSecuredWave(metrics: MetricsState): number {
  return metrics.lastSecuredWave
}

function careerGate(state: GameState): number {
  return Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
}

export function recordRebuildRow(metrics: MetricsState, row: RebuildRecord): void {
  metrics.rebuildLog.push(row)
  metrics.lastRebuildActive = row.activeSeconds
  metrics.previousHighestAtRebuild = row.highestSector
  metrics.lastHighestAt = row.activeSeconds
  metrics.pendingRepush = {
    rebuildIndex: row.index,
    target: row.highestSector,
    start: row.activeSeconds,
  }
  metrics.failedPushStreak = 0
}

export function coreSpending(purchases: CorePurchaseRecord[]): CoreSpendingSummary[] {
  const by = new Map<string, CoreSpendingSummary>()
  let total = 0
  for (const p of purchases) {
    total += p.cost
    const cur = by.get(p.moduleId) ?? {
      moduleId: p.moduleId,
      name: p.name,
      levelsPurchased: 0,
      salvageSpent: 0,
      share: 0,
    }
    cur.levelsPurchased += 1
    cur.salvageSpent += p.cost
    by.set(p.moduleId, cur)
  }
  return [...by.values()].map((row) => ({
    ...row,
    share: total > 0 ? row.salvageSpent / total : 0,
  }))
}

export function networkSnapshot(state: GameState): NetworkSnapshot {
  const diag = networkDiagnostics(state)
  return {
    drones: diag.drones,
    cap: diag.cap,
    idle: diag.idle,
    assigned: diag.assigned,
    assignments: { ...state.base.assignments },
    levels: diag.levels,
    links: { ...(state.network?.links ?? {}) },
    fillRates: diag.fillRates,
    fillCaps: diag.fillCaps,
    multipliers: diag.multipliers,
  }
}

export function economyBuckets(state: GameState, metrics: MetricsState): EconomyBucket[] {
  const ids = Object.keys(RESOURCE_LABELS) as ResourceId[]
  return ids
    .map((id) => ({
      id,
      label: RESOURCE_LABELS[id],
      starting: metrics.resourceStarting[id] ?? 0,
      earned: metrics.resourceEarned[id] ?? 0,
      spent: metrics.resourceSpent[id] ?? 0,
      resetLost: Math.max(
        0,
        (metrics.resourceStarting[id] ?? 0) +
          (metrics.resourceEarned[id] ?? 0) -
          (metrics.resourceSpent[id] ?? 0) -
          (state.resources[id] ?? 0),
      ),
      ending: state.resources[id] ?? 0,
    }))
    .filter((row) => row.earned > 0.01 || row.spent > 0.01 || row.ending > 0.01)
}

const SCRAP_ALLOCATION_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  cores: 'Physical Core Levels',
  foundry: 'Foundry / fabrication',
  infrastructure: 'Worker / infrastructure',
  permanent: 'Permanent unlocks',
  other: 'Other',
}

export function scrapAllocation(metrics: MetricsState): ScrapAllocationBucket[] {
  const total = Object.values(metrics.resourceSpendByCategory).reduce((sum, value) => sum + value, 0)
  return Object.entries(metrics.resourceSpendByCategory)
    .map(([category, spent]) => ({
      category,
      label: SCRAP_ALLOCATION_LABELS[category] ?? category,
      spent,
      share: total > 0 ? spent / total : 0,
    }))
    .sort((a, b) => b.spent - a.spent)
}

export function pacingFrom(actions: MeaningfulAction[]): {
  averageGap: number | null
  medianGap: number | null
  longestGap: number | null
  longestAt: string | null
} {
  if (actions.length < 2) {
    return { averageGap: null, medianGap: null, longestGap: null, longestAt: null }
  }
  const gaps: number[] = []
  let longest = 0
  let longestAt: string | null = null
  for (let i = 1; i < actions.length; i++) {
    const gap = actions[i]!.activeSeconds - actions[i - 1]!.activeSeconds
    gaps.push(gap)
    if (gap > longest) {
      longest = gap
      longestAt = `${actions[i - 1]!.label} → ${actions[i]!.label}`
    }
  }
  const avg = gaps.reduce((s, n) => s + n, 0) / gaps.length
  return {
    averageGap: avg,
    medianGap: median(gaps),
    longestGap: longest,
    longestAt,
  }
}

export function recentClearMedian(metrics: MetricsState): number | null {
  const clears = aggregateTenWaveBands([...metrics.sectors.values()])
    .filter((s) => s.clearDuration != null)
    .slice(-5)
    .map((s) => s.clearDuration!)
  return median(clears)
}
