import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  fitModule,
  unlockModule,
  upgradeModule,
} from './actions'
import {
  STARTER_DEATH_DELAY_S,
  STARTER_PLATE_SCRAP_FLOOR,
  STARTER_SALVAGE_GRANT,
  advanceSeconds,
  setDocked,
  starterRefitGate,
} from './tick'
import { activeGuideStep } from './progression'

describe('starter combat tutorial', () => {
  it('scripts first death → dock + scrap for Plate; blocks relaunch', () => {
    let state = createInitialState(0)
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
    ]
    state = setDocked(state, false)
    expect(state.combat.inFight || !state.combat.docked).toBe(true)
    advanceSeconds(state, STARTER_DEATH_DELAY_S + 0.2)

    expect(state.meta.starterCombatLesson).toBe(1)
    expect(state.combat.docked).toBe(true)
    expect(state.combat.inFight).toBe(false)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(STARTER_PLATE_SCRAP_FLOOR)
    expect(starterRefitGate(state)).toBe('plate')
    expect(setDocked(state, false)).toBe(state)
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-after-death')
  })

  it('second death grants salvage and enforces Pulse + Plate upgrades', () => {
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

    state = setDocked(state, false)
    advanceSeconds(state, STARTER_DEATH_DELAY_S + 0.2)

    expect(state.meta.starterCombatLesson).toBe(2)
    expect(state.combat.docked).toBe(true)
    expect(state.resources.salvage).toBeGreaterThanOrEqual(STARTER_SALVAGE_GRANT)
    expect(starterRefitGate(state)).toBe('upgrades')

    state = upgradeModule(state, 'pulse-cannon')
    state = upgradeModule(state, 'plate-layer')
    expect(starterRefitGate(state)).toBeNull()
    const resumed = setDocked(state, false)
    expect(resumed.combat.docked).toBe(false)
  })

  it('skips scripted deaths after prestige', () => {
    let state = createInitialState(0)
    state.prestige.prestigeCount = 1
    state.meta.starterCombatLesson = 0
    state = setDocked(state, false)
    advanceSeconds(state, STARTER_DEATH_DELAY_S + 1)
    expect(state.meta.starterCombatLesson).toBe(0)
    expect(state.combat.docked).toBe(false)
  })
})
