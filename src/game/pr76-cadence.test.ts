import { describe, expect, it } from 'vitest'
import { createInitialState, globalDamageMultiplier } from './state'
import { ACT1_CADENCE, ECHO_MIN_PROTOCOL_RANKS, PROCESS_MIN_REBUILDS, YARD_MIN_REBUILDS } from './cadence'
import { isSystemUnlocked, PRESTIGE_MIN_SECTOR } from './progression'
import { ROUTE_B_UNLOCK_CLEARED } from './sectors'
import { matterShopRankMultiplier, modulePrintSector } from './catalog'

function atSector(sector: number) {
  const state = createInitialState(1)
  state.meta.highestSectorEver = sector
  state.combat.highestSector = sector
  state.combat.sector = sector + 1
  state.meta.hullLostOnce = true
  return state
}

describe('PR76 system cadence', () => {
  it('spreads major systems across the career', () => {
    expect(ACT1_CADENCE.foundry).toBe(6)
    expect(PRESTIGE_MIN_SECTOR).toBe(12)
    expect(ACT1_CADENCE.furnace).toBe(28)
    expect(ACT1_CADENCE.research).toBe(34)
    expect(ACT1_CADENCE.process).toBe(42)
    expect(ACT1_CADENCE.protocols).toBe(52)
    expect(ACT1_CADENCE.echo).toBe(62)
    expect(ROUTE_B_UNLOCK_CLEARED).toBe(24)
  })

  it('requires mastery gates for Yard, Process and Echo', () => {
    const yard = atSector(ACT1_CADENCE.yard)
    yard.prestige.prestigeCount = YARD_MIN_REBUILDS - 1
    expect(isSystemUnlocked(yard, 'yard')).toBe(false)
    yard.prestige.prestigeCount = YARD_MIN_REBUILDS
    expect(isSystemUnlocked(yard, 'yard')).toBe(true)

    const process = atSector(ACT1_CADENCE.process)
    process.prestige.prestigeCount = PROCESS_MIN_REBUILDS
    expect(isSystemUnlocked(process, 'process')).toBe(false)
    process.research.unlocked.push('alloy-smelting')
    expect(isSystemUnlocked(process, 'process')).toBe(true)

    const echo = atSector(ACT1_CADENCE.echo)
    expect(isSystemUnlocked(echo, 'echo')).toBe(false)
    echo.protocols.ranks['mute-network'] = ECHO_MIN_PROTOCOL_RANKS
    expect(isSystemUnlocked(echo, 'echo')).toBe(true)
  })

  it('shifts the first Core prints with the later Foundry', () => {
    expect(modulePrintSector('flak-array')).toBeGreaterThanOrEqual(ACT1_CADENCE.foundry)
    expect(modulePrintSector('heavy-lance')).toBeGreaterThanOrEqual(ACT1_CADENCE.foundry)
  })
})

describe('PR76 Rebuild growth', () => {
  it('compounds the key Matter ranks instead of diminishing them', () => {
    expect(matterShopRankMultiplier(0.15, 1)).toBeCloseTo(1.15)
    expect(matterShopRankMultiplier(0.15, 5)).toBeGreaterThan(2)
    expect(matterShopRankMultiplier(0.15, 10)).toBeGreaterThan(4)
  })

  it('makes invested Rebuild Matter materially stronger than an uninvested account', () => {
    const base = atSector(20)
    base.prestige.prestigeCount = 2
    const invested = structuredClone(base)
    invested.prestige.matterShop['matter-blade'] = 3
    expect(globalDamageMultiplier(invested)).toBeGreaterThan(globalDamageMultiplier(base) * 1.45)
  })
})
