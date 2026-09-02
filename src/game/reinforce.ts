/** Post-Act-1 direction revealed by clearing the Wave 1000 finale. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'

export const REINFORCE_UNLOCK_WAVE = ACT1_CADENCE.reinforce

export function reinforceUnlocked(state: GameState): boolean {
  return Boolean(state.meta.act1Cleared)
}
