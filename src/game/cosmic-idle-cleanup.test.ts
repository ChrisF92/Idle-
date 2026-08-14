import { describe, expect, it } from 'vitest'
import { GUIDE_STEPS } from './progression'
import { RESOURCE_LABELS, createInitialState } from './state'
import { performPrestige } from './actions'

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
      if (step.tab) expect(DEAD_GUIDE_TABS).not.toContain(step.tab)
    }
  })

  it('names Rebuild Matter in the header and Rebuild log', () => {
    expect(RESOURCE_LABELS.prestigeMatter).toBe('Rebuild Matter')
    expect(RESOURCE_LABELS.challengePoints).toBe('Challenge Marks')

    let state = createInitialState(0)
    state.combat.sector = 10
    state.meta.highestSectorEver = 10
    state = performPrestige(state, 1000)
    expect(state.combat.log[0]).toMatch(/Rebuild Matter/)
    expect(state.combat.log[0]).not.toMatch(/Prestige Matter/)
  })
})
