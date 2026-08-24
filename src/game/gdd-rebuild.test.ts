import { describe, expect, it } from 'vitest'
import { buyMatterShop, buyWorkshopUpgrade, canPrestige, performRebuild, prestigeGainFor } from './actions'
import { ACT1_CADENCE } from './cadence'
import { equipRelicOnCore } from './reliquary'
import {
  REBUILD_MIN_SORTIES,
  cycleBestWave,
  rebuildCycle,
  rebuildDoorMet,
} from './rebuild'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave } from './testHelpers'
import { setDocked } from './tick'
import { MATTER_SHOP, MATTER_SHOP_CATEGORIES } from './catalog'
import { rebuildPowerPreview } from './uiReadout'

describe('GDD Rebuild', () => {
  it('stays locked before Wave 70 even with enough Sorties', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.rebuild - 1)
    s.combat.docked = true
    s.prestige.cycle.sorties = REBUILD_MIN_SORTIES
    expect(rebuildDoorMet(s)).toBe(false)
    expect(canPrestige(s)).toBe(false)
  })

  it('stays locked at Wave 70 until several Sorties have finished', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.rebuild)
    s.combat.docked = true
    s.prestige.cycle.sorties = 1
    expect(rebuildDoorMet(s)).toBe(false)
    expect(canPrestige(s)).toBe(false)
  })

  it('opens from Dock at Wave 70 after three Sorties, not the live Wave', () => {
    const s = armRebuildDoor(createInitialState(0))
    s.combat.wave = 1
    s.combat.sector = 1
    expect(cycleBestWave(s)).toBe(70)
    expect(canPrestige(s)).toBe(true)
  })

  it('refuses Rebuild while the Sortie is still live', () => {
    const s = armRebuildDoor(createInitialState(0))
    s.combat.docked = false
    expect(canPrestige(s)).toBe(false)
  })

  it('pays Matter from cycle Wave, Scrap generated, and Workshop ranks — not unspent Scrap', () => {
    const base = armRebuildDoor(createInitialState(0))
    const hoard = structuredClone(base)
    hoard.resources.scrap = 800
    hoard.prestige.cycle.scrapEarned = 400
    const spend = structuredClone(hoard)
    spend.meta.hullLostOnce = true
    spend.resources.scrap = 800
    const bought = buyWorkshopUpgrade(spend, 'weapon-power')
    expect(bought.workshop.levels['weapon-power']).toBe(1)
    expect(prestigeGainFor(bought)).toBeGreaterThan(prestigeGainFor(hoard))
    expect(prestigeGainFor(hoard)).toBe(prestigeGainFor(base) + Math.min(4, 7))
  })

  it('resets the cycle and keeps Relics, Foundry recipes, and career Best Wave', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.reliquary)
    s.combat.docked = true
    s.resources.scrap = 40
    s.resources.choirAsh = 12
    s.resources.heat = 8
    s.workshop.levels['weapon-power'] = 3
    s.shipyard.moduleLevels['pulse-cannon'] = 9
    s.combat.directives = ['overcharge']
    s.foundry.recipeLevels['slag-ingot'] = 4
    s.reliquary.owned['battle-chip'] = 1
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    expect(s.reliquary.coreFits['pulse-cannon:1']).toEqual(['battle-chip'])
    const career = s.meta.bestWave
    const before = prestigeGainFor(s)

    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.prestige.prestigeCount).toBe(1)
    expect(s.resources.prestigeMatter).toBeGreaterThanOrEqual(before)
    expect(s.meta.bestWave).toBe(career)
    expect(rebuildCycle(s)).toEqual({ bestWave: 0, sorties: 0, scrapEarned: 0 })
    expect(canPrestige(s)).toBe(false)
    expect(s.resources.scrap).toBe(0)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(0)
    expect(s.workshop.levels['weapon-power'] ?? 0).toBe(0)
    expect(s.shipyard.moduleLevels['pulse-cannon'] ?? 0).toBe(0)
    expect(s.combat.directives).toEqual([])
    expect(s.foundry.recipeLevels['slag-ingot']).toBe(4)
    expect(s.reliquary.coreFits['pulse-cannon:1']).toEqual(['battle-chip'])
  })

  it('does not let a second Rebuild fire until this cycle reaches Wave 70 again', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(canPrestige(s)).toBe(false)
    s = atCareerWave(s, 40)
    s.prestige.cycle.sorties = 2
    s.combat.docked = true
    expect(canPrestige(s)).toBe(false)
    s = atCareerWave(s, 70)
    s.prestige.cycle.sorties = 2
    expect(canPrestige(s)).toBe(true)
  })

  it('shows Matter stronger than Workshop and applies Workshop Kit after Rebuild', () => {
    const preview = rebuildPowerPreview(armRebuildDoor(createInitialState(0)), 8)
    expect(preview.edgeBeatsWorkshop).toBe(true)
    expect(preview.edgeRank1).toBeGreaterThan(preview.workshopRank1)
    expect(MATTER_SHOP_CATEGORIES.map((c) => c.id)).toEqual([
      'offensive',
      'defensive',
      'industrial',
      'foundation',
      'temporal',
    ])
    expect(MATTER_SHOP.every((item) => item.category)).toBe(true)

    let s = armRebuildDoor(createInitialState(0))
    s.resources.prestigeMatter = 5
    s = buyMatterShop(s, 'workshop-kit')
    expect(s.prestige.matterShop['workshop-kit']).toBe(1)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.workshop.levels['weapon-power']).toBe(1)
  })
})

describe('GDD Rebuild Sortie accounting', () => {
  it('counts Extract as a cycle Sortie and records Scrap generated', () => {
    let s = createInitialState(0)
    s.resources.scrap = 0
    s = setDocked(s, false)
    s.resources.scrap = 25
    s = setDocked(s, true)
    expect(rebuildCycle(s).sorties).toBe(1)
    expect(rebuildCycle(s).scrapEarned).toBeGreaterThanOrEqual(25)
  })
})
