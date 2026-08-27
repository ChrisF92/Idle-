import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  performRebuild,
  setLaunchSector,
  setSectorRoute,
} from './actions'
import { encounterForWave, salvageFromKill } from './combat'
import { getFrame } from './catalog'
import { maybeGrantSystemUnlocks, isSystemUnlocked } from './progression'
import { isRouteBUnlocked, maxLaunchSector, routeDangerMult } from './sectors'
import { advanceSeconds } from './tick'

describe('phase 7: Yard, Cruiser, A/B routes', () => {
  it('bumps save and keeps Yard locked until the first Rebuild', () => {
    expect(SAVE_VERSION).toBe(46)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'yard')).toBe(false)
    expect(getFrame('bastion-frame')?.requiresBestWave).toBe(70)
    expect(getFrame('bastion-frame')?.defenseSlots).toBe(3)
    expect(getFrame('starter-frame')?.baseHull).toBe(40)
  })

  it('unlocks Bastion Frame after Wave 70 and does not auto-grant Swarm', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 80
    s.combat.bestWave = 80
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('swarm-frame')
  })

  it('has no standalone Yard; infrastructure lives in Foundry', () => {
    const s = createInitialState(0)
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
    s.meta.highestSectorEver = 20
    s.prestige.prestigeCount = 2
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
    expect(s).not.toHaveProperty('yard')
  })

  it('does not expand a Yard grid', () => {
    const s = createInitialState(0)
    s.prestige.prestigeCount = 2
    s.meta.highestSectorEver = 140
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
  })

  it('opens Route B after sector 24 and makes packs harder with more salvage', () => {
    const fresh = createInitialState(0)
    expect(isRouteBUnlocked(career(fresh))).toBe(false)
    const s = createInitialState(0)
    s.meta.highestSectorEver = 24
    expect(isRouteBUnlocked(24)).toBe(true)
    expect(maxLaunchSector(24)).toBe(25)

    const a = encounterForWave(9, 1, 'A')
    const b = encounterForWave(9, 1, 'B')
    expect(b.family).toBe(a.family)
    const aHull = a.units.reduce((n, u) => n + u.hullMax, 0)
    const bHull = b.units.reduce((n, u) => n + u.hullMax, 0)
    expect(bHull / aHull).toBeCloseTo(routeDangerMult('B'), 1)
    expect(salvageFromKill(9, false, 'B')).toBeGreaterThan(salvageFromKill(9, false, 'A'))
  })

  it('lets a docked ship pick start sector and route', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 24
    s.combat.docked = true
    s = setLaunchSector(s, 9)
    s = setSectorRoute(s, 'B')
    s.combat.docked = false
    const blocked = setSectorRoute(s, 'A')
  })

  it('Rebuild hangar can swap onto Bastion once unlocked', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 24
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    s = performRebuild(s, {
      frameId: 'bastion-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('bastion-frame')
    const starterHull = computeShipStats({
      ...s,
      shipyard: { ...s.shipyard, frameId: 'starter-frame' },
    }).hullMax
    expect(computeShipStats(s).hullMax).toBeGreaterThan(starterHull)
  })
})

function career(state: { meta: { highestSectorEver: number }; combat: { highestSector: number } }): number {
  return Math.max(state.meta.highestSectorEver, state.combat.highestSector)
}
