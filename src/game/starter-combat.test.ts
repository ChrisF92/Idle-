import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  fitModule,
  unlockModule,
  upgradeModule,
} from './actions'
import {
  STARTER_PLATE_SCRAP_FLOOR,
  STARTER_SALVAGE_GRANT,
  advanceSeconds,
  setDocked,
  starterCombatPressureMult,
  starterDeathLessonOnLoss,
  starterRefitGate,
} from './tick'
import { activeGuideStep } from './progression'

/** Force a natural fight loss on the current flagship. */
function killFlagship(state: ReturnType<typeof createInitialState>): void {
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) flag.hull = 0
  state.combat.playerHull = 0
}

describe('starter combat tutorial (natural deaths)', () => {
  it('does not script an instant death on launch', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
    ]
    state = setDocked(state, false)
    advanceSeconds(state, 2)
    expect(state.meta.starterCombatLesson).toBe(0)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
    expect(state.combat.playerHull).toBeGreaterThan(0)
  })

  it('first natural death docks + scrap for Plate; blocks relaunch', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
    ]
    state = setDocked(state, false)
    advanceSeconds(state, 0.2)
    expect(starterDeathLessonOnLoss(state)).toBe(0)
    killFlagship(state)
    advanceSeconds(state, 0.05)

    expect(state.meta.starterCombatLesson).toBe(1)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(STARTER_PLATE_SCRAP_FLOOR)
    expect(starterRefitGate(state)).toBe('plate')
    expect(setDocked(state, false)).toBe(state)
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-after-death')
    expect(activeGuideStep(state, 'combat')?.required).toBe(true)
  })

  it('second natural death after Plate grants salvage and blocks until upgrades', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-after-death',
      'guide-modules-tab',
      'guide-unlock-plate',
      'guide-fit-plate',
      'guide-relaunch-plated',
    ]
    state.meta.starterCombatLesson = 1
    state.resources.scrap = 99
    state.resources.alloys = 99
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    state.shipyard.frameLocked = true
    state.combat.docked = true

    expect(starterCombatPressureMult(state)).toBeGreaterThan(1)

    state = setDocked(state, false)
    advanceSeconds(state, 0.2)
    expect(starterDeathLessonOnLoss(state)).toBe(1)
    killFlagship(state)
    advanceSeconds(state, 0.05)

    expect(state.meta.starterCombatLesson).toBe(2)
    expect(state.combat.docked).toBe(true)
    expect(state.resources.salvage).toBeGreaterThanOrEqual(STARTER_SALVAGE_GRANT)
    expect(starterRefitGate(state)).toBe('upgrades')
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-salvage-lesson')
    expect(activeGuideStep(state, 'combat')?.required).toBe(true)

    state = upgradeModule(state, 'pulse-cannon')
    state = upgradeModule(state, 'plate-layer')
    expect(starterRefitGate(state)).toBeNull()
    const resumed = setDocked(state, false)
    expect(resumed.combat.docked).toBe(false)
  })

  it('skips starter death docking after prestige', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.meta.starterCombatLesson = 0
    state = setDocked(state, false)
    advanceSeconds(state, 0.2)
    killFlagship(state)
    advanceSeconds(state, 0.05)
    expect(state.meta.starterCombatLesson).toBe(0)
    expect(state.combat.docked).toBe(false)
    expect(state.combat.inFight).toBe(true)
  })
})
