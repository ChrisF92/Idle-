import { describe, expect, it } from 'vitest'
import { createInitialState, SAVE_VERSION } from './state'
import { buyMatterShop, performRebuild } from './actions'
import { canBuyMatterShop, getMatterShopItem, MATTER_SHOP, shopRank } from './catalog'
import { unlockedFoundryLogs } from './logs'
import { GUIDE_STEPS, isSystemUnlocked } from './progression'
import { armRebuildDoor } from './testHelpers'

describe('Slag Bank', () => {
  it('bumps save version with the Matter shop rewrite', () => {
    expect(SAVE_VERSION).toBe(51)
  })

  it('unlocks with the first Rebuild while Yard waits for later mastery', () => {
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'slag')).toBe(false)
    expect(isSystemUnlocked(fresh, 'yard')).toBe(false)

    let s = armRebuildDoor(createInitialState(0))
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(isSystemUnlocked(s, 'slag')).toBe(true)
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
    expect(unlockedFoundryLogs(s).some((l) => l.id === 'slag')).toBe(true)
  })

  it('spends Rebuild Matter on hangar ranks through the shop path', () => {
    let s = createInitialState(0)
    s.prestige.prestigeCount = 1
    s.resources.prestigeMatter = 4
    expect(isSystemUnlocked(s, 'slag')).toBe(true)
    expect(canBuyMatterShop(s, 'weapon-calibration').ok).toBe(true)

    s = buyMatterShop(s, 'weapon-calibration')
    expect(shopRank(s.prestige.matterShop, 'weapon-calibration')).toBe(1)
    expect(s.resources.prestigeMatter).toBe(0)
    expect(canBuyMatterShop(s, 'weapon-calibration').ok).toBe(false)
    expect(canBuyMatterShop(s, 'weapon-calibration').reason).toMatch(/Need|Matter/)
  })

  it('uses canonical Matter names without a forced More-station tour', () => {
    expect(getMatterShopItem('weapon-calibration')?.name).toBe('Weapon Calibration')
    expect(getMatterShopItem('foundry-throughput')?.name).toBe('Foundry Throughput')
    expect(getMatterShopItem('structural-memory')?.name).toBe('Structural Memory')
    expect(MATTER_SHOP).toHaveLength(12)
    expect(GUIDE_STEPS.some((step) => step.id === 'guide-slag')).toBe(false)
  })
})
