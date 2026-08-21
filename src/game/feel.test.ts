import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import {
  enemyForSector,
  estimateHoldFarmRates,
  maybeAdvanceBossPhase,
  simulateCombat,
} from './combat'
import { startCombat } from './tick'
import { buyAiNode } from './actions'
import { bossWaveForBand } from './waves'

describe('boss telegraphs', () => {
  it('boss weapons wind up before firing', () => {
    let state = createInitialState(0)
    state.combat.wave = bossWaveForBand(5)
    state.combat.docked = false
    state = startCombat(state)
    expect(state.combat.isBoss).toBe(true)
    const boss = state.combat.enemyUnits.find((u) => u.isBoss)
    expect(boss).toBeTruthy()
    const weapon = boss!.weapons[0]!
    expect(weapon.telegraphDuration).toBeGreaterThan(0)

    // Isolate the titan; silence player guns so only boss shots count.
    state.combat.enemyUnits = [boss!]
    for (const u of state.combat.playerUnits) {
      for (const w of u.weapons) w.cooldownLeft = 99
    }
    boss!.x = 90
    weapon.cooldownLeft = 0
    weapon.telegraphLeft = 0
    state.combat.projectiles = []
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBeGreaterThan(0)
    expect(state.combat.projectiles.filter((p) => p.fromId === boss!.id)).toHaveLength(0)

    // Finish wind-up → boss projectile appears.
    weapon.telegraphLeft = 0.01
    simulateCombat(state, 0.05, () => undefined)
    expect(weapon.telegraphLeft).toBe(0)
    expect(state.combat.projectiles.some((p) => p.fromId === boss!.id)).toBe(true)
  })

  it('phase shifts flash a phase warn', () => {
    const state = createInitialState(0)
    state.combat.isBoss = true
    state.combat.bossPhase = 0
    state.combat.enemyUnits = enemyForSector(5, 7).units
    const boss = state.combat.enemyUnits.find((u) => u.isBoss)!
    boss.hull = boss.hullMax * 0.5
    maybeAdvanceBossPhase(state, () => undefined)
    expect(state.combat.bossPhase).toBe(1)
    expect(boss.phaseWarnLeft).toBeGreaterThan(0)
  })
})

describe('Hold farm rates', () => {
  it('reports positive scrap/s with Hold Accountant', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.combat.highestSector = 8
    state.combat.sector = 3
    state.combat.campaign = false
    state.resources.aiPoints = 1
    state = buyAiNode(state, 'hold-accountant')
    const rates = estimateHoldFarmRates(state)
    expect(rates.scrapPerSec).toBeGreaterThan(0)
    expect(rates.salvagePerSec).toBeGreaterThan(0)
    expect(rates.clearSeconds).toBeGreaterThanOrEqual(8)
    expect(computeShipStats(state).damage).toBeGreaterThan(0)
  })
})
