import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { chooseDirective, makeDirectiveOffer, queueDirectiveOffer } from './directives'
import { encounterForWave } from './encounterGenerator'
import { packThreat } from './threatBudget'
import { tickWaveScheduler } from './waveScheduler'
import { NORMAL_REINFORCEMENT_INTERVAL } from './waves'
import { canIgniteFurnace, convertAshToHeat, furnaceDamageMult, igniteFurnace } from './furnace'

function mature() {
  const s = createInitialState(0)
  s.meta.bestWave = 900
  s.combat.bestWave = 900
  s.combat.sortieSeed = 24680
  return s
}

describe('PR8 integrated Directives + Furnace', () => {
  it('saveable offers are deterministic and do not include a picked Directive', () => {
    const s = mature()
    expect(queueDirectiveOffer(s, 125)).toBe(true)
    const first = [...s.combat.directiveOffer!]
    expect(makeDirectiveOffer(s, 125)).toEqual(first)
    const picked = first[0]!
    const next = chooseDirective(s, picked)
    expect(makeDirectiveOffer(next, 275)).not.toContain(picked)
  })

  it('Pack Hunter increases controlled threat without changing Commander identity/count rules', () => {
    let base = mature()
    base.combat.directives = []
    const ordinary = encounterForWave(421, 77, base)
    let packed = structuredClone(base)
    packed.combat.directives = ['pack-hunter']
    const pressured = encounterForWave(421, 77, packed)
    expect(packThreat(pressured.units)).toBeGreaterThan(packThreat(ordinary.units) * 1.1)
    const commander = encounterForWave(420, 77, packed)
    expect(commander.units.filter((u) => u.isCommander)).toHaveLength(1)
  })

  it('High Tempo changes only normal reinforcement scheduling seed', () => {
    const s = mature()
    s.combat.directives = ['high-tempo']
    s.combat.inFight = true
    s.combat.docked = false
    s.combat.nextWave = 1
    s.combat.nextReinforcementAt = 0
    tickWaveScheduler(s, 0, { pushLog: () => {} })
    expect(s.combat.nextReinforcementAt).toBeCloseTo(NORMAL_REINFORCEMENT_INTERVAL * 0.85)
  })

  it('capacity Directives change computed Hull/Shield without generic healing logic', () => {
    let s = mature()
    const base = computeShipStats(s)
    s.combat.directives = ['reinforced-bulkheads', 'reactive-array']
    const next = computeShipStats(s)
    expect(next.hullMax).toBeGreaterThan(base.hullMax * 1.3)
    expect(next.shieldMax).toBeGreaterThan(base.shieldMax * 1.3)
  })

  it('Furnace requires a live Sortie, supports unbounded Heat, and locks after Ignite', () => {
    let s = mature()
    s.resources.choirAsh = 1200
    expect(convertAshToHeat(s)).toBe(s)
    s.combat.docked = false
    s.combat.inFight = true
    s = convertAshToHeat(s)
    expect(s.resources.heat).toBeGreaterThanOrEqual(120)
    expect(canIgniteFurnace(s, { overdrive: 3, bulwark: 3 }).ok).toBe(true)
    s = igniteFurnace(s, { overdrive: 3, bulwark: 3 })
    expect(furnaceDamageMult(s)).toBeGreaterThan(1.7)
    expect(canIgniteFurnace(s, { harvest: 1 }).ok).toBe(false)
  })
})
