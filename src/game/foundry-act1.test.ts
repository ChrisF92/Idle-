import { describe, expect, it } from 'vitest'
import {
  assignWorker,
  buyMatterShop,
  performRebuild,
  setFoundrySlot,
  startFabrication,
} from './actions'
import {
  applyWaveSecureBlueprintSources,
  BLUEPRINTS,
  blueprintFragmentCount,
  blueprintLifecycle,
  canDropBlueprintFragment,
  completeBlueprintFromSource,
  discoverBlueprint,
  grantBlueprintFragment,
  isBlueprintDiscovered,
} from './blueprints'
import { ACT1_CADENCE } from './cadence'
import { FOUNDRY_PANE_LABELS } from './foundry'
import {
  FOUNDRY_FACILITIES,
  FOUNDRY_INFRASTRUCTURE_IDS,
  FOUNDRY_MATERIAL_IDS,
  FOUNDRY_MATERIAL_NAMES,
  FOUNDRY_RECIPES,
  LEGACY_FACILITY_IDS,
  LEGACY_FOUNDRY_MATERIAL_IDS,
  RELIC_FABRICATION_RECIPES,
  grantFoundryCapability,
} from './foundryCatalogue'
import {
  canStartFabrication,
  canStartProcessing,
  foundryProcessingSpeed,
  materialMasteryRank,
  materialMasteryXp,
  tickFoundry,
} from './foundry'
import { grantDirectMaterial } from './foundryRecovery'
import {
  MATERIAL_MASTERY_MAX_RANK,
  MATERIAL_MASTERY_XP_CUMULATIVE,
  MATERIAL_MASTERY_XP_PER_CYCLE,
  PROCESSING_SECONDS,
} from './foundrySeeds'
import { applyOfflineCatchUp } from './offline'
import { isSystemUnlocked } from './progression'
import { sortieGrossScrapGenerated } from './extraction'
import { grantGeneratedScrap } from './rebuild'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import { armRebuildDoor, atCareerWave, markHullLost } from './testHelpers'
import { advanceSeconds, handleAppHidden, setDocked, setSortiePaused, startCombat } from './tick'
import { ownedWorkers, workerCapacity, idleWorkers } from './workers'
import { moduleMasteryRank } from './catalog'
import { fragmentChanceMult } from './workshop'

function atFoundry(wave = ACT1_CADENCE.foundry) {
  return atCareerWave(createInitialState(0), wave)
}

function stock(state: ReturnType<typeof createInitialState>, id: string, n: number) {
  state.foundry.materials[id] = n
}

