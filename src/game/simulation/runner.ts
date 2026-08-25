import type { GameState } from '../types'
import { applyOfflineCatchUp } from '../offline'
import { isSystemUnlocked } from '../progression'
import { canReinforce } from '../reinforce'
import { advanceSeconds } from '../tick'
import { simulationBuildMeta } from '../../buildMeta'
import {
  industryPass,
  skipGuides,
} from './actions'
import { detectWalls, coreWarnings, workerWarnings, detectGddWarnings } from './analysis'
import { isolateGameState, startingState } from './clone'
import { mulberry32 } from './format'
import {
  addMilestone,
  captureObservePrev,
  coreSpending,
  createMetrics,
  economyBuckets,
  networkSnapshot,
  noteMeaningful,
  observeState,
  pacingFrom,
  recentClearMedian,
  recordRebuildRow,
} from './metrics'
import { inspectNumericSafety } from './safety'
import { closeSession, getStrategy, spendProfileFor } from './strategies'
import { reportedBestWave } from '../waves'
import { BALANCE_TARGETS, evaluateTarget } from './targets'
import { stopLabel, FIRST_SALVAGE_LESSON_SECONDS } from './presets'
import { aggregateMilestones } from './report'
import { captureAct1Snapshot } from '../balance/act1'
import { coreStartingLevelAtSlot } from '../coreProgression'
import type {
  Act1Snapshot,
  CorePurchaseRecord,
  RebuildRecord,
  SafetyFlag,
  SimulationConfig,
  SimulationProgress,
  SimulationReport,
  SimulationRunReport,
  StrategyContext,
  StrategyLimitation,
} from './types'

export interface SimulationHooks {
  onProgress?: (progress: SimulationProgress) => void
  shouldCancel?: () => boolean
}

const FIGHT_CHUNK = 1
const DOCK_CHUNK = 4

function trimCombatNoise(state: GameState): void {
  if (state.combat.log.length > 12) state.combat.log = state.combat.log.slice(0, 8)
  if (state.combat.fx.length > 0) state.combat.fx = []
}

function stopReached(
  config: SimulationConfig,
  state: GameState,
  activeSeconds: number,
  calendarSeconds: number,
  rebuildsAtStart: number,
  firstRebuildAt: number | null,
): string | null {
  const stop = config.stop
  if (calendarSeconds >= config.maxCalendarSeconds) return 'Safety calendar cap'
  switch (stop.type) {
    case 'first-rebuild': {
      if (state.prestige.prestigeCount <= rebuildsAtStart) return null
      if (firstRebuildAt == null) return null
      if (activeSeconds - firstRebuildAt >= config.postRebuildSeconds) return 'First Rebuild + repush window'
      return null
    }
    case 'rebuilds':
      return state.prestige.prestigeCount >= rebuildsAtStart + stop.count
        ? `Reached ${stop.count} Rebuilds`
        : null
    case 'wave':
      return reportedBestWave(state) >= stop.wave ? `Reached Wave ${stop.wave}` : null
    case 'sector':
      return reportedBestWave(state) >= stop.sector * 10 ||
        Math.max(state.meta.highestSectorEver, Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)) >= stop.sector
        ? `Reached Wave ${stop.sector * 10}`
        : null
    case 'duration':
      return calendarSeconds >= stop.calendarSeconds ? 'Calendar duration reached' : null
    case 'active-duration':
      return activeSeconds >= stop.seconds ? 'Active duration reached' : null
    case 'unlock':
      return isSystemUnlocked(state, stop.system as never) ? `Unlocked ${stop.system}` : null
    case 'furnace-lit':
      return (state.furnace?.wanted?.weapons ?? 0) > 0 || (state.furnace?.active?.weapons ?? 0) > 0
        ? 'Furnace Weapons lit'
        : null
    case 'reinforce':
      return canReinforce(state).ok || (state.meta.ascensionCount ?? 0) > 0
        ? 'Reinforce available / used'
        : null
    case 'safety':
      return calendarSeconds >= config.maxCalendarSeconds ? 'Safety duration reached' : null
  }
}

