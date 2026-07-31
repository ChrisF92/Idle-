import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  assignCombatDrone,
  autoBalanceCombatDrones,
  performPrestige,
} from './actions'
import { buildPlayerFleet } from './combat'
import { advanceTicks, setDocked } from './tick'
import {
  COMBAT_DRONES_UNLOCK_GRANT,
  COMBAT_DRONES_UNLOCK_SECTOR,
  idleCombatDrones,
} from './catalog'

describe('combat drone corps', () => {
  it('unlocks at sector 15 with a starter grant and manufactures more', () => {
    let state = createInitialState(0)
    expect(state.meta.combatDronesUnlocked).toBe(false)
    state.meta.highestSectorEver = COMBAT_DRONES_UNLOCK_SECTOR
    state.combat.docked = true
    advanceTicks(state, 1)
    expect(state.meta.combatDronesUnlocked).toBe(true)
    expect(state.base.combatDrones).toBeGreaterThanOrEqual(COMBAT_DRONES_UNLOCK_GRANT)

    const before = state.base.combatDrones
    advanceTicks(state, 241)
    expect(state.base.combatDrones).toBeGreaterThan(before)
  })

  it('assigns roles, blocks over-assign, and Support stays gated', () => {
    let state = createInitialState(0)
    state.meta.combatDronesUnlocked = true
    state.meta.highestSectorEver = 15
    state.base.combatDrones = 3

    state = assignCombatDrone(state, 'interceptor', 2)
    expect(state.base.combatAssignments.interceptor).toBe(2)
    expect(idleCombatDrones(state)).toBe(1)

    const blocked = assignCombatDrone(state, 'screen', 2)
    expect(blocked.base.combatAssignments.screen ?? 0).toBe(0)

    state = assignCombatDrone(state, 'screen', 1)
    expect(state.base.combatAssignments.screen).toBe(1)
    expect(idleCombatDrones(state)).toBe(0)

    // Support requires career sector 20
    const supportBlocked = assignCombatDrone(state, 'support', 1)
    expect(supportBlocked.base.combatAssignments.support ?? 0).toBe(0)

    state.meta.highestSectorEver = 20
    state.base.combatDrones = 4
    state = assignCombatDrone(state, 'support', 1)
    expect(state.base.combatAssignments.support).toBe(1)
  })

  it('spawns corps escorts in the fleet and boosts stats', () => {
    let state = createInitialState(0)
    state.meta.combatDronesUnlocked = true
    state.meta.highestSectorEver = 20
    state.base.combatDrones = 4
    state = assignCombatDrone(state, 'interceptor', 2)
    state = assignCombatDrone(state, 'screen', 1)
    state = assignCombatDrone(state, 'support', 1)

    const bare = createInitialState(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(computeShipStats(bare).damage)
    expect(computeShipStats(state).shieldMax).toBeGreaterThan(computeShipStats(bare).shieldMax)
    expect(computeShipStats(state).escortCount).toBeGreaterThanOrEqual(4)

    const fleet = buildPlayerFleet(state)
    expect(fleet.some((u) => u.id.startsWith('corps-interceptor'))).toBe(true)
    expect(fleet.some((u) => u.id.startsWith('corps-screen'))).toBe(true)
    expect(fleet.some((u) => u.id.startsWith('corps-support'))).toBe(true)
  })

  it('auto-balances roles and clears assignments on prestige', () => {
    let state = createInitialState(0)
    state.meta.combatDronesUnlocked = true
    state.meta.highestSectorEver = 20
    state.meta.act1Cleared = true
    state.base.combatDrones = 5
    state = autoBalanceCombatDrones(state)
    const assigned = Object.values(state.base.combatAssignments).reduce((a, b) => a + b, 0)
    expect(assigned).toBe(5)
    expect(idleCombatDrones(state)).toBe(0)

    state.combat.sector = 8
    state.combat.highestSector = 8
    state = setDocked(state, true)
    state = performPrestige(state, 1000)
    expect(state.base.combatDrones).toBe(5)
    expect(Object.keys(state.base.combatAssignments)).toHaveLength(0)
  })
})
