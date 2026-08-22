import { describe, expect, it } from 'vitest'
import { assignWorker, autoBalanceWorkers, buyAiNode } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked, stationEffectiveDrones } from './catalog'
import {
  networkDataRate,
  networkManufactureMult,
  networkSalvageMult,
  networkScrapRate,
  networkStrikeMult,
  networkWardMult,
  tickNetwork,
} from './network'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { advanceTicks } from './tick'
import { isWorkersUnlocked, WORKER_JOB_IDS, workerJobCap, workerJobCapLine, workerJobLabel } from './workers'

describe('GDD Worker Drones', () => {
  it('stays locked before Wave 30, even after the first hull loss', () => {
    const dead = markHullLost(atCareerWave(createInitialState(0), 29))
    expect(isWorkersUnlocked(dead)).toBe(false)
    expect(isSystemUnlocked(dead, 'network')).toBe(false)
    expect(isSystemUnlocked(dead, 'base')).toBe(false)
    expect(isStationUnlocked(dead, 'scrap-field')).toBe(false)
  })

  it('opens industrial jobs at Wave 30', () => {
    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(isWorkersUnlocked(open)).toBe(true)
    expect(isSystemUnlocked(open, 'network')).toBe(true)
    expect(isSystemUnlocked(open, 'base')).toBe(true)
    expect(isStationUnlocked(open, 'scrap-field')).toBe(true)
    expect(WORKER_JOB_IDS).toEqual(
      expect.arrayContaining([
        'scrap-field',
        'power-grid',
        'repair-bay',
        'drone-fab',
        'sensor-net',
        'alloy-foundry',
        'fab-bay',
      ]),
    )
  })

  it('does not let drones buy Strike or Ward combat power', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 8
    s.base.assignments.strike = 4
    s.network.bars.strike.levels = 12
    s.network.bars.ward.levels = 12
    const blocked = assignWorker(s, 'strike', 1)
    expect(blocked.base.assignments.strike).toBe(4)
    expect(networkStrikeMult(s)).toBe(1)
    expect(networkWardMult(s)).toBe(1)
  })

  it('produces scrap from the salvage job', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.combat.docked = true
    s.base.workerDrones = 4
    s = assignWorker(s, 'scrap-field', 2)
    expect(s.base.assignments['scrap-field']).toBe(2)
    const before = s.resources.scrap
    advanceTicks(s, 10)
    expect(s.resources.scrap).toBeGreaterThan(before)
  })

  it('hard-caps a job so extra drones do not raise output', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 40
    s = assignWorker(s, 'scrap-field', 20)
    const atCap = stationEffectiveDrones(s, 'scrap-field')
    s = assignWorker(s, 'scrap-field', 10)
    expect(stationEffectiveDrones(s, 'scrap-field')).toBe(atCap)
  })

  it('does not fill leftover Network bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.base.workerDrones = 8
    s.base.assignments.strike = 4
    s.network.bars.strike.levels = 0
    s.network.bars.strike.progress = 0
    expect(tickNetwork(s, 30)).toBe(false)
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.network.bars.strike.progress).toBe(0)
    expect(s.base.assignments.strike).toBeUndefined()
  })

  it('raises salvage from Scrap Field labour, not Yield bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.yield.levels = 40
    expect(networkSalvageMult(s)).toBe(1)
    s.base.workerDrones = 16
    s.base.assignments['scrap-field'] = 8
    expect(networkSalvageMult(s)).toBeGreaterThan(1)
  })

  it('raises manufacture from fabrication jobs, not Loom bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.loom.levels = 40
    expect(networkManufactureMult(s)).toBe(1)
    s.base.workerDrones = 16
    s.base.assignments['drone-fab'] = 8
    expect(networkManufactureMult(s)).toBeGreaterThan(1)
  })

  it('shows an efficient range and dumps overflow onto Salvage ops', () => {
    expect(workerJobLabel('scrap-field')).toBe('Salvage ops')
    expect(workerJobLabel('alloy-foundry')).toBe('Processing')
    expect(workerJobLabel('fab-bay')).toBe('Fabrication')
    expect(workerJobCap('construction')).toEqual({ min: 1, efficient: 4, hard: 8 })
    expect(workerJobCapLine(2, 'construction')).toBe('2/4 efficient · cap 8')

    let s = atCareerWave(createInitialState(0), 120)
    s.research.unlocked = ['core-training']
    s.base.workerDrones = 100
    s.resources.aiPoints = 10
    s = buyAiNode(s, 'auto-assign-workers')
    s = autoBalanceWorkers(s, 'balanced')
    expect(s.base.assignments['scrap-field'] ?? 0).toBeGreaterThan(20)
    expect(Object.keys(s.base.assignments).some((id) => id.startsWith('train-'))).toBe(false)
  })

  it('does not drip extra scrap or data from retired bars', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    s.network.bars.yield.levels = 20
    s.network.bars.archive.levels = 20
    s.base.assignments.yield = 6
    s.base.assignments.archive = 6
    expect(networkScrapRate(s)).toBe(0)
    expect(networkDataRate(s)).toBe(0)
  })
})
