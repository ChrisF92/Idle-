/**
 * Phase 2 — Expedition Salvage store tests.
 */
import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import { buyExpeditionUpgrade } from './actions'
import { extractExpedition } from './expedition'
import {
  maxAffordableRanks,
  upgradeCostAtRank,
  upgradeCostForRanks,
  computeExpeditionUpgradeBonuses,
} from './expeditionUpgrades'

describe('expedition upgrades', () => {
  it('uses save version 23', () => {
    expect(SAVE_VERSION).toBe(23)
    expect(createInitialState().combat.upgrades).toEqual({})
  })

  it('costs follow base × growth^rank', () => {
    const cost0 = upgradeCostAtRank(
      { id: 'weapon-damage', name: '', category: 'offence', description: '', baseCost: 8, growth: 1.15, cap: 50, unlockWave: 0, effectPerRank: '' },
      0,
    )
    const cost1 = upgradeCostAtRank(
      { id: 'weapon-damage', name: '', category: 'offence', description: '', baseCost: 8, growth: 1.15, cap: 50, unlockWave: 0, effectPerRank: '' },
      1,
    )
    expect(cost0).toBe(8)
    expect(cost1).toBe(Math.ceil(8 * 1.15))
    expect(upgradeCostForRanks(
      { id: 'weapon-damage', name: '', category: 'offence', description: '', baseCost: 8, growth: 1.15, cap: 50, unlockWave: 0, effectPerRank: '' },
      0,
      2,
    )).toBe(cost0 + cost1)
  })

  it('buys ranks with Salvage and raises damage', () => {
    let state = createInitialState(0)
    state.resources.salvage = 500
    const before = computeShipStats(state).damage
    state = buyExpeditionUpgrade(state, 'weapon-damage', 10)
    expect(state.combat.upgrades['weapon-damage']).toBe(10)
    expect(state.resources.salvage).toBeLessThan(500)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
    const bonuses = computeExpeditionUpgradeBonuses(state.combat.upgrades)
    expect(bonuses.damageMult).toBeCloseTo(1.5, 5)
  })

  it('respects caps and max buy affordability', () => {
    let state = createInitialState(0)
    state.resources.salvage = 30
    const affordable = maxAffordableRanks(
      {
        id: 'weapon-damage',
        name: '',
        category: 'offence',
        description: '',
        baseCost: 8,
        growth: 1.15,
        cap: 50,
        unlockWave: 0,
        effectPerRank: '',
      },
      0,
      30,
    )
    expect(affordable).toBeGreaterThan(0)
    state = buyExpeditionUpgrade(state, 'weapon-damage', 'max')
    expect(state.combat.upgrades['weapon-damage']).toBe(affordable)
    expect(state.resources.salvage).toBeLessThan(30)
  })

  it('gates crit upgrades until career wave 10', () => {
    let state = createInitialState(0)
    state.resources.salvage = 1000
    state = buyExpeditionUpgrade(state, 'crit-chance', 1)
    expect(state.combat.upgrades['crit-chance']).toBeUndefined()
    state.meta.highestWaveEver = 10
    state = buyExpeditionUpgrade(state, 'crit-chance', 1)
    expect(state.combat.upgrades['crit-chance']).toBe(1)
  })

  it('resets upgrades and Salvage on Extract', () => {
    let state = createInitialState(0)
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state.resources.salvage = 2000
    state = buyExpeditionUpgrade(state, 'max-hull', 10)
    expect(state.combat.upgrades['max-hull']).toBe(10)
    state.combat.bestWaveThisRun = 50
    state = extractExpedition(state)
    expect(state.combat.upgrades).toEqual({})
    expect(state.resources.salvage).toBe(0)
  })

  it('raises hull from Maximum Hull ranks', () => {
    let state = createInitialState(0)
    state.resources.salvage = 1000
    const before = computeShipStats(state).hullMax
    state = buyExpeditionUpgrade(state, 'max-hull', 10)
    expect(computeShipStats(state).hullMax).toBeCloseTo(before * 1.4, 5)
  })
})
