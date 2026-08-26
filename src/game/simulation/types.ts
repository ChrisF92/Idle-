/** Career simulator types. UI-free; no React. */

import type { GameState, NetworkBarId, ResourceId } from '../types'

/** GDD §153 profiles, plus leftover aliases (`active` = Balanced, `idle` = no spend). */
export type SimulationStrategyId =
  | 'casual'
  | 'balanced'
  | 'offensive'
  | 'defensive'
  | 'economy-first'
  | 'optimiser'
  | 'active'
  | 'idle'

export type SimulationSpendProfile =
  | 'casual'
  | 'balanced'
  | 'offensive'
  | 'defensive'
  | 'economy-first'
  | 'optimiser'

export const GDD_SIM_PROFILES: SimulationSpendProfile[] = [
  'casual',
  'balanced',
  'offensive',
  'defensive',
  'economy-first',
  'optimiser',
]

export type SimulationAccuracy = 'accurate'

export type SimulationLogLevel = 'summary' | 'milestones' | 'detailed'

export type SimulationStart =
  | { type: 'fresh' }
  | { type: 'state'; state: GameState }

export type SimulationStop =
  | { type: 'first-rebuild' }
  | { type: 'rebuilds'; count: number }
  | { type: 'wave'; wave: number }
  | { type: 'sector'; sector: number }
  | { type: 'duration'; calendarSeconds: number }
  | { type: 'active-duration'; seconds: number }
  | { type: 'unlock'; system: string }
  | { type: 'furnace-lit' }
  | { type: 'reinforce' }
  | { type: 'safety' }

export interface CasualSessionProfile {
  /** Active play per session (seconds). */
  activeSeconds: number
  /** Closed-app time between sessions (seconds). */
  offlineSeconds: number
}

export interface RebuildHeuristicConfig {
  /** No new highest-sector for this long → consider Rebuild. */
  stallSeconds: number
  /** Consecutive hull losses that count as a wall. */
  consecutiveLosses: number
  /** Sector clear slower than this × recent median. */
  ttkSpikeMult: number
}

export interface SimulationConfig {
  start: SimulationStart
  stop: SimulationStop
  strategy: SimulationStrategyId
  seed: number
  runs: number
  accuracy: SimulationAccuracy
  logging: SimulationLogLevel
  session?: CasualSessionProfile
  decisionIntervalSeconds: number
  /** Hard cap on simulated calendar time. */
  maxCalendarSeconds: number
  /** Hard cap on loop iterations (chunk steps). */
  maxIterations: number
  /** No meaningful progress for this long → deadlock. */
  deadlockSeconds: number
  /** After first Rebuild, keep simulating this long to capture spend + repush. */
  postRebuildSeconds: number
  rebuild: RebuildHeuristicConfig
}

export interface SimulationProgress {
  runIndex: number
  runs: number
  calendarSeconds: number
  activeSeconds: number
  offlineSeconds: number
  sector: number
  highestSector: number
  highestWave: number
  rebuilds: number
  stopLabel: string
  note: string
  cancelled: boolean
}

export type MilestoneId =
  | 'first-launch'
  | 'first-defeat'
  | 'wave-1'
  | 'wave-10'
  | 'wave-20'
  | 'wave-30'
  | 'wave-50'
  | 'wave-70'
  | 'wave-100'
  | 'wave-110'
  | 'wave-140'
  | 'wave-170'
  | 'wave-210'
  | 'wave-250'
  | 'wave-300'
  | 'first-pulse-upgrade'
  | 'first-plate-upgrade'
  | 'workers-unlock'
  | 'foundry-unlock'
  | 'furnace-unlock'
  | 'reliquary-unlock'
  | 'hive-research-unlock'
  | 'process-unlock'
  | 'first-hive-research-node'
  | 'first-process-purchase'
  | 'first-rebuild'
  | 'first-research-bt'
  | 'first-reinforce'
  | `wave-${number}`
  | `rebuild-${number}`
  | `unlock-${string}`

export interface MilestoneRecord {
  id: string
  label: string
  activeSeconds: number
  calendarSeconds: number
}

