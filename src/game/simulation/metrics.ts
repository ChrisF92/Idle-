import type { GameState, ResourceId } from '../types'
import { RESOURCE_LABELS } from '../state'
import { idleWorkers } from '../catalog'
import { networkDiagnostics } from '../network'
import { isSystemUnlocked } from '../progression'
import { isResearchBreakthroughIndex } from '../hiveResearch'
import { reportedBestWave } from '../waves'
import { ACT1_CADENCE } from '../cadence'
import { coreStartingLevelAtSlot } from '../coreProgression'
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
  SortieRecord,
  StrategyLimitation,
} from './types'
import { median } from './format'

const TRACKED_WAVES = [1, 10, 20, 30, 50, 70, 100, 110, 140, 170, 210, 250, 300]

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
  lastResources: Record<string, number>
  lastHighest: number
  lastBestWave: number
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
    lastResources: resources,
    lastHighest: state.combat.highestSector,
    lastBestWave: reportedBestWave(state),
    lastHighestAt: 0,
    lastMeaningfulAt: 0,
    lastRebuildActive: null,
    previousHighestAtRebuild: 0,
    pendingRepush: null,
    deathsThisSector: 0,
    relaunches: 0,
    lastDocked: state.combat.docked,
    lastSector: state.combat.sector,
    seenUnlocks: new Set(),
    hiveNodesSeen: hiveNodes(state),
    networkIdleHint: false,
    idleAcc: 0,
    sorties: [],
    lastLaunchAt: 0,
    failedPushStreak: 0,
  }
}

function hiveNodes(state: GameState): number {
  const c = state.hiveResearch?.completed
  if (!c) return 0
  return (c.material ?? 0) + (c.energy ?? 0) + (c.observation ?? 0)
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
  ascensionCount: number
  processPurchased: number
  hiveCompleted: Record<string, number> | null
}

