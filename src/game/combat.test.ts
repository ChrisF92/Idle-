import { describe, expect, it } from 'vitest'
import { buildFlagshipWeapons, createInitialState } from './state'
import { startCombat, advanceTicks } from './tick'
import {
  computeFightDamage,
  encounterForWave,
  enemyForSector,
  isBossWave,
  PROJECTILE_SPEED,
  projectileSpeedForTag,
  resolveCombatTick,
  sectorRoster,
  simulateCombat,
} from './combat'
import { fitModule, unlockModule } from './actions'
import { equipPostTutorialLoadout } from './testHelpers'

describe('enemy catalog', () => {
  it('uses wave bands for families and bosses at wave 100', () => {
    expect(encounterForWave('sector-1', 1).family).toBe('swarm')
    expect(encounterForWave('sector-1', 19).family).toBe('swarm')
    expect(encounterForWave('sector-1', 26).family).toBe('armored')
    expect(encounterForWave('sector-1', 49).family).toBe('ethereal')
    expect(isBossWave(100)).toBe(true)
    expect(encounterForWave('sector-1', 50).isBoss).toBe(false)
    expect(encounterForWave('sector-1', 100).isBoss).toBe(true)
    expect(encounterForWave('sector-1', 100).family).toBe('titan')
    expect(encounterForWave('sector-1', 100).essenceReward).toBeGreaterThan(0)
    expect(enemyForSector(1, 1).units.length).toBeGreaterThan(0)
    expect(encounterForWave('sector-1', 100).units.some((u) => u.isBoss)).toBe(true)
    // Distinct waves are not identical packs
    expect(enemyForSector(1, 1).units.map((u) => u.name).join()).not.toBe(
      enemyForSector(1, 3).units.map((u) => u.name).join(),
    )
  })
})

describe('role matchups', () => {
  it('weapons deal more to armored enemies', () => {
    let state = createInitialState(0)
    state.combat.wave = 26
    state = startCombat(state)
    expect(state.combat.enemyFamily).toBe('armored')

    const withWeapon = computeFightDamage(state).playerDps

    state.shipyard.modules = []
    const bare = computeFightDamage(state).playerDps
    expect(withWeapon).toBeGreaterThan(bare)
  })

  it('defense reduces swarm incoming damage estimate', () => {
    let state = createInitialState(0)
    state.combat.sector = 1
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state = fitModule(state, 'plate-layer')
    state = startCombat(state)
    expect(state.combat.enemyFamily).toBe('swarm')

    const defended = computeFightDamage(state).enemyDps
    state.shipyard.modules = ['pulse-cannon']
    const exposed = computeFightDamage(state).enemyDps
    expect(defended).toBeLessThan(exposed)
  })

  it('bosses punish missing defense', () => {
    let state = createInitialState(0)
    state.combat.wave = 100
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)

    const nakedIncoming = computeFightDamage(state).enemyDps
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    state.shipyard.modules = [...state.shipyard.modules, 'plate-layer']
    const platedIncoming = computeFightDamage(state).enemyDps
    expect(platedIncoming).toBeLessThan(nakedIncoming)
  })
})

describe('sector roster intel', () => {
  it('lists unique enemies with combat stats for sector info', () => {
    const roster = sectorRoster(1)
    expect(roster.length).toBeGreaterThan(0)
    for (const entry of roster) {
      expect(entry.hull).toBeGreaterThan(0)
      expect(entry.dps).toBeGreaterThan(0)
      expect(entry.speed).toBeGreaterThan(0)
      expect(entry.range).toBeGreaterThan(0)
      expect(entry.weaponTags.length).toBeGreaterThan(0)
      expect(entry.summary.length).toBeGreaterThan(0)
    }
  })
})

describe('starter reach', () => {
  it('starter weapons can hit ethereal engage range', () => {
    const state = createInitialState(0)
    const maxRange = Math.max(...buildFlagshipWeapons(state).map((w) => w.range))
    const ethereal = encounterForWave('sector-1', 49)
    const maxEngage = Math.max(...ethereal.units.map((u) => u.engageRange))
    expect(ethereal.family).toBe('ethereal')
    expect(maxRange).toBeGreaterThanOrEqual(maxEngage)
  })
})

describe('fleet combat resolution', () => {
  it('weapons fire and reduce enemy hull once enemies close into range', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    const before = state.combat.enemyHull
    // Swarms spawn far and must close before anyone can shoot
    for (let i = 0; i < 6; i += 1) resolveCombatTick(state, () => {})
    expect(state.combat.enemyHull).toBeLessThan(before)
  })

  it('defers damage until projectiles impact', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    // Place foes on-axis so a shot must travel before impact
    for (const u of state.combat.enemyUnits) {
      u.x = 50
      u.y = 0
      u.engageRange = 200
    }
    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) {
        w.range = 200
        w.cooldownLeft = 0
      }
    }

    const before = state.combat.enemyHull
    simulateCombat(state, 1 / 60, () => {})
    expect(state.combat.projectiles.length).toBeGreaterThan(0)
    expect(state.combat.enemyHull).toBe(before)

    // Travel long enough for mid-lane shots (PROJECTILE_SPEED) to arrive
    const frames = Math.ceil((50 / PROJECTILE_SPEED) * 60) + 5
    for (let i = 0; i < frames; i += 1) simulateCombat(state, 1 / 60, () => {})
    expect(state.combat.enemyHull).toBeLessThan(before)
  })

  it('uses one projectile speed for all weapon tags', () => {
    expect(projectileSpeedForTag('kinetic')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForTag('pierce')).toBe(PROJECTILE_SPEED)
    expect(projectileSpeedForTag('energy')).toBe(projectileSpeedForTag('splash'))
  })

  it('clears a sector with multi-unit packs', () => {
    let state = equipPostTutorialLoadout(createInitialState(0))
    state = startCombat(state)
    expect(state.combat.enemyUnits.length).toBeGreaterThan(1)
    advanceTicks(state, 120)
    // May still be on wave 1 after a defeat dock; cleared progress is on highestSector/wave.
    expect(state.combat.highestSector).toBeGreaterThanOrEqual(1)
  })
})
