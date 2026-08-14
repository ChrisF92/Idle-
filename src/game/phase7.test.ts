import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  buyYardArm,
  performRebuild,
  placeYardBuilding,
  setLaunchSector,
  setSectorRoute,
} from './actions'
import { enemyForSector, salvageFromKill } from './combat'
import { getFrame } from './catalog'
import { maybeGrantSystemUnlocks, isSystemUnlocked } from './progression'
import { isRouteBUnlocked, maxLaunchSector, routeDangerMult } from './sectors'
import { yardGood, yardGridSize, yardArmed, YARD_EXPAND_SECTOR } from './yard'
import { advanceSeconds } from './tick'

describe('phase 7: Yard, Cruiser, A/B routes', () => {
  it('bumps save and keeps Yard locked until the first Rebuild', () => {
    expect(SAVE_VERSION).toBe(32)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'yard')).toBe(false)
    expect(fresh.combat.route).toBe('A')
    expect(getFrame('cruiser-frame')?.requiresSectorEver).toBe(8)
    expect(getFrame('cruiser-frame')?.defenseSlots).toBe(2)
    expect(getFrame('cruiser-frame')?.baseHull).toBe(70)
  })

  it('unlocks Cruiser Hull after clearing sector 8', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 8
    s.combat.highestSector = 8
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('cruiser-frame')
    expect(s.shipyard.unlockedFrames).toContain('line-frame')
  })

  it('opens Yard after Rebuild; buildings produce; arms apply on the next Rebuild', () => {
    let s = createInitialState(0)
    s.combat.sector = 4
    s.meta.highestSectorEver = 4
    s.combat.highestSector = 4
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(isSystemUnlocked(s, 'yard')).toBe(true)
    expect(yardGridSize(s)).toBe(3)

    s = placeYardBuilding(s, 0, 'slag-heap')
    expect(s.yard.cells[0]?.buildingId).toBe('slag-heap')
    const oreBefore = yardGood(s, 'ore')
    advanceSeconds(s, 10)
    expect(yardGood(s, 'ore')).toBeGreaterThan(oreBefore)

    s.yard.goods.ingot = 40
    s = buyYardArm(s, 'damage')
    expect(s.yard.pending.damage).toBe(1)
    const before = computeShipStats(s).damage
    s.combat.sector = 4
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(yardArmed(s, 'damage')).toBe(1)
    expect(s.yard.pending.damage).toBe(0)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('expands the grid at sector 14', () => {
    const s = createInitialState(0)
    s.prestige.prestigeCount = 1
    s.meta.highestSectorEver = YARD_EXPAND_SECTOR
    expect(yardGridSize(s)).toBe(4)
  })

  it('opens Route B after sector 8 and makes packs harder with more salvage', () => {
    const fresh = createInitialState(0)
    expect(isRouteBUnlocked(career(fresh))).toBe(false)
    const s = createInitialState(0)
    s.meta.highestSectorEver = 8
    expect(isRouteBUnlocked(8)).toBe(true)
    expect(maxLaunchSector(8)).toBe(9)

    const a = enemyForSector(9, 1, 'A')
    const b = enemyForSector(9, 1, 'B')
    expect(b.family).not.toBe(a.family)
    const aHull = a.units.reduce((n, u) => n + u.hullMax, 0)
    const bHull = b.units.reduce((n, u) => n + u.hullMax, 0)
    expect(bHull / aHull).toBeCloseTo(routeDangerMult('B'), 1)
    expect(salvageFromKill(9, false, 'B')).toBeGreaterThan(salvageFromKill(9, false, 'A'))
  })

  it('lets a docked ship pick start sector and route', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 8
    s.combat.docked = true
    s = setLaunchSector(s, 9)
    expect(s.combat.sector).toBe(9)
    s = setSectorRoute(s, 'B')
    expect(s.combat.route).toBe('B')
    s.combat.docked = false
    const blocked = setSectorRoute(s, 'A')
    expect(blocked.combat.route).toBe('B')
  })

  it('Rebuild hangar can swap onto Cruiser once unlocked', () => {
    let s = createInitialState(0)
    s.combat.sector = 8
    s.meta.highestSectorEver = 8
    s.shipyard.unlockedFrames = ['scout-frame', 'line-frame', 'cruiser-frame']
    s = performRebuild(s, {
      frameId: 'cruiser-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.shipyard.frameId).toBe('cruiser-frame')
    expect(computeShipStats(s).hullMax).toBeGreaterThanOrEqual(70)
  })
})

function career(state: { meta: { highestSectorEver: number }; combat: { highestSector: number } }): number {
  return Math.max(state.meta.highestSectorEver, state.combat.highestSector)
}
