/** Capital — USI Capital analogue. Second combat scale on the ship, not fighters. */

import type { CapitalId, CapitalState, GameState } from './types'
import { taskListComplete } from './tasks'
import { noteSystemAction, recordPlaytest } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const CAPITAL_UNLOCK_SECTOR = ACT1_CADENCE.capital
export const CAPITAL_MAX_RANK = 20

export interface CapitalTrackDef {
  id: CapitalId
  name: string
  blurb: string
  damage?: number
  shield?: number
  salvage?: number
}

export const CAPITAL_TRACKS: CapitalTrackDef[] = [
  { id: 'broadside', name: 'Broadside', blurb: 'Sortie damage.', damage: 0.04 },
  { id: 'bulkhead', name: 'Bulkhead', blurb: 'Max shield.', shield: 0.04 },
  { id: 'hold', name: 'Hold', blurb: 'Salvage from kills.', salvage: 0.05 },
]

export function createEmptyCapitalState(): CapitalState {
  return { ranks: { broadside: 0, bulkhead: 0, hold: 0 } }
}

export function getCapitalTrack(id: string): CapitalTrackDef | undefined {
  return CAPITAL_TRACKS.find((t) => t.id === id)
}

export function capitalUnlocked(state: GameState): boolean {
  return careerBestWave(state) >= CAPITAL_UNLOCK_SECTOR && taskListComplete(state)
}

export function capitalRank(state: GameState, id: CapitalId): number {
  return Math.max(0, Math.floor(state.capital?.ranks[id] ?? 0))
}

export function capitalRankCost(rank: number): { salvage: number; heat: number } {
  const r = Math.max(0, rank)
  return {
    salvage: Math.ceil(80 * Math.pow(1.34, r)),
    heat: Math.ceil(12 * Math.pow(1.28, r)),
  }
}

export function canRankCapital(
  state: GameState,
  id: CapitalId,
): { ok: boolean; reason?: string } {
  if (!capitalUnlocked(state)) {
    return { ok: false, reason: 'Capital is retired from Act 1' }
  }
  const def = getCapitalTrack(id)
  if (!def) return { ok: false, reason: 'Unknown track' }
  const rank = capitalRank(state, id)
  if (rank >= CAPITAL_MAX_RANK) return { ok: false, reason: 'Maxed' }
  const cost = capitalRankCost(rank)
  if ((state.resources.salvage ?? 0) < cost.salvage) {
    return { ok: false, reason: `Need ${cost.salvage} Salvage` }
  }
  if ((state.resources.heat ?? 0) < cost.heat) {
    return { ok: false, reason: `Need ${cost.heat} Heat` }
  }
  return { ok: true }
}

export function rankCapital(state: GameState, id: CapitalId): GameState {
  if (!canRankCapital(state, id).ok) return state
  const def = getCapitalTrack(id)
  const next = structuredClone(state)
  if (!next.capital) next.capital = createEmptyCapitalState()
  const cost = capitalRankCost(capitalRank(next, id))
  next.resources.salvage -= cost.salvage
  next.resources.heat -= cost.heat
  next.capital.ranks[id] = capitalRank(next, id) + 1
  recordPlaytest(next, 'capital', { n: def?.name ?? id, v: next.capital.ranks[id] })
  noteSystemAction(next, 'capital')
  return next
}

export function capitalDamageMult(state: GameState): number {
  const def = getCapitalTrack('broadside')
  return 1 + capitalRank(state, 'broadside') * (def?.damage ?? 0)
}

export function capitalShieldMult(state: GameState): number {
  const def = getCapitalTrack('bulkhead')
  return 1 + capitalRank(state, 'bulkhead') * (def?.shield ?? 0)
}

export function capitalSalvageMult(state: GameState): number {
  const def = getCapitalTrack('hold')
  return 1 + capitalRank(state, 'hold') * (def?.salvage ?? 0)
}
