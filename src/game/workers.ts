/** GDD Worker Drones — industrial labour. Replaces Network combat bars. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { meetsWave } from './waves'

/** Production / special jobs a Worker Drone can be assigned to. Training ranges stay on Cores. */
export const WORKER_JOB_IDS: readonly string[] = [
  'scrap-field',
  'power-grid',
  'sensor-net',
  'alloy-foundry',
  'repair-bay',
  'drone-fab',
  'fab-bay',
  'construction',
]

export interface WorkerJobCap {
  min: number
  efficient: number
  hard: number
}

/** Display names — station ids stay. */
export const WORKER_JOB_LABELS: Record<string, string> = {
  'scrap-field': 'Salvage ops',
  'power-grid': 'Power',
  'sensor-net': 'Research',
  'alloy-foundry': 'Processing',
  'repair-bay': 'Repair',
  'drone-fab': 'Drone production',
  'fab-bay': 'Fabrication',
  'construction': 'Construction',
}

export const WORKER_JOB_CAPS: Record<string, WorkerJobCap> = {
  'scrap-field': { min: 1, efficient: 8, hard: 20 },
  'power-grid': { min: 1, efficient: 6, hard: 16 },
  'sensor-net': { min: 1, efficient: 6, hard: 16 },
  'alloy-foundry': { min: 1, efficient: 4, hard: 12 },
  'repair-bay': { min: 1, efficient: 6, hard: 16 },
  'drone-fab': { min: 1, efficient: 4, hard: 10 },
  'fab-bay': { min: 1, efficient: 4, hard: 40 },
  'construction': { min: 1, efficient: 4, hard: 8 },
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
  foundry: number
  research: number
  fabrication: number
} {
  const assignments = state.base.assignments ?? {}
  const count = (id: string) => Math.max(0, Math.floor(assignments[id] ?? 0))
  const foundry = count('alloy-foundry') + count('construction')
  const research = count('sensor-net')
  const fabrication = count('fab-bay') + count('drone-fab')
  const assigned = Object.values(assignments).reduce((n, v) => n + Math.max(0, Math.floor(v ?? 0)), 0)
  const total = Math.max(0, Math.floor(state.base.workerDrones ?? 0))
  return {
    total,
    assigned,
    idle: Math.max(0, total - assigned),
    foundry,
    research,
    fabrication,
  }
}
