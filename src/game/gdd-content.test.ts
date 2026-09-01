import { describe, expect, it } from 'vitest'
import { buyGenericUnlock, buyWorkshopUpgrade } from './actions'
import { ACT1_CADENCE } from './cadence'
import { metaDamageMultiplier } from './catalog'
import { FOUNDRY_LOGS, unlockedFoundryLogs } from './logs'
import { CHALLENGES } from './challenges'
import { getHiveResearchNode } from './hiveResearch'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { availableSortieSpeeds } from './uiReadout'
import { RUN_UPGRADES, scrapKillBonus, shopArmor, visibleRunUpgrades } from './workshop'

describe('GDD Phase 8 content depth', () => {
  it('keeps the canonical 18 generic upgrades without Best-Wave shop gates', () => {
    const ids = RUN_UPGRADES.map((row) => row.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'weapon-power',
        'cycle-rate',
        'hull',
        'shield',
        'salvage-kill',
        'salvage-wave',
        'crit-chance',
        'armor-pen',
        'shield-regen',
        'armor',
        'scrap-kill',
        'fragment-find',
        'ash-recovery',
      ]),
    )
    expect(ids).not.toContain('fragment-chance')
    expect(ids).not.toContain('ash-yield')

    const fresh = createInitialState(0)
    fresh.combat.docked = false
    expect(visibleRunUpgrades(fresh).map((row) => row.id)).toEqual(['weapon-power', 'hull', 'salvage-kill'])

    const known = markHullLost(createInitialState(0))
    known.combat.docked = true
    expect(visibleRunUpgrades(known).map((row) => row.id).sort()).toEqual(
      ['cycle-rate', 'hull', 'salvage-kill', 'salvage-wave', 'shield', 'weapon-power'].sort(),
    )
  })

  it('lets later Defense and Economy ranks change armor and Scrap/Kill after unlocks', () => {
    let s = markHullLost(createInitialState(0))
    s = atCareerWave(s, 110)
    s.combat.docked = true
    s.resources.scrap = 10000
    s = buyGenericUnlock(s, 'defense')
    s = buyGenericUnlock(s, 'defense')
    s = buyGenericUnlock(s, 'economy')
    s = buyWorkshopUpgrade(s, 'armor', 3)
    s = buyWorkshopUpgrade(s, 'scrap-kill', 2)
    expect(shopArmor(s)).toBeGreaterThan(0)
    expect(scrapKillBonus(s)).toBeGreaterThan(0)
  })

  it('unlocks combat speed only through Time Compression', () => {
    const fresh = createInitialState(0)
    expect(availableSortieSpeeds(fresh)).toEqual([1])

    const rebuild = structuredClone(fresh)
    rebuild.prestige.matterShop['time-compression-1'] = 1
    expect(availableSortieSpeeds(rebuild)).toEqual([1, 1.5])

    const research = structuredClone(fresh)
    research.hiveResearch.completedIds = ['d1-fire-control-doctrine']
    research.hiveResearch.completed.observation = 1
    expect(getHiveResearchNode('d1-fire-control-doctrine')).toBeTruthy()
    expect(availableSortieSpeeds(research)).toEqual([1])
    expect(availableSortieSpeeds(fresh)).toEqual([1])
  })

  it('routes every Challenge first clear to a deterministic unique reward', () => {
    expect(CHALLENGES).toHaveLength(10)
    expect(CHALLENGES.every((def) => def.uniqueRewards.length > 0)).toBe(true)
    expect(CHALLENGES.flatMap((def) => def.uniqueRewards).some((reward) => reward.kind === 'blueprint')).toBe(true)
    expect(CHALLENGES.find((def) => def.id === 'hollow-choir')?.uniqueRewards.map((reward) => reward.kind)).toEqual([
      'account-unlock',
      'cosmetic',
    ])
  })

  it('keeps leftover Challenge Marks from buying global damage', () => {
    const bare = metaDamageMultiplier(0, 0, {})
    const stacked = metaDamageMultiplier(0, 80, {})
    expect(stacked).toBe(bare)
  })

  it('keeps Foundry logs on the GDD doors and retires leftover systems', () => {
    const fresh = unlockedFoundryLogs(createInitialState(0)).map((row) => row.id)
    expect(fresh).toContain('dock')
    expect(fresh).not.toContain('echo')
    expect(fresh).not.toContain('capital')
    expect(fresh).not.toContain('crew')

    const late = atCareerWave(createInitialState(0), ACT1_CADENCE.reinforce)
    late.meta.act1Cleared = true
    const ids = unlockedFoundryLogs(late).map((row) => row.id)
    expect(ids).toContain('reinforce')
    expect(ids).toContain('act1')
    expect(ids).not.toContain('echo')
    expect(FOUNDRY_LOGS.some((row) => row.id === 'echo' || row.id === 'capital' || row.id === 'crew')).toBe(false)
    expect(FOUNDRY_LOGS.find((row) => row.id === 'reinforce')?.body).toMatch(/knowledge backward/)
    expect(FOUNDRY_LOGS.find((row) => row.id === 'core-prints')?.body).toMatch(/equip the Core at Dock/)
  })

  it('names Wave 1000 as the Act 1 ceiling', () => {
    const log = FOUNDRY_LOGS.find((row) => row.id === 'act1')
    expect(log?.title).toMatch(/1000/)
    expect(log?.body).toMatch(/Choir Crown/)
  })
})
