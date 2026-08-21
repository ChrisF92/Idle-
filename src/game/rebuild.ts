/** GDD Rebuild — first prestige layer. Cycle stats, Wave 70 door, Matter formula. */

import type { GameState, RebuildCycleState } from './types'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const REBUILD_MIN_WAVE = ACT1_CADENCE.rebuild
/** GDD §67: several completed Sorties before the first Rebuild. */
export const REBUILD_MIN_SORTIES = 3
/** Scrap generated this cycle, per extra Matter. Workshop ranks stack on top. */
export const REBUILD_SCRAP_PER_MATTER = 100

export function emptyRebuildCycle(): RebuildCycleState {
  return { bestWave: 0, sorties: 0, scrapEarned: 0 }
}

export function rebuildCycle(state: GameState): RebuildCycleState {
  const raw = state.prestige?.cycle
  return {
    bestWave: Math.max(0, Math.floor(Number(raw?.bestWave ?? 0) || 0)),
    sorties: Math.max(0, Math.floor(Number(raw?.sorties ?? 0) || 0)),
    scrapEarned: Math.max(0, Math.floor(Number(raw?.scrapEarned ?? 0) || 0)),
  }
}

export function ensureRebuildCycle(state: GameState): RebuildCycleState {
  if (!state.prestige.cycle) state.prestige.cycle = emptyRebuildCycle()
  return state.prestige.cycle
}

/** Highest Wave this Rebuild cycle. Before the first Rebuild, career Best counts. */
export function cycleBestWave(state: GameState): number {
  const cycle = rebuildCycle(state).bestWave
  if (cycle > 0) return cycle
  if ((state.prestige.prestigeCount ?? 0) > 0) return 0
  return careerBestWave(state)
}

export function workshopInvestment(state: GameState): number {
  return Object.values(state.workshop?.levels ?? {}).reduce(
    (sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)),
    0,
  )
}

export function noteRebuildCycleWave(state: GameState, wave: number): void {
  const cycle = ensureRebuildCycle(state)
  cycle.bestWave = Math.max(cycle.bestWave, Math.max(0, Math.floor(wave)))
}

export function noteRebuildCycleSortie(state: GameState, scrapEarned: number): void {
  const cycle = ensureRebuildCycle(state)
  cycle.sorties += 1
  cycle.scrapEarned += Math.max(0, Math.floor(scrapEarned))
}

export function clearRebuildCycle(state: GameState): void {
  state.prestige.cycle = emptyRebuildCycle()
}

export function rebuildWaveNeed(_state?: GameState): number {
  return REBUILD_MIN_WAVE
}

/**
 * Cycle is worth resetting. Ignores Dock so toasts can fire before the player
 * opens hangar.
 */
export function rebuildDoorMet(state: GameState, waveNeed: number = REBUILD_MIN_WAVE): boolean {
  if (state.prestige.activeChallengeId) return false
  if (cycleBestWave(state) < waveNeed) return false
  const sorties = rebuildCycle(state).sorties
  if ((state.prestige.prestigeCount ?? 0) === 0) {
    return sorties >= REBUILD_MIN_SORTIES
  }
  return sorties >= 1
}

export function canOpenRebuildHangar(state: GameState): boolean {
  if ((state.prestige.prestigeCount ?? 0) > 0) return true
  if (Object.keys(state.prestige.matterShop ?? {}).length > 0) return true
  return careerBestWave(state) >= REBUILD_MIN_WAVE
}

export function canRebuild(state: GameState): boolean {
  return Boolean(state.combat.docked) && rebuildDoorMet(state)
}

/**
 * GDD §69: Matter from cycle Best Wave, Scrap generated, and Workshop
 * investment. Unspent Scrap does not increase the payout.
 */
export function prestigeGainFor(state: GameState): number {
  const wavePart = Math.max(1, Math.floor(cycleBestWave(state) / 10))
  const workshopPart = workshopInvestment(state)
  const scrapPart = Math.floor(rebuildCycle(state).scrapEarned / REBUILD_SCRAP_PER_MATTER)
  const scrapCapped = Math.min(scrapPart, wavePart)
  const repeats = Math.max(0, Math.floor(state.prestige.prestigeCount ?? 0))
  const ascensions = state.meta.ascensionCount ?? 0
  const raw = wavePart + workshopPart + scrapCapped + repeats
  const scaled = raw * (1 + 0.4 * ascensions)
  return Math.max(1, Math.floor(scaled))
}
