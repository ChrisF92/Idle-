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
  advanceFabProject,
  aiDoctrinesActive,
  aiFabBonus,
  aiProductionBonus,
  combatSpeedMultiplier,
  droneCap,
  essenceBonusDataPerClear,
  essenceBossEssenceMultiplier,
  essenceProductionMultiplier,
  isStationUnlocked,
  matterShopDataPerClear,
  matterShopScrapBonus,
  metaProductionMultiplier,
  moduleLevel,
  prestigeMomentumProductionBonus,
  researchEssenceMultiplier,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  workerManufactureSpeed,
} from './catalog'
import { tickAutomation } from './automation'
import {
  logisticsFabMult,
  logisticsProdMult,
  tickCoreTraining,
} from './core'
import { computeSignalCoreBonuses, grantSignalCoreDrop } from './signalCores'
import { tryCompleteChallenge } from './actions'
import {
  isSystemUnlocked,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'
import {
  buildPlayerFleet,
  encounterForWave,
  repairRatePerSecond,
  revealCodexFamilies,
  shieldRepairRatePerSecond,
  simulateCombat,
  syncHullAggregates,
  totalEnemyHull,
  computeFightDamage,
} from './combat'
import {
  defeatExpedition,
  refreshEstimatedPrestigeMatter,
} from './expedition'

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

function clearEnemy(state: GameState): void {
  state.combat.inFight = false
  state.combat.enemyName = 'None'
  state.combat.enemyFamily = ''
  state.combat.enemyTags = []
  state.combat.isBoss = false
  state.combat.bossPhase = 0
  state.combat.enemyUnits = []
  state.combat.playerUnits = []
  state.combat.enemyHull = 0
  state.combat.enemyHullMax = 0
  state.combat.projectiles = []
  state.combat.fx = []
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

  // Worker manufacture (only once Base has been unlocked via career progress).
  if (state.meta.highestSectorEver >= 4 || state.combat.highestSector >= 4) {
    const cap = droneCap(state)
    if (state.base.workerDrones < cap) {
      const speed = workerManufactureSpeed(state)
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
          `Worker drone manufactured. Corps size: ${state.base.workerDrones}/${cap}.`,
        )
      }
      if (state.base.workerDrones >= cap) {
        state.base.manufactureProgress = Math.min(
          state.base.manufactureProgress,
          0.999,
        )
      }
    }
  }

  advanceFabProject(
    state,
    dtSeconds,
    (line) => pushLog(state, line),
    logisticsFabMult(state) *
      (1 + computeSignalCoreBonuses(state).fab) *
      (1 + aiFabBonus(state)),
  )
  tickCoreTraining(state, dtSeconds)
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
      add(resource as keyof Resources, (perDrone ?? 0) * effective * meta)
    }
  }

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
  state: GameState,
): 'plate' | 'upgrades' | null {
  if (state.prestige.prestigeCount > 0) return null
  if ((state.meta.ascensionCount ?? 0) > 0) return null
  const lesson = state.meta.starterCombatLesson ?? 0
  if (lesson === 1 && !state.shipyard.modules.includes('plate-layer')) {
    return 'plate'
  }
  if (lesson === 2) {
    const pulse = moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon')
    const plate = moduleLevel(state.shipyard.moduleLevels, 'plate-layer')
    if (pulse < STARTER_UPGRADE_LEVEL || plate < STARTER_UPGRADE_LEVEL) {
      return 'upgrades'
    }
  }
  return null
}

function applyStarterCombatDeath(state: GameState, lesson: 0 | 1): void {
  const fromSector = state.combat.sector
  clearEnemy(state)
  state.combat.consecutiveLosses += 1
  state.combat.sector = Math.max(1, fromSector)
  state.combat.wave = 1
  state.combat.docked = true
  state.combat.fightElapsed = 0
  fullHealPlayer(state)

  if (lesson === 0) {
    state.resources.scrap = Math.max(state.resources.scrap, STARTER_PLATE_SCRAP_FLOOR)
    state.resources.alloys = Math.max(state.resources.alloys, 5)
    state.meta.starterCombatLesson = 1
    pushLog(
      state,
      'Hull breached — docking for repairs. Buy Plate Layer in the Shipyard before launching again.',
    )
    return
  }

  state.resources.salvage += STARTER_SALVAGE_GRANT
  state.meta.starterCombatLesson = 2
  pushLog(
    state,
    `Wreck salvage recovered (+${STARTER_SALVAGE_GRANT}). Upgrade Pulse Cannon and Plate Layer before Resume.`,
  )
}

