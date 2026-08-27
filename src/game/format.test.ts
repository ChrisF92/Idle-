import { describe, expect, it } from 'vitest'
import { formatCompact, formatLargeNumber, formatStat, setActiveNumberNotation } from './format'
import { moduleStatPreviews, moduleUpgradeEffectLines } from './catalog'
import { activeGuideStep, NETWORK_GUIDE_IDS, STARTER_GUIDE_IDS } from './progression'
import { createInitialState } from './state'
import { applyDevAction } from './dev'
import { careerBestWave } from './waves'

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

describe('large number notation', () => {
  it('leaves values under 1000 alone', () => {
    setActiveNumberNotation('engineering')
    expect(formatCompact(999)).toBe('999')
    expect(formatStat(26.6, 2)).toBe('26.60')
  })

  it('uses engineering exponents in steps of 3', () => {
    setActiveNumberNotation('engineering')
    expect(formatLargeNumber(1000, 'engineering')).toBe('1e3')
    expect(formatLargeNumber(12345, 'engineering')).toBe('12.3e3')
    expect(formatLargeNumber(1_500_000, 'engineering')).toBe('1.5e6')
  })

  it('uses scientific mantissa in [1, 10)', () => {
    setActiveNumberNotation('scientific')
    expect(formatLargeNumber(1000, 'scientific')).toBe('1e3')
    expect(formatLargeNumber(12345, 'scientific')).toBe('1.23e4')
    expect(formatLargeNumber(1_500_000, 'scientific')).toBe('1.5e6')
  })
})

describe('module stat previews', () => {
  it('formats weapon damage to 2dp for upgrades', () => {
    const lines = moduleUpgradeEffectLines('pulse-cannon', 3, 4)
    expect(lines[0]).toMatch(/7\.60/)
    expect(lines[0]).toMatch(/8\.80/)
    expect(lines.some((l) => /RoF/.test(l))).toBe(true)

    const preview = moduleStatPreviews('pulse-cannon', 3, true)
    const dmg = preview.find((p) => p.label === 'Damage')
    expect(dmg?.current).toBe('7.60')
    expect(dmg?.next).toMatch(/^\d+\.\d{2}$/)
    expect(Number(dmg?.next)).toBeGreaterThan(Number(dmg?.current))

    const rof = preview.find((p) => p.label === 'RoF')
    expect(rof?.current).toBe('1.25/s')
    expect(rof?.next).toBeNull()

    const labels = preview.map((p) => p.label)
    expect(labels.indexOf('Damage')).toBeLessThan(labels.indexOf('RoF'))
    expect(labels.indexOf('RoF')).toBeLessThan(labels.indexOf('Range'))
  })
})

describe('rebuild onboarding', () => {
  it('does not force a Rebuild overlay; hangar copy carries KEEP/RESET', () => {
    const state = createInitialState(0)
    state.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(activeGuideStep(state, 'combat')?.id).not.toBe('guide-prestige-tab')
    expect(activeGuideStep(state, 'dock')?.id).not.toBe('guide-prestige-ready')
  })
})
describe('dev tools', () => {
  it('jumps career Best Wave and grants resources', () => {
    let state = createInitialState(0)
    state = applyDevAction(state, { type: 'set-best-wave', wave: 8 })
    expect(careerBestWave(state)).toBeGreaterThanOrEqual(8)

    state = applyDevAction(state, {
      type: 'add-resources',
      amounts: { salvage: 50, scrap: 100 },
    })
    expect(state.resources.salvage).toBe(50)
    expect(state.resources.scrap).toBeGreaterThanOrEqual(100)
  })
})
