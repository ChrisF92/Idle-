/** One simulation clock for all combat-time systems. */

import { selectedTimeCompression } from './matter'
import type { GameState } from './types'

/** Fixed combat step. Gameplay must not depend on render frame rate. */
export const SIM_FIXED_DT = 1 / 30

/**
 * Canonical combat simulation-rate multiplier.
 * Time Compression (1× / 1.5× / 2× / 3×) is the only general combat-speed track.
 */
export function simulationRate(state: GameState): number {
  return selectedTimeCompression(state)
}

/** Consume already-scaled combat simulation time using the fixed step. */
export function advanceCombatSimulation(
  state: GameState,
  combatSimDt: number,
  step: (dt: number) => void,
): void {
  if (combatSimDt <= 0) return
  state.combat.simAccumulator = (state.combat.simAccumulator ?? 0) + combatSimDt
  let guard = 0
  while (state.combat.simAccumulator + 1e-12 >= SIM_FIXED_DT && guard < 4000) {
    state.combat.simTime = (state.combat.simTime ?? 0) + SIM_FIXED_DT
    step(SIM_FIXED_DT)
    state.combat.simAccumulator -= SIM_FIXED_DT
    guard += 1
  }
  if (state.combat.simAccumulator < 1e-12) state.combat.simAccumulator = 0
}

/**
 * Convert real seconds of RUNNING combat into fixed simulation steps.
 * `simulationRate` is applied once here — never inside industry clocks.
 */
export function consumeSimSteps(
  state: GameState,
  realSeconds: number,
  step: (dt: number) => void,
): void {
  const rate = Math.max(0, simulationRate(state))
  if (realSeconds <= 0 || rate <= 0) return
  advanceCombatSimulation(state, realSeconds * rate, step)
}
