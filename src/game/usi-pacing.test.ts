import { describe, expect, it } from 'vitest'
import {
  ENEMY_DMG_BASE,
  ENEMY_DMG_EARLY,
  ENEMY_EARLY_SECTOR,
  ENEMY_HULL_BASE,
  ENEMY_HULL_EARLY,
  ENEMY_MID_SECTOR,
  enemyDamageScale,
  enemySectorScale,
} from './combat'
import {
  canBuyMatterShop,
  prestigeMomentumDamageBonus,
  prestigeMomentumProductionBonus,
} from './catalog'
import { createInitialState } from './state'
import { performPrestige } from './actions'

/** Pre-pass exponential, used only to prove S9+ is no longer that cliff. */
function legacyDamageScale(sector: number): number {
  return 0.9 * Math.pow(1.28, Math.max(1, sector) - 1)
}

function authoredHullScale(sector: number): number {
  return ENEMY_HULL_BASE * Math.pow(ENEMY_HULL_EARLY, Math.max(1, sector) - 1)
}

function authoredDamageScale(sector: number): number {
  return ENEMY_DMG_BASE * Math.pow(ENEMY_DMG_EARLY, Math.max(1, sector) - 1)
}

describe('USI-aligned enemy pacing', () => {
  it('keeps S1–S8 on the authored early hull and damage curve', () => {
    for (let s = 1; s <= ENEMY_EARLY_SECTOR; s += 1) {
      expect(enemySectorScale(s)).toBeCloseTo(authoredHullScale(s), 10)
      expect(enemyDamageScale(s)).toBeCloseTo(authoredDamageScale(s), 10)
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

  it('return salvage is not spent on retired per-Sortie Core purchases', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state = performPrestige(state, 1000)
    expect(state.resources.salvage).toBeGreaterThan(0)

    const salvage = state.resources.salvage
    state.combat.docked = false
    expect(state.workshop?.coreStarts['pulse-cannon:1'] ?? 0).toBe(0)
    expect(state.workshop?.coreStarts['plate-layer:1'] ?? 0).toBe(0)
    expect(state.resources.salvage).toBe(salvage)
  })
})
