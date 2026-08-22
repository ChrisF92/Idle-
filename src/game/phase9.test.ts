import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import { performRebuild, rankSpecialist } from './actions'
import { applyDevAction } from './dev'
import { getFrame } from './catalog'
import {
  GUIDE_STEPS,
  isSystemUnlocked,
  maybeGrantSystemUnlocks,
} from './progression'
import {
  SPECIALIST_UNLOCK_SECTOR,
  specialistDamageMult,
  specialistMastery,
  specialistRank,
  specialistShieldMult,
} from './specialists'
import { yardGridSize, YARD_EXPAND_SECTOR_2 } from './yard'
import { advanceSeconds, setDocked, startCombat } from './tick'
import { enemySectorScale } from './combat'
import { waveForBand } from './waves'

describe('phase 9: Specialists, hulls, rebalance, dev tools', () => {
  it('bumps save and keeps Specialists locked until 68', () => {
    expect(SAVE_VERSION).toBe(34)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(false)
    fresh.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR - 1
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(false)
    fresh.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(true)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-specialists')).toBe(false)
  })

  it('unlocks Heavy Cruiser at 24 and Battlecruiser at 41', () => {
    expect(getFrame('heavy-cruiser-frame')?.requiresSectorEver).toBe(24)
    expect(getFrame('heavy-cruiser-frame')?.weaponSlots).toBe(3)
    expect(getFrame('heavy-cruiser-frame')?.defenseSlots).toBe(2)
    expect(getFrame('battlecruiser-frame')?.requiresSectorEver).toBe(41)
    expect(getFrame('battlecruiser-frame')?.defenseSlots).toBe(3)

    const s = createInitialState(0)
    s.meta.highestSectorEver = 24
    s.combat.highestSector = 24
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('heavy-cruiser-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('battlecruiser-frame')

    s.meta.highestSectorEver = 41
    s.combat.highestSector = 41
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('battlecruiser-frame')
  })

  it('expands Yard to 5×5 at sector 27', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = YARD_EXPAND_SECTOR_2 - 1
    expect(yardGridSize(s)).toBe(4)
    s.meta.highestSectorEver = YARD_EXPAND_SECTOR_2
    expect(yardGridSize(s)).toBe(5)
  })

  it('ranks Specialists for damage / shield and persists across Rebuild', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR
    s.resources.salvage = 5000
    s.resources.heat = 800
    const dmg0 = computeShipStats(s).damage
    const shield0 = computeShipStats(s).shieldMax

    s = rankSpecialist(s, 'gunner')
    expect(specialistRank(s, 'gunner')).toBe(1)
    expect(specialistDamageMult(s)).toBeCloseTo(1.025)
    expect(computeShipStats(s).damage).toBeGreaterThan(dmg0)

    s = rankSpecialist(s, 'warden')
    expect(specialistShieldMult(s)).toBeCloseTo(1.03)
    expect(computeShipStats(s).shieldMax).toBeGreaterThan(shield0)

    for (let i = 0; i < 9; i += 1) s = rankSpecialist(s, 'gunner')
    expect(specialistRank(s, 'gunner')).toBe(10)
    expect(specialistMastery(s)).toBe(1)
    expect(specialistDamageMult(s)).toBeCloseTo(1.25 * 1.01)

    s = performRebuild(s, {
      frameId: 'scout-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(specialistRank(s, 'gunner')).toBe(10)
    expect(specialistRank(s, 'warden')).toBe(1)
    expect(specialistMastery(s)).toBe(1)
  })

  it('L0 Plate still holds sector 1', () => {
    let s = createInitialState(0)
    expect(s.shipyard.moduleLevels['plate-layer'] ?? 0).toBe(0)
    expect(computeShipStats(s).shieldMax).toBe(30)
    s = setDocked(s, false)
    advanceSeconds(s, 12)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.playerHull).toBeGreaterThan(0)
  })

  it('weapon-only Pulse dump dies at S8 with L0 Plate', () => {
    let s = createInitialState(0)
    s.combat.wave = waveForBand(8)
    s.shipyard.moduleLevels = { 'pulse-cannon': 20, 'plate-layer': 0 }
    expect(computeShipStats(s).shieldMax).toBe(30)
    s = startCombat(s)
    advanceSeconds(s, 45)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.lastSortie?.outcome).toBe('defeat')
  })

  it('weapon-only Pulse dump dies at S15 with L0 Plate', () => {
    let s = createInitialState(0)
    s.combat.wave = waveForBand(15)
    s.shipyard.moduleLevels = { 'pulse-cannon': 25, 'plate-layer': 0 }
    expect(computeShipStats(s).shieldMax).toBe(30)
    expect(enemySectorScale(15)).toBeGreaterThan(enemySectorScale(1) * 10)
    s = startCombat(s)
    advanceSeconds(s, 50)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.frontierHold).toBe(false)
    expect(s.combat.lastSortie?.outcome).toBe('defeat')
  })

  it('dev skip-guides covers Hiveworks doors and boss wave uses sector length', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'skip-guides' })
    expect(s.meta.seenOnboarding).toEqual(
      expect.arrayContaining([
        'guide-launch',
        'guide-network-strike',
        'guide-foundry-recipe',
        'guide-furnace-light',
        'guide-research-focus',
      ]),
    )

    s.combat.wave = 27
    s = applyDevAction(s, { type: 'force-boss-wave' })
    expect(s.combat.wave).toBe(30)

    s = applyDevAction(s, { type: 'unlock-catalog' })
    expect(s.meta.bestWave).toBeGreaterThanOrEqual(300)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'specialists')).toBe(false)

    s = applyDevAction(s, {
      type: 'add-resources',
      amounts: { choirAsh: 12, heat: 8, salvage: 40 },
    })
    expect(s.resources.choirAsh).toBeGreaterThanOrEqual(12)
    expect(s.resources.heat).toBeGreaterThanOrEqual(8)
  })
})
