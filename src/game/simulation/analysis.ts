import type {
  CoreSpendingSummary,
  GddWarningCode,
  MilestoneRecord,
  ProgressionWall,
  RebuildRecord,
  SectorRecord,
  SimulationWarning,
} from './types'
import { median } from './format'

export function aggregateTenWaveBands(sectors: SectorRecord[]): SectorRecord[] {
  const bands = new Map<number, SectorRecord[]>()
  for (const row of sectors) {
    const endWave = Math.ceil(row.sector / 10) * 10
    const current = bands.get(endWave) ?? []
    current.push(row)
    bands.set(endWave, current)
  }

  let previousBandClear = 0
  return [...bands.entries()]
    .sort(([a], [b]) => a - b)
    .map(([endWave, rows]) => {
      const sorted = [...rows].sort((a, b) => a.sector - b.sector)
      const first = sorted[0]!
      const end = sorted.find((row) => row.sector === endWave)
      const endClear = end?.firstClearActive ?? null
      const complete = endClear != null
      const band: SectorRecord = {
        ...first,
        sector: endWave,
        firstEntryActive: Math.min(...sorted.map((row) => row.firstEntryActive)),
        firstClearActive: endClear,
        // Career-band elapsed time, not the sum of one-second wave-security lags.
        clearDuration: complete ? Math.max(0, endClear - previousBandClear) : null,
        deaths: sorted.reduce((sum, row) => sum + row.deaths, 0),
        relaunches: sorted.reduce((sum, row) => sum + row.relaunches, 0),
        salvageEarned: sorted.reduce((sum, row) => sum + row.salvageEarned, 0),
        holdSeconds: sorted.reduce((sum, row) => sum + row.holdSeconds, 0),
        pulseLevelOnClear: end?.pulseLevelOnClear ?? null,
        plateLevelOnClear: end?.plateLevelOnClear ?? null,
        bossClearSeconds: end?.bossClearSeconds ?? null,
      }
      if (complete) previousBandClear = endClear
      return band
    })
}

