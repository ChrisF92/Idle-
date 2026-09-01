import { describe, expect, it } from 'vitest'
import * as actions from './actions'
import { buyMatterShop, performRebuild, setFoundrySlot, setTrackedPrint, startFabrication } from './actions'
import * as automation from './automation'
import { tickAutomation } from './automation'
import {
  BLUEPRINTS,
  WAVE_SECURE_BLUEPRINTS,
  applyWaveSecureBlueprintSources,
  blueprintLifecycle,
  canDropBlueprintFragment,
  canTrackBlueprint,
  discoverBlueprint,
  grantBlueprintFragment,
  isBlueprintDiscovered,
} from './blueprints'
import { ACT1_CADENCE } from './cadence'
import { rollEnemyPartDrop } from './combat'
import * as foundry from './foundry'
import {
  foundrySlotCount,
  researchAnnexSpeedMult,
  tickFoundry,
} from './foundry'
import {
  grantFoundryCapability,
  isFoundryCapabilityId,
} from './foundryCatalogue'
import {
  hiveResearchDroneCapBonus,
  hiveResearchFoundrySlots,
  hiveResearchSpeed,
} from './hiveResearch'
import { applyOfflineCatchUp } from './offline'
import { createEmptyProcessConfig, hasProcessMastery } from './process'
import { SYSTEM_UNLOCKS } from './progression'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import { armRebuildDoor, atCareerWave } from './testHelpers'
import { extraWorkerCapacityFromResearch, ownedWorkers, workerCapacity } from './workers'

function atFoundry(wave = ACT1_CADENCE.foundry) {
  return atCareerWave(createInitialState(0), wave)
}