export function captureObservePrev(state: GameState): ObservePrev {
  return {
    salvage: state.resources.salvage ?? 0,
    hullLostOnce: !!state.meta.hullLostOnce,
    docked: state.combat.docked,
    consecutiveLosses: state.combat.consecutiveLosses,
    sector: state.combat.sector,
    lifetimeCoreRunBuys: state.meta.lifetimeCoreRunBuys ?? 0,
    prestigeCount: state.prestige.prestigeCount,
    ascensionCount: state.meta.ascensionCount ?? 0,
    processPurchased: state.process?.purchased.length ?? 0,
    hiveCompleted: state.hiveResearch?.completed ? { ...state.hiveResearch.completed } : null,
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

function addEarned(metrics: MetricsState, key: string, amount: number): void {
  if (amount > 0) metrics.resourceEarned[key] = (metrics.resourceEarned[key] ?? 0) + amount
  if (amount < 0) metrics.resourceSpent[key] = (metrics.resourceSpent[key] ?? 0) + -amount
}

export function observeState(
  metrics: MetricsState,
  state: GameState,
  prev: ObservePrev,
  activeSeconds: number,
  calendarSeconds: number,
  dt: number,
): void {
  for (const [key, value] of Object.entries(state.resources)) {
    const before = metrics.lastResources[key] ?? 0
    const delta = (value ?? 0) - before
    addEarned(metrics, key, delta)
    if (key === 'heat') {
      if (delta > 0) metrics.heatEarned += delta
      if (delta < 0) metrics.heatSpent += -delta
    }
    metrics.lastResources[key] = value ?? 0
  }

  const sector = state.combat.sector
  if (!metrics.sectors.has(sector)) {
    metrics.sectors.set(sector, emptySector(sector, activeSeconds))
  }
  const row = metrics.sectors.get(sector)!
  if (!state.combat.campaign) row.holdSeconds += dt
  if (idleWorkers(state) > 0 && state.base.workerDrones > 0 && isSystemUnlocked(state, 'network')) {
    metrics.idleAcc += dt
    if (metrics.idleAcc > 60) metrics.networkIdleHint = true
  } else {
    metrics.idleAcc = 0
  }
  const salvageGain = state.resources.salvage - prev.salvage
  if (salvageGain > 0) row.salvageEarned += salvageGain

  if (state.combat.highestSector > metrics.lastHighest) {
    const cleared = state.combat.highestSector
    const clearedRow = metrics.sectors.get(cleared) ?? emptySector(cleared, activeSeconds)
    if (clearedRow.firstClearActive == null) {
      clearedRow.firstClearActive = activeSeconds
      clearedRow.clearDuration = activeSeconds - clearedRow.firstEntryActive
      clearedRow.pulseLevelOnClear = coreStartingLevelAtSlot(state, 0)
      clearedRow.plateLevelOnClear = coreStartingLevelAtSlot(state, 1)
    }
    metrics.sectors.set(cleared, clearedRow)
    const clearedWave = cleared * 10
    if (TRACKED_WAVES.includes(clearedWave)) {
      addMilestone(metrics, `wave-${clearedWave}`, `Wave ${clearedWave}`, activeSeconds, calendarSeconds)
    }
    metrics.lastHighest = cleared
    metrics.lastHighestAt = activeSeconds
    noteMeaningful(metrics, `Wave ${clearedWave} band clear`, activeSeconds)
  }

  const bestWave = reportedBestWave(state)
  if (bestWave > metrics.lastBestWave) {
    for (const wave of TRACKED_WAVES) {
      if (bestWave >= wave && metrics.lastBestWave < wave) {
        addMilestone(metrics, `wave-${wave}`, `Wave ${wave}`, activeSeconds, calendarSeconds)
        if (wave === 1) noteMeaningful(metrics, 'First Wave', activeSeconds)
      }
    }
    metrics.lastBestWave = bestWave
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
  }
  if (state.combat.consecutiveLosses > prev.consecutiveLosses) {
    const diedAt = prev.sector
    const diedRow = metrics.sectors.get(diedAt) ?? emptySector(diedAt, activeSeconds)
    diedRow.deaths += 1
    metrics.sectors.set(diedAt, diedRow)
    if (diedAt === state.combat.sector) metrics.deathsThisSector += 1
    else metrics.deathsThisSector = 0
  }

  if (state.combat.sector !== metrics.lastSector) {
    metrics.deathsThisSector = 0
    metrics.lastSector = state.combat.sector
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
    ['protocols', 'Challenges'],
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
    if (id === 'protocols') addMilestone(metrics, 'unlock-protocols', 'Challenges', activeSeconds, calendarSeconds)
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

  if ((state.meta.ascensionCount ?? 0) > prev.ascensionCount) {
    addMilestone(metrics, 'first-reinforce', 'Reinforce / Ascension', activeSeconds, calendarSeconds)
  }

  if (metrics.pendingRepush) {
    const pending = metrics.pendingRepush
    if (state.combat.highestSector >= pending.target) {
      const rec = metrics.rebuildLog.find((r) => r.index === pending.rebuildIndex)
      if (rec && rec.repushSeconds == null) {
        rec.repushSeconds = activeSeconds - pending.start
        rec.repushRatio =
          rec.previousPushSeconds > 0 ? rec.repushSeconds / rec.previousPushSeconds : null
        rec.newHighestAfter = state.combat.highestSector
      }
      metrics.pendingRepush = null
    }
  }
}

function careerGate(state: GameState): number {
  return Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
}

export function recordRebuildRow(metrics: MetricsState, row: RebuildRecord): void {
  metrics.rebuildLog.push(row)
  metrics.lastRebuildActive = row.activeSeconds
  metrics.previousHighestAtRebuild = row.highestSector
  metrics.lastHighest = 0
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
      earned: metrics.resourceEarned[id] ?? 0,
      spent: metrics.resourceSpent[id] ?? 0,
      ending: state.resources[id] ?? 0,
    }))
    .filter((row) => row.earned > 0.01 || row.spent > 0.01 || row.ending > 0.01)
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
  const clears = [...metrics.sectors.values()]
    .filter((s) => s.clearDuration != null)
    .slice(-5)
    .map((s) => s.clearDuration!)
  return median(clears)
}
