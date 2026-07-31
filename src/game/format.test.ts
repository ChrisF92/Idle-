import { describe, expect, it } from 'vitest'
import { formatCompact, formatStat } from './format'
import { moduleStatPreviews, moduleUpgradeEffectLines } from './catalog'
import { activeGuideStep, PRESTIGE_MIN_SECTOR } from './progression'
import { createInitialState } from './state'
import { applyDevAction } from './dev'

describe('formatStat', () => {
  it('avoids float noise at 2dp', () => {
    expect(formatStat(24.479999999999997, 2)).toBe('24.48')
    expect(formatStat(26.6, 2)).toBe('26.60')
  })

  it('compacts whole numbers', () => {
    expect(formatCompact(40, 1)).toBe('40')
    expect(formatCompact(3.4, 1)).toBe('3.4')
  })
})

describe('module stat previews', () => {
  it('formats weapon damage to 2dp for upgrades', () => {
    const lines = moduleUpgradeEffectLines('pulse-cannon', 3, 4)
    expect(lines[0]).toMatch(/24\.48/)
    expect(lines[0]).not.toMatch(/24\.479999/)

    const preview = moduleStatPreviews('pulse-cannon', 3, true)
    const dmg = preview.find((p) => p.label === 'Damage')
    expect(dmg?.current).toBe('24.48')
    expect(dmg?.next).toMatch(/^\d+\.\d{2}$/)
    expect(Number(dmg?.next)).toBeGreaterThan(Number(dmg?.current))
  })
})

describe('prestige onboarding', () => {
  it('offers Prestige tab guide when the system unlocks', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 5
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-base-tab',
      'guide-assign-scrap',
      'guide-research-tab',
    ]
    expect(activeGuideStep(state, 'combat')?.id).toBe('guide-prestige-tab')
  })

  it('offers Prestige button guide at sector 8 before first prestige', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.combat.sector = PRESTIGE_MIN_SECTOR
    state.meta.seenOnboarding = [
      'guide-shipyard-tab',
      'guide-frame-select',
      'guide-launch',
      'guide-base-tab',
      'guide-assign-scrap',
      'guide-research-tab',
      'guide-prestige-tab',
    ]
    expect(activeGuideStep(state, 'prestige')?.id).toBe('guide-prestige-ready')
    expect(activeGuideStep(state, 'prestige')?.target).toBe('prestige-btn')
  })
})

describe('dev tools', () => {
  it('jumps sector and grants resources', () => {
    let state = createInitialState(0)
    state = applyDevAction(state, { type: 'jump-sector', sector: 8 })
    expect(state.combat.sector).toBe(8)
    expect(state.meta.highestSectorEver).toBeGreaterThanOrEqual(7)

    state = applyDevAction(state, {
      type: 'add-resources',
      amounts: { salvage: 50, scrap: 100 },
    })
    expect(state.resources.salvage).toBe(50)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(100)
  })
})
