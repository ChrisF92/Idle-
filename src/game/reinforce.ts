/** Reinforce — second prestige layer at W300 (GDD §102). */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const REINFORCE_UNLOCK_SECTOR = ACT1_CADENCE.reinforce

export function reinforceCount(state: GameState): number {
  return Math.max(0, Math.floor(state.meta.ascensionCount ?? 0))
}

export function reinforceUnlocked(state: GameState): boolean {
  return careerBestWave(state) >= REINFORCE_UNLOCK_SECTOR
}

export function canReinforce(state: GameState): { ok: boolean; reason?: string } {
  if (!reinforceUnlocked(state)) {
    return { ok: false, reason: `Reach Wave ${REINFORCE_UNLOCK_SECTOR}` }
  }
  if (state.prestige.activeChallengeId) {
    return { ok: false, reason: 'Finish or abandon the active run' }
  }
  return { ok: true }
}
