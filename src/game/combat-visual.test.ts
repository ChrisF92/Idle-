import { describe, expect, it } from 'vitest'
import {
  closestValidFacing,
  CORE_FIRE_ARC,
  easeAngle,
  isOutwardFiringArc,
  muzzleClearOfHive,
  pointOnRing,
  projectileScreenPoint,
  segmentHitsCircle,
  shotTravelHeading,
  shotTravelT,
  shortestAngleDelta,
  weaponIdToCoreId,
} from './combatVisual'

describe('combat shot presentation', () => {
  it('maps player shots from hive range toward the target range', () => {
    expect(shotTravelT('player', 0, 0, 80)).toBeCloseTo(0)
    expect(shotTravelT('player', 40, 0, 80)).toBeCloseTo(0.5)
    expect(shotTravelT('player', 80, 0, 80)).toBeCloseTo(1)
  })

  it('maps enemy shots from their spawn range back toward the hive', () => {
    expect(shotTravelT('enemy', 80, 80, 0)).toBeCloseTo(0)
    expect(shotTravelT('enemy', 40, 80, 0)).toBeCloseTo(0.5)
    expect(shotTravelT('enemy', 0, 80, 0)).toBeCloseTo(1)
  })

  it('uses the target heading for player shots and the attacker heading for enemy shots', () => {
    expect(shotTravelHeading({ side: 'player' }, { heading: 1.2 })).toBeCloseTo(1.2)
    expect(shotTravelHeading({ side: 'enemy', heading: 2.4 }, { heading: 0 })).toBeCloseTo(2.4)
  })

  it('keeps enemy bullets on the attacker-to-hive screen line', () => {
    const from = { x: 80, y: 120 }
    const to = { x: 200, y: 370 }
    expect(projectileScreenPoint('enemy', 80, 80, 0, from, to)).toEqual(from)
    expect(projectileScreenPoint('enemy', 0, 80, 0, from, to)).toEqual(to)
    const mid = projectileScreenPoint('enemy', 40, 80, 0, from, to)
    expect(mid.x).toBeCloseTo(140)
    expect(mid.y).toBeCloseTo(245)
  })

  it('keeps a live player shot attached when the muzzle moves', () => {
    const target = { x: 200, y: 40 }
    const first = projectileScreenPoint('player', 40, 0, 80, { x: 200, y: 370 }, target)
    const moved = projectileScreenPoint('player', 40, 0, 80, { x: 236, y: 348 }, target)
    expect(moved.x).not.toBeCloseTo(first.x)
    expect(moved.y).not.toBeCloseTo(first.y)
  })

  it('strips the flagship weapon suffix so shots can leave that Core', () => {
    expect(weaponIdToCoreId('pulse-cannon-wpn')).toBe('pulse-cannon')
    expect(weaponIdToCoreId('beam-laser')).toBe('beam-laser')
    expect(weaponIdToCoreId()).toBeNull()
  })

  it('keeps an outward firing arc and eases toward the nearest valid facing', () => {
    expect(isOutwardFiringArc(0.1, 0)).toBe(true)
    expect(isOutwardFiringArc(Math.PI, 0)).toBe(false)
    expect(closestValidFacing(0, 0.2)).toBeCloseTo(0)
    expect(Math.abs(closestValidFacing(Math.PI, 0))).toBeCloseTo(CORE_FIRE_ARC)
    expect(closestValidFacing(2.2, 0)).toBeCloseTo(CORE_FIRE_ARC)
    const eased = easeAngle(0, 1, 0.05, 10)
    expect(eased).toBeGreaterThan(0)
    expect(eased).toBeLessThan(1)
    expect(shortestAngleDelta(-3, 3)).toBeLessThan(0)
  })

  it('rejects shots that would pass through the Hive and parks the muzzle on the outward rim', () => {
    const hive = { x: 200, y: 370 }
    const far = { x: 200, y: 40 }
    const behind = { x: 200, y: 420 }
    const facing = pointOnRing(hive, 30, -Math.PI / 2)
    expect(segmentHitsCircle(behind, far, hive, 26)).toBe(true)
    expect(segmentHitsCircle(facing, far, hive, 26)).toBe(false)
    const cleared = muzzleClearOfHive(behind, far, hive, 26, 30)
    expect(segmentHitsCircle(cleared, far, hive, 26)).toBe(false)
  })
})
