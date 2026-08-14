import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked } from './tick'
import {
  GUIDE_STEPS,
  activeGuideStep,
  acknowledgeOnboarding,
  guideQueueQuiet,
  skipOnboarding,
} from './progression'

function afterLaunch(seen: string[] = ['guide-shipyard-tab', 'guide-frame-select', 'guide-launch']) {
  let state = createInitialState(0)
  state.meta.seenOnboarding = seen
  state = setDocked(state, false)
  return state
}

describe('onboarding queue', () => {
  it('does not start a new coach-mark during a live sortie', () => {
    const live = afterLaunch()
    live.resources.salvage = 8
    expect(guideQueueQuiet(live)).toBe(true)
    expect(activeGuideStep(live, 'combat')).toBeNull()
    expect(activeGuideStep(live, 'dock')).toBeNull()
    expect(activeGuideStep(live, 'network')).toBeNull()
  })

  it('keeps the visible tip when first Salvage arrives', () => {
    const state = createInitialState(0)
    state.meta.seenOnboarding = ['guide-shipyard-tab', 'guide-frame-select', 'guide-launch']
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-drone-cap')

    state.resources.salvage = 8
    expect(activeGuideStep(state, 'dock', 'guide-drone-cap')?.id).toBe('guide-drone-cap')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-salvage-lesson')
  })

  it('offers the salvage lesson after Extract, then Core ranks', () => {
    let state = afterLaunch()
    state.resources.salvage = 8
    expect(activeGuideStep(state, 'combat')).toBeNull()

    state = setDocked(state, true)
    expect(guideQueueQuiet(state)).toBe(false)
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-salvage-lesson')
    expect(activeGuideStep(state, 'dock')?.required).toBeFalsy()

    state = acknowledgeOnboarding(state, 'guide-salvage-lesson')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-upgrade-pulse')
  })

  it('queues Foundry until the ship is docked', () => {
    const live = afterLaunch([
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-drone-cap',
      'guide-salvage-lesson',
      'guide-upgrade-pulse',
      'guide-upgrade-plate',
    ])
    live.meta.highestSectorEver = 2
    live.combat.highestSector = 2
    expect(activeGuideStep(live, 'dock')).toBeNull()

    const docked = setDocked(live, true)
    expect(activeGuideStep(docked, 'dock')?.id).toBe('guide-foundry')
  })

  it('does not stack Furnace or Codex while Reliquary is open', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-drone-cap',
      'guide-network-bars',
      'guide-network-links',
      'guide-salvage-lesson',
      'guide-upgrade-pulse',
      'guide-upgrade-plate',
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-foundry-keep',
    ]
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-reliquary')

    state = acknowledgeOnboarding(state, 'guide-reliquary')
    expect(activeGuideStep(state, 'reliquary')?.id).toBe('guide-reliquary-slots')
    expect(activeGuideStep(state, 'reliquary')?.id).not.toBe('guide-furnace')
    expect(activeGuideStep(state, 'reliquary')).toMatchObject({ group: 'reliquary' })

    state = acknowledgeOnboarding(state, 'guide-reliquary-slots')
    expect(activeGuideStep(state, 'reliquary')?.id).toBe('guide-reliquary-resonance')

    state = acknowledgeOnboarding(state, 'guide-reliquary-resonance')
    expect(activeGuideStep(state, 'reliquary')).toBeNull()
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-furnace')
  })

  it('walks Furnace then Codex only after leaving the previous screen', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-drone-cap',
      'guide-network-bars',
      'guide-network-links',
      'guide-salvage-lesson',
      'guide-upgrade-pulse',
      'guide-upgrade-plate',
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-foundry-keep',
      'guide-reliquary',
      'guide-reliquary-slots',
      'guide-reliquary-resonance',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-furnace')
    state = acknowledgeOnboarding(state, 'guide-furnace')
    expect(activeGuideStep(state, 'furnace')?.id).toBe('guide-furnace-bank')
    state = acknowledgeOnboarding(state, 'guide-furnace-bank')
    expect(activeGuideStep(state, 'furnace')?.id).toBe('guide-furnace-ranks')
    state = acknowledgeOnboarding(state, 'guide-furnace-ranks')
    expect(activeGuideStep(state, 'furnace')).toBeNull()
    expect(activeGuideStep(state, 'stats')?.group).not.toBe('furnace')

    state.meta.seenOnboarding = [
      ...state.meta.seenOnboarding,
      'guide-salvage',
      'guide-prestige-tab',
      'guide-prestige-ready',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-codex-tab')

    state = acknowledgeOnboarding(state, 'guide-codex-tab')
    expect(activeGuideStep(state, 'codex')?.id).toBe('guide-codex-families')
    expect(activeGuideStep(state, 'codex')?.id).not.toBe('guide-research-tab')
  })

  it('Skip on a door dismisses the whole system tour', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-drone-cap',
      'guide-network-bars',
      'guide-network-links',
      'guide-salvage-lesson',
      'guide-upgrade-pulse',
      'guide-upgrade-plate',
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-foundry-keep',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-reliquary')
    state = skipOnboarding(state, 'guide-reliquary')
    expect(state.meta.seenOnboarding).toEqual(
      expect.arrayContaining([
        'guide-reliquary',
        'guide-reliquary-slots',
        'guide-reliquary-resonance',
      ]),
    )
    expect(activeGuideStep(state, 'reliquary')).toBeNull()
    expect(GUIDE_STEPS.filter((s) => s.group === 'reliquary').length).toBe(3)
  })
})
