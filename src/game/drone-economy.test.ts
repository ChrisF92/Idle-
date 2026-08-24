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
import { atCareerWave } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

function atWorkers(bestWave = 120) {
  return atCareerWave(createInitialState(0), Math.max(ACT1_CADENCE.workers, bestWave))
}

describe('drone corps cap + black-bar saturation', () => {
  it('starts at base cap and stops manufacture at capacity', () => {
    const state = atWorkers()
    expect(droneCap(state)).toBe(BASE_DRONE_CAP)
    state.base.workerDrones = BASE_DRONE_CAP
    state.base.manufactureProgress = 0.99
    advanceSeconds(state, 5)
    expect(state.base.workerDrones).toBe(BASE_DRONE_CAP)
  })

  it('research / AI / PM raise cap; acuity raises power', () => {
    let state = atWorkers()
    state.resources.data = 200
    state = buyResearch(state, 'drone-logistics')
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 5)

    state.resources.aiPoints = 10
    state = buyAiNode(state, 'drone-hangar')
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 5 + 8)

    state.resources.prestigeMatter = 20
    state.prestige.prestigeCount = 1
    state = buyMatterShop(state, 'drone-acuity')
    expect(dronePower(state)).toBeCloseTo(1.12, 5)
  })

  it('hard black-bars scrap field; extras do not raise income', () => {
    let state = atWorkers()
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
    let state = atWorkers()
    state.base.workerDrones = 20
    state.resources.aiPoints = 20
    state = buyAiNode(state, 'drone-efficiency-1')
    expect(dronePower(state)).toBeCloseTo(1.35, 5)
    expect(stationBlackBarNeed(state, 'scrap-field')).toBe(15)
    state = assignWorker(state, 'scrap-field', 15)
    expect(stationThroughput(state, 'scrap-field')).toBeCloseTo(1, 5)
  })

  it('lifetime drones built softly raise cap', () => {
    const state = createInitialState(0)
    state.meta.lifetimeDronesBuilt = 40
    expect(droneCap(state)).toBe(BASE_DRONE_CAP + 2)
  })

  it('labour assignment stops at the real job hard cap', () => {
    let state = atWorkers()
    state.research.unlocked = ['core-training']
    state.base.workerDrones = 100
    state.resources.aiPoints = 10
    state = buyAiNode(state, 'auto-assign-workers')

    state = fillStationWorkers(state, 'scrap-field')
    expect(state.base.assignments['scrap-field']).toBe(20)

    state = autoBalanceWorkers(state, 'balanced')
    expect(state.base.assignments['scrap-field'] ?? 0).toBe(20)
    const trainingAssigned = Object.entries(state.base.assignments)
      .filter(([id]) => id.startsWith('train-'))
      .reduce((sum, [, n]) => sum + n, 0)
    expect(trainingAssigned).toBe(0)
  })
})
