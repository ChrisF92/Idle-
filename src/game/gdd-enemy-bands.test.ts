import { describe, expect, it } from 'vitest'
import { encounterForWave, primaryFamilyForWave } from './combat'
import {
  GDD_ENEMY_BANDS,
  gddEnemyBandForWave,
  isBossWave,
  isCommanderCandidateWave,
} from './waves'

describe('GDD enemy wave bands', () => {
  it('maps Act 1 Waves onto the introduction table without a W300 climax band', () => {
    expect(gddEnemyBandForWave(1)).toBe('basic')
    expect(gddEnemyBandForWave(9)).toBe('basic')
    expect(gddEnemyBandForWave(10)).toBe('swarm')
    expect(gddEnemyBandForWave(19)).toBe('swarm')
    expect(gddEnemyBandForWave(20)).toBe('skirmisher')
    expect(gddEnemyBandForWave(39)).toBe('skirmisher')
    expect(gddEnemyBandForWave(40)).toBe('armored')
    expect(gddEnemyBandForWave(69)).toBe('armored')
    expect(gddEnemyBandForWave(70)).toBe('shielded')
    expect(gddEnemyBandForWave(99)).toBe('shielded')
    expect(gddEnemyBandForWave(100)).toBe('sniper')
    expect(gddEnemyBandForWave(139)).toBe('sniper')
    expect(gddEnemyBandForWave(140)).toBe('support')
    expect(gddEnemyBandForWave(179)).toBe('support')
    expect(gddEnemyBandForWave(180)).toBe('mixed')
    expect(gddEnemyBandForWave(219)).toBe('mixed')
    expect(gddEnemyBandForWave(220)).toBe('elite')
    expect(gddEnemyBandForWave(259)).toBe('elite')
    expect(gddEnemyBandForWave(260)).toBe('complex')
    expect(gddEnemyBandForWave(300)).toBe('complex')
    expect(gddEnemyBandForWave(999)).toBe('complex')
    expect(GDD_ENEMY_BANDS.map((b) => b.id)).toEqual([
      'basic',
      'swarm',
      'skirmisher',
      'armored',
      'shielded',
      'sniper',
      'support',
      'mixed',
      'elite',
      'complex',
    ])
  })

  it('uses Swarm / Armored / Shielded / Elite catalog families for those bands', () => {
    expect(primaryFamilyForWave(1)).toBe('swarm')
    expect(primaryFamilyForWave(11)).toBe('swarm')
    expect(primaryFamilyForWave(21)).toBe('swarm')
    expect(primaryFamilyForWave(41)).toBe('armored')
    expect(primaryFamilyForWave(71)).toBe('ethereal')
    expect(primaryFamilyForWave(101)).toBe('ethereal')
    expect(primaryFamilyForWave(141)).toBe('ethereal')
    expect(primaryFamilyForWave(221)).toBe('divine')
    expect(primaryFamilyForWave(10, true)).toBe('titan')
    expect(primaryFamilyForWave(50, true)).toBe('titan')
  })

  it('lets live Sortie encounters follow global Wave, not a 10-wave sector carousel', () => {
    expect(encounterForWave(1).family).toBe('swarm')
    expect(encounterForWave(4).family).toBe('swarm')
    expect(encounterForWave(11).family).toBe('swarm')
    expect(encounterForWave(21).family).toBe('swarm')
    expect(encounterForWave(41).family).toBe('armored')
    expect(encounterForWave(71).family).toBe('ethereal')
    expect(encounterForWave(101).family).toBe('ethereal')
    expect(encounterForWave(221).family).toBe('divine')
    expect(encounterForWave(1).units.every((u) => u.role === 'fighter')).toBe(true)
    expect(encounterForWave(21).units.every((u) => u.role === 'skirmisher')).toBe(true)
    expect(encounterForWave(41).units.some((u) => u.role === 'juggernaut')).toBe(true)
    expect(encounterForWave(71).units.some((u) => u.role === 'shield')).toBe(true)
    expect(encounterForWave(101).units.some((u) => u.role === 'sniper')).toBe(true)
    expect(encounterForWave(11).family).not.toBe('armored')
  })

  it('keeps Commander candidates in continuous flow and Bosses on 50-Wave boundaries', () => {
    for (const wave of [10, 20, 40]) {
      expect(isCommanderCandidateWave(wave)).toBe(true)
      expect(isBossWave(wave)).toBe(false)
      expect(encounterForWave(wave).isBoss).toBe(false)
      expect(encounterForWave(wave).tags).toContain('commander')
    }
    expect(isBossWave(50)).toBe(true)
    expect(isBossWave(100)).toBe(true)
    expect(isCommanderCandidateWave(50)).toBe(false)
    expect(encounterForWave(50).isBoss).toBe(false)
  })
})
