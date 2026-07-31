import type { GameState, Resources } from './types'
import { computeShipStats, createInitialState, syncPersistedHullCaps } from './state'
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
  resolveCombatTick,
  shieldRepairRatePerSecond,
  syncHullAggregates,
  totalEnemyHull,
  computeFightDamage,
} from './combat'

export const TICK_MS = 1000
/** Live interval catch-up — keep short; long absences use offline catch-up. */
export const LIVE_TICK_CAP = 5

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
  // Floor so the fleet can still repair after a wipe
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

function onFightLost(state: GameState, tactical: boolean, boss: boolean): void {
  persistFlagshipHull(state)
  clearEnemy(state)
  state.combat.consecutiveLosses += 1

  if (tactical) {
    pushLog(
      state,
      `Tactical retreat from sector ${state.combat.sector}${boss ? ' boss' : ''}. Hull ${Math.ceil(state.combat.playerHull)}/${Math.ceil(state.combat.playerHullMax)}.`,
    )
  } else {
    pushLog(
      state,
      boss
        ? `Boss pressure — retreated from sector ${state.combat.sector}. Repairing…`
        : `Flagship critical — retreated from sector ${state.combat.sector}. Repairing…`,
    )
  }
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

  state.resources.scrap += scrapGain
  state.resources.data += dataGain
  state.resources.aiPoints += aiGain
  state.resources.essence += essenceGain

  persistFlagshipHull(state)
  clearEnemy(state)
  state.combat.consecutiveLosses = 0

  const parts = [
    `+${scrapGain.toFixed(1)} scrap`,
    dataBlocked ? 'data blocked' : `+${dataGain} data`,
    `+${aiGain} AI`,
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

function tickCombat(state: GameState): void {
  if (!state.combat.inFight) return

  resolveCombatTick(state, pushLog)

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

function tickRepair(state: GameState): void {
  if (state.combat.inFight) return
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax

  if (state.combat.playerHull < stats.hullMax) {
    state.combat.playerHull = Math.min(
      stats.hullMax,
      state.combat.playerHull + repairRatePerSecond(state),
    )
  }
  if (state.combat.playerShield < stats.shieldMax) {
    state.combat.playerShield = Math.min(
      stats.shieldMax,
      state.combat.playerShield + shieldRepairRatePerSecond(state),
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
  if (!canReengage(state) && state.combat.playerHull < state.combat.playerHullMax) {
    return state
  }
  const next = structuredClone(state)
  beginFight(next)
  return next
}

/** Advance = true, Hold = false. */
export function setCampaign(state: GameState, on: boolean): GameState {
  const next = structuredClone(state)
  next.combat.campaign = on
  if (!on) {
    pushLog(next, 'Holding sector — repairing (future: farm drops here).')
  } else {
    pushLog(next, 'Advance online — continuous sector push.')
  }
  return next
}

/** Advance simulation by N one-second ticks (mutates). */
export function advanceTicks(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    applyProduction(state, TICK_MS / 1000)
    tickCombat(state)
    tickRepair(state)
    maybeCampaignEngage(state)
  }
}

/**
 * Live tick path used by the UI interval.
 * Long absences should call applyOfflineCatchUp instead.
 */
export function tickGame(state: GameState, now = Date.now()): GameState {
  const elapsed = Math.max(0, now - state.lastTickAt)
  const ticks = Math.min(LIVE_TICK_CAP, Math.floor(elapsed / TICK_MS))

  if (ticks <= 0) {
    return state
  }

  const next = structuredClone(state)
  advanceTicks(next, ticks)
  next.lastTickAt = state.lastTickAt + ticks * TICK_MS
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
