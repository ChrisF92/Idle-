import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { simulateCombat } from './combat'
import { startCombat } from './tick'
import { TYPICAL_SPAWN_RADIUS, pointFromBearing } from './geometry'
import type { CombatUnit } from './types'

function testBoss(wave: number): CombatUnit {
  const pos = pointFromBearing(0, TYPICAL_SPAWN_RADIUS)
  return {
    id: `test-boss-w${wave}`,
    side: 'enemy',
    name: `Fixture Boss ${wave}`,
    shape: 'hex',
    family: '',
    hull: 80,
    hullMax: 80,
    shield: 0,
    shieldMax: 0,
    armor: 2,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [
      {
        id: `test-boss-w${wave}-wpn`,
        name: 'Slam',
        damage: 4,
        cooldown: 2.2,
        cooldownLeft: 0,
        range: 90,
        tags: ['kinetic'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0.4,
        telegraphLeft: 0,
      },
    ],
    isBoss: true,
    isFlagship: false,
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: 0,
    speed: 8,
    engageRange: 90,
    kite: false,
    phaseWarnLeft: 0,
    regenDelay: 0,
    sourceWave: wave,
    packageId: `boss-${wave}`,
  }
}

describe('boss telegraphs', () => {
  it('boss weapons wind up before firing', () => {
    let state = startCombat(createInitialState(0))
    const boss = testBoss(50)
    state.combat.isBoss = true
    state.combat.enemyUnits = [boss]
    const weapon = boss.weapons[0]!
    expect(weapon.telegraphDuration).toBeGreaterThan(0)

    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) w.cooldownLeft = 99
    }
    boss.x = 90
    boss.y = 0
    weapon.cooldownLeft = 0
    weapon.telegraphLeft = 0
    state.combat.projectiles = []
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBeGreaterThan(0)
    expect(state.combat.projectiles.filter((p) => p.fromId === boss.id)).toHaveLength(0)

    weapon.telegraphLeft = 0.01
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBe(0)
    expect(state.combat.projectiles.some((p) => p.fromId === boss.id)).toBe(true)
  })

  it('provider-driven bosses do not auto-shift through generic hull phases', () => {
    const state = createInitialState(0)
    state.combat.isBoss = true
    state.combat.bossPhase = 0
    const boss = testBoss(50)
    state.combat.enemyUnits = [boss]
    boss.hull = boss.hullMax * 0.2
    simulateCombat(state, 0.2, () => undefined)
    expect(state.combat.bossPhase).toBe(0)
    expect(boss.family).toBe('')
    expect(boss.phaseWarnLeft).toBe(0)
  })
})
