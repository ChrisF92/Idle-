import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACT1_TARGETS } from './balance/act1'
import { lateCareerConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { formatSummary } from './simulation/report'
import type { SimulationProgress, SimulationStrategyId } from './simulation/types'

function hours(seconds: number | undefined): number {
  return (seconds ?? 0) / 3600
}

function milestoneHours(run: { milestones: Array<{ id: string; activeSeconds: number }> }, id: string): number | null {
  const row = run.milestones.find((m) => m.id === id)
  return row ? hours(row.activeSeconds) : null
}

function careerProgressHooks(label: string) {
  mkdirSync('/tmp/hiveworks-career', { recursive: true })
  const logPath = `/tmp/hiveworks-career/${label}.log`
  writeFileSync(logPath, `start ${label} ${new Date().toISOString()}\n`)
  let lastWave = -1
  let lastHour = -1
  let lastRebuilds = -1
  let lastWrite = 0
  return {
    onProgress: (p: SimulationProgress) => {
      const hour = Math.floor(p.activeSeconds / 3600)
      const now = Date.now()
      if (
        p.highestWave === lastWave &&
        hour === lastHour &&
        p.rebuilds === lastRebuilds &&
        now - lastWrite < 8000
      ) {
        return
      }
      lastWave = p.highestWave
      lastHour = hour
      lastRebuilds = p.rebuilds
      lastWrite = now
      appendFileSync(
        logPath,
        `${hour}h${Math.floor((p.activeSeconds % 3600) / 60)
          .toString()
          .padStart(2, '0')}m  W${p.highestWave}  R${p.rebuilds}  wp=${p.workshopWp} hull=${p.workshopHull} pulse=${p.pulse} fw=${p.furnaceWeapons}  ash=${p.ash.toFixed(0)} heat=${p.heat.toFixed(0)} scrap=${p.scrap.toFixed(0)}\n`,
      )
    },
  }
}

describe('late Act 1 career — Balanced through Research', () => {
  it('reaches Research at W170 without skip-gating and lights Furnace on the way', async () => {
    const report = await runSimulation(
      lateCareerConfig('balanced', { type: 'wave', wave: 170 }, 1),
      careerProgressHooks('balanced-w170'),
    )
    const run = report.runs[0]!
    writeFileSync('/tmp/hiveworks-career/balanced-w170-summary.txt', formatSummary(report))
    // eslint-disable-next-line no-console
    console.log('\n' + formatSummary(report) + '\n')
    expect(run.safety.filter((s) => s.kind === 'nan' || s.kind === 'infinity')).toHaveLength(0)
    expect(run.highestWave).toBeGreaterThanOrEqual(170)
    expect(run.milestones.some((m) => m.id === 'furnace-unlock')).toBe(true)
    expect(run.milestones.some((m) => m.id === 'hive-research-unlock')).toBe(true)
    const ash = run.economy.find((row) => row.id === 'choirAsh')
    expect((ash?.spent ?? 0) + (run.furnace.active.weapons ?? 0)).toBeGreaterThan(0)
    const researchAt = milestoneHours(run, 'hive-research-unlock')
    expect(researchAt).not.toBeNull()
    const window = ACT1_TARGETS.find((t) => t.id === 'hive-research-unlock')!
    expect(researchAt! * 3600).toBeGreaterThanOrEqual(window.min - window.warningPad)
    expect(researchAt! * 3600).toBeLessThanOrEqual(window.max + window.warningPad)
  }, 600_000)
})

const LONG_PROFILES: SimulationStrategyId[] = ['balanced', 'offensive', 'defensive', 'economy-first']

describe('late Act 1 career — four profiles through W300', () => {
  for (const strategy of LONG_PROFILES) {
    it(`${strategy} reaches Choir Crown, completes Act 1, and unlocks Reinforce`, async () => {
      const report = await runSimulation(
        lateCareerConfig(strategy, { type: 'wave', wave: 300 }, 1),
        careerProgressHooks(`${strategy}-w300`),
      )
      const run = report.runs[0]!
      writeFileSync(`/tmp/hiveworks-career/${strategy}-w300-summary.txt`, formatSummary(report))
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
      if (strategy === 'balanced') {
        // Authored 70–100h assumed the W160 Rebuild-spam stall. Healthy Furnace
        // play reaches Choir Crown much earlier; still require a full Act 1, not a skip.
        expect(w300!.activeSeconds).toBeGreaterThanOrEqual(10 * 3600)
        expect(w300!.activeSeconds).toBeLessThanOrEqual(120 * 3600)
      }
    }, 1_800_000)
  }
})
