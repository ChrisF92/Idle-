/** Exact Worker Drone assignment consequences for the Systems workforce UI. */

import { STATIONS, stationEffectiveDrones } from './catalog'
import {
  fabricationJobLabel,
  fabricationJobTime,
  foundryCraftTime,
  foundryFabricationSpeed,
  foundryProcessingSpeed,
  FOUNDRY_RECIPES,
} from './foundry'
import {
  formatResearchDuration,
  hiveResearchActiveNode,
  hiveResearchNodeDuration,
  hiveResearchProgress,
  hiveResearchSpeed,
} from './hiveResearch'
import type { GameState } from './types'
import { ownedWorkers, workerCapacity, workerJobCap, workerJobEfficientRange, workerJobLabel } from './workers'

export interface WorkerJobConsequence {
  jobId: string
  title: string
  assigned: number
  band: string
  current: string
  next: string
}

function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds))
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const secs = value % 60
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function withAssignment(state: GameState, jobId: string, assigned: number): GameState {
  return {
    ...state,
    base: {
      ...state.base,
      assignments: {
        ...state.base.assignments,
        [jobId]: Math.max(0, assigned),
      },
    },
  }
}

function nextLine(assigned: number, jobId: string, value: string): string {
  return assigned >= workerJobCap(jobId).hard
    ? '+1 Worker → no change (hard cap)'
    : `+1 Worker → ${value}`
}

function processingConsequence(state: GameState, assigned: number, band: string): WorkerJobConsequence {
  const slot = state.foundry.slots.find((row) => row.recipeId)
  const recipe = slot?.recipeId ? FOUNDRY_RECIPES.find((row) => row.id === slot.recipeId) : undefined
  const current = recipe
    ? foundryCraftTime(state, recipe.id) / Math.max(0.01, foundryProcessingSpeed(state))
    : 0
  const plus = withAssignment(state, 'alloy-foundry', assigned + 1)
  const next = recipe
    ? foundryCraftTime(plus, recipe.id) / Math.max(0.01, foundryProcessingSpeed(plus))
    : 0
  return {
    jobId: 'alloy-foundry',
    title: recipe ? `${recipe.name} Processing` : 'Processing',
    assigned,
    band,
    current: recipe ? `Cycle ${formatSeconds(current)}` : 'No active Processor',
    next: nextLine(assigned, 'alloy-foundry', recipe ? formatSeconds(next) : 'no active Processor'),
  }
}

function fabricationConsequence(
  state: GameState,
  jobId: 'fab-bay' | 'construction',
  assigned: number,
  band: string,
): WorkerJobConsequence {
  const slot = state.foundry.fabrication.find((row) =>
    jobId === 'construction'
      ? row.kind === 'facility'
      : row.kind === 'core' || row.kind === 'relic' || row.kind === 'frame' || row.kind === 'worker',
  )
  if (!slot?.kind || !slot.jobId) {
    return {
      jobId,
      title: jobId === 'construction' ? 'Infrastructure' : 'Fabrication',
      assigned,
      band,
      current: 'No active project',
      next: nextLine(assigned, jobId, 'no active project'),
    }
  }
  const base = fabricationJobTime(state, slot.kind, slot.jobId) * (1 - slot.progress)
  const current = base / Math.max(0.01, foundryFabricationSpeed(state, slot.kind))
  const plus = withAssignment(state, jobId, assigned + 1)
  const next = base / Math.max(0.01, foundryFabricationSpeed(plus, slot.kind))
  const item = fabricationJobLabel(state, slot)
  return {
    jobId,
    title: `${item} ${jobId === 'construction' ? 'Infrastructure' : 'Fabrication'}`,
    assigned,
    band,
    current: `${formatSeconds(current)} remaining`,
    next: nextLine(assigned, jobId, formatSeconds(next)),
  }
}

function researchConsequence(state: GameState, assigned: number, band: string): WorkerJobConsequence {
  const node = hiveResearchActiveNode(state)
  const remaining = node
    ? Math.max(0, hiveResearchNodeDuration(node, state) - hiveResearchProgress(state))
    : 0
  const current = remaining / Math.max(0.01, hiveResearchSpeed(state))
  const plus = withAssignment(state, 'sensor-net', assigned + 1)
  const next = remaining / Math.max(0.01, hiveResearchSpeed(plus))
  return {
    jobId: 'sensor-net',
    title: node ? `Research — ${node.name}` : 'Research',
    assigned,
    band,
    current: node ? `${formatResearchDuration(current)} remaining` : 'No active Research',
    next: nextLine(assigned, 'sensor-net', node ? formatResearchDuration(next) : 'no active Research'),
  }
}

function droneFabricationConsequence(state: GameState, assigned: number, band: string): WorkerJobConsequence {
  const slot = state.foundry.fabrication.find((row) => row.kind === 'worker')
  if (!slot) {
    return {
      jobId: 'drone-fab',
      title: 'Worker Fabrication',
      assigned,
      band,
      current: ownedWorkers(state) >= workerCapacity(state) ? 'Capacity full' : 'No Worker job queued',
      next: nextLine(assigned, 'drone-fab', 'no active job'),
    }
  }
  const base = fabricationJobTime(state, 'worker', 'worker') * (1 - slot.progress)
  const current = base / Math.max(0.01, foundryFabricationSpeed(state, 'worker'))
  const plus = withAssignment(state, 'drone-fab', assigned + 1)
  const next = base / Math.max(0.01, foundryFabricationSpeed(plus, 'worker'))
  return {
    jobId: 'drone-fab',
    title: 'Worker Fabrication',
    assigned,
    band,
    current: `${formatSeconds(current)} remaining`,
    next: nextLine(assigned, 'drone-fab', formatSeconds(next)),
  }
}

export function workerJobConsequence(state: GameState, jobId: string): WorkerJobConsequence {
  const assigned = Math.max(0, Math.floor(state.base.assignments[jobId] ?? 0))
  const band = workerJobEfficientRange(jobId)
  if (jobId === 'alloy-foundry') return processingConsequence(state, assigned, band)
  if (jobId === 'fab-bay' || jobId === 'construction') {
    return fabricationConsequence(state, jobId, assigned, band)
  }
  if (jobId === 'sensor-net') return researchConsequence(state, assigned, band)
  if (jobId === 'drone-fab') return droneFabricationConsequence(state, assigned, band)
  if (jobId === 'scrap-field') {
    const station = STATIONS.find((row) => row.id === jobId)
    const perSecond = (station?.rates.scrap ?? 0.4) * stationEffectiveDrones(state, jobId)
    const plus = withAssignment(state, jobId, assigned + 1)
    const next = (station?.rates.scrap ?? 0.4) * stationEffectiveDrones(plus, jobId)
    return {
      jobId,
      title: 'Salvage Operations',
      assigned,
      band,
      current: `+${Math.round(perSecond * 60)} Scrap/min`,
      next: nextLine(assigned, jobId, `+${Math.round(next * 60)} Scrap/min`),
    }
  }
  return {
    jobId,
    title: workerJobLabel(jobId),
    assigned,
    band,
    current: assigned > 0 ? `${assigned} Workers` : 'Unassigned',
    next: nextLine(assigned, jobId, `${assigned + 1} Workers`),
  }
}
