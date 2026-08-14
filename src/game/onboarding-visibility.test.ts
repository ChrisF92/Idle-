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
    state.meta.highestSectorEver = 7
    expect(isSystemUnlocked(state, 'research')).toBe(true)
    expect(isResourceVisible(state, 'data')).toBe(true)
  })

  it('hides energy until Base; salvage is always on (Cores)', () => {
    const state = createInitialState(0)
    expect(isResourceVisible(state, 'energy')).toBe(false)
    expect(isResourceVisible(state, 'salvage')).toBe(true)
    state.meta.highestSectorEver = 4
    expect(isResourceVisible(state, 'energy')).toBe(true)
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

const EARLY_SEEN = [
  'guide-shipyard-tab',
  'guide-frame-select',
  'guide-launch',
  'guide-drone-cap',
  'guide-salvage-lesson',
  'guide-upgrade-pulse',
  'guide-upgrade-plate',
  'guide-foundry',
]

describe('Hiveworks onboarding catalog', () => {
  it('covers live Dock, Network, Foundry, and More doors', () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id))
    for (const id of [
      'guide-launch',
      'guide-drone-cap',
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-reliquary',
      'guide-reliquary-slots',
      'guide-furnace',
      'guide-furnace-bank',
      'guide-codex-tab',
      'guide-codex-families',
      'guide-challenges',
      'guide-protocols',
      'guide-echo',
      'guide-specialists',
      'guide-tasks',
      'guide-capital',
      'guide-reinforce',
      'guide-logs',
      'guide-prestige-tab',
      'guide-prestige-ready',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
    for (const id of [
      'guide-core-tab',
      'guide-train-logistics',
      'guide-matter-shop',
      'guide-signal-cores',
      'guide-challenge-shop',
      'guide-ascension',
      'guide-base-tab',
      'guide-unlock-plate',
    ]) {
      expect(ids.has(id)).toBe(false)
    }
  })

  it('offers Reliquary after early dock and Network lessons', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 4
    state.base.workerDrones = 2
    state.base.assignments['strike'] = 1
    state.meta.seenOnboarding = EARLY_SEEN
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-reliquary')
  })

  it('opens Protocols at sector 18 and Echo at 22', () => {
    const state = createInitialState(0)
    state.prestige.prestigeCount = 3
    state.combat.sector = 10
    expect(challengesContentUnlocked(state)).toBe(false)
    expect(isSystemUnlocked(state, 'protocols')).toBe(false)
    expect(isSystemUnlocked(state, 'echo')).toBe(false)
    state.meta.act1Cleared = true
    expect(challengesContentUnlocked(state)).toBe(true)

    state.meta.highestSectorEver = 18
    expect(isSystemUnlocked(state, 'protocols')).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-protocols')).toBe(true)

    state.meta.seenOnboarding = [
      ...EARLY_SEEN,
      'guide-reliquary',
      'guide-furnace',
      'guide-research-tab',
      'guide-salvage',
      'guide-codex-tab',
      'guide-ai-tab',
      'guide-achievements',
      'guide-prestige-tab',
      'guide-prestige-ready',
      'guide-yard',
      'guide-slag',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-protocols')
    expect(activeGuideStep(state, 'stats')?.target).toBe('station-protocols')

    state.meta.highestSectorEver = 22
    state.meta.seenOnboarding = [...state.meta.seenOnboarding, 'guide-protocols', 'guide-challenges']
    expect(isSystemUnlocked(state, 'echo')).toBe(true)
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-echo')
  })
})
