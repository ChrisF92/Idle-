import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats, SAVE_VERSION } from './state'
import { buyMatterShop, performPrestige } from './actions'
import { encounterForWave, repairRatePerSecond } from './combat'

import {
  canBuyMatterShop,
  droneCap,
  matterShopEffectScale,
  matterShopScrapBonus,
  metaProductionMultiplier,
  nextShopCost,
  shopRank,
} from './catalog'
import { startCombat } from './tick'
import { clearCurrentWave } from './testHelpers'
import { exportSave, importSave } from './save'


describe('prestige matter shop', () => {
  it('spends PM on matter-blade and boosts damage more than banking', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    const bankedDamage = computeShipStats(state).damage
    state = buyMatterShop(state, 'matter-blade')
    expect(shopRank(state.prestige.matterShop, 'matter-blade')).toBe(1)
    expect(state.resources.prestigeMatter).toBe(0)
    expect(computeShipStats(state).damage).toBeGreaterThan(bankedDamage)
  })

  it('matter-forge boosts production beyond banked PM', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    const banked = metaProductionMultiplier(3, {})
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

  it('drydock-boost increases repair rate', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    const before = repairRatePerSecond(state)
    state = buyMatterShop(state, 'drydock-boost')
    expect(repairRatePerSecond(state)).toBeGreaterThan(before)
  })

  it('shield-bank adds permanent shield capacity', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    const before = computeShipStats(state).shieldMax
    state = buyMatterShop(state, 'shield-bank')
    expect(computeShipStats(state).shieldMax).toBe(before + 40)
  })

  it('archive-spur grants extra data on clear', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state.meta.highestSectorEver = 6
    state = buyMatterShop(state, 'archive-spur')
    state.resources.data = 0
    state = startCombat(state)
    const enemy = encounterForWave('sector-1', state.combat.wave)
    state = clearCurrentWave(state)
    expect(state.resources.data).toBe(enemy.dataReward + 2)
  })

  it('keeps matter shop purchases across prestige', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state = buyMatterShop(state, 'matter-blade')
    state.meta.highestWaveEver = 50
    state.combat.bestWaveThisRun = 50
    state = performPrestige(state, 8000)
    expect(shopRank(state.prestige.matterShop, 'matter-blade')).toBe(1)
  })

  it('rejects purchase without enough PM', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 2
    state = buyMatterShop(state, 'matter-blade')
    expect(shopRank(state.prestige.matterShop, 'matter-blade')).toBe(0)
    expect(state.resources.prestigeMatter).toBe(2)
  })

  it('ranks use steeper costs and 45% extra-rank scaling', () => {
    expect(nextShopCost(3, 0)).toBe(3)
    expect(nextShopCost(3, 1)).toBe(6)
    expect(matterShopEffectScale(1)).toBe(1)
    expect(matterShopEffectScale(2)).toBeCloseTo(1.45)
    expect(matterShopEffectScale(0)).toBe(0)

    let state = createInitialState(0)
    state.resources.prestigeMatter = 9
    state.prestige.prestigeCount = 2
    state = buyMatterShop(state, 'matter-blade')
    expect(shopRank(state.prestige.matterShop, 'matter-blade')).toBe(1)
    state = buyMatterShop(state, 'matter-blade')
    expect(shopRank(state.prestige.matterShop, 'matter-blade')).toBe(2)
    expect(state.resources.prestigeMatter).toBe(0)
    // 8% * 1.45 = 11.6% from shop; banked 0
    const mult = 1 + 0.08 * 1.45
    expect(computeShipStats(state).damage).toBeGreaterThan(
      computeShipStats({
        ...createInitialState(0),
        resources: { ...createInitialState(0).resources, prestigeMatter: 0 },
      }).damage * (mult - 0.01),
    )
  })

  it('gates rank 4+ without prestige/sector progress', () => {
    let state = createInitialState(0)
    state.prestige.matterShop = { 'matter-blade': 3 }
    state.resources.prestigeMatter = 100
    state.prestige.prestigeCount = 1
    state.meta.highestSectorEver = 10
    const check = canBuyMatterShop(state, 'matter-blade')
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/rank 4/)
    state.prestige.prestigeCount = 2
    expect(canBuyMatterShop(state, 'matter-blade').ok).toBe(true)
  })

  it('rejects legacy matterShop string[] saves (pre-v21)', () => {
    const legacy = createInitialState(0)
    // Simulate v13 array save — old versions are rejected
    const raw = {
      ...legacy,
      version: 13,
      prestige: {
        ...legacy.prestige,
        shop: ['iron-will'],
        matterShop: ['matter-blade', 'matter-forge'],
      },
    }
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(raw))))
    const migrated = importSave(code)
    expect(migrated).toBeNull()
    // Current-version saves still round-trip
    const current = createInitialState(0)
    current.prestige.matterShop = { 'matter-blade': 1, 'matter-forge': 1 }
    current.prestige.shop = { 'iron-will': 1 }
    const again = importSave(exportSave(current))
    expect(again).not.toBeNull()
    expect(again!.version).toBe(SAVE_VERSION)
    expect(shopRank(again!.prestige.matterShop, 'matter-blade')).toBe(1)
    expect(shopRank(again!.prestige.matterShop, 'matter-forge')).toBe(1)
    expect(shopRank(again!.prestige.shop, 'iron-will')).toBe(1)
  })

  it('drone-corps raises corps capacity each rank', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 15
    state.prestige.prestigeCount = 2
    const before = droneCap(state)
    state = buyMatterShop(state, 'drone-corps')
    expect(droneCap(state)).toBe(before + 5)
    expect(state.base.workerDrones).toBe(0)
    state = buyMatterShop(state, 'drone-corps')
    expect(droneCap(state)).toBe(before + 10)
    expect(shopRank(state.prestige.matterShop, 'drone-corps')).toBe(2)
  })
})
