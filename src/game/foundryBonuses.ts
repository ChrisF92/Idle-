/** Foundry bonus readers — no combat ranks. Facilities live on foundry.ts. */

import type { GameState } from './types'
import { RESEARCH_ANNEX_SPEED_MULT } from './foundrySeeds'

export const FOUNDRY_QUEUE_BASE = 3

export function foundryUpgradeRank(_state: GameState, _id: string): number {
  return 0
}

export function foundryXpMult(_state: GameState): number {
  return 1
}

export function foundryGlobalOutputAdd(_state: GameState): number {
  return 0
}

export function foundryMasteryGateReduce(_state: GameState): number {
  return 0
}

export function foundryNetworkFillMult(_state: GameState): number {
  return 1
}

export function foundryAshHeatMult(_state: GameState): number {
  return 1
}

export function foundryResearchXpMult(state: GameState): number {
  return (state.foundry?.facilities ?? []).includes('research-annex') ? RESEARCH_ANNEX_SPEED_MULT : 1
}

export function foundryShardDropBonus(_state: GameState): number {
  return 0
}

export function foundryPartDropMult(_state: GameState): number {
  return 1
}

export function foundryQueueCap(_state: GameState): number {
  return FOUNDRY_QUEUE_BASE
}

export function foundryExtraFitSlots(_state: GameState): number {
  return 0
}
