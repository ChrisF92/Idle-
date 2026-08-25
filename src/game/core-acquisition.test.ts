import { describe, expect, it } from 'vitest'
import {
  BLUEPRINTS,
  earlyCareerFragmentMult,
  partId,
} from './catalog'
import { assembleBlueprint, canAssembleBlueprint, setTrackedPrint } from './actions'
import { encounterForWave, rollEnemyPartDrop, salvageFromKill } from './combat'
import { craftsForNextLevel, FOUNDRY_MODULES, getFoundryRecipe } from './foundry'
import { logisticsDropMult } from './core'
import { foundryPartDropMult } from './foundryBonuses'
import { wavesForSector } from './sectors'
import { createInitialState } from './state'
import { setPushMode } from './tick'
import type { GameState } from './types'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function assembledFarmable(state: GameState): string[] {
  return BLUEPRINTS.map((b) => b.moduleId).filter((id) => state.shipyard.unlockedModules.includes(id))
}

function tryAssemble(state: GameState): GameState {
  let s = state
  for (const bp of BLUEPRINTS) {
    if (bp.foundry || bp.requiresRecipeLevel) continue
    if (canAssembleBlueprint(s, bp.moduleId).ok) s = assembleBlueprint(s, bp.moduleId)
  }
  return s
}

function rollSector(state: GameState, sector: number, rng: () => number, clears = 1): GameState {
  state.meta.highestSectorEver = Math.max(state.meta.highestSectorEver, sector - 1)
  for (let c = 0; c < clears; c++) {
    const waves = wavesForSector(sector)
    for (let wave = 1; wave <= waves; wave++) {
      const encounter = encounterForWave(sector, wave)
      for (const unit of encounter.units) {
        rollEnemyPartDrop(state, unit, rng)
      }
    }
  }
  state.meta.highestSectorEver = Math.max(state.meta.highestSectorEver, sector)
  return tryAssemble(state)
}

function advanceRun(
  seed: number,
  untilSector: number,
  opts: { extraClears?: number; track?: string; holdSector?: number } = {},
): { firstCoreSector: number | null; assembledBy11: number; state: GameState } {
  const rng = mulberry32(seed)
  let state = createInitialState(0)
  if (opts.track) state = setTrackedPrint(state, opts.track)
  if (opts.holdSector) state = setPushMode(state, 'hold-sector')
  let firstCoreSector: number | null = null
  for (let sector = 1; sector < untilSector; sector++) {
    const holdHere = opts.holdSector != null && sector === opts.holdSector
    const clears = holdHere ? 1 : 1 + (sector >= 3 ? opts.extraClears ?? 0 : 0)
    const loops = holdHere ? 24 : 1
    for (let n = 0; n < loops; n++) {
      state = rollSector(state, sector, rng, clears)
      if (firstCoreSector == null && assembledFarmable(state).length > 0) {
        firstCoreSector = sector
      }
      if (holdHere && assembledFarmable(state).includes(opts.track ?? '')) break
    }
    if (!holdHere && opts.holdSector != null && sector === opts.holdSector) {
      /* stay */
    }
  }
  return {
    firstCoreSector,
    assembledBy11: assembledFarmable(state).length,
    state,
  }
}

function firstCoreBySeed(seed: number, extraClears = 1): number | null {
  return advanceRun(seed, 12, { extraClears }).firstCoreSector
}

