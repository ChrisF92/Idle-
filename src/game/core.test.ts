import { describe, expect, it } from 'vitest'
import {
  ballisticsDamageMult,
  coreEffectMultiplier,
  logisticsDropMult,
  logisticsFabMult,
  secondsForNextRank,
} from './core'
import { assignWorker, buyResearch, performPrestige } from './actions'
import { computeShipStats, createInitialState } from './state'
import { advanceSeconds } from './tick'

describe('core attributes', () => {
  it('assigns workers to train-ballistics and time increases rank', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.combat.highestSector = 5
    state.resources.data = 150
    state = buyResearch(state, 'core-training')
    state.base.workerDrones = 4
    state = assignWorker(state, 'train-ballistics', 4)
    expect(state.base.assignments['train-ballistics']).toBe(4)

    const need = secondsForNextRank(0)
    advanceSeconds(state, need / 4 + 0.05)
    expect(state.core.ranks.ballistics).toBeGreaterThanOrEqual(1)
  })

  it('prestige clears core ranks completely but keeps research', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.resources.data = 150
    state = buyResearch(state, 'core-training')
    state.core.ranks.ballistics = 12
    state.core.ranks.logistics = 5
    state.core.progress.ballistics = 0.4
    state.combat.sector = 10
    state = performPrestige(state, 1000)
    expect(state.core.ranks.ballistics).toBe(0)
    expect(state.core.ranks.logistics).toBe(0)
    expect(state.core.progress.ballistics).toBe(0)
    expect(state.research.unlocked).toContain('core-training')
  })

  it('ballistics increases computed damage', () => {
    const bare = createInitialState(0)
    const boosted = createInitialState(0)
    boosted.core.ranks.ballistics = 20
    expect(computeShipStats(boosted).damage).toBeGreaterThan(computeShipStats(bare).damage)
    expect(ballisticsDamageMult(20)).toBeGreaterThan(1)
  })

  it('logistics increases fab speed and drop chance helpers', () => {
    const state = createInitialState(0)
    expect(logisticsFabMult(state)).toBe(1)
    expect(logisticsDropMult(state)).toBe(1)

    state.core.ranks.logistics = 25
    expect(logisticsFabMult(state)).toBeGreaterThan(1)
    expect(logisticsDropMult(state)).toBeGreaterThan(1)
    expect(logisticsDropMult(state)).toBeLessThanOrEqual(1.5)
  })

  it('diminishing returns: rank 50 effect < 50 × rank 1 effect', () => {
    const r1 = coreEffectMultiplier(1)
    const r50 = coreEffectMultiplier(50)
    expect(r1).toBeGreaterThan(0)
    expect(r50).toBeLessThan(50 * r1)
    expect(r50).toBeLessThan(1)
  })
})
