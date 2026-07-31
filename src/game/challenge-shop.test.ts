import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyChallengeShop,
  canPrestige,
  performPrestige,
} from './actions'
import { applyOfflineCatchUp } from './offline'
import { prestigeMinSectorFor } from './catalog'

describe('challenge point shop', () => {
  it('spends CP on iron-will and boosts damage', () => {
    let state = createInitialState(0)
    state.resources.challengePoints = 1
    const before = computeShipStats(state).damage
    state = buyChallengeShop(state, 'iron-will')
    expect(state.prestige.shop).toContain('iron-will')
    expect(state.resources.challengePoints).toBe(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('early-gate lowers prestige sector requirement', () => {
    let state = createInitialState(0)
    expect(prestigeMinSectorFor([])).toBe(8)
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
    expect(state.prestige.shop).toContain('iron-will')
  })
})
