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
import { advanceSeconds, setDocked, startCombat } from './tick'
import { enemySectorScale } from './combat'
import { waveForBand } from './waves'

describe('phase 9: Specialists, hulls, rebalance, dev tools', () => {
  it('bumps save and keeps Specialists locked until 68', () => {
    expect(SAVE_VERSION).toBe(47)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(false)
    fresh.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR - 1
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(false)
    fresh.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR
    expect(isSystemUnlocked(fresh, 'specialists')).toBe(false)
    expect(GUIDE_STEPS.some((s) => s.id === 'guide-specialists')).toBe(false)
  })

  it('does not auto-unlock Swarm, Reactor, or Harvester from waves', () => {
    expect(getFrame('swarm-frame')?.unlockSource).toBe('foundry')
    expect(getFrame('reactor-frame')?.unlockSource).toBe('research')
    expect(getFrame('harvester-frame')?.unlockSource).toBe('challenge')

    const s = createInitialState(0)
    s.meta.bestWave = 300
    s.combat.bestWave = 300
    maybeGrantSystemUnlocks(s)
    expect(s.shipyard.unlockedFrames).toContain('bastion-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('swarm-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('reactor-frame')
    expect(s.shipyard.unlockedFrames).not.toContain('harvester-frame')
  })

  it('does not expand a leftover Yard grid', () => {
    const s = createInitialState(0)
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
    s.meta.highestSectorEver = 27
    expect(isSystemUnlocked(s, 'yard')).toBe(false)
  })

  it('ranks Specialists for damage / shield and persists across Rebuild', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = SPECIALIST_UNLOCK_SECTOR
    s.resources.salvage = 5000
    s.resources.heat = 800
    const dmg0 = computeShipStats(s).damage
    const shield0 = computeShipStats(s).shieldMax

    s = rankSpecialist(s, 'gunner')
    expect(specialistRank(s, 'gunner')).toBe(0)
    expect(specialistDamageMult(s)).toBe(1)
    expect(computeShipStats(s).damage).toBe(dmg0)

    s = rankSpecialist(s, 'warden')
    expect(specialistShieldMult(s)).toBe(1)
    expect(computeShipStats(s).shieldMax).toBe(shield0)

    for (let i = 0; i < 9; i += 1) s = rankSpecialist(s, 'gunner')
    expect(specialistRank(s, 'gunner')).toBe(0)
    expect(specialistMastery(s)).toBe(0)
    expect(specialistDamageMult(s)).toBe(1)

    s = performRebuild(s, {
      frameId: 'starter-frame',
      modules: ['pulse-cannon', 'plate-layer'],
    })
    expect(specialistRank(s, 'gunner')).toBe(0)
    expect(specialistRank(s, 'warden')).toBe(0)
    expect(specialistMastery(s)).toBe(0)
  })

  it('L0 Plate still holds sector 1', () => {
    let s = createInitialState(0)
    expect(computeShipStats(s).shieldMax).toBe(30)
    s = setDocked(s, false)
    advanceSeconds(s, 12)
    expect(s.combat.docked).toBe(false)
    expect(s.combat.playerHull).toBeGreaterThan(0)
  })

  it('weapon-only Pulse dump dies at S8 with L0 Plate', () => {
    let s = createInitialState(0)
    s.combat.wave = waveForBand(8)
    expect(computeShipStats(s).shieldMax).toBe(30)
    s = startCombat(s)
    advanceSeconds(s, 45)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie?.outcome).toBe('defeat')
  })

  it('weapon-only Pulse dump dies at S15 with L0 Plate', () => {
    let s = createInitialState(0)
    s.combat.wave = waveForBand(15)
    expect(computeShipStats(s).shieldMax).toBe(30)
    expect(enemySectorScale(15)).toBeGreaterThan(enemySectorScale(1) * 10)
    s = startCombat(s)
    advanceSeconds(s, 50)
    expect(s.combat.docked).toBe(true)
    expect(s.combat.lastSortie?.outcome).toBe('defeat')
  })

  it('dev skip-guides covers Hiveworks doors and boss wave uses sector length', () => {
    let s = createInitialState(0)
    s = applyDevAction(s, { type: 'skip-guides' })
    expect(s.meta.seenOnboarding).toEqual(
      expect.arrayContaining([
        'opening.salvage',
        'workers.assignment',
        'foundry.processing',
        'furnace.channel',
        'research.project',
      ]),
    )

    s.combat.wave = 27
    s = applyDevAction(s, { type: 'force-boss-wave' })
    expect(s.combat.wave).toBe(30)

    s = applyDevAction(s, { type: 'unlock-catalog' })
    expect(s.meta.bestWave).toBeLessThan(300)
    expect(s.shipyard.unlockedFrames).toContain('swarm-frame')
    expect(isSystemUnlocked(s, 'foundry')).toBe(false)
    expect(isSystemUnlocked(s, 'specialists')).toBe(false)

    s = applyDevAction(s, {
      type: 'add-resources',
      amounts: { choirAsh: 12, heat: 8, salvage: 40 },
    })
    expect(s.resources.choirAsh).toBeGreaterThanOrEqual(12)
    expect(s.resources.heat).toBeGreaterThanOrEqual(8)
  })
})
