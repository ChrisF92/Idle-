import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyProcessNode } from './actions'
import { ACT1_CADENCE } from './cadence'
import { atCareerWave } from './testHelpers'
import { PROCESS_NODES, canBuyProcessNode, hasProcess, processCombatSpeedMult, processOfflineBonusMs } from './process'
import { tickAutomation } from './automation'
import { applyOfflineCatchUp, MAX_OFFLINE_MS } from './offline'
import { furnaceSalvageMult } from './furnace'
import { foundrySalvageMult, isFoundryRecipeUnlocked } from './foundry'
import { HIVE_RESEARCH_NODES_PER_BRANCH } from './hiveResearch'
import { BLUEPRINTS, partId } from './catalog'
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
    expect(PROCESS_NODES.length).toBeGreaterThanOrEqual(14)
    expect(PROCESS_NODES.find((n) => n.id === 'core-buy-max')?.cost).toBe(4)
    expect(PROCESS_NODES.find((n) => n.id === 'auto-salvage')?.cost).toBe(8)
    expect(PROCESS_NODES.some((n) => /warp|crew|capital|reinforce/i.test(n.id))).toBe(false)
    expect(HIVE_RESEARCH_NODES_PER_BRANCH).toBe(9)
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
    early.combat.highestSector = 42
    early.prestige.prestigeCount = 2
    early.research.unlocked.push('basic-optics')
    expect(canBuyProcessNode(early, 'smart-smelt').ok).toBe(true)

    const furnace = createInitialState(0)
    furnace.meta.aiUnlocked = true
    furnace.meta.highestSectorEver = 68
    furnace.combat.highestSector = 68
    furnace.prestige.prestigeCount = 2
    furnace.research.unlocked.push('basic-optics')
    furnace.resources.aiPoints = 80
    furnace.process.purchased = []
    expect(canBuyProcessNode(furnace, 'furnace-auto').ok).toBe(false)
    furnace.process.purchased = ['auto-bank']
    expect(canBuyProcessNode(furnace, 'furnace-auto').ok).toBe(true)
  })

  it('Smart Smelt fills an empty smelter without starving Pulse', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 3
    s.combat.highestSector = 3
    s.process.purchased = ['smart-smelt']
    s.resources.salvage = 4
    s.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBe('filament')
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

  it('Print Press assembles a complete Core print', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 42
    s.combat.highestSector = 42
    s.prestige.prestigeCount = 2
    s.research.unlocked.push('basic-optics')
    s.process.purchased = ['smart-smelt', 'print-assemble']
    const recipe = BLUEPRINTS.find((b) => b.moduleId === 'charge-prism')!
    s.parts = {
      [partId('charge-prism', 'casing')]: recipe.casing,
      [partId('charge-prism', 'core')]: recipe.core,
      [partId('charge-prism', 'lens')]: recipe.lens,
    }
    tickAutomation(s)
    expect(s.shipyard.unlockedModules).toContain('charge-prism')
  })

  it('Combat Tempo and Deep Cache are Process QoL, not free', () => {
    let s = createInitialState(0)
    expect(processCombatSpeedMult(s)).toBe(1)
    expect(processOfflineBonusMs(s)).toBe(0)
    s.process.purchased = ['combat-tempo', 'deep-cache']
    expect(processCombatSpeedMult(s)).toBe(1.5)
    expect(processOfflineBonusMs(s)).toBe(4 * 60 * 60 * 1000)
    s.lastTickAt = 0
    const { report } = applyOfflineCatchUp(s, MAX_OFFLINE_MS + 5 * 60 * 60 * 1000)
    expect(report?.appliedMs).toBe(MAX_OFFLINE_MS + 4 * 60 * 60 * 1000)
  })

  it('Hold ranks and Foundry Hold raise salvage', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 6
    s.combat.highestSector = 6
    s.combat.sector = 6
    const base = s.resources.salvage
    grantEnemyKillRewards(s, enemy())
    const plain = s.resources.salvage - base

    const buffed = createInitialState(0)
    buffed.meta.highestSectorEver = 6
    buffed.combat.highestSector = 6
    buffed.combat.sector = 6
    buffed.furnace.wanted.recovery = 1
    buffed.furnace.active.recovery = 1
    buffed.foundry.upgrades['fp-salvage'] = 2
    expect(furnaceSalvageMult(buffed)).toBeCloseTo(1.12)
    expect(foundrySalvageMult(buffed)).toBeCloseTo(1.06)
    const before = buffed.resources.salvage
    grantEnemyKillRewards(buffed, enemy())
    expect(buffed.resources.salvage - before).toBeGreaterThan(plain)
  })

  it('Brace Pin unlocks at sector 6 after Slag Ingot 4', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 6
    s.combat.highestSector = 6
    expect(isFoundryRecipeUnlocked(s, 'brace-pin')).toBe(false)
    s.foundry.recipeLevels['slag-ingot'] = 4
    expect(isFoundryRecipeUnlocked(s, 'brace-pin')).toBe(true)
  })

  it('buyProcessNode still spends points and Neural Link can fire from Process', () => {
    let s = createInitialState(0)
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 1
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    s.resources.aiPoints = 6
    s = buyProcessNode(s, 'core-buy-max')
    expect(hasProcess(s, 'core-buy-max')).toBe(true)
    expect(s.meta.completedAchievements).toContain('neural-link')
  })

  it('Auto-Salvage still ranks a live Core', () => {
    const s = createInitialState(0)
    s.combat.docked = false
    s.process.purchased = ['auto-salvage']
    s.resources.salvage = 40
    const before = Object.values(s.combat.coreRunLevels ?? {}).reduce((a, b) => a + b, 0)
    advanceSeconds(s, 1)
    const after = Object.values(s.combat.coreRunLevels ?? {}).reduce((a, b) => a + b, 0)
    expect(after).toBeGreaterThan(before)
  })
})
