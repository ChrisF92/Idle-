import { describe, expect, it } from 'vitest'
import { SAVE_KEY } from './state'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'

describe('career simulator isolation', () => {
  it('does not mutate the browser save during a short fresh simulation', async () => {
    const before = localStorage.getItem(SAVE_KEY)
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'active',
        stop: { type: 'duration', calendarSeconds: 90 },
        seed: 1,
        logging: 'milestones',
        deadlockSeconds: 10 * 60,
        postRebuildSeconds: 0,
        maxIterations: 20_000,
        maxCalendarSeconds: 120,
      }),
    )
    const run = report.runs[0]!
    expect(localStorage.getItem(SAVE_KEY)).toBe(before)
    expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
    expect(run.calendarSeconds).toBeGreaterThan(0)
    expect(run.rebuilds).toBe(0)
    expect(run.highestWave).toBeGreaterThanOrEqual(1)
  }, 30_000)
})
