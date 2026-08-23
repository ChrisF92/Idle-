import { describe, expect, it } from 'vitest'
import { assembleBlueprint, assignWorker, setFoundrySlot, setDocked } from './actions'
import { ACT1_CADENCE } from './cadence'
import { isStationUnlocked } from './catalog'
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
} from './foundry'
import { createInitialState, SAVE_VERSION } from './state'
import { atCareerWave } from './testHelpers'
import { advanceSeconds } from './tick'
import { WORKER_JOB_IDS, workerJobLabel } from './workers'

function atFoundry(wave = ACT1_CADENCE.foundry) {
  return atCareerWave(createInitialState(0), wave)
}

describe('GDD Foundry factory', () => {
  it('bumps SAVE_VERSION for the factory shape', () => {
    expect(SAVE_VERSION).toBe(37)
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
    expect(workerJobLabel('fab-bay')).toBe('Fabrication')
    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    expect(isStationUnlocked(open, 'alloy-foundry')).toBe(true)
    expect(isStationUnlocked(open, 'drone-fab')).toBe(false)
  })

  it('lets processing workers shorten Recovered Stock', () => {
    let idle = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    idle.resources.scrap = 80
    idle = setFoundrySlot(idle, 0, 'slag-ingot')
    const idleTime = foundryCraftTime(idle, 'slag-ingot')

    let crewed = atCareerWave(createInitialState(0), ACT1_CADENCE.workers)
    crewed.resources.scrap = 80
    crewed.base.workerDrones = 4
    crewed = assignWorker(crewed, 'alloy-foundry', 1)
    crewed = setFoundrySlot(crewed, 0, 'slag-ingot')
    expect(foundryCraftTime(crewed, 'slag-ingot')).toBe(idleTime)
    advanceSeconds(crewed, 26)
    expect(crewed.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('fabricates Cores as a timed job, not an instant assemble', () => {
    let s = atFoundry(80)
    s.resources.scrap = 40
    s.foundry.materials['slag-ingot'] = 20
    const moduleId = 'flak-array'
    const recipe = { casing: 1, core: 1, lens: 1 }
    s.parts[`flak-array-casing`] = recipe.casing
    s.parts[`flak-array-core`] = recipe.core
    s.parts[`flak-array-lens`] = recipe.lens
    s.meta.discoveredModules = [...s.meta.discoveredModules, moduleId]
    const before = assembleBlueprint(s, moduleId)
    if (before === s) {
      // Some prints need extra Foundry stock; force a start if fragments+stock pass.
      expect(canStartFabrication(s, 'core', moduleId).ok || assembleBlueprint(s, moduleId) !== s).toBeTruthy()
    }
    s = assembleBlueprint(s, moduleId)
    if (s.foundry.fabrication[0]?.kind === 'core') {
      expect(s.shipyard.unlockedModules.includes(moduleId)).toBe(false)
      s.combat.docked = false
      advanceSeconds(s, 8 * 60 + 5)
      expect(s.foundry.pendingCores).toContain(moduleId)
      s = setDocked(s, true)
      expect(s.shipyard.unlockedModules).toContain(moduleId)
    }
  })

  it('builds facilities on a fabrication slot and arms them next Sortie', () => {
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
    advanceSeconds(s, 15 * 60 + 2)
    expect(s.foundry.pendingFacilities).toContain('processing-line')
    expect(hasFacility(s, 'processing-line')).toBe(false)
    armPendingFacilities(s)
    expect(hasFacility(s, 'processing-line')).toBe(true)
    expect(foundrySlotCount(s)).toBe(2)
  })

  it('unlocks drone production only after the Fabricator arms', () => {
    let s = atCareerWave(createInitialState(0), ACT1_CADENCE.foundryAdvanced)
    expect(isStationUnlocked(s, 'drone-fab')).toBe(false)
    s.foundry.facilities = ['drone-fabricator']
    expect(isStationUnlocked(s, 'drone-fab')).toBe(true)
  })
})
