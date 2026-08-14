import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked } from './tick'
import {
  activeGuideStep,
  acknowledgeOnboarding,
  guideQueueQuiet,
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
})