describe('PR5 Foundry catalogue and panes', () => {
  it('uses save version 47 with no migration', () => {
    expect(SAVE_VERSION).toBe(51)
    const raw = JSON.parse(JSON.stringify({ ...createInitialState(0), version: 46 }))
    expect(importSave(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))))).toBeNull()
  })

  it('has exactly 12 production materials with canonical names and no legacy IDs', () => {
    expect(FOUNDRY_MATERIAL_IDS).toHaveLength(12)
    expect([...FOUNDRY_MATERIAL_IDS]).toEqual([
      'recovered-stock',
      'conductive-filament',
      'tempered-alloy',
      'ballistic-composite',
      'optical-glass',
      'shield-lattice',
      'control-mesh',
      'phase-crystal',
      'nanite-compound',
      'resonant-ceramic',
      'thermal-conductor',
      'crown-matrix',
    ])
    expect(FOUNDRY_MATERIAL_NAMES['recovered-stock']).toBe('Recovered Stock')
    expect(FOUNDRY_MATERIAL_NAMES['crown-matrix']).toBe('Crown Matrix')
    expect(FOUNDRY_RECIPES).toHaveLength(12)
    for (const id of LEGACY_FOUNDRY_MATERIAL_IDS) {
      expect(FOUNDRY_MATERIAL_IDS).not.toContain(id)
    }
  })

  it('has exactly four Foundry panes and no 100-level recipe architecture', () => {
    expect(Object.keys(FOUNDRY_PANE_LABELS)).toEqual(['processing', 'fabrication', 'mastery', 'blueprints'])
    expect(MATERIAL_MASTERY_MAX_RANK).toBe(5)
    expect(MATERIAL_MASTERY_XP_CUMULATIVE).toHaveLength(6)
    for (const recipe of FOUNDRY_RECIPES) {
      expect(recipe).not.toHaveProperty('maxLevel')
      expect(recipe).not.toHaveProperty('requiresBestWave')
      expect(recipe).not.toHaveProperty('requiresRecipeLevel')
    }
  })

  it('unlocks Foundry at W50 without a Rebuild', () => {
    const closed = atCareerWave(createInitialState(0), 49)
    expect(isSystemUnlocked(closed, 'foundry')).toBe(false)
    expect(canStartProcessing(closed, 'recovered-stock').ok).toBe(false)
    const open = atFoundry(50)
    expect(open.prestige.prestigeCount).toBe(0)
    expect(isSystemUnlocked(open, 'foundry')).toBe(true)
    open.resources.scrap = 80
    expect(canStartProcessing(open, 'recovered-stock').ok).toBe(true)
  })

  it('matches the canonical Processing dependency graph', () => {
    const byId = Object.fromEntries(FOUNDRY_RECIPES.map((row) => [row.id, row]))
    expect(byId['recovered-stock']?.costs).toEqual({ scrap: 8 })
    expect(byId['conductive-filament']?.costs).toEqual({ scrap: 6 })
    expect(byId['tempered-alloy']?.costs.materials).toEqual({ 'recovered-stock': 2 })
    expect(byId['ballistic-composite']?.costs.materials).toEqual({
      'recovered-stock': 2,
      'conductive-filament': 2,
    })
    expect(byId['optical-glass']?.costs.materials).toEqual({ 'conductive-filament': 2 })
    expect(byId['shield-lattice']?.costs.materials).toEqual({
      'tempered-alloy': 2,
      'conductive-filament': 2,
    })
    expect(byId['control-mesh']?.costs.materials).toEqual({
      'optical-glass': 2,
      'conductive-filament': 2,
    })
    expect(byId['phase-crystal']?.capabilities).toEqual(['advanced-processing'])
    expect(byId['nanite-compound']?.costs.materials).toEqual({
      'control-mesh': 2,
      'tempered-alloy': 2,
    })
    expect(byId['resonant-ceramic']?.costs.ash).toBe(10)
    expect(byId['thermal-conductor']?.costs.ash).toBe(15)
    expect(byId['crown-matrix']?.recipeAuthored).toBe(false)
  })

  it('infrastructure is exactly the five canonical facilities', () => {
    expect([...FOUNDRY_INFRASTRUCTURE_IDS]).toEqual([
      'processing-line',
      'fabrication-bay',
      'worker-fabricator',
      'research-annex',
      'recovery-storage',
    ])
    expect(FOUNDRY_FACILITIES.map((row) => row.id)).toEqual([...FOUNDRY_INFRASTRUCTURE_IDS])
    for (const id of LEGACY_FACILITY_IDS) {
      expect(FOUNDRY_INFRASTRUCTURE_IDS).not.toContain(id)
    }
  })
})

