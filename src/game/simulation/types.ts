/** Career simulator types. UI-free; no React. */

import type { GameState, NetworkBarId, ResourceId } from '../types'

export type SimulationStrategyId = 'active' | 'casual' | 'optimiser' | 'idle'

export type SimulationAccuracy = 'accurate'

export type SimulationLogLevel = 'summary' | 'milestones' | 'detailed'

export type SimulationStart =
  | { type: 'fresh' }
  | { type: 'state'; state: GameState }

export type SimulationStop =
  | { type: 'first-rebuild' }
  | { type: 'rebuilds'; count: number }
  | { type: 'sector'; sector: number }
  | { type: 'duration'; calendarSeconds: number }
  | { type: 'active-duration'; seconds: number }
  | { type: 'unlock'; system: string }
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
  highestSectorEver: number
  rebuilds: number
  stopLabel: string
  note: string
  cancelled: boolean
}

export type MilestoneId =
  | 'first-launch'
  | 'sector-1'
  | 'sector-5'
  | 'sector-10'
  | 'sector-20'
  | 'sector-30'
  | 'first-pulse-upgrade'
  | 'first-plate-upgrade'
  | 'network-unlock'
  | 'foundry-unlock'
  | 'furnace-unlock'
  | 'reliquary-unlock'
  | 'hive-research-unlock'
  | 'first-hive-research-node'
  | 'first-process-purchase'
  | 'first-rebuild'
  | 'first-reinforce'
  | `sector-${number}`
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
  assignments: Record<string, number>
  levels: Record<NetworkBarId, number>
  links: Record<string, number>
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
}

export interface StrategyLimitation {
  system: string
  note: string
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
  highestSectorEver: number
  rebuilds: number
  prestigeMatterEarned: number
  milestones: MilestoneRecord[]
  sectors: SectorRecord[]
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

