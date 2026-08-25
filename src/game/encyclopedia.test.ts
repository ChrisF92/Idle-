import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { maybeGrantSystemUnlocks, isSystemUnlocked } from './progression'
import {
  FOUNDRY_MAX_SLOTS,
  FOUNDRY_MODULE_SLOTS,
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  foundryRecipeGateLine,
  isFoundryRecipeUnlocked,
} from './foundry'
import {
  SHARDS,
  shardEffectBlurb,
  unlockedShardPool,
} from './reliquary'
import { ECHO_RUNS, ECHO_TREE, echoFoundrySpeedMult, getEchoRun } from './echo'
import { CODEX_ROLES, roleIntel } from './combat'

describe('encyclopedia depth', () => {
  it('opens Codex at sector 10 without Data research', () => {
    const locked = createInitialState(0)
    expect(isSystemUnlocked(locked, 'codex')).toBe(false)
    const open = createInitialState(0)
    open.meta.highestSectorEver = 10
    expect(isSystemUnlocked(open, 'codex')).toBe(true)
    maybeGrantSystemUnlocks(open)
    expect(open.meta.codexUnlocked).toBe(true)
  })

  it('grows Foundry toward Synth: recipe chains, 5 slots, extra Act 1 bits', () => {
    expect(FOUNDRY_RECIPES.length).toBeGreaterThanOrEqual(18)
    expect(FOUNDRY_MAX_SLOTS).toBe(5)
    expect(FOUNDRY_MODULE_SLOTS).toBe(2)
    expect(FOUNDRY_MODULES.some((m) => m.id === 'focus-array')).toBe(true)
    expect(FOUNDRY_MODULES.some((m) => m.id === 'pin-brace')).toBe(true)
    expect(FOUNDRY_MODULES.some((m) => m.id === 'warp-keel')).toBe(true)
    expect(FOUNDRY_MODULES.some((m) => m.id === 'hearth-plate')).toBe(true)
    expect(FOUNDRY_RECIPES.some((r) => r.id === 'hearth-core' && (r.requiresSlots ?? 0) >= 3)).toBe(true)

    const s = createInitialState(0)
    s.meta.highestSectorEver = 12
    expect(isFoundryRecipeUnlocked(s, 'focus-lens')).toBe(false)
    s.foundry.recipeLevels.relay = 6
    expect(isFoundryRecipeUnlocked(s, 'focus-lens')).toBe(true)
    expect(foundryRecipeGateLine(FOUNDRY_RECIPES.find((r) => r.id === 'focus-lens')!)).toContain(
      'Relay Lv 6',
    )
  })

  it('gates late Reliquary shards by career sector', () => {
    const early = createInitialState(0)
    early.meta.highestSectorEver = 15
    expect(unlockedShardPool(early)).toHaveLength(0)

    const opened = createInitialState(0)
    opened.meta.highestSectorEver = 16
    expect(unlockedShardPool(opened).some((s) => s.id === 'battle-chip')).toBe(true)
    expect(unlockedShardPool(opened).some((s) => s.id === 'warp-chip')).toBe(false)

    const late = createInitialState(0)
    late.meta.highestSectorEver = 40
    expect(unlockedShardPool(late).some((s) => s.id === 'overdraw-chip')).toBe(true)
    expect(unlockedShardPool(late).some((s) => s.id === 'warp-chip')).toBe(true)
    expect(shardEffectBlurb(SHARDS.find((s) => s.id === 'warp-chip')!)).toContain('foundry')
    expect(SHARDS.length).toBeGreaterThanOrEqual(15)
  })

  it('adds Delta and Fenix Echo gauntlets plus smelt/warp tree nodes', () => {
    expect(getEchoRun('delta')?.requiresId).toBe('stack')
    expect(getEchoRun('fenix')?.requiresId).toBe('delta')
    expect(ECHO_RUNS).toHaveLength(6)
    expect(ECHO_TREE.some((n) => n.id === 'echo-smelt')).toBe(true)
    expect(ECHO_TREE.some((n) => n.id === 'echo-warp')).toBe(true)
    const s = createInitialState(0)
    s.echo.tree = ['echo-smelt']
    expect(echoFoundrySpeedMult(s)).toBeGreaterThan(1)
  })

  it('documents hull roles in the Codex catalog', () => {
    expect(CODEX_ROLES).toContain('sniper')
    expect(roleIntel('sniper').toLowerCase()).toContain('charge')
    expect(roleIntel('boss').toLowerCase()).toContain('slam')
  })
})
