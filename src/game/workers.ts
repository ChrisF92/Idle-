/** Permanent Worker Drones — physical workforce, distinct from capacity. */

import type { GameState } from './types'
import { matterWorkerCapacityBonus } from './matter'
import {
  BASE_WORKER_CAPACITY,
  WORKER_CONTRIBUTION_EXCESS,
} from './foundrySeeds'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const WORKER_JOB_IDS: readonly string[] = [
  'scrap-field',
  'sensor-net',
  'alloy-foundry',
  'drone-fab',
  'fab-bay',
  'construction',
]

export interface WorkerJobCap {
  min: number
  efficient: number
  hard: number
}

export const WORKER_JOB_LABELS: Record<string, string> = {
  'scrap-field': 'Salvage Operations',
  'sensor-net': 'Research',
  'alloy-foundry': 'Processing',
  'drone-fab': 'Worker Fabrication',
  'fab-bay': 'Fabrication',
  construction: 'Infrastructure',
}

export const WORKER_JOB_CAPS: Record<string, WorkerJobCap> = {
  'scrap-field': { min: 1, efficient: 8, hard: 20 },
  'sensor-net': { min: 2, efficient: 6, hard: 16 },
  'alloy-foundry': { min: 2, efficient: 4, hard: 12 },
  'drone-fab': { min: 2, efficient: 4, hard: 10 },
  'fab-bay': { min: 2, efficient: 4, hard: 8 },
  construction: { min: 2, efficient: 4, hard: 8 },
}

export function workerJobCap(jobId: string): WorkerJobCap {
  return WORKER_JOB_CAPS[jobId] ?? { min: 1, efficient: 4, hard: 8 }
}

export function workerJobLabel(jobId: string, fallback?: string): string {
  return WORKER_JOB_LABELS[jobId] ?? fallback ?? jobId
}

export function workerJobCapLine(assigned: number, jobId: string): string {
  const cap = workerJobCap(jobId)
  return `${assigned}/${cap.efficient} efficient · cap ${cap.hard}`
}

export function workerJobContribution(assigned: number, jobId: string): number {
  const cap = workerJobCap(jobId)
  const bodies = Math.min(cap.hard, Math.max(0, Math.floor(assigned)))
  const efficient = Math.min(cap.efficient, bodies)
  const excess = Math.max(0, bodies - cap.efficient)
  return efficient + excess * WORKER_CONTRIBUTION_EXCESS
}

export function workerJobEfficientRange(jobId: string): string {
  const cap = workerJobCap(jobId)
  return `Efficient ${cap.min}–${cap.efficient}`
}

export function ownedWorkers(state: Pick<GameState, 'base'>): number {
  return Math.max(0, Math.floor(state.base.workerDrones ?? 0))
}

/** Drone Racks is the sole PR9 Research capacity increase. */
export function extraWorkerCapacityFromResearch(state: GameState): number {
  return state.hiveResearch?.completedIds?.includes('d5-drone-racks') ? 2 : 0
}

export function workerCapacity(
  state: {
    prestige: { matterShop?: Record<string, number> }
  },
): number {
  let cap = BASE_WORKER_CAPACITY
  cap += matterWorkerCapacityBonus(state)
  cap += extraWorkerCapacityFromResearch(state as GameState)
  return Math.max(1, Math.floor(cap))
}

export function assignedWorkerCount(state: Pick<GameState, 'base'>): number {
  const assignments = state.base.assignments ?? {}
  let n = 0
  for (const id of WORKER_JOB_IDS) n += Math.max(0, Math.floor(assignments[id] ?? 0))
  return n
}

export function idleWorkers(state: Pick<GameState, 'base'>): number {
  return Math.max(0, ownedWorkers(state) - assignedWorkerCount(state))
}

export function workerJobHasWork(state: GameState, jobId: string): boolean {
  if (jobId === 'scrap-field') return true
  if (jobId === 'alloy-foundry') return (state.foundry?.slots ?? []).some((slot) => Boolean(slot.recipeId))
  if (jobId === 'fab-bay') {
    return (state.foundry?.fabrication ?? []).some(
      (slot) => slot.kind === 'core' || slot.kind === 'frame' || slot.kind === 'relic',
    )
  }
  if (jobId === 'construction') {
    return (state.foundry?.fabrication ?? []).some((slot) => slot.kind === 'facility')
  }
  if (jobId === 'sensor-net') return Boolean(state.hiveResearch?.active)
  if (jobId === 'drone-fab') {
    return (
      (state.foundry?.facilities ?? []).includes('worker-fabricator') &&
      ownedWorkers(state) < workerCapacity(state)
    )
  }
  return false
}

export function isWorkersUnlocked(state: Pick<GameState, 'meta' | 'combat' | 'prestige'>): boolean {
  return careerBestWave(state as GameState) >= ACT1_CADENCE.workers
}

export function isWorkerJob(stationId: string): boolean {
  return WORKER_JOB_IDS.includes(stationId)
}

export function workerAllocationSummary(state: GameState): {
  total: number
  capacity: number
  assigned: number
  idle: number
  jobs: Record<string, number>
} {
  const assignments = state.base.assignments ?? {}
  const count = (id: string) => Math.max(0, Math.floor(assignments[id] ?? 0))
  const jobs: Record<string, number> = {}
  for (const id of WORKER_JOB_IDS) jobs[id] = count(id)
  const assigned = Object.values(jobs).reduce((n, v) => n + v, 0)
  const total = ownedWorkers(state)
  return {
    total,
    capacity: workerCapacity(state),
    assigned,
    idle: Math.max(0, total - assigned),
    jobs,
  }
}
