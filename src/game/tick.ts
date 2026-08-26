import type { GameState, Resources } from './types'
import {
  computeShipStats,
  createInitialState,
  fullHealPlayer,
  syncPersistedHullCaps,
} from './state'
import {
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  aiDoctrinesActive,
  aiProductionBonus,
  droneCap,
  essenceProductionMultiplier,
  isStationUnlocked,
  metaProductionMultiplier,
  prestigeMomentumProductionBonus,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  visibleWorkerJobIds,
  workerManufactureSpeed,
} from './catalog'
import { tickAutomation } from './automation'
import { logisticsProdMult, tickCoreTraining } from './core'
import { computeSignalCoreBonuses } from './signalCores'
import { tryCompleteChallenge } from './actions'
import {
  networkDataRate,
  networkScrapRate,
  tickNetwork,
} from './network'
import { armPendingFacilities, tickFoundry } from './foundry'
import { foundryAshHeatMult } from './foundryBonuses'
import { tickYard } from './yard'
import { endFurnaceSortie, furnaceNetPerSec, tickFurnace } from './furnace'
import { hiveResearchHeatFromAshMult, hiveResearchSalvageOpsMult, tickResearch } from './hiveResearch'
import { noteProtocolProgress, tryCompleteProtocol } from './protocols'
import { hasProcess, noteProcessLastAction, processConfig, processIndustrySpeedMult } from './process'
import { evaluateProcessIntent } from './processProfiles'
import { WORKER_JOB_IDS } from './workers'
import {
  captureSortieMark,
  closeSortie,
  noteSectorClear,
} from './sortieSummary'
import {
  addPlaytime,
  noteCareerWave,
  noteSessionEnd,
  recordPlaytest,
  sampleDroneAllocation,
} from './playtest'
import { sampleSortieEnemies, snapshotSortieEncounter } from './sortieTelemetry'
import {
  buildPlayerFleet,
  syncPlayerFleetWeapons,
  simulateCombat,
  syncHullAggregates,
  totalEnemyHull,
  computeFightDamage,
  repairRatePerSecond,
  shieldRepairRatePerSecond,
} from './combat'
import { allocateSortieSeed } from './threatBudget'
import { consumeSimSteps, SIM_FIXED_DT } from './simClock'
import { emptyWaveRuntime } from './waveRuntime'
import { createSimRng } from './simRng'
import { tickWaveScheduler, type WaveSchedulerHooks } from './waveScheduler'
import {
  applyWorkshopCoreStarts,
  resetRunCoreLevels,
} from './workshop'
import { canExtract, extractionBonusFor } from './extraction'
import {
  awardEquippedMasteryXp,
  snapshotCoreMasteryStart,
} from './coreProgression'
import { isChallengeSortie, addCombatClockMs } from './frontier'
import { anyMatterPurchaseOwned, sortieProvisioningSalvage } from './matter'
import {
  clearDirectives,
  chooseDirective as applyDirectiveChoice,
  hasDirectiveOffer,
  queueDirectiveOffer,
} from './directives'
import {
  grantGeneratedScrap,
  noteRebuildCycleSortie,
  noteRebuildCycleWave,
} from './rebuild'
import {
  completeAct1,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { ACT1_FINAL_WAVE } from './cadence'

/** Legacy alias — production/offline still speak in seconds; combat is continuous. */
export const TICK_MS = 1000
/** Max live catch-up seconds when the tab was backgrounded briefly. */
export const LIVE_TICK_CAP = 5
/** Integration step for continuous sim (seconds). */
export const SIM_STEP_S = SIM_FIXED_DT
/** Skip tiny frame gaps. */
export const MIN_FRAME_MS = 16

function pushLog(state: GameState, line: string, max = 40): void {
  state.combat.log = [line, ...state.combat.log].slice(0, max)
}

function clearShots(state: GameState): void {
  state.combat.projectiles = []
  state.combat.beams = []
  state.combat.fx = []
}

function clearEnemiesOnly(state: GameState): void {
  state.combat.enemyName = 'None'
  state.combat.enemyFamily = ''
  state.combat.enemyTags = []
  state.combat.isBoss = false
  state.combat.bossPhase = 0
  state.combat.bossMechanic = undefined
  state.combat.waveThreat = undefined
  state.combat.enemyUnits = []
  state.combat.enemyHull = 0
  state.combat.enemyHullMax = 0
  clearShots(state)
}

function clearEnemy(state: GameState): void {
  state.combat.inFight = false
  clearEnemiesOnly(state)
  state.combat.playerUnits = []
}

function noteBestWave(state: GameState, wave: number): boolean {
  const w = Math.max(1, Math.floor(wave))
  const prev = Math.max(state.combat.bestWave ?? 0, state.meta.bestWave ?? 0)
  state.combat.bestWave = Math.max(state.combat.bestWave ?? 0, w)
  state.meta.bestWave = Math.max(state.meta.bestWave ?? 0, w)
  noteRebuildCycleWave(state, w)
  if (w > prev) noteCareerWave(state, w)
  return w > prev
}

function finishSortie(
  state: GameState,
  outcome: 'extract' | 'defeat',
  note: string,
  at: { sector: number; wave: number },
  extractBonus = false,
): void {
  const previousBest = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  const newBest = noteBestWave(state, at.wave)
  const gross = Math.max(0, state.combat.sortieMark?.grossScrapGenerated ?? 0)
  const bonus = extractBonus && outcome === 'extract' ? extractionBonusFor(state) : 0
  if (bonus > 0) {
    grantGeneratedScrap(state, bonus, 'extraction')
    note = `${note} Extraction +${bonus} Scrap.`
  }
  closeSortie(state, outcome, note, at, {
    scrapEarned: gross,
    extractionBonusScrap: bonus,
    newBest,
    previousBest,
  })
  noteRebuildCycleSortie(state)
  endFurnaceSortie(state)
  state.resources.salvage = 0
  resetRunCoreLevels(state)
  state.combat.runUpgrades = {}
  clearDirectives(state)
  Object.assign(state.combat, emptyWaveRuntime())
  state.combat.wave = 1
  state.combat.waveReached = 0
  state.combat.packages = []
  state.combat.pendingReinforcements = []
  state.combat.docked = true
  state.combat.inFight = false
  state.combat.sortiePaused = false
  state.shipyard.frameLocked = false
  fullHealPlayer(state)
}

function persistFlagshipHull(state: GameState): void {
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  if (flag) {
    state.combat.playerHull = Math.max(0, flag.hull)
    state.combat.playerShield = Math.max(0, flag.shield)
  }
  if (state.combat.playerHull <= 0) {
    state.combat.playerHull = Math.max(1, stats.hullMax * 0.08)
    state.combat.playerShield = 0
  }
}

function productionMeta(state: GameState): number {
  // Post-BB multipliers only — drone power handles saturation separately.
  return (
    metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
      state.prestige.challengeClears,
    ) *
    (1 +
      prestigeMomentumProductionBonus(
        state.prestige.prestigeCount,
        state.meta.ascensionCount ?? 0,
      )) *
    essenceProductionMultiplier(state.essence.purchased) *
    logisticsProdMult(state.core?.ranks.logistics ?? 0) *
    (1 + aiProductionBonus(state)) *
    (1 + computeSignalCoreBonuses(state).production)
  )
}

