import type { CombatPushMode, GameState, Resources } from './types'
import { wavesForSector } from './sectors'
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
  essenceBonusDataPerClear,
  essenceBossEssenceMultiplier,
  essenceProductionMultiplier,
  isStationUnlocked,
  matterShopDataPerClear,
  matterShopScrapBonus,
  metaProductionMultiplier,
  prestigeMomentumProductionBonus,
  researchEssenceMultiplier,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  visibleWorkerJobIds,
  workerManufactureSpeed,
  frameScrapMult,
} from './catalog'
import { tickAutomation } from './automation'
import { logisticsProdMult, tickCoreTraining } from './core'
import { computeSignalCoreBonuses, grantSignalCoreDrop } from './signalCores'
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
import { processShouldExtract } from './processProfiles'
import { chosenSortieSpeed } from './uiReadout'
import { WORKER_JOB_IDS } from './workers'
import {
  captureSortieMark,
  closeSortie,
  noteSectorClear,
} from './sortieSummary'
import {
  addPlaytime,
  noteCareerWave,
  noteHighestSector,
  recordPlaytest,
  sampleDroneAllocation,
} from './playtest'
import { sampleSortieEnemies, snapshotSortieEncounter } from './sortieTelemetry'
import {
  buildPlayerFleet,
  syncPlayerFleetWeapons,
  encounterForWave,
  enemyForSector,
  repairRatePerSecond,
  revealCodexFamilies,
  shieldRepairRatePerSecond,
  simulateCombat,
  syncHullAggregates,
  totalEnemyHull,
  computeFightDamage,
} from './combat'
import { bandsClearedForWave, isBossWave, powerSectorForWave, waveForClearedBands } from './waves'
import { newSortieSeed } from './threatBudget'
import {
  applyWorkshopCoreStarts,
  EXTRACTION_SCRAP_BONUS,
  reclaimSpeed,
  resetRunCoreLevels,
  salvageWaveBonus,
} from './workshop'
import {
  awardEquippedMasteryXp,
  snapshotCoreMasteryStart,
} from './coreProgression'
import { clearFrontierHold, isChallengeSortie, addCombatClockMs } from './frontier'
import {
  clearDirectives,
  chooseDirective as applyDirectiveChoice,
  directiveScrapMult,
  hasDirectiveOffer,
  queueDirectiveOffer,
} from './directives'
import {
  noteRebuildCycleSortie,
  noteRebuildCycleWave,
} from './rebuild'
import {
  completeAct1,
  isSystemUnlocked,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import { ACT1_FINAL_WAVE } from './cadence'

/** Legacy alias — production/offline still speak in seconds; combat is continuous. */
export const TICK_MS = 1000
/** Max live catch-up seconds when the tab was backgrounded briefly. */
export const LIVE_TICK_CAP = 5
/** Integration step for continuous sim (seconds). */
export const SIM_STEP_S = 1 / 30
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
  const bands = bandsClearedForWave(w)
  if (isBossWave(w) && bands > (state.combat.highestSector ?? 0)) {
    state.combat.highestSector = bands
    noteHighestSector(state, bands)
  }
  if (bands > (state.meta.highestSectorEver ?? 0) && isBossWave(w)) {
    state.meta.highestSectorEver = bands
  }
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
  const scrapNow = state.resources.scrap ?? 0
  const scrapStart = state.combat.sortieMark?.scrap ?? scrapNow
  let scrapEarned = Math.max(0, scrapNow - scrapStart)
  if (extractBonus && scrapEarned > 0) {
    const bonus = Math.max(1, Math.floor(scrapEarned * EXTRACTION_SCRAP_BONUS))
    state.resources.scrap += bonus
    scrapEarned += bonus
    note = `${note} Extraction +${bonus} Scrap.`
  }
  closeSortie(state, outcome, note, at, { scrapEarned, newBest, previousBest })
  noteRebuildCycleSortie(state, scrapEarned)
  endFurnaceSortie(state)
  state.resources.salvage = 0
  resetRunCoreLevels(state)
  state.combat.runUpgrades = {}
  clearDirectives(state)
  state.combat.frontierHold = false
  state.combat.frontierSector = 0
  state.combat.frontierAttemptOpen = false
  state.combat.frontierNotice = null
  state.combat.wave = 1
  state.combat.sector = 1
  state.combat.docked = true
  state.combat.inFight = false
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
        state.resources[key] +=
          (perDrone ?? 0) * effective * dtSeconds * efficiency * meta
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof GameState['resources']
      state.resources[key] += (perDrone ?? 0) * effective * dtSeconds * meta
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
  const sector = state.combat.sector
  if (lesson === 0 && sector <= 2) return 0
  if (
    lesson === 1 &&
    state.shipyard.modules.includes('plate-layer') &&
    sector <= 3
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
    return state.combat.sector <= 2 ? 1.55 : 1.25
  }
  return 1
}

