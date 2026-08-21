import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import {
  RELIC_UNIVERSAL_MASTERY,
  canUpgradeRelic,
  coreRelicId,
  coreSocketLayout,
  coreSocketRelics,
  equipRelicOnCore,
  isRelicsUnlocked,
  relicSocketCount,
  reliquaryDamageMult,
  removeRelicFromCore,
  upgradeRelic,
} from './reliquary'

function relicDock(wave = ACT1_CADENCE.reliquary) {
  let s = atCareerWave(createInitialState(0), wave)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
  return s
}

describe('GDD Relics in Cores', () => {
  it('unlocks Relic sockets at Wave 110', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary - 1)
    expect(isRelicsUnlocked(locked)).toBe(false)
    expect(relicSocketCount(locked, 'pulse-cannon')).toBe(0)

    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(relicSocketCount(open, 'pulse-cannon')).toBe(1)
    expect(coreSocketLayout(open, 'pulse-cannon')).toEqual(['power'])
    expect(coreSocketLayout(open, 'plate-layer')).toEqual(['shield'])
  })

  it('installs a Relic into a fitted Core and applies its effect', () => {
    let s = relicDock()
    s.reliquary.owned['battle-chip'] = 1
    const before = computeShipStats(s).damage
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    expect(coreRelicId(s, 'pulse-cannon')).toBe('battle-chip')
    expect(s.reliquary.coreFits['pulse-cannon']).toEqual(['battle-chip'])
    expect(reliquaryDamageMult(s)).toBeGreaterThan(1)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('seats Power Relics on Pulse and Shield Relics on Plate', () => {
    let s = relicDock()
    s.reliquary.owned['battle-chip'] = 1
    s.reliquary.owned['plate-chip'] = 1

    expect(equipRelicOnCore(s, 'pulse-cannon', 'plate-chip')).toBe(s)
    expect(equipRelicOnCore(s, 'plate-layer', 'battle-chip')).toBe(s)

    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    s = equipRelicOnCore(s, 'plate-layer', 'plate-chip')
    expect(coreSocketRelics(s, 'pulse-cannon')[0]).toBe('battle-chip')
    expect(coreSocketRelics(s, 'plate-layer')[0]).toBe('plate-chip')
  })

  it('opens a Universal socket at Core Mastery 5', () => {
    let s = relicDock()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'plate-layer': RELIC_UNIVERSAL_MASTERY }
    expect(coreSocketLayout(s, 'plate-layer')).toEqual(['shield', 'universal'])
    s.reliquary.owned['battle-chip'] = 1
    s = equipRelicOnCore(s, 'plate-layer', 'battle-chip', 1)
    expect(coreSocketRelics(s, 'plate-layer')[1]).toBe('battle-chip')
    expect(reliquaryDamageMult(s)).toBeGreaterThan(1)
  })

  it('refuses the same Relic family twice on one Core', () => {
    let s = relicDock()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'pulse-cannon': RELIC_UNIVERSAL_MASTERY }
    s.reliquary.owned['battle-chip'] = 2
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip', 0)
    const blocked = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip', 1)
    expect(coreSocketRelics(blocked, 'pulse-cannon')).toEqual(['battle-chip', null])
    expect(blocked.reliquary.owned['battle-chip']).toBe(1)
  })

  it('upgrades I to II with a spare Relic and Slag Ingots', () => {
    let s = relicDock()
    s.reliquary.owned['battle-chip'] = 2
    s.foundry.materials['slag-ingot'] = 4
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    const withI = reliquaryDamageMult(s)
    expect(canUpgradeRelic(s, 'battle-chip').ok).toBe(true)
    s = upgradeRelic(s, 'battle-chip')
    expect(s.reliquary.owned['battle-chip'] ?? 0).toBe(0)
    expect(s.reliquary.owned['battle-chip-ii'] ?? 0).toBe(0)
    expect(s.foundry.materials['slag-ingot']).toBe(0)
    expect(coreSocketRelics(s, 'pulse-cannon')[0]).toBe('battle-chip-ii')
    expect(reliquaryDamageMult(s)).toBeGreaterThan(withI)
  })

  it('lets two copies on two Cores both apply', () => {
    let s = relicDock()
    s.meta.moduleMastery = { ...s.meta.moduleMastery, 'plate-layer': RELIC_UNIVERSAL_MASTERY }
    s.reliquary.owned['battle-chip'] = 2
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip', 0)
    const one = reliquaryDamageMult(s)
    s = equipRelicOnCore(s, 'plate-layer', 'battle-chip', 1)
    expect(reliquaryDamageMult(s)).toBeGreaterThan(one)
    expect(reliquaryDamageMult(s)).toBeCloseTo(1.16)
  })

  it('does not let hoarded extras raise Relic bonuses', () => {
    let s = relicDock()
    s.reliquary.owned['battle-chip'] = 1
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    const fitted = reliquaryDamageMult(s)
    s.reliquary.owned['battle-chip'] = 24
    expect(reliquaryDamageMult(s)).toBe(fitted)
  })

  it('removes Relics freely while Docked and refuses mid-Sortie swaps', () => {
    let s = relicDock()
    s.reliquary.owned['battle-chip'] = 1
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    s.combat.docked = false
    const live = removeRelicFromCore(s, 'pulse-cannon')
    expect(coreRelicId(live, 'pulse-cannon')).toBe('battle-chip')

    s.combat.docked = true
    s = removeRelicFromCore(s, 'pulse-cannon')
    expect(coreRelicId(s, 'pulse-cannon')).toBeNull()
    expect(s.reliquary.owned['battle-chip']).toBe(1)
  })

  it('does not grant bonuses from leftover colour slots', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.reliquary.slots.red = 'battle-chip'
    expect(reliquaryDamageMult(s)).toBe(1)
  })
})
