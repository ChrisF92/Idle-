import type { GameState } from './types'
import { WAVES_PER_SECTOR } from './progression'
import { advanceTicks, startCombat } from './tick'

function wipeEnemies(state: GameState): void {
  for (const e of state.combat.enemyUnits) e.hull = 0
  state.combat.enemyHull = 0
}

/** Resolve the current wave (mutates via advanceTicks). */
export function clearCurrentWave(state: GameState): GameState {
  let s = state
  if (!s.combat.inFight) s = startCombat(s)
  wipeEnemies(s)
  advanceTicks(s, 1)
  // Skip intermission without simulating field-repair time so hull tests stay honest.
  if (!s.combat.inFight && !s.combat.docked && s.combat.intermissionLeft > 0) {
    s.combat.intermissionLeft = 0
    s = startCombat(s)
  }
  return s
}

/** Clear a full sector (all waves). Hold stays; Advance pushes. */
export function clearSector(state: GameState, waves = WAVES_PER_SECTOR): GameState {
  let s = state
  for (let i = 0; i < waves; i++) {
    s = clearCurrentWave(s)
  }
  return s
}
