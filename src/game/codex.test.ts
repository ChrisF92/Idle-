import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { performRebuild } from './actions'
import { isSystemUnlocked, maybeGrantSystemUnlocks } from './progression'
import { ACT1_CADENCE } from './cadence'
import { armRebuildDoor } from './testHelpers'
import { emptyCodexState } from './codex'

describe('codex discovery', () => {
  it('records hostiles when they actually spawn', () => {
    let state = createInitialState(0)
    expect(state.codex.discoveredHostileIds).toEqual([])
    state = startCombat(state)
    expect(state.codex.discoveredHostileIds).toContain('void-mite')
    expect(state.codex).not.toHaveProperty('seenFamilies')
  })

  it('keeps Codex across Rebuild', () => {
    let state = startCombat(createInitialState(0))
    expect(state.codex.discoveredHostileIds).toContain('void-mite')
    const armed = armRebuildDoor(state)
    armed.codex = structuredClone(state.codex)
    state = performRebuild(armed, {
      frameId: armed.shipyard.frameId,
      modules: [...armed.shipyard.modules],
    })
    expect(state.codex.discoveredHostileIds).toContain('void-mite')
  })

  it('unlocks Codex UI around W30 from career Best Wave', () => {
    const locked = createInitialState(0)
    locked.meta.bestWave = ACT1_CADENCE.codex - 1
    expect(isSystemUnlocked(locked, 'codex')).toBe(false)
    const open = createInitialState(0)
    open.meta.bestWave = ACT1_CADENCE.codex
    expect(isSystemUnlocked(open, 'codex')).toBe(true)
    maybeGrantSystemUnlocks(open)
    expect(open.meta.codexUnlocked).toBe(true)
  })

  it('sanitizes malformed Codex state', () => {
    const state = createInitialState(0)
    state.codex = {
      ...emptyCodexState(),
      discoveredHostileIds: ['void-mite', 'not-real'],
      discoveredBossIds: ['nope'],
    }
    const { sanitizeCodexState } = require('./codex') as typeof import('./codex')
    const clean = sanitizeCodexState(state.codex)
    expect(clean.discoveredHostileIds).toEqual(['void-mite'])
    expect(clean.discoveredBossIds).toEqual([])
  })
})
