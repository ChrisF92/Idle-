import type { GameState, Resources } from './types'
import {
  computeShipStats,
  createInitialState,
  fullHealPlayer,
  syncPersistedHullCaps,
} from './state'
import {
  COMBAT_DRONES_UNLOCK_SECTOR,
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  aiDoctrinesActive,
  essenceBonusDataPerClear,
  essenceProductionMultiplier,
  isStationUnlocked,
  matterShopDataPerClear,
  matterShopScrapBonus,
  metaProductionMultiplier,
  researchEssenceMultiplier,
  workerManufactureSpeed,
} from './catalog'
import { tryCompleteChallenge } from './actions'
import {
  WAVES_PER_SECTOR,
  maybeGrantSystemUnlocks,
} from './progression'
import {
  buildPlayerFleet,
  enemyForSector,
  repairRatePerSecond,
  revealCodexFamilies,
  shieldRepairRatePerSecond,
  simulateCombat,
  syncHullAggregates,
  totalEnemyHull,
  computeFightDamage,
} from './combat'

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
  return (
    metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
      state.prestige.challengeClears,
    ) * essenceProductionMultiplier(state.essence.purchased)
  )
}

function applyProduction(state: GameState, dtSeconds: number): void {
  const meta = productionMeta(state)

  for (const station of STATIONS) {
    if (!isStationUnlocked(state, station.id)) continue
    const drones = state.base.assignments[station.id] ?? 0
    if (drones <= 0) continue

    if (station.upkeepScrapPerDrone) {
      const upkeep = station.upkeepScrapPerDrone * drones * dtSeconds
      const available = state.resources.scrap
      const paid = Math.min(available, upkeep)
      state.resources.scrap -= paid
      const efficiency = upkeep > 0 ? paid / upkeep : 1
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        const key = resource as keyof GameState['resources']
        state.resources[key] +=
          (perDrone ?? 0) * drones * dtSeconds * efficiency * meta
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof GameState['resources']
      state.resources[key] += (perDrone ?? 0) * drones * dtSeconds * meta
    }
  }

  // Worker manufacture (only once Base has been unlocked via career progress).
  if (state.meta.highestSectorEver >= 3 || state.combat.highestSector >= 3) {
    const speed = workerManufactureSpeed(state)
    state.base.manufactureProgress += (dtSeconds * speed) / WORKER_MANUFACTURE_SECONDS
    while (state.base.manufactureProgress >= 1) {
      state.base.manufactureProgress -= 1
      state.base.workerDrones += 1
      pushLog(state, `Worker drone manufactured. Corps size: ${state.base.workerDrones}.`)
    }
  }

  if (
    !state.meta.combatDronesUnlocked &&
    Math.max(state.meta.highestSectorEver, state.combat.highestSector) >=
      COMBAT_DRONES_UNLOCK_SECTOR
  ) {
    state.meta.combatDronesUnlocked = true
    pushLog(state, 'Combat drone corps schematics unlocked (assignment comes later).')
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
    const drones = state.base.assignments[station.id] ?? 0
    if (drones <= 0) continue

    if (station.upkeepScrapPerDrone) {
      const upkeep = station.upkeepScrapPerDrone * drones
      const efficiency = state.resources.scrap > 0 || upkeep <= 0 ? 1 : 0
      add('scrap', -upkeep * efficiency)
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        add(
          resource as keyof Resources,
          (perDrone ?? 0) * drones * efficiency * meta,
        )
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      add(resource as keyof Resources, (perDrone ?? 0) * drones * meta)
    }
  }

  return rates
}

/** Death / retreat: warp to previous sector start with full hull; waves reset. */
function onFightLost(state: GameState, tactical: boolean, boss: boolean): void {
  const fromSector = state.combat.sector
  const fromWave = state.combat.wave
  clearEnemy(state)
  state.combat.consecutiveLosses += 1
  state.combat.sector = Math.max(1, fromSector - 1)
  state.combat.wave = 1
  fullHealPlayer(state)

  const label = tactical ? 'Tactical warp' : 'Ship destroyed — warping'
  pushLog(
    state,
    `${label} from sector ${fromSector} wave ${fromWave}${boss ? ' boss' : ''} → sector ${state.combat.sector} W1 (hull restored).`,
  )
}

