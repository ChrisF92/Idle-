import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked } from './tick'
import { markHullLost } from './testHelpers'
import {
  GUIDE_STEPS,
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  FURNACE_V2_GUIDE_IDS,
  FOUNDRY_V2_GUIDE_IDS,
  activeGuideStep,
  acknowledgeOnboarding,
  guideAutoTabs,
  guidePausesSimulation,
  guideQueueQuiet,
  skipOnboarding,
  retireLiveSortieGuides,
} from './progression'

function afterLaunch() {
  let state = createInitialState(0)
  state = setDocked(state, false)
  return state
}

function afterFirstDeath() {
  let state = afterLaunch()
  state = setDocked(state, true)
  return markHullLost(state)
}

describe('onboarding queue', () => {
  it('starts with a non-pausing launch hint on Dock', () => {
    const state = createInitialState(0)
    const step = activeGuideStep(state, 'dock')
    expect(step?.id).toBe('guide-launch')
    expect(guidePausesSimulation(step)).toBe(false)
    expect(guideAutoTabs(step)).toBe(false)
    expect(activeGuideStep(state, 'network')).toBeNull()
  })

  it('does not drag the player onto Sortie while the launch hint is active', () => {
    const state = createInitialState(0)
    expect(activeGuideStep(state, 'dock')?.tab).toBe('dock')
    expect(GUIDE_STEPS.filter((s) => s.autoTab).length).toBe(0)
  })

  it('shows a live fire hint during the first sortie without pausing', () => {
    const live = afterLaunch()
    expect(guideQueueQuiet(live)).toBe(true)
    const step = activeGuideStep(live, 'combat')
    expect(step?.id).toBe('guide-sortie-fire')
    expect(step?.kind).toBe('hint')
    expect(guidePausesSimulation(step)).toBe(false)
    expect(activeGuideStep(live, 'dock')?.id).toBe('guide-sortie-fire')
  })

  it('swaps the fire hint for Salvage once the first wreck pays', () => {
    const live = afterLaunch()
    live.resources.salvage = 1
    const step = activeGuideStep(live, 'combat')
    expect(step?.id).toBe('guide-salvage-first')
    expect(guidePausesSimulation(step)).toBe(false)
  })

  it('does not offer Cores or Network until the first hull loss', () => {
    const state = createInitialState(0)
    const combatGuide = activeGuideStep(state, 'combat')
    expect(combatGuide?.id === 'guide-launch' || combatGuide == null).toBe(true)
    expect(combatGuide?.id).not.toBe('guide-upgrade-pulse')
    expect(activeGuideStep(state, 'network')).toBeNull()
    const dead = markHullLost(state)
    expect(activeGuideStep(dead, 'combat')?.id).toBe('guide-upgrade-pulse')
    expect(activeGuideStep(dead, 'network')?.id).toBe('guide-network-strike')
  })

  it('walks Pulse then Plate as guided actions after the first defeat', () => {
    let state = afterFirstDeath()
    state.resources.salvage = 20
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-upgrade-pulse')
    expect(guidePausesSimulation(activeGuideStep(state, 'combat'))).toBe(false)

    state.shipyard.moduleLevels['pulse-cannon'] = 1
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-upgrade-plate')

    state.shipyard.moduleLevels['plate-layer'] = 1
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-cores-persist')

    state = acknowledgeOnboarding(state, 'guide-cores-persist')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-relaunch')
  })

  it('only shows Network assignment when the player opens Network', () => {
    const state = afterFirstDeath()
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-network-strike')
    const step = activeGuideStep(state, 'network')
    expect(step?.id).toBe('guide-network-strike')
    expect(step?.target).toBe('network-strike-plus')
    expect(guideAutoTabs(step)).toBe(false)

    state.base.assignments.strike = 1
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-ward')
    state.base.assignments.ward = 1
    expect(activeGuideStep(state, 'network')).toBeNull()
  })

  it('teaches Foundry by selecting Slag Ingot, then mastery when it happens', () => {
    const state = afterFirstDeath()
    state.meta.highestSectorEver = 2
    state.combat.highestSector = 2
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-foundry-recipe')
    expect(activeGuideStep(state, 'foundry')?.id).toBe('guide-foundry-recipe')

    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.2, paid: true }
    expect(activeGuideStep(state, 'foundry')?.id).not.toBe('guide-foundry-recipe')

    state.foundry.recipeLevels['slag-ingot'] = 1
    expect(activeGuideStep(state, 'foundry')?.id).toBe('guide-foundry-mastery')
  })

  it('lights one Furnace channel on first open and Skip dismisses the group', () => {
    const state = afterFirstDeath()
    state.meta.highestSectorEver = 5
    expect(activeGuideStep(state, 'furnace')?.id).toBe('guide-furnace-light')
    const skipped = skipOnboarding(state, 'guide-furnace-light')
    for (const id of FURNACE_V2_GUIDE_IDS) {
      expect(skipped.meta.seenOnboarding).toContain(id)
    }
    expect(activeGuideStep(skipped, 'furnace')).toBeNull()
  })

  it('offers a Research focus hint without a desk tour', () => {
    const state = afterFirstDeath()
    state.meta.highestSectorEver = 7
    expect(activeGuideStep(state, 'research')?.id).toBe('guide-research-focus')
    expect(guidePausesSimulation(activeGuideStep(state, 'research'))).toBe(false)
  })

  it('does not force Process, Protocol, Echo, Codex, or Logs tours', () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id))
    for (const id of [
      'guide-process-v2-what',
      'guide-protocol-restrict',
      'guide-echo',
      'guide-codex-tab',
      'guide-logs',
      'guide-prestige-tab',
      'guide-furnace-v2-ash',
      'guide-reliquary-slots',
    ]) {
      expect(ids.has(id)).toBe(false)
    }
    expect(GUIDE_STEPS.length).toBeLessThanOrEqual(16)
    expect(GUIDE_STEPS.every((s) => !guidePausesSimulation(s))).toBe(true)
  })

  it('Skip on Network dismisses Strike and Ward together', () => {
    const state = afterFirstDeath()
    const skipped = skipOnboarding(state, 'guide-network-strike')
    expect(skipped.meta.seenOnboarding).toEqual(expect.arrayContaining([...NETWORK_GUIDE_IDS]))
    expect(activeGuideStep(skipped, 'network')).toBeNull()
  })

  it('retires live sortie hints on hull loss so they do not replay', () => {
    const live = afterLaunch()
    retireLiveSortieGuides(live)
    expect(live.meta.seenOnboarding).toEqual(
      expect.arrayContaining(['guide-sortie-fire', 'guide-salvage-first']),
    )
    expect(activeGuideStep(live, 'combat')?.group).not.toBe('sortie')
  })

  it('starter ids no longer include the old battlefield lecture', () => {
    expect(STARTER_GUIDE_IDS).toContain('guide-launch')
    expect(STARTER_GUIDE_IDS).not.toContain('guide-sortie-hull')
    expect(STARTER_GUIDE_IDS).not.toContain('guide-salvage-lesson')
  })

  it('does not queue overlapping required tours on Dock after first death', () => {
    const state = afterFirstDeath()
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-foundry-recipe')
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-network-strike')
  })

  it('Foundry skip group is only the first-craft lessons', () => {
    expect(FOUNDRY_V2_GUIDE_IDS).toEqual(['guide-foundry-recipe', 'guide-foundry-mastery'])
  })
})
