import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { maybeGrantSystemUnlocks, isSystemUnlocked } from './progression'
import {
  FOUNDRY_MAX_SLOTS,
  FOUNDRY_RECIPES,
  isFoundryRecipeUnlocked,
} from './foundry'
import { FOUNDRY_MATERIAL_IDS } from './foundryCatalogue'
import { atCareerWave } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
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

  it('catalogues the 12-material Foundry network and M0→M5 Mastery', () => {
    expect(FOUNDRY_RECIPES).toHaveLength(12)
    expect(FOUNDRY_MATERIAL_IDS).toHaveLength(12)
    expect(FOUNDRY_MAX_SLOTS).toBe(5)
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    expect(isFoundryRecipeUnlocked(s, 'recovered-stock')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'phase-crystal')).toBe(false)
    expect(FOUNDRY_RECIPES.every((r) => !('maxLevel' in r))).toBe(true)
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
