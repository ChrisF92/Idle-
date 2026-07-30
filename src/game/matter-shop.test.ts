import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { buyMatterShop, performPrestige } from './actions'
import { repairDelaySeconds, enemyForSector } from './combat'
import { matterShopScrapBonus, metaProductionMultiplier } from './catalog'
import { tickGame, startCombat } from './tick'

describe('prestige matter shop', () => {
  it('spends PM on matter-blade and boosts damage more than banking', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    const bankedDamage = computeShipStats(state).damage
    state = buyMatterShop(state, 'matter-blade')
    expect(state.prestige.matterShop).toContain('matter-blade')
    expect(state.resources.prestigeMatter).toBe(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(bankedDamage)
  })

  it('matter-forge boosts production beyond banked PM', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    const banked = metaProductionMultiplier(3, [])
    state = buyMatterShop(state, 'matter-forge')
    const spent = metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
    )
    expect(spent).toBeGreaterThan(banked)
  })

  it('matter-plating adds hull', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    const before = computeShipStats(state).hullMax
    state = buyMatterShop(state, 'matter-plating')
    expect(computeShipStats(state).hullMax).toBe(before + 50)
  })

  it('salvage-rights increases combat scrap multiplier', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state = buyMatterShop(state, 'salvage-rights')
    expect(matterShopScrapBonus(state.prestige.matterShop)).toBe(0.25)
  })

  it('drydock-boost shortens repair delay', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    state.combat.consecutiveLosses = 1
    const before = repairDelaySeconds(state)
    state = buyMatterShop(state, 'drydock-boost')
    expect(repairDelaySeconds(state)).toBeLessThan(before)
  })

  it('archive-spur grants extra data on clear', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state = buyMatterShop(state, 'archive-spur')
    state.resources.data = 0
    state = startCombat(state)
    // Overkill the enemy in one tick
    state.combat.enemyHull = 1
    const enemy = enemyForSector(state.combat.sector)
    state = tickGame(state, 1000)
    expect(state.resources.data).toBe(enemy.dataReward + 2)
  })

  it('keeps matter shop purchases across prestige', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state = buyMatterShop(state, 'matter-blade')
    state.combat.sector = 8
    state = performPrestige(state, 8000)
    expect(state.prestige.matterShop).toContain('matter-blade')
  })

  it('rejects purchase without enough PM', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 2
    state = buyMatterShop(state, 'matter-blade')
    expect(state.prestige.matterShop).not.toContain('matter-blade')
    expect(state.resources.prestigeMatter).toBe(2)
  })
})