function encodeRaw(state: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

const REMOVED_FOUNDRY_APIS = [
  'claimFoundryCompletions',
  'armPendingFacilities',
  'buyFoundryUpgrade',
  'equipFoundryModule',
  'unequipFoundryModule',
  'foundryRecipeLevel',
  'craftsForNextLevel',
  'foundryMastery',
  'foundryMasteryRank',
  'foundryRecipeGateLine',
  'foundrySalvageReserve',
  'isFoundryInfinite',
  'foundryDamageMult',
  'foundryShieldMult',
  'foundryFitSlots',
  'foundryShieldFlat',
  'foundrySalvageMult',
  'foundryXpMult',
  'foundryAshHeatMult',
  'foundryPartDropMult',
  'foundryShardDropBonus',
  'foundryDroneCapBonus',
  'foundryQueueCap',
  'scaledFoundryCost',
  'foundryCraftOutput',
  'foundryResearchSpeedMult',
  'foundryResearchXpMult',
  'stopFabrication',
] as const

const REMOVED_ACTION_APIS = [
  'clearFabProject',
  'depositFabPart',
  'withdrawFabPart',
  'sellPart',
  'investPartMastery',
  'buyMaxYardArms',
  'saveYardLayout',
  'loadYardLayout',
  'startFabProject',
  'launchFabProject',
  'pickFoundryUpgradeId',
  'buyMaxFoundryUpgrades',
  'upgradeBuilding',
  'isBuildingUnlocked',
  'stopFabrication',
] as const

const REMOVED_AUTOMATION = [
  'pickSmartSmeltRecipe',
  'pickFoundryPrereqRecipe',
  'nextFoundryRecipe',
  'autoSmartSmelt',
  'autoFoundryUpgrades',
  'autoPrintAssemble',
  'autoYardArms',
  'autoFabBay',
] as const

describe('PR5 correction: obsolete APIs', () => {
  it('does not export leftover Foundry / part / Yard no-op APIs', () => {
    for (const name of REMOVED_FOUNDRY_APIS) {
      expect(foundry).not.toHaveProperty(name)
    }
    for (const name of REMOVED_ACTION_APIS) {
      expect(actions).not.toHaveProperty(name)
    }
    for (const name of REMOVED_AUTOMATION) {
      expect(automation).not.toHaveProperty(name)
    }
    expect(createEmptyProcessConfig()).not.toHaveProperty('yard')
    expect(SYSTEM_UNLOCKS.some((row) => row.id === 'yard')).toBe(false)
  })
})

describe('PR5 correction: manual Processing boundary', () => {
  it('one Processing cycle ends idle even when leftover Process flags exist', () => {
    let s = atFoundry()
    s.process.purchased = ['foundry-repeat', 'smart-smelt', 'foundry-stock', 'foundry-prereqs']
    s.process.config.foundry.repeatRecipe = 'recovered-stock'
    s.process.config.foundry.queue = ['recovered-stock']
    s.process.config.foundry.minStock = { 'recovered-stock': 99 }
    s.process.config.foundry.autoBuy = true
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'recovered-stock')
    expect(s.foundry.slots[0]?.recipeId).toBe('recovered-stock')
    expect(s.foundry.slots[0]?.paid).toBe(true)
    tickFoundry(s, 20)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
    expect(s.foundry.slots[0]?.paid).toBe(false)
    expect(s.foundry.materials['recovered-stock']).toBe(1)
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
    expect(s.foundry.materials['recovered-stock']).toBe(1)
  })

  it('legacy Process paths do not start final Processing', () => {
    const s = atFoundry()
    s.process.purchased = ['smart-smelt', 'foundry-repeat']
    s.process.config.foundry.repeatRecipe = 'recovered-stock'
    s.resources.scrap = 80
    s.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
  })

  it('legacy Process paths do not fabricate a Core', () => {
    let s = atFoundry()
    s.process.purchased = ['print-assemble', 'smart-smelt']
    discoverBlueprint(s, 'flak-array')
    s.foundry.materials['recovered-stock'] = 20
    s.foundry.materials['ballistic-composite'] = 20
    s.foundry.materials['conductive-filament'] = 20
    const before = (s.shipyard.coreInstances ?? []).map((row) => row.id)
    tickAutomation(s)
    expect((s.shipyard.coreInstances ?? []).map((row) => row.id)).toEqual(before)
    expect(s.foundry.fabrication[0]?.kind).toBeNull()
  })

  it('Yard Process mastery is not satisfied by Foundry infrastructure', () => {
    const s = atFoundry()
    s.foundry.facilities = ['processing-line', 'fabrication-bay', 'worker-fabricator']
    expect(hasProcessMastery(s, 'yard')).toBe(false)
  })
})

describe('PR5 correction: pending Blueprint sources stay dormant', () => {
  it('pending Aegis / Bastion / Nano / Beacon sources are not W50 RNG-only acquisition', () => {
    const pending = ['rapid-aegis', 'bastion-frame', 'nano-lathe', 'salvage-beacon'] as const
    for (const id of pending) {
      const def = BLUEPRINTS.find((row) => row.id === id)
      expect(def?.fragmentEligibleFromWave).toBe(Infinity)
      expect(def?.sources[0]?.kind === 'material-mastery' || def?.sources[0]?.kind === 'foundry-capability').toBe(
        true,
      )
      if (def?.sources[0]?.kind === 'material-mastery') {
        expect(def.sources[0]?.minRank).toBeNull()
      }
      const early = atFoundry(50)
      const late = atFoundry(999)
      expect(canDropBlueprintFragment(early, id, 50)).toBe(false)
      expect(canDropBlueprintFragment(late, id, 999)).toBe(false)
      expect(canTrackBlueprint(early, id)).toBe(false)
      grantBlueprintFragment(early, id, 1)
      expect(blueprintLifecycle(early, id)).toBe('fragmented')
      expect(canTrackBlueprint(early, id)).toBe(false)
      expect(canDropBlueprintFragment(early, id, 50)).toBe(false)
    }
  })

  it('wave-secure Heavy may fragment before W100, but pending sources never do', () => {
    const s = atFoundry(60)
    expect(canDropBlueprintFragment(s, 'heavy-lance', 60)).toBe(true)
    expect(canDropBlueprintFragment(s, 'heavy-lance', 50)).toBe(false)
    expect(canDropBlueprintFragment(s, 'rapid-aegis', 60)).toBe(false)
    expect(canDropBlueprintFragment(s, 'flak-array', 50)).toBe(true)
  })
})

