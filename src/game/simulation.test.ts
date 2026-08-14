import { afterEach, describe, expect, it } from 'vitest'
import { createInitialState, SAVE_KEY } from './state'
import { applyOfflineCatchUp } from './offline'
import { advanceSeconds, setDocked } from './tick'
import { assignWorker } from './actions'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { isolateGameState } from './simulation/clone'
import { inspectNumericSafety } from './simulation/safety'
import type { GameState } from './types'

function idleConfig(seconds: number, start?: GameState) {
  return defaultSimulationConfig({
    start: start ? { type: 'state', state: start } : { type: 'fresh' },
    strategy: 'idle',
    stop: { type: 'active-duration', seconds },
    seed: 7,
    decisionIntervalSeconds: 1,
    deadlockSeconds: 600,
    maxIterations: 50_000,
  })
}

describe('career simulator', () => {
  afterEach(() => {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem('hiveworks-sim-history')
  })

  it('isolates supplied state and never writes the live save key', () => {
    localStorage.setItem(SAVE_KEY, '{"guard":true}')
    const live = createInitialState(0)
    live.resources.salvage = 77
    live.combat.sector = 3
    const beforeSave = localStorage.getItem(SAVE_KEY)
    const report = runSimulation(idleConfig(4, live))
    expect(live.resources.salvage).toBe(77)
    expect(live.combat.sector).toBe(3)
    expect(live.combat.docked).toBe(true)
    expect(localStorage.getItem(SAVE_KEY)).toBe(beforeSave)
    expect(report.runs[0]?.activeSeconds).toBeGreaterThan(0)
  })

  it('can begin from createInitialState', () => {
    const report = runSimulation(idleConfig(3))
    expect(report.runs[0]?.config.startType).toBe('Fresh')
    expect(report.runs[0]?.highestSector).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic for the same config and seed', () => {
    const a = runSimulation(idleConfig(8))
    const b = runSimulation(idleConfig(8))
    expect(a.runs[0]?.activeSeconds).toBe(b.runs[0]?.activeSeconds)
    expect(a.runs[0]?.highestSector).toBe(b.runs[0]?.highestSector)
    expect(a.runs[0]?.economy.map((e) => e.ending)).toEqual(b.runs[0]?.economy.map((e) => e.ending))
  })

  it('Accurate idle path matches advanceSeconds for a short launched fight', () => {
    let real = createInitialState(0)
    real = setDocked(real, false)
    const simStart = isolateGameState(real)
    advanceSeconds(real, 20)
    const report = runSimulation(idleConfig(20, simStart))
    const sim = report.runs[0]!
    expect(sim.stopReason).toMatch(/Active duration/i)
    expect(real.combat.sector).toBeGreaterThanOrEqual(1)
    expect(sim.highestSector).toBe(real.combat.highestSector)
    expect(real.resources.salvage).toBeCloseTo(
      sim.economy.find((e) => e.id === 'salvage')?.ending ?? real.resources.salvage,
      5,
    )
    expect(real.combat.wave).toBeGreaterThanOrEqual(1)
  })

  it('Casual offline periods use applyOfflineCatchUp rather than long advanceSeconds', () => {
    let seed = createInitialState(0)
    seed = assignWorker(seed, 'strike', 2)
    seed = assignWorker(seed, 'ward', 2)
    seed.combat.docked = true
    const control = isolateGameState(seed)
    control.lastTickAt = 0
    const offline = applyOfflineCatchUp(control, 60 * 60 * 1000)
    const report = runSimulation(
      defaultSimulationConfig({
        start: { type: 'state', state: seed },
        strategy: 'casual',
        stop: { type: 'duration', calendarSeconds: 60 * 60 + 2 },
        seed: 3,
        session: { activeSeconds: 1, offlineSeconds: 60 * 60 },
        decisionIntervalSeconds: 1,
        deadlockSeconds: 1200,
        maxIterations: 20_000,
      }),
    )
    const run = report.runs[0]!
    expect(run.offlineSeconds).toBeGreaterThan(50 * 60)
    expect(run.highestSector).toBeLessThan(5)
    expect(offline.state.combat.highestSector).toBe(control.combat.highestSector)
    // Offline catch-up does not simulate fights, so sector should not explode.
    expect(run.highestSector).toBeLessThanOrEqual(offline.state.combat.highestSector + 1)
  })

  it('detects NaN in isolated state', () => {
    const state = createInitialState(0)
    state.resources.salvage = Number.NaN
    const flags = inspectNumericSafety(state, 0)
    expect(flags.some((f) => f.kind === 'nan')).toBe(true)
  })

  it('cancellation stops without writing the live save', () => {
    localStorage.setItem(SAVE_KEY, '{"guard":true}')
    let calls = 0
    const report = runSimulation(idleConfig(500), {
      shouldCancel: () => {
        calls += 1
        return calls > 3
      },
    })
    expect(report.runs[0]?.cancelled).toBe(true)
    expect(report.runs[0]?.stopReason).toMatch(/cancel/i)
    expect(localStorage.getItem(SAVE_KEY)).toBe('{"guard":true}')
  })
})
