import { describe, expect, it } from 'vitest'
import {
  getBlueprint,
  getVisibleModules,
  isFarmableModule,
  isModuleVisible,
  masteryBonus,
  moduleMasteryRank,
  partId,
} from './catalog'
import {
  buyResearch,
  investPartMastery,
  performPrestige,
  sellPart,
  startFabProject,
  unlockModule,
} from './actions'
import { rollEnemyPartDrop } from './combat'
import { computeShipStats, createInitialState } from './state'
import { forceUnlockModule } from './testHelpers'

describe('blueprints and fabrication', () => {
  it('starter plate still scrap-unlockable; final Cores are not leftover-farmable', () => {
    let state = createInitialState(0)
    state.resources.scrap = 999
    state.resources.alloys = 999

    expect(isFarmableModule('plate-layer')).toBe(false)
    expect(isFarmableModule('flak-array')).toBe(false)
    expect(getBlueprint('flak-array')).toBeUndefined()

    state = unlockModule(state, 'plate-layer')
    expect(state.shipyard.unlockedModules).toContain('plate-layer')

    state = unlockModule(state, 'flak-array')
    expect(state.shipyard.unlockedModules).not.toContain('flak-array')
  })

  it('leftover drop tables do not discover final Cores', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 7
    const results = rollEnemyPartDrop(
      state,
      { family: 'swarm', isBoss: false, name: 'Drone' },
      () => 0,
    )
    expect(results.every((drop) => drop.moduleId !== 'flak-array')).toBe(true)
    expect(state.shipyard.unlockedModules).not.toContain('flak-array')
    expect(state.shipyard.coreInstances.every((row) => row.moduleId !== 'flak-array')).toBe(true)
  })

  it('does not start leftover fabrication for a final Core', () => {
    let state = createInitialState(0)
    state.meta.highestSectorEver = 6
    state.resources.data = 150
    state = buyResearch(state, 'module-fab')
    expect(getBlueprint('flak-array')).toBeUndefined()
    state.meta.discoveredModules = ['flak-array']
    state = startFabProject(state, 'flak-array')
    expect(state.base.fabProject).toBeNull()
    expect(state.shipyard.unlockedModules).not.toContain('flak-array')
  })

  it('prestige keeps unlock + parts + discovery; clears fab project', () => {
    let state = createInitialState(0)
    state.meta.discoveredModules = ['flak-array', 'heavy-lance']
    state.meta.moduleMastery = { 'flak-array': 2 }
    state.parts = { [partId('flak-array', 'casing')]: 5 }
    state = forceUnlockModule(state, 'flak-array')
    state.base.fabProject = {
      moduleId: 'heavy-lance',
      contributed: { casing: 1 },
      progress: 0.4,
    }
    state.base.assignments = { 'fab-bay': 1 }
    state.base.workerDrones = 1

    state = performPrestige(state, 5000)

    expect(state.shipyard.unlockedModules).toContain('flak-array')
    expect(state.meta.discoveredModules).toEqual(
      expect.arrayContaining(['flak-array', 'heavy-lance']),
    )
    expect(state.meta.moduleMastery['flak-array']).toBe(2)
    expect(state.parts[partId('flak-array', 'casing')]).toBe(5)
    expect(state.base.fabProject).toBeNull()
    expect(Object.keys(state.base.assignments)).toHaveLength(0)
  })

  it('sell part gains scrap; mastery invest increases rank and boosts stats', () => {
    let state = createInitialState(0)
    state = forceUnlockModule(state, 'plate-layer')
    state = forceUnlockModule(state, 'flak-array')
    state.shipyard.modules = ['flak-array']
    const before = computeShipStats(state).damage

    state.parts = {
      [partId('flak-array', 'casing')]: 2,
      [partId('flak-array', 'core')]: 1,
      [partId('flak-array', 'lens')]: 1,
    }
    const scrapBefore = state.resources.scrap
    state = sellPart(state, partId('flak-array', 'lens'), 1)
    expect(state.resources.scrap).toBe(scrapBefore + 8)
    expect(state.parts[partId('flak-array', 'lens')]).toBeUndefined()

    state = investPartMastery(state, 'flak-array')
    expect(moduleMasteryRank(state, 'flak-array')).toBe(1)
    expect(masteryBonus(1)).toBeCloseTo(1.025)
    expect(computeShipStats(state).damage).toBeGreaterThan(before)
  })

  it('shipyard visibility: undiscovered module not in getVisibleModules', () => {
    const state = createInitialState(0)
    expect(isModuleVisible(state, 'pulse-cannon')).toBe(true)
    expect(isModuleVisible(state, 'plate-layer')).toBe(true)
    expect(isModuleVisible(state, 'flak-array')).toBe(false)
    expect(getVisibleModules(state).some((m) => m.id === 'flak-array')).toBe(
      false,
    )

    state.meta.discoveredModules = ['flak-array']
    expect(isModuleVisible(state, 'flak-array')).toBe(true)
    expect(getVisibleModules(state).some((m) => m.id === 'flak-array')).toBe(true)
  })
})
