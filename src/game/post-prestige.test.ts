import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  buyAiNode,
  buyResearch,
  performPrestige,
  upgradeModule,
} from './actions'
import { armRebuildDoor } from './testHelpers'
import { matterGainFor, matterScoresFrom } from './rebuild'

describe('post-rebuild re-push balance', () => {
  it('uses the canonical Matter curve, not the old S10 kit value', () => {
    const state = createInitialState(0)
    expect(matterGainFor(state)).toBe(matterScoresFrom(0, 0).total)
    expect(matterGainFor(state)).toBe(1)
  })

  it('Rebuild no longer grants hidden return kits', () => {
    let state = armRebuildDoor(createInitialState(0))
    const dataBefore = state.resources.data
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.resources.salvage).toBe(0)
    expect(state.resources.data).toBe(dataBefore)
    expect(state.prestige.cycle.scrapGenerated).toBe(0)
  })

  it('refunds doctrine AI Points on Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state.meta.completedAchievements = ['neural-link']
    state.meta.aiUnlocked = true
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'focus-fire')
    expect(state.ai.purchased).toContain('focus-fire')
    expect(state.resources.aiPoints).toBe(0)

    const control = structuredClone(state)
    control.ai.purchased = []
    control.resources.aiPoints = 0
    const controlAfter = performPrestige(control, 1000)

    state = performPrestige(state, 1000)
    expect(state.ai.purchased).not.toContain('focus-fire')
    expect(state.resources.aiPoints - controlAfter.resources.aiPoints).toBe(2)
  })

  it('cannot buy Core Levels with Salvage after Rebuild', () => {
    let state = armRebuildDoor(createInitialState(0))
    state = performPrestige(state, 2000)
    state.resources.data = 40
    state = buyResearch(state, 'basic-optics')
    expect(state.research.unlocked).toContain('basic-optics')

    const before = computeShipStats(state).damage
    state.combat.docked = false
    state = upgradeModule(state, 'pulse-cannon')
    expect(state.combat.coreRunLevels?.['0'] ?? 0).toBe(0)
    expect(computeShipStats(state).damage).toBe(before)
  })
})
