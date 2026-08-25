import type { GameState } from '../types'
import type { PlayerStrategy, SimulationSpendProfile, SimulationStrategyId, StrategyContext } from './types'
import {
  doRebuild,
  ensureLaunched,
  industryPass,
  maybeChooseDirective,
  shouldRebuild,
  skipGuides,
} from './actions'
import { setDocked } from '../tick'

export function spendProfileFor(id: SimulationStrategyId): SimulationSpendProfile {
  if (id === 'casual') return 'casual'
  if (id === 'offensive') return 'offensive'
  if (id === 'defensive') return 'defensive'
  if (id === 'economy-first') return 'economy-first'
  if (id === 'optimiser') return 'optimiser'
  return 'balanced'
}

function playSession(state: GameState, ctx: StrategyContext, mode: SimulationSpendProfile): GameState {
  let next = skipGuides(state)
  next = industryPass(next, ctx, mode)
  const rebuild = shouldRebuild(next, ctx)
  if (rebuild.yes) {
    next = doRebuild(next, ctx, rebuild.reasons)
    next = industryPass(next, ctx, mode)
  }
  next = ensureLaunched(next, ctx)
  next = maybeChooseDirective(next, ctx)
  return next
}

export const idleStrategy: PlayerStrategy = {
  id: 'idle',
  label: 'Idle',
  decide(state, ctx) {
    let next = skipGuides(state)
    next = ensureLaunched(next, ctx)
    next = maybeChooseDirective(next, ctx)
    return next
  },
}

export const casualStrategy: PlayerStrategy = {
  id: 'casual',
  label: 'Casual',
  decide(state, ctx) {
    return playSession(state, ctx, 'casual')
  },
}

export const balancedStrategy: PlayerStrategy = {
  id: 'balanced',
  label: 'Balanced',
  decide(state, ctx) {
    return playSession(state, ctx, 'balanced')
  },
}

/** Leftover alias — Balanced. */
export const activeStrategy: PlayerStrategy = {
  id: 'active',
  label: 'Balanced',
  decide(state, ctx) {
    return playSession(state, ctx, 'balanced')
  },
}

export const offensiveStrategy: PlayerStrategy = {
  id: 'offensive',
  label: 'Offensive',
  decide(state, ctx) {
    return playSession(state, ctx, 'offensive')
  },
}

export const defensiveStrategy: PlayerStrategy = {
  id: 'defensive',
  label: 'Defensive',
  decide(state, ctx) {
    return playSession(state, ctx, 'defensive')
  },
}

export const economyFirstStrategy: PlayerStrategy = {
  id: 'economy-first',
  label: 'Economy First',
  decide(state, ctx) {
    return playSession(state, ctx, 'economy-first')
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
  balanced: balancedStrategy,
  offensive: offensiveStrategy,
  defensive: defensiveStrategy,
  'economy-first': economyFirstStrategy,
  optimiser: optimiserStrategy,
}

export function getStrategy(id: string): PlayerStrategy {
  return STRATEGIES[id] ?? balancedStrategy
}

/** Dock before an offline period so catch-up matches a closed app. */
export function closeSession(state: GameState): GameState {
  if (state.combat.docked) return state
  return setDocked(state, true)
}
