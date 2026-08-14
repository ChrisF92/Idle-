import { describe, expect, it } from 'vitest'
import { enemyForSector } from './combat'
import { buildFlagshipWeapons, createInitialState } from './state'
import { wavesForSector } from './sectors'

describe('USI enemy roles', () => {
  it('S1 opens with fighters then closer, faster skirmishers', () => {
    const fighters = enemyForSector(1, 1).units
    const skirmishers = enemyForSector(1, 2).units
    expect(fighters.every((u) => u.role === 'fighter')).toBe(true)
    expect(skirmishers.every((u) => u.role === 'skirmisher')).toBe(true)
    expect(Math.min(...skirmishers.map((u) => u.engageRange))).toBeLessThan(
      Math.min(...fighters.map((u) => u.engageRange)),
    )
    expect(Math.max(...skirmishers.map((u) => u.speed))).toBeGreaterThan(
      Math.max(...fighters.map((u) => u.speed)),
    )
    const later = enemyForSector(9, 2).units
    expect(Math.max(...later.map((u) => u.speed))).toBeGreaterThan(
      Math.max(...skirmishers.map((u) => u.speed)),
    )
  })

  it('S2 armored opens as a slow mid-range juggernaut', () => {
    const unit = enemyForSector(2, 1).units[0]!
    expect(unit.role).toBe('juggernaut')
    expect(unit.speed).toBeLessThan(20)
    expect(unit.engageRange).toBeGreaterThan(50)
    expect(unit.shape).toBe('square')
  })

  it('S3 starts with a shielded closer and later hangs a charging sniper', () => {
    const shield = enemyForSector(3, 1).units[0]!
    expect(shield.role).toBe('shield')
    expect(shield.shieldMax).toBeGreaterThan(0)
    expect(shield.kite).toBe(false)

    const snipers = enemyForSector(3, 2).units.filter((u) => u.role === 'sniper')
    expect(snipers.length).toBeGreaterThan(0)
    expect(snipers[0]!.kite).toBe(true)
    expect(snipers[0]!.engageRange).toBeGreaterThan(shield.engageRange)
    expect(snipers[0]!.speed).toBeLessThan(shield.speed)
    expect(snipers[0]!.weapons[0]!.telegraphDuration).toBeGreaterThan(0)
  })

  it('mixed swarm packs keep a back-line sniper behind fighters', () => {
    const pack = enemyForSector(9, 3).units
    const sniper = pack.find((u) => u.role === 'sniper')
    const fighter = pack.find((u) => u.role === 'fighter')
    expect(sniper).toBeTruthy()
    expect(fighter).toBeTruthy()
    expect(sniper!.kite).toBe(true)
    expect(sniper!.engageRange).toBeGreaterThan(fighter!.engageRange)
    expect(sniper!.speed).toBeLessThan(fighter!.speed)
  })

  it('Pulse still reaches S3 snipers', () => {
    const pulse = Math.max(...buildFlagshipWeapons(createInitialState(0)).map((w) => w.range))
    const snipers = enemyForSector(3, 2).units
    const maxEngage = Math.max(...snipers.map((u) => u.engageRange))
    expect(pulse).toBeGreaterThanOrEqual(maxEngage)
  })

  it('sector boss is a kiting titan with a telegraph', () => {
    const boss = enemyForSector(1, wavesForSector(1)).units.find((u) => u.isBoss)!
    expect(boss.role).toBe('boss')
    expect(boss.kite).toBe(true)
    expect(boss.weapons[0]!.telegraphDuration).toBeGreaterThan(0)
  })
})
