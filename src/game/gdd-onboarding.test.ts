import { describe, expect, it } from 'vitest'
import { buyRunUpgrade, buyWorkshopUpgrade } from './actions'
import { advancedReadoutsUnlocked, shopBulkTenUnlocked, shopBuyMaxUnlocked } from './disclosure'
import { coreContributionPct } from './uiReadout'
import {
  GUIDE_STEPS,
  ONBOARDING_ENABLED,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  guidePausesSimulation,
  skipOnboarding,
} from './progression'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { captureToastSnapshot, diffToasts, enqueueToasts, expireToasts } from './toasts'
import { setDocked } from './tick'
import { unlockedBuyModes } from './workshop'

function fresh() {
  return createInitialState(0)
}

describe('GDD onboarding first hour', () => {
  it('is enabled and a fresh Dock names Launch', () => {
    expect(ONBOARDING_ENABLED).toBe(true)
    const state = fresh()
    const step = activeGuideStep(state, 'dock')
    expect(step?.id).toBe('guide-launch')
    expect(guidePausesSimulation(step)).toBe(false)
    expect(activeGuideStep(state, 'stats')).toBeNull()
    expect(GUIDE_STEPS.every((s) => s.kind !== 'critical')).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.required)).toBe(false)
  })

  it('walks Launch → Salvage buy → death → Workshop buy → second Launch without More', () => {
    let state = fresh()
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-launch')

    state = setDocked(state, false)
    expect(activeGuideStep(state, 'combat')?.id).not.toBe('guide-launch')
    expect(activeGuideStep(state, 'combat')).toBeNull()

    state.resources.salvage = 8
    const salvage = activeGuideStep(state, 'combat')
    expect(salvage?.id).toBe('guide-salvage-first')
    expect(guidePausesSimulation(salvage)).toBe(true)
    expect(salvage?.target).toBe('run-upgrade-weapon-power')

    state = buyRunUpgrade(state, 'weapon-power', 1)
    expect(activeGuideStep(state, 'combat')?.id).not.toBe('guide-salvage-first')

    state = markHullLost(state)
    state.combat.docked = true
    state.resources.scrap = 20
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-workshop')
    expect(activeGuideStep(state, 'stats')).toBeNull()

    state = buyWorkshopUpgrade(state, 'weapon-power', 1)
    expect(state.workshop.levels['weapon-power']).toBe(1)
    const second = activeGuideStep(state, 'dock')
    expect(second?.id).toBe('guide-second-sortie')
    expect(second?.body).toMatch(/Workshop/)

    state = setDocked(state, false)
    expect(activeGuideStep(state, 'combat')?.id).not.toBe('guide-second-sortie')
    expect(activeGuideStep(state, 'stats')).toBeNull()
  })

  it('does not skip Workshop when Launch is skipped', () => {
    const state = markHullLost(fresh())
    state.combat.docked = true
    state.resources.scrap = 20
    const skipped = skipOnboarding(state, 'guide-launch')
    expect(skipped.meta.seenOnboarding).toContain('guide-launch')
    expect(skipped.meta.seenOnboarding).not.toContain('guide-workshop')
    expect(activeGuideStep(skipped, 'dock')?.id).toBe('guide-workshop')
  })
})

describe('GDD progressive disclosure', () => {
  it('keeps ×10 / MAX / DPS share locked until Process or Research', () => {
    const state = markHullLost(fresh())
    expect(unlockedBuyModes(state)).toEqual([1])
    expect(shopBulkTenUnlocked(state)).toBe(false)
    expect(shopBuyMaxUnlocked(state)).toBe(false)
    expect(advancedReadoutsUnlocked(state)).toBe(false)
    expect(coreContributionPct(state, 'pulse-cannon')).toBeNull()

    state.process.purchased = ['buy-ten']
    expect(shopBulkTenUnlocked(state)).toBe(true)
    expect(unlockedBuyModes(state)).toEqual([1, 10])
    expect(advancedReadoutsUnlocked(state)).toBe(true)

    state.process.purchased = ['shop-buy-max']
    expect(shopBuyMaxUnlocked(state)).toBe(true)
    expect(unlockedBuyModes(state)).toContain('max')
  })
})

describe('GDD toast tiers', () => {
  it('keeps major unlocks until tapped', () => {
    const before = fresh()
    const after = markHullLost(structuredClone(before))
    const incoming = diffToasts(captureToastSnapshot(before), captureToastSnapshot(after), after)
    const workshop = incoming.find((t) => t.title === 'Workshop unlocked')
    expect(workshop?.tier).toBe('major')
    expect(workshop?.action?.nav).toEqual({ kind: 'tab', tab: 'dock' })

    const queued = enqueueToasts([], incoming, 1000)
    expect(expireToasts(queued, 1000 + 30_000)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workshop?.id, tier: 'major' })]),
    )
  })
})

describe('GDD onboarding catalog', () => {
  it('keeps starter ids off More and free of designer jargon', () => {
    expect(STARTER_GUIDE_IDS).toEqual(
      expect.arrayContaining(['guide-launch', 'guide-salvage-first', 'guide-workshop', 'guide-second-sortie']),
    )
    const blob = GUIDE_STEPS.flatMap((s) => [s.title, ...(Array.isArray(s.body) ? s.body : [s.body])]).join('\n')
    expect(blob).not.toMatch(/USI|ITRTG|analogue|black-bar/i)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-core-run')).toBe(false)
    expect(GUIDE_STEPS.some((s) => s.target === 'rebuild-btn')).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-rebuild-matter')).toBe(true)
    expect(GUIDE_STEPS.find((s) => s.id === 'guide-rebuild-matter')?.target).toBe('rebuild-matter-shop')
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-reinforce')).toBe(true)
  })

  it('spots Rebuild when the door is live, then Matter after the hangar reset', () => {
    const ready = armRebuildDoor(fresh())
    ready.meta.seenOnboarding = [
      ...STARTER_GUIDE_IDS,
      'guide-network-strike',
      'guide-foundry-recipe',
      'guide-foundry-mastery',
      'guide-directive',
    ]
    ready.base.assignments['scrap-field'] = 1
    expect(activeGuideStep(ready, 'dock')?.id).toBe('guide-rebuild')
    expect(guidePausesSimulation(activeGuideStep(ready, 'dock'))).toBe(false)

    const rebuilt = structuredClone(ready)
    rebuilt.prestige.prestigeCount = 1
    rebuilt.resources.prestigeMatter = 6
    rebuilt.meta.seenOnboarding = [...ready.meta.seenOnboarding, 'guide-rebuild']
    expect(activeGuideStep(rebuilt, 'dock')?.id).toBe('guide-rebuild-matter')
    expect(activeGuideStep(rebuilt, 'dock')?.target).toBe('rebuild-matter-shop')
  })

  it('spots Reinforce after the Wave 300 climax', () => {
    const s = atCareerWave(fresh(), 300)
    s.meta.act1Cleared = true
    expect(activeGuideStep(s, 'reinforce')?.id).toBe('guide-reinforce')
  })
})
