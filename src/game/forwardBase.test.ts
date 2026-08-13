/**
 * Phase 3 — Forward Base buildings, drones, timers, combat wiring.
 */
import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import {
  assignForwardDrone,
  buyExpeditionUpgrade,
  constructOrUpgradeBuilding,
} from './actions'
import { extractExpedition } from './expedition'
import { advanceSeconds } from './tick'
import {
  computeForwardBaseBonuses,
  expeditionDroneCapacity,
  forwardBaseUnlocked,
  startBuildingWork,
  tickForwardBaseTimers,
} from './forwardBase'

function unlockForwardBase(state = createInitialState(0)) {
  state.meta.highestWaveEver = 35
  state.resources.salvage = 10_000
  state.base.workerDrones = 10
  return state
}

describe('forward base', () => {
  it('uses save version 23', () => {
    expect(SAVE_VERSION).toBe(23)
    const state = createInitialState(0)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].level).toBe(0)
  })

  it('unlocks at career wave 10 with corps-derived capacity', () => {
    const locked = createInitialState(0)
    expect(forwardBaseUnlocked(locked)).toBe(false)
    expect(expeditionDroneCapacity(locked)).toBe(0)

    const open = unlockForwardBase()
    expect(forwardBaseUnlocked(open)).toBe(true)
    // 3 + floor(10 * 0.35) = 6
    expect(expeditionDroneCapacity(open)).toBe(6)
  })

  it('constructs Gunnery Matrix after a timer and scales offence ranks', () => {
    let state = unlockForwardBase()
    state = buyExpeditionUpgrade(state, 'weapon-damage', 5)
    const before = computeShipStats(state).damage

    state = constructOrUpgradeBuilding(state, 'gunnery-matrix')
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].timerRemaining).toBeGreaterThan(0)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].level).toBe(0)

    // Pause freezes Expedition timers (industry still runs)
    state.combat.docked = true
    state.combat.mode = 'paused'
    const rem = state.combat.forwardBase.buildings['gunnery-matrix'].timerRemaining!
    advanceSeconds(state, 5)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].timerRemaining).toBeCloseTo(rem, 4)

    state.combat.docked = false
    state.combat.mode = 'push'
    advanceSeconds(state, 20)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].level).toBe(1)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].timerRemaining).toBeUndefined()

    const bonuses = computeForwardBaseBonuses(state)
    expect(bonuses.offenceRankScale).toBeGreaterThan(1)
    expect(bonuses.gunneryDamageMult).toBeGreaterThan(1)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('assigns drones within capacity and Salvage Relay boosts wave salvage mult', () => {
    let state = unlockForwardBase()
    state = startBuildingWork(state, 'salvage-relay')
    tickForwardBaseTimers(state, 30)
    expect(state.combat.forwardBase.buildings['salvage-relay'].level).toBe(1)

    state = assignForwardDrone(state, 'salvage-relay', 2)
    expect(state.combat.forwardBase.buildings['salvage-relay'].assignedDrones).toBe(2)
    expect(state.base.workerDrones).toBe(10) // Home Base unaffected

    const withDrones = computeForwardBaseBonuses(state)
    state = assignForwardDrone(state, 'salvage-relay', -2)
    const without = computeForwardBaseBonuses(state)
    expect(withDrones.salvageWaveMult).toBeGreaterThan(without.salvageWaveMult)
    expect(withDrones.salvageKillFlat).toBeGreaterThan(without.salvageKillFlat)
  })

  it('Shield Foundry and Repair Dock alter defence and between-wave repair', () => {
    let state = unlockForwardBase()
    for (const id of ['shield-foundry', 'repair-dock'] as const) {
      state = startBuildingWork(state, id)
      tickForwardBaseTimers(state, 40)
      expect(state.combat.forwardBase.buildings[id].level).toBe(1)
    }
    const b = computeForwardBaseBonuses(state)
    expect(b.shieldMult).toBeGreaterThan(1)
    expect(b.armorFlat).toBeGreaterThan(0)
    expect(b.damageTakenMult).toBeLessThan(1)
    expect(b.betweenWaveHullFrac).toBeGreaterThan(0.06)
    expect(computeShipStats(state).damageTakenMult).toBeLessThan(1)
  })

  it('resets buildings on Extract', () => {
    let state = unlockForwardBase()
    state = startBuildingWork(state, 'gunnery-matrix')
    tickForwardBaseTimers(state, 20)
    state.combat.bestWaveThisRun = 25
    state.meta.highestWaveEver = 25
    state = extractExpedition(state)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].level).toBe(0)
    expect(state.combat.forwardBase.buildings['gunnery-matrix'].assignedDrones).toBe(0)
  })
})
