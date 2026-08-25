import { describe, expect, it } from 'vitest'
import { ACT1_TARGETS } from './balance/act1'
import { lateCareerConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { formatSummary } from './simulation/report'
import type { SimulationStrategyId } from './simulation/types'

function hours(seconds: number | undefined): number {
  return (seconds ?? 0) / 3600
}

function milestoneHours(run: { milestones: Array<{ id: string; activeSeconds: number }> }, id: string): number | null {
  const row = run.milestones.find((m) => m.id === id)
  return row ? hours(row.activeSeconds) : null
}

describe('late Act 1 career — Balanced through Research', () => {
  it('reaches Research at W170 without skip-gating and lights Furnace on the way', async () => {
    const report = await runSimulation(lateCareerConfig('balanced', { type: 'wave', wave: 170 }, 1))
    const run = report.runs[0]!
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
    expect(run.highestWave).toBeGreaterThanOrEqual(170)
    expect(run.milestones.some((m) => m.id === 'furnace-unlock')).toBe(true)
    expect(run.milestones.some((m) => m.id === 'hive-research-unlock')).toBe(true)
    expect(run.furnace.wanted.weapons ?? run.furnace.active.weapons).toBeGreaterThan(0)
    const researchAt = milestoneHours(run, 'hive-research-unlock')
    expect(researchAt).not.toBeNull()
    const window = ACT1_TARGETS.find((t) => t.id === 'hive-research-unlock')!
    expect(researchAt! * 3600).toBeGreaterThanOrEqual(window.min - window.warningPad)
    expect(researchAt! * 3600).toBeLessThanOrEqual(window.max + window.warningPad)
  }, 180_000)
})

const LONG_PROFILES: SimulationStrategyId[] = ['balanced', 'offensive', 'defensive', 'economy-first']

describe('late Act 1 career — four profiles through W300', () => {
  for (const strategy of LONG_PROFILES) {
    it(`${strategy} reaches Choir Crown, completes Act 1, and unlocks Reinforce`, async () => {
      const report = await runSimulation(lateCareerConfig(strategy, { type: 'wave', wave: 300 }, 1))
      const run = report.runs[0]!
      // eslint-disable-next-line no-console
      console.log(`\n===== ${strategy} W300 =====\n` + formatSummary(report) + '\n')
      expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
      expect(run.highestWave).toBeGreaterThanOrEqual(300)
      expect(run.act1Cleared).toBe(true)
      expect(run.milestones.some((m) => m.id === 'hive-research-unlock')).toBe(true)
      expect(run.milestones.some((m) => m.id === 'first-hive-research-node' || m.id === 'first-research-bt')).toBe(
        true,
      )
      expect(run.milestones.some((m) => m.id === 'process-unlock')).toBe(true)
      expect(run.process.purchased.length).toBeGreaterThan(0)
      expect(run.milestones.some((m) => m.id === 'unlock-protocols')).toBe(true)
      expect(run.rebuilds).toBeGreaterThanOrEqual(2)
      const w300 = run.milestones.find((m) => m.id === 'wave-300')
      expect(w300).toBeTruthy()
      const window = ACT1_TARGETS.find((t) => t.id === 'w300')!
      if (strategy === 'balanced') {
        expect(w300!.activeSeconds).toBeGreaterThanOrEqual(window.min - window.warningPad)
        expect(w300!.activeSeconds).toBeLessThanOrEqual(window.max + window.warningPad)
      }
    }, 600_000)
  }
})