function applyNetworkCombatRefresh(state: GameState): void {
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  if (!state.combat.inFight) {
    state.combat.playerHull = Math.min(state.combat.playerHull, stats.hullMax)
    state.combat.playerShield = Math.min(state.combat.playerShield, stats.shieldMax)
    return
  }
  syncPlayerFleetWeapons(state)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (!flag) return
  flag.hullMax = stats.hullMax
  flag.shieldMax = stats.shieldMax
  flag.hull = Math.min(flag.hull, flag.hullMax)
  flag.shield = Math.min(flag.shield, flag.shieldMax)
  state.combat.playerHull = flag.hull
  state.combat.playerShield = flag.shield
}

function creditIndustryScrap(state: GameState, amount: number): void {
  if (amount > 0) grantGeneratedScrap(state, amount, 'industry')
}

function applyProduction(state: GameState, dtSeconds: number): void {
  const meta = productionMeta(state)

  for (const station of STATIONS) {
    if (!isStationUnlocked(state, station.id)) continue
    const assigned = state.base.assignments[station.id] ?? 0
    if (assigned <= 0) continue
    const effective = stationEffectiveDrones(state, station.id)
    if (effective <= 0) continue

    const upkeepPer = stationUpkeepScrapPerDrone(state, station)
    if (upkeepPer > 0) {
      // Upkeep tracks bodies; output tracks saturated effective drones.
      const upkeep = upkeepPer * assigned * dtSeconds
      const available = state.resources.scrap
      const paid = Math.min(available, upkeep)
      state.resources.scrap -= paid
      const efficiency = upkeep > 0 ? paid / upkeep : 1
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        const key = resource as keyof GameState['resources']
        const add = (perDrone ?? 0) * effective * dtSeconds * efficiency * meta
        if (key === 'scrap') creditIndustryScrap(state, add)
        else state.resources[key] += add
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof GameState['resources']
      const add = (perDrone ?? 0) * effective * dtSeconds * meta
      if (key === 'scrap') creditIndustryScrap(state, add)
      else state.resources[key] += add
    }
  }

  if (tickNetwork(state, dtSeconds)) {
    applyNetworkCombatRefresh(state)
  }
  tickFoundry(state, dtSeconds)
  tickYard(state, dtSeconds)
  tickFurnace(state, dtSeconds, hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state))
  tickResearch(state, dtSeconds)

  const cap = droneCap(state)
  if (
    state.base.workerDrones < cap &&
    isStationUnlocked(state, 'drone-fab') &&
    (state.base.assignments['drone-fab'] ?? 0) > 0
  ) {
    const speed = workerManufactureSpeed(state) * processIndustrySpeedMult(state)
    state.base.manufactureProgress +=
      (dtSeconds * speed) / WORKER_MANUFACTURE_SECONDS
    while (
      state.base.manufactureProgress >= 1 &&
      state.base.workerDrones < cap
    ) {
      state.base.manufactureProgress -= 1
      state.base.workerDrones += 1
      state.meta.lifetimeDronesBuilt =
        (state.meta.lifetimeDronesBuilt ?? 0) + 1
      pushLog(
        state,
        `Drone manufactured. Drones: ${state.base.workerDrones}/${cap}.`,
      )
    }
    if (state.base.workerDrones >= cap) {
      state.base.manufactureProgress = Math.min(
        state.base.manufactureProgress,
        0.999,
      )
    }
  }

  tickCoreTraining(state, dtSeconds)
  const activeJobs = new Set(visibleWorkerJobIds(state))
  for (const jobId of WORKER_JOB_IDS) {
    if (!activeJobs.has(jobId)) delete state.base.assignments[jobId]
  }
}

