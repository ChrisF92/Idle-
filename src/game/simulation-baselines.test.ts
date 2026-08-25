import { describe, expect, it } from 'vitest'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { formatSummary } from './simulation/report'

const runBaselines = process.env.RUN_SIM_BASELINES === '1'

describe.skipIf(!runBaselines)('baseline career simulations (reporting only)', () => {
  it('TEST 1 Fresh Active → First Rebuild', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'active',
        stop: { type: 'first-rebuild' },
        seed: 1,
        logging: 'milestones',
        postRebuildSeconds: 120,
        deadlockSeconds: 25 * 60,
        maxIterations: 400_000,
        maxCalendarSeconds: 4 * 3600,
      }),
    )
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(report.runs[0]?.rebuilds).toBeGreaterThanOrEqual(1)
  }, 120_000)

  it('TEST 2 Fresh Active → Sector 30', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'active',
        stop: { type: 'sector', sector: 30 },
        seed: 1,
        logging: 'milestones',
        deadlockSeconds: 90 * 60,
        maxIterations: 2_000_000,
        maxCalendarSeconds: 12 * 3600,
      }),
    )
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(report.runs[0]?.safety.some((s) => s.kind === 'nan')).toBe(false)
  }, 180_000)

  it('TEST 3 Casual 7 Days', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'casual',
        stop: { type: 'duration', calendarSeconds: 7 * 24 * 3600 },
        seed: 1,
        logging: 'milestones',
        session: { activeSeconds: 10 * 60, offlineSeconds: 4 * 60 * 60 },
        deadlockSeconds: 90 * 60,
        maxIterations: 2_000_000,
        maxCalendarSeconds: 8 * 24 * 3600,
      }),
    )
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(report.runs[0]?.calendarSeconds).toBeGreaterThan(6 * 24 * 3600)
  }, 180_000)

  it('TEST 4 Long Safety Run', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'active',
        stop: { type: 'safety' },
        seed: 1,
        logging: 'summary',
        deadlockSeconds: 90 * 60,
        maxIterations: 1_500_000,
        maxCalendarSeconds: 6 * 3600,
      }),
    )
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(report.runs[0]?.safety.some((s) => s.kind === 'nan' || s.kind === 'infinity')).toBe(false)
  }, 180_000)
})