export interface SectorRecord {
  sector: number
  firstEntryActive: number
  firstClearActive: number | null
  clearDuration: number | null
  deaths: number
  relaunches: number
  salvageEarned: number
  holdSeconds: number
  pulseLevelOnClear: number | null
  plateLevelOnClear: number | null
  bossClearSeconds: number | null
}

export interface SortieRecord {
  index: number
  activeSeconds: number
  duration: number
  endWave: number
  previousBest: number
  newBest: boolean
  salvageEarned: number
  salvageSpent: number
  scrapEarned: number
  outcome: 'extract' | 'defeat' | null
}

export interface CorePurchaseRecord {
  moduleId: string
  name: string
  levelAfter: number
  cost: number
  activeSeconds: number
  statBefore: number
  statAfter: number
  marginalPerCost: number
}

export interface CoreSpendingSummary {
  moduleId: string
  name: string
  levelsPurchased: number
  salvageSpent: number
  share: number
}

export interface NetworkSnapshot {
  drones: number
  cap: number
  idle: number
  assigned: number
  assignments: Record<string, number>
  levels: Record<NetworkBarId, number>
  links: Record<string, number>
  fillRates: Partial<Record<NetworkBarId, number>>
  fillCaps: Partial<Record<NetworkBarId, number>>
  multipliers: {
    strike: number
    ward: number
    salvage: number
    manufacture: number
  }
}

export interface RebuildRecord {
  index: number
  activeSeconds: number
  calendarSeconds: number
  highestSector: number
  matterEarned: number
  matterBalanceAfter: number
  reasons: string[]
  coresLost: Record<string, number>
  workshopLost: Record<string, number>
  networkLevelsLost: Record<string, number>
  linksKept: Record<string, number>
  permanentPurchases: string[]
  previousPushSeconds: number
  repushSeconds: number | null
  repushRatio: number | null
  newHighestAfter: number | null
}

export interface EconomyBucket {
  id: ResourceId | string
  label: string
  earned: number
  spent: number
  ending: number
}

export interface MeaningfulAction {
  label: string
  activeSeconds: number
}

export interface ProgressionWall {
  sector: number
  clearSeconds: number
  recentMedian: number
  ratio: number
  likelyConstraint: string
  detail: string
}

export type TargetSeverity = 'PASS' | 'WARNING' | 'FAIL' | 'SKIP'

export interface BalanceTarget {
  id: string
  label: string
  /** Seconds, inclusive. */
  min: number
  max: number
  warningPad: number
  milestoneId?: string
  kind: 'milestone-time' | 'rebuild-count' | 'highest-sector'
}

export interface TargetResult {
  id: string
  label: string
  targetLabel: string
  simulatedLabel: string
  severity: TargetSeverity
  note: string
}

export interface SafetyFlag {
  kind: 'nan' | 'infinity' | 'negative' | 'deadlock' | 'overflow' | 'invalid'
  message: string
  activeSeconds: number
}

export interface SimulationWarning {
  severity: 'info' | 'warning' | 'fail'
  message: string
  code?: GddWarningCode
}

export interface StrategyLimitation {
  system: string
  note: string
}

export interface Act1Contribution {
  networkDamage: number
  furnaceDamage: number
  reliquaryDamage: number
  researchDamage: number
  rebuildMomentum: number
}

export type GddWarningCode =
  | 'WALL'
  | 'HARD WALL'
  | 'STEAMROLL'
  | 'ECON TRAP'
  | 'DEAD UPGRADE'
  | 'DOMINANT UPGRADE'
  | 'SYSTEM IRRELEVANT'
  | 'SYSTEM DOMINANT'
  | 'REBUILD WEAK'
  | 'REBUILD EXPLOSIVE'

export const GDD_WARNING_CODES: GddWarningCode[] = [
  'WALL',
  'HARD WALL',
  'STEAMROLL',
  'ECON TRAP',
  'DEAD UPGRADE',
  'DOMINANT UPGRADE',
  'SYSTEM IRRELEVANT',
  'SYSTEM DOMINANT',
  'REBUILD WEAK',
  'REBUILD EXPLOSIVE',
]