/** Net industry rates (units / second). Combat drops are not included. */
export function computeResourceRates(state: GameState): Partial<Resources> {
  const meta = productionMeta(state)
  const rates: Partial<Resources> = {}
  const add = (key: keyof Resources, amount: number) => {
    rates[key] = (rates[key] ?? 0) + amount
  }

  for (const station of STATIONS) {
    if (!isStationUnlocked(state, station.id)) continue
    const assigned = state.base.assignments[station.id] ?? 0
    if (assigned <= 0) continue
    const effective = stationEffectiveDrones(state, station.id)

    const upkeepPer = stationUpkeepScrapPerDrone(state, station)
    if (upkeepPer > 0) {
      const upkeep = upkeepPer * assigned
      const efficiency = state.resources.scrap > 0 || upkeep <= 0 ? 1 : 0
      add('scrap', -upkeep * efficiency)
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        add(
          resource as keyof Resources,
          (perDrone ?? 0) * effective * efficiency * meta,
        )
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      let amount = (perDrone ?? 0) * effective * meta
      if (station.id === 'scrap-field' && resource === 'scrap') {
        amount *= hiveResearchSalvageOpsMult(state)
      }
      add(resource as keyof Resources, amount)
    }
  }

  add('scrap', networkScrapRate(state))
  add('data', networkDataRate(state))
  add('heat', furnaceNetPerSec(state, hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state)))

  return rates
}

/** Scrap floor after the first tutorial death (covers Plate Layer unlock). */
export const STARTER_PLATE_SCRAP_FLOOR = 35
/**
 * Salvage granted on the second tutorial death — enough for several module
 * ranks toward the Base unlock push (plus combat salvage drips).
 */
export const STARTER_SALVAGE_GRANT = 40
/** Run-level target the salvage lesson requires before Resume. */
export const STARTER_UPGRADE_LEVEL = 1

