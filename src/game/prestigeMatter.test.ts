/**
 * Prestige Matter curve unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  EXTRACTION_BONUS,
  applyExtractionBonus,
  basePrestigeMatterForWave,
  prestigeMatterForRun,
  roundPrestigeMatter,
} from './prestigeMatter'

describe('prestigeMatter curve', () => {
  it('hits milestone table values', () => {
    expect(basePrestigeMatterForWave(20)).toBe(1)
    expect(basePrestigeMatterForWave(50)).toBe(10)
    expect(basePrestigeMatterForWave(60)).toBe(16)
    expect(basePrestigeMatterForWave(100)).toBe(50)
  })

  it('interpolates linearly between milestones', () => {
    expect(basePrestigeMatterForWave(55)).toBeCloseTo(13, 5)
  })

  it('applies extraction bonus last', () => {
    const base = prestigeMatterForRun({ bestWave: 50 })
    expect(base).toBe(10)
    expect(applyExtractionBonus(base, true)).toBeCloseTo(10 * EXTRACTION_BONUS, 5)
    expect(applyExtractionBonus(base, false)).toBe(10)
  })

  it('applies 50% credit for checkpoint-skipped waves', () => {
    // Start at 50, extract at 70:
    // skipped 1..50 at 50% = 5; played 51..70 = PM(70)-PM(50)
    const pm = prestigeMatterForRun({ bestWave: 70, checkpointWave: 50 })
    const played =
      basePrestigeMatterForWave(70) - basePrestigeMatterForWave(50)
    expect(pm).toBeCloseTo(5 + played, 5)
  })

  it('rounds to two decimals', () => {
    expect(roundPrestigeMatter(10.5)).toBe(10.5)
    expect(roundPrestigeMatter(10.555)).toBe(10.56)
  })
})
