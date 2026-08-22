import { describe, expect, it } from 'vitest'
import {
  MAX_MODULE_LEVEL,
  fittedShieldRegenFraction,
  getModule,
  moduleStatPreviews,
  moduleUpgradeCost,
  moduleWeaponDamage,
} from './catalog'
import {
  PROJECTILE_SPEED,
  SPAWN_DISTANCE,
  salvageFromKill,
  weaponDamageProfile,
} from './combat'
import { computeShipStats, createInitialState } from './state'
import { upgradeModule } from './actions'

describe('USI Core formulas', () => {
  it('uses Laser Cannon salvage costs for Pulse Cannon (3 × 1.21^n)', () => {
    expect(moduleUpgradeCost(0, 'pulse-cannon')).toBe(3)
    expect(moduleUpgradeCost(1, 'pulse-cannon')).toBe(Math.ceil(3 * 1.21))
    expect(moduleUpgradeCost(2, 'pulse-cannon')).toBe(Math.ceil(3 * 1.21 ** 2))
  })

  it('uses Continuous Generator salvage costs for Plate Layer (6 × 1.2^n)', () => {
    expect(moduleUpgradeCost(0, 'plate-layer')).toBe(6)
    expect(moduleUpgradeCost(1, 'plate-layer')).toBe(Math.ceil(6 * 1.2))
  })

  it('levels Pulse Cannon with flat +5 damage like Laser Cannon T1', () => {
    const pulse = getModule('pulse-cannon')!
    expect(pulse.weapon?.damage).toBe(10)
    expect(pulse.weapon?.damagePerLevel).toBe(5)
    expect(pulse.weapon?.cooldown).toBe(2)
    expect(moduleWeaponDamage(pulse, 0)).toBe(10)
    expect(moduleWeaponDamage(pulse, 1)).toBe(15)
    expect(moduleWeaponDamage(pulse, 4)).toBe(30)
  })

  it('levels Plate Layer with flat +5 max shield like Continuous Generator T1', () => {
    const state = createInitialState(0)
    expect(computeShipStats(state).shieldMax).toBe(30)
    expect(fittedShieldRegenFraction(state.shipyard.modules)).toBe(0.05)

    state.combat.docked = false
    state.resources.salvage = 100
    const next = upgradeModule(state, 'plate-layer')
    expect(computeShipStats(next).shieldMax).toBe(35)
  })

  it('maps USI laser projectile speed onto the lane (700 × 180/600)', () => {
    expect(SPAWN_DISTANCE).toBe(180)
    expect(PROJECTILE_SPEED).toBeCloseTo(210)
    expect(getModule('pulse-cannon')?.weapon?.range).toBe(180)
  })

  it('applies USI laser vs kinetic damage profiles', () => {
    const laser = weaponDamageProfile(['energy'])
    expect(laser.hullDamage).toBe(1)
    expect(laser.shieldDamage).toBe(1)
    expect(laser.armorDamage).toBe(0.25)

    const kinetic = weaponDamageProfile(['kinetic'])
    expect(kinetic.shieldDamage).toBe(0.6)
    expect(kinetic.armorDamage).toBe(1)
  })

  it('grants salvage per kill, S1 trash = 1 so the first Laser level costs 3 kills', () => {
    expect(salvageFromKill(1, false)).toBe(1)
    expect(salvageFromKill(1, true)).toBe(5)
    expect(salvageFromKill(4, false)).toBe(4)
  })

  it('does not cap Cores at 12 — USI T1 runs into the 100s', () => {
    expect(MAX_MODULE_LEVEL).toBeGreaterThanOrEqual(110)
  })

  it('shows Pulse RoF 0.50/s and Plate shield in previews', () => {
    const pulse = moduleStatPreviews('pulse-cannon', 0, true)
    expect(pulse.find((p) => p.label === 'RoF')?.current).toBe('0.50/s')
    expect(pulse.find((p) => p.label === 'Damage')?.current).toBe('10.00')
    expect(pulse.find((p) => p.label === 'Damage')?.next).toBe('15.00')

    const plate = moduleStatPreviews('plate-layer', 0, true)
    expect(plate.find((p) => p.label === 'Shield')?.current).toBe('+30')
    expect(plate.find((p) => p.label === 'Shield')?.next).toBe('+35')
    expect(plate.find((p) => p.label === 'Regen')?.current).toBe('5%/s')
  })

  it('has no free frame battery — only equipped Cores shoot', () => {
    const stats = computeShipStats(createInitialState(0))
    // 10 dmg / 2s = 5 DPS
    expect(stats.damage).toBeCloseTo(5)
  })
})