describe('PR5 correction: UNKNOWN identity and tracking', () => {
  it('cannot track UNKNOWN, DISCOVERED, OWNED, or pending-source Blueprints', () => {
    const s = atFoundry(100)
    expect(blueprintLifecycle(s, 'rapid-aegis')).toBe('unknown')
    expect(setTrackedPrint(s, 'rapid-aegis')).toBe(s)
    expect(s.foundry.trackedPrintId).toBeNull()

    discoverBlueprint(s, 'heavy-lance')
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('discovered')
    expect(setTrackedPrint(s, 'heavy-lance')).toBe(s)

    expect(blueprintLifecycle(s, 'pulse-cannon')).toBe('owned')
    expect(setTrackedPrint(s, 'pulse-cannon')).toBe(s)
  })

  it('first valid fragment reveals the Blueprint and discovered clears tracking', () => {
    const s = atFoundry(100)
    grantBlueprintFragment(s, 'heavy-lance', 1)
    expect(blueprintLifecycle(s, 'heavy-lance')).toBe('fragmented')
    const tracked = setTrackedPrint(s, 'heavy-lance')
    expect(tracked.foundry.trackedPrintId).toBe('heavy-lance')
    discoverBlueprint(tracked, 'heavy-lance')
    expect(tracked.foundry.trackedPrintId).toBeNull()
    expect(canTrackBlueprint(tracked, 'heavy-lance')).toBe(false)
    expect(grantBlueprintFragment(tracked, 'heavy-lance', 1)).toBe(false)
    expect(canDropBlueprintFragment(tracked, 'heavy-lance', 100)).toBe(false)
  })

  it('stale invalid tracking is ignored by combat drops and tickFoundry', () => {
    const s = atFoundry(50)
    s.foundry.trackedPrintId = 'rapid-aegis'
    const drops = rollEnemyPartDrop(
      s,
      { family: 'swarm', isBoss: true, name: 'Boss', rewardWeight: 1, sourceWave: 50 },
      () => 0,
    )
    expect(drops.every((row) => row.blueprintId !== 'rapid-aegis')).toBe(true)
    expect(s.foundry.fragments['rapid-aegis'] ?? 0).toBe(0)
    tickFoundry(s, 0)
    expect(s.foundry.trackedPrintId).toBeNull()
  })
})

