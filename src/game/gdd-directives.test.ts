import { describe, expect, it } from 'vitest'
import {
  chooseDirective,
  DIRECTIVE_INTERVAL,
  directiveIncomingMult,
  directiveScrapMult,
  directiveWeaponMult,
  hasDirectiveOffer,
  isDirectiveWave,
} from './directives'
import { computeShipStats, createInitialState } from './state'
import { setDocked, startCombat, advanceTicks } from './tick'
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

  it('pauses the Sortie with three choices after clearing Wave 50', () => {
    let s = setDocked(createInitialState(0), false)
    s = startCombat(s)
    s.combat.wave = 50
    s.combat.isBoss = true
    for (const e of s.combat.enemyUnits) e.hull = 0
    s.combat.enemyHull = 0
    advanceTicks(s, 1)
    expect(hasDirectiveOffer(s)).toBe(true)
    expect(s.combat.directiveOffer).toHaveLength(3)
    expect(s.combat.inFight).toBe(false)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.wave).toBe(51)
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

    s = setDocked(s, true)
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
