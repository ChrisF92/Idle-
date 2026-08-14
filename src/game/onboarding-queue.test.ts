import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked } from './tick'
import {
  GUIDE_STEPS,
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  acknowledgeOnboarding,
  guideBodyLines,
  guideQueueQuiet,
  skipOnboarding,
} from './progression'

const AFTER_LAUNCH = ['guide-shipyard-tab', 'guide-frame-select', 'guide-launch']

const SORTIE_TOUR = [
  'guide-sortie-field',
  'guide-sortie-guns',
  'guide-sortie-hull',
  'guide-sortie-salvage',
]

const CORES_TOUR = [
  'guide-salvage-lesson',
  'guide-cores-sheet',
  'guide-upgrade-pulse',
  'guide-upgrade-plate',
  'guide-cores-inspect',
  'guide-cores-persist',
]

function afterLaunch(seen: string[] = AFTER_LAUNCH) {
  let state = createInitialState(0)
  state.meta.seenOnboarding = seen
  state = setDocked(state, false)
  return state
}

describe('onboarding queue', () => {
  it('walks the battlefield during a live sortie and still blocks Foundry', () => {
    const live = afterLaunch()
    live.resources.salvage = 8
    live.meta.highestSectorEver = 2
    live.combat.highestSector = 2
    expect(guideQueueQuiet(live)).toBe(true)
    expect(activeGuideStep(live, 'combat')?.id).toBe('guide-sortie-field')
    expect(activeGuideStep(live, 'combat')?.group).toBe('sortie')
    expect(activeGuideStep(live, 'dock')?.id).toBe('guide-sortie-field')
    expect(activeGuideStep(live, 'network')?.id).toBe('guide-sortie-field')

    let walked = live
    for (const id of SORTIE_TOUR) {
      expect(activeGuideStep(walked, 'combat')?.id).toBe(id)
      walked = acknowledgeOnboarding(walked, id)
    }
    expect(activeGuideStep(walked, 'combat')).toBeNull()
    expect(activeGuideStep(walked, 'dock')).toBeNull()
    expect(activeGuideStep(walked, 'foundry')).toBeNull()
  })

  it('keeps the visible tip when first Salvage arrives', () => {
    const state = createInitialState(0)
    state.meta.seenOnboarding = AFTER_LAUNCH
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-drone-cap')

    state.resources.salvage = 8
    expect(activeGuideStep(state, 'dock', 'guide-drone-cap')?.id).toBe('guide-drone-cap')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-salvage-lesson')
  })

  it('offers Salvage, Cores, then Network after docking — before relaunch', () => {
    let state = afterLaunch()
    state.resources.salvage = 8
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-sortie-field')

    state = setDocked(state, true)
    expect(guideQueueQuiet(state)).toBe(false)
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-salvage-lesson')
    expect(activeGuideStep(state, 'dock')?.required).toBeFalsy()
    expect(activeGuideStep(state, 'dock')?.group).toBe('cores')

    state = acknowledgeOnboarding(state, 'guide-salvage-lesson')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-cores-sheet')

    state = acknowledgeOnboarding(state, 'guide-cores-sheet')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-upgrade-pulse')
    expect(activeGuideStep(state, 'combat')?.required).toBe(true)

    state.shipyard.moduleLevels['pulse-cannon'] = 1
    state = acknowledgeOnboarding(state, 'guide-upgrade-pulse')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-upgrade-plate')

    state.shipyard.moduleLevels['plate-layer'] = 1
    state = acknowledgeOnboarding(state, 'guide-upgrade-plate')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-cores-inspect')

    state = acknowledgeOnboarding(state, 'guide-cores-inspect')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-cores-persist')

    state = acknowledgeOnboarding(state, 'guide-cores-persist')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-drone-cap')
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-relaunch-upgraded')
  })

  it('walks manufacture, assign, and Links on Network', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [...AFTER_LAUNCH, ...SORTIE_TOUR, ...CORES_TOUR]
    state.shipyard.moduleLevels['pulse-cannon'] = 1
    state.shipyard.moduleLevels['plate-layer'] = 1
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-drone-cap')

    state = acknowledgeOnboarding(state, 'guide-drone-cap')
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-make')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-relaunch-upgraded')

    state = acknowledgeOnboarding(state, 'guide-network-make')
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-assign')
    expect(activeGuideStep(state, 'network')?.required).toBe(true)

    state.base.assignments.strike = 1
    state = acknowledgeOnboarding(state, 'guide-network-assign')
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-sortie')

    state = acknowledgeOnboarding(state, 'guide-network-sortie')
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-bars')

    state = acknowledgeOnboarding(state, 'guide-network-bars')
    expect(activeGuideStep(state, 'network')?.id).toBe('guide-network-links')

    state = acknowledgeOnboarding(state, 'guide-network-links')
    expect(activeGuideStep(state, 'network')).toBeNull()
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-relaunch-upgraded')
  })

  it('queues Foundry until the ship is docked', () => {
    const live = afterLaunch([
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
    ])
    live.meta.highestSectorEver = 2
    live.combat.highestSector = 2
    expect(activeGuideStep(live, 'dock')?.id).not.toBe('guide-foundry')
    expect(activeGuideStep(live, 'foundry')).toBeNull()

    const docked = setDocked(live, true)
    expect(activeGuideStep(docked, 'dock')?.id).toBe('guide-foundry')
  })

  it('does not stack Furnace or Codex while Reliquary is open', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
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
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
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

  it('walks first Rebuild when the hangar comes available', () => {
    let state = createInitialState(0)
    state.combat.sector = 4
    state.meta.highestSectorEver = 4
    state.combat.highestSector = 4
    state.meta.seenOnboarding = [
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-foundry-keep',
      'guide-reliquary',
      'guide-reliquary-slots',
      'guide-reliquary-resonance',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-prestige-tab')
    expect(activeGuideStep(state, 'stats')?.group).toBe('rebuild')

    state = acknowledgeOnboarding(state, 'guide-prestige-tab')
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-prestige-ready')
    expect(activeGuideStep(state, 'dock')?.required).toBe(true)
    expect(activeGuideStep(state, 'dock', null, { hangarOpen: true })?.id).toBe(
      'guide-prestige-ready',
    )

    state = acknowledgeOnboarding(state, 'guide-prestige-ready')
    expect(activeGuideStep(state, 'dock')).toBeNull()
    expect(activeGuideStep(state, 'dock', null, { hangarOpen: true })?.id).toBe(
      'guide-prestige-hangar',
    )

    state = acknowledgeOnboarding(state, 'guide-prestige-hangar')
    expect(activeGuideStep(state, 'dock', null, { hangarOpen: true })?.id).toBe(
      'guide-prestige-confirm',
    )
    expect(activeGuideStep(state, 'dock', null, { hangarOpen: true })?.required).toBe(true)
  })

  it('Skip on Rebuild door dismisses the hangar walkthrough', () => {
    let state = createInitialState(0)
    state.combat.sector = 4
    state.meta.highestSectorEver = 4
    state.meta.seenOnboarding = [
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
      'guide-foundry',
      'guide-foundry-smelt',
      'guide-foundry-keep',
      'guide-reliquary',
      'guide-reliquary-slots',
      'guide-reliquary-resonance',
    ]
    expect(activeGuideStep(state, 'stats')?.id).toBe('guide-prestige-tab')
    state = skipOnboarding(state, 'guide-prestige-tab')
    expect(state.meta.seenOnboarding).toEqual(
      expect.arrayContaining([
        'guide-prestige-tab',
        'guide-prestige-ready',
        'guide-prestige-hangar',
        'guide-prestige-confirm',
      ]),
    )
    expect(activeGuideStep(state, 'dock')?.group).not.toBe('rebuild')
  })

  it('Skip on a door dismisses the whole system tour', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 3
    state.meta.seenOnboarding = [
      ...AFTER_LAUNCH,
      ...SORTIE_TOUR,
      ...NETWORK_GUIDE_IDS,
      ...CORES_TOUR,
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

  it('Skip on the Network door dismisses manufacture and Links', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [...AFTER_LAUNCH, ...SORTIE_TOUR, ...CORES_TOUR]
    expect(activeGuideStep(state, 'dock')?.id).toBe('guide-drone-cap')
    state = skipOnboarding(state, 'guide-drone-cap')
    expect(state.meta.seenOnboarding).toEqual(expect.arrayContaining([...NETWORK_GUIDE_IDS]))
    expect(activeGuideStep(state, 'network')).toBeNull()
  })

  it('keeps player-facing guide copy free of designer jargon', () => {
    const blob = GUIDE_STEPS.flatMap((step) => [step.title, ...guideBodyLines(step)]).join('\n')
    expect(blob).not.toMatch(/USI|ITRTG|analogue|black-bar/i)
  })

  it('retires the new starter battlefield and Cores ids on Rebuild', () => {
    for (const id of [
      ...SORTIE_TOUR,
      'guide-cores-sheet',
      'guide-cores-inspect',
      'guide-cores-persist',
    ]) {
      expect(STARTER_GUIDE_IDS).toContain(id)
    }
    expect(GUIDE_STEPS.filter((s) => s.group === 'sortie').map((s) => s.id)).toEqual(SORTIE_TOUR)
    expect(GUIDE_STEPS.filter((s) => s.group === 'network').map((s) => s.id)).toEqual([
      ...NETWORK_GUIDE_IDS,
    ])
  })
})