/** Block Resume / Launch until the current docked lesson is finished. */
export function starterRefitGate(
  _state: GameState,
): 'plate' | 'upgrades' | null {
  return null
}

/** Hull-loss beat on Sortie before retreat or Dock + run report. */
export const DEFEAT_SEQUENCE_S = 1.2

function startDefeatSequence(state: GameState, tactical: boolean): void {
  if ((state.combat.defeatLeft ?? 0) > 0) return
  snapshotSortieEncounter(state)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) flag.hull = 0
  state.combat.playerHull = 0
  state.combat.playerShield = 0
  state.combat.defeatLeft = DEFEAT_SEQUENCE_S
  state.combat.defeatTactical = tactical
  if (tactical || isChallengeSortie(state)) {
    pushLog(state, tactical ? 'Tactical extract — pulling out.' : 'Hull lost — systems failing.')
    return
  }
  const failed = state.combat.wave
  pushLog(state, `Hull integrity lost at Wave ${failed}. Sortie ending.`)
}

function tickDefeatSequence(state: GameState, dt: number): boolean {
  if ((state.combat.defeatLeft ?? 0) <= 0) return false
  state.combat.defeatLeft = Math.max(0, state.combat.defeatLeft - dt)
  if (state.combat.defeatLeft > 0) return true
  onFightLost(state, state.combat.defeatTactical, state.combat.isBoss)
  return true
}

/** Death ends the Sortie. */
function onFightLost(state: GameState, tactical: boolean, boss: boolean): void {
  const fromSector = state.combat.sector
  const fromWave = state.combat.wave
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  clearEnemy(state)
  state.combat.consecutiveLosses += 1
  if (state.echo?.activeId) state.echo.activeId = null
  const label = boss ? ' boss' : ''
  const note = tactical
    ? `Extracted at Wave ${fromWave}${label}.`
    : `Hull lost at Wave ${fromWave}${label}.`
  finishSortie(
    state,
    tactical ? 'extract' : 'defeat',
    note,
    { sector: fromSector, wave: fromWave },
    tactical,
  )
  pushLog(state, `${note} Returned to Dock.`)
}

