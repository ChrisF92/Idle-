import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { buyMatterShop, performRebuild } from './actions'
import { canBuyMatterShop, getMatterShopItem, MATTER_SHOP, shopRank } from './catalog'
import { unlockedFoundryLogs } from './logs'
import { GUIDE_STEPS, isSystemUnlocked } from './progression'

describe('Slag Bank', () => {
  it('keeps save version 31', () => {
    expect(SAVE_VERSION).toBe(33)
  })

  it('unlocks with the first Rebuild, same door as Yard', () => {
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'slag')).toBe(false)
    expect(isSystemUnlocked(fresh, 'yard')).toBe(false)

    let s = createInitialState(0)
    s.combat.sector = 4
    s.meta.highestSectorEver = 4
    s.combat.highestSector = 4
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(isSystemUnlocked(s, 'slag')).toBe(true)
    expect(isSystemUnlocked(s, 'yard')).toBe(true)
    expect(unlockedFoundryLogs(s).some((l) => l.id === 'slag')).toBe(true)
  })

  it('spends Rebuild Matter on hangar ranks through the shop path', () => {
    let s = createInitialState(0)
    s.prestige.prestigeCount = 1
    s.resources.prestigeMatter = 3
    expect(isSystemUnlocked(s, 'slag')).toBe(true)
    expect(canBuyMatterShop(s, 'matter-blade').ok).toBe(true)

    s = buyMatterShop(s, 'matter-blade')
    expect(shopRank(s.prestige.matterShop, 'matter-blade')).toBe(1)
    expect(s.resources.prestigeMatter).toBe(0)
    expect(canBuyMatterShop(s, 'matter-blade').ok).toBe(false)
    expect(canBuyMatterShop(s, 'matter-blade').reason).toMatch(/Rebuild Matter/)
  })

  it('uses Hiveworks rank names and a More-station guide', () => {
    expect(getMatterShopItem('matter-blade')?.name).toBe('Slag Edge')
    expect(getMatterShopItem('matter-forge')?.name).toBe('Slag Forge')
    expect(getMatterShopItem('matter-plating')?.name).toBe('Slag Plate')
    expect(MATTER_SHOP.length).toBeGreaterThan(8)
    expect(GUIDE_STEPS.some((step) => step.id === 'guide-slag' && step.target === 'station-slag')).toBe(
      true,
    )
  })
})
