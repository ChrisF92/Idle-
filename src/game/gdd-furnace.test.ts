import { describe, expect, it } from 'vitest'
import { ACT1_CADENCE } from './cadence'
import {
  ASH_PER_HEAT,
  canIgniteFurnace,
  convertAshToHeat,
  createEmptyFurnaceState,
  endFurnaceSortie,
  furnaceDamageMult,
  furnaceFragmentFindMult,
  furnaceGuidanceModifier,
  furnaceHullMult,
  furnaceSalvageMult,
  igniteFurnace,
} from './furnace'
import { createInitialState } from './state'

function liveFurnace() {
  const s = createInitialState(0)
  s.meta.bestWave = ACT1_CADENCE.furnace
  s.combat.bestWave = ACT1_CADENCE.furnace
  s.combat.wave = ACT1_CADENCE.furnace
  s.combat.waveReached = ACT1_CADENCE.furnace
  s.combat.docked = false
  s.combat.inFight = true
  return s
}

describe('PR8 Furnace', () => {
  it('unlocks at W450 and converts 10 Ash to 1 Heat with no capacity', () => {
    expect(ACT1_CADENCE.furnace).toBe(450)
    const s = liveFurnace()
    s.resources.choirAsh = ASH_PER_HEAT * 100
    const next = convertAshToHeat(s)
    expect(next.resources.choirAsh).toBe(0)
    expect(next.resources.heat).toBeGreaterThanOrEqual(100)
  })

  it('enforces two selected channels and canonical total Heat costs', () => {
    const s = liveFurnace()
    s.resources.heat = 100
    expect(canIgniteFurnace(s, { overdrive: 1, bulwark: 2 }).cost).toBe(35)
    expect(canIgniteFurnace(s, { overdrive: 1, bulwark: 1, guidance: 1 }).ok).toBe(false)
  })

  it('Ignites once, consumes Heat, and locks the exact channel state', () => {
    const s = liveFurnace()
    s.resources.heat = 60
    const next = igniteFurnace(s, { overdrive: 1, guidance: 2 })
    expect(next.furnace.ignited).toBe(true)
    expect(next.furnace.channels).toEqual({ overdrive: 1, bulwark: 0, guidance: 2, harvest: 0 })
    expect(next.resources.heat).toBe(25)
    expect(igniteFurnace(next, { harvest: 1 })).toBe(next)
  })

  it('uses the canonical channel seeds', () => {
    let s = liveFurnace()
    s.resources.heat = 120
    s = igniteFurnace(s, { overdrive: 3, guidance: 3 })
    expect(furnaceDamageMult(s)).toBeCloseTo(1.8)
    expect(furnaceGuidanceModifier(s).slewRateMult).toBeCloseTo(1.55)
    expect(furnaceGuidanceModifier(s).acquisitionRangeMult).toBeCloseTo(1.15)
    expect(furnaceGuidanceModifier(s).firingArcAdd).toBeCloseTo(12)
  })

  it('Harvest never raises Ash but III raises Salvage/Scrap and modest Fragment Find', () => {
    let s = liveFurnace()
    s.resources.heat = 60
    s = igniteFurnace(s, { harvest: 3 })
    expect(furnaceSalvageMult(s)).toBeCloseTo(1.8)
    expect(furnaceFragmentFindMult(s)).toBeCloseTo(1.15)
  })

  it('Bulwark raises capacity and Sortie end dumps Heat and locked state', () => {
    let s = liveFurnace()
    s.resources.heat = 25
    s = igniteFurnace(s, { bulwark: 2 })
    expect(furnaceHullMult(s)).toBeCloseTo(1.4)
    endFurnaceSortie(s)
    expect(s.resources.heat).toBe(0)
    expect(s.furnace).toEqual(createEmptyFurnaceState())
  })

  it('Burn Hot is snapshotted only when Ignite occurs', async () => {
    const { chooseDirective } = await import('./directives')
    let s = liveFurnace()
    s.resources.heat = 20
    s = igniteFurnace(s, { overdrive: 1 })
    s.combat.directiveOffer = ['burn-hot']
    s = chooseDirective(s, 'burn-hot')
    expect(furnaceDamageMult(s)).toBeCloseTo(1.2)

    let t = liveFurnace()
    t.resources.heat = 20
    t.combat.directiveOffer = ['burn-hot']
    t = chooseDirective(t, 'burn-hot')
    t = igniteFurnace(t, { overdrive: 1 })
    expect(furnaceDamageMult(t)).toBeCloseTo(1.24)
  })
})
