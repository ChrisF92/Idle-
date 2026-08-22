import { describe, expect, it } from 'vitest'
import {
  encounterForWave,
  maybeAdvanceBossPhase,
  simulateCombat,
} from './combat'
import {
  bossMechanicForWave,
  bossMechanicHasAdds,
  bossMechanicHasAura,
  bossMechanicHasShieldPhase,
  bossMechanicTelegraph,
} from './bossMechanics'
import { createInitialState } from './state'
import {
  packDps,
  packEhp,
  threatBudgetForWave,
  threatSpecForWave,
  varyPackToBudget,
} from './threatBudget'
import { startCombat } from './tick'

function seededState(seed: number, wave: number) {
  const s = createInitialState(0)
  s.lastTickAt = 1
  s.combat.sortieSeed = seed
  s.combat.wave = wave
  s.combat.docked = false
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
    const s = startCombat(seededState(42, 12))
    expect(s.combat.sortieSeed).toBe(42)
    expect(s.combat.sortieMark?.sortieSeed).toBe(42)
    expect(s.combat.waveThreat?.seed).toBe(42)
    expect(s.combat.waveThreat?.budget).toBe(threatBudgetForWave(12))
  })

  it('assigns a named mechanic to every 10th Wave and W300', () => {
    expect(bossMechanicForWave(10)).toBe('telegraph-slam')
    expect(bossMechanicForWave(20)).toBe('add-spawn')
    expect(bossMechanicForWave(30)).toBe('shield-phase')
    expect(bossMechanicForWave(40)).toBe('support-aura')
    expect(bossMechanicForWave(50)).toBe('telegraph-slam')
    expect(bossMechanicForWave(300)).toBe('climax-choir')
    expect(bossMechanicForWave(11)).toBeNull()

    const slam = encounterForWave(10)
    expect(slam.isBoss).toBe(true)
    expect(slam.mechanicId).toBe('telegraph-slam')
    const boss = slam.units.find((u) => u.isBoss)!
    expect(boss.weapons[0]?.telegraphDuration).toBeGreaterThanOrEqual(bossMechanicTelegraph('telegraph-slam'))

    expect(encounterForWave(20).mechanicId).toBe('add-spawn')
    expect(encounterForWave(30).mechanicId).toBe('shield-phase')
    expect(encounterForWave(40).mechanicId).toBe('support-aura')
    expect(encounterForWave(300).mechanicId).toBe('climax-choir')
  })

  it('spawns adds when an Add Spawn boss changes phase', () => {
    expect(bossMechanicHasAdds('add-spawn')).toBe(true)
    const s = startCombat(seededState(0, 20))
    s.combat.sortieSeed = 0
    expect(s.combat.bossMechanic).toBe('add-spawn')
    const before = s.combat.enemyUnits.length
    const boss = s.combat.enemyUnits.find((u) => u.isBoss)!
    boss.hull = boss.hullMax * 0.5
    maybeAdvanceBossPhase(s, () => undefined)
    expect(s.combat.bossPhase).toBe(1)
    expect(s.combat.enemyUnits.length).toBeGreaterThan(before)
  })

  it('raises a shield wall on Shield Phase', () => {
    expect(bossMechanicHasShieldPhase('shield-phase')).toBe(true)
    const s = startCombat(seededState(0, 30))
    const boss = s.combat.enemyUnits.find((u) => u.isBoss)!
    const shieldBefore = boss.shieldMax
    boss.hull = boss.hullMax * 0.5
    maybeAdvanceBossPhase(s, () => undefined)
    expect(boss.shieldMax).toBeGreaterThan(shieldBefore)
    expect(boss.shield).toBe(boss.shieldMax)
  })

  it('mends nearby thralls under Support Aura', () => {
    expect(bossMechanicHasAura('support-aura')).toBe(true)
    const s = startCombat(seededState(0, 40))
    for (const unit of s.combat.playerUnits) {
      for (const weapon of unit.weapons) weapon.cooldownLeft = 99
    }
    const add = s.combat.enemyUnits.find((u) => !u.isBoss)!
    add.hull = add.hullMax * 0.4
    const before = add.hull
    simulateCombat(s, 1.2, () => undefined)
    expect(add.hull).toBeGreaterThan(before)
  })
})