function grantSectorClearRewards(state: GameState, clearedSector: number, wasBoss: boolean): void {
  const enemy = enemyForSector(clearedSector, wavesForSector(clearedSector))
  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  let scrapGain = enemy.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrapGain *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrapGain *= 1.25
  scrapGain *= 1 + matterShopScrapBonus(state.prestige.matterShop)
  scrapGain *= 1 + computeSignalCoreBonuses(state).scrap
  scrapGain *= frameScrapMult(state)
  const siphonData =
    essenceBonusDataPerClear(state.essence.purchased) +
    matterShopDataPerClear(state.prestige.matterShop)
  const researchOpen = isSystemUnlocked(state, 'research')
  const dataGain =
    dataBlocked || !researchOpen ? 0 : enemy.dataReward + siphonData
  const essenceGain = wasBoss
    ? enemy.essenceReward *
      researchEssenceMultiplier(state.research.unlocked) *
      essenceBossEssenceMultiplier(state.essence.purchased)
    : 0

  state.resources.scrap += scrapGain
  state.resources.data += dataGain
  state.resources.essence += essenceGain
  // Salvage is granted per kill during the fight (USI), not as a wave lump.

  if (wasBoss) {
    grantSignalCoreDrop(state, 'boss')
  } else {
    grantSignalCoreDrop(state, 'sector')
  }

  const parts = [
    `+${scrapGain.toFixed(1)} scrap`,
    dataBlocked || !researchOpen ? 'data locked' : `+${dataGain} data`,
  ]
  if (essenceGain > 0) parts.push(`+${essenceGain} essence`)
  pushLog(
    state,
    `${wasBoss ? 'Boss Wave' : 'Wave'} ${waveForClearedBands(clearedSector)} cleared (${wavesForSector(clearedSector)} waves). ${parts.join(', ')}. Hull ${Math.ceil(state.combat.playerHull)}/${Math.ceil(state.combat.playerHullMax)}.`,
  )
}

function continueSortie(state: GameState): void {
  if (state.combat.docked) {
    state.combat.inFight = false
    state.combat.playerUnits = []
    return
  }
  beginFight(state, true)
}

function grantWaveClearRewards(state: GameState, wave: number, wasBoss: boolean): void {
  const salvageBonus = salvageWaveBonus(state)
  if (salvageBonus > 0) state.resources.salvage += salvageBonus
  if (wasBoss) {
    grantSectorClearRewards(state, powerSectorForWave(wave), true)
    return
  }
  const drip = Math.max(1, Math.floor((1 + Math.floor(powerSectorForWave(wave) / 4)) * directiveScrapMult(state)))
  state.resources.scrap += drip
  pushLog(
    state,
    `Wave ${wave} down. +${drip} scrap.${salvageBonus ? ` +${salvageBonus} salvage.` : ''} Next: W${wave + 1}.`,
  )
}

function onFightWon(state: GameState): void {
  const clearedWave = state.combat.wave
  const wasBoss = state.combat.isBoss
  const careerBestBefore = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  state.meta.lifetimeWaveClears = (state.meta.lifetimeWaveClears ?? 0) + 1
  persistFlagshipHull(state)
  clearEnemiesOnly(state)
  state.combat.consecutiveLosses = 0
  const newBest = noteBestWave(state, clearedWave)
  awardEquippedMasteryXp(state, clearedWave, {
    boss: wasBoss,
    newBest,
    careerBestBefore,
  })

  grantWaveClearRewards(state, clearedWave, wasBoss)
  if (wasBoss) {
    noteProtocolProgress(state)
    state.meta.lifetimeSectorClears = (state.meta.lifetimeSectorClears ?? 0) + 1
    noteSectorClear(state)
    if (clearedWave >= ACT1_FINAL_WAVE) completeAct1(state)
    maybeGrantSystemUnlocks(state)
    tryCompleteChallenge(state)
    tryCompleteProtocol(state)
  }

  state.combat.wave = clearedWave + 1
  state.combat.sector = powerSectorForWave(state.combat.wave)
  if (queueDirectiveOffer(state, clearedWave)) {
    state.combat.inFight = false
    return
  }
  if (!state.combat.docked && processShouldExtract(state)) {
    finishSortie(
      state,
      'extract',
      `Auto-extracted at Wave ${clearedWave}.`,
      { sector: powerSectorForWave(clearedWave), wave: clearedWave },
      true,
    )
    return
  }
  continueSortie(state)
}

