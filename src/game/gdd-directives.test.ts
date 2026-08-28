import { describe, expect, it } from 'vitest'
import {
  CONTINUE_UNCHANGED,
  DIRECTIVE_WAVES,
  chooseDirective,
  directiveEncounterThreatMult,
  directiveNormalReinforcementIntervalMult,
  directiveScrapMult,
  hasDirectiveOffer,
  isDirectiveWave,
  makeDirectiveOffer,
  queueDirectiveOffer,
} from './directives'
import { createInitialState } from './state'

describe('PR8 Directives', () => {
  it('uses exactly the six canonical opportunity Waves', () => {
    expect(DIRECTIVE_WAVES).toEqual([125, 275, 425, 575, 725, 875])
    for (const wave of DIRECTIVE_WAVES) expect(isDirectiveWave(wave)).toBe(true)
    expect(isDirectiveWave(50)).toBe(false)
    expect(isDirectiveWave(900)).toBe(false)
  })

  it('offers three deterministic eligible choices without consuming combat RNG', () => {
    const s = createInitialState(0)
    s.combat.sortieSeed = 123456
    s.meta.bestWave = 125
    const before = structuredClone(s.combat.rng)
    const a = makeDirectiveOffer(s, 125)
    const b = makeDirectiveOffer(s, 125)
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    expect(s.combat.rng).toEqual(before)
  })

  it('persists an offer and Continue Unchanged consumes it without a Directive', () => {
    const s = createInitialState(0)
    s.combat.sortieSeed = 9
    s.meta.bestWave = 125
    expect(queueDirectiveOffer(s, 125)).toBe(true)
    const saved = [...(s.combat.directiveOffer ?? [])]
    expect(queueDirectiveOffer(s, 125)).toBe(false)
    expect(s.combat.directiveOffer).toEqual(saved)
    const next = chooseDirective(s, CONTINUE_UNCHANGED)
    expect(next.combat.directiveOffer).toBeNull()
    expect(next.combat.directives).toEqual([])
  })

  it('removes picked Directives from later offers and applies Pack Hunter/High Tempo mechanics', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 875
    s.combat.directiveOffer = ['pack-hunter', 'high-tempo', 'scavenger-sweep']
    s = chooseDirective(s, 'pack-hunter')
    s.combat.directiveOffer = ['high-tempo', 'scavenger-sweep', 'overcharge']
    s = chooseDirective(s, 'high-tempo')
    expect(directiveEncounterThreatMult(s)).toBeCloseTo(1.15)
    expect(directiveNormalReinforcementIntervalMult(s)).toBeCloseTo(0.85)
    expect(makeDirectiveOffer(s, 875)).not.toContain('pack-hunter')
    expect(makeDirectiveOffer(s, 875)).not.toContain('high-tempo')
  })

  it('Blueprint Hunt modifies fragment economy rather than guaranteed sources', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 875
    s.combat.directiveOffer = ['blueprint-hunt']
    s = chooseDirective(s, 'blueprint-hunt')
    expect(directiveScrapMult(s)).toBeCloseTo(0.85)
    expect(hasDirectiveOffer(s)).toBe(false)
  })
})
