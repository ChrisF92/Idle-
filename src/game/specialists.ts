/** Specialists — deferred from Act 1. Frame / Core / Relic identity is enough. */

import type { GameState, SpecialistId, SpecialistState } from './types'
import { careerBestWave } from './progression'
import { recordPlaytest, noteSystemAction } from './playtest'
import { ACT1_CADENCE } from './cadence'

export const SPECIALIST_UNLOCK_SECTOR = ACT1_CADENCE.specialists
export const SPECIALIST_MAX_RANK = 20

export interface SpecialistDef {
  id: SpecialistId
  name: string
  blurb: string
  damage?: number
  shield?: number
  salvage?: number
}

export const SPECIALISTS: SpecialistDef[] = [
  { id: 'gunner', name: 'Gunner', blurb: 'Sortie damage.', damage: 0.025 },
  { id: 'warden', name: 'Warden', blurb: 'Max shield.', shield: 0.03 },
  { id: 'scavenger', name: 'Scavenger', blurb: 'Salvage from kills.', salvage: 0.04 },
]

export function createEmptySpecialistState(): SpecialistState {
  return { ranks: { gunner: 0, warden: 0, scavenger: 0 } }
}

export function getSpecialist(id: string): SpecialistDef | undefined {
  return SPECIALISTS.find((s) => s.id === id)
}

export function specialistsUnlocked(state: GameState): boolean {
  return careerBestWave(state) >= SPECIALIST_UNLOCK_SECTOR
}

export function specialistRank(state: GameState, id: SpecialistId): number {
  return Math.max(0, Math.floor(state.specialists?.ranks[id] ?? 0))
}

export function specialistRankCost(rank: number): { salvage: number; heat: number } {
  const r = Math.max(0, rank)
  return {
    salvage: Math.ceil(28 * Math.pow(1.32, r)),
    heat: Math.ceil(5 * Math.pow(1.26, r)),
  }
}

export function specialistMastery(state: GameState): number {
  const sum =
    specialistRank(state, 'gunner') +
    specialistRank(state, 'warden') +
    specialistRank(state, 'scavenger')
  return Math.floor(sum / 10)
}

export function canRankSpecialist(
  state: GameState,
  id: SpecialistId,
): { ok: boolean; reason?: string } {
  if (!specialistsUnlocked(state)) {
    return { ok: false, reason: `Reach Wave ${SPECIALIST_UNLOCK_SECTOR}` }
  }
  const def = getSpecialist(id)
  if (!def) return { ok: false, reason: 'Unknown specialist' }
  const rank = specialistRank(state, id)
  if (rank >= SPECIALIST_MAX_RANK) return { ok: false, reason: 'Maxed' }
  const cost = specialistRankCost(rank)
  if ((state.resources.salvage ?? 0) < cost.salvage) {
    return { ok: false, reason: `Need ${cost.salvage} Salvage` }
  }
  if ((state.resources.heat ?? 0) < cost.heat) {
    return { ok: false, reason: `Need ${cost.heat} Heat` }
  }
  return { ok: true }
}

export function rankSpecialist(state: GameState, id: SpecialistId): GameState {
  if (!canRankSpecialist(state, id).ok) return state
  const def = getSpecialist(id)
  const next = structuredClone(state)
  if (!next.specialists) next.specialists = createEmptySpecialistState()
  const cost = specialistRankCost(specialistRank(next, id))
  next.resources.salvage -= cost.salvage
  next.resources.heat -= cost.heat
  next.specialists.ranks[id] = specialistRank(next, id) + 1
  recordPlaytest(next, 'specialist', { n: def?.name ?? id, v: next.specialists.ranks[id] })
  noteSystemAction(next, 'specialists')
  return next
}

export function specialistDamageMult(state: GameState): number {
  const def = getSpecialist('gunner')
  const mastery = 1 + specialistMastery(state) * 0.01
  return (1 + specialistRank(state, 'gunner') * (def?.damage ?? 0)) * mastery
}

export function specialistShieldMult(state: GameState): number {
  const def = getSpecialist('warden')
  return 1 + specialistRank(state, 'warden') * (def?.shield ?? 0)
}

export function specialistSalvageMult(state: GameState): number {
  const def = getSpecialist('scavenger')
  return 1 + specialistRank(state, 'scavenger') * (def?.salvage ?? 0)
}
