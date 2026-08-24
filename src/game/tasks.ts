/** Task List — checklist gate into Capital. Deferred from Act 1. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const TASK_UNLOCK_SECTOR = ACT1_CADENCE.tasks

export interface TaskDef {
  id: string
  name: string
  blurb: string
  done: (state: GameState) => boolean
}

function career(state: GameState): number {
  return careerBestWave(state)
}

export const TASKS: TaskDef[] = [
  {
    id: 'clear-72',
    name: `Reach Wave ${TASK_UNLOCK_SECTOR}`,
    blurb: 'The list opens here.',
    done: (s) => career(s) >= TASK_UNLOCK_SECTOR,
  },
  {
    id: 'rebuild',
    name: 'Rebuild once',
    blurb: 'Swap a hull in the hangar.',
    done: (s) => (s.prestige.prestigeCount ?? 0) >= 1,
  },
  {
    id: 'furnace',
    name: 'Light the Furnace',
    blurb: 'Bank Heat or buy a Furnace rank.',
    done: (s) =>
      (s.resources.heat ?? 0) > 0 ||
      Object.values(s.furnace?.ranks ?? {}).some((n) => (n ?? 0) > 0),
  },
  {
    id: 'protocol',
    name: 'Rank a Challenge',
    blurb: 'Finish one restricted sortie.',
    done: (s) => Object.values(s.protocols?.ranks ?? {}).some((n) => (n ?? 0) > 0),
  },
  {
    id: 'echo',
    name: 'Finish an Echo Run',
    blurb: 'Clear any Echo gauntlet.',
    done: (s) => Object.values(s.echo?.clears ?? {}).some((n) => (n ?? 0) > 0),
  },
  {
    id: 'specialist',
    name: 'Print a Specialist',
    blurb: 'Gunner, Warden, or Scavenger rank 1.',
    done: (s) => Object.values(s.specialists?.ranks ?? {}).some((n) => (n ?? 0) >= 1),
  },
]

export function taskDone(state: GameState, id: string): boolean {
  return TASKS.find((t) => t.id === id)?.done(state) ?? false
}

export function taskListProgress(state: GameState): { done: number; total: number } {
  const total = TASKS.length
  const done = TASKS.filter((t) => t.done(state)).length
  return { done, total }
}

export function taskListComplete(state: GameState): boolean {
  return TASKS.every((t) => t.done(state))
}
