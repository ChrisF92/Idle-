import type { GameState } from '../types'
import { createInitialState } from '../state'
import type { SimulationStart } from './types'

/** Isolated clone that never touches persistence. */
export function isolateGameState(source: GameState): GameState {
  return structuredClone(source)
}

export function startingState(start: SimulationStart, now: number): GameState {
  if (start.type === 'fresh') return createInitialState(now)
  return isolateGameState(start.state)
}

export function freezeSnapshot<T>(value: T): T {
  return structuredClone(value)
}
