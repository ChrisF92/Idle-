/** GDD Worker Drones — industrial labour. Replaces Network combat bars. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { meetsWave } from './waves'

/** Production jobs a Worker Drone can be assigned to. */
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
  'drone-fab': 'Worker Drone Fabrication',
  'fab-bay': 'Fabrication',
  construction: 'Infrastructure',
}

export const WORKER_JOB_CAPS: Record<string, WorkerJobCap> = {
  'scrap-field': { min: 1, efficient: 10, hard: 24 },
  'sensor-net': { min: 2, efficient: 8, hard: 20 },
  'alloy-foundry': { min: 2, efficient: 6, hard: 16 },
  'drone-fab': { min: 2, efficient: 4, hard: 12 },
  'fab-bay': { min: 2, efficient: 4, hard: 10 },
  construction: { min: 2, efficient: 4, hard: 10 },
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

/** Effective bodies: full value through the efficient range, then diminishing returns. */
export function workerJobContribution(assigned: number, jobId: string): number {
  const cap = workerJobCap(jobId)
  const bodies = Math.min(cap.hard, Math.max(0, Math.floor(assigned)))
  const efficient = Math.min(cap.efficient, bodies)
  const excess = Math.max(0, bodies - cap.efficient)
  return efficient + excess * 0.35
}

export function workerJobEfficientRange(jobId: string): string {
  const cap = workerJobCap(jobId)
  return `Efficient ${cap.min}–${cap.efficient}`
}

export function workerJobHasWork(state: GameState, jobId: string): boolean {
  if (jobId === 'scrap-field') return true
  if (jobId === 'alloy-foundry') return state.foundry.slots.some((slot) => Boolean(slot.recipeId))
  if (jobId === 'fab-bay') {
    return state.foundry.fabrication.some(
      (slot) => !slot.complete && (slot.kind === 'core' || slot.kind === 'relic'),
    )
  }
  if (jobId === 'construction') {
    return state.foundry.fabrication.some((slot) => !slot.complete && slot.kind === 'facility')
  }
  if (jobId === 'sensor-net') return Boolean(state.hiveResearch?.active)
  if (jobId === 'drone-fab') return state.foundry.facilities.includes('drone-fabricator')
  return false
}

export function isWorkersUnlocked(state: GameState): boolean {
  return meetsWave(state, ACT1_CADENCE.workers)
}

export function isWorkerJob(stationId: string): boolean {
  return WORKER_JOB_IDS.includes(stationId)
}

export function workerAllocationSummary(state: GameState): {
  total: number
  assigned: number
  idle: number
  jobs: Record<string, number>
} {
  const assignments = state.base.assignments ?? {}
  const count = (id: string) => Math.max(0, Math.floor(assignments[id] ?? 0))
  const jobs: Record<string, number> = {}
  for (const id of WORKER_JOB_IDS) jobs[id] = count(id)
  const assigned = Object.values(jobs).reduce((n, v) => n + v, 0)
  const total = Math.max(0, Math.floor(state.base.workerDrones ?? 0))
  return {
    total,
    assigned,
    idle: Math.max(0, total - assigned),
    jobs,
  }
}
