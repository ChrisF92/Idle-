import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  buyFurnaceRank,
  convertAshToHeat,
  insertShard,
  performRebuild,
  setResearchFocus,
} from './actions'
import { grantEnemyKillRewards } from './combat'
import {
  grantReliquaryKillLoot,
  insertShard as insertShardDirect,
  reliquaryDamageMult,
  shardOwned,
  shardResonance,
} from './reliquary'
import { furnaceAshFromKill, furnaceDamageMult, grantFurnaceKillLoot } from './furnace'
import {
  HIVE_RESEARCH_FOCUS_MULT,
  grantHiveResearchKillXp,
  hiveResearchCompleted,
  hiveResearchDamageMult,
  hiveResearchNodeCost,
  hiveResearchXp,
} from './hiveResearch'
import { foundryCraftSpeed } from './foundry'
import { isResourceVisible, isSystemUnlocked } from './progression'
import type { CombatUnit } from './types'

function enemy(isBoss = false): CombatUnit {
  return {
    id: 'e1',
    name: 'Hull',
    side: 'enemy',
    family: 'swarm',
    isBoss,
    hull: 1,
    hullMax: 1,
    shield: 0,
    shieldMax: 0,
    armor: 0,
    evasion: 0,
    dots: [],
    phaseWarnLeft: 0,
    x: 0,
    y: 0,
    speed: 0,
    engageRange: 0,
    kite: false,
    tags: [],
    weapons: [],
    shape: 'circle',
    isFlagship: false,
    damageTakenMult: 1,
  } as CombatUnit
}

describe('phase 6: Reliquary + Furnace + Research', () => {
  it('opens doors at USI sectors 3 / 5 / 7', () => {
    expect(SAVE_VERSION).toBe(28)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'reliquary')).toBe(false)
    expect(isSystemUnlocked(fresh, 'furnace')).toBe(false)
    expect(isSystemUnlocked(fresh, 'research')).toBe(false)
    expect(isResourceVisible(fresh, 'choirAsh')).toBe(false)
    expect(isResourceVisible(fresh, 'data')).toBe(false)

    const s3 = createInitialState(0)
    s3.meta.highestSectorEver = 3
    expect(isSystemUnlocked(s3, 'reliquary')).toBe(true)
    expect(isSystemUnlocked(s3, 'furnace')).toBe(false)

    const s5 = createInitialState(0)
    s5.meta.highestSectorEver = 5
    expect(isSystemUnlocked(s5, 'furnace')).toBe(true)
    expect(isResourceVisible(s5, 'choirAsh')).toBe(true)
    expect(isSystemUnlocked(s5, 'research')).toBe(false)

    const s6 = createInitialState(0)
    s6.meta.highestSectorEver = 6
    expect(isSystemUnlocked(s6, 'research')).toBe(false)

    const s7 = createInitialState(0)
    s7.meta.highestSectorEver = 7
    expect(isSystemUnlocked(s7, 'research')).toBe(true)
    expect(isResourceVisible(s7, 'data')).toBe(true)
  })

  it('inserts a shard and scales damage with resonance', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 3
    s.reliquary.owned['battle-chip'] = 1
    const before = computeShipStats(s).damage
    s = insertShard(s, 'battle-chip')
    expect(s.reliquary.slots.red).toBe('battle-chip')
    expect(reliquaryDamageMult(s)).toBeCloseTo(1.08)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)

    s.reliquary.owned['battle-chip'] = 13
    expect(shardResonance(s, 'battle-chip')).toBe(1)
    expect(reliquaryDamageMult(s)).toBeCloseTo(1.16)
  })

  it('drops shards on kill once Reliquary is open', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 3
    const id = grantReliquaryKillLoot(s, false, () => 0)
    expect(id).toBeTruthy()
    expect(shardOwned(s, id!)).toBe(1)
    expect(grantReliquaryKillLoot(s, false, () => 0.99)).toBeNull()
  })

  it('banks Choir-ash into Heat and Attack ranks raise DPS', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 5
    s.combat.sector = 5
    const ash = grantFurnaceKillLoot(s, true)
    expect(ash).toBeGreaterThan(0)
    expect(s.resources.choirAsh).toBeGreaterThan(0)
    expect(furnaceAshFromKill(s, false)).toBeGreaterThan(0)

    s.resources.choirAsh = 40
    s = convertAshToHeat(s)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(4)

    const before = computeShipStats(s).damage
    s.resources.heat = 20
    s = buyFurnaceRank(s, 'attack')
    expect(s.furnace.ranks.attack).toBe(1)
    expect(furnaceDamageMult(s)).toBeCloseTo(1.02)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('feeds all three research branches and 4× the focused one', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 7
    s.combat.sector = 7
    s = setResearchFocus(s, 'energy')
    grantHiveResearchKillXp(s, false)
    const energy = hiveResearchXp(s, 'energy')
    const material = hiveResearchXp(s, 'material')
    expect(energy).toBeGreaterThan(0)
    expect(energy / material).toBeCloseTo(HIVE_RESEARCH_FOCUS_MULT)
  })

  it('completes a research node and applies its bonus', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 7
    s.hiveResearch.xp.energy = hiveResearchNodeCost(0)
    grantHiveResearchKillXp(s, false)
    expect(hiveResearchCompleted(s, 'energy')).toBeGreaterThanOrEqual(1)
    expect(hiveResearchDamageMult(s)).toBeGreaterThan(1)
  })

  it('Workshop ranks speed the Foundry', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 5
    const before = foundryCraftSpeed(s)
    s.furnace.ranks.workshop = 2
    expect(foundryCraftSpeed(s)).toBeGreaterThan(before)
  })

  it('Rebuild keeps shards, Heat, ranks, and research; wipes salvage', () => {
    let s = createInitialState(0)
    s.combat.sector = 7
    s.meta.highestSectorEver = 7
    s.reliquary.owned['battle-chip'] = 3
    s = insertShardDirect(s, 'battle-chip')
    s.resources.choirAsh = 12
    s.resources.heat = 8
    s.furnace.ranks.attack = 2
    s.hiveResearch.completed.material = 2
    s.hiveResearch.xp.material = 20
    s.resources.salvage = 50

    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.reliquary.owned['battle-chip']).toBe(3)
    expect(s.reliquary.slots.red).toBe('battle-chip')
    expect(s.resources.heat).toBe(8)
    expect(s.resources.choirAsh).toBe(12)
    expect(s.furnace.ranks.attack).toBe(2)
    expect(s.hiveResearch.completed.material).toBe(2)
    expect(s.hiveResearch.xp.material).toBe(20)
    expect(s.resources.salvage).toBeLessThan(50)
  })

  it('kills grant ash and research together after sector 7', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 7
    s.combat.sector = 7
    grantEnemyKillRewards(s, enemy(true))
    expect(s.resources.choirAsh).toBeGreaterThan(0)
    expect(hiveResearchXp(s, 'material')).toBeGreaterThan(0)
  })
})
