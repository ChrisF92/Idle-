import type { GameState } from './types'
import { grantEnemyKillRewards } from './combat'
import { advanceTicks, startCombat } from './tick'
import { bandsClearedForWave, isBossWave } from './waves'

function wipeEnemies(state: GameState): void {
  for (const e of state.combat.enemyUnits) {
    if (e.hull > 0) {
      grantEnemyKillRewards(state, e)
      e.hull = 0
    }
  }
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

/** Fitted Pulse + Plate at salvage L1, persisted as Workshop core starts. */
export function equipPostTutorialLoadout(state: GameState): GameState {
  let next = forceUnlockModule(state, 'plate-layer')
  if (!next.shipyard.modules.includes('plate-layer')) {
    next.shipyard.modules = [...next.shipyard.modules, 'plate-layer']
  }
  const levels = {
    ...next.shipyard.moduleLevels,
    'pulse-cannon': Math.max(1, next.shipyard.moduleLevels['pulse-cannon'] ?? 0),
    'plate-layer': Math.max(1, next.shipyard.moduleLevels['plate-layer'] ?? 0),
  }
  next.shipyard.moduleLevels = levels
  if (!next.workshop) {
    next.workshop = { levels: {}, coreStarts: {} }
  }
  next.workshop.coreStarts = { ...next.workshop.coreStarts, ...levels }
  next.meta.starterCombatLesson = 2
  return next
}

/** First hull-loss dock — Salvage / Network / More unlock. */
export function markHullLost(state: GameState): GameState {
  const next = structuredClone(state)
  next.meta.hullLostOnce = true
  next.combat.lastSortie = { ...next.combat.lastSortie, outcome: 'defeat' }
  return next
}

/** Set career best Wave and matching ten-wave band clears. */
export function atCareerWave(state: GameState, wave: number): GameState {
  const next = structuredClone(state)
  const w = Math.max(0, Math.floor(wave))
  next.meta.bestWave = Math.max(next.meta.bestWave ?? 0, w)
  next.combat.bestWave = Math.max(next.combat.bestWave ?? 0, w)
  const bands = bandsClearedForWave(w)
  next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver ?? 0, bands)
  next.combat.highestSector = Math.max(next.combat.highestSector ?? 0, bands)
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

/** Clear through the next boss Wave (every 10th Wave). */
export function clearSector(state: GameState): GameState {
  let s = state
  let guard = 0
  const startWave = Math.max(1, s.combat.wave || 1)
  const goal = Math.ceil(startWave / 10) * 10
  while ((s.combat.wave || 1) <= goal && !s.combat.docked && guard < 24) {
    const before = s.combat.wave
    s = clearCurrentWave(s)
    guard += 1
    if (s.combat.docked) break
    if (s.combat.wave === before && !isBossWave(before)) break
  }
  return s
}
