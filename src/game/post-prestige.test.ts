import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyAiNode,
  buyResearch,
  performPrestige,
  prestigeGainFor,
  upgradeModule,
} from './actions'

describe('post-prestige re-push balance', () => {
  it('grants 5 PM on first sector-8 prestige', () => {
    const state = createInitialState(0)
    state.combat.sector = 8
    expect(prestigeGainFor(state)).toBe(5)
  })

  it('starts returning runs with scrap, data, and salvage kits', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.resources.scrap).toBe(45) // 25 starter + 20 return
    expect(state.resources.data).toBe(12)
    expect(state.resources.salvage).toBe(12)
  })

  it('refunds doctrine AI Points on prestige', () => {
    let state = createInitialState(0)
    // Avoid Neural Link achievement noise — mark it done, spend exact cost.
    state.meta.completedAchievements = ['neural-link']
    state.meta.aiUnlocked = true
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'focus-fire')
    expect(state.ai.purchased).toContain('focus-fire')
    expect(state.resources.aiPoints).toBe(0)

    state.combat.sector = 8
    state = performPrestige(state, 1000)
    expect(state.ai.purchased).not.toContain('focus-fire')
    // Refund 2 + Soft Reset achievement (+2)
    expect(state.resources.aiPoints).toBe(4)
  })

  it('can buy Basic Optics and one module level immediately after prestige', () => {
    let state = createInitialState(0)
    state.combat.sector = 8
    state = performPrestige(state, 2000)

    state = buyResearch(state, 'basic-optics')
    expect(state.research.unlocked).toContain('basic-optics')

    const before = computeShipStats(state).damage
    state = upgradeModule(state, 'pulse-cannon')
    expect(state.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
    expect(state.resources.salvage).toBe(6) // 12 - 6
  })
})
