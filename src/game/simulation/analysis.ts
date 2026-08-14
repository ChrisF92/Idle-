import type { CoreSpendingSummary, ProgressionWall, SectorRecord, SimulationWarning } from './types'
import { median } from './format'

export function detectWalls(sectors: SectorRecord[]): ProgressionWall[] {
  const cleared = sectors
    .filter((s) => s.clearDuration != null && s.clearDuration > 0)
    .sort((a, b) => a.sector - b.sector)
  const walls: ProgressionWall[] = []
  for (let i = 0; i < cleared.length; i++) {
    const row = cleared[i]!
    const window = cleared.slice(Math.max(0, i - 5), i).map((s) => s.clearDuration!)
    if (window.length < 3) continue
    const med = median(window)
    if (!med || med <= 0) continue
    const ratio = row.clearDuration! / med
    if (ratio < 2.2) continue
    walls.push({
      sector: row.sector,
      clearSeconds: row.clearDuration!,
      recentMedian: med,
      ratio,
      likelyConstraint: likelyConstraint(row, ratio),
      detail: `Clear ${row.clearDuration!.toFixed(0)}s vs recent median ${med.toFixed(0)}s (${ratio.toFixed(1)}×). Deaths ${row.deaths}.`,
    })
  }
  return walls
}

function likelyConstraint(row: SectorRecord, ratio: number): string {
  if (row.deaths >= 3) return 'Survivability'
  if ((row.plateLevelOnClear ?? 0) === 0 && row.deaths > 0) return 'Survivability'
  if ((row.pulseLevelOnClear ?? 0) <= 1 && ratio >= 3) return 'Damage'
  if (row.salvageEarned < 5 && ratio >= 2.5) return 'Salvage shortage'
  if (row.holdSeconds > (row.clearDuration ?? 0) * 0.5) return 'Hold / farm inefficiency'
  if (ratio >= 3.5) return 'Damage'
  return 'Progression speed'
}

export function coreWarnings(spending: CoreSpendingSummary[]): SimulationWarning[] {
  const out: SimulationWarning[] = []
  const pulse = spending.find((s) => s.moduleId === 'pulse-cannon')
  const plate = spending.find((s) => s.moduleId === 'plate-layer')
  const total = spending.reduce((s, r) => s + r.salvageSpent, 0)
  if (total <= 0) return out
  if (pulse && pulse.share >= 0.85 && (plate?.share ?? 0) < 0.1) {
    out.push({
      severity: 'warning',
      message: `Pulse received ${(pulse.share * 100).toFixed(0)}% of Core salvage; Plate is nearly unused.`,
    })
  }
  if (plate && plate.share >= 0.85) {
    out.push({
      severity: 'warning',
      message: `Plate received ${(plate.share * 100).toFixed(0)}% of Core salvage; damage may be starved.`,
    })
  }
  if (plate && plate.levelsPurchased === 0 && pulse && pulse.levelsPurchased >= 8) {
    out.push({
      severity: 'warning',
      message: 'Plate was never upgraded while Pulse climbed several ranks.',
    })
  }
  return out
}

export function networkWarnings(
  idleLong: boolean,
  drones: number,
  strike: number,
  ward: number,
): SimulationWarning[] {
  const out: SimulationWarning[] = []
  if (idleLong) {
    out.push({ severity: 'warning', message: 'Drones sat idle for long stretches.' })
  }
  if (drones >= 4 && strike === 0) {
    out.push({ severity: 'warning', message: 'Strike stayed at level 0 despite having a corps.' })
  }
  if (drones >= 4 && ward === 0) {
    out.push({
      severity: 'info',
      message: 'Ward stayed at level 0 — shield scaling may be coming only from Plate.',
    })
  }
  return out
}
