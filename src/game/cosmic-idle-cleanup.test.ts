import { describe, expect, it } from 'vitest'
import { GUIDE_STEPS, PRESTIGE_MIN_SECTOR } from './progression'
import { RESOURCE_LABELS, createInitialState } from './state'
import { canPrestige, performPrestige } from './actions'
import { PRESTIGE_MIN_SECTOR as CATALOG_PRESTIGE_MIN } from './catalog'
import { armRebuildDoor } from './testHelpers'

const DEAD_GUIDE_TARGETS = [
  'shipyard-tab',
  'shipyard-modules-tab',
  'unlock-plate-layer',
  'fit-plate-layer',
  'base-tab',
  'station-scrap-field-plus',
  'station-power-grid-plus',
  'station-sensor-net-plus',
  'station-alloy-foundry-plus',
  'fab-bay-btn',
  'core-tab',
  'core-train-logistics-plus',
  'prestige-tab',
  'prestige-btn',
  'matter-shop',
  'signal-cores-subtab',
  'challenge-shop',
  'ascend-btn',
  'essence-constructs',
]

const DEAD_GUIDE_TABS = ['shipyard', 'base', 'prestige', 'core', 'ai']

describe('Cosmic Idle UI cleanup', () => {
  it('does not spotlight deleted ITRTG tabs', () => {
    for (const step of GUIDE_STEPS) {
      expect(DEAD_GUIDE_TARGETS).not.toContain(step.target)
      expect(DEAD_GUIDE_TABS).not.toContain(step.nav.tab)
    }
  })

  it('names Rebuild Matter in the header and Rebuild log', () => {
    expect(RESOURCE_LABELS.prestigeMatter).toBe('Rebuild Matter')
    expect(RESOURCE_LABELS.challengePoints).toBe('Challenge Marks')

    let state = armRebuildDoor(createInitialState(0))
    expect(CATALOG_PRESTIGE_MIN).toBe(PRESTIGE_MIN_SECTOR)
    expect(PRESTIGE_MIN_SECTOR).toBe(210)
    expect(canPrestige(state)).toBe(true)
    state = performPrestige(state, 1000)
    expect(state.combat.log[0]).toMatch(/Rebuild Matter/)
    expect(state.combat.log[0]).not.toMatch(/Prestige Matter/)
  })
})