function makeProgress(
  config: SimulationConfig,
  state: GameState,
  activeSeconds: number,
  calendarSeconds: number,
  offlineSeconds: number,
  runIndex: number,
  note: string,
  cancelled: boolean,
): SimulationProgress {
  return {
    runIndex,
    runs: config.runs,
    calendarSeconds,
    activeSeconds,
    offlineSeconds,
    sector: state.combat.wave,
    highestSector: Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0),
    highestSectorEver: Math.max(state.meta.highestSectorEver, Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)),
    highestWave: reportedBestWave(state),
    rebuilds: state.prestige.prestigeCount,
    stopLabel: stopLabel(config.stop),
    note,
    cancelled,
  }
}

export async function runOne(config: SimulationConfig, hooks?: SimulationHooks, runIndex = 0): Promise<SimulationRunReport> {
  const seed = config.seed + runIndex * 9973
  const rng = mulberry32(seed)
  const restoreRandom = Math.random
  Math.random = rng
  try {
    return await runOneSeeded(config, hooks, runIndex, seed, rng)
  } finally {
    Math.random = restoreRandom
  }
}

async function runOneSeeded(
  config: SimulationConfig,
  hooks: SimulationHooks | undefined,
  runIndex: number,
  seed: number,
  rng: () => number,
): Promise<SimulationRunReport> {
  const now0 = seed * 1000
  let state = skipGuides(startingState(config.start, now0))
  state.lastTickAt = now0
  const rebuildsAtStart = state.prestige.prestigeCount
  const metrics = createMetrics(state)
  const safety: SafetyFlag[] = []
  const limitations: StrategyLimitation[] = [
    {
      system: 'Challenges',
      note: 'Only the Optimiser profile enters Challenges. Casual and Balanced are the CI gates.',
    },
    {
      system: 'Deferred systems',
      note: 'Specialists, Capital, and the Task List are not operated. They stay hidden from the shipped loop.',
    },
    {
      system: 'Legacy AI nodes / Data research tree',
      note: 'Not purchased: the current Process / Research UI is what a real player sees.',
    },
  ]

  let activeSeconds = 0
  let calendarSeconds = 0
  let offlineSeconds = 0
  let simNow = now0
  let iterations = 0
  let lastDecisionAt = -999
  let lastProgressAt = 0
  let firstRebuildAt: number | null = null
  let salvageLessonApplied = false
  let cancelled = false
  let stopReason = 'Running'
  let sessionLeft =
    config.strategy === 'casual' ? (config.session?.activeSeconds ?? 10 * 60) : Infinity
  let lastProgressKey = ''
  let lastProgressTime = 0
  let lastSnapshotCount = 0
  const snapshots: Act1Snapshot[] = []
  const strategy = getStrategy(config.strategy)

  const ctxFor = (): StrategyContext => ({
    config,
    activeSeconds,
    calendarSeconds,
    offlineSeconds,
    secondsSinceHighestSectorGain: activeSeconds - metrics.lastHighestAt,
    secondsSinceMeaningfulAction: activeSeconds - metrics.lastMeaningfulAt,
    recentSectorClearMedian: recentClearMedian(metrics),
    lastRebuildActive: metrics.lastRebuildActive,
    previousHighestAtRebuild: metrics.previousHighestAtRebuild,
    deathsThisSector: metrics.deathsThisSector,
    relaunches: metrics.relaunches,
    logging: config.logging,
    rng,
    record: (event) => {
      if (config.logging === 'detailed') metrics.detailedLog.push(`${activeSeconds.toFixed(1)}s  ${event}`)
    },
    recordMeaningful: (label) => {
      noteMeaningful(metrics, label, activeSeconds)
      if (label === 'Launch') {
        metrics.lastLaunchAt = activeSeconds
        addMilestone(metrics, 'first-launch', 'First Launch', activeSeconds, calendarSeconds)
      }
    },
    recordCorePurchase: (row: CorePurchaseRecord) => {
      metrics.corePurchases.push(row)
      if (row.moduleId === 'pulse-cannon' && row.levelAfter === 1) {
        addMilestone(metrics, 'first-pulse-upgrade', 'First Pulse upgrade', activeSeconds, calendarSeconds)
      }
      if (row.moduleId === 'plate-layer' && row.levelAfter === 1) {
        addMilestone(metrics, 'first-plate-upgrade', 'First Plate upgrade', activeSeconds, calendarSeconds)
      }
      if (config.logging !== 'summary') {
        metrics.detailedLog.push(
          `${activeSeconds.toFixed(1)}s  ${row.name} L${row.levelAfter}  -${row.cost} scrap`,
        )
      }
    },
    recordRebuild: (row) => {
      const full: RebuildRecord = {
        ...row,
        permanentPurchases: row.permanentPurchases ?? [],
        repushSeconds: null,
        repushRatio: null,
        newHighestAfter: null,
      }
      recordRebuildRow(metrics, full)
      if (firstRebuildAt == null) firstRebuildAt = activeSeconds
      addMilestone(
        metrics,
        row.index === 1 ? 'first-rebuild' : `rebuild-${row.index}`,
        row.index === 1 ? 'First Rebuild' : `Rebuild #${row.index}`,
        activeSeconds,
        calendarSeconds,
      )
    },
    attachRebuildPurchase: (label) => {
      const last = metrics.rebuildLog[metrics.rebuildLog.length - 1]
      if (last && !last.permanentPurchases.includes(label)) last.permanentPurchases.push(label)
    },
    noteLimitation: (system, note) => {
      if (!limitations.some((l) => l.system === system && l.note === note)) {
        limitations.push({ system, note })
      }
    },
  })

  const decide = () => {
    const ctx = ctxFor()
    const before = state
    state = strategy.decide(state, ctx)
    lastDecisionAt = activeSeconds
    if (state !== before && config.logging === 'detailed') {
      metrics.detailedLog.push(`${activeSeconds.toFixed(1)}s  decide`)
    }
  }

  decide()

  while (iterations++ < config.maxIterations) {
    if (hooks?.shouldCancel?.()) {
      cancelled = true
      stopReason = 'Cancelled'
      break
    }

    const halt = stopReached(
      config,
      state,
      activeSeconds,
      calendarSeconds,
      rebuildsAtStart,
      firstRebuildAt,
    )
    if (halt) {
      stopReason = halt
      break
    }

    const progressKey = `${Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)}|${state.prestige.prestigeCount}|${Math.floor(state.resources.salvage)}|${Math.floor(state.resources.scrap)}|${Math.floor(state.resources.heat ?? 0)}|${state.base.workerDrones}`
    if (progressKey !== lastProgressKey) {
      lastProgressKey = progressKey
      lastProgressTime = activeSeconds
    } else if (activeSeconds - lastProgressTime >= config.deadlockSeconds) {
      safety.push({
        kind: 'deadlock',
        message: `DEADLOCK / PROGRESSION STALL at Wave ${reportedBestWave(state)} after ${config.deadlockSeconds}s without salvage/scrap/heat/drone/wave/rebuild progress. Pulse L${coreStartingLevelAtSlot(state, 0)}, Plate L${coreStartingLevelAtSlot(state, 1)}, salvage ${state.resources.salvage.toFixed(1)}.`,
        activeSeconds,
      })
      stopReason = 'DEADLOCK / PROGRESSION STALL'
      break
    }

    if (config.strategy === 'casual' && sessionLeft <= 0) {
      state = closeSession(state)
      state = industryPass(state, ctxFor(), 'casual')
      const offline = config.session?.offlineSeconds ?? 4 * 3600
      state.lastTickAt = simNow
      const caught = applyOfflineCatchUp(state, simNow + offline * 1000)
      state = caught.state
      simNow += offline * 1000
      calendarSeconds += offline
      offlineSeconds += offline
      sessionLeft = config.session?.activeSeconds ?? 10 * 60
      decide()
      continue
    }

    const needDecide =
      activeSeconds - lastDecisionAt >= config.decisionIntervalSeconds ||
      state.combat.docked ||
      !state.combat.inFight
    if (needDecide) decide()
    if (
      config.stop.type === 'furnace-lit' &&
      ((state.furnace?.wanted?.weapons ?? 0) > 0 || (state.furnace?.active?.weapons ?? 0) > 0)
    ) {
      stopReason = 'Furnace Weapons lit'
      break
    }

    const base = state.combat.docked ? DOCK_CHUNK : FIGHT_CHUNK
    const chunk =
      config.strategy === 'casual' ? Math.min(base, Math.max(0.05, sessionLeft)) : base
    const prev = captureObservePrev(state)
    advanceSeconds(state, chunk)
    activeSeconds += chunk
    calendarSeconds += chunk
    simNow += chunk * 1000
    state.lastTickAt = simNow
    if (config.strategy === 'casual') sessionLeft -= chunk
    observeState(metrics, state, prev, activeSeconds, calendarSeconds, chunk)
    if (
      !salvageLessonApplied &&
      Object.values(state.combat.runUpgrades ?? {}).some((n) => (n ?? 0) > 0)
    ) {
      activeSeconds += FIRST_SALVAGE_LESSON_SECONDS
      calendarSeconds += FIRST_SALVAGE_LESSON_SECONDS
      simNow += FIRST_SALVAGE_LESSON_SECONDS * 1000
      salvageLessonApplied = true
    }
    if (metrics.milestones.length > lastSnapshotCount) {
      const added = metrics.milestones.slice(lastSnapshotCount)
      lastSnapshotCount = metrics.milestones.length
      for (const m of added) {
        snapshots.push(
          captureAct1Snapshot(
            state,
            m.id,
            activeSeconds,
            calendarSeconds,
            metrics.resourceEarned.salvage ?? 0,
          ),
        )
      }
      if (snapshots.length > 48) snapshots.splice(0, snapshots.length - 48)
    }
    trimCombatNoise(state)

    const faults = inspectNumericSafety(state, activeSeconds)
    if (faults.length) {
      safety.push(...faults)
      stopReason = faults[0]!.message
      break
    }

    if (hooks?.onProgress && activeSeconds - lastProgressAt >= 2) {
      lastProgressAt = activeSeconds
      hooks.onProgress(
        makeProgress(config, state, activeSeconds, calendarSeconds, offlineSeconds, runIndex, stopReason, false),
      )
    }
  }

  if (iterations >= config.maxIterations && stopReason === 'Running') {
    stopReason = 'Iteration cap'
  }

  // Final spend so post-rebuild matter isn't left sitting unused at stop.
  if (config.strategy !== 'idle') {
    const mode = spendProfileFor(config.strategy)
    state = industryPass(state, ctxFor(), mode)
  }

  const spending = coreSpending(metrics.corePurchases)
  const walls = detectWalls([...metrics.sectors.values()])
  const salvageSpentOnCores = spending.reduce((s, r) => s + r.salvageSpent, 0)
  const salvageSpentOnRunUpgrades = metrics.sorties.reduce((s, row) => s + row.salvageSpent, 0)
  const warnings = [
    ...coreWarnings(spending),
    ...workerWarnings(metrics.networkIdleHint ?? false, state.base.workerDrones),
    ...detectGddWarnings({
      walls,
      rebuildLog: metrics.rebuildLog,
      spending,
      milestones: metrics.milestones,
      highestWave: reportedBestWave(state),
      foundryRecipes: Object.values(state.foundry.recipeLevels).filter((n) => (n ?? 0) > 0).length,
      workerDrones: state.base.workerDrones,
      furnaceLit: Object.values(state.furnace?.active ?? {}).filter((n) => (n ?? 0) > 0).length,
      researchBreakthroughs: captureAct1Snapshot(state, 'end', activeSeconds, calendarSeconds)
        .researchBreakthroughs,
      salvageEarned: metrics.resourceEarned.salvage ?? 0,
      salvageSpentOnRunUpgrades,
      salvageSpentOnCores,
      scrapEarned: metrics.resourceEarned.scrap ?? 0,
      workshopLevels: { ...(state.workshop?.levels ?? {}) },
      failedPushStreak: metrics.failedPushStreak,
      activeSeconds,
    }),
  ]
  const seenCodes = new Set(warnings.map((w) => w.code).filter(Boolean))
  if (
    metrics.rebuildLog.some((r) => r.repushRatio != null && r.repushRatio > 0.9) &&
    !seenCodes.has('REBUILD WEAK')
  ) {
    warnings.push({
      severity: 'warning',
      code: 'REBUILD WEAK',
      message: '[REBUILD WEAK] At least one Rebuild barely accelerated the next push.',
    })
  }

  const milestoneTime = (id: string) =>
    metrics.milestones.find((m) => m.id === id)?.activeSeconds ?? null
  const targets = BALANCE_TARGETS.map((t) => evaluateTarget(t, milestoneTime(t.milestoneId ?? t.id)))

  const matterEarned = metrics.rebuildLog.reduce((s, r) => s + r.matterEarned, 0)

  const run: SimulationRunReport = {
    config: {
      startType: config.start.type === 'fresh' ? 'Fresh' : 'Supplied state',
      stop: config.stop,
      strategy: config.strategy,
      seed: config.seed,
      runs: config.runs,
      accuracy: config.accuracy,
      logging: config.logging,
      session: config.session,
      decisionIntervalSeconds: config.decisionIntervalSeconds,
      maxCalendarSeconds: config.maxCalendarSeconds,
      maxIterations: config.maxIterations,
      deadlockSeconds: config.deadlockSeconds,
      postRebuildSeconds: config.postRebuildSeconds,
      rebuild: config.rebuild,
    },
    build: simulationBuildMeta(),
    seed,
    cancelled,
    stopReason,
    activeSeconds,
    calendarSeconds,
    offlineSeconds,
    highestSector: Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0),
    highestSectorEver: Math.max(state.meta.highestSectorEver, Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)),
    highestWave: reportedBestWave(state),
    rebuilds: state.prestige.prestigeCount,
    prestigeMatterEarned: matterEarned,
    milestones: metrics.milestones,
    sectors: [...metrics.sectors.values()].sort((a, b) => a.sector - b.sector),
    sorties: metrics.sorties,
    corePurchases: metrics.corePurchases,
    coreSpending: spending,
    network: networkSnapshot(state),
    foundry: {
      points: 0,
      recipeLevels: { ...state.foundry.recipeLevels },
      upgrades: {},
      equipped: [],
      slotRecipes: state.foundry.slots.map((s) => s.recipeId),
    },
    furnace: {
      heatEarned: metrics.heatEarned,
      heatSpent: metrics.heatSpent,
      upgrades: { ...(state.furnace?.upgrades ?? {}) },
      wanted: { ...(state.furnace?.wanted ?? {}) },
      active: { ...(state.furnace?.active ?? {}) },
    },
    research: {
      material: state.hiveResearch?.completed.material ?? 0,
      energy: state.hiveResearch?.completed.energy ?? 0,
      observation: state.hiveResearch?.completed.observation ?? 0,
      focus: state.hiveResearch?.focus ?? 'material',
      breakthroughs: captureAct1Snapshot(state, 'end', activeSeconds, calendarSeconds)
        .researchBreakthroughs,
    },
    process: {
      earned: state.process?.earned ?? 0,
      available: state.resources.aiPoints,
      purchased: [...(state.process?.purchased ?? [])],
    },
    protocols: {
      ranks: { ...(state.protocols?.ranks ?? {}) },
      activeId: state.protocols?.activeId ?? null,
    },
    echo: {
      points: state.echo?.points ?? 0,
      owned: [...(state.echo?.tree ?? [])],
    },
    snapshots: [
      ...snapshots,
      captureAct1Snapshot(state, 'end', activeSeconds, calendarSeconds, metrics.resourceEarned.salvage ?? 0),
    ],
    economy: economyBuckets(state, metrics),
    rebuildLog: metrics.rebuildLog,
    meaningfulActions: metrics.meaningful,
    pacing: pacingFrom(metrics.meaningful),
    walls,
    targets,
    warnings,
    safety,
    limitations,
    detailedLog: config.logging === 'detailed' ? metrics.detailedLog : [],
  }
  return run
}

export async function runSimulation(config: SimulationConfig, hooks?: SimulationHooks): Promise<SimulationReport> {
  const runs: SimulationRunReport[] = []
  const n = Math.max(1, Math.min(100, Math.floor(config.runs)))
  for (let i = 0; i < n; i++) {
    if (hooks?.shouldCancel?.()) break
    runs.push(await runOne(config, hooks, i))
  }
  const report: SimulationReport = { runs, aggregate: [] }
  report.aggregate = aggregateMilestones(report)
  return report
}

export interface SimulationSession {
  step(): 'continue' | 'done'
  getReport(): SimulationReport
  getProgress(): SimulationProgress
  cancel(): void
}

/**
 * Steppable session for main-thread yielding. Each step runs one Accurate chunk.
 * Tests should prefer runSimulation(). Long runs stay sync so seeded combat RNG is not interleaved.
 */
export function createSimulationSession(
  config: SimulationConfig,
  hooks?: SimulationHooks,
): { run: () => Promise<SimulationReport> } {
  return {
    run: () => runSimulation(config, hooks),
  }
}

export { isolateGameState }
