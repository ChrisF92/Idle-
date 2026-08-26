import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import {
  LEGACY_SEEN_CONTENT,
  contentKeys,
  coresAttention,
  markHubSeen,
  moreStationAttention,
  tabAttention,
} from './hubAttention'
import { importSave } from './save'

describe('hub attention', () => {
  it('badges Network for idle drones and Sortie for unseen Cores', () => {
    const state = markHullLost(createInitialState(0))
    expect(tabAttention(state, 'network')).toEqual({ spend: true, fresh: true })
    expect(tabAttention(state, 'combat')).toEqual({ spend: false, fresh: true })
    expect(coresAttention(state).fresh).toBe(true)

    state.resources.salvage = 20
    expect(tabAttention(state, 'combat').spend).toBe(true)

    const seenCores = markHubSeen(state, 'cores')
    expect(tabAttention(seenCores, 'combat').fresh).toBe(false)
    expect(tabAttention(seenCores, 'combat').spend).toBe(true)
  })

  it('badges Foundry for an idle smelter and new recipes', () => {
    let state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 68
    expect(tabAttention(state, 'foundry')).toEqual({ spend: true, fresh: true })
    expect(contentKeys(state, 'foundry')).toEqual(
      expect.arrayContaining(['sys:foundry', 'recipe:slag-ingot', 'recipe:filament']),
    )

    state.foundry.slots[0].recipeId = 'slag-ingot'
    expect(tabAttention(state, 'foundry').spend).toBe(false)

    state = markHubSeen(state, 'foundry')
    expect(tabAttention(state, 'foundry').fresh).toBe(false)

    state.foundry.recipeLevels['slag-ingot'] = 8
    expect(tabAttention(state, 'foundry').fresh).toBe(true)
    expect(contentKeys(state, 'foundry')).toEqual(expect.arrayContaining(['recipe:hardened-plate']))
  })

  it('keeps More badged until the station itself is opened', () => {
    let state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 28
    state = markHubSeen(state, 'codex')
    expect(tabAttention(state, 'stats').fresh).toBe(true)
    expect(moreStationAttention(state, 'furnace').fresh).toBe(true)

    state = markHubSeen(state, 'stats')
    expect(contentKeys(state, 'stats')).toEqual(['sys:more'])
    expect(state.meta.seenContent).toContain('sys:more')
    expect(state.meta.seenContent).not.toContain('sys:furnace')
    expect(tabAttention(state, 'stats').fresh).toBe(true)
    expect(moreStationAttention(state, 'furnace').fresh).toBe(true)

    state = markHubSeen(state, 'furnace')
    expect(moreStationAttention(state, 'furnace').fresh).toBe(false)
    expect(tabAttention(state, 'stats').fresh).toBe(false)
  })

  it('badges Process spend and Furnace ash without treating More as the station visit', () => {
    let state = markHullLost(createInitialState(0))
    state.meta.aiUnlocked = true
    state.meta.highestSectorEver = 42
    state.prestige.prestigeCount = 2
    state.research.unlocked.push('basic-optics')
    state.resources.aiPoints = 20
    expect(moreStationAttention(state, 'process').spend).toBe(true)
    expect(tabAttention(state, 'stats').spend).toBe(true)

    state.meta.highestSectorEver = 68
    state.resources.choirAsh = 10
    expect(moreStationAttention(state, 'furnace').spend).toBe(true)

    state = markHubSeen(state, 'stats')
    expect(moreStationAttention(state, 'furnace').fresh).toBe(true)
    expect(moreStationAttention(state, 'process').fresh).toBe(true)
  })

  it('surfaces newly unlocked Network bars after the first Network visit', () => {
    let state = markHullLost(createInitialState(0))
    state = markHubSeen(state, 'network')
    expect(tabAttention(state, 'network').fresh).toBe(false)

    state.meta.highestSectorEver = 68
    expect(tabAttention(state, 'network').fresh).toBe(true)
    expect(contentKeys(state, 'network')).toEqual(
      expect.arrayContaining(['netbar:yield', 'netbar:loom']),
    )
  })

  it('does not spam new pips on saves that predate seenContent', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.seenContent = [LEGACY_SEEN_CONTENT]
    state.meta.highestSectorEver = 68
    state.resources.salvage = 40
    expect(tabAttention(state, 'combat').fresh).toBe(false)
    expect(tabAttention(state, 'network').fresh).toBe(false)
    expect(tabAttention(state, 'foundry').fresh).toBe(false)
    expect(tabAttention(state, 'stats').fresh).toBe(false)
    expect(tabAttention(state, 'network').spend).toBe(true)
    expect(tabAttention(state, 'combat').spend).toBe(true)
  })

  it('hydrates missing seenContent as a legacy sentinel', () => {
    const raw = createInitialState(0)
    delete (raw.meta as { seenContent?: string[] }).seenContent
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(raw))))
    const loaded = importSave(code)
    expect(loaded?.meta.seenContent).toEqual([LEGACY_SEEN_CONTENT])
  })
})
