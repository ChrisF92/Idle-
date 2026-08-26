import { describe, expect, it } from 'vitest'
import { assembleBlueprint, assignWorker, performRebuild, setFoundrySlot } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked, getBlueprint, partId } from './catalog'
import {
  FOUNDRY_FACILITIES,
  FOUNDRY_MASTERY_STEPS,
  FOUNDRY_RECIPES,
  FOUNDRY_STARTING_FAB_SLOTS,
  FOUNDRY_STARTING_SLOTS,
  armPendingFacilities,
  canStartFabrication,
  foundryCraftTime,
  foundryFabSlotCount,
  foundrySlotCount,
  hasFacility,
  isFoundryRecipeUnlocked,
  startFabrication,
  tickFoundry,
} from './foundry'
import { createInitialState, SAVE_VERSION } from './state'
import { armRebuildDoor, atCareerWave } from './testHelpers'
import { advanceSeconds } from './tick'
import { WORKER_JOB_IDS, workerJobLabel } from './workers'
import { migrateLegacyFabProject } from './save'
import { tickAutomation } from './automation'
import { processConfig } from './process'

function atFoundry(wave = ACT1_CADENCE.foundry) {
  return atCareerWave(createInitialState(0), wave)
}

describe('GDD Foundry factory', () => {
  it('bumps SAVE_VERSION for the factory shape', () => {
    expect(SAVE_VERSION).toBe(45)
  })

  it('opens with one processing slot and one fabrication slot', () => {
    const s = atFoundry()
    expect(foundrySlotCount(s)).toBe(FOUNDRY_STARTING_SLOTS)
    expect(foundryFabSlotCount(s)).toBe(FOUNDRY_STARTING_FAB_SLOTS)
    expect(s.foundry.slots).toHaveLength(1)
    expect(s.foundry.fabrication).toHaveLength(1)
  })

  it('starts Recovered Stock from Scrap in about 30s, not Salvage', () => {
    const recipe = FOUNDRY_RECIPES.find((row) => row.id === 'slag-ingot')!
    expect(recipe.name).toBe('Recovered Stock')
    expect(recipe.costs.scrap).toBeGreaterThan(0)
    expect(recipe.costs.salvage).toBeUndefined()
    expect(recipe.craftTime).toBe(30)
    expect(isFoundryRecipeUnlocked(atFoundry(), 'slag-ingot')).toBe(true)

    let s = atFoundry()
    s.resources.scrap = 80
    s.resources.salvage = 0
    s = setFoundrySlot(s, 0, 'slag-ingot')
    advanceSeconds(s, 29)
    expect(s.foundry.materials['slag-ingot'] ?? 0).toBe(0)
    advanceSeconds(s, 2)
    expect(s.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('uses the GDD mastery table and keeps growth at 100', () => {
    expect(FOUNDRY_MASTERY_STEPS.map((step) => step.at)).toEqual([1, 5, 10, 20, 30, 50, 75, 100])
    expect(FOUNDRY_RECIPES.every((recipe) => recipe.maxLevel === 100)).toBe(true)
    expect(FOUNDRY_RECIPES.some((recipe) => recipe.id === 'warp-thread')).toBe(false)
  })

  it('lists the six GDD Worker jobs and drops Power / Repair', () => {
    expect([...WORKER_JOB_IDS]).toEqual([
      'scrap-field',
      'sensor-net',
      'alloy-foundry',
      'drone-fab',
      'fab-bay',
      'construction',
    ])
    expect(workerJobLabel('alloy-foundry')).toBe('Processing')
    expect(workerJobLabel('sensor-net')).toBe('Research')
    expect(workerJobLabel('fab-bay')).toBe('Fabrication')
    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(isStationUnlocked(open, 'alloy-foundry')).toBe(true)
    expect(isStationUnlocked(open, 'sensor-net')).toBe(true)
    expect(isStationUnlocked(open, 'drone-fab')).toBe(false)
    expect(isStationUnlocked(open, 'construction')).toBe(false)
  })

  it('lets processing workers shorten Recovered Stock', () => {
    let idle = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    idle.resources.scrap = 80
    idle = setFoundrySlot(idle, 0, 'slag-ingot')
    const idleTime = foundryCraftTime(idle, 'slag-ingot')

    let crewed = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    crewed.resources.scrap = 80
    crewed.base.workerDrones = 4
    crewed = setFoundrySlot(crewed, 0, 'slag-ingot')
    crewed = assignWorker(crewed, 'alloy-foundry', 1)
    expect(foundryCraftTime(crewed, 'slag-ingot')).toBe(idleTime)
    advanceSeconds(idle, 27)
    advanceSeconds(crewed, 27)
    expect(crewed.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThan(
      idle.foundry.materials['slag-ingot'] ?? 0,
    )
  })

  it('does not fabricate a final Core through leftover Foundry recipes', () => {
    let s = atFoundry(80)
    const moduleId = 'flak-array'
    expect(getBlueprint(moduleId)).toBeUndefined()
    expect(canStartFabrication(s, 'core', moduleId).ok).toBe(false)
    const after = assembleBlueprint(s, moduleId)
    expect(after.foundry.fabrication[0]?.kind ?? null).not.toBe('core')
    expect(after.shipyard.unlockedModules.includes(moduleId)).toBe(false)
  })

  it('builds facilities on a fabrication slot and applies them immediately', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    s.foundry.materials['slag-ingot'] = 20
    s.foundry.materials['hardened-plate'] = 10
    expect(FOUNDRY_FACILITIES.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        'processing-line',
        'fabrication-bay',
        'drone-racks',
        'drone-fabricator',
        'research-annex',
        'storage-bay',
        'specialised-works',
      ]),
    )
    expect(canStartFabrication(s, 'facility', 'processing-line').ok).toBe(true)
    s = startFabrication(s, 'facility', 'processing-line')
    expect(s.foundry.fabrication[0]?.kind).toBe('facility')
    s.combat.docked = false
    tickFoundry(s, 15 * 60 + 2)
    expect(s.foundry.pendingFacilities).toEqual([])
    expect(hasFacility(s, 'processing-line')).toBe(true)
    expect(foundrySlotCount(s)).toBe(2)
  })

  it('arms leftover pending facilities on load', () => {
    const s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    s.foundry.pendingFacilities = ['processing-line']
    armPendingFacilities(s)
    expect(hasFacility(s, 'processing-line')).toBe(true)
    expect(s.foundry.pendingFacilities).toEqual([])
  })

  it('keeps paid Fabrication progress across Rebuild', () => {
    let s = atCareerWave(armRebuildDoor(createInitialState(0)), 80)
    s.combat.docked = true
    s.foundry.fabrication[0] = {
      kind: 'core',
      jobId: 'flak-array',
      progress: 0.4,
      paid: true,
      complete: false,
    }
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.foundry.fabrication[0]?.kind).toBe('core')
    expect(s.foundry.fabrication[0]?.progress).toBeCloseTo(0.4)
    expect(s.foundry.fabrication[0]?.paid).toBe(true)
  })

  it('unlocks drone production only after the Fabricator arms', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    expect(isStationUnlocked(s, 'drone-fab')).toBe(false)
    s.foundry.facilities = ['drone-fabricator']
    expect(isStationUnlocked(s, 'drone-fab')).toBe(true)
  })

  it('refunds the removed instant-assembly project during save hydration', () => {
    const s = atFoundry()
    s.base.fabProject = {
      moduleId: 'flak-array',
      contributed: { casing: 2, core: 1 },
      progress: 0.5,
    }
    migrateLegacyFabProject(s)
    expect(s.base.fabProject).toBeNull()
    expect(s.parts[partId('flak-array', 'casing')]).toBe(2)
    expect(s.parts[partId('flak-array', 'core')]).toBe(1)
  })

  it('does not let leftover Process start fabrication of a final Core', () => {
    const moduleId = 'flak-array'
    const s = atFoundry(ACT1_CADENCE.process)
    s.meta.discoveredModules.push(moduleId)
    s.foundry.trackedPrintId = moduleId
    s.process.purchased = ['run-profiles']
    const config = processConfig(s)
    s.process.config = {
      ...config,
      activeProfileId: 'custom',
      profiles: [
        {
          id: 'custom',
          name: 'Tracked Fabrication',
          spend: { attack: 34, defense: 33, economy: 33 },
          salvageReserve: 0,
          autoExtract: false,
          extractHullPct: 0.35,
          autoShop: false,
          rules: [{ id: 'fab', enabled: true, when: [{ kind: 'wave-gte', value: 1 }], then: { kind: 'fab-tracked' } }],
        },
      ],
    }
    tickAutomation(s)
    expect(s.foundry.fabrication[0]?.jobId).not.toBe(moduleId)
    expect(s.shipyard.unlockedModules).not.toContain(moduleId)
    expect(s.shipyard.coreInstances.every((row) => row.moduleId !== moduleId)).toBe(true)
  })
})
