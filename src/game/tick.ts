import type { GameState, Resources } from './types'
import {
  computeShipStats,
  createInitialState,
  fullHealPlayer,
  syncPersistedHullCaps,
} from './state'
import {
  BUILDINGS,
  aiDoctrinesActive,
  essenceBonusDataPerClear,
  essenceProductionMultiplier,
  matterShopDataPerClear,
  matterShopScrapBonus,
  metaProductionMultiplier,
  researchEssenceMultiplier,
} from './catalog'
import { tryCompleteChallenge } from './actions'
import {
  buildPlayerFleet,
  canReengage,
  enemyForSector,
  repairRatePerSecond,
  simulateCombat,
  shieldRepairRatePerSecond,
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

function applyProduction(state: GameState, dtSeconds: number): void {
  const meta =
    metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
      state.prestige.challengeClears,
    ) * essenceProductionMultiplier(state.essence.purchased)

  for (const building of BUILDINGS) {
    const level = state.base.buildings[building.id] ?? 0
    if (level <= 0) continue

    if (building.upkeepScrapPerLevel) {
      const upkeep = building.upkeepScrapPerLevel * level * dtSeconds
      const available = state.resources.scrap
      const paid = Math.min(available, upkeep)
      state.resources.scrap -= paid
      const efficiency = upkeep > 0 ? paid / upkeep : 1
      for (const [resource, perLevel] of Object.entries(building.rates)) {
        const key = resource as keyof GameState['resources']
        state.resources[key] +=
          (perLevel ?? 0) * level * dtSeconds * efficiency * meta
      }
      continue
    }

    for (const [resource, perLevel] of Object.entries(building.rates)) {
      const key = resource as keyof GameState['resources']
      state.resources[key] += (perLevel ?? 0) * level * dtSeconds * meta
    }
  }
}

/** Death / retreat: warp to previous sector start with full hull. */
function onFightLost(state: GameState, tactical: boolean, boss: boolean): void {
  const fromSector = state.combat.sector
  clearEnemy(state)
  state.combat.consecutiveLosses += 1
  state.combat.sector = Math.max(1, fromSector - 1)
  fullHealPlayer(state)

  const label = tactical ? 'Tactical warp' : 'Ship destroyed — warping'
  pushLog(
    state,
    `${label} from sector ${fromSector}${boss ? ' boss' : ''} → sector ${state.combat.sector} (hull restored).`,
  )
}

function onFightWon(state: GameState): void {
  const clearedSector = state.combat.sector
  const wasBoss = state.combat.isBoss
  const enemy = enemyForSector(clearedSector)
  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  let scrapGain = enemy.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrapGain *= 1.3
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

  persistFlagshipHull(state)
  clearEnemy(state)
  state.combat.consecutiveLosses = 0

  const parts = [
    `+${scrapGain.toFixed(1)} scrap`,
    dataBlocked ? 'data blocked' : `+${dataGain} data`,
    `+${aiGain} AI`,
    `+${salvageGain} salvage`,
  ]
  if (essenceGain > 0) parts.push(`+${essenceGain} essence`)
  pushLog(
    state,
    `${wasBoss ? 'Boss' : 'Sector'} ${clearedSector} cleared. ${parts.join(', ')}. Hull ${Math.ceil(state.combat.playerHull)}/${Math.ceil(state.combat.playerHullMax)}.`,
  )
  state.combat.sector += 1
  state.combat.highestSector = Math.max(
    state.combat.highestSector,
    state.combat.sector,
  )
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

function tickRepair(state: GameState, dt: number): void {
  // Only while Holding — Advance fights constantly and death full-heals on warp.
  if (state.combat.inFight || state.combat.campaign) return
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

function maybeCampaignEngage(state: GameState): void {
  if (state.combat.inFight) return
  if (!state.combat.campaign) return
  if (!canReengage(state)) return
  beginFight(state)
}

export function beginFight(state: GameState): void {
  const sector = state.combat.sector
  const encounter = enemyForSector(sector)
  syncPersistedHullCaps(state)

  state.combat.inFight = true
  state.combat.enemyName = encounter.name
  state.combat.enemyFamily = encounter.family
  state.combat.enemyTags = [...encounter.tags]
  state.combat.isBoss = encounter.isBoss
  state.combat.bossPhase = 0
  state.combat.enemyUnits = encounter.units.map((u) => structuredClone(u))
  state.combat.playerUnits = buildPlayerFleet(state)
  state.combat.fx = []
  syncHullAggregates(state)

  const matchup = computeFightDamage(state)
  const note =
    matchup.matchupNotes.length > 0
      ? ` ${matchup.matchupNotes.join('; ')}.`
      : ` ${encounter.blurb}`
  pushLog(
    state,
    `Engaging ${encounter.name} in sector ${sector} [${encounter.family}] (${encounter.units.length} units).${note}`,
  )
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

/** Advance = true, Hold = false. */
export function setCampaign(state: GameState, on: boolean): GameState {
  const next = structuredClone(state)
  next.combat.campaign = on
  if (!on) {
    pushLog(next, 'Holding sector — pause push (future: farm drops here).')
  } else {
    pushLog(next, 'Advance online — continuous sector push.')
  }
  return next
}

/** Advance continuous simulation by `seconds` of game time (mutates). */
export function advanceSeconds(state: GameState, seconds: number): void {
  let left = Math.max(0, seconds)
  while (left > 1e-6) {
    const dt = Math.min(SIM_STEP_S, left)
    applyProduction(state, dt)
    if (state.combat.inFight) {
      tickCombat(state, dt)
    } else {
      tickRepair(state, dt)
      maybeCampaignEngage(state)
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
