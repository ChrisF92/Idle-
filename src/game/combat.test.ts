import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import {
  computeFightDamage,
  enemyForSector,
  isBossSector,
} from './combat'
import { fitModule, unlockModule } from './actions'

describe('enemy catalog', () => {
  it('rotates families and marks bosses every 5 sectors', () => {
    expect(enemyForSector(1).family).toBe('swarm')
    expect(enemyForSector(2).family).toBe('armored')
    expect(enemyForSector(3).family).toBe('ethereal')
    expect(enemyForSector(4).family).toBe('divine')
    expect(isBossSector(5)).toBe(true)
    expect(enemyForSector(5).isBoss).toBe(true)
    expect(enemyForSector(5).family).toBe('titan')
    expect(enemyForSector(5).essenceReward).toBeGreaterThan(0)
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

  it('defense reduces swarm incoming damage', () => {
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
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)

    const nakedIncoming = computeFightDamage(state).enemyDps
    state.resources.scrap = 999
    state.resources.alloys = 999
    state = unlockModule(state, 'plate-layer')
    // fit while in fight still changes compute (modules list)
    state.shipyard.modules = [...state.shipyard.modules, 'plate-layer']
    const platedIncoming = computeFightDamage(state).enemyDps
    expect(platedIncoming).toBeLessThan(nakedIncoming)
  })
})
