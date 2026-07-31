import { describe, expect, it } from 'vitest'
import { buildFlagshipWeapons, createInitialState } from './state'
import { startCombat, advanceTicks } from './tick'
import {
  computeFightDamage,
  enemyForSector,
  isBossSector,
  resolveCombatTick,
  simulateCombat,
} from './combat'
import { fitModule, unlockModule } from './actions'

describe('enemy catalog', () => {
  it('rotates families and marks bosses every 5 sectors', () => {
    expect(enemyForSector(1).family).toBe('swarm')
    expect(enemyForSector(2).family).toBe('armored')
    expect(enemyForSector(3).family).toBe('ethereal')
    expect(enemyForSector(4).family).toBe('divine')
    expect(isBossSector(5)).toBe(true)
    expect(enemyForSector(5, 1).isBoss).toBe(false)
    expect(enemyForSector(5, 5).isBoss).toBe(true)
    expect(enemyForSector(5, 5).family).toBe('titan')
    expect(enemyForSector(5, 5).essenceReward).toBeGreaterThan(0)
    expect(enemyForSector(1, 1).units.length).toBeGreaterThan(0)
    expect(enemyForSector(5, 5).units.some((u) => u.isBoss)).toBe(true)
    // Waves in a sector are not identical
    expect(enemyForSector(1, 1).units.map((u) => u.name).join()).not.toBe(
      enemyForSector(1, 3).units.map((u) => u.name).join(),
    )
  })
})

describe('role matchups', () => {
  it('weapons deal more to armored enemies', () => {
    let state = createInitialState(0)
    state.combat.sector = 2
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
    state.combat.sector = 5
    state.combat.wave = 5
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

describe('starter reach', () => {
  it('starter weapons can hit sector 3 ethereal engage range', () => {
    const state = createInitialState(0)
    const maxRange = Math.max(...buildFlagshipWeapons(state).map((w) => w.range))
    const ethereal = enemyForSector(3)
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
    // Place foes at mid-lane so a shot must travel before impact
    for (const u of state.combat.enemyUnits) {
      u.x = 90
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

    // Travel long enough for mid-lane kinetic (~240 u/s) to arrive
    for (let i = 0; i < 30; i += 1) simulateCombat(state, 1 / 60, () => {})
    expect(state.combat.enemyHull).toBeLessThan(before)
  })

  it('clears a sector with multi-unit packs', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    expect(state.combat.enemyUnits.length).toBeGreaterThan(1)
    advanceTicks(state, 120)
    expect(state.combat.sector).toBeGreaterThan(1)
  })
})
