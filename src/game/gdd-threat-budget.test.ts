import { describe, expect, it } from 'vitest'
import { encounterForWave } from './combat'
import { createInitialState } from './state'
import {
  packDps,
  packEhp,
  threatBudgetForWave,
  threatSpecForWave,
  varyPackToBudget,
} from './threatBudget'
import { startCombat } from './tick'

function seededState(seed: number) {
  const s = createInitialState(0)
  s.lastTickAt = 1
  s.combat.sortieSeed = seed
  return s
}

describe('GDD threat budget and boss mechanics', () => {
  it('places Wave 87 near the authored budget of 100', () => {
    expect(threatBudgetForWave(87)).toBe(100)
    expect(threatSpecForWave(87).band).toBe('shielded')
    expect(threatSpecForWave(87).secondary).toContain('armored')
    expect(threatSpecForWave(1).density).toBe('sparse')
    expect(threatSpecForWave(12).density).toBe('dense')
  })

  it('keeps two seeds for the same Wave on comparable EHP and DPS', () => {
    const wave = 87
    const canonical = encounterForWave(wave)
    const spec = threatSpecForWave(wave)
    const a = varyPackToBudget(canonical.units, spec, 11)
    const b = [29, 7, 41, 99]
      .map((seed) => varyPackToBudget(canonical.units, spec, seed))
      .find((pack) => pack.units.length !== a.units.length)
    expect(b).toBeTruthy()
    if (!b) return
    const ehpA = packEhp(a.units)
    const ehpB = packEhp(b.units)
    const dpsA = packDps(a.units)
    const dpsB = packDps(b.units)
    expect(Math.abs(ehpA - ehpB) / Math.max(1, ehpA)).toBeLessThan(0.08)
    expect(Math.abs(dpsA - dpsB) / Math.max(0.1, dpsA)).toBeLessThan(0.08)
    expect(canonical.threat?.budget).toBe(spec.budget)
  })

  it('stores the Sortie seed on launch for telemetry', () => {
    const s = startCombat(seededState(42))
    expect(s.combat.sortieSeed).toBe(42)
    expect(s.combat.sortieMark?.sortieSeed).toBe(42)
    expect(s.combat.waveReached).toBe(1)
    expect(s.combat.waveThreat?.seed).toBe(42)
    expect(s.combat.waveThreat?.budget).toBe(threatBudgetForWave(1))
  })

  it('does not treat every 10th Wave as an authored Boss mechanic', () => {
    expect(encounterForWave(10).isBoss).toBe(false)
    expect(encounterForWave(20).isBoss).toBe(false)
    expect(encounterForWave(30).mechanicId).toBeUndefined()
    expect(encounterForWave(300).mechanicId).toBeUndefined()
  })
})
