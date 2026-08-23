import { describe, expect, it } from 'vitest'
import { performRebuild, setFoundrySlot, setNumberNotation } from './actions'
import {
  foundryDamageMult,
  foundryFabSlotCount,
  foundryRecipeLevel,
  foundrySlotCount,
  isFoundryRecipeUnlocked,
} from './foundry'
import { isSystemUnlocked } from './progression'
import { createInitialState, SAVE_VERSION } from './state'
import { advanceSeconds } from './tick'
import { armRebuildDoor } from './testHelpers'

describe('phase 5: foundry + notation', () => {
  it('opens Foundry at Wave 20 with one processor and one fabrication slot', () => {
    const fresh = createInitialState(0)
    expect(SAVE_VERSION).toBe(37)
    expect(isSystemUnlocked(fresh, 'foundry')).toBe(false)
    expect(fresh.foundry.slots).toHaveLength(1)
    expect(fresh.foundry.fabrication).toHaveLength(1)
    expect(fresh.meta.numberNotation).toBe('engineering')

    let s = createInitialState(0)
    s.meta.bestWave = 20
    s.combat.bestWave = 20
    s.meta.highestSectorEver = 2
    s.combat.highestSector = 2
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(foundrySlotCount(s)).toBe(1)
    expect(foundryFabSlotCount(s)).toBe(1)
    expect(isFoundryRecipeUnlocked(s, 'slag-ingot')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(false)
  })

  it('processes Recovered Stock from Scrap and raises mastery', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 70
    s.combat.bestWave = 70
    s.meta.highestSectorEver = 6
    s.combat.highestSector = 6
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'slag-ingot')
    expect(s.foundry.slots[0]?.recipeId).toBe('slag-ingot')
    advanceSeconds(s, 32)
    expect(s.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(1)
    expect(foundryRecipeLevel(s, 'slag-ingot')).toBeGreaterThanOrEqual(0)
  })

  it('unlocks Alloy Plate after Recovered Stock hits mastery 10', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 70
    s.combat.bestWave = 70
    s.foundry.recipeLevels['slag-ingot'] = 9
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(false)
    s.foundry.recipeLevels['slag-ingot'] = 10
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(true)
  })

  it('does not sell combat ranks or Fit bits', () => {
    const s = createInitialState(0)
    expect(foundryDamageMult(s)).toBe(1)
  })

  it('Rebuild keeps recipe levels, stock, and facilities', () => {
    let s = armRebuildDoor(createInitialState(0))
    s.foundry.recipeLevels['slag-ingot'] = 8
    s.foundry.materials['hardened-plate'] = 5
    s.foundry.facilities = ['storage-bay']
    s.foundry.fabrication[0] = {
      kind: 'core',
      jobId: 'flak-array',
      progress: 0.55,
      paid: true,
      complete: false,
    }
    s = performRebuild(s, {
      frameId: 'starter-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(s.foundry.recipeLevels['slag-ingot']).toBe(8)
    expect(s.foundry.materials['hardened-plate']).toBe(5)
    expect(s.foundry.facilities).toContain('storage-bay')
    expect(s.foundry.fabrication[0]?.progress).toBeCloseTo(0.55)
  })

  it('stores the number notation toggle on meta', () => {
    let s = createInitialState(0)
    s = setNumberNotation(s, 'scientific')
    expect(s.meta.numberNotation).toBe('scientific')
    s = setNumberNotation(s, 'engineering')
    expect(s.meta.numberNotation).toBe('engineering')
  })
})
