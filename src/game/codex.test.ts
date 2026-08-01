import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyResearch, performAscension, performPrestige } from './actions'
import { startCombat } from './tick'
import { revealCodexFamilies, softCounterForFamily } from './combat'
import { isSystemUnlocked } from './progression'

describe('codex', () => {
  it('records families when a fight begins', () => {
    let state = createInitialState(0)
    expect(state.codex.seenFamilies).toEqual([])
    state = startCombat(state)
    expect(state.codex.seenFamilies).toContain('swarm')
  })

  it('keeps seen families across prestige', () => {
    let state = createInitialState(0)
    state = startCombat(state)
    expect(state.codex.seenFamilies).toContain('swarm')
    state.combat.sector = 10
    state = performPrestige(state, 1000)
    expect(state.codex.seenFamilies).toContain('swarm')
  })

  it('unlocks Codex permanently after researching once', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.resources.data = 50
    state = buyResearch(state, 'tactical-codex')
    expect(state.meta.codexUnlocked).toBe(true)
    expect(isSystemUnlocked(state, 'codex')).toBe(true)

    state.combat.sector = 10
    state = performPrestige(state, 1000)
    expect(state.meta.codexUnlocked).toBe(true)
    expect(state.research.unlocked).toContain('tactical-codex')
    expect(isSystemUnlocked(state, 'codex')).toBe(true)

    state.meta.act1Cleared = true
    state.combat.sector = 30
    state.meta.highestSectorEver = 30
    state = performAscension(state, 2000)
    expect(state.meta.codexUnlocked).toBe(true)
    expect(isSystemUnlocked(state, 'codex')).toBe(true)
  })

  it('tactical-codex research is purchasable', () => {
    let state = createInitialState(0)
    state.resources.data = 50
    state = buyResearch(state, 'tactical-codex')
    expect(state.research.unlocked).toContain('tactical-codex')
  })

  it('soft counters describe each family', () => {
    expect(softCounterForFamily('swarm').toLowerCase()).toContain('flak')
    expect(softCounterForFamily('armored').toLowerCase()).toContain('pierce')
    expect(softCounterForFamily('titan').toLowerCase()).toContain('defense')
  })

  it('revealCodexFamilies ignores unknown ids', () => {
    const state = createInitialState(0)
    revealCodexFamilies(state, ['swarm', 'nope', 'armored'])
    expect(state.codex.seenFamilies).toEqual(['swarm', 'armored'])
  })
})
