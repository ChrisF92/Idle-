import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { createFreshCareerState } from './freshStart'
import { markHullLost } from './testHelpers'
import { setDocked } from './tick'
import { buyRunUpgrade, buyWorkshopUpgrade, unfitModule } from './actions'
import {
  ONBOARDING_LESSON_IDS,
  ONBOARDING_LESSONS,
  activeOnboardingLesson,
  completeLesson,
  lessonFinished,
  lessonPausesSimulation,
  prepOnboardingDoor,
  skipLesson,
  type OnboardingLessonId,
} from './onboarding'
import { enqueueToasts, selectPresentation } from './presentation'

const TAB_FOR: Record<OnboardingLessonId, Parameters<typeof activeOnboardingLesson>[1]['tab']> = {
  'opening.salvage': 'combat',
  'first-defeat.workshop': 'dock',
  'foundry.processing': 'foundry',
  'foundry.blueprint': 'foundry',
  'workers.assignment': 'network',
  'directives.choice': 'combat',
  'rebuild.preview': 'dock',
  'rebuild.matter': 'dock',
  'extraction.first-use': 'combat',
  'relic.install': 'dock',
  'furnace.channel': 'furnace',
  'research.project': 'research',
  'process.capability': 'process',
  'challenges.start': 'challenges',
  reinforce: 'reinforce',
  'combat-overlay.ranges': 'combat',
}

function actionToast() {
  return enqueueToasts(
    [],
    [
      {
        id: 'sys:foundry',
        category: 'SYSTEM ONLINE',
        title: 'Foundry online',
        body: 'Recovered material can now be processed.',
        tier: 'action',
        action: { label: 'OPEN', nav: { kind: 'tab', tab: 'foundry', pane: 'processing' } },
      },
    ],
    1,
  )
}

describe('onboarding doors', () => {
  it('covers every lesson with a matching screen, pane, and target', () => {
    expect(ONBOARDING_LESSON_IDS).toHaveLength(16)
    for (const id of ONBOARDING_LESSON_IDS) {
      const lesson = ONBOARDING_LESSONS.find((row) => row.id === id)!
      const state = prepOnboardingDoor(createInitialState(0), id)
      const ui =
        id === 'combat-overlay.ranges'
          ? { tab: TAB_FOR[id], combatOverlayOpen: true as const }
          : { tab: TAB_FOR[id] }
      const step = activeOnboardingLesson(state, ui)
      expect(step?.id, id).toBe(id)
      expect(step?.nav.tab, id).toBe(lesson.nav.tab)
      expect(step?.target, id).toBe(lesson.target)
      if (lesson.nav.pane) expect(step?.nav.pane, id).toBe(lesson.nav.pane)
      expect(lessonFinished(state, id)).toBe(false)

      const shown = selectPresentation(state, ui, actionToast(), {})
      expect(shown?.kind, id).toBe('onboarding')
      expect(shown?.id, id).toBe(`onboarding:${id}`)

      const finished = completeLesson(state, id)
      expect(lessonFinished(finished, id)).toBe(true)
      expect(activeOnboardingLesson(finished, ui)?.id).not.toBe(id)
    }
  })

  it('does not overlap a Sortie Report with Workshop or a toast', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'first-defeat.workshop')
    expect(selectPresentation(state, { tab: 'dock', reportOpen: true }, actionToast(), { reportOpen: true })).toBeNull()
    const after = selectPresentation(state, { tab: 'dock' }, actionToast(), {})
    expect(after?.kind).toBe('onboarding')
    expect(after?.id).toBe('onboarding:first-defeat.workshop')
  })

  it('keeps Salvage paused and Directives unskippable', () => {
    const salvage = activeOnboardingLesson(
      prepOnboardingDoor(createInitialState(0), 'opening.salvage'),
      { tab: 'combat' },
    )
    expect(lessonPausesSimulation(salvage)).toBe(true)
    const directives = activeOnboardingLesson(
      prepOnboardingDoor(createInitialState(0), 'directives.choice'),
      { tab: 'combat' },
    )
    expect(directives?.skippable).toBe(false)
    expect(skipLesson(prepOnboardingDoor(createInitialState(0), 'directives.choice'), 'directives.choice').meta.onboarding?.[
      'directives.choice'
    ]).toBeUndefined()
  })

  it('does not repeat Salvage after the purchase', () => {
    let state = prepOnboardingDoor(createInitialState(0), 'opening.salvage')
    state = buyRunUpgrade(state, 'weapon-power', 1)
    expect(activeOnboardingLesson(state, { tab: 'combat' })?.id).not.toBe('opening.salvage')
  })

  it('shows Workshop payoff after the first Scrap buy', () => {
    let state = prepOnboardingDoor(createInitialState(0), 'first-defeat.workshop')
    state = buyWorkshopUpgrade(state, 'weapon-power', 1)
    const payoff = activeOnboardingLesson(state, { tab: 'dock' })
    expect(payoff?.id).toBe('first-defeat.workshop')
    expect(payoff?.phase).toBe('payoff')
    expect(payoff?.body.join(' ')).toMatch(/Lv1|stronger/i)
  })

  it('completes Combat Overlay ranges only after a physical Core is selected', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'combat-overlay.ranges')
    const open = { tab: 'combat' as const, combatOverlayOpen: true as const, combatOverlaySelectedCoreId: null }
    const step = activeOnboardingLesson(state, open)
    expect(step?.id).toBe('combat-overlay.ranges')
    expect(step?.completeOnTap).toBe(false)
    expect(
      activeOnboardingLesson(state, { ...open, combatOverlaySelectedCoreId: 'pulse-cannon:1' }),
    ).toBeNull()
    expect(lessonFinished(state, 'combat-overlay.ranges')).toBe(false)

    const empty = unfitModule(state, 'pulse-cannon')
    expect(
      activeOnboardingLesson(empty, { tab: 'combat', combatOverlayOpen: true }),
    ).toBeNull()
    expect(lessonFinished(empty, 'combat-overlay.ranges')).toBe(false)
  })
})

describe('new save vs existing docked save', () => {
  it('starts a genuine new career in Wave 1 combat', () => {
    const fresh = createFreshCareerState(0)
    expect(fresh.combat.docked).toBe(false)
    expect(fresh.combat.inFight).toBe(true)
    expect(fresh.combat.wave).toBe(1)
    expect(activeOnboardingLesson(fresh, { tab: 'combat' })).toBeNull()
  })

  it('does not auto-launch an existing docked save', () => {
    const existing = setDocked(markHullLost(createInitialState(0)), true)
    expect(existing.combat.docked).toBe(true)
    expect(existing.combat.inFight).toBe(false)
    expect(activeOnboardingLesson(existing, { tab: 'dock' })?.id).not.toBe('opening.salvage')
  })
})