describe('PR5 Processing', () => {
  it('pays inputs once, grants output once, and awards output Material Mastery XP', () => {
    let s = atFoundry()
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'recovered-stock')
    expect(s.resources.scrap).toBe(72)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBe(0)
    expect(s.foundry.slots[0]?.paid).toBe(true)
    tickFoundry(s, PROCESSING_SECONDS['recovered-stock'] - 1)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBe(0)
    tickFoundry(s, 2)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBe(1)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
    expect(materialMasteryXp(s, 'recovered-stock')).toBe(MATERIAL_MASTERY_XP_PER_CYCLE)
    expect(s.resources.scrap).toBe(72)
  })

  it('does not auto-repeat a completed cycle', () => {
    let s = atFoundry()
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'recovered-stock')
    tickFoundry(s, 40)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBe(1)
    tickFoundry(s, 40)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBe(1)
  })

  it('caps Material Mastery at M5 and does not award XP from direct recovery', () => {
    const s = atFoundry()
    s.foundry.masteryXp['recovered-stock'] = MATERIAL_MASTERY_XP_CUMULATIVE[5]
    expect(materialMasteryRank(s, 'recovered-stock')).toBe(5)
    grantDirectMaterial(s, 'recovered-stock', 3)
    expect(s.foundry.materials['recovered-stock']).toBe(3)
    expect(materialMasteryXp(s, 'recovered-stock')).toBe(MATERIAL_MASTERY_XP_CUMULATIVE[5])
  })

  it('consumes Ash for Resonant Ceramic and keeps the material through Rebuild', () => {
    let s = armRebuildDoor(atFoundry(ACT1_CADENCE.rebuild))
    stock(s, 'tempered-alloy', 4)
    s.resources.choirAsh = 20
    s = setFoundrySlot(s, 0, 'resonant-ceramic')
    expect(s.resources.choirAsh).toBe(10)
    tickFoundry(s, PROCESSING_SECONDS['resonant-ceramic'] + 1)
    expect(s.foundry.materials['resonant-ceramic']).toBe(1)
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.resources.choirAsh).toBe(0)
    expect(s.foundry.materials['resonant-ceramic']).toBe(1)
  })

  it('requires the advanced-processing capability for Phase Crystal, not a Best-Wave gate', () => {
    const s = atFoundry(400)
    stock(s, 'optical-glass', 6)
    expect(canStartProcessing(s, 'phase-crystal').ok).toBe(false)
    grantFoundryCapability(s, 'advanced-processing')
    expect(canStartProcessing(s, 'phase-crystal').ok).toBe(true)
  })

  it('does not start Crown Matrix until the recipe is authored', () => {
    const s = atFoundry(900)
    grantFoundryCapability(s, 'advanced-processing')
    grantFoundryCapability(s, 'late-choir-apex-recovery')
    expect(canStartProcessing(s, 'crown-matrix').ok).toBe(false)
  })

  it('Matter Foundry Throughput speeds Processing; Time Compression does not', () => {
    let a = atFoundry()
    a.resources.scrap = 80
    a = setFoundrySlot(a, 0, 'recovered-stock')
    let b = structuredClone(a)
    b.resources.prestigeMatter = 200
    b = buyMatterShop(b, 'foundry-throughput')
    expect(foundryProcessingSpeed(b)).toBeGreaterThan(foundryProcessingSpeed(a))
    tickFoundry(a, 5)
    tickFoundry(b, 5)
    expect(b.foundry.slots[0]?.progress ?? 0).toBeGreaterThan(a.foundry.slots[0]?.progress ?? 0)

    const compressed = structuredClone(a)
    compressed.meta.sortieSpeed = 3
    tickFoundry(a, 4)
    tickFoundry(compressed, 4)
    expect(compressed.foundry.slots[0]?.progress).toBeCloseTo(a.foundry.slots[0]?.progress ?? 0, 8)
  })
})

