import { describe, expect, it } from 'vitest'
import {
  projectileScreenPoint,
  shotTravelHeading,
  shotTravelT,
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
})
