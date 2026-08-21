import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import {
  coreRelicId,
  equipRelicOnCore,
  isRelicsUnlocked,
  relicSocketCount,
  removeRelicFromCore,
  reliquaryDamageMult,
} from './reliquary'

describe('GDD Relics in Cores', () => {
  it('unlocks Relic sockets at Wave 110', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary - 1)
    expect(isRelicsUnlocked(locked)).toBe(false)
    expect(relicSocketCount(locked, 'pulse-cannon')).toBe(0)

    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(relicSocketCount(open, 'pulse-cannon')).toBe(1)
  })

  it('installs a Relic into a fitted Core and applies its effect', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.combat.docked = true
    s.reliquary.owned['battle-chip'] = 1
    const before = computeShipStats(s).damage
    s = equipRelicOnCore(s, 'pulse-cannon', 'battle-chip')
    expect(coreRelicId(s, 'pulse-cannon')).toBe('battle-chip')
    expect(reliquaryDamageMult(s)).toBeGreaterThan(1)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('removes Relics freely while Docked and refuses mid-Sortie swaps', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.combat.docked = true
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
