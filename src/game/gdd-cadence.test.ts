import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { ACT1_CADENCE, ACT1_FINAL_WAVE } from './cadence'
import { isSystemUnlocked, PRESTIGE_MIN_SECTOR } from './progression'
import { canPrestige } from './actions'
import { atCareerWave } from './testHelpers'
import { careerBestWave } from './waves'

/** GDD §102 doors. Older campaign tests are quarantined in vitest.config.ts. */
describe('GDD Act 1 wave cadence', () => {
  it('places major doors on the GDD Wave table', () => {
    expect(ACT1_CADENCE.foundry).toBe(20)
    expect(ACT1_CADENCE.workers).toBe(30)
    expect(PRESTIGE_MIN_SECTOR).toBe(70)
    expect(ACT1_CADENCE.foundryAdvanced).toBe(90)
    expect(ACT1_CADENCE.furnace).toBe(140)
    expect(ACT1_CADENCE.research).toBe(170)
    expect(ACT1_CADENCE.process).toBe(210)
    expect(ACT1_CADENCE.protocols).toBe(250)
    expect(ACT1_CADENCE.mastery).toBe(275)
    expect(ACT1_CADENCE.specialists).toBe(999)
    expect(ACT1_CADENCE.tasks).toBe(999)
    expect(ACT1_CADENCE.reinforce).toBe(300)
    expect(ACT1_FINAL_WAVE).toBe(300)
  })

  it('opens Foundry at Wave 20', () => {
    expect(isSystemUnlocked(createInitialState(0), 'foundry')).toBe(false)
    const locked = atCareerWave(createInitialState(0), 19)
    expect(isSystemUnlocked(locked, 'foundry')).toBe(false)
    const open = atCareerWave(createInitialState(0), 20)
    expect(isSystemUnlocked(open, 'foundry')).toBe(true)
  })

  it('allows Rebuild from Dock after Wave 70, not the live sector', () => {
    let s = atCareerWave(createInitialState(0), 70)
    s.combat.docked = true
    s.combat.sector = 1
    s.combat.wave = 1
    expect(careerBestWave(s)).toBe(70)
    expect(canPrestige(s)).toBe(true)
  })

  it('keeps Rebuild locked before Wave 70 even if still fighting', () => {
    let s = atCareerWave(createInitialState(0), 69)
    s.combat.sector = 7
    s.combat.wave = 69
    s.combat.docked = false
    expect(canPrestige(s)).toBe(false)
  })

  it('opens Foundry construction at Wave 90 without a Yard station', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced - 1)
    expect(isSystemUnlocked(locked, 'yard')).toBe(false)
    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    expect(isSystemUnlocked(open, 'yard')).toBe(true)
  })
})