export function detectWalls(sectors: SectorRecord[]): ProgressionWall[] {
  const cleared = aggregateTenWaveBands(sectors)
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

function warn(
  code: GddWarningCode,
  message: string,
  severity: SimulationWarning['severity'] = 'warning',
): SimulationWarning {
  return { severity, code, message: `[${code}] ${message}` }
}

export function coreWarnings(spending: CoreSpendingSummary[]): SimulationWarning[] {
  const out: SimulationWarning[] = []
  const pulse = spending.find((s) => s.moduleId === 'pulse-cannon')
  const plate = spending.find((s) => s.moduleId === 'plate-layer')
  const total = spending.reduce((s, r) => s + r.salvageSpent, 0)
  if (total <= 0) return out
  if (pulse && pulse.share >= 0.85 && (plate?.share ?? 0) < 0.1) {
    out.push(
      warn(
        'DOMINANT UPGRADE',
        `Pulse received ${(pulse.share * 100).toFixed(0)}% of Core Salvage; Plate is nearly unused.`,
      ),
    )
  }
  if (plate && plate.share >= 0.85) {
    out.push(
      warn(
        'DOMINANT UPGRADE',
        `Plate received ${(plate.share * 100).toFixed(0)}% of Core Salvage; damage may be starved.`,
      ),
    )
  }
  if (plate && plate.levelsPurchased === 0 && pulse && pulse.levelsPurchased >= 8) {
    out.push(warn('DEAD UPGRADE', 'Plate was never upgraded while Pulse climbed several ranks.'))
  }
  return out
}

export function workerWarnings(idleLong: boolean, drones: number): SimulationWarning[] {
  const out: SimulationWarning[] = []
  if (idleLong) {
    out.push({
      severity: 'warning',
      message: 'Worker Drones sat idle for long stretches.',
    })
  }
  if (drones >= 8 && idleLong) {
    out.push(
      warn('SYSTEM IRRELEVANT', 'Workers are unlocked but stayed idle after the corps grew.'),
    )
  }
  return out
}

/** @deprecated Use workerWarnings — leftover Network bars are not a combat lever. */
export function networkWarnings(
  idleLong: boolean,
  drones: number,
  _strike = 0,
  _ward = 0,
): SimulationWarning[] {
  return workerWarnings(idleLong, drones)
}

export interface GddWarningInput {
  walls: ProgressionWall[]
  rebuildLog: RebuildRecord[]
  spending: CoreSpendingSummary[]
  milestones: MilestoneRecord[]
  highestWave: number
  foundryRecipes: number
  workerDrones: number
  furnaceLit: number
  researchBreakthroughs: number
  salvageEarned: number
  salvageSpentOnRunUpgrades: number
  salvageSpentOnCores: number
  scrapEarned: number
  scrapResetLost: number
  scrapAllocation: Array<{ label: string; spent: number; share: number }>
  workshopLevels: Record<string, number>
  failedPushStreak: number
  activeSeconds: number
}

function milestoneAt(milestones: MilestoneRecord[], id: string): number | null {
  return milestones.find((m) => m.id === id)?.activeSeconds ?? null
}

export function detectGddWarnings(input: GddWarningInput): SimulationWarning[] {
  const out: SimulationWarning[] = []
  const firstRebuild = milestoneAt(input.milestones, 'first-rebuild')
  const foundryAt = milestoneAt(input.milestones, 'foundry-unlock')
  const workersAt = milestoneAt(input.milestones, 'workers-unlock')
  const furnaceAt = milestoneAt(input.milestones, 'furnace-unlock')
  const researchAt = milestoneAt(input.milestones, 'hive-research-unlock')
  const hardFromStreak = input.failedPushStreak >= 6
  const hardWall = hardFromStreak
    ? {
        sector: input.highestWave,
        ratio: input.failedPushStreak,
        likelyConstraint: 'Failed push streak',
        detail: `${input.failedPushStreak} meaningful Sorties without a New Best`,
      }
    : null

  if (hardWall) {
    out.push(
      warn(
        'HARD WALL',
        `${input.failedPushStreak} meaningful Sorties without a New Best (hard-wall band is 6–8).`,
        'fail',
      ),
    )
  } else if (input.failedPushStreak >= 4) {
    out.push(warn('WALL', `${input.failedPushStreak} failed push attempts without a New Best.`))
  } else if (input.walls.length > 0) {
    const w = input.walls[0]!
    out.push(
      warn(
        'WALL',
        `Wave ${w.sector} stalled (${w.likelyConstraint}) after several slower pushes.`,
      ),
    )
  } else if (input.rebuildLog.length === 0 && input.activeSeconds >= 25 * 60 && input.highestWave < 70) {
    out.push(warn('WALL', 'Several push Sorties without a New Best toward Rebuild.'))
  }

  const wave100At = milestoneAt(input.milestones, 'wave-100')
  if (firstRebuild != null && firstRebuild < 6 * 60 * 60) {
    out.push(warn('STEAMROLL', 'First Rebuild landed before the authored 6-hour floor.', 'fail'))
  } else if (wave100At != null && wave100At < 2 * 60 * 60) {
    out.push(warn('STEAMROLL', `Wave 100 was secured in ${Math.round(wave100At / 60)} minutes; the authored floor is 2 hours.`, 'fail'))
  }

  if (
    input.activeSeconds >= 15 * 60 &&
    input.salvageEarned >= 40 &&
    input.salvageSpentOnRunUpgrades < input.salvageEarned * 0.15 &&
    input.scrapEarned < 8
  ) {
    out.push(
      warn(
        'ECON TRAP',
        'Salvage piled up while run upgrades and Scrap spends stayed too low for the remaining run.',
      ),
    )
  }

  const dominantScrap = input.scrapAllocation.find((row) =>
    (row.label.includes('infrastructure') || row.label.includes('Foundry'))
      ? row.share >= 0.6
      : row.share >= 0.75,
  )
  if (dominantScrap) {
    out.push(
      warn(
        dominantScrap.label.includes('infrastructure') ? 'SYSTEM DOMINANT' : 'DOMINANT UPGRADE',
        `${dominantScrap.label} consumed ${(dominantScrap.share * 100).toFixed(0)}% of tracked Scrap spending.`,
      ),
    )
  }

  if (input.scrapEarned > 0 && input.scrapResetLost >= input.scrapEarned * 0.2) {
    out.push(
      warn(
        'ECON TRAP',
        `${(100 * input.scrapResetLost / input.scrapEarned).toFixed(0)}% of earned Scrap was erased at Rebuild boundaries.`,
      ),
    )
  }

  const salvageKill =
    input.workshopLevels['salvage-kill'] ??
    input.rebuildLog[0]?.workshopLost?.['salvage-kill'] ??
    0
  const scrapKill =
    input.workshopLevels['scrap-kill'] ?? input.rebuildLog[0]?.workshopLost?.['scrap-kill'] ?? 0
  const weaponPower =
    input.workshopLevels['weapon-power'] ??
    input.rebuildLog[0]?.workshopLost?.['weapon-power'] ??
    0
  if (firstRebuild == null && salvageKill >= 8 && weaponPower <= 1) {
    out.push(
      warn(
        'DOMINANT UPGRADE',
        `Salvage / Kill reached Workshop L${salvageKill} while Weapon Power stayed at L${weaponPower}.`,
      ),
    )
  }
  if (firstRebuild == null && (salvageKill >= 16 || scrapKill >= 12)) {
    out.push(
      warn(
        'DEAD UPGRADE',
        'An economy Workshop rank climbed high enough that remaining cycle time cannot repay it.',
      ),
    )
  }

  if (foundryAt != null && input.foundryRecipes === 0 && input.activeSeconds - foundryAt >= 10 * 60) {
    out.push(warn('SYSTEM IRRELEVANT', 'Foundry stayed unused long after it opened.'))
  }
  if (workersAt != null && input.workerDrones <= 4 && input.highestWave >= 140 && input.activeSeconds - workersAt >= 20 * 60) {
    out.push(warn('SYSTEM IRRELEVANT', 'Worker Drones never grew after the Fabricator door.'))
  }
  if (furnaceAt != null && input.furnaceLit === 0 && input.activeSeconds - furnaceAt >= 10 * 60) {
    out.push(warn('SYSTEM IRRELEVANT', 'Furnace never lit a channel after unlock.'))
  }
  if (
    researchAt != null &&
    input.researchBreakthroughs === 0 &&
    input.activeSeconds - researchAt >= 15 * 60
  ) {
    out.push(warn('SYSTEM IRRELEVANT', 'Research never landed a breakthrough after unlock.'))
  }

  if (input.rebuildLog.some((r) => r.repushRatio != null && r.repushRatio > 0.9)) {
    out.push(warn('REBUILD WEAK', 'A Rebuild barely accelerated the next push (repush ≈ previous push).'))
  } else if (firstRebuild != null && firstRebuild > 12 * 60 * 60) {
    out.push(warn('REBUILD WEAK', 'First Rebuild arrived well after the W210-era pacing window.'))
  }

  const explosive = input.rebuildLog.find(
    (r) =>
      (r.repushRatio != null && r.repushRatio < 0.08 && (r.newHighestAfter ?? 0) > r.highestSector + 8) ||
      (r.previousPushSeconds > 0 && r.previousPushSeconds < 15 * 60 && r.highestSector >= 7),
  )
  if (explosive) {
    out.push(warn('REBUILD EXPLOSIVE', 'Rebuild skipped too much new content on the next push.'))
  }

  return out
}

export function waveForBandIndex(band: number): number {
  return Math.max(0, Math.floor(band)) * 10
}
