import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  buyAiNode,
  buyMatterShop,
  canAscend,
  performAscension,
  performPrestige,
} from './actions'
import {
  canBuyMatterShop,
  aiProductionBonus,
  shopMaxRank,
  getMatterShopItem,
  getAiNode,
} from './catalog'
import { matterGainFor } from './rebuild'
import { availableTimeCompressionSpeeds } from './matter'
import {
  ACHIEVEMENTS,
  tryCompleteAchievements,
  achievementCompletions,
} from './progression'
import { advanceSeconds, startCombat } from './tick'
import { importSave } from './save'
import { mergeSignalCores } from './signalCores'
import type { SignalCoreInstance } from './types'

describe('deep matter shop + ascension', () => {
  it('caps canonical Matter nodes well below old 25-rank trees', () => {
    expect(shopMaxRank(getMatterShopItem('weapon-calibration')!)).toBe(5)
    expect(getMatterShopItem('matter-blade')).toBeUndefined()
    let state = createInitialState(0)
    state.prestige.matterShop = { 'weapon-calibration': 5 }
    state.resources.prestigeMatter = 1e9
    state.meta.act1Cleared = true
    state.prestige.prestigeCount = 5
    expect(canBuyMatterShop(state, 'weapon-calibration').ok).toBe(false)
    expect(canBuyMatterShop(state, 'weapon-calibration').reason).toMatch(/Max/)
  })

  it('ascension does not multiply Rebuild Matter', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.bestWave = 1000
    state.combat.bestWave = 1000
    state.prestige.cycle.bestWave = 1000
    expect(canAscend(state)).toBe(true)
    const before = matterGainFor(state)
    state = performAscension(state, 1000)
    expect(state.meta.ascensionCount).toBe(1)
    state.prestige.cycle.bestWave = 1000
    expect(matterGainFor(state)).toBe(before)
  })

  it('keeps ascension across prestige', () => {
    let state = createInitialState(0)
    state.meta.act1Cleared = true
    state.meta.ascensionCount = 2
    state = performPrestige(state, 2000)
    expect(state.meta.ascensionCount).toBe(2)
  })
})

describe('combat speed vs industry', () => {
  it('AI cannot add general combat speed', () => {
    let state = createInitialState(0)
    state.meta.bestWave = 250
    state.combat.bestWave = 250
    state.resources.aiPoints = 30
    state.ai.purchased = ['combat-chrono-1', 'combat-chrono-2', 'combat-chrono-3']
    expect(availableTimeCompressionSpeeds(state)).toEqual([1])
    const buying = createInitialState(0)
    buying.meta.bestWave = 250
    buying.resources.aiPoints = 30
    expect(buyAiNode(buying, 'combat-chrono-1').ai.purchased).not.toContain('combat-chrono-1')
  })

  it('industry AI does not create a combat multiplier', () => {
    let state = createInitialState(0)
    state.meta.bestWave = 250
    state.combat.bestWave = 250
    state.resources.aiPoints = 50
    state = buyAiNode(state, 'chrono-industry')
    expect(aiProductionBonus(state)).toBeGreaterThanOrEqual(0)
    expect(availableTimeCompressionSpeeds(state)).toEqual([1])
  })

  it('Challenge sorties still cannot buy Time Compression from AI', () => {
    let state = createInitialState(0)
    state.ai.purchased = ['drone-efficiency-1']
    state.prestige.activeChallengeId = 'no-ai'
    expect(availableTimeCompressionSpeeds(state)).toEqual([1])
  })
})

describe('achievements pack', () => {
  it('includes repeatables and grants multiple tiers', () => {
    expect(ACHIEVEMENTS.some((a) => a.repeatable)).toBe(true)
    const state = createInitialState(0)
    state.meta.lifetimeSectorClears = 120
    const newly = tryCompleteAchievements(state)
    expect(newly.filter((id) => id === 'sector-grind').length).toBeGreaterThanOrEqual(2)
    expect(achievementCompletions(state, 'sector-grind')).toBeGreaterThanOrEqual(2)
    expect(state.resources.aiPoints).toBe(0)
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

describe('retired automation AI', () => {
  it('does not merge physical inventory during the sim', () => {
    let state = createInitialState(0)
    state.meta.bestWave = 220
    state.combat.bestWave = 220
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
    expect(rank2).toBe(0)
    expect(rank1).toBe(6)
  })

  it('catalog documents expensive automation nodes', () => {
    expect(getAiNode('auto-fab-bay')?.costAiPoints).toBeGreaterThanOrEqual(10)
    expect(getAiNode('neural-router')?.kind).toBe('automation')
    expect(getAiNode('chrono-fab')?.fabBonus).toBeGreaterThan(0)
  })
})

describe('save migrate v18', () => {
  it('rejects pre-v21 saves (Hiveworks clean reset)', () => {
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
    ;(raw as { version: number }).version = 17
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(raw))))
    expect(importSave(code)).toBeNull()
  })
})

describe('matter shop buy still works', () => {
  it('buys Weapon Calibration at rank 1', () => {
    let state = createInitialState(0)
    state.resources.prestigeMatter = 4
    state = buyMatterShop(state, 'weapon-calibration')
    expect(state.prestige.matterShop['weapon-calibration']).toBe(1)
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
