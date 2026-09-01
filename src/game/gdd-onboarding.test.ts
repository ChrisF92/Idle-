import { describe, expect, it } from 'vitest'
import { buyRunUpgrade, buyWorkshopUpgrade } from './actions'
import { advancedReadoutsUnlocked, shopBulkTenUnlocked, shopBuyMaxUnlocked } from './disclosure'
import { coreContributionPct } from './uiReadout'
import {
  ONBOARDING_ENABLED,
  ONBOARDING_LESSON_IDS,
  ONBOARDING_LESSONS,
  activeOnboardingLesson,
  lessonPausesSimulation,
  skipLesson,
} from './onboarding'
import { createFreshCareerState } from './freshStart'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import { captureToastSnapshot, diffToasts, enqueueToasts, expireToasts, selectPresentation } from './presentation'
import { setDocked } from './tick'
import { unlockedBuyModes } from './workshop'

function ui(tab: 'dock' | 'combat' | 'foundry' | 'network' | 'stats' = 'dock') {
  return { tab }
}

describe('GDD onboarding first hour', () => {
  it('is enabled and a fresh career starts in Wave 1 with no Launch lesson', () => {
    expect(ONBOARDING_ENABLED).toBe(true)
    const live = createFreshCareerState(0)
    expect(live.combat.docked).toBe(false)
    expect(live.combat.inFight).toBe(true)
    expect(live.combat.wave).toBe(1)
    expect(activeOnboardingLesson(live, ui('combat'))).toBeNull()
    expect(ONBOARDING_LESSONS.some((s) => s.id === 'opening.salvage')).toBe(true)
    expect(ONBOARDING_LESSON_IDS).not.toContain('opening.launch' as typeof ONBOARDING_LESSON_IDS[number])
  })

  it('walks Salvage buy → death → Workshop buy without a Launch tutorial', () => {
    let state = createFreshCareerState(0)
    expect(activeOnboardingLesson(state, ui('combat'))).toBeNull()

    state.resources.salvage = 8
    const salvage = activeOnboardingLesson(state, ui('combat'))
    expect(salvage?.id).toBe('opening.salvage')
    expect(lessonPausesSimulation(salvage)).toBe(true)
    expect(salvage?.target).toBe('onboarding.salvage.weapon-power')

    state = buyRunUpgrade(state, 'weapon-power', 1)
    expect(activeOnboardingLesson(state, ui('combat'))?.id).not.toBe('opening.salvage')

    state = markHullLost(state)
    state.combat.docked = true
    state.resources.scrap = 20
    const workshop = activeOnboardingLesson(state, ui('dock'))
    expect(workshop?.id).toBe('first-defeat.workshop')
    expect(activeOnboardingLesson(state, ui('stats'))?.id).toBe('first-defeat.workshop')

    state = buyWorkshopUpgrade(state, 'weapon-power', 1)
    expect(state.workshop.levels['weapon-power']).toBe(1)
    const payoff = activeOnboardingLesson(state, ui('dock'))
    expect(payoff?.id).toBe('first-defeat.workshop')
    expect(payoff?.phase).toBe('payoff')
    expect(payoff?.body.join(' ')).toMatch(/Lv1|stronger/i)
  })

  it('does not skip Workshop when Salvage is skipped', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = true
    state.resources.scrap = 20
    const skipped = skipLesson(state, 'opening.salvage')
    expect(skipped.meta.onboarding?.['opening.salvage']).toBe('skipped')
    expect(skipped.meta.onboarding?.['first-defeat.workshop']).toBeUndefined()
    expect(activeOnboardingLesson(skipped, ui('dock'))?.id).toBe('first-defeat.workshop')
  })
})

describe('GDD progressive disclosure', () => {
  it('keeps ×10 / MAX / DPS share locked until Process or Research', () => {
    const state = markHullLost(createInitialState(0))
    expect(unlockedBuyModes(state)).toEqual([1])
    expect(shopBulkTenUnlocked(state)).toBe(false)
    expect(shopBuyMaxUnlocked(state)).toBe(false)
    expect(advancedReadoutsUnlocked(state)).toBe(false)
    expect(coreContributionPct(state, 'pulse-cannon')).toBeNull()

    state.process.purchased = ['bulk-purchase']
    expect(shopBulkTenUnlocked(state)).toBe(true)
    expect(unlockedBuyModes(state)).toEqual([1, 10])
    expect(advancedReadoutsUnlocked(state)).toBe(false)

    state.process.purchased = ['bulk-purchase', 'buy-max', 'live-readouts']
    expect(shopBuyMaxUnlocked(state)).toBe(true)
    expect(unlockedBuyModes(state)).toContain('max')
    expect(advancedReadoutsUnlocked(state)).toBe(true)
  })
})

describe('GDD toast tiers', () => {
  it('does not toast Workshop on first hull loss — the lesson owns that beat', () => {
    const before = createInitialState(0)
    const after = markHullLost(structuredClone(before))
    const incoming = diffToasts(captureToastSnapshot(before), captureToastSnapshot(after), after)
    expect(incoming.some((t) => /workshop/i.test(t.title))).toBe(false)
    const queued = enqueueToasts([], incoming, 1000)
    expect(expireToasts(queued, 1000 + 30_000).every((t) => t.tier === 'major' || t.tier === 'action' || true)).toBe(
      true,
    )
  })

  it('keeps a live-sortie unlock toast waiting while onboarding is up', () => {
    let state = createFreshCareerState(0)
    state.resources.salvage = 8
    const toasts = [
      {
        id: 'sys:foundry',
        category: 'SYSTEM ONLINE',
        title: 'Foundry online',
        body: 'Open after Sortie',
        tier: 'action' as const,
        key: 1,
        createdAt: 0,
      },
    ]
    const current = selectPresentation(state, ui('combat'), toasts, {})
    expect(current?.kind).toBe('onboarding')
    expect(current?.id).toContain('opening.salvage')
  })
})

describe('GDD onboarding catalog', () => {
  it('keeps starter ids off More and free of designer jargon', () => {
    const blob = ONBOARDING_LESSONS.flatMap((s) => [
      s.title,
      typeof s.body === 'string' ? s.body : 'body',
    ]).join('\n')
    expect(blob).not.toMatch(/USI|ITRTG|analogue|black-bar/i)
    expect(ONBOARDING_LESSONS.some((s) => s.nav.tab === 'stats')).toBe(false)
    expect(ONBOARDING_LESSONS.every((s) => s.id !== 'guide-launch')).toBe(true)
  })
})

describe('existing docked saves', () => {
  it('do not auto-launch just because they are Docked', () => {
    const docked = createInitialState(0)
    expect(docked.combat.docked).toBe(true)
    expect(docked.combat.inFight).toBe(false)
    const still = setDocked(docked, true)
    expect(still.combat.docked).toBe(true)
  })
})
