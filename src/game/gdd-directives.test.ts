import { describe, expect, it } from 'vitest'
import {
  chooseDirective,
  DIRECTIVE_INTERVAL,
  directiveIncomingMult,
  directiveScrapMult,
  directiveWeaponMult,
  hasDirectiveOffer,
  isDirectiveWave,
  queueDirectiveOffer,
} from './directives'
import { computeShipStats, createInitialState } from './state'
import { setDocked } from './tick'
import { completeDefeat } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

describe('GDD Directives', () => {
  it('milestones land on Wave 50 and every 50 Waves after', () => {
    expect(ACT1_CADENCE.directives).toBe(50)
    expect(isDirectiveWave(49)).toBe(false)
    expect(isDirectiveWave(50)).toBe(true)
    expect(isDirectiveWave(100)).toBe(true)
    expect(isDirectiveWave(DIRECTIVE_INTERVAL * 5)).toBe(true)
    expect(isDirectiveWave(DIRECTIVE_INTERVAL * 6)).toBe(false)
  })

  it('can queue a Directive offer on a Wave 50 Boss secure without jumping the Sortie', () => {
    const s = createInitialState(0)
    expect(queueDirectiveOffer(s, 50)).toBe(true)
    expect(hasDirectiveOffer(s)).toBe(true)
    expect(s.combat.directiveOffer).toHaveLength(3)
    expect(s.combat.wave).toBe(1)
  })

  it('applies Overcharge to this Sortie only', () => {
    let s = setDocked(createInitialState(0), false)
    s.combat.directiveOffer = ['overcharge', 'scavenger', 'reactive']
    const before = computeShipStats(s).damage
    s = chooseDirective(s, 'overcharge')
    expect(s.combat.directives).toEqual(['overcharge'])
    expect(s.combat.directiveOffer).toBeNull()
    expect(directiveWeaponMult(s)).toBeCloseTo(1.3)
    expect(directiveIncomingMult(s)).toBeCloseTo(1.15)
    expect(computeShipStats(s).damage).toBeGreaterThan(before * 1.2)

    s = completeDefeat(s)
    expect(s.combat.directives).toEqual([])
    expect(directiveWeaponMult(s)).toBe(1)
  })

  it('stacks Scavenger scrap without opening a new offer until the next milestone', () => {
    let s = createInitialState(0)
    s.combat.directiveOffer = ['overcharge', 'scavenger', 'reactive']
    s = chooseDirective(s, 'scavenger')
    expect(directiveScrapMult(s)).toBeCloseTo(1.35)
    expect(hasDirectiveOffer(s)).toBe(false)
  })
})
