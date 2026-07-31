import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  GUIDE_STEPS,
  activeGuideStep,
  challengesContentUnlocked,
  isResourceVisible,
  isSystemUnlocked,
  visibleResourceIds,
} from './progression'

describe('resource visibility gates', () => {
  it('hides data until research unlocks', () => {
    const state = createInitialState(0)
    expect(isResourceVisible(state, 'data')).toBe(false)
    expect(visibleResourceIds(state)).not.toContain('data')
    state.meta.highestSectorEver = 5
    expect(isSystemUnlocked(state, 'research')).toBe(true)
    expect(isResourceVisible(state, 'data')).toBe(true)
  })

  it('hides energy until Base, salvage until first clear', () => {
    const state = createInitialState(0)
    expect(isResourceVisible(state, 'energy')).toBe(false)
    expect(isResourceVisible(state, 'salvage')).toBe(false)
    state.meta.highestSectorEver = 3
    expect(isResourceVisible(state, 'energy')).toBe(true)
    state.combat.highestSector = 1
    expect(isResourceVisible(state, 'salvage')).toBe(true)
  })

  it('hides PM/CP until earned', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 5
    expect(isResourceVisible(state, 'prestigeMatter')).toBe(false)
    expect(isResourceVisible(state, 'challengePoints')).toBe(false)
    state.resources.prestigeMatter = 1
    expect(isResourceVisible(state, 'prestigeMatter')).toBe(true)
    state.resources.challengePoints = 1
    expect(isResourceVisible(state, 'challengePoints')).toBe(true)
    expect(visibleResourceIds(state)).toEqual(
      expect.arrayContaining(['prestigeMatter', 'challengePoints']),
    )
  })
})

describe('expanded onboarding catalog', () => {
  it('covers fab, core, signal, shops, challenges, ascension', () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id))
    for (const id of [
      'guide-power-grid',
      'guide-sensor-net',
      'guide-alloy-foundry',
      'guide-salvage',
      'guide-part-drop',
      'guide-module-fab',
      'guide-essence',
      'guide-codex-tab',
      'guide-core-tab',
      'guide-train-logistics',
      'guide-matter-shop',
      'guide-signal-cores',
      'guide-challenges',
      'guide-challenge-shop',
      'guide-ascension',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
  })

  it('offers power-grid after scrap assign', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.base.workerDrones = 2
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-base-tab',
      'guide-assign-scrap',
    ]
    expect(activeGuideStep(state, 'base')?.id).toBe('guide-power-grid')
  })

  it('keeps challenges UI closed until Act 1 (sector 30) is cleared', () => {
    const state = createInitialState(0)
    state.prestige.prestigeCount = 3
    state.combat.sector = 8
    expect(challengesContentUnlocked(state)).toBe(false)
    state.meta.act1Cleared = true
    expect(challengesContentUnlocked(state)).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-challenge-shop')).toBe(true)

    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-base-tab',
      'guide-assign-scrap',
      'guide-power-grid',
      'guide-research-tab',
      'guide-sensor-net',
      'guide-salvage',
      'guide-essence',
      'guide-ai-tab',
      'guide-achievements',
      'guide-prestige-tab',
      'guide-prestige-ready',
      'guide-matter-shop',
      'guide-signal-cores',
      'guide-ascension',
    ]
    expect(activeGuideStep(state, 'prestige')?.id).toBe('guide-challenges')
    expect(activeGuideStep(state, 'prestige')?.target).toBe('challenges-subtab')
  })
})
