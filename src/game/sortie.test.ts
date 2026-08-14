import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { setDocked, startCombat, tickGame } from './tick'
import { wavesForSector, trashWavesForSector, isSectorBossWave } from './sectors'
import { enemyForSector } from './combat'
import { clearCurrentWave, clearSector } from './testHelpers'
import { SAVE_VERSION } from './state'

describe('sector gauntlets', () => {
  it('uses short wave counts: S1 2+boss, S2–8 3+boss, S9+ 4+boss', () => {
    expect(trashWavesForSector(1)).toBe(2)
    expect(wavesForSector(1)).toBe(3)
    expect(wavesForSector(5)).toBe(4)
    expect(wavesForSector(9)).toBe(5)
    expect(isSectorBossWave(1, 3)).toBe(true)
    expect(isSectorBossWave(1, 2)).toBe(false)
  })

  it('puts a boss on the last wave of every sector', () => {
    expect(enemyForSector(1, 3).isBoss).toBe(true)
    expect(enemyForSector(2, 4).isBoss).toBe(true)
    expect(enemyForSector(2, 1).isBoss).toBe(false)
  })
})

describe('hub vs sortie', () => {
  it('starts docked at the hangar', () => {
    const s = createInitialState(0)
    expect(s.version).toBe(SAVE_VERSION)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.inFight).toBe(false)
    expect(s.combat.pushMode).toBe('advance')
    expect(s.shipyard.modules).toContain('pulse-cannon')
    expect(s.shipyard.modules).toContain('plate-layer')
  })

  it('launch starts combat and keeps the wave while live', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    expect(s.combat.docked).toBe(false)
    s = startCombat(s)
    expect(s.combat.inFight).toBe(true)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.pushMode).toBe('advance')
  })

  it('keeps ticking combat while undocked (hub can stay open)', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s = startCombat(s)
    expect(s.combat.inFight).toBe(true)
    s = tickGame(s, s.lastTickAt + 8000)
    expect(s.combat.docked).toBe(false)
    // Packs can die mid-tick (fightElapsed resets on the next wave).
    expect(s.combat.inFight || s.combat.wave > 1).toBe(true)
  })

  it('clears sector 1 in 3 waves and advances', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s = clearSector(s)
    expect(s.combat.sector).toBe(2)
    expect(s.combat.highestSector).toBeGreaterThanOrEqual(1)
    expect(s.resources.salvage).toBeGreaterThan(0)
  })

  it('defeat returns to dock and knocks back to wave 1 of the same sector', () => {
    let s = createInitialState(0)
    s = setDocked(s, false)
    s = startCombat(s)
    for (const u of s.combat.playerUnits) u.hull = 0
    s.combat.playerHull = 0
    s = tickGame(s, s.lastTickAt + 2000)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.sector).toBe(1)
    expect(s.combat.wave).toBe(1)
    expect(s.combat.lastSortie.outcome).toBe('defeat')
  })

  it('salvage core levels persist across a live sortie', () => {
    let s = createInitialState(0)
    s.shipyard.moduleLevels['pulse-cannon'] = 3
    s.resources.salvage = 40
    s = setDocked(s, false)
    s = clearCurrentWave(s)
    s = setDocked(s, true)
    expect(s.shipyard.moduleLevels['pulse-cannon']).toBe(3)
    expect(s.resources.salvage).toBeGreaterThan(0)
  })
})
