import { describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState, SAVE_VERSION } from './state'
import {
  convertAshToHeat,
  performRebuild,
  setFurnaceChannel,
  setResearchFocus,
} from './actions'
import { grantEnemyKillRewards } from './combat'
import { addRelicInstance, equipRelicOnCore, relicFamilyOwnedCount } from './relics'
import { furnaceAshFromKill, furnaceDamageMult, grantFurnaceKillLoot } from './furnace'
import {
  HIVE_RESEARCH_FOCUS_MULT,
  grantHiveResearchKillXp,
  hiveResearchCompleted,
  hiveResearchDamageMult,
  hiveResearchNodeCost,
  hiveResearchShieldMult,
  hiveResearchXp,
} from './hiveResearch'
import { foundryCraftSpeed } from './foundry'
import { isResourceVisible, isSystemUnlocked } from './progression'
import { ACT1_CADENCE } from './cadence'
import { atCareerWave, markHullLost } from './testHelpers'
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
  it('opens Relic / Furnace / Research doors on the Act 1 cadence', () => {
    expect(SAVE_VERSION).toBe(51)
    const fresh = createInitialState(0)
    expect(isSystemUnlocked(fresh, 'reliquary')).toBe(false)
    expect(isSystemUnlocked(fresh, 'furnace')).toBe(false)
    expect(isSystemUnlocked(fresh, 'research')).toBe(false)
    expect(isResourceVisible(fresh, 'choirAsh')).toBe(false)
    expect(isResourceVisible(fresh, 'data')).toBe(false)

    const relics = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    expect(isSystemUnlocked(relics, 'reliquary')).toBe(true)
    expect(isSystemUnlocked(relics, 'furnace')).toBe(true)

    const s5 = atCareerWave(createInitialState(0), ACT1_CADENCE.furnace)
    expect(isSystemUnlocked(s5, 'furnace')).toBe(true)
    expect(isResourceVisible(s5, 'choirAsh')).toBe(true)
    expect(isSystemUnlocked(s5, 'research')).toBe(false)

    const s6 = createInitialState(0)
    s6.meta.highestSectorEver = 6
    expect(isSystemUnlocked(s6, 'research')).toBe(false)

    const s7 = atCareerWave(createInitialState(0), ACT1_CADENCE.research)
    expect(isSystemUnlocked(s7, 'research')).toBe(true)
    expect(isResourceVisible(s7, 'data')).toBe(true)
  })

  it('fits a physical Relic without a leftover global damage bonus', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.combat.docked = true
    const relic = addRelicInstance(s, 'power-coupler')!
    const before = computeShipStats(s).damage
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id)
    expect(s.relics.coreFits['pulse-cannon:1']?.[0] ?? null).toBeNull()
    expect(computeShipStats(s).damage).toBe(before)
  })

  it('does not drop Relics from generic kills', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    grantEnemyKillRewards(s, enemy(false))
    expect(s.relics.instances).toHaveLength(0)
  })

  it('banks Choir-ash into Heat and Weapons channels raise DPS', () => {
    let s = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.furnace)
    const ash = grantFurnaceKillLoot(s, true)
    expect(ash).toBeGreaterThan(0)
    expect(s.resources.choirAsh).toBeGreaterThan(0)
    expect(furnaceAshFromKill(s, false)).toBeGreaterThan(0)

    s.resources.choirAsh = 80
    s = convertAshToHeat(s)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.resources.heat).toBe(8)

    const before = computeShipStats(s).damage
    s = setFurnaceChannel(s, 'weapons', 1)
    expect(s.furnace.active.weapons).toBe(1)
    expect(furnaceDamageMult(s)).toBeCloseTo(1.4)
    expect(computeShipStats(s).damage).toBeGreaterThan(before)
  })

  it('feeds all three research branches and 4× the focused one', () => {
    let s = createInitialState(0)
    s.meta.highestSectorEver = 34
    s = setResearchFocus(s, 'energy')
    grantHiveResearchKillXp(s, false)
    const energy = hiveResearchXp(s, 'energy')
    const material = hiveResearchXp(s, 'material')
    expect(energy).toBeGreaterThan(0)
    expect(energy / material).toBeCloseTo(HIVE_RESEARCH_FOCUS_MULT)
  })

  it('completes a research node and applies its bonus', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 34
    s.hiveResearch.xp.energy = hiveResearchNodeCost(0)
    grantHiveResearchKillXp(s, false)
    expect(hiveResearchCompleted(s, 'energy')).toBeGreaterThanOrEqual(1)
    expect(hiveResearchShieldMult(s)).toBeGreaterThan(1)
    expect(hiveResearchDamageMult(s)).toBe(1)
  })

  it('Foundry channel speeds the Foundry', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 28
    const before = foundryCraftSpeed(s)
    s.furnace.wanted.foundry = 2
    s.furnace.active.foundry = 2
    expect(foundryCraftSpeed(s)).toBeGreaterThan(before)
  })

  it('Rebuild keeps Relics, dumps Heat, and preserves Research', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.combat.docked = true
    addRelicInstance(s, 'power-coupler')
    s = equipRelicOnCore(s, 'pulse-cannon:1', 'power-coupler:1')
    s.resources.choirAsh = 12
    s.resources.heat = 8
    s.furnace.upgrades.hearth = 2
    s.furnace.wanted.weapons = 2
    s.hiveResearch.completed.material = 2
    s.hiveResearch.xp.material = 20
    s.resources.salvage = 50

    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(relicFamilyOwnedCount(s, 'power-coupler')).toBe(1)
    expect(s.relics.coreFits['pulse-cannon:1']?.[0] ?? null).toBeNull()
    expect(s.resources.heat).toBe(0)
    expect(s.furnace.upgrades.hearth).toBe(2)
    expect(s.hiveResearch.completed.material).toBe(2)
    expect(s.hiveResearch.xp.material).toBe(20)
    expect(s.resources.salvage).toBeLessThan(50)
  })

  it('kills grant ash and research together after Research opens', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 34
    grantEnemyKillRewards(s, enemy(true))
    expect(s.resources.choirAsh).toBeGreaterThan(0)
    expect(hiveResearchXp(s, 'material')).toBeGreaterThan(0)
  })
})
