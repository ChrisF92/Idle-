import type { GameState, ResourceId } from '../types'
import { RESOURCE_LABELS } from '../state'
import { idleWorkers, moduleLevel } from '../catalog'
import { networkDiagnostics } from '../network'
import { isSystemUnlocked } from '../progression'
import { isResearchBreakthroughIndex } from '../hiveResearch'
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
  StrategyLimitation,
} from './types'
import { median } from './format'

const TRACKED_SECTORS = [1, 5, 10, 15, 20, 25, 30]

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
  }
}

function hiveNodes(state: GameState): number {
  const c = state.hiveResearch?.completed
  if (!c) return 0
  return (c.material ?? 0) + (c.energy ?? 0) + (c.observation ?? 0)
}

function researchBreakthroughs(state: GameState | null): number {
  if (!state?.hiveResearch?.completed) return 0
  let n = 0
  for (const done of Object.values(state.hiveResearch.completed)) {
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
  prev: GameState,
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
  if (idleWorkers(state) > 0 && state.base.workerDrones > 0) {
    metrics.idleAcc += dt
    if (metrics.idleAcc > 60) metrics.networkIdleHint = true
  } else {
    metrics.idleAcc = 0
  }
  const salvageGain = state.resources.salvage - prev.resources.salvage
  if (salvageGain > 0) row.salvageEarned += salvageGain

  if (state.combat.highestSector > metrics.lastHighest) {
    const cleared = state.combat.highestSector
    const clearedRow = metrics.sectors.get(cleared) ?? emptySector(cleared, activeSeconds)
    if (clearedRow.firstClearActive == null) {
      clearedRow.firstClearActive = activeSeconds
      clearedRow.clearDuration = activeSeconds - clearedRow.firstEntryActive
      clearedRow.pulseLevelOnClear = moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon')
      clearedRow.plateLevelOnClear = moduleLevel(state.shipyard.moduleLevels, 'plate-layer')
    }
    metrics.sectors.set(cleared, clearedRow)
    if (TRACKED_SECTORS.includes(cleared) || cleared === 1) {
      addMilestone(metrics, `sector-${cleared}`, `Sector ${cleared}`, activeSeconds, calendarSeconds)
    }
    if (cleared === 1) addMilestone(metrics, 'sector-1', 'Sector 1', activeSeconds, calendarSeconds)
    metrics.lastHighest = cleared
    metrics.lastHighestAt = activeSeconds
    noteMeaningful(metrics, `Sector ${cleared} clear`, activeSeconds)
  }

  if (prev.combat.docked && !state.combat.docked) {
    metrics.relaunches += 1
    row.relaunches += 1
    if (metrics.relaunches === 1) {
      addMilestone(metrics, 'first-launch', 'First Launch', activeSeconds, calendarSeconds)
    }
  }
  if (state.combat.consecutiveLosses > prev.combat.consecutiveLosses) {
    const diedAt = prev.combat.sector
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

  if (
    (state.shipyard.moduleLevels['pulse-cannon'] ?? 0) > 0 &&
    (prev.shipyard.moduleLevels['pulse-cannon'] ?? 0) === 0
  ) {
    addMilestone(metrics, 'first-pulse-upgrade', 'First Pulse upgrade', activeSeconds, calendarSeconds)
  }
  if (
    (state.shipyard.moduleLevels['plate-layer'] ?? 0) > 0 &&
    (prev.shipyard.moduleLevels['plate-layer'] ?? 0) === 0
  ) {
    addMilestone(metrics, 'first-plate-upgrade', 'First Plate upgrade', activeSeconds, calendarSeconds)
  }

  const unlocks: Array<[string, string]> = [
    ['foundry', 'Foundry'],
    ['furnace', 'Furnace'],
    ['reliquary', 'Reliquary'],
    ['research', 'Hive Research'],
    ['process', 'Process'],
    ['network', 'Network'],
    ['protocols', 'Protocols'],
    ['echo', 'Echo'],
  ]
  for (const [id, label] of unlocks) {
    if (metrics.seenUnlocks.has(id)) continue
    if (id === 'network' || isSystemUnlocked(state, id as never)) {
      if (id === 'foundry' && careerGate(state) < 2) continue
      if (id === 'network') {
        addMilestone(metrics, 'network-unlock', 'Network', 0, 0)
        metrics.seenUnlocks.add(id)
        continue
      }
      if (!isSystemUnlocked(state, id as never)) continue
      addMilestone(metrics, `unlock-${id}`, label, activeSeconds, calendarSeconds)
      if (id === 'foundry') addMilestone(metrics, 'foundry-unlock', 'Foundry unlock', activeSeconds, calendarSeconds)
      if (id === 'furnace') addMilestone(metrics, 'furnace-unlock', 'Furnace unlock', activeSeconds, calendarSeconds)
      if (id === 'reliquary') addMilestone(metrics, 'reliquary-unlock', 'Reliquary unlock', activeSeconds, calendarSeconds)
      if (id === 'research') addMilestone(metrics, 'hive-research-unlock', 'Hive Research', activeSeconds, calendarSeconds)
      if (id === 'protocols') addMilestone(metrics, 'unlock-protocols', 'Protocols', activeSeconds, calendarSeconds)
      if (id === 'echo') addMilestone(metrics, 'unlock-echo', 'Echo', activeSeconds, calendarSeconds)
      metrics.seenUnlocks.add(id)
      noteMeaningful(metrics, `${label} unlocked`, activeSeconds)
    }
  }

  const nodes = hiveNodes(state)
  if (nodes > 0 && metrics.hiveNodesSeen === 0) {
    addMilestone(metrics, 'first-hive-research-node', 'First Hive Research node', activeSeconds, calendarSeconds)
    noteMeaningful(metrics, 'First Hive Research node', activeSeconds)
  }
  const prevBt = researchBreakthroughs(prev)
  const nowBt = researchBreakthroughs(state)
  if (nowBt > 0 && prevBt === 0) {
    addMilestone(metrics, 'first-research-bt', 'First Research breakthrough', activeSeconds, calendarSeconds)
    noteMeaningful(metrics, 'First Research breakthrough', activeSeconds)
  }
  metrics.hiveNodesSeen = nodes

  if ((state.process?.purchased.length ?? 0) > 0 && (prev.process?.purchased.length ?? 0) === 0) {
    addMilestone(metrics, 'first-process-purchase', 'First Process purchase', activeSeconds, calendarSeconds)
  }

  if (state.prestige.prestigeCount > prev.prestige.prestigeCount) {
    addMilestone(
      metrics,
      state.prestige.prestigeCount === 1 ? 'first-rebuild' : `rebuild-${state.prestige.prestigeCount}`,
      state.prestige.prestigeCount === 1 ? 'First Rebuild' : `Rebuild #${state.prestige.prestigeCount}`,
      activeSeconds,
      calendarSeconds,
    )
  }

  if ((state.meta.ascensionCount ?? 0) > (prev.meta.ascensionCount ?? 0)) {
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
