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
