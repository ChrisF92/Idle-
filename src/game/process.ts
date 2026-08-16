/** Process — achievement-funded automation / QoL (USI AI modules, Act 1 only). */

import type { GameState, ProcessState, TabId } from './types'
import { careerHighestSector, isSystemUnlocked } from './progression'

export type ProcessCategory =
  | 'combat'
  | 'network'
  | 'foundry'
  | 'reliquary'
  | 'research'
  | 'furnace'
  | 'qol'

export interface ProcessNodeDef {
  id: string
  name: string
  blurb: string
  cost: number
  category: ProcessCategory
  requiresId?: string
  requiresSectorEver?: number
  requiresSystem?: TabId
}

export const PROCESS_CATEGORIES: { id: ProcessCategory; name: string }[] = [
  { id: 'combat', name: 'Sortie' },
  { id: 'network', name: 'Network' },
  { id: 'foundry', name: 'Foundry' },
  { id: 'reliquary', name: 'Reliquary' },
  { id: 'research', name: 'Research' },
  { id: 'furnace', name: 'Furnace' },
  { id: 'qol', name: 'QoL' },
]

/**
 * Act 1 tree only — no Echo/Warp, Specialists, Capital, or Reinforce autos.
 * Costs are high vs achievement Process so you pick a few, not the whole board.
 */
export const PROCESS_NODES: ProcessNodeDef[] = [
  {
    id: 'auto-salvage',
    name: 'Auto-Salvage',
    category: 'combat',
    blurb: 'Spend Salvage on the cheapest fitted Core while a sortie is live.',
    cost: 6,
  },
  {
    id: 'auto-extract',
    name: 'Safe Hold',
    category: 'combat',
    blurb: 'After a sector boss, Hold this sector if hull is under 35%.',
    cost: 8,
    requiresId: 'auto-salvage',
    requiresSectorEver: 2,
  },
  {
    id: 'smart-core',
    name: 'Smart Core',
    category: 'combat',
    blurb: 'Auto-Salvage spends on the Core that gains the most per Salvage, not the cheapest.',
    cost: 18,
    requiresId: 'auto-salvage',
    requiresSectorEver: 6,
  },
  {
    id: 'offline-sortie',
    name: 'Ghost Sortie',
    category: 'combat',
    blurb: 'While launched, offline time pushes sectors (no fight sim).',
    cost: 16,
    requiresId: 'auto-extract',
    requiresSectorEver: 4,
  },
  {
    id: 'network-balance',
    name: 'Bar Balance',
    category: 'network',
    blurb: 'Idle drones fill the emptiest Network bars.',
    cost: 6,
  },
  {
    id: 'network-tune',
    name: 'Bar Tune',
    category: 'network',
    blurb: 'Idle drones prefer Strike/Ward while you Advance, Yield while you Hold.',
    cost: 16,
    requiresId: 'network-balance',
    requiresSectorEver: 7,
  },
  {
    id: 'smart-smelt',
    name: 'Smart Smelt',
    category: 'foundry',
    blurb: 'Empty smelters queue themselves. Will not starve the next Pulse rank.',
    cost: 20,
    requiresSystem: 'foundry',
    requiresSectorEver: 3,
  },
  {
    id: 'foundry-auto',
    name: 'Foundry Auto',
    category: 'foundry',
    blurb: 'Spend Foundry Points on the cheapest open Foundry rank.',
    cost: 18,
    requiresId: 'smart-smelt',
    requiresSystem: 'foundry',
    requiresSectorEver: 6,
  },
  {
    id: 'print-assemble',
    name: 'Print Press',
    category: 'foundry',
    blurb: 'Assemble a Core print as soon as every fragment is in stock.',
    cost: 16,
    requiresId: 'smart-smelt',
    requiresSystem: 'foundry',
    requiresSectorEver: 4,
  },
  {
    id: 'auto-relic',
    name: 'Shard Seat',
    category: 'reliquary',
    blurb: 'Empty Reliquary colours seat the strongest owned shard. Swaps only for a clear upgrade.',
    cost: 18,
    requiresSystem: 'reliquary',
    requiresSectorEver: 3,
  },
  {
    id: 'research-focus',
    name: 'Archive Steer',
    category: 'research',
    blurb: 'Research focus follows the branch furthest from its next node.',
    cost: 16,
    requiresSystem: 'research',
    requiresSectorEver: 7,
  },
  {
    id: 'auto-bank',
    name: 'Ash Bank',
    category: 'furnace',
    blurb: 'Choir-ash banks into Heat on its own.',
    cost: 10,
    requiresId: 'network-balance',
    requiresSystem: 'furnace',
    requiresSectorEver: 5,
  },
  {
    id: 'furnace-auto',
    name: 'Heat Spend',
    category: 'furnace',
    blurb: 'Buy the cheapest Furnace rank whenever Heat allows.',
    cost: 20,
    requiresId: 'auto-bank',
    requiresSystem: 'furnace',
    requiresSectorEver: 8,
  },
  {
    id: 'deep-cache',
    name: 'Deep Cache',
    category: 'qol',
    blurb: '+4 hours on the offline cap.',
    cost: 22,
    requiresId: 'offline-sortie',
    requiresSectorEver: 8,
  },
  {
    id: 'combat-tempo',
    name: 'Combat Tempo',
    category: 'qol',
    blurb: 'Combat sim runs at ×1.5. Industry still uses real time.',
    cost: 24,
    requiresId: 'auto-salvage',
    requiresSectorEver: 10,
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

export function processCombatSpeedMult(state: GameState): number {
  return hasProcess(state, 'combat-tempo') ? 1.5 : 1
}

export function processOfflineBonusMs(state: GameState): number {
  return hasProcess(state, 'deep-cache') ? 4 * 60 * 60 * 1000 : 0
}

function systemLockReason(system: TabId): string {
  switch (system) {
    case 'foundry':
      return 'Foundry closed'
    case 'reliquary':
      return 'Reliquary closed'
    case 'furnace':
      return 'Furnace dark'
    case 'research':
      return 'Research closed'
    default:
      return 'Locked'
  }
}

export function canBuyProcessNode(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  const def = getProcessNode(id)
  if (!def) return { ok: false, reason: 'Unknown node' }
  if (hasProcess(state, id)) return { ok: false, reason: 'Owned' }
  if (def.requiresId && !hasProcess(state, def.requiresId)) {
    const prior = getProcessNode(def.requiresId)
    return { ok: false, reason: prior ? `Need ${prior.name}` : 'Need prior node' }
  }
  if (def.requiresSystem && !isSystemUnlocked(state, def.requiresSystem)) {
    return { ok: false, reason: systemLockReason(def.requiresSystem) }
  }
  if (def.requiresSectorEver && careerHighestSector(state) < def.requiresSectorEver) {
    return { ok: false, reason: `Clear sector ${def.requiresSectorEver}` }
  }
  if (state.resources.aiPoints < def.cost) {
    return { ok: false, reason: `Need ${def.cost} Process` }
  }
  return { ok: true }
}
