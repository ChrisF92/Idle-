import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  assignWorker,
  autoBalanceWorkers,
  buyAiNode,
  buyMatterShop,
  buyResearch,
  fillStationWorkers,
} from './actions'
import {
  BASE_DRONE_CAP,
  droneCap,
  dronePower,
  isStationBlackBarred,
  stationBlackBarNeed,
  stationEffectiveDrones,
  stationThroughput,
} from './catalog'
import { advanceSeconds, computeResourceRates } from './tick'

describe('drone corps cap + black-bar saturation', () => {
  it('starts at base cap and stops manufacture at capacity', () => {
    let state = createInitialState(0)
    expect(droneCap(state)).toBe(BASE_DRONE_CAP)
    state.meta.highestSectorEver = 4
    state.base.workerDrones = BASE_DRONE_CAP
    state.base.manufactureProgress = 0.99
    advanceSeconds(state, 5)
    expect(state.base.workerDrones).toBe(BASE_DRONE_CAP)
  })

  it('research / AI / PM raise cap; acuity raises power', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state.resources.data = 200
    state = buyResearch(state, 'drone-logistics')
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 5)

    state.resources.aiPoints = 10
    state = buyAiNode(state, 'drone-hangar')
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 5 + 8)

    state.resources.prestigeMatter = 20
    state.prestige.prestigeCount = 1
    state = buyMatterShop(state, 'drone-acuity')
    expect(dronePower(state)).toBeCloseTo(1.2, 5)
  })

  it('hard black-bars scrap field; extras do not raise income', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 4
    state.base.workerDrones = 40
    state = assignWorker(state, 'scrap-field', 20)
    expect(stationBlackBarNeed(state, 'scrap-field')).toBe(20)
    expect(isStationBlackBarred(state, 'scrap-field')).toBe(true)
    const atBb = computeResourceRates(state).scrap ?? 0

    state = assignWorker(state, 'scrap-field', 10)
    expect(stationEffectiveDrones(state, 'scrap-field')).toBe(20)
    expect(computeResourceRates(state).scrap ?? 0).toBeCloseTo(atBb, 5)
  })

  it('higher drone power black-bars with fewer bodies', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 18
    state.base.workerDrones = 20
    state.resources.aiPoints = 20
    state = buyAiNode(state, 'drone-efficiency-1')
    expect(dronePower(state)).toBeCloseTo(1.35, 5)
    // ceil(20 / 1.35) = 15
    expect(stationBlackBarNeed(state, 'scrap-field')).toBe(15)
    state = assignWorker(state, 'scrap-field', 15)
    expect(stationThroughput(state, 'scrap-field')).toBeCloseTo(1, 5)
  })

  it('lifetime drones built softly raise cap', () => {
    const state = createInitialState(0)
    state.meta.lifetimeDronesBuilt = 40
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 2)
  })

  it('labor fill stops at black-bar; balanced dumps overflow to training', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    // Only scrap + training unlocked so overflow has somewhere to go.
    state.research.unlocked = ['core-training']
    state.base.workerDrones = 100
    state.resources.aiPoints = 10
    state = buyAiNode(state, 'auto-assign-workers')

    state = fillStationWorkers(state, 'scrap-field')
    expect(state.base.assignments['scrap-field']).toBe(20)

    state = autoBalanceWorkers(state, 'balanced')
    const scrap = state.base.assignments['scrap-field'] ?? 0
    expect(scrap).toBeLessThanOrEqual(20)
    const trainingAssigned = Object.entries(state.base.assignments)
      .filter(([id]) => id.startsWith('train-'))
      .reduce((sum, [, n]) => sum + n, 0)
    expect(trainingAssigned).toBeGreaterThan(0)
  })
})
