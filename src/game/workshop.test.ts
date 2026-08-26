import { describe, expect, it } from 'vitest'
import { buyGenericUnlock, buyRunUpgrade, buyWorkshopUpgrade, performRebuild } from './actions'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { armRebuildDoor, markHullLost } from './testHelpers'
import { setDocked } from './tick'
import {
  GENERIC_UNLOCK_COSTS,
  RUN_UPGRADES,
  TUTORIAL_SORTIE_UPGRADE_IDS,
  canUnlockNextGeneric,
  furnaceAvailable,
  genericUnlocks,
  isUpgradePermanentlyKnown,
  nextRunUpgradeCost,
  nextUnlockCost,
  runPurchasedLevel,
  targetingServosSlewMult,
  tutorialSortieShopActive,
  visibleRunUpgrades,
  workshopLevel,
} from './workshop'

function dockedKnown(state = createInitialState(0)) {
  const next = markHullLost(state)
  next.combat.docked = true
  next.meta.hullLostOnce = true
  return next
}

describe('generic upgrades', () => {
  it('defines the canonical 18 upgrades in three independent chains', () => {
    expect(RUN_UPGRADES).toHaveLength(18)
    expect(RUN_UPGRADES.filter((row) => row.category === 'attack').map((row) => row.id)).toEqual([
      'weapon-power',
      'cycle-rate',
      'crit-chance',
      'crit-factor',
      'armor-pen',
      'targeting-servos',
    ])
    expect(RUN_UPGRADES.filter((row) => row.category === 'defense').map((row) => row.id)).toEqual([
      'hull',
      'shield',
      'shield-regen',
      'armor',
      'repair-rate',
      'damage-control',
    ])
    expect(RUN_UPGRADES.filter((row) => row.category === 'economy').map((row) => row.id)).toEqual([
      'salvage-kill',
      'salvage-wave',
      'scrap-kill',
      'scrap-wave',
      'fragment-find',
      'ash-recovery',
    ])
    expect(RUN_UPGRADES.some((row) => row.id === 'fragment-chance')).toBe(false)
    expect(RUN_UPGRADES.some((row) => row.id === 'ash-yield')).toBe(false)
  })

  it('starts with six known upgrades and three tutorial Sortie cards', () => {
    const s = createInitialState(0)
    expect(genericUnlocks(s)).toEqual({ attack: 2, defense: 2, economy: 2 })
    expect(tutorialSortieShopActive(s)).toBe(true)
    s.combat.docked = false
    expect(visibleRunUpgrades(s).map((row) => row.id)).toEqual(TUTORIAL_SORTIE_UPGRADE_IDS)
  })

  it('exposes the starter six after first-death onboarding', () => {
    const s = dockedKnown()
    expect(tutorialSortieShopActive(s)).toBe(false)
    expect(visibleRunUpgrades(s).map((row) => row.id).sort()).toEqual(
      ['cycle-rate', 'hull', 'salvage-kill', 'salvage-wave', 'shield', 'weapon-power'].sort(),
    )
  })

  it('unlocks sequentially at 75 / 250 / 750 / 2000 Scrap without granting levels', () => {
    expect(GENERIC_UNLOCK_COSTS).toEqual([75, 250, 750, 2000])
    let s = dockedKnown()
    s.resources.scrap = 75
    expect(nextUnlockCost(s, 'attack')).toBe(75)
    expect(canUnlockNextGeneric(s, 'attack').ok).toBe(true)
    const defenseBefore = genericUnlocks(s).defense
    s = buyGenericUnlock(s, 'attack')
    expect(genericUnlocks(s).attack).toBe(3)
    expect(genericUnlocks(s).defense).toBe(defenseBefore)
    expect(workshopLevel(s, 'crit-chance')).toBe(0)
    expect(isUpgradePermanentlyKnown(s, 'crit-chance')).toBe(true)
    expect(s.resources.scrap).toBe(0)
    expect(canUnlockNextGeneric(s, 'attack').ok).toBe(false)
    s.resources.scrap = 250
    s = buyGenericUnlock(s, 'attack')
    expect(nextUnlockCost(s, 'attack')).toBe(750)
    s.resources.scrap = 750
    s = buyGenericUnlock(s, 'attack')
    s.resources.scrap = 2000
    s = buyGenericUnlock(s, 'attack')
    expect(genericUnlocks(s).attack).toBe(6)
    expect(workshopLevel(s, 'targeting-servos')).toBe(0)
  })

  it('cannot skip a chain or unlock Ash Recovery before Furnace', () => {
    const s = dockedKnown()
    s.resources.scrap = 10000
    s.meta.genericUpgradeUnlocks = { attack: 2, defense: 2, economy: 5 }
    expect(furnaceAvailable(s)).toBe(false)
    expect(canUnlockNextGeneric(s, 'economy').ok).toBe(false)
    expect(String(canUnlockNextGeneric(s, 'economy').reason)).toMatch(/Furnace/)
    s.meta.bestWave = ACT1_CADENCE.furnace
    expect(canUnlockNextGeneric(s, 'economy').ok).toBe(true)
  })

  it('survives Rebuild as unlocks while Workshop levels reset', () => {
    let s = armRebuildDoor(dockedKnown())
    s.resources.scrap = 75
    s = buyGenericUnlock(s, 'attack')
    s.resources.scrap = 40
    s = buyWorkshopUpgrade(s, 'weapon-power', 1)
    expect(workshopLevel(s, 'weapon-power')).toBeGreaterThan(0)
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(genericUnlocks(s).attack).toBe(3)
    expect(workshopLevel(s, 'weapon-power')).toBe(0)
    expect(isUpgradePermanentlyKnown(s, 'crit-chance')).toBe(true)
  })

  it('keeps temporary Salvage cost independent of Workshop level', () => {
    let a = dockedKnown()
    let b = dockedKnown()
    b.resources.scrap = 400
    for (let i = 0; i < 8; i += 1) b = buyWorkshopUpgrade(b, 'weapon-power')
    expect(workshopLevel(b, 'weapon-power')).toBeGreaterThan(workshopLevel(a, 'weapon-power'))
    a = setDocked(a, false)
    b = setDocked(b, false)
    a.resources.salvage = 500
    b.resources.salvage = 500
    expect(nextRunUpgradeCost(a, 'weapon-power')).toBe(nextRunUpgradeCost(b, 'weapon-power'))
    a = buyRunUpgrade(a, 'weapon-power')
    b = buyRunUpgrade(b, 'weapon-power')
    expect(runPurchasedLevel(a, 'weapon-power')).toBe(1)
    expect(nextRunUpgradeCost(a, 'weapon-power')).toBe(nextRunUpgradeCost(b, 'weapon-power'))
  })

  it('Targeting Servos increase slew only', () => {
    const a = dockedKnown()
    const b = structuredClone(a)
    b.workshop.levels = { ...b.workshop.levels, 'targeting-servos': 4 }
    expect(targetingServosSlewMult(b)).toBeGreaterThan(targetingServosSlewMult(a))
  })
})
