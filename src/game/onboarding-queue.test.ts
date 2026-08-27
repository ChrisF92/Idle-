import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { createFreshCareerState } from './freshStart'
import { setDocked } from './tick'
import { markHullLost } from './testHelpers'
import {
  ONBOARDING_LESSONS,
  STARTER_GUIDE_IDS,
  FOUNDRY_V2_GUIDE_IDS,
  FURNACE_V2_GUIDE_IDS,
  NETWORK_GUIDE_IDS,
  activeOnboardingLesson,
  completeLesson,
  lessonPausesSimulation,
  prepOnboardingDoor,
  skipLesson,
} from './onboarding'

function ui(tab: 'dock' | 'combat' | 'foundry' | 'network' | 'furnace' | 'research' | 'process' | 'protocols' | 'reinforce') {
  return { tab }
}

describe('onboarding queue', () => {
  it('does not show a Launch lesson on a docked baseline', () => {
    const state = createInitialState(0)
    expect(activeOnboardingLesson(state, ui('dock'))).toBeNull()
    expect(activeOnboardingLesson(state, ui('network'))).toBeNull()
  })

  it('starts a genuine new career already fighting Wave 1', () => {
    const live = createFreshCareerState(0)
    expect(live.combat.docked).toBe(false)
    expect(live.combat.inFight).toBe(true)
    expect(activeOnboardingLesson(live, ui('combat'))).toBeNull()
  })

  it('pauses for first Salvage once the player can afford Weapon Power', () => {
    const live = createFreshCareerState(0)
    live.resources.salvage = 8
    const step = activeOnboardingLesson(live, ui('combat'))
    expect(step?.id).toBe('opening.salvage')
    expect(lessonPausesSimulation(step)).toBe(true)
    expect(step?.target).toBe('onboarding.salvage.weapon-power')
  })

  it('does not offer station lessons until the player visits them', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = true
    state.meta.bestWave = 30
    expect(activeOnboardingLesson(state, ui('dock'))?.id).not.toBe('workers.assignment')
    expect(activeOnboardingLesson(state, ui('dock'))?.id).not.toBe('foundry.processing')
  })

  it('teaches Workshop after first defeat on Dock', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'first-defeat.workshop')
    const step = activeOnboardingLesson(state, ui('dock'))
    expect(step?.id).toBe('first-defeat.workshop')
    expect(step?.nav.pane).toBe('workshop')
  })

  it('only shows Worker assignment when the player opens Workers', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'workers.assignment')
    expect(activeOnboardingLesson(state, ui('dock'))?.id).not.toBe('workers.assignment')
    const step = activeOnboardingLesson(state, ui('network'))
    expect(step?.id).toBe('workers.assignment')
    expect(step?.target).toBe('onboarding.workers.salvage')
    state.base.assignments['scrap-field'] = 1
    const payoff = activeOnboardingLesson(state, ui('network'))
    expect(payoff?.id).toBe('workers.assignment')
    expect(payoff?.phase).toBe('payoff')
    expect(activeOnboardingLesson(completeLesson(state, 'workers.assignment'), ui('network'))).toBeNull()
  })

  it('teaches Foundry processing then Blueprint discovery on visit', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'foundry.processing')
    expect(activeOnboardingLesson(state, ui('dock'))?.id).not.toBe('foundry.processing')
    expect(activeOnboardingLesson(state, ui('foundry'))?.id).toBe('foundry.processing')
    state.foundry.slots[0] = { recipeId: 'recovered-stock', progress: 0.2, paid: true }
    const afterProcessing = completeLesson(state, 'foundry.processing')
    expect(activeOnboardingLesson(afterProcessing, ui('foundry'))?.id).toBe('foundry.blueprint')
    const afterBlueprint = completeLesson(afterProcessing, 'foundry.blueprint')
    expect(activeOnboardingLesson(afterBlueprint, ui('foundry'))).toBeNull()
  })

  it('lights Furnace on first open and Skip dismisses the lesson', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'furnace.channel')
    expect(activeOnboardingLesson(state, ui('furnace'))?.id).toBe('furnace.channel')
    const skipped = skipLesson(state, 'furnace.channel')
    for (const id of FURNACE_V2_GUIDE_IDS) {
      expect(skipped.meta.onboarding?.[id]).toBe('skipped')
    }
    expect(activeOnboardingLesson(skipped, ui('furnace'))).toBeNull()
  })

  it('offers Research when the player opens Research', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'research.project')
    expect(activeOnboardingLesson(state, ui('research'))?.id).toBe('research.project')
    expect(lessonPausesSimulation(activeOnboardingLesson(state, ui('research')))).toBe(false)
  })

  it('does not lecture Process, Challenges, or Reinforce until visited', () => {
    const ids = new Set(ONBOARDING_LESSONS.map((s) => s.id))
    expect(ids.has('process.capability')).toBe(true)
    expect(ids.has('challenges.start')).toBe(true)
    expect(ids.has('reinforce')).toBe(true)
    expect(ONBOARDING_LESSONS.length).toBe(16)
  })

  it('Skip on Workers dismisses that lesson only', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'workers.assignment')
    const skipped = skipLesson(state, 'workers.assignment')
    expect(skipped.meta.onboarding?.['workers.assignment']).toBe('skipped')
    expect(activeOnboardingLesson(skipped, ui('network'))).toBeNull()
    expect([...NETWORK_GUIDE_IDS]).toEqual(['workers.assignment'])
  })

  it('starter ids no longer include Launch', () => {
    expect(STARTER_GUIDE_IDS).toContain('opening.salvage')
    expect(STARTER_GUIDE_IDS).not.toContain('guide-launch')
  })

  it('Foundry group is the processing lesson only', () => {
    expect(FOUNDRY_V2_GUIDE_IDS).toEqual(['foundry.processing', 'foundry.blueprint'])
  })

  it('Directive lesson requires three real cards', () => {
    const empty = createFreshCareerState(0)
    empty.combat.directiveOffer = []
    expect(activeOnboardingLesson(empty, ui('combat'))).toBeNull()
    const state = prepOnboardingDoor(createInitialState(0), 'directives.choice')
    expect(state.combat.directiveOffer).toHaveLength(3)
    const step = activeOnboardingLesson(state, ui('combat'))
    expect(step?.id).toBe('directives.choice')
    expect(lessonPausesSimulation(step)).toBe(true)
    expect(step?.skippable).toBe(false)
  })

  it('does not auto-launch an existing docked save', () => {
    const docked = setDocked(markHullLost(createInitialState(0)), true)
    expect(docked.combat.docked).toBe(true)
    expect(docked.combat.inFight).toBe(false)
  })
})
