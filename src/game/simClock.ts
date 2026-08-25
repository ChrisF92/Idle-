/** One simulation clock for all combat-time systems. */

import type { GameState } from './types'

/** Fixed combat step. Gameplay must not depend on render frame rate. */
export const SIM_FIXED_DT = 1 / 30

/**
 * Canonical combat simulation-rate multiplier.
 * PR3 wires Time Compression (1.5× / 2× / 3×) through this single function.
 * PR1 keeps the default 1× and does not apply reclaim/chrono/research extras.
 */
export function simulationRate(_state: GameState): number {
  return 1
}

export function consumeSimSteps(
  state: GameState,
  realSeconds: number,
  step: (dt: number) => void,
): void {
  const rate = Math.max(0, simulationRate(state))
  if (realSeconds <= 0 || rate <= 0) return
  state.combat.simAccumulator = (state.combat.simAccumulator ?? 0) + realSeconds * rate
  let guard = 0
  while (state.combat.simAccumulator + 1e-12 >= SIM_FIXED_DT && guard < 4000) {
    state.combat.simTime = (state.combat.simTime ?? 0) + SIM_FIXED_DT
    step(SIM_FIXED_DT)
    state.combat.simAccumulator -= SIM_FIXED_DT
    guard += 1
  }
  if (state.combat.simAccumulator < 1e-12) state.combat.simAccumulator = 0
}
