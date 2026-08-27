import { describe, expect, it } from 'vitest'
import {
  fittedShieldRegenFraction,
  getModule,
  moduleStatPreviews,
  moduleWeaponDamage,
} from './catalog'
import {
  PROJECTILE_SPEED,
  SPAWN_DISTANCE,
  salvageFromKill,
  weaponDamageProfile,
} from './combat'
import { computeShipStats, createInitialState } from './state'
import { buyCoreStartingLevel } from './actions'

describe('USI Core formulas', () => {
  it('levels Pulse Cannon from the authored 4 / 1.2 / 0.80s seed', () => {
    const pulse = getModule('pulse-cannon')!
    expect(pulse.weapon?.damage).toBe(4)
    expect(pulse.weapon?.damagePerLevel).toBe(1.2)
    expect(pulse.weapon?.cooldown).toBe(0.8)
    expect(moduleWeaponDamage(pulse, 0)).toBe(4)
    expect(moduleWeaponDamage(pulse, 1)).toBeCloseTo(5.2)
  })

  it('levels Plate Layer with Scrap at Dock', () => {
    let state = createInitialState(0)
    const baseShield = computeShipStats(state).shieldMax
    expect(baseShield).toBeGreaterThan(0)
    expect(fittedShieldRegenFraction(state.shipyard.modules)).toBeCloseTo(0.045)

    state.resources.scrap = 400
    state = buyCoreStartingLevel(state, 'plate-layer:1')
    expect(computeShipStats(state).shieldMax).toBeGreaterThan(baseShield)
  })

  it('maps projectile speed onto the radial spawn radius', () => {
    expect(SPAWN_DISTANCE).toBe(300)
    expect(PROJECTILE_SPEED).toBeCloseTo(350)
    expect(getModule('pulse-cannon')?.weapon?.range).toBeLessThan(SPAWN_DISTANCE)
  })

  it('applies energy vs kinetic damage profiles', () => {
    const laser = weaponDamageProfile(['energy'])
    expect(laser.hullDamage).toBe(1)
    expect(laser.shieldDamage).toBe(1)
    expect(laser.armorDamage).toBe(0.25)

    const kinetic = weaponDamageProfile(['kinetic'])
    expect(kinetic.shieldDamage).toBe(0.6)
    expect(kinetic.armorDamage).toBe(1)
  })

  it('grants salvage per kill', () => {
    expect(salvageFromKill(1, false)).toBe(1)
    expect(salvageFromKill(1, true)).toBe(5)
    expect(salvageFromKill(4, false)).toBe(1)
  })

  it('shows Pulse RoF and Plate shield in previews', () => {
    const pulse = moduleStatPreviews('pulse-cannon', 0, true)
    expect(pulse.find((p) => p.label === 'RoF')?.current).toBe('1.25/s')
    expect(pulse.find((p) => p.label === 'Damage')?.current).toBe('4.00')

    const plate = moduleStatPreviews('plate-layer', 0, true)
    expect(plate.find((p) => p.label === 'Shield')?.current).toBe('+36')
    expect(plate.find((p) => p.label === 'Regen')?.current).toBe('5%/s')
  })

  it('has no free frame battery — only equipped Cores shoot', () => {
    const stats = computeShipStats(createInitialState(0))
    expect(stats.damage).toBeCloseTo(5)
  })
})
