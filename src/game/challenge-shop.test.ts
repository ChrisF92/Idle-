import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyChallengeShop,
  canPrestige,
  performPrestige,
  unlockModule,
} from './actions'
import { applyOfflineCatchUp } from './offline'
import {
  canBuyChallengeShop,
  challengeShopOfflineMs,
  effectiveMaxClears,
  getChallenge,
  prestigeMinSectorFor,
  shopRank,
} from './catalog'

describe('challenge point shop', () => {
  it('spends CP on iron-will and boosts damage', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 1
    const before = computeShipStats(state).damage
    state = buyChallengeShop(state, 'iron-will')
    expect(shopRank(state.prestige.shop, 'iron-will')).toBe(1)
    expect(state.resources.challengePoints).toBe(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('early-gate lowers prestige sector requirement', () => {
    let state = createInitialState(0)
    expect(prestigeMinSectorFor({})).toBe(8)
    state.resources.challengePoints = 1
    state = buyChallengeShop(state, 'early-gate')
    expect(prestigeMinSectorFor(state.prestige.shop)).toBe(6)
    state.combat.sector = 6
    expect(canPrestige(state)).toBe(true)
  })

  it('supply-cache and doctrine-seed apply after prestige', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 3
    state = buyChallengeShop(state, 'supply-cache')
    state = buyChallengeShop(state, 'doctrine-seed')
    state.combat.sector = 8
    state = performPrestige(state, 5000)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(65) // 25 base + 40
    expect(state.resources.aiPoints).toBeGreaterThanOrEqual(1)
  })

  it('hangar-rights grants starting salvage after prestige', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 2
    state = buyChallengeShop(state, 'hangar-rights')
    state.combat.sector = 8
    state = performPrestige(state, 5000)
    expect(state.resources.salvage).toBeGreaterThanOrEqual(20)
  })

  it('deep-cache extends offline cap', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 2
    state = buyChallengeShop(state, 'deep-cache')
    const away = 10 * 60 * 60 * 1000 // 10h
    const { report } = applyOfflineCatchUp(state, away)
    expect(report?.capped).toBe(false)
    expect(report?.appliedMs).toBe(away)
  })

  it('keeps shop purchases across prestige', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 1
    state = buyChallengeShop(state, 'iron-will')
    state.combat.sector = 8
    state = performPrestige(state, 8000)
    expect(shopRank(state.prestige.shop, 'iron-will')).toBe(1)
  })

  it('ranks stackable run-kits and iron-will', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 10
    state = buyChallengeShop(state, 'supply-cache')
    state = buyChallengeShop(state, 'supply-cache')
    expect(shopRank(state.prestige.shop, 'supply-cache')).toBe(2)
    state.combat.sector = 8
    state = performPrestige(state, 5000)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(105) // 25 + 20 return + 80
  })

  it('schematic-surge unlocks surge-capacitor module', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.resources.challengePoints = 3
    state = buyChallengeShop(state, 'schematic-surge')
    expect(shopRank(state.prestige.shop, 'schematic-surge')).toBe(1)
    expect(state.shipyard.unlockedModules).toContain('surge-capacitor')
  })

  it('schematic modules cannot scrap-unlock without shop rank', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state = unlockModule(state, 'mirror-plate')
    expect(state.shipyard.unlockedModules).not.toContain('mirror-plate')
    state.prestige.prestigeCount = 1
    state.resources.challengePoints = 3
    state = buyChallengeShop(state, 'schematic-mirror')
    expect(state.shipyard.unlockedModules).toContain('mirror-plate')
  })

  it('deep-vault requires deep-cache and meta gate', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 10
    expect(canBuyChallengeShop(state, 'deep-vault').ok).toBe(false)
    state = buyChallengeShop(state, 'deep-cache')
    expect(canBuyChallengeShop(state, 'deep-vault').ok).toBe(false)
    state.prestige.prestigeCount = 3
    state = buyChallengeShop(state, 'deep-vault')
    expect(shopRank(state.prestige.shop, 'deep-vault')).toBe(1)
    expect(challengeShopOfflineMs(state.prestige.shop)).toBe(24 * 60 * 60 * 1000)
  })

  it('clearance-board raises effective max clears', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 3
    state.prestige.prestigeCount = 2
    const def = getChallenge('no-ai')!
    expect(effectiveMaxClears(def, {})).toBe(def.maxClears)
    state = buyChallengeShop(state, 'clearance-board')
    expect(effectiveMaxClears(def, state.prestige.shop)).toBe(def.maxClears + 5)
  })
})
