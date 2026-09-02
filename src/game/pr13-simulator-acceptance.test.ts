import { describe, expect, it } from 'vitest'
import { ACT1_TARGETS } from './balance/act1'
import { ACT1_CADENCE } from './cadence'
import { canStartFabrication } from './foundry'
import { createInitialState } from './state'
import { aggregateTenWaveBands } from './simulation/analysis'
import { tendFoundry } from './simulation/actions'
import {
  captureObservePrev,
  createMetrics,
  economyBuckets,
  observeState,
  recordResourceEarn,
  recordResourceSpend,
  syncResourceBalances,
} from './simulation/metrics'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import type { SectorRecord } from './simulation/types'
import { createWavePackage } from './waveRuntime'
import { atCareerWave } from './testHelpers'
import type { StrategyContext } from './simulation/types'

function sector(wave: number, securedAt: number | null): SectorRecord {
  return {
    sector: wave,
    firstEntryActive: Math.max(0, (securedAt ?? 0) - 5),
    firstClearActive: securedAt,
    clearDuration: securedAt == null ? null : 5,
    deaths: 0,
    relaunches: 0,
    salvageEarned: 1,
    holdSeconds: 0,
    pulseLevelOnClear: securedAt == null ? null : 1,
    plateLevelOnClear: securedAt == null ? null : 1,
    bossClearSeconds: null,
  }
}

describe('PR13 simulator acceptance corrections', () => {
  it('does not replace an in-progress Foundry cycle on each decision tick', () => {
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    state.resources.scrap = 100
    const events: string[] = []
    const ctx = {
      config: defaultSimulationConfig({
        strategy: 'balanced',
        stop: { type: 'active-duration', seconds: 1 },
      }),
      activeSeconds: 0,
      calendarSeconds: 0,
      offlineSeconds: 0,
      secondsSinceHighestSectorGain: 0,
      secondsSinceMeaningfulAction: 0,
      recentSectorClearMedian: null,
      lastRebuildActive: null,
      previousHighestAtRebuild: 0,
      deathsThisSector: 0,
      relaunches: 0,
      logging: 'detailed',
      rng: () => 0.5,
      record: (event: string) => events.push(event),
      recordMeaningful: () => undefined,
      recordCorePurchase: () => undefined,
      recordRebuild: () => undefined,
      attachRebuildPurchase: () => undefined,
      noteLimitation: () => undefined,
    } satisfies StrategyContext
    const started = tendFoundry(state, ctx)
    const starts = events.length
    expect(started.foundry.slots.some((slot) => slot.recipeId != null)).toBe(true)
    const unchanged = tendFoundry(started, ctx)
    expect(unchanged).toBe(started)
    expect(events).toHaveLength(starts)
  })

  it('records Wave milestones and Boss TTK only when the package is secured', () => {
    const state = createInitialState(0)
    state.combat.wave = 50
    state.combat.waveReached = 50
    state.combat.bestWave = 50
    state.meta.bestWave = 50
    state.combat.packages = [createWavePackage(state, 50, 'boss', 1)]
    const metrics = createMetrics(createInitialState(0))

    observeState(metrics, state, captureObservePrev(state), 100, 100, 1)
    expect(metrics.milestones.some((row) => row.id === 'wave-50')).toBe(false)
    expect(metrics.closedBossDurations).toHaveLength(0)

    const prev = captureObservePrev(state)
    state.combat.packages[0]!.secured = true
    state.combat.packages[0]!.rewardPaid = true
    state.combat.encounterTelemetry!.bossEncounterDuration = 42
    observeState(metrics, state, prev, 142, 142, 1)

    expect(metrics.milestones.find((row) => row.id === 'wave-50')?.activeSeconds).toBe(142)
    expect(metrics.closedBossDurations).toEqual([{ wave: 50, seconds: 42 }])
  })

  it('aggregates ten-Wave bands as cumulative career elapsed time', () => {
    const rows = Array.from({ length: 20 }, (_, index) => {
      const wave = index + 1
      const securedAt = wave === 10 ? 100 : wave === 20 ? 400 : wave * 5
      return sector(wave, securedAt)
    })
    const bands = aggregateTenWaveBands(rows)
    expect(bands.map((row) => row.clearDuration)).toEqual([100, 300])
    expect(bands.map((row) => row.firstClearActive)).toEqual([100, 400])
  })

  it('reports gross Rebuild Matter earnings and spending instead of net wallet deltas', () => {
    const state = createInitialState(0)
    const metrics = createMetrics(state)
    recordResourceEarn(metrics, 'prestigeMatter', 20)
    state.resources.prestigeMatter = 20
    syncResourceBalances(metrics, state, false)
    recordResourceSpend(metrics, 'prestigeMatter', 16, 'permanent')
    state.resources.prestigeMatter = 4
    syncResourceBalances(metrics, state, false)

    expect(economyBuckets(state, metrics).find((row) => row.id === 'prestigeMatter')).toMatchObject({
      earned: 20,
      spent: 16,
      ending: 4,
    })
  })

  it('uses canonical phase doors and time windows', () => {
    expect(ACT1_CADENCE.workers).toBe(110)
    const workers = ACT1_TARGETS.find((row) => row.id === 'workers-unlock')!
    const relics = ACT1_TARGETS.find((row) => row.id === 'reliquary-unlock')!
    const process = ACT1_TARGETS.find((row) => row.id === 'process-unlock')!
    expect([workers.min / 3600, workers.max / 3600]).toEqual([2, 5])
    expect([relics.min / 3600, relics.max / 3600]).toEqual([14, 22])
    expect([process.min / 3600, process.max / 3600]).toEqual([48, 70])
  })

  it('keeps Worker fabrication unavailable before the W110 door', () => {
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    state.foundry.facilities = ['worker-fabricator']
    state.resources.scrap = 100
    state.foundry.materials['recovered-stock'] = 40
    state.foundry.materials['conductive-filament'] = 20
    expect(canStartFabrication(state, 'worker', 'worker')).toMatchObject({
      ok: false,
      reason: `Reach Wave ${ACT1_CADENCE.workers}`,
    })
  })

  it('does not stop a Wave run until the target Wave is secured', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        start: { type: 'fresh' },
        strategy: 'balanced',
        stop: { type: 'wave', wave: 10 },
        seed: 1,
        logging: 'summary',
        maxIterations: 80_000,
        maxCalendarSeconds: 60 * 60,
      }),
    )
    const run = report.runs[0]!
    expect(run.stopReason).toBe('Secured Wave 10')
    expect(run.highestWaveSecured).toBeGreaterThanOrEqual(10)
    expect(run.milestones.find((row) => row.id === 'wave-10')).toBeTruthy()
  }, 40_000)
})
