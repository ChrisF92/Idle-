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
  it('keeps the S10 Matter curve value below the first legal Rebuild', () => {
    const state = createInitialState(0)
    expect(prestigeGainFor(state)).toBe(6)
  })

  it('starts returning runs with scrap, data, and salvage kits', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    // 25 starter + 16 base return + 8×prestigeCount
    expect(state.resources.scrap).toBe(49)
    expect(state.resources.data).toBe(4) // scaled return kit
    expect(state.resources.salvage).toBe(19) // 14 + 5×1
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

    const control = structuredClone(state)
    control.ai.purchased = []
    control.resources.aiPoints = 0
    control.meta.highestSectorEver = 12
    const controlAfter = performPrestige(control, 1000)

    state.meta.highestSectorEver = 12
    state = performPrestige(state, 1000)
    expect(state.ai.purchased).not.toContain('focus-fire')
    expect(state.resources.aiPoints - controlAfter.resources.aiPoints).toBe(2)
  })

  it('can buy Basic Optics with farmed data and one module level from return salvage', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 12
    state = performPrestige(state, 2000)

    // Optics costs 20 Data; return kit grants a head start but still needs a short farm.
    expect(state.resources.data).toBe(4)
    state.resources.data = 40
    state = buyResearch(state, 'basic-optics')
    expect(state.research.unlocked).toContain('basic-optics')

    const before = computeShipStats(state).damage
    state.combat.docked = false
    state = upgradeModule(state, 'pulse-cannon')
    expect(state.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    expect(computeShipStats(state).damage).toBe(before)
    expect(state.resources.salvage).toBe(19)
  })
})
