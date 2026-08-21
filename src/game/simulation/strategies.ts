import type { GameState } from '../types'
import type { PlayerStrategy, StrategyContext } from './types'
import {
  doRebuild,
  ensureAdvance,
  ensureLaunched,
  industryPass,
  maybeHold,
  maybeRetryFrontier,
  shouldRebuild,
  skipGuides,
} from './actions'
import { setDocked } from '../tick'

function playSession(state: GameState, ctx: StrategyContext, mode: 'active' | 'casual' | 'optimiser'): GameState {
  let next = skipGuides(state)
  next = industryPass(next, ctx, mode)
  const rebuild = shouldRebuild(next, ctx)
  if (rebuild.yes) {
    next = doRebuild(next, ctx, rebuild.reasons)
    next = industryPass(next, ctx, mode)
  }
  next = ensureAdvance(next)
  // Hold briefly after repeated deaths so repairs can catch up.
  if (next.combat.consecutiveLosses >= 2 && next.combat.docked) {
    next = maybeHold(next, true)
  } else if (next.combat.highestSector > 0 && next.combat.consecutiveLosses === 0) {
    next = maybeHold(next, false)
  }
  next = ensureLaunched(next, ctx)
  next = maybeRetryFrontier(next, ctx)
  return next
}

export const idleStrategy: PlayerStrategy = {
  id: 'idle',
  label: 'Idle',
  decide(state, ctx) {
    let next = skipGuides(state)
    next = ensureAdvance(next)
    next = ensureLaunched(next, ctx)
    next = maybeRetryFrontier(next, ctx)
    return next
  },
}

export const activeStrategy: PlayerStrategy = {
  id: 'active',
  label: 'Active',
  decide(state, ctx) {
    return playSession(state, ctx, 'active')
  },
}

export const casualStrategy: PlayerStrategy = {
  id: 'casual',
  label: 'Casual',
  decide(state, ctx) {
    return playSession(state, ctx, 'casual')
  },
}

export const optimiserStrategy: PlayerStrategy = {
  id: 'optimiser',
  label: 'Optimiser',
  decide(state, ctx) {
    return playSession(state, ctx, 'optimiser')
  },
}

export const STRATEGIES: Record<string, PlayerStrategy> = {
  idle: idleStrategy,
  active: activeStrategy,
  casual: casualStrategy,
  optimiser: optimiserStrategy,
}

export function getStrategy(id: string): PlayerStrategy {
  return STRATEGIES[id] ?? activeStrategy
}

/** Dock before an offline period so catch-up matches a closed app. */
export function closeSession(state: GameState): GameState {
  if (state.combat.docked) return state
  return setDocked(state, true)
}
