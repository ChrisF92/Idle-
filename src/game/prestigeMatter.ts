/**
 * Prestige Matter curve for Expeditions.
 * Piecewise-linear interpolation between milestone waves.
 */

export interface PrestigeMatterMilestone {
  wave: number
  basePm: number
}

/** Provisional Sector 1 milestones (base PM before Extraction bonus). */
export const PM_MILESTONES: readonly PrestigeMatterMilestone[] = [
  { wave: 1, basePm: 0 },
  { wave: 20, basePm: 1 },
  { wave: 25, basePm: 2 },
  { wave: 30, basePm: 3 },
  { wave: 40, basePm: 6 },
  { wave: 50, basePm: 10 },
  { wave: 60, basePm: 16 },
  { wave: 75, basePm: 25 },
  { wave: 90, basePm: 40 },
  { wave: 100, basePm: 50 },
  { wave: 125, basePm: 75 },
  { wave: 150, basePm: 105 },
  { wave: 200, basePm: 165 },
] as const

/** Career wave at which Prestige / Extraction unlocks. */
export const PRESTIGE_UNLOCK_WAVE = 20

/** Extraction awards base PM × this multiplier. */
export const EXTRACTION_BONUS = 1.05

/** Checkpoint-skipped waves contribute this fraction of normal PM. */
export const CHECKPOINT_PM_FRACTION = 0.5

/**
 * Piecewise-linear base PM for a highest wave reached.
 * Stored at full precision; callers round for award/display.
 */
export function basePrestigeMatterForWave(wave: number): number {
  const w = Math.max(0, wave)
  if (w <= 0) return 0

  const milestones = PM_MILESTONES
  if (w <= milestones[0]!.wave) return milestones[0]!.basePm

  for (let i = 0; i < milestones.length - 1; i += 1) {
    const lower = milestones[i]!
    const upper = milestones[i + 1]!
    if (w <= upper.wave) {
      const span = upper.wave - lower.wave
      if (span <= 0) return upper.basePm
      return (
        lower.basePm +
        ((w - lower.wave) * (upper.basePm - lower.basePm)) / span
      )
    }
  }

  // Beyond the last milestone: continue the final segment slope.
  const last = milestones[milestones.length - 1]!
  const prev = milestones[milestones.length - 2]!
  const slope = (last.basePm - prev.basePm) / (last.wave - prev.wave)
  return last.basePm + (w - last.wave) * slope
}

/**
 * PM contribution with checkpoint discount.
 * Waves at or below checkpointWave get CHECKPOINT_PM_FRACTION credit;
 * waves above get full credit. Extraction bonus applied last by callers.
 */
export function prestigeMatterForRun(opts: {
  bestWave: number
  checkpointWave?: number
}): number {
  const best = Math.max(0, Math.floor(opts.bestWave))
  if (best <= 0) return 0

  const checkpoint = Math.max(0, Math.floor(opts.checkpointWave ?? 1))
  // Start at wave 1 with no checkpoint skip → full curve at best.
  if (checkpoint <= 1) {
    return basePrestigeMatterForWave(best)
  }

  // Skipped portion: waves 1..checkpoint credited at 50%.
  // Played portion: difference between best and checkpoint at 100%.
  const skippedCredit =
    basePrestigeMatterForWave(Math.min(best, checkpoint)) * CHECKPOINT_PM_FRACTION
  const playedCredit =
    best > checkpoint
      ? basePrestigeMatterForWave(best) - basePrestigeMatterForWave(checkpoint)
      : 0
  return skippedCredit + playedCredit
}

export function applyExtractionBonus(basePm: number, extracted: boolean): number {
  return extracted ? basePm * EXTRACTION_BONUS : basePm
}

/** Round for award / display — keep two decimals internally until final award. */
export function roundPrestigeMatter(pm: number): number {
  return Math.round(pm * 100) / 100
}

export function formatPrestigeMatter(pm: number): string {
  const rounded = roundPrestigeMatter(pm)
  return rounded.toFixed(1)
}

export function canExtractOrPrestige(careerBestWave: number): boolean {
  return careerBestWave >= PRESTIGE_UNLOCK_WAVE
}
