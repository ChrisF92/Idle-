/** Furnace — USI Reactor analogue. Choir-ash → Heat → always-on ranks. */

import type { FurnaceState, FurnaceTrackId, GameState } from './types'
import { careerHighestSector } from './progression'
import { reliquaryAshMult } from './reliquary'
import { protocolBonusMult, protocolMutes } from './protocols'
import { echoAshMult } from './echo'

export const FURNACE_UNLOCK_SECTOR = 5
export const ASH_PER_HEAT = 10
export const FURNACE_MAX_RANK = 25

export interface FurnaceTrackDef {
  id: FurnaceTrackId
  name: string
  blurb: string
  detail: string[]
  damage?: number
  shield?: number
  researchXp?: number
  foundrySpeed?: number
}

export const FURNACE_TRACKS: FurnaceTrackDef[] = [
  {
    id: 'attack',
    name: 'Attack',
    blurb: 'Sortie damage',
    damage: 0.02,
    detail: [
      'Attack ranks raise the damage of every Core on the ship. Each rank is always on.',
      'Choir-ash drops from kills after you clear sector 5. Bank ash into Heat, then spend Heat here.',
      'Ranks persist when you Rebuild. Heat and leftover ash persist too.',
    ],
  },
  {
    id: 'defense',
    name: 'Defense',
    blurb: 'Max shield',
    shield: 0.02,
    detail: [
      'Defense ranks raise the flagship’s shield ceiling. Regeneration still comes from the fitted shield Core.',
      'Spend Heat here. Ranks persist when you Rebuild.',
    ],
  },
  {
    id: 'lab',
    name: 'Lab',
    blurb: 'Research XP from kills',
    researchXp: 0.05,
    detail: [
      'Lab ranks speed how fast Research notes fill from kills. Focus still matters; Lab just writes faster.',
      'Opens with Research at sector 7 in practice, but you can buy the rank as soon as the Furnace is lit.',
      'Ranks persist when you Rebuild.',
    ],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    blurb: 'Foundry craft speed',
    foundrySpeed: 0.04,
    detail: [
      'Workshop ranks speed every smelter. Recipe levels still persist on their own.',
      'Spend Heat here. Ranks persist when you Rebuild.',
    ],
  },
]

export function createEmptyFurnaceState(): FurnaceState {
  return {
    ranks: { attack: 0, defense: 0, lab: 0, workshop: 0 },
  }
}

export function getFurnaceTrack(id: string): FurnaceTrackDef | undefined {
  return FURNACE_TRACKS.find((t) => t.id === id)
}

export function furnaceRank(state: GameState, id: FurnaceTrackId): number {
  return Math.max(0, Math.floor(state.furnace?.ranks[id] ?? 0))
}

export function furnaceRankCost(rank: number): number {
  return Math.ceil(5 * Math.pow(1.28, Math.max(0, rank)))
}

export function furnaceAshFromKill(state: GameState, isBoss: boolean): number {
  if (careerHighestSector(state) < FURNACE_UNLOCK_SECTOR) return 0
  const sector = Math.max(1, state.combat.sector)
  const base = (0.5 + 0.1 * sector) * (isBoss ? 4 : 1)
  return base * reliquaryAshMult(state) * echoAshMult(state)
}

export function grantFurnaceKillLoot(state: GameState, isBoss: boolean): number {
  const ash = furnaceAshFromKill(state, isBoss)
  if (ash <= 0) return 0
  state.resources.choirAsh = (state.resources.choirAsh ?? 0) + ash
  return ash
}

export function convertAshToHeat(state: GameState, heatMult = 1): GameState {
  if (careerHighestSector(state) < FURNACE_UNLOCK_SECTOR) return state
  const ash = state.resources.choirAsh ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)
  if (batches <= 0) return state
  const next = structuredClone(state)
  next.resources.choirAsh = ash - batches * ASH_PER_HEAT
  next.resources.heat = (next.resources.heat ?? 0) + batches * Math.max(0, heatMult)
  return next
}

export function canBuyFurnaceRank(
  state: GameState,
  id: FurnaceTrackId,
): { ok: boolean; reason?: string } {
  if (careerHighestSector(state) < FURNACE_UNLOCK_SECTOR) {
    return { ok: false, reason: `Clear sector ${FURNACE_UNLOCK_SECTOR}` }
  }
  const def = getFurnaceTrack(id)
  if (!def) return { ok: false, reason: 'Unknown track' }
  const rank = furnaceRank(state, id)
  if (rank >= FURNACE_MAX_RANK) return { ok: false, reason: 'Maxed' }
  const cost = furnaceRankCost(rank)
  if ((state.resources.heat ?? 0) < cost) return { ok: false, reason: `Need ${cost} Heat` }
  return { ok: true }
}

export function buyFurnaceRank(state: GameState, id: FurnaceTrackId): GameState {
  if (!canBuyFurnaceRank(state, id).ok) return state
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  const cost = furnaceRankCost(furnaceRank(next, id))
  next.resources.heat -= cost
  next.furnace.ranks[id] = furnaceRank(next, id) + 1
  return next
}

export function furnaceDamageMult(state: GameState): number {
  if (protocolMutes(state, 'furnace')) return 1
  const def = getFurnaceTrack('attack')
  return (1 + furnaceRank(state, 'attack') * (def?.damage ?? 0)) * protocolBonusMult(state, 'furnace')
}

export function furnaceShieldMult(state: GameState): number {
  if (protocolMutes(state, 'furnace')) return 1
  const def = getFurnaceTrack('defense')
  return (1 + furnaceRank(state, 'defense') * (def?.shield ?? 0)) * protocolBonusMult(state, 'furnace')
}

export function furnaceResearchXpMult(state: GameState): number {
  if (protocolMutes(state, 'furnace')) return 1
  const def = getFurnaceTrack('lab')
  return (1 + furnaceRank(state, 'lab') * (def?.researchXp ?? 0)) * protocolBonusMult(state, 'furnace')
}

export function furnaceFoundrySpeedMult(state: GameState): number {
  if (protocolMutes(state, 'furnace')) return 1
  const def = getFurnaceTrack('workshop')
  return (1 + furnaceRank(state, 'workshop') * (def?.foundrySpeed ?? 0)) * protocolBonusMult(state, 'furnace')
}
