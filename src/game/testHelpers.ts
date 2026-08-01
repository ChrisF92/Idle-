import type { GameState } from './types'
import { WAVES_PER_SECTOR } from './progression'
import { advanceTicks, startCombat } from './tick'

function wipeEnemies(state: GameState): void {
  for (const e of state.combat.enemyUnits) e.hull = 0
  state.combat.enemyHull = 0
}

/** Bypass scrap/fab gates — for tests that need a module already unlocked. */
export function forceUnlockModule(state: GameState, moduleId: string): GameState {
  const next = structuredClone(state)
  if (!next.shipyard.unlockedModules.includes(moduleId)) {
    next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
  }
  if (!next.meta.discoveredModules.includes(moduleId)) {
    next.meta.discoveredModules = [...next.meta.discoveredModules, moduleId]
  }
  return next
}

/**
 * Post-tutorial Act 1 opener: Plate + salvage L1 on Pulse/Plate.
 * Needed once mid-wave hull recovery was removed — naked Scout death-loops S1.
 */
export function equipPostTutorialLoadout(state: GameState): GameState {
  let next = forceUnlockModule(state, 'plate-layer')
  if (!next.shipyard.modules.includes('plate-layer')) {
    next.shipyard.modules = [...next.shipyard.modules, 'plate-layer']
  }
  next.shipyard.moduleLevels = {
    ...next.shipyard.moduleLevels,
    'pulse-cannon': Math.max(1, next.shipyard.moduleLevels['pulse-cannon'] ?? 0),
    'plate-layer': Math.max(1, next.shipyard.moduleLevels['plate-layer'] ?? 0),
  }
  next.meta.starterCombatLesson = 2
  return next
}

/** Resolve the current wave (mutates via advanceTicks). */
export function clearCurrentWave(state: GameState): GameState {
  let s = state
  if (!s.combat.inFight) s = startCombat(s)
  wipeEnemies(s)
  advanceTicks(s, 1)
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
