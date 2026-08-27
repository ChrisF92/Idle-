import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyProcessNode } from './actions'
import { ACT1_CADENCE } from './cadence'
import { atCareerWave } from './testHelpers'
import { PROCESS_NODES, canBuyProcessNode, hasProcess, processOfflineBonusMs } from './process'
import { tickAutomation } from './automation'
import { applyOfflineCatchUp, MAX_OFFLINE_MS } from './offline'
import { furnaceSalvageMult } from './furnace'
import { isFoundryRecipeUnlocked } from './foundry'
import { HIVE_RESEARCH_NODES_PER_BRANCH } from './hiveResearch'
import { advanceSeconds } from './tick'
import { grantEnemyKillRewards } from './combat'
import type { CombatUnit } from './types'

function enemy(): CombatUnit {
  return {
    id: 'e1',
    name: 'Hull',
    side: 'enemy',
    family: 'swarm',
    isBoss: false,
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

describe('Act 1 Process depth', () => {
  it('keeps Act 1 Process on helpers and skips late-game autos', () => {
    expect(PROCESS_NODES.length).toBeGreaterThanOrEqual(8)
    expect(PROCESS_NODES.some((n) => n.id === 'core-buy-max' || n.id === 'auto-salvage')).toBe(false)
    expect(PROCESS_NODES.some((n) => /warp|crew|capital|reinforce/i.test(n.id))).toBe(false)
    expect(HIVE_RESEARCH_NODES_PER_BRANCH).toBeGreaterThanOrEqual(6)
  })

  it('does not sell Auto-Salvage for First Blood Process', () => {
    const s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.resources.aiPoints = 1
    expect(canBuyProcessNode(s, 'auto-salvage').ok).toBe(false)
  })

  it('gates Smart Smelt on Foundry and Heat Spend on Ash Bank', () => {
    const early = createInitialState(0)
    early.meta.aiUnlocked = true
    early.resources.aiPoints = 80
    expect(canBuyProcessNode(early, 'smart-smelt').ok).toBe(false)
    early.meta.highestSectorEver = 42
    early.prestige.prestigeCount = 2
    early.research.unlocked.push('basic-optics')
    expect(canBuyProcessNode(early, 'smart-smelt').ok).toBe(true)

    const furnace = createInitialState(0)
    furnace.meta.aiUnlocked = true
    furnace.meta.highestSectorEver = 68
    furnace.prestige.prestigeCount = 2
    furnace.research.unlocked.push('basic-optics')
    furnace.resources.aiPoints = 80
    furnace.process.purchased = []
    expect(canBuyProcessNode(furnace, 'furnace-auto').ok).toBe(false)
    furnace.process.purchased = ['auto-bank']
    expect(canBuyProcessNode(furnace, 'furnace-auto').ok).toBe(true)
  })

  it('Smart Smelt no longer starts final Processing', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    s.process.purchased = ['smart-smelt', 'foundry-repeat']
    s.process.config.foundry.repeatRecipe = 'recovered-stock'
    s.resources.scrap = 80
    s.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
  })

  it('Shard Seat fits a red chip into an empty Core socket', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    s.combat.docked = true
    s.process.purchased = ['auto-relic']
    s.reliquary.owned['battle-chip'] = 1
    tickAutomation(s)
    expect(s.reliquary.coreFits['pulse-cannon:1']?.[0]).toBe('battle-chip')
    expect(s.reliquary.slots.red ?? null).toBeNull()
  })

  it('Print Press does not assemble leftover casing/core/lens into a Core', () => {
    const s = createInitialState(0)
    s.process.purchased = ['print-assemble']
    tickAutomation(s)
    expect((s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'charge-prism')).toHaveLength(0)
  })

  it('Deep Cache is Process QoL, not free', () => {
    let s = createInitialState(0)
    expect(processOfflineBonusMs(s)).toBe(0)
    s.process.purchased = ['deep-cache']
    expect(processOfflineBonusMs(s)).toBe(4 * 60 * 60 * 1000)
    s.lastTickAt = 0
    const { report } = applyOfflineCatchUp(s, MAX_OFFLINE_MS + 5 * 60 * 60 * 1000)
    expect(report?.appliedMs).toBe(MAX_OFFLINE_MS + 4 * 60 * 60 * 1000)
  })

  it('Hold ranks and Foundry Hold raise salvage', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 6
    const base = s.resources.salvage
    grantEnemyKillRewards(s, enemy())
    const plain = s.resources.salvage - base

    const buffed = createInitialState(0)
    buffed.meta.highestSectorEver = 6
    buffed.furnace.wanted.recovery = 1
    buffed.furnace.active.recovery = 1
    expect(furnaceSalvageMult(buffed)).toBeCloseTo(1.4)
    const before = buffed.resources.salvage
    grantEnemyKillRewards(buffed, enemy())
    expect(buffed.resources.salvage - before).toBeGreaterThan(plain)
  })

  it('Tempered Alloy unlocks from Recovered Stock, not a Best-Wave recipe gate', () => {
    const s = createInitialState(0)
    s.meta.bestWave = 50
    s.combat.bestWave = 50
    expect(isFoundryRecipeUnlocked(s, 'tempered-alloy')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'phase-crystal')).toBe(false)
  })

  it('buyProcessNode still spends points and Neural Link can fire from Process', () => {
    let s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 1
    s.resources.aiPoints = 6
    s = buyProcessNode(s, 'buy-ten')
    expect(hasProcess(s, 'buy-ten')).toBe(true)
    expect(s.meta.completedAchievements).toContain('neural-link')
  })

  it('legacy Auto-Salvage ownership cannot rank a live Core', () => {
    const s = createInitialState(0)
    s.combat.docked = false
    s.process.purchased = ['auto-salvage']
    s.resources.salvage = 40
    const before = s.workshop?.coreStarts['pulse-cannon:1'] ?? 0
    advanceSeconds(s, 1)
    expect(s.workshop?.coreStarts['pulse-cannon:1'] ?? 0).toBe(before)
    expect(s.resources.salvage).toBe(40)
  })
})
