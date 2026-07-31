import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { buyResearch, performPrestige } from './actions'
import { startCombat } from './tick'
import { revealCodexFamilies, softCounterForFamily } from './combat'

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
    state.combat.sector = 8
    state = performPrestige(state, 1000)
    expect(state.research.unlocked).toEqual([])
    expect(state.codex.seenFamilies).toContain('swarm')
  })

  it('tactical-codex research is purchasable', () => {
    let state = createInitialState(0)
    state.resources.data = 30
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
