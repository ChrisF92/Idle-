/** Protocols — USI Challenges analogue. Restricted sorties that rank one system. */

import type { GameState, ProtocolMute, ProtocolState } from './types'
import { careerHighestSector } from './progression'
import { closeSortie } from './sortieSummary'

export const PROTOCOL_UNLOCK_SECTOR = 18
export const PROTOCOL_MAX_RANK = 8

export interface ProtocolDef {
  id: string
  name: string
  blurb: string
  mute: ProtocolMute
  goalSector: number
  bonus: number
}

export const PROTOCOLS: ProtocolDef[] = [
  {
    id: 'mute-network',
    name: 'Mute Network',
    blurb: 'Drone bars grant nothing. Rank boosts Network fill.',
    mute: 'network',
    goalSector: 6,
    bonus: 0.04,
  },
  {
    id: 'cold-foundry',
    name: 'Cold Foundry',
    blurb: 'Foundry modules and upgrades sleep. Rank boosts craft speed.',
    mute: 'foundry',
    goalSector: 8,
    bonus: 0.05,
  },
  {
    id: 'empty-reliquary',
    name: 'Empty Reliquary',
    blurb: 'Shards do nothing. Rank boosts shard power.',
    mute: 'reliquary',
    goalSector: 10,
    bonus: 0.06,
  },
  {
    id: 'dead-furnace',
    name: 'Dead Furnace',
    blurb: 'Heat ranks do nothing. Rank boosts Furnace power.',
    mute: 'furnace',
    goalSector: 12,
    bonus: 0.05,
  },
]

export function createEmptyProtocolState(): ProtocolState {
  return { activeId: null, ranks: {} }
}

export function getProtocol(id: string): ProtocolDef | undefined {
  return PROTOCOLS.find((p) => p.id === id)
}

export function protocolsUnlocked(state: GameState): boolean {
  return careerHighestSector(state) >= PROTOCOL_UNLOCK_SECTOR
}

export function protocolRank(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.protocols?.ranks[id] ?? 0))
}

export function activeProtocol(state: GameState): ProtocolDef | undefined {
  const id = state.protocols?.activeId
  return id ? getProtocol(id) : undefined
}

export function protocolMutes(state: GameState, system: ProtocolMute): boolean {
  return activeProtocol(state)?.mute === system
}

export function protocolBonusMult(state: GameState, mute: ProtocolMute): number {
  if (protocolMutes(state, mute)) return 1
  let rank = 0
  for (const def of PROTOCOLS) {
    if (def.mute === mute) rank += protocolRank(state, def.id)
  }
  const bonus = PROTOCOLS.find((p) => p.mute === mute)?.bonus ?? 0
  return 1 + rank * bonus
}

export function canEnterProtocol(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  if (!state.combat.docked || state.combat.inFight) {
    return { ok: false, reason: 'Dock first' }
  }
  if (state.echo?.activeId) return { ok: false, reason: 'Finish the Echo first' }
  if (state.protocols?.activeId) return { ok: false, reason: 'Already in a Protocol' }
  if (!protocolsUnlocked(state)) {
    return { ok: false, reason: `Clear sector ${PROTOCOL_UNLOCK_SECTOR}` }
  }
  const def = getProtocol(id)
  if (!def) return { ok: false, reason: 'Unknown Protocol' }
  if (protocolRank(state, id) >= PROTOCOL_MAX_RANK) return { ok: false, reason: 'Maxed' }
  return { ok: true }
}

export function wipeProtocolLoadout(state: GameState): void {
  state.resources.salvage = 0
  state.shipyard.moduleLevels = {}
  state.shipyard.corePicks = {}
}

/** Rank up if the goal sector is cleared this Protocol. Mutates. */
export function tryCompleteProtocol(state: GameState): void {
  const def = activeProtocol(state)
  if (!def) return
  if (state.combat.highestSector < def.goalSector) return
  const prev = protocolRank(state, def.id)
  if (prev >= PROTOCOL_MAX_RANK) {
    state.protocols.activeId = null
    state.combat.docked = true
    state.combat.log = [`${def.name} already maxed.`, ...state.combat.log].slice(0, 40)
    return
  }
  if (!state.protocols) state.protocols = createEmptyProtocolState()
  state.protocols.ranks = { ...state.protocols.ranks, [def.id]: prev + 1 }
  state.protocols.activeId = null
  state.combat.docked = true
  closeSortie(state, 'extract', `${def.name} complete (${prev + 1}/${PROTOCOL_MAX_RANK}).`)
  state.combat.log = [state.combat.lastSortie.note, ...state.combat.log].slice(0, 40)
}