/** Death ends the Expedition and awards base PM (no Extraction bonus). */
function onFightLost(state: GameState, tactical: boolean, boss: boolean): void {
  const lesson = starterDeathLessonOnLoss(state)
  if (lesson !== null) {
    applyStarterCombatDeath(state, lesson)
    return
  }

  const fromWave = state.combat.wave
  const label = tactical ? 'Tactical Extract' : 'Flagship destroyed'
  pushLog(
    state,
    `${label} at wave ${fromWave}${boss ? ' (boss)' : ''}.`,
  )
  // Mutate via defeatExpedition clone merge — copy fields back.
  const ended = defeatExpedition(state)
  Object.assign(state, ended)
}

/**
 * Phase 1 interim between-wave recovery (stand-in for Repair Dock).
 * Pause itself never repairs.
 */
function betweenWaveRepair(state: GameState): void {
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  const hullGain = stats.hullMax * 0.08
  const shieldGain = stats.shieldMax * 0.2
  state.combat.playerHull = Math.min(
    stats.hullMax,
    state.combat.playerHull + hullGain,
  )
  state.combat.playerShield = Math.min(
    stats.shieldMax,
    state.combat.playerShield + shieldGain,
  )
}

function grantWaveClearRewards(state: GameState, wave: number, wasBoss: boolean): void {
  const enemy = encounterForWave('sector-1', wave)
  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  let scrapGain = enemy.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrapGain *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrapGain *= 1.25
  scrapGain *= 1 + matterShopScrapBonus(state.prestige.matterShop)
  scrapGain *= 1 + computeSignalCoreBonuses(state).scrap
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
    : enemy.essenceReward > 0
      ? enemy.essenceReward
      : 0
  const salvageGain = enemy.salvageReward

  state.resources.scrap += scrapGain
  state.resources.data += dataGain
  state.resources.essence += essenceGain
  state.resources.salvage += salvageGain
  state.combat.runScrapEarned += scrapGain
  state.combat.runSalvageEarned += salvageGain

  if (wasBoss) {
    grantSignalCoreDrop(state, 'boss')
  }

  const parts = [
    `+${scrapGain.toFixed(1)} scrap`,
    dataBlocked || !researchOpen ? 'data locked' : `+${dataGain} data`,
    `+${salvageGain} salvage`,
  ]
  if (essenceGain > 0) parts.push(`+${essenceGain} essence`)
  pushLog(
    state,
    `Wave ${wave} cleared${wasBoss ? ' (boss)' : ''}. ${parts.join(', ')}. Hull ${Math.ceil(state.combat.playerHull)}/${Math.ceil(state.combat.playerHullMax)}.`,
  )
}

function onFightWon(state: GameState): void {
  const clearedWave = state.combat.wave
  const wasBoss = state.combat.isBoss
  state.meta.lifetimeWaveClears = (state.meta.lifetimeWaveClears ?? 0) + 1

  persistFlagshipHull(state)
  clearEnemy(state)
  state.combat.consecutiveLosses = 0
  state.combat.bestWaveThisRun = Math.max(state.combat.bestWaveThisRun, clearedWave)
  state.meta.highestWaveEver = Math.max(
    state.meta.highestWaveEver ?? 0,
    clearedWave,
  )

  // Career unlock bridge (~wave 100 ≈ old sector 30).
  const sectorBridge = Math.max(1, Math.ceil(clearedWave * 0.3))
  state.combat.highestSector = Math.max(state.combat.highestSector, sectorBridge)
  state.meta.highestSectorEver = Math.max(state.meta.highestSectorEver, sectorBridge)
  if (clearedWave >= 100) {
    state.meta.act1Cleared = true
    state.meta.lifetimeSectorClears = (state.meta.lifetimeSectorClears ?? 0) + 1
  }

  grantWaveClearRewards(state, clearedWave, wasBoss)
  betweenWaveRepair(state)
  maybeGrantSystemUnlocks(state)
  tryCompleteChallenge(state)

  // Continuous Push — advance to the next wave (Endless after 100).
  state.combat.wave = clearedWave + 1
  state.combat.mode = 'push'
  state.combat.campaign = true
  refreshEstimatedPrestigeMatter(state)
}

