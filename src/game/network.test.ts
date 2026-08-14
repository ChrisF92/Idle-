import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import { assignWorker, performRebuild } from './actions'
import {
  NETWORK_STARTING_DRONES,
  isNetworkBarUnlocked,
  networkFillRate,
  networkLevels,
  networkSalvageMult,
  networkStrikeMult,
  networkWardMult,
} from './network'
import { droneCap, idleWorkers } from './catalog'
import { isSystemUnlocked } from './progression'
import { advanceSeconds } from './tick'
import { salvageFromKill } from './combat'

describe('phase 4: drone network', () => {
  it('starts with a corps and Network unlocked; Cores is not a hub tab', () => {
    const s = createInitialState(0)
    expect(SAVE_VERSION).toBe(27)
    expect(s.base.workerDrones).toBe(NETWORK_STARTING_DRONES)
    expect(droneCap(s)).toBe(10)
    expect(idleWorkers(s)).toBe(NETWORK_STARTING_DRONES)
    expect(isSystemUnlocked(s, 'network')).toBe(true)
    expect(isSystemUnlocked(s, 'cores')).toBe(false)
    expect(isNetworkBarUnlocked(s, 'strike')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'ward')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'yield')).toBe(false)
    expect(isNetworkBarUnlocked(s, 'archive')).toBe(false)
  })

  it('assigns drones onto Strike and fills levels over time', () => {
    let s = createInitialState(0)
    s = assignWorker(s, 'strike', 2)
    expect(s.base.assignments.strike).toBe(2)
    expect(networkFillRate(s, 'strike')).toBeGreaterThan(0)
    advanceSeconds(s, 20)
    expect(networkLevels(s, 'strike')).toBeGreaterThanOrEqual(3)
  })

  it('Strike levels raise ship DPS; Ward raises max shield', () => {
    let s = createInitialState(0)
    const dmg0 = computeShipStats(s).damage
    const shield0 = computeShipStats(s).shieldMax
    expect(networkStrikeMult(s)).toBe(1)
    expect(networkWardMult(s)).toBe(1)

    s = assignWorker(s, 'strike', 4)
    advanceSeconds(s, 30)
    expect(networkLevels(s, 'strike')).toBeGreaterThan(0)
    expect(computeShipStats(s).damage).toBeGreaterThan(dmg0)

    s = assignWorker(s, 'strike', -4)
    s = assignWorker(s, 'ward', 4)
    advanceSeconds(s, 30)
    expect(networkLevels(s, 'ward')).toBeGreaterThan(0)
    expect(computeShipStats(s).shieldMax).toBeGreaterThan(shield0)
  })

  it('extra drones fill a bar faster', () => {
    let slow = createInitialState(0)
    slow = assignWorker(slow, 'strike', 1)
    advanceSeconds(slow, 12)
    const slowLv = networkLevels(slow, 'strike')

    let fast = createInitialState(0)
    fast = assignWorker(fast, 'strike', 4)
    advanceSeconds(fast, 12)
    expect(networkLevels(fast, 'strike')).toBeGreaterThan(slowLv)
  })

  it('Yield unlocks at sector 2 and boosts salvage + Strike fill', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    expect(isNetworkBarUnlocked(s, 'yield')).toBe(true)
    expect(isNetworkBarUnlocked(s, 'loom')).toBe(true)

    s = assignWorker(s, 'yield', 4)
    advanceSeconds(s, 40)
    expect(networkLevels(s, 'yield')).toBeGreaterThan(0)
    expect(networkSalvageMult(s)).toBeGreaterThan(1)

    const boosted = salvageFromKill(1, false) * networkSalvageMult(s)
    expect(boosted).toBeGreaterThan(1)

    s = assignWorker(s, 'yield', -4)
    s = assignWorker(s, 'strike', 2)
    const withYield = networkFillRate(s, 'strike')

    const fresh = createInitialState(0)
    const unboosted = assignWorker(fresh, 'strike', 2)
    expect(withYield).toBeGreaterThan(networkFillRate(unboosted, 'strike'))
  })

  it('manufactures drones from the start up to corps cap', () => {
    const s = createInitialState(0)
    expect(s.base.workerDrones).toBe(NETWORK_STARTING_DRONES)
    advanceSeconds(s, 90 * 8)
    expect(s.base.workerDrones).toBe(droneCap(s))
    expect(s.base.workerDrones).toBe(10)
  })

  it('Rebuild wipes bar levels and assignments, keeps the corps', () => {
    let s = createInitialState(0)
    s.combat.sector = 4
    s.meta.highestSectorEver = 4
    s = assignWorker(s, 'strike', 4)
    advanceSeconds(s, 25)
    expect(networkLevels(s, 'strike')).toBeGreaterThan(0)
    const corps = s.base.workerDrones

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.network.bars.strike.levels).toBe(0)
    expect(s.network.bars.ward.levels).toBe(0)
    expect(s.base.assignments.strike ?? 0).toBe(0)
    expect(s.base.workerDrones).toBe(corps)
    expect(networkStrikeMult(s)).toBe(1)
  })
})
