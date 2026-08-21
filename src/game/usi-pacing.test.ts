import { describe, expect, it } from 'vitest'
import {
  ENEMY_EARLY_SECTOR,
  ENEMY_MID_SECTOR,
  enemyDamageScale,
  enemySectorScale,
} from './combat'
import {
  canBuyMatterShop,
  moduleUpgradeCost,
  prestigeMomentumDamageBonus,
  prestigeMomentumProductionBonus,
} from './catalog'
import { createInitialState } from './state'
import { performPrestige, upgradeModule } from './actions'

/** Pre-pass exponential, used only to prove S9+ is no longer that cliff. */
function legacyDamageScale(sector: number): number {
  return 0.9 * Math.pow(1.28, Math.max(1, sector) - 1)
}

function legacyHullScale(sector: number): number {
  return 1.55 * Math.pow(1.235, Math.max(1, sector) - 1)
}

describe('USI-aligned enemy pacing', () => {
  it('keeps S1–S8 on the original hull and damage curve', () => {
    for (let s = 1; s <= ENEMY_EARLY_SECTOR; s += 1) {
      expect(enemySectorScale(s)).toBeCloseTo(legacyHullScale(s), 10)
      expect(enemyDamageScale(s)).toBeCloseTo(legacyDamageScale(s), 10)
    }
  })

  it('keeps S15 hull at least 10× S1', () => {
    expect(enemySectorScale(15)).toBeGreaterThan(enemySectorScale(1) * 10)
  })

  it('softens S11 and S15 damage vs the old 1.28 exponential', () => {
    expect(enemyDamageScale(11)).toBeLessThan(legacyDamageScale(11) * 0.85)
    expect(enemyDamageScale(15)).toBeLessThan(legacyDamageScale(15) * 0.6)
    expect(enemySectorScale(15)).toBeLessThan(legacyHullScale(15))
  })

  it('does not let damage outrun hull through the mid-game band', () => {
    const ratioAt = (s: number) => enemyDamageScale(s) / enemySectorScale(s)
    const early = ratioAt(ENEMY_EARLY_SECTOR)
    expect(ratioAt(11)).toBeLessThan(early * 1.05)
    expect(ratioAt(15)).toBeLessThan(early * 1.05)
    expect(ratioAt(ENEMY_MID_SECTOR)).toBeLessThan(early * 1.05)
  })

  it('steepens again after Challenges (S18) so S23 is harder than S15', () => {
    expect(enemySectorScale(23)).toBeGreaterThan(enemySectorScale(15) * 2)
    expect(enemyDamageScale(23)).toBeGreaterThan(enemyDamageScale(15) * 2)
    expect(enemyDamageScale(23)).toBeLessThan(legacyDamageScale(23) * 0.5)
  })
})

describe('USI-aligned Rebuild recovery', () => {
  it('gives each Rebuild a noticeable combat/production bump', () => {
    expect(prestigeMomentumDamageBonus(1, 0)).toBeCloseTo(0.08)
    expect(prestigeMomentumProductionBonus(1, 0)).toBeCloseTo(0.06)
    expect(prestigeMomentumDamageBonus(3, 0)).toBeCloseTo(Math.pow(1.08, 3) - 1)
    expect(prestigeMomentumProductionBonus(3, 0)).toBeCloseTo(Math.pow(1.06, 3) - 1)
    expect(prestigeMomentumDamageBonus(20, 0)).toBeGreaterThan(3)
  })

  it('opens Slag Bank rank 4 after the first Rebuild', () => {
    const state = createInitialState(0)
    state.prestige.matterShop = { 'matter-plating': 3 }
    state.resources.prestigeMatter = 100
    state.prestige.prestigeCount = 1
    state.meta.highestSectorEver = 8
    expect(canBuyMatterShop(state, 'matter-plating').ok).toBe(true)
  })

  it('return salvage covers Pulse L1 plus two Plate levels', () => {
    let state = createInitialState(0)
    state.combat.sector = 12
    state.meta.highestSectorEver = 12
    state.combat.highestSector = 12
    state = performPrestige(state, 1000)
    const pulseCost = moduleUpgradeCost(0, 'pulse-cannon')
    const plate1 = moduleUpgradeCost(0, 'plate-layer')
    const plate2 = moduleUpgradeCost(1, 'plate-layer')
    expect(state.resources.salvage).toBeGreaterThanOrEqual(pulseCost + plate1 + plate2)

    state = upgradeModule(state, 'pulse-cannon')
    state = upgradeModule(state, 'plate-layer')
    state = upgradeModule(state, 'plate-layer')
    expect(state.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(state.shipyard.moduleLevels['plate-layer']).toBe(2)
  })
})