function tickCombat(state: GameState, dt: number): void {
  if (!state.combat.inFight) return

  state.combat.fightElapsed = (state.combat.fightElapsed ?? 0) + dt
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
    const boss = state.combat.isBoss
    const tactical =
      aiDoctrinesActive(state, 'tactical-retreat') && retreatThreshold > 0
    onFightLost(state, tactical, boss)
  }
}

/**
 * Repair only between waves while Pushing (field rate), never while Paused.
 * Attrition challenge blocks field repair.
 */
function fieldRepairMultiplier(state: GameState): number {
  if (state.prestige.activeChallengeId === 'attrition') return 0
  if (state.combat.docked || state.combat.mode === 'paused') return 0
  let mult = aiDoctrinesActive(state, 'auto-launch-ready') ? 0.35 : 0.15
  if (
    aiDoctrinesActive(state, 'auto-dock-critical') &&
    state.combat.playerHullMax > 0 &&
    state.combat.playerHull / state.combat.playerHullMax < 0.35
  ) {
    mult = Math.max(mult, 0.4)
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
  if (starterRefitGate(state)) {
    state.combat.docked = true
    return
  }
  beginFight(state)
}

export function beginFight(state: GameState): void {
  state.combat.sector = 1
  const wave = Math.max(1, state.combat.wave || 1)
  state.combat.wave = wave
  const encounter = encounterForWave('sector-1', wave)
  syncPersistedHullCaps(state)

  if (!state.combat.expeditionStartedAt) {
    state.combat.expeditionStartedAt = Date.now()
  }

  state.combat.docked = false
  state.combat.mode = 'push'
  state.combat.campaign = true
  state.combat.fightElapsed = 0
  state.shipyard.frameLocked = true
  state.combat.inFight = true
  state.combat.enemyName = encounter.name
  state.combat.enemyFamily = encounter.family
  state.combat.enemyTags = [...encounter.tags]
  state.combat.isBoss = encounter.isBoss
  state.combat.bossPhase = 0
  state.combat.enemyUnits = encounter.units.map((u) => structuredClone(u))
  const pressure = starterCombatPressureMult(state)
  if (pressure !== 1) {
    for (const unit of state.combat.enemyUnits) {
      for (const weapon of unit.weapons) {
        weapon.damage *= pressure
      }
    }
  }
  state.combat.playerUnits = buildPlayerFleet(state)
  state.combat.projectiles = []
  state.combat.fx = []
  syncHullAggregates(state)
  revealCodexFamilies(
    state,
    encounter.units.map((u) => u.family),
  )
  refreshEstimatedPrestigeMatter(state)

  const matchup = computeFightDamage(state)
  const note =
    matchup.matchupNotes.length > 0
      ? ` ${matchup.matchupNotes.join('; ')}.`
      : ` ${encounter.blurb}`
  const endless = wave > 100 ? ' · Endless' : ''
  pushLog(
    state,
    `Engaging ${encounter.name} — Sector 1 wave ${wave}${endless} [${encounter.family}] (${encounter.units.length} units).${note}`,
  )
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  if (starterRefitGate(state)) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

/** Push mode (Hold/Patrol arrives in a later phase). */
export function setCampaign(state: GameState, on: boolean): GameState {
  const next = structuredClone(state)
  next.combat.campaign = on
  next.combat.mode = on ? 'push' : 'push'
  if (!on) {
    pushLog(next, 'Patrol unlocks in a later phase — staying on Push.')
    next.combat.campaign = true
    next.combat.mode = 'push'
  } else {
    pushLog(next, 'Push online — advancing Expedition waves.')
  }
  return next
}

/**
 * Pause stops simulation without repairing, resetting the wave, or unlocking refit.
 * Resume / Launch clears pause. First Launch locks the frame and modules.
 */
export function setDocked(state: GameState, docked: boolean): GameState {
  if (state.combat.docked === docked) return state
  const next = structuredClone(state)
  if (docked) {
    // Pause mid-fight: freeze simulation, keep wave progress and hull.
    next.combat.docked = true
    next.combat.mode = 'paused'
    // Keep inFight units visible but simulation stops via docked check.
    pushLog(
      next,
      `Paused at wave ${next.combat.wave}. Simulation frozen — no repair or refit.`,
    )
  } else {
    const gate = starterRefitGate(next)
    if (gate === 'plate') {
      pushLog(next, 'Unlock and fit Plate Layer before launching again.')
      return state
    }
    if (gate === 'upgrades') {
      pushLog(next, 'Upgrade Pulse Cannon and Plate Layer with Salvage before Resume.')
      return state
    }
    next.combat.docked = false
    next.combat.mode = 'push'
    next.combat.campaign = true
    if (!next.shipyard.frameLocked) {
      next.shipyard.frameLocked = true
      if (!next.combat.expeditionStartedAt) {
        next.combat.expeditionStartedAt = Date.now()
      }
      pushLog(
        next,
        'Launching Sector 1 — frame and modules locked for this Expedition.',
      )
    } else {
      pushLog(next, `Resumed — continuing wave ${next.combat.wave}.`)
    }
  }
  return next
}

/**
 * Warp to a sector cleared this prestige (1..highestSector).
 * Aborts the current fight. If docked, stays docked for refit; otherwise auto-engages next tick.
 */
export function warpToSector(state: GameState, sector: number): GameState {
  if (!aiDoctrinesActive(state, 'warp-navigator') && state.combat.highestSector < 1) {
    return state
  }
  // Warp requires the Warp Navigator AI unlock (QoL gate).
  if (!state.ai.purchased.includes('warp-navigator')) return state
  const max = state.combat.highestSector
  if (!Number.isFinite(sector) || sector < 1 || sector > max) return state
  const next = structuredClone(state)
  const from = next.combat.sector
  if (next.combat.inFight) {
    persistFlagshipHull(next)
  }
  clearEnemy(next)
  next.combat.sector = Math.floor(sector)
  next.combat.wave = 1
  pushLog(
    next,
    from === next.combat.sector
      ? `Warp reaffirm — sector ${next.combat.sector} W1.`
      : `Warped ${from} → sector ${next.combat.sector} W1.`,
  )
  return next
}

/** Advance continuous simulation by `seconds` of game time (mutates). */
export function advanceSeconds(state: GameState, seconds: number): void {
  let left = Math.max(0, seconds)
  const combatSpeed = combatSpeedMultiplier(state)
  while (left > 1e-6) {
    const dt = Math.min(SIM_STEP_S, left)
    // Industry / fab / training always use real dt.
    applyProduction(state, dt)
    if (state.combat.docked || state.combat.mode === 'paused') {
      // Paused: freeze Expedition timers and combat; industry still runs.
    } else if (state.combat.inFight) {
      tickCombat(state, dt * combatSpeed)
    } else {
      tickOutOfCombatRepair(state, dt)
      maybeAutoEngage(state)
    }
    left -= dt
  }
  tickAutomation(state)
  tryCompleteAchievements(state)
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
 */
export function tickGame(state: GameState, now = Date.now()): GameState {
  const elapsedMs = Math.max(0, now - state.lastTickAt)
  if (elapsedMs < MIN_FRAME_MS) {
    return state
  }

  const appliedMs = Math.min(elapsedMs, LIVE_TICK_CAP * TICK_MS)
  const next = structuredClone(state)
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