function grantSectorClearRewards(state: GameState, clearedSector: number, wasBoss: boolean): void {
  const enemy = enemyForSector(clearedSector, WAVES_PER_SECTOR)
  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  let scrapGain = enemy.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrapGain *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrapGain *= 1.2
  scrapGain *= 1 + matterShopScrapBonus(state.prestige.matterShop)
  const siphonData =
    essenceBonusDataPerClear(state.essence.purchased) +
    matterShopDataPerClear(state.prestige.matterShop)
  const dataGain = dataBlocked ? 0 : enemy.dataReward + siphonData
  const aiGain = enemy.aiReward
  const essenceGain =
    enemy.essenceReward * researchEssenceMultiplier(state.research.unlocked)
  const salvageGain = enemy.salvageReward

  state.resources.scrap += scrapGain
  state.resources.data += dataGain
  state.resources.aiPoints += aiGain
  state.resources.essence += essenceGain
  state.resources.salvage += salvageGain

  const parts = [
    `+${scrapGain.toFixed(1)} scrap`,
    dataBlocked ? 'data blocked' : `+${dataGain} data`,
    `+${aiGain} AI`,
    `+${salvageGain} salvage`,
  ]
  if (essenceGain > 0) parts.push(`+${essenceGain} essence`)
  pushLog(
    state,
    `${wasBoss ? 'Boss' : 'Sector'} ${clearedSector} cleared (${WAVES_PER_SECTOR} waves). ${parts.join(', ')}. Hull ${Math.ceil(state.combat.playerHull)}/${Math.ceil(state.combat.playerHullMax)}.`,
  )
}

function onFightWon(state: GameState): void {
  const clearedSector = state.combat.sector
  const clearedWave = state.combat.wave
  const wasBoss = state.combat.isBoss

  persistFlagshipHull(state)
  const missingHull = state.combat.playerHullMax - state.combat.playerHull
  const missingShield = state.combat.playerShieldMax - state.combat.playerShield
  state.combat.playerHull = Math.min(
    state.combat.playerHullMax,
    state.combat.playerHull + missingHull * 0.25,
  )
  state.combat.playerShield = Math.min(
    state.combat.playerShieldMax,
    state.combat.playerShield + missingShield * 0.25,
  )
  clearEnemy(state)
  state.combat.consecutiveLosses = 0

  if (clearedWave < WAVES_PER_SECTOR) {
    state.combat.wave = clearedWave + 1
    // Small mid-sector scrap drip so long wave chains aren't pure dead air.
    const drip = 1 + Math.floor(clearedSector / 4)
    state.resources.scrap += drip
    state.resources.salvage += Math.max(1, Math.floor(drip / 2))
    pushLog(
      state,
      `Wave ${clearedWave}/${WAVES_PER_SECTOR} down in sector ${clearedSector}. +${drip} scrap. Next: W${state.combat.wave}.`,
    )
    return
  }

  grantSectorClearRewards(state, clearedSector, wasBoss)
  state.combat.highestSector = Math.max(state.combat.highestSector, clearedSector)
  maybeGrantSystemUnlocks(state)

  if (state.combat.campaign) {
    state.combat.sector = clearedSector + 1
    state.combat.wave = 1
  } else {
    // Hold: repeat the whole sector from wave 1.
    state.combat.sector = clearedSector
    state.combat.wave = 1
  }
  tryCompleteChallenge(state)
}

