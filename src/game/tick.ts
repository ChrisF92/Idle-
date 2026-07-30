import type { GameState, Resources } from './types'
import { computeShipStats, createInitialState } from './state'
import {
  BUILDINGS,
  aiDoctrinesActive,
  essenceBonusDataPerClear,
  essenceProductionMultiplier,
  metaProductionMultiplier,
  researchEssenceMultiplier,
} from './catalog'
import { tryCompleteChallenge } from './actions'
import {
  computeFightDamage,
  enemyForSector,
  maybeAdvanceBossPhase,
  repairDelaySeconds,
} from './combat'

export const TICK_MS = 1000
/** Live interval catch-up — keep short; long absences use offline catch-up. */
export const LIVE_TICK_CAP = 5
/** After this many losses on a sector, campaign pauses at a wall. */
export const WALL_AFTER_LOSSES = 2

function pushLog(state: GameState, line: string, max = 40): void {
  state.combat.log = [line, ...state.combat.log].slice(0, max)
}

function clearEnemy(state: GameState): void {
  state.combat.inFight = false
  state.combat.enemyName = 'None'
  state.combat.enemyFamily = ''
  state.combat.enemyTags = []
  state.combat.enemyDamage = 0
  state.combat.isBoss = false
  state.combat.bossPhase = 0
  state.combat.enemyHull = 0
  state.combat.enemyHullMax = 0
}

function refreshPlayerHull(state: GameState): void {
  const refreshed = computeShipStats(state)
  state.combat.playerHullMax = refreshed.hullMax
  state.combat.playerHull = refreshed.hullMax
}

function applyProduction(state: GameState, dtSeconds: number): void {
  const meta =
    metaProductionMultiplier(state.resources.prestigeMatter) *
    essenceProductionMultiplier(state.essence.purchased)

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
  clearEnemy(state)
  refreshPlayerHull(state)
  state.combat.consecutiveLosses += 1
  state.combat.repairTimer = repairDelaySeconds(state)

  if (state.combat.consecutiveLosses >= WALL_AFTER_LOSSES) {
    state.combat.walled = true
    pushLog(
      state,
      `Wall at sector ${state.combat.sector}. Campaign paused — upgrade loadout, then Resume.`,
    )
  } else if (tactical) {
    pushLog(
      state,
      `Tactical retreat from sector ${state.combat.sector}${boss ? ' boss' : ''}. Repairing ${state.combat.repairTimer}s…`,
    )
  } else {
    pushLog(
      state,
      boss
        ? `Boss pressure — retreated from sector ${state.combat.sector}. Repairing ${state.combat.repairTimer}s…`
        : `Hull critical — retreated from sector ${state.combat.sector}. Repairing ${state.combat.repairTimer}s…`,
    )
  }
}

function tickCombat(state: GameState): void {
  if (!state.combat.inFight) return

  const { playerDps, enemyDps } = computeFightDamage(state)

  state.combat.enemyHull = Math.max(0, state.combat.enemyHull - playerDps)
  maybeAdvanceBossPhase(state, pushLog)
  state.combat.playerHull = Math.max(0, state.combat.playerHull - enemyDps)

  const retreatThreshold = aiDoctrinesActive(state, 'tactical-retreat')
    ? state.combat.playerHullMax * 0.25
    : 0

  if (state.combat.enemyHull <= 0) {
    const clearedSector = state.combat.sector
    const wasBoss = state.combat.isBoss
    const enemy = enemyForSector(clearedSector)
    const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
    let scrapGain = enemy.scrapReward
    if (aiDoctrinesActive(state, 'scavenger')) scrapGain *= 1.3
    const siphonData = essenceBonusDataPerClear(state.essence.purchased)
    const dataGain = dataBlocked ? 0 : enemy.dataReward + siphonData
    const aiGain = enemy.aiReward
    const essenceGain =
      enemy.essenceReward * researchEssenceMultiplier(state.research.unlocked)

    state.resources.scrap += scrapGain
    state.resources.data += dataGain
    state.resources.aiPoints += aiGain
    state.resources.essence += essenceGain

    clearEnemy(state)
    state.combat.consecutiveLosses = 0
    state.combat.walled = false
    state.combat.repairTimer = 0

    const parts = [
      `+${scrapGain.toFixed(1)} scrap`,
      dataBlocked ? 'data blocked' : `+${dataGain} data`,
      `+${aiGain} AI`,
    ]
    if (essenceGain > 0) parts.push(`+${essenceGain} essence`)
    pushLog(
      state,
      `${wasBoss ? 'Boss' : 'Sector'} ${clearedSector} cleared. ${parts.join(', ')}.`,
    )
    state.combat.sector += 1
    state.combat.highestSector = Math.max(
      state.combat.highestSector,
      state.combat.sector,
    )
    refreshPlayerHull(state)
    tryCompleteChallenge(state)
  } else if (state.combat.playerHull <= retreatThreshold) {
    const boss = state.combat.isBoss
    const tactical = aiDoctrinesActive(state, 'tactical-retreat') && retreatThreshold > 0
    onFightLost(state, tactical, boss)
  }
}

function tickRepair(state: GameState): void {
  if (state.combat.inFight) return
  if (state.combat.repairTimer <= 0) return
  state.combat.repairTimer = Math.max(0, state.combat.repairTimer - 1)
}

function maybeCampaignEngage(state: GameState): void {
  if (state.combat.inFight) return
  if (!state.combat.campaign) return
  if (state.combat.walled) return
  if (state.combat.repairTimer > 0) return
  beginFight(state)
}

function beginFight(state: GameState): void {
  const sector = state.combat.sector
  const stats = computeShipStats(state)
  const enemy = enemyForSector(sector)
  state.combat.inFight = true
  state.combat.enemyName = enemy.name
  state.combat.enemyFamily = enemy.family
  state.combat.enemyTags = [...enemy.tags]
  state.combat.enemyDamage = enemy.damage
  state.combat.isBoss = enemy.isBoss
  state.combat.bossPhase = 0
  state.combat.enemyHull = enemy.hull
  state.combat.enemyHullMax = enemy.hull
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  const matchup = computeFightDamage(state)
  const note =
    matchup.matchupNotes.length > 0
      ? ` ${matchup.matchupNotes.join('; ')}.`
      : ` ${enemy.blurb}`
  pushLog(
    state,
    `Engaging ${enemy.name} in sector ${sector} [${enemy.family}].${note}`,
  )
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  if (state.combat.repairTimer > 0) return state
  const next = structuredClone(state)
  next.combat.walled = false
  beginFight(next)
  return next
}

export function setCampaign(state: GameState, on: boolean): GameState {
  const next = structuredClone(state)
  next.combat.campaign = on
  if (!on) {
    pushLog(next, 'Campaign paused.')
  } else {
    next.combat.walled = false
    pushLog(next, 'Campaign online — continuous sector push.')
  }
  return next
}

export function resumeCampaign(state: GameState): GameState {
  const next = structuredClone(state)
  next.combat.campaign = true
  next.combat.walled = false
  next.combat.repairTimer = 0
  next.combat.consecutiveLosses = 0
  pushLog(next, 'Campaign resumed.')
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
 *
 * Important: do NOT set lastTickAt to `now` when zero whole seconds elapsed.
 * The UI polls every 250ms; resetting the clock each poll prevented combat/production
 * from ever accumulating a full second.
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
