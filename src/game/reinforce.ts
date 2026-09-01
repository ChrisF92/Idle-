/** Reinforce — higher prestige revealed by clearing the Wave 1000 finale. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'

export const REINFORCE_UNLOCK_SECTOR = ACT1_CADENCE.reinforce

export function reinforceCount(state: GameState): number {
  return Math.max(0, Math.floor(state.meta.ascensionCount ?? 0))
}

export function reinforceUnlocked(state: GameState): boolean {
  return Boolean(state.meta.act1Cleared) || reinforceCount(state) > 0
}

export function canReinforce(state: GameState): { ok: boolean; reason?: string } {
  if (!reinforceUnlocked(state)) {
    return { ok: false, reason: `Defeat the Wave ${REINFORCE_UNLOCK_SECTOR} Choir Crown` }
  }
  if (!state.combat.docked) {
    return { ok: false, reason: 'Dock first' }
  }
  if (state.challenges.activeId) {
    return { ok: false, reason: 'Finish or abandon the active run' }
  }
  return { ok: true }
}