describe('PR5 Blueprint lifecycle and Wave sources', () => {
  it('UNKNOWN → FRAGMENTED → DISCOVERED without fabricating a Core', () => {
    const s = atFoundry()
    const before = (s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance').length
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('unknown')
    grantBlueprintFragment(s, 'heavy-lance', 1)
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('fragmented')
    expect(blueprintFragmentCount(s, 'heavy-lance')).toBe(1)
    grantBlueprintFragment(s, 'heavy-lance', 4)
    expect(isBlueprintDiscovered(s, 'heavy-lance')).toBe(true)
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('discovered')
    expect((s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance')).toHaveLength(before)
  })

  it('guaranteed source completes DISCOVERED from any fragment count without refund or item', () => {
    const s = atFoundry()
    grantBlueprintFragment(s, 'heavy-lance', 2)
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('fragmented')
    completeBlueprintFromSource(s, 'heavy-lance')
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('discovered')
    expect(blueprintFragmentCount(s, 'heavy-lance')).toBe(2)
    expect((s.shipyard.coreInstances ?? []).some((row) => row.moduleId === 'heavy-lance')).toBe(false)
    expect(canDropBlueprintFragment(s, 'heavy-lance', 120)).toBe(false)
    completeBlueprintFromSource(s, 'heavy-lance')
    expect(s.foundry.discovered.filter((id) => id === 'heavy-lance')).toHaveLength(1)
  })

  it('careerBestWave alone does not discover; Wave-secure boss event does', () => {
    const sources = [
      { wave: 50, id: 'flak-array' },
      { wave: 100, id: 'heavy-lance' },
      { wave: 150, id: 'grav-tether' },
      { wave: 200, id: 'slag-spitter' },
      { wave: 250, id: 'phase-beam' },
      { wave: 300, id: 'sensor-array' },
      { wave: 350, id: 'barrier-projector' },
    ]
    for (const row of sources) {
      const s = atCareerWave(createInitialState(0), row.wave)
      expect(isBlueprintDiscovered(s, row.id)).toBe(false)
      applyWaveSecureBlueprintSources(s, row.wave, 'normal')
      expect(isBlueprintDiscovered(s, row.id)).toBe(false)
      applyWaveSecureBlueprintSources(s, row.wave, 'boss')
      expect(isBlueprintDiscovered(s, row.id)).toBe(true)
      expect((s.shipyard.coreInstances ?? []).some((core) => core.moduleId === row.id)).toBe(false)
      applyWaveSecureBlueprintSources(s, row.wave, 'boss')
      expect(s.foundry.discovered.filter((id) => id === row.id)).toHaveLength(1)
    }
  })

  it('Fragment Find only scales the drop chance, never a guaranteed source', () => {
    const a = atFoundry()
    const b = structuredClone(a)
    b.workshop.levels['fragment-find'] = 10
    expect(fragmentChanceMult(b)).toBeGreaterThan(fragmentChanceMult(a))
    applyWaveSecureBlueprintSources(a, 50, 'boss')
    applyWaveSecureBlueprintSources(b, 50, 'boss')
    expect(isBlueprintDiscovered(a, 'flak-array')).toBe(true)
    expect(isBlueprintDiscovered(b, 'flak-array')).toBe(true)
    expect((b.shipyard.coreInstances ?? []).some((row) => row.moduleId === 'flak-array')).toBe(false)
  })

  it('starters are OWNED from physical copies; Pulse/Plate are not recreated', () => {
    const s = createInitialState(0)
    expect(blueprintLifecycle(s, 'pulse-cannon')).toBe('owned')
    expect(blueprintLifecycle(s, 'plate-layer')).toBe('owned')
    expect(blueprintLifecycle(s, 'starter-frame')).toBe('owned')
    const pulses = (s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'pulse-cannon')
    expect(pulses).toHaveLength(1)
  })
})

describe('PR5 physical Core fabrication', () => {
  it('creates distinct physical Heavy instances without moduleCopies', () => {
    let s = atFoundry()
    discoverBlueprint(s, 'heavy-lance')
    s.foundry.materials['tempered-alloy'] = 40
    s.foundry.materials['ballistic-composite'] = 20
    s.foundry.materials['conductive-filament'] = 20
    expect((s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance')).toHaveLength(0)
    s = startFabrication(s, 'core', 'heavy-lance')
    tickFoundry(s, 160)
    const first = (s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance')
    expect(first).toHaveLength(1)
    expect(first[0]?.id).toBe('heavy-lance:1')
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('owned')
    s = startFabrication(s, 'core', 'heavy-lance')
    tickFoundry(s, 160)
    const copies = (s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance')
    expect(copies.map((row) => row.id).sort()).toEqual(['heavy-lance:1', 'heavy-lance:2'])
    expect(s.workshop.coreStarts[copies[0]!.id] ?? 0).toBe(0)
    expect(s.workshop.coreStarts[copies[1]!.id] ?? 0).toBe(0)
    expect(s).not.toHaveProperty('moduleCopies')
    expect((s.shipyard as { moduleCopies?: unknown }).moduleCopies).toBeUndefined()
    expect(s.foundry.discovered.filter((id) => id === 'heavy-lance')).toHaveLength(1)
    s.meta.moduleMastery['heavy-lance'] = 4
    copies[0]!.targetingDoctrine = 'focus'
    copies[1]!.targetingDoctrine = 'execution'
    expect(moduleMasteryRank(s, 'heavy-lance')).toBe(4)
    expect(copies[0]?.targetingDoctrine).toBe('focus')
    expect(copies[1]?.targetingDoctrine).toBe('execution')
  })

  it('completes fabrication during a running Sortie without changing fitted loadout', () => {
    let s = setDocked(markHullLost(atFoundry()), false)
    s = startCombat(s)
    const fitted = [...s.shipyard.modules]
    discoverBlueprint(s, 'flak-array')
    s.foundry.materials['recovered-stock'] = 20
    s.foundry.materials['ballistic-composite'] = 20
    s.foundry.materials['conductive-filament'] = 20
    s = startFabrication(s, 'core', 'flak-array')
    tickFoundry(s, 120)
    expect((s.shipyard.coreInstances ?? []).some((row) => row.moduleId === 'flak-array')).toBe(true)
    expect(s.shipyard.modules).toEqual(fitted)
    expect(s.combat.inFight).toBe(true)
  })

  it('exposes Relic fabrication recipes as a PR6 Foundry kind, not an empty stub', () => {
    const s = atFoundry()
    expect(RELIC_FABRICATION_RECIPES).toHaveLength(20)
    expect(canStartFabrication(s, 'relic', 'any').ok).toBe(false)
    expect(canStartFabrication(s, 'relic', 'power-coupler').ok).toBe(false)
  })
})

describe('PR5 Workers', () => {
  it('keeps ownership and capacity distinct; Worker Racks raise capacity only', () => {
    let s = atFoundry()
    s.base.workerDrones = 6
    expect(ownedWorkers(s)).toBe(6)
    expect(workerCapacity(s)).toBe(6)
    s.resources.prestigeMatter = 200
    s = buyMatterShop(s, 'worker-racks')
    expect(workerCapacity(s)).toBe(7)
    expect(ownedWorkers(s)).toBe(6)
    expect(idleWorkers(s)).toBe(6)
  })

  it('Worker Fabricator creates exactly one Worker and cannot exceed capacity', () => {
    let s = atFoundry()
    s.foundry.facilities = ['worker-fabricator']
    s.base.workerDrones = 5
    s.foundry.materials['recovered-stock'] = 40
    s.foundry.materials['conductive-filament'] = 20
    s.resources.scrap = 80
    expect(canStartFabrication(s, 'worker', 'worker').ok).toBe(true)
    s = startFabrication(s, 'worker', 'worker')
    tickFoundry(s, 90)
    expect(ownedWorkers(s)).toBe(6)
    expect(workerCapacity(s)).toBe(6)
    expect(canStartFabrication(s, 'worker', 'worker').ok).toBe(false)
  })

  it('assignments cannot exceed owned workforce', () => {
    let s = atFoundry()
    s.base.workerDrones = 2
    s = assignWorker(s, 'scrap-field', 2)
    expect(s.base.assignments['scrap-field']).toBe(2)
    const blocked = assignWorker(s, 'alloy-foundry', 1)
    expect(blocked.base.assignments['alloy-foundry'] ?? 0).toBe(0)
    expect(idleWorkers(s)).toBe(0)
  })

  it('passive Worker Scrap is industry, not Extraction Sortie Scrap', () => {
    let s = setDocked(markHullLost(atFoundry()), false)
    s = startCombat(s)
    s.base.workerDrones = 4
    s = assignWorker(s, 'scrap-field', 2)
    const cycleBefore = s.prestige.cycle?.scrapGenerated ?? 0
    const extractionBefore = sortieGrossScrapGenerated(s)
    grantGeneratedScrap(s, 12, 'industry')
    expect(sortieGrossScrapGenerated(s)).toBe(extractionBefore)
    expect(s.prestige.cycle?.scrapGenerated ?? 0).toBe(cycleBefore + 12)
  })

  it('Workers and capacity persist Rebuild', () => {
    let s = armRebuildDoor(atFoundry(ACT1_CADENCE.rebuild))
    s.base.workerDrones = 4
    s.resources.prestigeMatter = 200
    s = buyMatterShop(s, 'worker-racks')
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(ownedWorkers(s)).toBe(4)
    expect(workerCapacity(s)).toBe(7)
  })
})

describe('PR5 Rebuild / offline / clock', () => {
  it('preserves Foundry/Worker/Blueprint state and resets cycle currency', () => {
    let s = armRebuildDoor(atFoundry(ACT1_CADENCE.rebuild))
    stock(s, 'resonant-ceramic', 3)
    s.foundry.masteryXp['tempered-alloy'] = 12
    grantBlueprintFragment(s, 'heavy-lance', 2)
    discoverBlueprint(s, 'flak-array')
    s.foundry.slots[0] = { recipeId: 'recovered-stock', progress: 0.4, paid: true }
    s.foundry.fabrication[0] = { kind: 'core', jobId: 'flak-array', progress: 0.3, paid: true }
    s.foundry.facilities = ['processing-line']
    s.base.workerDrones = 3
    s.resources.scrap = 40
    s.resources.choirAsh = 9
    s.workshop.coreStarts['pulse-cannon:1'] = 4
    const cores = [...(s.shipyard.coreInstances ?? [])]
    s = performRebuild(s, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.foundry.materials['resonant-ceramic']).toBe(3)
    expect(s.foundry.masteryXp['tempered-alloy']).toBe(12)
    expect(blueprintFragmentCount(s, 'heavy-lance')).toBe(2)
    expect(isBlueprintDiscovered(s, 'flak-array')).toBe(true)
    expect(s.foundry.slots[0]?.progress).toBeCloseTo(0.4)
    expect(s.foundry.fabrication[0]?.progress).toBeCloseTo(0.3)
    expect(s.foundry.facilities).toEqual(['processing-line'])
    expect(ownedWorkers(s)).toBe(3)
    expect(s.shipyard.coreInstances?.map((row) => row.id)).toEqual(cores.map((row) => row.id))
    expect(s.resources.scrap).toBeLessThan(40)
    expect(s.resources.choirAsh).toBe(0)
    expect(s.workshop.coreStarts['pulse-cannon:1'] ?? 0).toBe(0)
  })

  it('advances Foundry offline while combat is frozen, without duplicating output', () => {
    let s = setDocked(markHullLost(atFoundry()), false)
    s = startCombat(s)
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'recovered-stock')
    s = setSortiePaused(s, true)
    const sim = s.combat.simTime
    const wave = s.combat.wave
    s = handleAppHidden(s)
    advanceSeconds(s, 25)
    expect(s.combat.simTime).toBe(sim)
    expect(s.combat.wave).toBe(wave)
    expect(s.foundry.materials['recovered-stock'] ?? 0).toBeGreaterThanOrEqual(1)

    let offline = atFoundry()
    offline.resources.scrap = 80
    offline = setFoundrySlot(offline, 0, 'recovered-stock')
    offline.lastTickAt = 0
    const encoded = exportSave(offline)
    const { state: caught } = applyOfflineCatchUp(offline, 60_000)
    expect(caught.foundry.materials['recovered-stock'] ?? 0).toBe(1)
    const loaded = importSave(encoded)!
    loaded.lastTickAt = 0
    const { state: resumed } = applyOfflineCatchUp(loaded, 60_000)
    expect(resumed.foundry.materials['recovered-stock'] ?? 0).toBe(1)
  })

  it('round-trips current Foundry state exactly', () => {
    let s = atFoundry()
    stock(s, 'tempered-alloy', 5)
    s.foundry.masteryXp['recovered-stock'] = 8
    s.foundry.fragments['heavy-lance'] = 2
    s.foundry.discovered = [...s.foundry.discovered, 'flak-array']
    s.foundry.facilities = ['recovery-storage']
    const loaded = importSave(exportSave(s))
    expect(loaded?.foundry.materials['tempered-alloy']).toBe(5)
    expect(loaded?.foundry.masteryXp['recovered-stock']).toBe(8)
    expect(loaded?.foundry.fragments['heavy-lance']).toBe(2)
    expect(loaded?.foundry.discovered).toContain('flak-array')
    expect(loaded?.foundry.facilities).toEqual(['recovery-storage'])
  })

  it('offline Core fabrication grants exactly one instance and does not duplicate on resume', () => {
    let s = atFoundry()
    discoverBlueprint(s, 'flak-array')
    s.foundry.materials['recovered-stock'] = 20
    s.foundry.materials['ballistic-composite'] = 20
    s.foundry.materials['conductive-filament'] = 20
    s = startFabrication(s, 'core', 'flak-array')
    s.lastTickAt = 0
    const encoded = exportSave(s)
    const { state: caught } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect((caught.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'flak-array')).toHaveLength(1)
    expect(caught.foundry.fabrication[0]?.kind).toBeNull()
    const loaded = importSave(encoded)!
    loaded.lastTickAt = 0
    const { state: resumed } = applyOfflineCatchUp(loaded, 10 * 60 * 1000)
    expect((resumed.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'flak-array')).toHaveLength(1)
  })

  it('offline Worker fabrication grants exactly one Worker', () => {
    let s = atFoundry()
    s.foundry.facilities = ['worker-fabricator']
    s.base.workerDrones = 5
    s.foundry.materials['recovered-stock'] = 40
    s.foundry.materials['conductive-filament'] = 20
    s.resources.scrap = 80
    s = startFabrication(s, 'worker', 'worker')
    s.lastTickAt = 0
    const { state: next } = applyOfflineCatchUp(s, 10 * 60 * 1000)
    expect(ownedWorkers(next)).toBe(6)
    expect(workerCapacity(next)).toBe(6)
    expect(next.foundry.fabrication[0]?.kind).toBeNull()
  })

  it('offline Worker Scrap is industry catch-up, not Extraction Sortie Scrap', () => {
    let s = setDocked(markHullLost(atFoundry()), true)
    s.base.workerDrones = 4
    s = assignWorker(s, 'scrap-field', 2)
    s.lastTickAt = 0
    const extractionBefore = sortieGrossScrapGenerated(s)
    const cycleBefore = s.prestige.cycle?.scrapGenerated ?? 0
    const { state: next } = applyOfflineCatchUp(s, 60 * 1000)
    expect(sortieGrossScrapGenerated(next)).toBe(extractionBefore)
    expect(next.prestige.cycle?.scrapGenerated ?? 0).toBeGreaterThan(cycleBefore)
    expect(next.resources.scrap).toBeGreaterThan(s.resources.scrap)
  })
})

describe('PR5 Blueprint catalogue metadata', () => {
  it('covers starter, wave-secure, mastery, capability, furnace, and challenge sources', () => {
    const kinds = new Set(BLUEPRINTS.flatMap((row) => row.sources.map((source) => source.kind)))
    expect(kinds.has('starter')).toBe(true)
    expect(kinds.has('wave-secure')).toBe(true)
    expect(kinds.has('material-mastery')).toBe(true)
    expect(kinds.has('foundry-capability')).toBe(true)
    expect(kinds.has('furnace-progression')).toBe(true)
    expect(kinds.has('challenge')).toBe(true)
    const salvage = BLUEPRINTS.find((row) => row.id === 'salvage-beacon')
    expect(salvage?.sources[0]?.minRank).toBeNull()
  })
})
