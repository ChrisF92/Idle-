import type { GameState } from './types'
import { computeShipStats, createInitialState } from './state'
import { BUILDINGS, metaProductionMultiplier } from './catalog'
import { tryCompleteChallenge } from './actions'

const TICK_MS = 1000

function pushLog(state: GameState, line: string, max = 40): void {
  state.combat.log = [line, ...state.combat.log].slice(0, max)
}

function applyProduction(state: GameState, dtSeconds: number): void {
  const meta = metaProductionMultiplier(state.resources.prestigeMatter)

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

/** Placeholder combat: simple hull trade until one side hits 0. */
function tickCombat(state: GameState): void {
  if (!state.combat.inFight) return

  const stats = computeShipStats(state)
  const playerDps = stats.damage
  const enemyDps = (5 + state.combat.sector * 0.8) * stats.damageTakenMult

  state.combat.enemyHull = Math.max(0, state.combat.enemyHull - playerDps)
  state.combat.playerHull = Math.max(0, state.combat.playerHull - enemyDps)

  if (state.combat.enemyHull <= 0) {
    const clearedSector = state.combat.sector
    const scrapGain = 5 + clearedSector * 2
    const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
    const dataGain = dataBlocked ? 0 : 1 + Math.floor(clearedSector / 3)
    const aiGain = clearedSector % 5 === 0 ? 1 : 0.15
    state.resources.scrap += scrapGain
    state.resources.data += dataGain
    state.resources.aiPoints += aiGain
    state.combat.inFight = false
    state.combat.enemyName = 'None'
    const dataPart = dataBlocked ? 'data blocked' : `+${dataGain} data`
    pushLog(
      state,
      `Sector ${clearedSector} cleared. +${scrapGain} scrap, ${dataPart}, +${aiGain} AI.`,
    )
    state.combat.sector += 1
    state.combat.highestSector = Math.max(
      state.combat.highestSector,
      state.combat.sector,
    )
    const refreshed = computeShipStats(state)
    state.combat.playerHullMax = refreshed.hullMax
    state.combat.playerHull = refreshed.hullMax
    tryCompleteChallenge(state)
  } else if (state.combat.playerHull <= 0) {
    state.combat.inFight = false
    state.combat.enemyName = 'None'
    const refreshed = computeShipStats(state)
    state.combat.playerHullMax = refreshed.hullMax
    state.combat.playerHull = refreshed.hullMax
    pushLog(state, `Hull critical — retreated from sector ${state.combat.sector}.`)
  }
}

function maybeAutoEngage(state: GameState): void {
  if (state.combat.inFight) return
  if (!state.ai.purchased.includes('auto-engage')) return
  if (state.prestige.activeChallengeId === 'no-ai') return
  beginFight(state)
}

function beginFight(state: GameState): void {
  const sector = state.combat.sector
  const stats = computeShipStats(state)
  const enemyHull = 40 + sector * 15
  state.combat.inFight = true
  state.combat.enemyName = sectorEnemyName(sector)
  state.combat.enemyHull = enemyHull
  state.combat.enemyHullMax = enemyHull
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  pushLog(state, `Engaging ${state.combat.enemyName} in sector ${sector}.`)
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  beginFight(next)
  return next
}

function sectorEnemyName(sector: number): string {
  const names = [
    'Void Mite',
    'Ashen Drifter',
    'Hive Shard',
    'God-Spark Remnant',
    'Titan Larva',
  ]
  return names[(sector - 1) % names.length] ?? 'Unknown Entity'
}

/**
 * Advance simulation by elapsed wall time.
 * Caps catch-up so reloads stay cheap until offline formulas are designed.
 */
export function tickGame(state: GameState, now = Date.now()): GameState {
  const next = structuredClone(state)
  const elapsed = Math.max(0, now - next.lastTickAt)
  const ticks = Math.min(60, Math.floor(elapsed / TICK_MS))

  if (ticks <= 0) {
    next.lastTickAt = now
    return next
  }

  for (let i = 0; i < ticks; i += 1) {
    applyProduction(next, TICK_MS / 1000)
    tickCombat(next)
    maybeAutoEngage(next)
  }

  next.lastTickAt = now
  return next
}

export function resetGame(now = Date.now()): GameState {
  return createInitialState(now)
}
