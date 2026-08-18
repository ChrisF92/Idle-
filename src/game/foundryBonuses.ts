/** Foundry upgrade readers — no imports of Network / Furnace / Research (avoids cycles). */

import type { GameState } from './types'
import { protocolMutes } from './protocols'

export const FOUNDRY_QUEUE_BASE = 3

export function foundryUpgradeRank(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.foundry?.upgrades[id] ?? 0))
}

function muted(state: GameState): boolean {
  return protocolMutes(state, 'foundry')
}

/** Recipe XP toward the next mastery rank. Rank 0 is identity. */
export function foundryXpMult(state: GameState): number {
  if (muted(state)) return 1
  return 1 + 0.15 * foundryUpgradeRank(state, 'fp-xp')
}

/** Extra pieces per finished craft, on top of mastery output. */
export function foundryGlobalOutputAdd(state: GameState): number {
  if (muted(state)) return 0
  return foundryUpgradeRank(state, 'fp-output')
}

/** Lowers recipe mastery gates (min 1). */
export function foundryMasteryGateReduce(state: GameState): number {
  if (muted(state)) return 0
  return foundryUpgradeRank(state, 'fp-mastery')
}

export function foundryNetworkFillMult(state: GameState): number {
  if (muted(state)) return 1
  return 1 + 0.03 * foundryUpgradeRank(state, 'fp-network')
}

export function foundryAshHeatMult(state: GameState): number {
  if (muted(state)) return 1
  return 1 + 0.04 * foundryUpgradeRank(state, 'fp-ash')
}

export function foundryResearchXpMult(state: GameState): number {
  if (muted(state)) return 1
  return 1 + 0.05 * foundryUpgradeRank(state, 'fp-research')
}

export function foundryShardDropBonus(state: GameState): number {
  if (muted(state)) return 0
  return 0.02 * foundryUpgradeRank(state, 'fp-reliquary')
}

export function foundryPartDropMult(state: GameState): number {
  if (muted(state)) return 1
  return 1 + 0.08 * foundryUpgradeRank(state, 'fp-print')
}

export function foundryQueueCap(state: GameState): number {
  return FOUNDRY_QUEUE_BASE + 3 * foundryUpgradeRank(state, 'fp-queue')
}

export function foundryExtraFitSlots(state: GameState): number {
  if (muted(state)) return 0
  return foundryUpgradeRank(state, 'fp-fit')
}
