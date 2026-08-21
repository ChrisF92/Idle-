import { describe, expect, it } from 'vitest'
import { assignWorker } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked, stationEffectiveDrones } from './catalog'
import { networkStrikeMult, networkWardMult } from './network'
import { isSystemUnlocked } from './progression'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { advanceTicks } from './tick'
import { isWorkersUnlocked, WORKER_JOB_IDS } from './workers'

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
})
