import { describe, expect, it } from 'vitest'
import { encounterForWave } from './combat'
import { isBossWave, isCommanderWave } from './waves'
import { HOSTILE_DEFS } from './hostileCatalogue'
import { FORMATION_IDS } from './formations'

describe('Act 1 encounter cadence (legacy GDD bands removed)', () => {
  it('does not use old basic/skirmisher/shielded/elite/complex bands', () => {
    expect(typeof (globalThis as { gddEnemyBandForWave?: unknown }).gddEnemyBandForWave).toBe('undefined')
    const w1 = encounterForWave(1)
    expect(w1.units.some((u) => u.hostileId === 'void-mite')).toBe(true)
    expect(w1.units.every((u) => !u.name.startsWith('Elite '))).toBe(true)
    expect(['ethereal', 'divine', 'titan']).not.toContain(w1.family)
  })

  it('introduces hostiles at authored first-contact Waves', () => {
    expect(HOSTILE_DEFS.find((d) => d.id === 'void-mite')?.firstContactWave).toBe(1)
    expect(HOSTILE_DEFS.find((d) => d.id === 'needle-skitter')?.firstContactWave).toBe(30)
  })

  it('keeps Commanders on non-W50 tens and Bosses on 50-Wave boundaries', () => {
    for (const wave of [10, 20, 40]) {
      expect(isCommanderWave(wave)).toBe(true)
      expect(isBossWave(wave)).toBe(false)
    }
    for (const wave of [50, 100, 150]) {
      expect(isBossWave(wave)).toBe(true)
      expect(isCommanderWave(wave)).toBe(false)
    }
    expect([...FORMATION_IDS]).toHaveLength(7)
  })
})