describe('PR5 correction: v46 malformed Foundry state', () => {
  it('sanitizes invalid fabrication jobs, Blueprint keys, and capabilities on load', () => {
    const raw = JSON.parse(JSON.stringify(atFoundry())) as ReturnType<typeof createInitialState>
    raw.version = SAVE_VERSION
    raw.foundry.fabrication = [
      { kind: 'core', jobId: 'made-up-core', progress: 0.9, paid: true },
    ]
    raw.foundry.fragments = { 'ghost-print': 4, 'heavy-lance': 2 }
    raw.foundry.discovered = ['made-up-frame', 'flak-array']
    raw.foundry.capabilities = ['god-mode', 'advanced-processing']
    raw.foundry.trackedPrintId = 'rapid-aegis'
    const loaded = importSave(encodeRaw(raw))
    expect(loaded).not.toBeNull()
    expect(loaded!.foundry.fabrication[0]).toEqual({
      kind: null,
      jobId: null,
      progress: 0,
      paid: false,
      targetRelicId: null,
    })
    expect(loaded!.foundry.fragments['ghost-print']).toBeUndefined()
    expect(loaded!.foundry.fragments['heavy-lance']).toBe(2)
    expect(loaded!.foundry.discovered).not.toContain('made-up-frame')
    expect(loaded!.foundry.discovered).toContain('flak-array')
    expect(loaded!.foundry.capabilities).toEqual(['advanced-processing'])
    expect(loaded!.foundry.trackedPrintId).toBeNull()
  })

  it('idle-sanitizes relic jobs and made-up facility/frame recipes', () => {
    const raw = JSON.parse(JSON.stringify(atFoundry())) as ReturnType<typeof createInitialState>
    raw.version = SAVE_VERSION
    raw.foundry.fabrication = [
      { kind: 'relic', jobId: 'any-relic', progress: 0.4, paid: true },
      { kind: 'facility', jobId: 'made-up-facility', progress: 1, paid: true },
      { kind: 'frame', jobId: 'made-up-frame', progress: 1, paid: true },
    ]
    const loaded = importSave(encodeRaw(raw))
    expect(loaded!.foundry.fabrication.every((slot) => slot.kind === null && slot.jobId === null && slot.paid === false)).toBe(
      true,
    )
  })

  it('runtime completion cannot fabricate arbitrary IDs', () => {
    const s = atFoundry()
    const coresBefore = [...(s.shipyard.coreInstances ?? [])]
    const framesBefore = [...(s.shipyard.unlockedFrames ?? [])]
    s.foundry.fabrication[0] = { kind: 'core', jobId: 'made-up-core', progress: 1, paid: true }
    tickFoundry(s, 1)
    expect(s.shipyard.coreInstances).toEqual(coresBefore)
    expect(s.foundry.fabrication[0]?.kind).toBeNull()

    s.foundry.fabrication[0] = { kind: 'frame', jobId: 'made-up-frame', progress: 1, paid: true }
    tickFoundry(s, 1)
    expect(s.shipyard.unlockedFrames).toEqual(framesBefore)

    s.foundry.fabrication[0] = { kind: 'facility', jobId: 'made-up-facility', progress: 1, paid: true }
    tickFoundry(s, 1)
    expect(s.foundry.facilities).not.toContain('made-up-facility')

    grantFoundryCapability(s, 'god-mode')
    expect(isFoundryCapabilityId('god-mode')).toBe(false)
    expect(s.foundry.capabilities).not.toContain('god-mode')
    s.foundry.capabilities = ['god-mode', 'advanced-processing']
    tickFoundry(s, 0)
    expect(s.foundry.capabilities).toEqual(['advanced-processing'])
  })
})

describe('PR5 correction: Workers and Research decoupling', () => {
  it('Worker Racks still raise capacity only', () => {
    let s = atFoundry()
    s.base.workerDrones = 6
    expect(ownedWorkers(s)).toBe(6)
    expect(workerCapacity(s)).toBe(6)
    s.resources.prestigeMatter = 200
    s = buyMatterShop(s, 'worker-racks')
    expect(workerCapacity(s)).toBe(7)
    expect(ownedWorkers(s)).toBe(6)
  })

  it('PR9 Drone Racks raises permanent Worker capacity', () => {
    const s = atFoundry(ACT1_CADENCE.research)
    s.base.workerDrones = 6
    const before = workerCapacity(s)
    s.hiveResearch.completedIds = ['d5-drone-racks']
    expect(hiveResearchDroneCapBonus(s)).toBe(2)
    expect(extraWorkerCapacityFromResearch(s)).toBe(2)
    expect(workerCapacity(s)).toBe(before + 2)
  })

  it('PR9 Second Processor adds a Foundry Processor', () => {
    const s = atFoundry(ACT1_CADENCE.research)
    expect(foundrySlotCount(s)).toBe(1)
    s.hiveResearch.completedIds = ['i1-second-processor']
    expect(hiveResearchFoundrySlots(s)).toBe(1)
    expect(foundrySlotCount(s)).toBe(2)
  })

  it('Research Annex does not modify legacy Research speed', () => {
    const s = atFoundry(ACT1_CADENCE.research)
    s.base.workerDrones = 4
    s.base.assignments['sensor-net'] = 4
    const base = hiveResearchSpeed(s)
    expect(base).toBeGreaterThan(0)
    s.foundry.facilities = ['research-annex']
    expect(researchAnnexSpeedMult(s)).toBe(1)
    expect(hiveResearchSpeed(s)).toBe(base)
  })
})

