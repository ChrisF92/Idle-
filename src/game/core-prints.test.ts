import { describe, expect, it } from 'vitest'
import {
  BLUEPRINTS,
  getModule,
  isCorePrintUnlocked,
  isFarmableModule,
  listFarmableCores,
  modulePrintSector,
  partId,
  pickWeightedDropEntry,
} from './catalog'
import { assembleBlueprint, canAssembleBlueprint } from './actions'
import { rollEnemyPartDrop } from './combat'
import { createInitialState } from './state'
import { setPushMode, startCombat } from './tick'
import { clearCurrentWave } from './testHelpers'

describe('sector-gated Core prints', () => {
  it('gates Charge Prism at sector 4 and Choir Tap at 14', () => {
    expect(modulePrintSector('charge-prism')).toBe(4)
    expect(modulePrintSector('choir-tap')).toBe(14)
    expect(getModule('charge-prism')?.weapon?.delivery).toBe('charge')
    expect(getModule('charge-prism')?.weapon?.telegraphDuration).toBeGreaterThan(0)
    expect(isFarmableModule('charge-prism')).toBe(true)
    expect(BLUEPRINTS.some((b) => b.moduleId === 'swarm-rack')).toBe(true)
  })

  it('hides late prints until the sector is reached', () => {
    const early = createInitialState(0)
    early.meta.highestSectorEver = 2
    early.combat.highestSector = 2
    expect(isCorePrintUnlocked(early, 'flak-array')).toBe(true)
    expect(isCorePrintUnlocked(early, 'charge-prism')).toBe(false)
    expect(listFarmableCores(early).some((m) => m.id === 'charge-prism')).toBe(false)

    const mid = createInitialState(0)
    mid.meta.highestSectorEver = 4
    mid.combat.highestSector = 4
    mid.combat.sector = 4
    expect(isCorePrintUnlocked(mid, 'charge-prism')).toBe(true)
    expect(listFarmableCores(mid).some((m) => m.id === 'charge-prism')).toBe(true)
  })

  it('does not drop Charge Prism parts in sector 2', () => {
    const drop = pickWeightedDropEntry('ethereal', 2, () => 0)
    expect(drop?.moduleId).not.toBe('charge-prism')
  })

  it('assembles a print from farmed fragments', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 4
    state.combat.highestSector = 4
    state.combat.sector = 4
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

  it('drops fragments once Foundry is open', () => {
    const locked = createInitialState(0)
    expect(
      rollEnemyPartDrop(locked, { family: 'swarm', isBoss: true, name: 'Boss' }, () => 0),
    ).toHaveLength(0)

    const open = createInitialState(0)
    open.meta.highestSectorEver = 2
    open.combat.highestSector = 2
    open.combat.sector = 2
    const hits = rollEnemyPartDrop(
      open,
      { family: 'swarm', isBoss: true, name: 'Boss' },
      () => 0,
    )
    expect(hits.length).toBeGreaterThan(0)
  })

  it('Hold wave farms without advancing the sector', () => {
    let state = createInitialState(0)
    state = setPushMode(state, 'hold-wave')
    state = startCombat(state)
    state = clearCurrentWave(state)
    expect(state.combat.sector).toBe(1)
    expect(state.combat.wave).toBe(1)
    expect(state.combat.highestSector).toBe(0)
  })
})