function tickCombat(state: GameState, dt: number): void {
  if (tickDefeatSequence(state, dt)) return
  if (!state.combat.inFight) return

  state.combat.fightElapsed = (state.combat.fightElapsed ?? 0) + dt
  addCombatClockMs(state, dt)
  simulateCombat(state, dt, pushLog)

  const enemiesAlive = state.combat.enemyUnits.some((u) => u.hull > 0)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  const flagHull = flag?.hull ?? 0
  const flagMax = flag?.hullMax ?? state.combat.playerHullMax

  if (!enemiesAlive) {
    onFightWon(state)
    return
  }

  const retreatThreshold = aiDoctrinesActive(state, 'tactical-retreat')
    ? flagMax * 0.25
    : 0

  if (flagHull <= retreatThreshold) {
    const tactical =
      aiDoctrinesActive(state, 'tactical-retreat') && retreatThreshold > 0
    startDefeatSequence(state, tactical)
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

/** Advance / Hold auto-engage while not Paused. AI never toggles this. */
function maybeAutoEngage(state: GameState): void {
  if (state.combat.inFight || state.combat.docked) return
  if (hasDirectiveOffer(state)) return
  if (starterRefitGate(state)) {
    state.combat.docked = true
    return
  }
  beginFight(state)
}

export function beginFight(state: GameState, keepFleet = false): void {
  const wave = Math.max(1, state.combat.wave || 1)
  state.combat.wave = wave
  state.combat.sector = powerSectorForWave(wave)
  if (!state.combat.sortieSeed) state.combat.sortieSeed = newSortieSeed(state)
  const encounter = encounterForWave(wave, 1, state)
  syncPersistedHullCaps(state)

  state.combat.docked = false
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  if (!state.combat.sortieMark) state.combat.sortieMark = captureSortieMark(state)
  state.combat.fightElapsed = 0
  state.shipyard.frameLocked = true
  state.combat.inFight = true
  state.combat.enemyName = encounter.name
  state.combat.enemyFamily = encounter.family
  state.combat.enemyTags = [...encounter.tags]
  state.combat.isBoss = encounter.isBoss
  state.combat.bossPhase = 0
  state.combat.bossMechanic = encounter.mechanicId
  state.combat.waveThreat = encounter.threat
    ? { seed: encounter.threat.seed, budget: encounter.threat.budget, spent: encounter.threat.spent }
    : undefined
  if (state.combat.sortieMark) state.combat.sortieMark.sortieSeed = state.combat.sortieSeed
  state.combat.enemyUnits = encounter.units.map((u) => structuredClone(u))
  const pressure = starterCombatPressureMult(state)
  if (pressure !== 1) {
    for (const unit of state.combat.enemyUnits) {
      for (const weapon of unit.weapons) {
        weapon.damage *= pressure
      }
    }
  }
  if (!keepFleet || state.combat.playerUnits.length === 0) {
    state.combat.playerUnits = buildPlayerFleet(state)
  } else {
    applyNetworkCombatRefresh(state)
  }
  clearShots(state)
  syncHullAggregates(state)
  sampleSortieEnemies(state)
  revealCodexFamilies(
    state,
    encounter.units.map((u) => u.family),
  )

  const matchup = computeFightDamage(state)
  const note =
    matchup.matchupNotes.length > 0
      ? ` ${matchup.matchupNotes.join('; ')}.`
      : ` ${encounter.blurb}`
  pushLog(
    state,
    `Engaging ${encounter.name} — Wave ${wave}${encounter.isBoss ? ' boss' : ''} [${encounter.family}] (${encounter.units.length} units).${note}`,
  )
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  if (starterRefitGate(state)) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

function applyPushMode(state: GameState): void {
  state.combat.pushMode = 'advance'
  state.combat.campaign = true
}

/** GDD: every Sortie stays on Advance. Hold modes are no-ops. */
export function setCampaign(state: GameState, _on: boolean): GameState {
  return setPushMode(state, 'advance')
}

export function setPushMode(state: GameState, _mode: CombatPushMode): GameState {
  if (state.combat.pushMode === 'advance' && state.combat.campaign) return state
  const next = structuredClone(state)
  next.combat.pushMode = 'advance'
  next.combat.campaign = true
  return next
}

function launchFromDock(state: GameState): void {
  armPendingFacilities(state)
  clearFrontierHold(state)
  applyPushMode(state)
  state.combat.wave = 1
  state.combat.sector = 1
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
  recordPlaytest(state, 'first_launch', { firstKey: 'launch' })
  state.shipyard.frameLocked = true
  fullHealPlayer(state)
}

/** Extract ends the Sortie. Launch always starts at Wave 1. */
export function setDocked(state: GameState, docked: boolean): GameState {
  if (state.combat.docked === docked) return state
  const next = structuredClone(state)
  if (docked) {
    next.combat.defeatLeft = 0
    next.combat.defeatTactical = false
    const at = { sector: next.combat.sector, wave: next.combat.wave }
    if (next.combat.inFight) {
      snapshotSortieEncounter(next)
      persistFlagshipHull(next)
      clearEnemy(next)
    }
    finishSortie(next, 'extract', `Extracted at Wave ${at.wave}.`, at, true)
    pushLog(next, next.combat.lastSortie.note)
  } else {
    launchFromDock(next)
    pushLog(next, 'Sortie launched — Wave 1. Combat keeps running if you open the Dock.')
  }
  return next
}

/** GDD: no Frontier Hold. Kept as a no-op so old UI/sim calls do not crash. */
export function retryFrontier(state: GameState): GameState {
  return state
}

/** GDD: every Sortie starts at Wave 1. Warp no longer jumps the run. */
export function warpToSector(state: GameState, _sector: number): GameState {
  return state
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

/** Advance continuous simulation by `seconds` of game time (mutates). */
export function advanceSeconds(state: GameState, seconds: number): void {
  let left = Math.max(0, seconds)
  const combatSpeed = chosenSortieSpeed(state)
  const reclaim = reclaimSpeed(state)
  while (left > 1e-6) {
    const dt = Math.min(SIM_STEP_S, left)
    // Industry / fab / training always use real dt.
    applyProduction(state, dt)
    if (state.combat.inFight) {
      // Combat Chrono and reclaim accelerate the fight sim only.
      tickCombat(state, dt * combatSpeed * reclaim)
    } else {
      tickOutOfCombatRepair(state, dt)
      maybeAutoEngage(state)
    }
    left -= dt
  }
  tickAutomation(state)
  maybeProcessRelaunch(state)
  tryCompleteAchievements(state)
}

function maybeProcessRelaunch(state: GameState): void {
  const intentLaunch = evaluateProcessIntent(state).launchSortie && hasProcess(state, 'rule-builder')
  const autoLaunch = hasProcess(state, 'sortie-relaunch') && processConfig(state).sortie.autoRelaunch
  if (!intentLaunch && !autoLaunch) return
  if (!state.combat.docked) return
  if ((state.combat.defeatLeft ?? 0) > 0) return
  if (state.protocols?.activeId) return
  if (starterRefitGate(state)) return
  if (state.combat.playerHullMax <= 0) return
  if (state.combat.playerHull + 0.5 < state.combat.playerHullMax) return
  launchFromDock(state)
  noteProcessLastAction(state, 'sortie-relaunch', 'Launched Sortie')
}

/**
 * @deprecated name kept for tests — advances N seconds of continuous sim.
 */
export function advanceTicks(state: GameState, ticks: number): void {
  advanceSeconds(state, ticks)
}

/**
 * Live path: combat + industry advance by real elapsed time (no 1s combat ticks).
 * Long absences should call applyOfflineCatchUp instead.
 * `paused` holds the clock (onboarding overlay) so unpause does not dump catch-up.
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

/** @deprecated walls removed — kept for import safety in old tests. */
export const WALL_AFTER_LOSSES = 0

/** @deprecated use setCampaign(true) */
export function resumeCampaign(state: GameState): GameState {
  return setCampaign(state, true)
}

export { totalEnemyHull }
