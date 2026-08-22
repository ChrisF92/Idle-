/** GDD Worker Drones — industrial labour. Replaces Network combat bars. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { STATIONS } from './catalog'
import { meetsWave } from './waves'

/** Production / special jobs a Worker Drone can be assigned to. Training ranges stay on Cores. */
export const WORKER_JOB_IDS = STATIONS.filter(
  (station) => station.kind !== 'training',
).map((station) => station.id)

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
