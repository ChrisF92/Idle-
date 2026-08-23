/** Worker assignment consequences for Systems / Network UI. Does not import yard. */

import { STATIONS } from './catalog'
import { FOUNDRY_RECIPES, foundryCraftSpeed, foundryCraftTime } from './foundry'
import { networkManufactureMult } from './network'
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
  const band = `Efficient ${cap.min}–${cap.efficient}`
  const speed = networkManufactureMult(state)

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
    return {
      jobId,
      title: 'Foundry Processing',
      assigned,
      band,
      current: `Current speed ${formatMult(speed)}`,
      next: assigned >= cap.hard ? 'At hard cap' : 'More drones raise Processing speed',
    }
  }

  if (jobId === 'fab-bay' || jobId === 'construction') {
    const slot = state.foundry?.slots?.find((row) => row.recipeId)
    const recipe = slot?.recipeId ? FOUNDRY_RECIPES.find((row) => row.id === slot.recipeId) : null
    const total = slot?.recipeId ? foundryCraftTime(state, slot.recipeId) / Math.max(0.05, foundryCraftSpeed(state)) : 0
    const remain = slot ? total * (1 - (slot.progress ?? 0)) : 0
    const slower = slot ? total * 1.25 * (1 - (slot.progress ?? 0)) : 0
    return {
      jobId,
      title: jobId === 'fab-bay' ? 'Fabrication' : 'Construction',
      assigned,
      band,
      current: recipe ? `${recipe.name} ${formatSeconds(remain)}` : 'No job queued',
      next: recipe ? `${formatSeconds(slower)} without these drones` : 'Assign before the next print',
    }
  }

  if (jobId === 'sensor-net') {
    const rate = (station?.rates.data ?? 0.045) * assigned
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Research +${rate.toFixed(2)}/s` : 'Research idle',
      next: `+1 → +${((station?.rates.data ?? 0.045) * (assigned + 1)).toFixed(2)}/s`,
    }
  }

  if (jobId === 'repair-bay') {
    const per = station?.repairPerDrone ?? 1.2
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Dock repair +${(per * assigned).toFixed(1)}/s` : 'No extra repair',
      next: `+1 → +${(per * (assigned + 1)).toFixed(1)}/s`,
    }
  }

  if (jobId === 'drone-fab') {
    const bonus = station?.manufactureBonusPerDrone ?? 0.35
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Drone build ${formatMult(1 + bonus * assigned)}` : 'Standard drone build',
      next: `+1 → ${formatMult(1 + bonus * (assigned + 1))}`,
    }
  }

  if (jobId === 'power-grid') {
    const rate = (station?.rates.energy ?? 0.16) * assigned
    return {
      jobId,
      title,
      assigned,
      band,
      current: assigned > 0 ? `Energy +${rate.toFixed(2)}/s` : 'Energy idle',
      next: `+1 → +${((station?.rates.energy ?? 0.16) * (assigned + 1)).toFixed(2)}/s`,
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
