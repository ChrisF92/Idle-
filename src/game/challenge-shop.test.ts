import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyChallengeShop,
  enterChallenge,
  performPrestige,
  unlockModule,
} from './actions'
import { armRebuildDoor } from './testHelpers'
import { canRebuild } from './rebuild'
import { applyOfflineCatchUp } from './offline'
import {
  canBuyChallengeShop,
  challengeShopMatchupBonus,
  challengeShopOfflineMs,
  effectiveMaxClears,
  getChallenge,
  shopRank,
} from './catalog'

describe('challenge point shop', () => {
  it('spends CP on iron-will and boosts matchup (not raw damage)', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 1
    const beforeMatchup = challengeShopMatchupBonus(state.prestige.shop)
    const bankedDmg = computeShipStats(state).damage
    state = buyChallengeShop(state, 'iron-will')
    expect(shopRank(state.prestige.shop, 'iron-will')).toBe(1)
    expect(state.resources.challengePoints).toBe(0)
    expect(challengeShopMatchupBonus(state.prestige.shop)).toBeCloseTo(beforeMatchup + 0.06)
    // Matchup sink: spending banked CP into Iron Will must not raise raw damage.
    expect(computeShipStats(state).damage).toBeLessThan(bankedDmg)
    expect(computeShipStats(state).damage).toBe(
      computeShipStats(createInitialState(0)).damage,
    )
  })

  it('Early Gate is gone and cannot lower the Rebuild door', () => {
    const state = createInitialState(0)
    expect(canBuyChallengeShop(state, 'early-gate').ok).toBe(false)
    state.resources.challengePoints = 1
    const after = buyChallengeShop(state, 'early-gate')
    expect(after.prestige.shop['early-gate'] ?? 0).toBe(0)
    const eligible = createInitialState(0)
    eligible.meta.bestWave = 50
    eligible.combat.bestWave = 50
    eligible.combat.docked = true
    eligible.prestige.cycle.normalSortiesCompleted = 8
    eligible.prestige.shop['early-gate'] = 1
    expect(canRebuild(eligible)).toBe(false)
  })

  it('supply-cache and doctrine-seed do not apply on normal Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.resources.challengePoints = 3
    state = buyChallengeShop(state, 'supply-cache')
    state = buyChallengeShop(state, 'doctrine-seed')
    const ai = state.resources.aiPoints
    state = performPrestige(state, 5000)
    expect(state.resources.scrap).toBe(0)
    expect(state.resources.aiPoints).toBe(ai)
    expect(state.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('hangar-rights does not grant starting salvage on normal Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.resources.challengePoints = 2
    state = buyChallengeShop(state, 'hangar-rights')
    state = performPrestige(state, 5000)
    expect(state.resources.salvage).toBe(0)
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
    state = armRebuildDoor(state)
    state = performPrestige(state, 8000)
    expect(shopRank(state.prestige.shop, 'iron-will')).toBe(1)
  })

  it('ranks stackable run-kits and iron-will', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 10
    state = buyChallengeShop(state, 'supply-cache')
    state = buyChallengeShop(state, 'supply-cache')
    expect(shopRank(state.prestige.shop, 'supply-cache')).toBe(2)
    state = armRebuildDoor(state)
    state = performPrestige(state, 5000)
    expect(state.resources.scrap).toBe(0)
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

  it('applies starting kits only when entering a Challenge', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.meta.act1Cleared = true
    state.meta.bestWave = 1000
    state.resources.challengePoints = 5
    state = buyChallengeShop(state, 'supply-cache')
    state = buyChallengeShop(state, 'hangar-rights')
    state = buyChallengeShop(state, 'doctrine-seed')
    const ai = state.resources.aiPoints
    state = performPrestige(state, 5000)
    expect(state.resources.scrap).toBe(0)
    expect(state.resources.salvage).toBe(0)
    state.meta.act1Cleared = true
    state = enterChallenge(state, 'no-ai')
    expect(state.resources.scrap).toBe(20)
    expect(state.resources.salvage).toBe(10)
    expect(state.resources.aiPoints).toBe(ai + 1)
  })
})
