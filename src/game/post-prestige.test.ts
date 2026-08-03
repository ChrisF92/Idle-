import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyAiNode,
  buyResearch,
  performPrestige,
  prestigeGainFor,
  upgradeModule,
} from './actions'
import { moduleUpgradeCost } from './catalog'
import { extractExpedition } from './expedition'

describe('post-prestige re-push balance', () => {
  it('grants interpolated PM for wave-50 Extract', () => {
    const state = createInitialState(0)
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    expect(prestigeGainFor(state)).toBe(10)
  })

  it('starts returning runs with scrap, data, and salvage kits', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    // 25 starter + 10 base return + 6×prestigeCount
    expect(state.resources.scrap).toBe(41)
    expect(state.resources.data).toBe(3)
    expect(state.resources.salvage).toBe(9)
  })

  it('refunds doctrine AI Points on prestige', () => {
    let state = createInitialState(0)
    state.meta.completedAchievements = ['neural-link']
    state.meta.aiUnlocked = true
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'focus-fire')
    expect(state.ai.purchased).toContain('focus-fire')
    expect(state.resources.aiPoints).toBe(0)

    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state = performPrestige(state, 1000)
    expect(state.ai.purchased).not.toContain('focus-fire')
    expect(state.resources.aiPoints).toBe(4)
  })

  it('can buy Basic Optics with farmed data and one module level from return salvage', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state = performPrestige(state, 2000)
    state.resources.data = 40
    state.meta.highestSectorEver = 10
    // Research purchases are not gated here beyond cost; buy directly.
    state = buyResearch(state, 'basic-optics')
    expect(state.research.unlocked).toContain('basic-optics')
    const cost = moduleUpgradeCost('pulse-cannon', 0)
    expect(state.resources.salvage).toBeGreaterThanOrEqual(cost.salvage ?? 0)
    state = upgradeModule(state, 'pulse-cannon')
    expect(state.shipyard.moduleLevels['pulse-cannon']).toBe(1)
    expect(computeShipStats(state).damage).toBeGreaterThan(0)
  })

  it('Extract grants 5% more PM than Defeat at the same wave', () => {
    let extract = createInitialState(0)
    extract.meta.highestWaveEver = 50
    extract.combat.bestWaveThisRun = 50
    extract = extractExpedition(extract)
    expect(extract.resources.prestigeMatter).toBeCloseTo(10.5, 5)
  })
})
