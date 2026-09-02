/** Brand-new careers start inside Wave 1. Existing saves never auto-launch. */

import { hasDirectiveOffer } from './directives'
import { createInitialState } from './state'
import { beginFight, setDocked } from './tick'
import type { GameState } from './types'

/** Docked baseline used by tests and Rebuild templates. Never auto-launches. */
export function createDockedBaseline(now = Date.now()): GameState {
  return createInitialState(now)
}

/**
 * Genuinely new game: starter Frame + Cores already fitted, Wave 1 Sortie live.
 * Callers that mean "no save yet" / hard reset must use this — not createInitialState.
 */
export function createFreshCareerState(now = Date.now()): GameState {
  return startOpeningSortie(createInitialState(now))
}

/** Launch Wave 1 and begin combat. No-op if already undocked and fighting. */
export function startOpeningSortie(state: GameState): GameState {
  if (!state.combat.docked && state.combat.inFight) return state
  let next = state
  if (next.combat.docked) next = setDocked(next, false)
  if (next.combat.inFight || hasDirectiveOffer(next)) return next
  const live = structuredClone(next)
  beginFight(live)
  live.combat.log = [
    'Wave 1 — the Hive is already in the field.',
    ...live.combat.log.filter((line) => !/Launch a sortie when ready/i.test(line)),
  ].slice(0, 40)
  return live
}

export function isOpeningSortieLive(state: GameState): boolean {
  return !state.combat.docked && state.combat.inFight && (state.combat.wave ?? 1) >= 1
}
