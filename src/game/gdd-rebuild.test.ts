import { describe, expect, it } from 'vitest'
import { buyMatterShop, buyWorkshopUpgrade, performRebuild } from './actions'
import { ACT1_CADENCE } from './cadence'
import { equipRelicOnCore } from './reliquary'
import {
  REBUILD_FIRST_MIN_SORTIES,
  canRebuild,
  cycleBestWave,
  emptyRebuildCycle,
  grantGeneratedScrap,
  matterGainFor,
  rebuildCycle,
  rebuildDoorMet,
} from './rebuild'
import { createInitialState } from './state'
import { armRebuildDoor, atCareerWave } from './testHelpers'
import { extractSortie, setDocked } from './tick'
import { MATTER_SHOP, MATTER_SHOP_CATEGORIES } from './catalog'

describe('GDD Rebuild', () => {
  it('stays locked before Wave 210 even with enough Sorties', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.rebuild - 1)
    s.combat.docked = true
    s.prestige.cycle.normalSortiesCompleted = REBUILD_FIRST_MIN_SORTIES
    expect(rebuildDoorMet(s)).toBe(false)
    expect(canRebuild(s)).toBe(false)
  })

  it('stays locked at Wave 210 until three Sorties have finished', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.rebuild)
    s.combat.docked = true
    s.prestige.cycle.normalSortiesCompleted = 1
    expect(rebuildDoorMet(s)).toBe(false)
    expect(canRebuild(s)).toBe(false)
  })

  it('opens from Dock at Wave 210 after three Sorties, not the live Wave', () => {
    const s = armRebuildDoor(createInitialState(0))
    s.combat.wave = 1
    expect(cycleBestWave(s)).toBe(210)
    expect(canRebuild(s)).toBe(true)
  })

  it('refuses Rebuild while the Sortie is still live', () => {
    const s = armRebuildDoor(createInitialState(0))
    s.combat.docked = false
    expect(canRebuild(s)).toBe(false)
  })

  it('pays Matter from cycle Wave and Scrap generated — not unspent Scrap or Workshop', () => {
    const base = armRebuildDoor(createInitialState(0))
    grantGeneratedScrap(base, 400, 'combat-kill')
    const hoard = structuredClone(base)
    hoard.resources.scrap = 800
    const spend = structuredClone(hoard)
    spend.meta.hullLostOnce = true
    const bought = buyWorkshopUpgrade(spend, 'weapon-power')
    expect(bought.workshop.levels['weapon-power']).toBe(1)
    expect(matterGainFor(bought)).toBe(matterGainFor(hoard))
    expect(matterGainFor(hoard)).toBe(matterGainFor(base))
  })

  it('resets the cycle and keeps Relics, Foundry recipes, and career Best Wave', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = atCareerWave(s, ACT1_CADENCE.reliquary)
    s.combat.docked = true
    s.resources.scrap = 40
    s.resources.choirAsh = 12
    s.resources.heat = 8
    s.workshop.levels['weapon-power'] = 3
    s.combat.directives = ['overcharge']
    s.foundry.masteryXp['recovered-stock'] = 4
    s.reliquary.owned['battle-chip'] = 1
    s = equipRelicOnCore(s, 'pulse-cannon:1', 'battle-chip')
    expect(s.reliquary.coreFits['pulse-cannon:1']).toEqual(['battle-chip'])
    const career = s.meta.bestWave
    const before = matterGainFor(s)

    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.prestige.prestigeCount).toBe(1)
    expect(s.resources.prestigeMatter).toBeGreaterThanOrEqual(before)
    expect(s.meta.bestWave).toBe(career)
    expect(rebuildCycle(s)).toEqual(emptyRebuildCycle())
    expect(canRebuild(s)).toBe(false)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(0)
    expect(s.workshop.levels['weapon-power'] ?? 0).toBe(0)
    expect(s.combat.directives).toEqual([])
    expect(s.foundry.masteryXp['recovered-stock']).toBe(4)
    expect(s.reliquary.coreFits['pulse-cannon:1']).toEqual(['battle-chip'])
  })

  it('does not require Wave 210 again after the first Rebuild', () => {
    let s = armRebuildDoor(createInitialState(0))
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(canRebuild(s)).toBe(false)
    s.prestige.cycle.bestWave = 40
    s.prestige.cycle.normalSortiesCompleted = 1
    s.combat.docked = true
    expect(canRebuild(s)).toBe(true)
  })

  it('uses the five canonical Matter categories', () => {
    expect(MATTER_SHOP_CATEGORIES.map((c) => c.id)).toEqual([
      'offensive',
      'defensive',
      'industrial',
      'foundation',
      'temporal',
    ])
    expect(MATTER_SHOP.every((item) => item.category)).toBe(true)
    expect(MATTER_SHOP.some((item) => item.id === 'workshop-kit')).toBe(false)

    let s = armRebuildDoor(createInitialState(0))
    s.resources.prestigeMatter = 8
    s = buyMatterShop(s, 'time-compression-1')
    expect(s.prestige.matterShop['time-compression-1']).toBe(1)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.workshop.levels['weapon-power'] ?? 0).toBe(0)
    expect(s.prestige.matterShop['time-compression-1']).toBe(1)
  })
})

describe('GDD Rebuild Sortie accounting', () => {
  it('counts Extract as a cycle Sortie and records Scrap generated', () => {
    let s = createInitialState(0)
    s.meta.hullLostOnce = true
    s.meta.bestWave = 210
    s = setDocked(s, false)
    grantGeneratedScrap(s, 25, 'combat-kill')
    s = extractSortie(s)
    expect(rebuildCycle(s).normalSortiesCompleted).toBe(1)
    expect(rebuildCycle(s).scrapGenerated).toBe(25 + Math.floor(25 * 0.125))
  })
})