/** Fresh career still running the death → Plate → salvage combat lesson. */
export function isStarterCombatTutorial(state: GameState): boolean {
  if (state.prestige.prestigeCount > 0) return false
  if ((state.meta.ascensionCount ?? 0) > 0) return false
  return (state.meta.starterCombatLesson ?? 0) < 2
}

/**
 * Which starter lesson a *natural* fight loss should advance (dock + grants).
 * Lesson 1 waits until Plate Layer is fitted. No timed/scripted deaths.
 * Gated to early sectors so later natural deaths use normal warp.
 */
export function starterDeathLessonOnLoss(state: GameState): 0 | 1 | null {
  if (!isStarterCombatTutorial(state)) return null
  const lesson = state.meta.starterCombatLesson ?? 0
  const wave = Math.max(1, state.combat.waveReached || state.combat.wave || 1)
  if (lesson === 0 && wave <= 20) return 0
  if (
    lesson === 1 &&
    state.shipyard.modules.includes('plate-layer') &&
    wave <= 30
  ) {
    return 1
  }
  return null
}

/**
 * Extra enemy weapon damage while awaiting the post-Plate tutorial death.
 * Keeps the second natural death close after relaunch without scripting it.
 */
export function starterCombatPressureMult(state: GameState): number {
  if (!isStarterCombatTutorial(state)) return 1
  const lesson = state.meta.starterCombatLesson ?? 0
  if (lesson === 1 && state.shipyard.modules.includes('plate-layer')) {
    const wave = Math.max(1, state.combat.waveReached || state.combat.wave || 1)
    return wave <= 20 ? 1.55 : 1.25
  }
  return 1
}

/** Block Resume / Launch until the current docked lesson is finished. */
export function starterRefitGate(
  _state: GameState,
): 'plate' | 'upgrades' | null {
  return null
}

/** Hull-loss beat on Sortie before Dock + run report. */
export const DEFEAT_SEQUENCE_S = 1.2

function startDefeatSequence(state: GameState): void {
  if ((state.combat.defeatLeft ?? 0) > 0) return
  snapshotSortieEncounter(state)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) flag.hull = 0
  state.combat.playerHull = 0
  state.combat.playerShield = 0
  state.combat.defeatLeft = DEFEAT_SEQUENCE_S
  state.combat.defeatTactical = false
  const failed = state.combat.wave
  pushLog(state, `Hull integrity lost at Wave ${failed}. Sortie ending.`)
}

function tickDefeatSequence(state: GameState, dt: number): boolean {
  if ((state.combat.defeatLeft ?? 0) <= 0) return false
  state.combat.defeatLeft = Math.max(0, state.combat.defeatLeft - dt)
  if (state.combat.defeatLeft > 0) return true
  onFightLost(state, state.combat.isBoss)
  return true
}

/** Death ends the Sortie. Hull loss is never a voluntary Extraction. */
function onFightLost(state: GameState, boss: boolean): void {
  const fromWave = Math.max(1, state.combat.waveReached || state.combat.wave)
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  clearEnemy(state)
  state.combat.consecutiveLosses += 1
  if (state.echo?.activeId) state.echo.activeId = null
  const label = boss ? ' boss' : ''
  const note = `Hull lost at Wave ${fromWave}${label}.`
  finishSortie(state, 'defeat', note, { sector: 0, wave: fromWave }, false)
  pushLog(state, `${note} Returned to Dock.`)
}

function schedulerHooks(): WaveSchedulerHooks {
  return {
    pushLog,
    onWaveReached: (s, wave, kind) => {
      const careerBestBefore = Math.max(s.meta.bestWave ?? 0, s.combat.bestWave ?? 0)
      const newBest = noteBestWave(s, wave)
      awardEquippedMasteryXp(s, wave, {
        boss: kind === 'boss',
        newBest,
        careerBestBefore,
      })
      maybeGrantSystemUnlocks(s)
    },
    onWaveSecured: (s, pkg) => {
      s.meta.lifetimeWaveClears = (s.meta.lifetimeWaveClears ?? 0) + 1
      if (pkg.kind === 'boss') {
        noteProtocolProgress(s)
        s.meta.lifetimeSectorClears = (s.meta.lifetimeSectorClears ?? 0) + 1
        noteSectorClear(s)
        if (pkg.wave >= ACT1_FINAL_WAVE) completeAct1(s)
        maybeGrantSystemUnlocks(s)
        tryCompleteChallenge(s)
        tryCompleteProtocol(s)
        queueDirectiveOffer(s, pkg.wave)
      }
    },
  }
}

