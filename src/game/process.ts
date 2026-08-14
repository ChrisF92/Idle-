/** Process — achievement-funded automation / QoL (USI AI modules, thinner). */

import type { GameState, ProcessState } from './types'

export interface ProcessNodeDef {
  id: string
  name: string
  blurb: string
  cost: number
  requiresId?: string
}

export const PROCESS_NODES: ProcessNodeDef[] = [
  {
    id: 'auto-salvage',
    name: 'Auto-Salvage',
    blurb: 'Spend Salvage on the cheapest Core while a sortie is live.',
    cost: 2,
  },
  {
    id: 'network-balance',
    name: 'Bar Balance',
    blurb: 'Idle drones fill the emptiest Network bars.',
    cost: 2,
  },
  {
    id: 'auto-extract',
    name: 'Safe Extract',
    blurb: 'After a sector boss, Extract if hull is under 35%.',
    cost: 3,
    requiresId: 'auto-salvage',
  },
  {
    id: 'offline-sortie',
    name: 'Ghost Sortie',
    blurb: 'While launched, offline time pushes sectors (no fight sim).',
    cost: 5,
    requiresId: 'auto-extract',
  },
]

export function createEmptyProcessState(): ProcessState {
  return { purchased: [] }
}

export function getProcessNode(id: string): ProcessNodeDef | undefined {
  return PROCESS_NODES.find((n) => n.id === id)
}

export function hasProcess(state: GameState, id: string): boolean {
  return (state.process?.purchased ?? []).includes(id)
}

export function canBuyProcessNode(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  const def = getProcessNode(id)
  if (!def) return { ok: false, reason: 'Unknown node' }
  if (hasProcess(state, id)) return { ok: false, reason: 'Owned' }
  if (def.requiresId && !hasProcess(state, def.requiresId)) {
    return { ok: false, reason: 'Need prior node' }
  }
  if (state.resources.aiPoints < def.cost) {
    return { ok: false, reason: `Need ${def.cost} Process` }
  }
  return { ok: true }
}
