import { describe, expect, it } from 'vitest'
import {
  BLUEPRINTS,
  DISCOVERY_MISSING_PART_WEIGHT,
  formatPrintSourceLine,
  getModule,
  isCorePrintUnlocked,
  isFarmableModule,
  listFarmableCores,
  modulePrintSector,
  partId,
  pickWeightedDropEntry,
  printFragmentNeeds,
  TRACKED_PRINT_ROLL_BIAS,
} from './catalog'
import { assembleBlueprint, canAssembleBlueprint, setTrackedPrint } from './actions'
import { rollEnemyPartDrop } from './combat'
import { createInitialState } from './state'
import { setPushMode, startCombat } from './tick'
import { clearCurrentWave } from './testHelpers'
import { exportSave, importSave } from './save'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

describe('sector-gated Core prints', () => {
  it('gates Charge Prism at sector 8 and Choir Tap at 18', () => {
    expect(modulePrintSector('charge-prism')).toBe(8)
    expect(modulePrintSector('choir-tap')).toBe(18)
    expect(getModule('charge-prism')?.weapon?.delivery).toBe('charge')
    expect(getModule('charge-prism')?.weapon?.telegraphDuration).toBeGreaterThan(0)
    expect(isFarmableModule('charge-prism')).toBe(true)
    expect(BLUEPRINTS.some((b) => b.moduleId === 'swarm-rack')).toBe(true)
  })

  it('tiers fragment needs by print unlock sector', () => {
    expect(printFragmentNeeds(6)).toEqual({ casing: 2, core: 1, lens: 1 })
    expect(printFragmentNeeds(9)).toEqual({ casing: 3, core: 2, lens: 1 })
    expect(printFragmentNeeds(15)).toEqual({ casing: 4, core: 3, lens: 2 })
    expect(printFragmentNeeds(22)).toEqual({ casing: 5, core: 4, lens: 3 })
    expect(BLUEPRINTS.find((b) => b.moduleId === 'heavy-lance')).toMatchObject({
      casing: 2,
      core: 1,
      lens: 1,
    })
    expect(BLUEPRINTS.find((b) => b.moduleId === 'choir-tap')?.foundry?.['hearth-core']).toBe(1)
  })

  it('hides late prints until the sector is reached', () => {
    const early = createInitialState(0)
    early.meta.highestSectorEver = 6
    early.combat.highestSector = 6
    expect(isCorePrintUnlocked(early, 'flak-array')).toBe(true)
    expect(isCorePrintUnlocked(early, 'charge-prism')).toBe(false)
    expect(listFarmableCores(early).some((m) => m.id === 'charge-prism')).toBe(false)

    const mid = createInitialState(0)
    mid.meta.highestSectorEver = 8
    mid.combat.highestSector = 8
    mid.combat.sector = 8
    expect(isCorePrintUnlocked(mid, 'charge-prism')).toBe(true)
    expect(listFarmableCores(mid).some((m) => m.id === 'charge-prism')).toBe(true)
  })

  it('does not drop Charge Prism parts in sector 2', () => {
    const drop = pickWeightedDropEntry('ethereal', 6, () => 0)
    expect(drop?.moduleId).not.toBe('charge-prism')
  })

  it('assembles a print from farmed fragments', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 8
    state.combat.highestSector = 8
    state.combat.sector = 8
    const recipe = BLUEPRINTS.find((b) => b.moduleId === 'charge-prism')!
    state.parts = {
      [partId('charge-prism', 'casing')]: recipe.casing,
      [partId('charge-prism', 'core')]: recipe.core,
      [partId('charge-prism', 'lens')]: recipe.lens,
    }
    expect(canAssembleBlueprint(state, 'charge-prism').ok).toBe(true)
    state = assembleBlueprint(state, 'charge-prism')
    expect(state.shipyard.unlockedModules).toContain('charge-prism')
    expect(state.parts[partId('charge-prism', 'casing')] ?? 0).toBe(0)
    expect(state.meta.lifetimeFabCrafts).toBe(1)
  })

  it('keeps over-cap fragments when requirements shrink', () => {
    const state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    state.parts = {
      [partId('heavy-lance', 'casing')]: 9,
      [partId('heavy-lance', 'core')]: 5,
      [partId('heavy-lance', 'lens')]: 1,
    }
    const loaded = importSave(exportSave(state))!
    expect(loaded.parts[partId('heavy-lance', 'casing')]).toBe(9)
    expect(canAssembleBlueprint(loaded, 'heavy-lance').ok).toBe(true)
  })

  it('drops fragments once Foundry is open', () => {
    const locked = createInitialState(0)
    expect(
      rollEnemyPartDrop(locked, { family: 'swarm', isBoss: true, name: 'Boss' }, () => 0),
    ).toHaveLength(0)

    const open = createInitialState(0)
    open.meta.highestSectorEver = 6
    open.combat.highestSector = 6
    open.combat.sector = 6
    const hits = rollEnemyPartDrop(
      open,
      { family: 'swarm', isBoss: true, name: 'Boss' },
      () => 0,
    )
    expect(hits.length).toBeGreaterThan(0)
    expect(open.combat.fragmentNotice?.name).toBeTruthy()
  })

  it('derives Heavy Lance farm source from the armored drop table', () => {
    expect(formatPrintSourceLine('heavy-lance')).toMatch(/Armored · Wave 60\+/)
  })

  it('lets Sector 8 Divine drop Charge Prism instead of sitting empty', () => {
    expect(formatPrintSourceLine('charge-prism')).toMatch(/Divine · Wave 80\+/)
    expect(pickWeightedDropEntry('divine', 8, () => 0)?.moduleId).toBe('charge-prism')
  })

  it('biases eligible rolls toward the tracked print', () => {
    const rng = mulberry32(11)
    let tracked = 0
    let other = 0
    for (let i = 0; i < 400; i++) {
      const drop = pickWeightedDropEntry('swarm', 10, rng, { trackedModuleId: 'flak-array' })
      if (drop?.moduleId === 'flak-array') tracked += 1
      else other += 1
    }
    const rate = tracked / (tracked + other)
    expect(rate).toBeGreaterThanOrEqual(0.62)
    expect(rate).toBeLessThan(0.88)
    expect(TRACKED_PRINT_ROLL_BIAS).toBeCloseTo(0.7)
  })

  it('biases tracked part types toward missing pieces', () => {
    let lens = 0
    const rng = mulberry32(21)
    for (let i = 0; i < 300; i++) {
      const drop = pickWeightedDropEntry('armored', 6, rng, {
        trackedModuleId: 'heavy-lance',
        owned: { casing: 9, core: 5, lens: 0 },
        need: { casing: 2, core: 1, lens: 1 },
      })
      if (drop?.partType === 'lens') lens += 1
    }
    expect(lens).toBeGreaterThan(150)
  })

  it('applies a milder missing-part bias to the untracked discovery print', () => {
    expect(DISCOVERY_MISSING_PART_WEIGHT).toBe(4)
    let lens = 0
    const rng = mulberry32(21)
    for (let i = 0; i < 300; i++) {
      const drop = pickWeightedDropEntry('armored', 6, rng, {
        focusModuleId: 'heavy-lance',
        owned: { casing: 9, core: 5, lens: 0 },
        need: { casing: 2, core: 1, lens: 1 },
      })
      if (drop?.partType === 'lens') lens += 1
    }
    expect(lens).toBeGreaterThan(80)
    expect(lens).toBeLessThan(250)
  })

  it('Hold raises fragment chance only for a tracked eligible Core', () => {
    const probe = 0.12
    const advance = createInitialState(0)
    advance.meta.highestSectorEver = 6
    advance.combat.highestSector = 6
    advance.combat.sector = 6
    advance.foundry.trackedPrintId = 'heavy-lance'
    expect(
      rollEnemyPartDrop(advance, { family: 'armored', isBoss: false, name: 'Jug' }, () => probe),
    ).toHaveLength(0)

    const hold = setPushMode(advance, 'hold-sector')
    hold.foundry.trackedPrintId = 'heavy-lance'
    expect(
      rollEnemyPartDrop(hold, { family: 'armored', isBoss: false, name: 'Jug' }, () => probe).length,
    ).toBeGreaterThan(0)
  })

  it('clears tracking when the tracked Core is assembled', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    state = setTrackedPrint(state, 'heavy-lance')
    const recipe = BLUEPRINTS.find((b) => b.moduleId === 'heavy-lance')!
    state.parts = {
      [partId('heavy-lance', 'casing')]: recipe.casing,
      [partId('heavy-lance', 'core')]: recipe.core,
      [partId('heavy-lance', 'lens')]: recipe.lens,
    }
    state = assembleBlueprint(state, 'heavy-lance')
    expect(state.foundry.trackedPrintId).toBeNull()
    expect(state.combat.log.some((line) => /choose another tracked print/.test(line))).toBe(true)
  })

  it('waves always advance — there is no Hold-wave farm', () => {
    let state = createInitialState(0)
    state = setPushMode(state, 'hold-wave')
    state = startCombat(state)
    state = clearCurrentWave(state)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.wave).toBe(2)
    expect(state.combat.highestSector).toBe(0)
  })
})
