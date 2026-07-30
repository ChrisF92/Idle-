import type { GameState } from './types'
import { createInitialState } from './state'

const TICK_MS = 1000

/** Building production per level per second (placeholder rates). */
const BUILDING_RATES: Record<string, Partial<Record<keyof GameState['resources'], number>>> = {
  scrapYard: { scrap: 0.5 },
  powerCell: { energy: 0.2 },
  foundry: { alloys: 0.15 },
  sensorArray: { data: 0.08 },
}

function pushLog(state: GameState, line: string, max = 40): void {
  state.combat.log = [line, ...state.combat.log].slice(0, max)
}

function applyProduction(state: GameState, dtSeconds: number): void {
  for (const [buildingId, level] of Object.entries(state.base.buildings)) {
    if (level <= 0) continue
    const rates = BUILDING_RATES[buildingId]
    if (!rates) continue
    for (const [resource, perLevel] of Object.entries(rates)) {
      const key = resource as keyof GameState['resources']
      state.resources[key] += (perLevel ?? 0) * level * dtSeconds
    }
  }
}

/** Placeholder combat: simple hull trade until one side hits 0. */
function tickCombat(state: GameState): void {
  if (!state.combat.inFight) return

  const playerDps = 8
  const enemyDps = 5 + state.combat.sector * 0.8

  state.combat.enemyHull = Math.max(0, state.combat.enemyHull - playerDps)
  state.combat.playerHull = Math.max(0, state.combat.playerHull - enemyDps)

  if (state.combat.enemyHull <= 0) {
    const scrapGain = 5 + state.combat.sector * 2
    const dataGain = 1 + Math.floor(state.combat.sector / 3)
    state.resources.scrap += scrapGain
    state.resources.data += dataGain
    state.combat.inFight = false
    state.combat.enemyName = 'None'
    pushLog(
      state,
      `Sector ${state.combat.sector} cleared. +${scrapGain} scrap, +${dataGain} data.`,
    )
    state.combat.sector += 1
    state.combat.playerHull = state.combat.playerHullMax
  } else if (state.combat.playerHull <= 0) {
    state.combat.inFight = false
    state.combat.enemyName = 'None'
    state.combat.playerHull = state.combat.playerHullMax
    pushLog(state, `Hull critical — retreated from sector ${state.combat.sector}.`)
  }
}

export function startCombat(state: GameState): GameState {
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  const sector = next.combat.sector
  const enemyHull = 40 + sector * 15
  next.combat.inFight = true
  next.combat.enemyName = sectorEnemyName(sector)
  next.combat.enemyHull = enemyHull
  next.combat.enemyHullMax = enemyHull
  next.combat.playerHull = next.combat.playerHullMax
  pushLog(next, `Engaging ${next.combat.enemyName} in sector ${sector}.`)
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
  }

  next.lastTickAt = now
  return next
}

export function resetGame(now = Date.now()): GameState {
  return createInitialState(now)
}
