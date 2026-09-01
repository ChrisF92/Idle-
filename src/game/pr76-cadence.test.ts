import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { ACT1_CADENCE, ECHO_MIN_PROTOCOL_RANKS } from './cadence'
import { isSystemUnlocked, PRESTIGE_MIN_SECTOR } from './progression'
import { matterShopRankMultiplier, modulePrintWave } from './catalog'
import { atCareerWave } from './testHelpers'

describe('GDD system cadence', () => {
  it('spreads major systems across the Wave table', () => {
    expect(ACT1_CADENCE.foundry).toBe(50)
    expect(PRESTIGE_MIN_SECTOR).toBe(210)
    expect(ACT1_CADENCE.furnace).toBe(450)
    expect(ACT1_CADENCE.research).toBe(525)
    expect(ACT1_CADENCE.process).toBe(525)
    expect(ACT1_CADENCE.protocols).toBe(250)
    expect(ACT1_CADENCE.echo).toBe(275)
  })

  it('requires a mastery gate for Process; Echo never opens', () => {
    const beforeAdvanced = atCareerWave(createInitialState(1), ACT1_CADENCE.foundryAdvanced - 1)
    expect(isSystemUnlocked(beforeAdvanced, 'foundry')).toBe(true)
    const open = atCareerWave(createInitialState(1), ACT1_CADENCE.foundryAdvanced)
    expect(isSystemUnlocked(open, 'foundry')).toBe(true)

    const process = atCareerWave(createInitialState(1), ACT1_CADENCE.process)
    expect(isSystemUnlocked(process, 'process')).toBe(false)
    process.hiveResearch.completedIds = ['c1-queue-buffer', 'c2-combat-telemetry', 'c3-deep-queue', 'c4-process-kernel']
    expect(isSystemUnlocked(process, 'process')).toBe(true)

    const echo = atCareerWave(createInitialState(1), ACT1_CADENCE.echo)
    expect(isSystemUnlocked(echo, 'echo')).toBe(false)
    echo.protocols.ranks['mute-network'] = ECHO_MIN_PROTOCOL_RANKS
    echo.echo.tree = ['echo-strike']
    echo.echo.clears = { rift: 1 }
    expect(isSystemUnlocked(echo, 'echo')).toBe(false)
  })

  it('keeps Core prints on Wave doors at or after Foundry', () => {
    expect(modulePrintWave('flak-array')).toBeGreaterThanOrEqual(ACT1_CADENCE.foundry)
    expect(modulePrintWave('heavy-lance')).toBeGreaterThanOrEqual(ACT1_CADENCE.foundry)
  })
})

describe('Rebuild growth', () => {
  it('compounds the key Matter ranks instead of diminishing them', () => {
    expect(matterShopRankMultiplier(0.15, 1)).toBeCloseTo(1.15)
    expect(matterShopRankMultiplier(0.15, 5)).toBeGreaterThan(2)
    expect(matterShopRankMultiplier(0.15, 10)).toBeGreaterThan(4)
  })

  it('makes purchased Weapon Calibration stronger than unspent Matter', () => {
    const base = atCareerWave(createInitialState(1), 20)
    base.prestige.prestigeCount = 2
    base.resources.prestigeMatter = 500
    const invested = structuredClone(base)
    invested.prestige.matterShop['weapon-calibration'] = 3
    invested.resources.prestigeMatter = 0
    expect(computeShipStats(invested).damage).toBeGreaterThan(computeShipStats(base).damage)
  })
})
