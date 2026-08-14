import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyAiNode, buyResearch, performPrestige } from './actions'
import {
  ACHIEVEMENTS,
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  isSystemUnlocked,
  maybeGrantSystemUnlocks,
  tryCompleteAchievements,
} from './progression'

describe('achievements and AI unlock', () => {
  it('keeps AI locked until the first achievement', () => {
    const state = createInitialState(0)
    expect(isSystemUnlocked(state, 'ai')).toBe(false)
    expect(state.meta.aiUnlocked).toBe(false)
  })

  it('unlocks AI and grants points on First Blood (sector 1)', () => {
    const state = createInitialState(0)
    state.combat.highestSector = 1
    const newly = tryCompleteAchievements(state)
    expect(newly).toContain('first-blood')
    expect(state.meta.aiUnlocked).toBe(true)
    expect(isSystemUnlocked(state, 'ai')).toBe(true)
    expect(state.meta.completedAchievements).toContain('first-blood')
    expect(state.resources.aiPoints).toBe(1)
  })

  it('does not re-grant an already completed achievement', () => {
    const state = createInitialState(0)
    state.combat.highestSector = 1
    tryCompleteAchievements(state)
    const points = state.resources.aiPoints
    const again = tryCompleteAchievements(state)
    expect(again).toEqual([])
    expect(state.resources.aiPoints).toBe(points)
  })

  it('grants Archive Seed when research is purchased', () => {
    let state = createInitialState(0)
    state.combat.highestSector = 5
    state.meta.highestSectorEver = 8
    tryCompleteAchievements(state)
    const before = state.resources.aiPoints
    state.resources.data = 50
    state = buyResearch(state, 'basic-optics')
    expect(state.meta.completedAchievements).toContain('first-research')
    expect(state.resources.aiPoints).toBeGreaterThan(before)
  })

  it('grants Neural Link when an AI node is purchased', () => {
    let state = createInitialState(0)
    state.combat.highestSector = 1
    tryCompleteAchievements(state)
    state.resources.aiPoints = 2
    state = buyAiNode(state, 'auto-engage')
    expect(state.ai.purchased).toContain('auto-engage')
    expect(state.meta.completedAchievements).toContain('neural-link')
  })

  it('grants Soft Reset on prestige and keeps unspent AI points', () => {
    let state = createInitialState(0)
    state.combat.highestSector = 8
    state.meta.highestSectorEver = 8
    state.combat.sector = 10
    maybeGrantSystemUnlocks(state)
    state.resources.aiPoints = 4
    state = performPrestige(state, 1000)
    expect(state.prestige.prestigeCount).toBe(1)
    expect(state.meta.completedAchievements).toContain('first-prestige')
    expect(state.meta.aiUnlocked).toBe(true)
    // 4 kept + Soft Reset reward (2)
    expect(state.resources.aiPoints).toBe(6)
  })

  it('offers prestige and AI guide steps when those systems unlock', () => {
    const prestigeState = createInitialState(0)
    prestigeState.meta.highestSectorEver = 8
    prestigeState.meta.seenOnboarding = [
      ...STARTER_GUIDE_IDS,
      ...NETWORK_GUIDE_IDS,
      'guide-foundry',
      'guide-reliquary',
      'guide-furnace',
      'guide-research-tab',
      'guide-salvage',
      'guide-codex-tab',
      'guide-ai-tab',
      'guide-achievements',
    ]
    expect(activeGuideStep(prestigeState, 'combat')?.id).toBe('guide-prestige-tab')

    const aiState = createInitialState(0)
    aiState.meta.aiUnlocked = true
    aiState.meta.completedAchievements = ['first-blood']
    aiState.meta.seenOnboarding = [
      ...STARTER_GUIDE_IDS,
      ...NETWORK_GUIDE_IDS,
      'guide-foundry',
      'guide-reliquary',
      'guide-furnace',
      'guide-research-tab',
      'guide-salvage',
    ]
    expect(activeGuideStep(aiState, 'combat')?.id).toBe('guide-ai-tab')

    aiState.meta.seenOnboarding = [...aiState.meta.seenOnboarding, 'guide-ai-tab']
    expect(activeGuideStep(aiState, 'process')?.id).toBe('guide-achievements')
  })

  it('lists a stable achievement catalog with AI rewards', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(5)
    expect(ACHIEVEMENTS.every((a) => a.rewardAiPoints > 0)).toBe(true)
  })
})
