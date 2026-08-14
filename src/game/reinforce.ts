/** Reinforce — USI Reinforce analogue. Second prestige layer at sector 80. */

import type { GameState } from './types'

export const REINFORCE_UNLOCK_SECTOR = 80

export function reinforceCount(state: GameState): number {
  return Math.max(0, Math.floor(state.meta.ascensionCount ?? 0))
}

export function reinforceUnlocked(state: GameState): boolean {
  const ever = Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
  return ever >= REINFORCE_UNLOCK_SECTOR
}

export function canReinforce(state: GameState): { ok: boolean; reason?: string } {
  if (!reinforceUnlocked(state)) {
    return { ok: false, reason: `Clear sector ${REINFORCE_UNLOCK_SECTOR}` }
  }
  if (state.prestige.activeChallengeId) {
    return { ok: false, reason: 'Finish or abandon the active run' }
  }
  return { ok: true }
}
