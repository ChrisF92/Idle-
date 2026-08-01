import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  buyAiNode,
  buyMatterShop,
  canAscend,
  performAscension,
  performPrestige,
  prestigeGainFor,
} from './actions'
import {
  canBuyMatterShop,
  combatSpeedMultiplier,
  aiProductionBonus,
  shopMaxRank,
  getMatterShopItem,
  getAiNode,
} from './catalog'
import {
  ACHIEVEMENTS,
  tryCompleteAchievements,
  achievementCompletions,
} from './progression'
import { advanceSeconds, startCombat } from './tick'
import { importSave, exportSave } from './save'
import { mergeSignalCores } from './signalCores'
import type { SignalCoreInstance } from './types'

describe('deep matter shop + ascension', () => {
  it('allows deep matter ranks after gates', () => {
    expect(shopMaxRank(getMatterShopItem('matter-blade')!)).toBe(25)
    let state = createInitialState(0)
    state.prestige.matterShop = { 'matter-blade': 14 }
    state.resources.prestigeMatter = 1e9
    state.meta.act1Cleared = true
    state.prestige.prestigeCount = 5
    state.meta.highestSectorEver = 30
    expect(canBuyMatterShop(state, 'matter-blade').ok).toBe(false)
    expect(canBuyMatterShop(state, 'matter-blade').reason).toMatch(/Ascension/)
    state.meta.ascensionCount = 1
    expect(canBuyMatterShop(state, 'matter-blade').ok).toBe(true)
  })

  it('ascension boosts future prestige matter gains', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.combat.sector = 30
    state.combat.highestSector = 30
    state.meta.highestSectorEver = 30
    expect(canAscend(state)).toBe(true)
    const before = prestigeGainFor(state)
    state = performAscension(state, 1000)
    expect(state.meta.ascensionCount).toBe(1)
    expect(state.combat.sector).toBe(1)
    state.combat.sector = 30
    expect(prestigeGainFor(state)).toBeGreaterThan(before)
  })

  it('keeps ascension across prestige', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.ascensionCount = 2
    state.combat.sector = 10
    state = performPrestige(state, 2000)
    expect(state.meta.ascensionCount).toBe(2)
  })
})

describe('combat speed vs industry', () => {
  it('combat chrono multiplies combat speed only', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 25
    state.resources.aiPoints = 30
    state = buyAiNode(state, 'combat-chrono-1')
    expect(combatSpeedMultiplier(state)).toBe(1.5)
    state = buyAiNode(state, 'combat-chrono-2')
    expect(combatSpeedMultiplier(state)).toBe(2)
    state = buyAiNode(state, 'combat-chrono-3')
    expect(combatSpeedMultiplier(state)).toBe(3)
  })

  it('requires chrono chain and ignores industry bonus for combat mult', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 25
    state.resources.aiPoints = 50
    expect(buyAiNode(state, 'combat-chrono-2').ai.purchased).not.toContain(
      'combat-chrono-2',
    )
    state = buyAiNode(state, 'chrono-industry')
    expect(aiProductionBonus(state)).toBe(0.4)
    expect(combatSpeedMultiplier(state)).toBe(1)
  })

  it('silent bridge disables combat chrono', () => {
    let state = createInitialState(0)
    state.ai.purchased = ['combat-chrono-3']
    state.prestige.activeChallengeId = 'no-ai'
    expect(combatSpeedMultiplier(state)).toBe(1)
  })
})

describe('achievements pack', () => {
  it('includes repeatables and grants multiple tiers', () => {
    expect(ACHIEVEMENTS.some((a) => a.repeatable)).toBe(true)
    const state = createInitialState(0)
    state.meta.lifetimeSectorClears = 60
    const newly = tryCompleteAchievements(state)
    expect(newly.filter((id) => id === 'sector-grind').length).toBeGreaterThanOrEqual(2)
    expect(achievementCompletions(state, 'sector-grind')).toBeGreaterThanOrEqual(2)
    expect(state.resources.aiPoints).toBeGreaterThanOrEqual(4)
  })

  it('grants merge achievement on signal core merge', () => {
    let state = createInitialState(0)
    state.meta.aiUnlocked = true
    const mk = (uid: string): SignalCoreInstance => ({
      uid,
      defId: 'salvage-ping',
      rank: 1,
    })
    state.signalCores.inventory = [mk('a'), mk('b'), mk('c')]
    state = mergeSignalCores(state, 'salvage-ping', 1)
    expect(state.meta.lifetimeCoreMerges).toBe(1)
    expect(state.meta.completedAchievements).toContain('merge-first')
  })
})

describe('automation AI', () => {
  it('auto-merge collapses triples during sim', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 22
    state.resources.aiPoints = 20
    state = buyAiNode(state, 'auto-merge-signal')
    expect(state.ai.purchased).toContain('auto-merge-signal')
    const mk = (uid: string): SignalCoreInstance => ({
      uid,
      defId: 'salvage-ping',
      rank: 1,
    })
    state.signalCores.inventory = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e'), mk('f')]
    advanceSeconds(state, 0.05)
    const rank1 = state.signalCores.inventory.filter(
      (c) => c.defId === 'salvage-ping' && c.rank === 1,
    ).length
    const rank2 = state.signalCores.inventory.filter(
      (c) => c.defId === 'salvage-ping' && c.rank === 2,
    ).length
    expect(rank2).toBeGreaterThanOrEqual(2)
    expect(rank1).toBe(0)
  })

  it('catalog documents expensive automation nodes', () => {
    expect(getAiNode('auto-fab-bay')?.costAiPoints).toBeGreaterThanOrEqual(10)
    expect(getAiNode('neural-router')?.kind).toBe('automation')
    expect(getAiNode('chrono-fab')?.fabBonus).toBeGreaterThan(0)
  })
})

describe('save migrate v18', () => {
  it('migrates v17 meta fields', () => {
    const legacy = createInitialState(0)
    const raw = {
      ...legacy,
      version: 17,
      meta: {
        ...legacy.meta,
        completedAchievements: ['first-blood'],
        ascensionCount: undefined,
      },
    }
    // Force version 17 shape
    ;(raw as { version: number }).version = 17
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(raw))))
    const migrated = importSave(code)
    expect(migrated).not.toBeNull()
    expect(migrated!.version).toBe(19)
    expect(migrated!.meta.ascensionCount).toBe(0)
    expect(migrated!.meta.achievementCompletions['first-blood']).toBe(1)
    expect(importSave(exportSave(migrated!))!.meta.lifetimeSectorClears).toBe(0)
  })
})

describe('matter shop buy still works', () => {
  it('buys blade at rank 1', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 3
    state = buyMatterShop(state, 'matter-blade')
    expect(state.prestige.matterShop['matter-blade']).toBe(1)
  })
})

describe('combat still starts', () => {
  it('engages after launch', () => {
    let state = createInitialState(0)
    state.combat.docked = false
    state = startCombat(state)
    expect(state.combat.inFight).toBe(true)
  })
})
