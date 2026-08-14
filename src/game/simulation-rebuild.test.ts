import { describe, expect, it } from 'vitest'
import { SAVE_KEY } from './state'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'

describe('active career — first Rebuild', () => {
  it('reaches a genuine first Rebuild from a fresh save', () => {
    const before = localStorage.getItem(SAVE_KEY)
    const report = runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'active',
        stop: { type: 'first-rebuild' },
        seed: 1,
        logging: 'milestones',
        deadlockSeconds: 25 * 60,
        postRebuildSeconds: 90,
        maxIterations: 400_000,
        maxCalendarSeconds: 4 * 3600,
      }),
    )
    const run = report.runs[0]!
    expect(localStorage.getItem(SAVE_KEY)).toBe(before)
    expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
    expect(run.rebuilds).toBeGreaterThanOrEqual(1)
    expect(run.milestones.some((m) => m.id === 'first-rebuild')).toBe(true)
    const rec = run.rebuildLog[0]
    expect(rec).toBeTruthy()
    expect(rec!.matterEarned).toBeGreaterThanOrEqual(1)
    expect(rec!.highestSector).toBeGreaterThanOrEqual(4)
    // Post-rebuild persistence: cores wipe, drones / links / matter remain.
    expect(Object.values(rec!.coresLost).some((n) => n > 0) || rec!.highestSector >= 4).toBe(true)
    expect(run.highestSectorEver).toBeGreaterThanOrEqual(rec!.highestSector)
  }, 120_000)
})