function tickCombat(state: GameState, dt: number): void {
  if (tickDefeatSequence(state, dt)) return
  if (!state.combat.inFight) return
  if (hasDirectiveOffer(state)) return

  state.combat.fightElapsed = (state.combat.fightElapsed ?? 0) + dt
  addCombatClockMs(state, dt)
  tickWaveScheduler(state, dt, schedulerHooks())
  simulateCombat(state, dt, pushLog)

  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  const flagHull = flag?.hull ?? 0
  if (flagHull <= 0) {
    startDefeatSequence(state)
  }
}

/**
 * Repair while Paused (full rate) or out of combat undocked (field rate).
 * AI never pauses / resumes combat — only repair multipliers.
 * Attrition challenge blocks all hangar / field repair.
 */
function fieldRepairMultiplier(state: GameState): number {
  if (state.prestige.activeChallengeId === 'attrition') return 0
  if (state.combat.docked) return 1
  let mult = aiDoctrinesActive(state, 'auto-launch-ready') ? 0.85 : 0.4
  if (
    aiDoctrinesActive(state, 'auto-dock-critical') &&
    state.combat.playerHullMax > 0 &&
    state.combat.playerHull / state.combat.playerHullMax < 0.35
  ) {
    mult = Math.max(mult, 0.95)
  }
  return mult
}

function tickOutOfCombatRepair(state: GameState, dt: number): void {
  if (state.combat.inFight) return
  const mult = fieldRepairMultiplier(state)
  if (mult <= 0) return
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax

  if (state.combat.playerHull < stats.hullMax) {
    state.combat.playerHull = Math.min(
      stats.hullMax,
      state.combat.playerHull + repairRatePerSecond(state) * mult * dt,
    )
  }
  if (state.combat.playerShield < stats.shieldMax) {
    state.combat.playerShield = Math.min(
      stats.shieldMax,
      state.combat.playerShield + shieldRepairRatePerSecond(state) * mult * dt,
    )
  }
}

export function isCombatSimulationRunning(state: GameState): boolean {
  return !state.combat.docked && Boolean(state.combat.inFight) && !state.combat.sortiePaused
}

/** Freeze combat through the single Sortie PAUSED state. Does not Extract. */
export function setSortiePaused(state: GameState, paused: boolean): GameState {
  if (state.combat.docked) return state
  if (Boolean(state.combat.sortiePaused) === paused) return state
  const next = structuredClone(state)
  next.combat.sortiePaused = paused
  return next
}

/** Hide/background: pause a live Sortie. Already-paused Sorties stay paused. */
export function freezeActiveSortie(state: GameState): GameState {
  if (state.combat.docked) return state
  return setSortiePaused(state, true)
}

/**
 * App/tab hidden or closed. Freezes an active Sortie through the same PAUSED
 * state. Hidden wall-clock time must not become combat catch-up.
 */
export function handleAppHidden(state: GameState): GameState {
  const frozen = freezeActiveSortie(state)
  const next = frozen === state ? structuredClone(state) : frozen
  noteSessionEnd(next)
  return next
}

/** Advance / auto-engage while Docked with no live Sortie. */
function maybeAutoEngage(state: GameState): void {
  if (state.combat.inFight || state.combat.docked) return
  if (hasDirectiveOffer(state)) return
  if (starterRefitGate(state)) {
    state.combat.docked = true
    return
  }
  beginFight(state)
}

function applySortieProvisioningOnce(state: GameState): void {
  if (state.combat.sortieMark?.provisioningGranted) return
  if (!isChallengeSortie(state)) {
    const grant = sortieProvisioningSalvage(state)
    if (grant > 0) state.resources.salvage = (state.resources.salvage ?? 0) + grant
  }
  if (!state.combat.sortieMark) state.combat.sortieMark = captureSortieMark(state)
  state.combat.sortieMark.provisioningGranted = true
  state.combat.sortieMark.salvage = state.resources.salvage ?? 0
  if (isChallengeSortie(state)) state.combat.sortieMark.challengeSortie = true
}