describe('early Core acquisition benchmarks', () => {
  it('keeps the early-career fragment taper hidden and later bonuses independent', () => {
    expect(earlyCareerFragmentMult(4)).toBe(3.25)
    expect(earlyCareerFragmentMult(8)).toBe(3.25)
    expect(earlyCareerFragmentMult(14)).toBe(2.15)
    expect(earlyCareerFragmentMult(21)).toBe(1.35)
    expect(earlyCareerFragmentMult(22)).toBe(1)
    const late = createInitialState(0)
    late.meta.highestSectorEver = 20
    late.core.ranks.logistics = 20
    expect(logisticsDropMult(late)).toBeGreaterThan(1)
    expect(foundryPartDropMult(late)).toBe(1)
    late.foundry.upgrades['fp-print'] = 4
    expect(foundryPartDropMult(late)).toBeCloseTo(1.32)
  })

  it('lands the first non-starter Core shortly after the S6 Foundry door for a typical Advance run', () => {
    const seeds = [3, 7, 11, 13, 17, 19, 29, 31, 37, 41, 43, 47]
    const firsts = seeds.map((seed) => firstCoreBySeed(seed, 1))
    const assembled = firsts.filter((n): n is number => n != null)
    expect(assembled.length).toBeGreaterThanOrEqual(Math.ceil(seeds.length * 0.9))
    const sorted = [...assembled].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!
    expect(median).toBeGreaterThanOrEqual(6)
    expect(median).toBeLessThanOrEqual(11)
    expect(p90).toBeLessThanOrEqual(13)
  })

  it('does not flood S4 with many different Cores, and typically yields 1–3 by S11', () => {
    const seeds = [5, 8, 12, 18, 22, 26, 33, 39]
    const by4: number[] = []
    const by11: number[] = []
    for (const seed of seeds) {
      const at4 = advanceRun(seed, 5, { extraClears: 1 })
      const at11 = advanceRun(seed, 11, { extraClears: 1 })
      by4.push(assembledFarmable(at4.state).length)
      by11.push(at11.assembledBy11)
    }
    expect(Math.max(...by4)).toBeLessThanOrEqual(3)
    const typical = by11.filter((n) => n >= 1 && n <= 3).length
    expect(typical).toBeGreaterThanOrEqual(5)
    expect(Math.max(...by11)).toBeLessThanOrEqual(5)
  })

  it('makes Track + Hold materially faster than Advance-only farming', () => {
    const seeds = [9, 14, 21, 27]
    const advanceClears: number[] = []
    const holdClears: number[] = []
    for (const seed of seeds) {
      const rngA = mulberry32(seed)
      let advance = createInitialState(0)
      let aSector = 0
      for (let sector = 1; sector <= 10; sector++) {
        advance = rollSector(advance, sector, rngA, sector >= 3 ? 2 : 1)
        aSector += 1
        if (assembledFarmable(advance).length > 0) break
      }
      advanceClears.push(aSector)

      const rngH = mulberry32(seed + 100)
      let hold = setPushMode(createInitialState(0), 'hold-sector')
      hold.meta.highestSectorEver = 6
      hold = setTrackedPrint(hold, 'heavy-lance')
      let loops = 0
      for (let n = 0; n < 20; n++) {
        hold = rollSector(hold, 6, rngH, 1)
        loops += 1
        if (hold.shipyard.unlockedModules.includes('heavy-lance')) break
      }
      holdClears.push(loops)
    }
    const advAvg = advanceClears.reduce((s, n) => s + n, 0) / advanceClears.length
    const holdAvg = holdClears.reduce((s, n) => s + n, 0) / holdClears.length
    expect(holdAvg).toBeLessThan(advAvg)
    expect(holdAvg).toBeLessThanOrEqual(8)
  })

  it('keeps late-game Logistics / Foundry print upgrades valuable', () => {
    const rngBare = mulberry32(44)
    const rngBuff = mulberry32(44)
    const bare = createInitialState(0)
    bare.meta.highestSectorEver = 20
    const buffed = createInitialState(0)
    buffed.meta.highestSectorEver = 20
    buffed.core.ranks.logistics = 25
    buffed.foundry.upgrades['fp-print'] = 4
    let bareHits = 0
    let buffHits = 0
    for (let i = 0; i < 800; i++) {
      bareHits += rollEnemyPartDrop(
        bare,
        { family: 'armored', isBoss: false, name: 'Jug' },
        rngBare,
      ).length
      buffHits += rollEnemyPartDrop(
        buffed,
        { family: 'armored', isBoss: false, name: 'Jug' },
        rngBuff,
      ).length
    }
    expect(buffHits).toBeGreaterThan(bareHits)
    expect(buffHits).toBeLessThan(bareHits * 3)
  })
})

describe('early Foundry equipment payoff', () => {
  it('reaches Slag Liner after Slag Ingot 4 and three plates', () => {
    expect(getFoundryRecipe('hardened-plate')?.requiresRecipeLevel?.level).toBe(4)
    expect(FOUNDRY_MODULES.find((m) => m.id === 'slag-liner')?.cost['hardened-plate']).toBe(3)
    expect(FOUNDRY_MODULES.find((m) => m.id === 'relay-coil')?.cost.relay).toBe(3)
    let crafts = 0
    for (let level = 0; level < 4; level++) crafts += craftsForNextLevel(level)
    const salvage = crafts * 10 + 3 * 4 * 10
    expect(salvage).toBeLessThanOrEqual(280)
  })

  it('a normal Advance run banks enough salvage for the first liner by S7', () => {
    let salvage = 0
    for (let sector = 1; sector <= 7; sector++) {
      const waves = wavesForSector(sector)
      for (let wave = 1; wave <= waves; wave++) {
        const encounter = encounterForWave(sector, wave)
        for (const unit of encounter.units) {
          salvage += salvageFromKill(sector, unit.isBoss)
        }
      }
    }
    let crafts = 0
    for (let level = 0; level < 4; level++) crafts += craftsForNextLevel(level)
    const need = crafts * 10 + 3 * 4 * 10
    expect(salvage).toBeGreaterThanOrEqual(need)
  })
})

describe('reduced print requirements stay assemble-ready on old inventories', () => {
  it('marks a previously incomplete Heavy Lance ready without deleting extras', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.parts[partId('heavy-lance', 'casing')] = 4
    state.parts[partId('heavy-lance', 'core')] = 3
    state.parts[partId('heavy-lance', 'lens')] = 2
    expect(canAssembleBlueprint(state, 'heavy-lance').ok).toBe(true)
    expect(state.parts[partId('heavy-lance', 'casing')]).toBe(4)
  })
})