export interface Act1Snapshot {
  at: string
  activeSeconds: number
  calendarSeconds: number
  sector: number
  bestWave: number
  highestEver: number
  salvage: number
  salvageEarned: number
  pulse: number
  plate: number
  drones: number
  droneCap: number
  strike: number
  ward: number
  yield: number
  loom: number
  archive: number
  relays: number
  foundrySlots: number
  foundryPoints: number
  foundryRecipes: number
  foundryInfinite: number
  furnaceSlots: number
  furnaceLit: number
  heat: number
  research: { material: number; energy: number; observation: number; focus: string }
  researchBreakthroughs: number
  processEarned: number
  processAvailable: number
  processPurchased: number
  rebuilds: number
  protocolRanks: number
  echoNodes: number
  contribution: Act1Contribution
}

export interface SimulationRunReport {
  config: Omit<SimulationConfig, 'start'> & { startType: string }
  build: { appBuild: string; mode: string; href?: string }
  seed: number
  cancelled: boolean
  stopReason: string
  activeSeconds: number
  calendarSeconds: number
  offlineSeconds: number
  highestSector: number
  highestWave: number
  rebuilds: number
  prestigeMatterEarned: number
  milestones: MilestoneRecord[]
  sectors: SectorRecord[]
  sorties: SortieRecord[]
  corePurchases: CorePurchaseRecord[]
  coreSpending: CoreSpendingSummary[]
  network: NetworkSnapshot
  foundry: {
    points: number
    recipeLevels: Record<string, number>
    upgrades: Record<string, number>
    equipped: string[]
    slotRecipes: Array<string | null>
  }
  furnace: {
    heatEarned: number
    heatSpent: number
    upgrades: Record<string, number>
    wanted: Record<string, number>
    active: Record<string, number>
  }
  research: {
    material: number
    energy: number
    observation: number
    focus: string
    breakthroughs: number
  }
  process: {
    earned: number
    available: number
    purchased: string[]
  }
  protocols: {
    ranks: Record<string, number>
    activeId: string | null
  }
  echo: {
    points: number
    owned: string[]
  }
  snapshots: Act1Snapshot[]
  economy: EconomyBucket[]
  rebuildLog: RebuildRecord[]
  meaningfulActions: MeaningfulAction[]
  pacing: {
    averageGap: number | null
    medianGap: number | null
    longestGap: number | null
    longestAt: string | null
  }
  walls: ProgressionWall[]
  targets: TargetResult[]
  warnings: SimulationWarning[]
  safety: SafetyFlag[]
  limitations: StrategyLimitation[]
  detailedLog: string[]
}

export interface SimulationAggregate {
  milestoneId: string
  label: string
  samples: number[]
  median: number | null
  p10: number | null
  p90: number | null
  min: number | null
  max: number | null
}

export interface SimulationReport {
  runs: SimulationRunReport[]
  aggregate: SimulationAggregate[]
}

export interface StrategyContext {
  config: SimulationConfig
  activeSeconds: number
  calendarSeconds: number
  offlineSeconds: number
  secondsSinceHighestSectorGain: number
  secondsSinceMeaningfulAction: number
  recentSectorClearMedian: number | null
  lastRebuildActive: number | null
  previousHighestAtRebuild: number
  deathsThisSector: number
  relaunches: number
  logging: SimulationLogLevel
  rng: () => number
  record: (event: string) => void
  recordMeaningful: (label: string) => void
  recordCorePurchase: (row: CorePurchaseRecord) => void
  recordRebuild: (row: Omit<RebuildRecord, 'repushSeconds' | 'repushRatio' | 'newHighestAfter' | 'permanentPurchases'> & { permanentPurchases?: string[] }) => void
  attachRebuildPurchase: (label: string) => void
  noteLimitation: (system: string, note: string) => void
}

export interface PlayerStrategy {
  id: SimulationStrategyId
  label: string
  decide(state: GameState, ctx: StrategyContext): GameState
}

export const SIM_HISTORY_KEY = 'hiveworks-sim-history'
export const SIM_SAVE_KEY_GUARD = 'cosmic-idle-save'

export type HostMessage =
  | { type: 'start'; config: SimulationConfig }
  | { type: 'cancel' }

export type WorkerMessage =
  | { type: 'progress'; progress: SimulationProgress }
  | { type: 'done'; report: SimulationReport }
  | { type: 'error'; message: string }

