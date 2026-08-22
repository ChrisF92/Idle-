import { describe, expect, it } from 'vitest'
import { buyRunUpgrade, buyWorkshopUpgrade, performRebuild } from './actions'
import { createInitialState } from './state'
import { setDocked } from './tick'
import { armRebuildDoor } from './testHelpers'
import {
  effectiveUpgradeLevel,
  nextRunUpgradeCost,
  runPurchasedLevel,
  runUpgradeCost,
  runUpgradeLevel,
  workshopLevel,
} from './workshop'

function dockedWorkshop(level: number) {
  const s = createInitialState(0)
  s.meta.hullLostOnce = true
  s.combat.docked = true
  s.resources.scrap = 1_000_000
  if (level > 0) {
    let next = s
    for (let i = 0; i < level; i += 1) next = buyWorkshopUpgrade(next, 'weapon-power')
    return next
  }
  return s
}

function launchWithSalvage(state = createInitialState(0), salvage = 50_000) {
  const live = setDocked(state, false)
  live.resources.salvage = salvage
  return live
}

describe('Workshop does not advance the Sortie purchase-cost ladder', () => {
  const base = runUpgradeCost(0)
  const second = runUpgradeCost(1)

  it('Case A: Workshop Lv0 first temporary purchase costs the base', () => {
    const s = launchWithSalvage(dockedWorkshop(0))
    expect(workshopLevel(s, 'weapon-power')).toBe(0)
    expect(nextRunUpgradeCost(s, 'weapon-power')).toBe(base)
  })

  it('Case B: Workshop Lv2 first temporary purchase costs the same base', () => {
    const s = launchWithSalvage(dockedWorkshop(2))
    expect(workshopLevel(s, 'weapon-power')).toBe(2)
    expect(nextRunUpgradeCost(s, 'weapon-power')).toBe(base)
  })

  it('Case C: Workshop Lv100 first temporary purchase still costs the base', () => {
    const s = createInitialState(0)
    s.meta.hullLostOnce = true
    s.workshop.levels['weapon-power'] = 100
    const live = launchWithSalvage(s)
    expect(workshopLevel(live, 'weapon-power')).toBe(100)
    expect(nextRunUpgradeCost(live, 'weapon-power')).toBe(base)
  })

  it('Case D: second purchase cost is identical regardless of Workshop level', () => {
    const a = buyRunUpgrade(launchWithSalvage(dockedWorkshop(0)), 'weapon-power')
    const b = buyRunUpgrade(launchWithSalvage(dockedWorkshop(2)), 'weapon-power')
    const c = buyRunUpgrade(launchWithSalvage(dockedWorkshop(10)), 'weapon-power')
    expect(nextRunUpgradeCost(a, 'weapon-power')).toBe(second)
    expect(nextRunUpgradeCost(b, 'weapon-power')).toBe(second)
    expect(nextRunUpgradeCost(c, 'weapon-power')).toBe(second)
  })

  it('Case E: effective level equals Workshop + Sortie purchased levels', () => {
    let s = launchWithSalvage(dockedWorkshop(2))
    expect(runUpgradeLevel(s, 'weapon-power')).toBe(2)
    s = buyRunUpgrade(s, 'weapon-power')
    expect(workshopLevel(s, 'weapon-power')).toBe(2)
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(1)
    expect(effectiveUpgradeLevel(s, 'weapon-power')).toBe(3)
  })

  it('Case F: a new Sortie resets temporary purchases and the cost ladder', () => {
    let s = launchWithSalvage(dockedWorkshop(2))
    s = buyRunUpgrade(s, 'weapon-power')
    s = buyRunUpgrade(s, 'weapon-power')
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(2)
    s = setDocked(s, true)
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(0)
    expect(workshopLevel(s, 'weapon-power')).toBe(2)
    s = launchWithSalvage(s)
    expect(nextRunUpgradeCost(s, 'weapon-power')).toBe(base)
  })

  it('Case G: Workshop survives Sorties and still resets on Rebuild', () => {
    let s = dockedWorkshop(2)
    s = launchWithSalvage(s)
    s = setDocked(s, true)
    expect(workshopLevel(s, 'weapon-power')).toBe(2)
    s = armRebuildDoor(s)
    s.workshop.levels['weapon-power'] = 2
    s = performRebuild(s, { frameId: s.shipyard.frameId, modules: s.shipyard.modules })
    expect(workshopLevel(s, 'weapon-power')).toBe(0)
    expect(runPurchasedLevel(s, 'weapon-power')).toBe(0)
  })

  it('Buy Max spends the cheap ladder, not the effective-level curve', () => {
    const s = launchWithSalvage(dockedWorkshop(2), 8 + 9 + 11)
    const after = buyRunUpgrade(s, 'weapon-power', Number.POSITIVE_INFINITY)
    expect(runPurchasedLevel(after, 'weapon-power')).toBeGreaterThanOrEqual(2)
    expect(nextRunUpgradeCost(after, 'weapon-power')).toBe(runUpgradeCost(runPurchasedLevel(after, 'weapon-power')))
    expect(workshopLevel(after, 'weapon-power')).toBe(2)
  })

  it('save/load keeps the run-purchase counter separate from Workshop', () => {
    let s = launchWithSalvage(dockedWorkshop(2))
    s = buyRunUpgrade(s, 'weapon-power')
    expect(s.combat.runUpgrades['weapon-power']).toBe(1)
    const clone = structuredClone(s)
    expect(runPurchasedLevel(clone, 'weapon-power')).toBe(1)
    expect(nextRunUpgradeCost(clone, 'weapon-power')).toBe(second)
  })
})
