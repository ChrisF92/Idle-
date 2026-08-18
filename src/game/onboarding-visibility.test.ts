import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  GUIDE_STEPS,
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  challengesContentUnlocked,
  hasHullLostOnce,
  isHubTabOpen,
  isResourceVisible,
  isSystemUnlocked,
  visibleResourceIds,
} from './progression'

describe('resource visibility gates', () => {
  it('hides data until research unlocks', () => {
    const state = createInitialState(0)
    expect(isResourceVisible(state, 'data')).toBe(false)
    expect(visibleResourceIds(state)).not.toContain('data')
    state.meta.highestSectorEver = 7
    expect(isSystemUnlocked(state, 'research')).toBe(true)
    expect(isResourceVisible(state, 'data')).toBe(true)
  })

  it('hides energy until Base; salvage waits for first hull loss', () => {
    const state = createInitialState(0)
    expect(isResourceVisible(state, 'energy')).toBe(false)
    expect(isResourceVisible(state, 'salvage')).toBe(false)
    expect(isSystemUnlocked(state, 'network')).toBe(false)
    expect(isSystemUnlocked(state, 'stats')).toBe(false)
    state.meta.hullLostOnce = true
    expect(isResourceVisible(state, 'salvage')).toBe(true)
    expect(isSystemUnlocked(state, 'network')).toBe(true)
    expect(isSystemUnlocked(state, 'stats')).toBe(true)
    state.meta.highestSectorEver = 4
    expect(isResourceVisible(state, 'energy')).toBe(true)
  })

  it('keeps the first live sortie on Sortie until hull loss', () => {
    const state = createInitialState(0)
    expect(isHubTabOpen(state, 'dock')).toBe(true)
    expect(isHubTabOpen(state, 'combat')).toBe(true)
    expect(isHubTabOpen(state, 'network')).toBe(false)
    state.combat.docked = false
    expect(isHubTabOpen(state, 'dock')).toBe(false)
    expect(isHubTabOpen(state, 'combat')).toBe(true)
    expect(isHubTabOpen(state, 'stats')).toBe(false)
    state.meta.hullLostOnce = true
    expect(hasHullLostOnce(state)).toBe(true)
    expect(isHubTabOpen(state, 'dock')).toBe(true)
    expect(isHubTabOpen(state, 'network')).toBe(true)
  })

  it('hides PM/CP until earned', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
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

describe('Hiveworks onboarding catalog', () => {
  it('keeps a short action catalog and drops door-dragging tours', () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id))
    for (const id of [
      'guide-launch',
      'guide-sortie-fire',
      'guide-salvage-first',
      'guide-upgrade-pulse',
      'guide-network-strike',
      'guide-foundry-recipe',
      'guide-furnace-light',
      'guide-research-focus',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
    for (const id of [
      'guide-sortie-field',
      'guide-drone-cap',
      'guide-foundry-what',
      'guide-reliquary',
      'guide-furnace-v2-ash',
      'guide-research-xp',
      'guide-protocols',
      'guide-echo',
      'guide-process-v2-what',
      'guide-prestige-tab',
      'guide-core-tab',
    ]) {
      expect(ids.has(id)).toBe(false)
    }
  })

  it('does not auto-open Reliquary, Protocols, or Echo from More', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 22
    state.prestige.prestigeCount = 3
    state.base.assignments.strike = 1
    state.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(isSystemUnlocked(state, 'reliquary')).toBe(true)
    expect(isSystemUnlocked(state, 'protocols')).toBe(true)
    expect(isSystemUnlocked(state, 'echo')).toBe(true)
    expect(activeGuideStep(state, 'stats')).toBeNull()
    expect(challengesContentUnlocked(state)).toBe(false)
    state.meta.act1Cleared = true
    expect(challengesContentUnlocked(state)).toBe(true)
  })
})
