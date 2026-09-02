import { describe, expect, it } from 'vitest'
import * as catalog from './catalog'
import { globalDamageMultiplier, createInitialState } from './state'
import {
  captureObservePrev,
  createMetrics,
  observeState,
  recordRebuildRow,
  TRACKED_WAVES,
} from './simulation/metrics'
import { defaultSimulationConfig } from './simulation/presets'
import { formatSummary } from './simulation/report'
import { runSimulation } from './simulation/runner'
import { tendChallenges, tendFurnace, tendHiveResearch, tendProfileFabrication } from './simulation/actions'
import type { StrategyContext } from './simulation/types'
import { createWavePackage } from './waveRuntime'

function context(buildProfile: StrategyContext['config']['buildProfile']): StrategyContext {
  return {
    config: defaultSimulationConfig({
      strategy: 'balanced',
      buildProfile,
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
    logging: 'milestones',
    rng: () => 0.5,
    record: () => undefined,
    recordMeaningful: () => undefined,
    recordCorePurchase: () => undefined,
    recordRebuild: () => undefined,
    attachRebuildPurchase: () => undefined,
    noteLimitation: () => undefined,
  }
}

describe('PR12 simulator integrity', () => {
  it('tracks canonical Wave milestones without a hidden ×10 conversion', () => {
    const state = createInitialState(0)
    const metrics = createMetrics(state)
    const prev = captureObservePrev(state)
    state.meta.bestWave = 100
    state.combat.bestWave = 100
    state.combat.wave = 101
    const package100 = createWavePackage(state, 100, 'boss', 1)
    package100.secured = true
    package100.rewardPaid = true
    state.combat.packages.push(package100)
    state.combat.encounterTelemetry.bossEncounterDuration = 42
    observeState(metrics, state, prev, 120, 120, 1)

    expect(TRACKED_WAVES).toContain(1000)
    expect(metrics.milestones.some((row) => row.id === 'wave-100')).toBe(true)
    expect(metrics.milestones.some((row) => row.id === 'wave-1000')).toBe(false)
    expect(metrics.sectors.get(100)?.clearDuration).toBeGreaterThan(0)
    expect(metrics.sectors.get(100)?.bossClearSeconds).toBe(42)
  })

  it('does not mark a Rebuild repush from the permanent career best', () => {
    const state = createInitialState(0)
    state.meta.bestWave = 210
    state.combat.bestWave = 210
    state.prestige.prestigeCount = 1
    state.prestige.cycle.bestWave = 0
    const metrics = createMetrics(state)
    recordRebuildRow(metrics, {
      index: 1,
      activeSeconds: 100,
      calendarSeconds: 100,
      highestSector: 210,
      matterEarned: 16,
      matterBalanceAfter: 16,
      reasons: ['fixture'],
      coresLost: {},
      workshopLost: {},
      networkLevelsLost: {},
      linksKept: {},
      permanentPurchases: [],
      previousPushSeconds: 100,
      repushSeconds: null,
      repushRatio: null,
      newHighestAfter: null,
    })
    let prev = captureObservePrev(state)
    observeState(metrics, state, prev, 101, 101, 1)
    expect(metrics.rebuildLog[0]?.repushSeconds).toBeNull()

    prev = captureObservePrev(state)
    state.prestige.cycle.bestWave = 210
    observeState(metrics, state, prev, 140, 140, 1)
    expect(metrics.rebuildLog[0]?.repushSeconds).toBe(40)
  })

  it('does not grant damage or production merely for repeating Rebuilds', () => {
    const base = createInitialState(0)
    const repeated = structuredClone(base)
    repeated.prestige.prestigeCount = 77
    expect(globalDamageMultiplier(repeated)).toBe(globalDamageMultiplier(base))
    expect('prestigeMomentumDamageBonus' in catalog).toBe(false)
    expect('prestigeMomentumProductionBonus' in catalog).toBe(false)
  })

  it('operates Furnace and all four Research branches for a selected profile', () => {
    const furnace = createInitialState(0)
    furnace.meta.bestWave = 450
    furnace.combat.bestWave = 450
    furnace.combat.docked = false
    furnace.combat.inFight = true
    furnace.resources.choirAsh = 250
    const lit = tendFurnace(furnace, context('defensive-sustain'))
    expect(lit.furnace.ignited).toBe(true)
    expect(lit.furnace.channels).toMatchObject({ bulwark: 1, guidance: 1 })

    const research = createInitialState(0)
    research.meta.bestWave = 525
    research.combat.bestWave = 525
    research.hiveResearch.completed = { material: 1, energy: 1, observation: 1, computation: 0 }
    const working = tendHiveResearch(research, context('balanced-generalist'), 'balanced')
    expect(working.hiveResearch.focus).toBe('computation')
    expect(working.hiveResearch.active).toBe(true)
  })

  it('queues permanent Worker fabrication instead of leaving the system idle', () => {
    const state = createInitialState(0)
    state.meta.bestWave = 200
    state.combat.bestWave = 200
    state.foundry.facilities.push('worker-fabricator')
    state.foundry.materials['recovered-stock'] = 100
    state.foundry.materials['conductive-filament'] = 100
    state.foundry.materials['tempered-alloy'] = 100
    state.resources.scrap = 1000
    const queued = tendProfileFabrication(state, context('balanced-generalist'))
    expect(queued.foundry.fabrication.some((slot) => slot.kind === 'worker')).toBe(true)
  })

  it('enters only Challenges that unlock the selected profile', () => {
    const state = createInitialState(0)
    state.meta.bestWave = 600
    state.combat.bestWave = 600
    const challenged = tendChallenges(state, context('swarm-control'))
    expect(challenged.challenges.activeId).toBe('knife-fight')
    expect(challenged.combat.docked).toBe(true)

    const generalist = tendChallenges(state, context('balanced-generalist'))
    expect(generalist.challenges.activeId).toBeNull()
  })

  it('prints every target result, including targets not reached by a short run', async () => {
    const report = await runSimulation(defaultSimulationConfig({
      strategy: 'idle',
      stop: { type: 'active-duration', seconds: 2 },
      maxIterations: 100,
    }))
    const text = formatSummary(report)
    expect(text).toMatch(/\[SKIP\] Wave 1000/)
    expect(text).toMatch(/BUILD PROFILE EXECUTION/)
    expect(text).toMatch(/COMBAT TELEMETRY/)
  })
})