export function beginFight(state: GameState, keepFleet = false): void {
  syncPersistedHullCaps(state)
  if (!(state.combat.sortieSeed > 0)) state.combat.sortieSeed = allocateSortieSeed(state)
  state.combat.rng = createSimRng(state.combat.sortieSeed)
  const runtime = emptyWaveRuntime()
  state.combat.waveReached = runtime.waveReached
  state.combat.nextWave = 1
  state.combat.nextReinforcementAt = 0
  state.combat.packages = []
  state.combat.pendingReinforcements = []
  state.combat.bossBoundary = runtime.bossBoundary
  state.combat.simTime = 0
  state.combat.simAccumulator = 0
  state.combat.idSeq = runtime.idSeq
  state.combat.wave = 0
  state.combat.sortiePaused = false
  state.combat.docked = false
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  applySortieProvisioningOnce(state)
  if (!state.combat.sortieMark) state.combat.sortieMark = captureSortieMark(state)
  state.combat.fightElapsed = 0
  state.shipyard.frameLocked = true
  state.combat.inFight = true
  state.combat.isBoss = false
  state.combat.bossPhase = 0
  state.combat.bossMechanic = undefined
  if (state.combat.sortieMark) state.combat.sortieMark.sortieSeed = state.combat.sortieSeed
  if (!keepFleet || state.combat.playerUnits.length === 0) {
    state.combat.playerUnits = buildPlayerFleet(state)
  } else {
    applyNetworkCombatRefresh(state)
  }
  clearShots(state)
  state.combat.enemyUnits = []
  syncHullAggregates(state)
  tickWaveScheduler(state, 0, schedulerHooks())
  sampleSortieEnemies(state)
  const matchup = computeFightDamage(state)
  const note =
    matchup.matchupNotes.length > 0
      ? ` ${matchup.matchupNotes.join('; ')}.`
      : ''
  pushLog(state, `Sortie launched — Wave 1.${note}`)
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  if (starterRefitGate(state)) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

function launchFromDock(state: GameState): void {
  armPendingFacilities(state)
  state.combat.wave = 1
  state.combat.waveReached = 0
  state.combat.runUpgrades = {}
  state.resources.salvage = 0
  applyWorkshopCoreStarts(state)
  state.combat.coreRunLevels = {}
  state.combat.coreSalvageSpent = {}
  state.combat.coreMasteryXp = {}
  state.combat.coreBossClears = {}
  state.combat.coreNewBest = {}
  state.combat.coreMilestones = {}
  snapshotCoreMasteryStart(state)
  clearDirectives(state)
  state.combat.docked = false
  state.combat.sortieMark = captureSortieMark(state)
  if (isChallengeSortie(state)) state.combat.sortieMark.challengeSortie = true
  applySortieProvisioningOnce(state)
  recordPlaytest(state, 'first_launch', { firstKey: 'launch' })
  state.shipyard.frameLocked = true
  fullHealPlayer(state)
  beginFight(state)
}

function endActiveSortieAsExtract(state: GameState, withBonus: boolean): void {
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  const at = { sector: 0, wave: Math.max(1, state.combat.waveReached || state.combat.wave) }
  if (state.combat.inFight) {
    snapshotSortieEncounter(state)
    persistFlagshipHull(state)
    clearEnemy(state)
  }
  finishSortie(state, 'extract', `Extracted at Wave ${at.wave}.`, at, withBonus)
  pushLog(state, state.combat.lastSortie.note)
}

/**
 * Launch from Dock. `setDocked(true)` is a no-op: docking an active Sortie is not
 * Extraction. Voluntary Extraction is `extractSortie()` only.
 */
export function setDocked(state: GameState, docked: boolean): GameState {
  if (docked) return state
  if (!state.combat.docked) return state
  const next = structuredClone(state)
  launchFromDock(next)
  pushLog(next, 'Sortie launched — Wave 1.')
  return next
}

/** Confirmed voluntary Extraction. Bonus only when eligible. */
export function extractSortie(state: GameState): GameState {
  if (!canExtract(state)) return state
  const next = structuredClone(state)
  endActiveSortieAsExtract(next, true)
  return next
}

export function markExtractionExplained(state: GameState): GameState {
  if (state.meta.extractionExplained) return state
  const next = structuredClone(state)
  next.meta.extractionExplained = true
  return next
}

export function chooseDirective(state: GameState, id: string): GameState {
  const next = applyDirectiveChoice(state, id)
  if (next === state) return state
  syncPersistedHullCaps(next)
  if (!next.combat.docked && !next.combat.inFight && !hasDirectiveOffer(next)) {
    beginFight(next)
  }
  return next
}

/** Advance real wall-clock time. Industry uses realDt; combat uses realDt × Time Compression. */
export function advanceRealTime(state: GameState, realDt: number): void {
  advanceSeconds(state, realDt)
}

/** Advance continuous simulation by `seconds` of real time (mutates). */
export function advanceSeconds(state: GameState, seconds: number): void {
  let left = Math.max(0, seconds)
  while (left > 1e-6) {
    const dt = Math.min(SIM_STEP_S, left)
    applyProduction(state, dt)
    if (isCombatSimulationRunning(state)) {
      consumeSimSteps(state, dt, (step) => tickCombat(state, step))
    } else if (state.combat.docked) {
      tickOutOfCombatRepair(state, dt)
      maybeAutoEngage(state)
    }
    left -= dt
  }
  tickAutomation(state)
  maybeProcessRelaunch(state)
  tryCompleteAchievements(state)
}

function tutorialBlocksAutoLaunch(state: GameState): boolean {
  if (!state.meta.hullLostOnce) return true
  if ((state.prestige.prestigeCount ?? 0) === 0 && workshopNeedsFirstLesson(state)) return true
  if ((state.prestige.prestigeCount ?? 0) === 1 && !anyMatterPurchaseOwned(state)) return true
  return false
}

function workshopNeedsFirstLesson(state: GameState): boolean {
  const scrap = state.resources.scrap ?? 0
  const wp = Math.max(0, Math.floor(state.workshop?.levels?.['weapon-power'] ?? 0))
  return scrap >= 12 && wp < 1
}

function maybeProcessRelaunch(state: GameState): void {
  const intentLaunch = evaluateProcessIntent(state).launchSortie && hasProcess(state, 'rule-builder')
  const autoLaunch = hasProcess(state, 'sortie-relaunch') && processConfig(state).sortie.autoRelaunch
  if (!intentLaunch && !autoLaunch) return
  if (!state.combat.docked) return
  if ((state.combat.defeatLeft ?? 0) > 0) return
  if (state.protocols?.activeId) return
  if (starterRefitGate(state)) return
  if (tutorialBlocksAutoLaunch(state)) return
  if (state.combat.playerHullMax <= 0) return
  if (state.combat.playerHull + 0.5 < state.combat.playerHullMax) return
  launchFromDock(state)
  noteProcessLastAction(state, 'sortie-relaunch', 'Launched Sortie')
}

/**
 * Live path: combat + industry advance by real elapsed time (no 1s combat ticks).
 * Long absences should call applyOfflineCatchUp instead.
 * `paused` is the tutorial/overlay presentation gate so unpause does not dump catch-up.
 * Sortie PAUSED uses `combat.sortiePaused` and still lets industry advance.
 */
export function tickGame(state: GameState, now = Date.now(), paused = false): GameState {
  if (paused) {
    if (state.lastTickAt === now) return state
    return { ...state, lastTickAt: now }
  }

  const elapsedMs = Math.max(0, now - state.lastTickAt)
  if (elapsedMs < MIN_FRAME_MS) {
    return state
  }

  const appliedMs = Math.min(elapsedMs, LIVE_TICK_CAP * TICK_MS)
  const next = structuredClone(state)
  addPlaytime(next, appliedMs)
  sampleDroneAllocation(next, appliedMs / 1000)
  advanceSeconds(next, appliedMs / 1000)
  next.lastTickAt = now
  return next
}

export function snapshotResources(resources: Resources): Resources {
  return { ...resources }
}

export function resourceDelta(before: Resources, after: Resources): Partial<Resources> {
  const gains: Partial<Resources> = {}
  for (const key of Object.keys(before) as (keyof Resources)[]) {
    const diff = after[key] - before[key]
    if (Math.abs(diff) > 0.001) gains[key] = diff
  }
  return gains
}

export function resetGame(now = Date.now()): GameState {
  return createInitialState(now)
}

export { totalEnemyHull }