describe('PR5 correction: preserved canonical sources and persistence', () => {
  it('exact guaranteed Wave sources still complete design knowledge only', () => {
    const expected = [
      { wave: 50, id: 'flak-array' },
      { wave: 100, id: 'heavy-lance' },
      { wave: 150, id: 'grav-tether' },
      { wave: 200, id: 'slag-spitter' },
      { wave: 250, id: 'phase-beam' },
      { wave: 300, id: 'sensor-array' },
      { wave: 350, id: 'barrier-projector' },
      { wave: 500, id: 'reactor-frame' },
    ]
    expect(WAVE_SECURE_BLUEPRINTS).toEqual(expected.map((row) => ({ wave: row.wave, blueprintId: row.id })))
    for (const row of expected) {
      const s = atCareerWave(createInitialState(0), row.wave)
      applyWaveSecureBlueprintSources(s, row.wave, 'boss')
      expect(isBlueprintDiscovered(s, row.id)).toBe(true)
      if (row.id.endsWith('-frame')) {
        expect((s.shipyard.unlockedFrames ?? []).includes(row.id)).toBe(false)
      } else {
        expect((s.shipyard.coreInstances ?? []).some((core) => core.moduleId === row.id)).toBe(false)
      }
    }
  })

  it('physical Core fabrication still creates distinct instance IDs', () => {
    let s = atFoundry()
    discoverBlueprint(s, 'heavy-lance')
    s.foundry.materials['tempered-alloy'] = 40
    s.foundry.materials['ballistic-composite'] = 20
    s.foundry.materials['conductive-filament'] = 20
    s = startFabrication(s, 'core', 'heavy-lance')
    tickFoundry(s, 160)
    s = startFabrication(s, 'core', 'heavy-lance')
    tickFoundry(s, 160)
    const copies = (s.shipyard.coreInstances ?? []).filter((row) => row.moduleId === 'heavy-lance')
    expect(copies.map((row) => row.id).sort()).toEqual(['heavy-lance:1', 'heavy-lance:2'])
  })

  it('offline catch-up and Rebuild still persist Foundry jobs', () => {
    let s = atFoundry()
    s.resources.scrap = 80
    s = setFoundrySlot(s, 0, 'recovered-stock')
    s.lastTickAt = 0
    const encoded = exportSave(s)
    const { state: caught } = applyOfflineCatchUp(s, 60_000)
    expect(caught.foundry.materials['recovered-stock'] ?? 0).toBe(1)
    const loaded = importSave(encoded)!
    loaded.lastTickAt = 0
    const { state: resumed } = applyOfflineCatchUp(loaded, 60_000)
    expect(resumed.foundry.materials['recovered-stock'] ?? 0).toBe(1)

    let rebuilt = armRebuildDoor(atFoundry(ACT1_CADENCE.rebuild))
    rebuilt.foundry.materials['resonant-ceramic'] = 2
    rebuilt.foundry.masteryXp['recovered-stock'] = 8
    rebuilt.foundry.facilities = ['research-annex']
    rebuilt.base.workerDrones = 4
    rebuilt = performRebuild(rebuilt, { frameId: 'starter-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(rebuilt.foundry.materials['resonant-ceramic']).toBe(2)
    expect(rebuilt.foundry.masteryXp['recovered-stock']).toBe(8)
    expect(rebuilt.foundry.facilities).toEqual(['research-annex'])
    expect(ownedWorkers(rebuilt)).toBe(4)
  })
})
