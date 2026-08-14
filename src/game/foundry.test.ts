import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  buyFoundryUpgrade,
  equipFoundryModule,
  performRebuild,
  setFoundrySlot,
  setNumberNotation,
} from './actions'
import {
  foundryDamageMult,
  foundryRecipeLevel,
  isFoundryInfinite,
  isFoundryRecipeUnlocked,
} from './foundry'
import { isSystemUnlocked } from './progression'
import { advanceSeconds } from './tick'

describe('phase 5: foundry + notation', () => {
  it('opens Foundry at sector 2 with one smelter', () => {
    const fresh = createInitialState(0)
    expect(SAVE_VERSION).toBe(32)
    expect(isSystemUnlocked(fresh, 'foundry')).toBe(false)
    expect(fresh.foundry.slots).toHaveLength(1)
    expect(fresh.meta.numberNotation).toBe('engineering')

    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'slag-ingot')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(false)
  })

  it('smelts Slag Ingots, levels the recipe, and grants Foundry Points', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    s.resources.salvage = 80
    s = setFoundrySlot(s, 0, 'slag-ingot')
    expect(s.foundry.slots[0]?.recipeId).toBe('slag-ingot')
    advanceSeconds(s, 20)
    expect(s.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(2)
    expect(foundryRecipeLevel(s, 'slag-ingot')).toBeGreaterThanOrEqual(1)
    expect(s.foundry.points).toBeGreaterThanOrEqual(1)
  })

  it('unlocks Hardened Plate after Slag Ingot hits level 8', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    s.foundry.recipeLevels['slag-ingot'] = 8
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(true)
  })

  it('Foundry Strike ranks raise ship DPS', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    const before = computeShipStats(s).damage
    s.foundry.points = 2
    s = buyFoundryUpgrade(s, 'fp-damage')
    expect(s.foundry.upgrades['fp-damage']).toBe(1)
    expect(foundryDamageMult(s)).toBeCloseTo(1.04)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('Second Smelter adds a slot', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.foundry.points = 8
    s = buyFoundryUpgrade(s, 'fp-slot')
    expect(s.foundry.slots).toHaveLength(2)
  })

  it('Rebuild wipes fitted bits but keeps recipe levels and points', () => {
    let s = createInitialState(0)
    s.combat.sector = 4
    s.meta.highestSectorEver = 4
    s.foundry.recipeLevels['slag-ingot'] = 8
    s.foundry.points = 5
    s.foundry.materials['hardened-plate'] = 5
    s.foundry.recipeLevels['hardened-plate'] = 1
    s = equipFoundryModule(s, 'slag-liner')
    expect(s.foundry.equipped).toContain('slag-liner')

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.foundry.equipped).toEqual([])
    expect(s.foundry.recipeLevels['slag-ingot']).toBe(8)
    expect(s.foundry.points).toBe(5)
  })

  it('marks a recipe infinite at max level', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    s.foundry.recipeLevels['slag-ingot'] = 19
    s.foundry.recipeXp['slag-ingot'] = 99
    s.resources.salvage = 200
    s = setFoundrySlot(s, 0, 'slag-ingot')
    advanceSeconds(s, 30)
    expect(isFoundryInfinite(s, 'slag-ingot') || foundryRecipeLevel(s, 'slag-ingot') >= 20).toBe(
      true,
    )
  })

  it('stores the number notation toggle on meta', () => {
    let s = createInitialState(0)
    s = setNumberNotation(s, 'scientific')
    expect(s.meta.numberNotation).toBe('scientific')
    s = setNumberNotation(s, 'engineering')
    expect(s.meta.numberNotation).toBe('engineering')
  })
})
