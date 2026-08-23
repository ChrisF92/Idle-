/** Worker assignment consequences for Systems / Worker UI. */

import { STATIONS } from './catalog'
import { FOUNDRY_RECIPES, foundryCraftTime, foundryFabricationSpeed, foundryProcessingSpeed } from './foundry'
import type { GameState } from './types'
import { workerJobCap, workerJobLabel } from './workers'

export interface WorkerJobConsequence {
  jobId: string
  title: string
  assigned: number
  band: string
  current: string
  next: string
}

function formatMult(n: number): string {
  return `×${n.toFixed(2)}`
}

function formatSeconds(n: number): string {
  const s = Math.max(0, Math.ceil(n))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

export function workerJobConsequence(state: GameState, jobId: string): WorkerJobConsequence {
  const assigned = Math.max(0, Math.floor(state.base.assignments[jobId] ?? 0))
  const cap = workerJobCap(jobId)
  const station = STATIONS.find((row) => row.id === jobId)
  const title = workerJobLabel(jobId, station?.name)
  const band = `${assigned}/${cap.efficient} efficient · cap ${cap.hard}`

  if (jobId === 'scrap-field') {
    const rate = (station?.rates.scrap ?? 0.4) * assigned
    const next = (station?.rates.scrap ?? 0.4) * (assigned + 1)
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Scrap +${rate.toFixed(1)}/s` : 'Scrap 0/s',
      next: `+1 → +${next.toFixed(1)}/s`,
    }
  }

  if (jobId === 'alloy-foundry') {
    const speed = foundryProcessingSpeed(state)
    const slot = state.foundry?.slots?.find((row) => row.recipeId)
    const recipe = slot?.recipeId ? FOUNDRY_RECIPES.find((row) => row.id === slot.recipeId) : null
    const total = slot?.recipeId ? foundryCraftTime(state, slot.recipeId) / Math.max(0.05, speed) : 0
    const remain = slot ? total * (1 - (slot.progress ?? 0)) : 0
    return {
      jobId,
      title: 'Processing',
      assigned,
      band,
      current: recipe ? `${recipe.name} ${formatSeconds(remain)}` : `Current speed ${formatMult(speed)}`,
      next: assigned >= cap.hard ? 'At hard cap' : 'More drones shorten Processing time',
    }
  }

  if (jobId === 'fab-bay' || jobId === 'construction') {
    const kind = jobId === 'construction' ? 'facility' : 'core'
    const slot = state.foundry?.fabrication?.find((row) =>
      jobId === 'construction' ? row.kind === 'facility' : row.kind === 'core' || row.kind === 'relic',
    )
    const speed = foundryFabricationSpeed(state, slot?.kind ?? kind)
    return {
      jobId,
      title: jobId === 'fab-bay' ? 'Fabrication' : 'Construction',
      assigned,
      band,
      current: slot?.jobId ? `Job ${Math.round((slot.progress ?? 0) * 100)}% · ${formatMult(speed)}` : 'No job queued',
      next: assigned >= cap.hard ? 'At hard cap' : 'More drones shorten this job',
    }
  }

  if (jobId === 'sensor-net') {
    const rate = (station?.rates.data ?? 0.045) * assigned
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Sensor Net +${rate.toFixed(2)}/s` : 'Sensor Net idle',
      next: `+1 → +${((station?.rates.data ?? 0.045) * (assigned + 1)).toFixed(2)}/s`,
    }
  }

  if (jobId === 'drone-fab') {
    const bonus = station?.manufactureBonusPerDrone ?? 0.35
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Drone build ${formatMult(1 + bonus * assigned)}` : 'Needs a Fabricator',
      next: `+1 → ${formatMult(1 + bonus * (assigned + 1))}`,
    }
  }

  return {
    jobId,
    title,
    assigned,
    band,
    current: assigned > 0 ? `${assigned} assigned` : 'Unassigned',
    next: `Cap ${cap.hard}`,
  }
}