function tickCombat(state: GameState, dt: number): void {
  if (!state.combat.inFight) return

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

/** Hull / shield restore while Docked (hangar only). */
function tickDockedRepair(state: GameState, dt: number): void {
  if (!state.combat.docked || state.combat.inFight) return
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax

  if (state.combat.playerHull < stats.hullMax) {
    state.combat.playerHull = Math.min(
      stats.hullMax,
      state.combat.playerHull + repairRatePerSecond(state) * dt,
    )
  }
  if (state.combat.playerShield < stats.shieldMax) {
    state.combat.playerShield = Math.min(
      stats.shieldMax,
      state.combat.playerShield + shieldRepairRatePerSecond(state) * dt,
    )
  }
}

/** Both Advance and Hold auto-engage while undocked. */
function maybeAutoEngage(state: GameState): void {
  if (state.combat.inFight || state.combat.docked) return
  beginFight(state)
}

function maybeAiAutomation(state: GameState): void {
  if (state.prestige.activeChallengeId === 'no-ai') return

  if (
    aiDoctrinesActive(state, 'auto-dock-critical') &&
    !state.combat.docked &&
    !state.combat.inFight &&
    state.combat.playerHullMax > 0 &&
    state.combat.playerHull / state.combat.playerHullMax < 0.35
  ) {
    state.combat.docked = true
    pushLog(state, 'Crisis Dock — auto-docked at low hull.')
    return
  }

  if (
    aiDoctrinesActive(state, 'auto-launch-ready') &&
    state.combat.docked &&
    !state.combat.inFight &&
    state.combat.playerHull >= state.combat.playerHullMax - 0.5 &&
    state.combat.playerShield >= state.combat.playerShieldMax - 0.5
  ) {
    state.combat.docked = false
    if (!state.shipyard.frameLocked) {
      state.shipyard.frameLocked = true
      pushLog(state, 'Sortie Protocol — auto-launched (frame locked).')
    } else {
      pushLog(state, 'Sortie Protocol — auto-launched.')
    }
  }
}

export function beginFight(state: GameState): void {
  const sector = state.combat.sector
  const wave = Math.min(
    WAVES_PER_SECTOR,
    Math.max(1, state.combat.wave || 1),
  )
  state.combat.wave = wave
  const encounter = enemyForSector(sector, wave)
  syncPersistedHullCaps(state)

  state.combat.docked = false
  state.shipyard.frameLocked = true
  state.combat.inFight = true
  state.combat.enemyName = encounter.name
  state.combat.enemyFamily = encounter.family
  state.combat.enemyTags = [...encounter.tags]
  state.combat.isBoss = encounter.isBoss
  state.combat.bossPhase = 0
  state.combat.enemyUnits = encounter.units.map((u) => structuredClone(u))
  state.combat.playerUnits = buildPlayerFleet(state)
  state.combat.projectiles = []
  state.combat.fx = []
  syncHullAggregates(state)
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
    `Engaging ${encounter.name} — sector ${sector} wave ${wave}/${WAVES_PER_SECTOR} [${encounter.family}] (${encounter.units.length} units).${note}`,
  )
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

/** Advance = true (push sectors), Hold = false (farm current sector). */
export function setCampaign(state: GameState, on: boolean): GameState {
  const next = structuredClone(state)
  next.combat.campaign = on
  if (!on) {
    pushLog(next, 'Hold engaged — farming the current sector.')
  } else {
    pushLog(next, 'Advance online — continuous sector push.')
  }
  return next
}

/**
 * Dock pauses auto-engage and aborts the current fight so the Shipyard can refit.
 * Launch clears docked and lets Advance/Hold resume fighting.
 */
export function setDocked(state: GameState, docked: boolean): GameState {
  if (state.combat.docked === docked) return state
  const next = structuredClone(state)
  if (docked) {
    if (next.combat.inFight) {
      persistFlagshipHull(next)
      clearEnemy(next)
    }
    next.combat.docked = true
    pushLog(next, 'Docked — refit in Shipyard and repair hull, then Launch.')
  } else {
    next.combat.docked = false
    if (!next.shipyard.frameLocked) {
      next.shipyard.frameLocked = true
      pushLog(
        next,
        'Launching — frame locked for this run. Modules can still be refit when Docked.',
      )
    } else {
      pushLog(next, 'Launching — returning to the sector.')
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
  while (left > 1e-6) {
    const dt = Math.min(SIM_STEP_S, left)
    applyProduction(state, dt)
    maybeAiAutomation(state)
    if (state.combat.inFight) {
      tickCombat(state, dt)
    } else {
      tickDockedRepair(state, dt)
      maybeAutoEngage(state)
    }
    left -= dt
  }
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
