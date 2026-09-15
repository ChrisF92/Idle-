import { describe, expect, it } from 'vitest'
import { ACT1_TARGETS } from './balance/act1'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { tendFoundry } from './simulation/actions'
import { aggregateTargetResults, simulationBatchSummary } from './simulation/report'
import { defaultSimulationConfig } from './simulation/presets'
import { runSimulation } from './simulation/runner'
import { closeSession, openSession } from './simulation/strategies'
import { ordinarySpawnPlan } from './spawnDirector'
import type { StrategyContext } from './simulation/types'
import { setDocked } from './tick'

function context(): StrategyContext {
  return {
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
    logging: 'summary',
    rng: () => 0.5,
    record: () => undefined,
    recordMeaningful: () => undefined,
    recordCorePurchase: () => undefined,
    recordRebuild: () => undefined,
    attachRebuildPurchase: () => undefined,
    noteLimitation: () => undefined,
  }
}

describe('PR24 balance correction', () => {
  it('resumes an in-progress Sortie when a Casual session reopens', () => {
    const launched = setDocked(createInitialState(0), false)
    const closed = closeSession(launched)
    expect(closed.combat.sortiePaused).toBe(true)
    const reopened = openSession(closed)
    expect(reopened.combat.docked).toBe(false)
    expect(reopened.combat.sortiePaused).toBe(false)
  })

  it('keeps the Worker fabrication input chain stocked after its facility is committed', () => {
    const state = atCareerWave(createInitialState(0), 110)
    state.foundry.facilities = ['worker-fabricator']
    state.resources.scrap = 1_000
    const next = tendFoundry(state, context())
    expect(next.foundry.slots[0]?.recipeId).toBe('conductive-filament')
  })

  it('grades multi-run target medians and reports batch completion', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        strategy: 'balanced',
        stop: { type: 'wave', wave: 10 },
        runs: 2,
        seed: 1,
        logging: 'summary',
        maxCalendarSeconds: 30 * 60,
        maxIterations: 100_000,
      }),
    )
    expect(simulationBatchSummary(report)).toMatchObject({ total: 2, completed: 2, deadlocked: 0 })
    expect(aggregateTargetResults(report).find((row) => row.id === 'first-wave')?.simulatedLabel)
      .toMatch(/^median /)
  })

  it('keeps the canonical early-career target definitions authoritative', () => {
    const target = (id: string) => ACT1_TARGETS.find((row) => row.id === id)!
    expect([target('wave-100').min, target('wave-100').max]).toEqual([2 * 3600, 4 * 3600])
    expect([target('wave-200').min, target('wave-200').max]).toEqual([6 * 3600, 10 * 3600])
    expect([target('first-rebuild').min, target('first-rebuild').max]).toEqual([6 * 3600, 12 * 3600])
  })

  it('uses a stable two-contact tutorial before the first Commander', () => {
    for (const wave of [2, 4, 9]) {
      expect(ordinarySpawnPlan({ wave, sortieSeed: 1, packageOrdinal: wave }).defs).toHaveLength(2)
      expect(ordinarySpawnPlan({ wave, sortieSeed: 999, packageOrdinal: wave }).defs).toHaveLength(2)
    }
  })

  it('keeps first defeat inside the authored opening across deterministic seeds', async () => {
    const report = await runSimulation(
      defaultSimulationConfig({
        strategy: 'balanced',
        stop: { type: 'active-duration', seconds: 6 * 60 },
        runs: 10,
        seed: 1,
        logging: 'summary',
        deadlockSeconds: 10 * 60,
        maxCalendarSeconds: 10 * 60,
        maxIterations: 200_000,
      }),
    )
    expect(report.runs).toHaveLength(10)
    for (const run of report.runs) {
      const firstDefeat = run.milestones.find((row) => row.id === 'first-defeat')?.activeSeconds
      expect(firstDefeat).toBeGreaterThanOrEqual(3 * 60)
      expect(firstDefeat).toBeLessThanOrEqual(5 * 60)
    }
  }, 120_000)
})
