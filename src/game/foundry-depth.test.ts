import { describe, expect, it } from 'vitest'
import {
  assembleBlueprint,
  buyFoundryUpgrade,
  canAssembleBlueprint,
  equipFoundryModule,
  performRebuild,
  setFoundrySlot,
} from './actions'
import { tickAutomation } from './automation'
import { BLUEPRINTS, partId } from './catalog'
import {
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  craftsForNextLevel,
  foundryAshHeatMult,
  canBuyFoundryUpgrade,
  foundryCostMult,
  foundryCraftOutput,
  foundryCraftTime,
  foundryFitSlots,
  foundryHasMaterialChain,
  foundryMasteryStepsFor,
  foundryNetworkFillMult,
  foundryPartDropMult,
  foundryQueueCap,
  foundryRecipeChainLine,
  foundryRecipeGateNeed,
  foundryResearchXpMult,
  foundryShardDropBonus,
  foundrySlotCount,
  foundryTimeMult,
  getFoundryRecipe,
  isFoundryInfinite,
  isFoundryModuleUnlocked,
  isFoundryRecipeUnlocked,
} from './foundry'
import { grantHiveResearchKillXp } from './hiveResearch'
import { inspectCopyCorpus, inspectFoundryRecipe } from './inspect'
import { networkFillRate } from './network'
import {
  FOUNDRY_V2_GUIDE_IDS,
  GUIDE_STEPS,
  NETWORK_GUIDE_IDS,
  STARTER_GUIDE_IDS,
  activeGuideStep,
  guideBodyLines,
  skipOnboarding,
} from './progression'
import { exportSave, importSave } from './save'
import { createInitialState, SAVE_VERSION } from './state'
import { advanceSeconds } from './tick'
import type { GameState } from './types'

const JARGON = /USI|ITRTG|analogue|black-bar/i

function atFoundry(sector = 6): GameState {
  const s = createInitialState(0)
  s.meta.highestSectorEver = sector
  s.combat.highestSector = sector
  return s
}

describe('Foundry depth: recipe chains', () => {
  it('keeps the original 12 recipes and adds six chained stock recipes', () => {
    const ids = FOUNDRY_RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(
      expect.arrayContaining([
        'slag-ingot',
        'filament',
        'hardened-plate',
        'relay',
        'choir-flux',
        'keel-strip',
        'focus-lens',
        'void-slag',
        'control-mesh',
        'warp-thread',
        'brace-pin',
        'slag-glass',
        'temper-bar',
        'coil-stack',
        'flux-weave',
        'hearth-core',
        'sight-lattice',
        'keel-lattice',
      ]),
    )
    expect(FOUNDRY_RECIPES).toHaveLength(18)
  })

  it('opens Temper Bar at sector 5 after Slag Ingot 4, as two-input stock', () => {
    const s = atFoundry(5)
    expect(isFoundryRecipeUnlocked(s, 'temper-bar')).toBe(false)
    s.foundry.recipeLevels['slag-ingot'] = 4
    expect(isFoundryRecipeUnlocked(s, 'temper-bar')).toBe(true)
    const def = getFoundryRecipe('temper-bar')!
    expect(def.costs.materials?.['slag-ingot']).toBe(3)
    expect(def.costs.materials?.filament).toBe(1)
    expect(foundryRecipeChainLine(def)).toMatch(/Slag Ingot/)
    expect(foundryHasMaterialChain(def)).toBe(true)
  })

  it('asks Keel Strip for plate as well as Choir Flux', () => {
    const s = atFoundry(8)
    s.foundry.recipeLevels['choir-flux'] = 4
    expect(isFoundryRecipeUnlocked(s, 'keel-strip')).toBe(true)
    expect(getFoundryRecipe('keel-strip')?.costs.materials?.['hardened-plate']).toBe(1)
    expect(getFoundryRecipe('keel-strip')?.costs.materials?.['choir-flux']).toBe(3)
  })

  it('asks Focus Lens for relay glass, and Control Mesh for a Coil Stack', () => {
    expect(getFoundryRecipe('focus-lens')?.costs.materials?.relay).toBe(3)
    expect(getFoundryRecipe('focus-lens')?.costs.materials?.['slag-glass']).toBe(1)
    expect(getFoundryRecipe('control-mesh')?.costs.materials?.['coil-stack']).toBe(1)
    expect(getFoundryRecipe('control-mesh')?.requiresRecipeLevel).toEqual({
      recipeId: 'focus-lens',
      level: 4,
    })
  })

  it('gates Coil Stack and Hearth Core on extra smelters', () => {
    const s = atFoundry(15)
    s.foundry.recipeLevels.relay = 4
    s.foundry.recipeLevels['void-slag'] = 4
    expect(foundrySlotCount(s)).toBe(1)
    expect(isFoundryRecipeUnlocked(s, 'coil-stack')).toBe(false)
    expect(isFoundryRecipeUnlocked(s, 'hearth-core')).toBe(false)
    s.foundry.upgrades['fp-slot'] = 1
    expect(isFoundryRecipeUnlocked(s, 'coil-stack')).toBe(true)
    expect(isFoundryRecipeUnlocked(s, 'hearth-core')).toBe(false)
    s.foundry.upgrades['fp-slot-2'] = 1
    expect(foundrySlotCount(s)).toBe(3)
    expect(isFoundryRecipeUnlocked(s, 'hearth-core')).toBe(true)
  })
})

describe('Foundry depth: mastery milestones', () => {
  it('keeps time, cost, and output identity before the first milestone', () => {
    const s = atFoundry()
    expect(foundryTimeMult(0)).toBe(1)
    expect(foundryTimeMult(3)).toBeCloseTo(1 - 0.025 * 3)
    expect(foundryTimeMult(4)).toBeLessThan(foundryTimeMult(3) * 0.9)
    expect(foundryCostMult(0)).toBe(1)
    expect(foundryCostMult(11)).toBeCloseTo(1 - 0.03 * 11)
    expect(foundryCostMult(12)).toBeLessThan(foundryCostMult(11) * 0.9)
    expect(foundryCraftOutput(s, 'slag-ingot')).toBe(1)
    expect(craftsForNextLevel(0)).toBe(craftsForNextLevel(0, s))
  })

  it('applies speed, output, efficiency, FP, then solved at recipe max', () => {
    const slag = getFoundryRecipe('slag-ingot')!
    const steps = foundryMasteryStepsFor(slag)
    expect(steps.map((st) => [st.at, st.kind])).toEqual([
      [4, 'speed'],
      [8, 'output'],
      [12, 'efficiency'],
      [16, 'fp'],
      [20, 'infinite'],
    ])

    const s = atFoundry()
    s.foundry.recipeLevels['slag-ingot'] = 8
    expect(foundryCraftOutput(s, 'slag-ingot')).toBe(2)
    s.foundry.recipeLevels['slag-ingot'] = 16
    expect(foundryCraftOutput(s, 'slag-ingot')).toBe(3)
    expect(isFoundryInfinite(s, 'slag-ingot')).toBe(false)

    const late = foundryMasteryStepsFor(getFoundryRecipe('hearth-core')!)
    expect(late[late.length - 1]).toMatchObject({ at: 18, kind: 'infinite' })
    const keel = foundryMasteryStepsFor(getFoundryRecipe('keel-lattice')!)
    expect(keel[keel.length - 1]).toMatchObject({ at: 16, kind: 'infinite' })
  })

  it('yields extra pieces after the output milestone', () => {
    const s = atFoundry()
    s.foundry.recipeLevels['slag-ingot'] = 8
    s.resources.salvage = 80
    s.foundry.materials['slag-ingot'] = 0
    const queued = setFoundrySlot(s, 0, 'slag-ingot')
    advanceSeconds(queued, foundryCraftTime(queued, 'slag-ingot') + 0.05)
    expect(queued.foundry.materials['slag-ingot'] ?? 0).toBe(2)
  })

  it('marks solved stock infinite and refuses to queue it', () => {
    const s = atFoundry()
    s.foundry.recipeLevels['slag-ingot'] = 20
    s.foundry.infinite = ['slag-ingot']
    expect(isFoundryInfinite(s, 'slag-ingot')).toBe(true)
    expect(setFoundrySlot(s, 0, 'slag-ingot').foundry.slots[0]?.recipeId).toBeNull()
    s.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: true }
    advanceSeconds(s, 1)
    expect(s.foundry.slots[0]?.recipeId).toBeNull()
  })
})

describe('Foundry depth: Foundry Point ranks', () => {
  it('adds shop-floor ranks instead of only combat percents', () => {
    const ids = FOUNDRY_UPGRADES.map((u) => u.id)
    for (const id of [
      'fp-xp',
      'fp-output',
      'fp-mastery',
      'fp-network',
      'fp-ash',
      'fp-research',
      'fp-reliquary',
      'fp-print',
      'fp-queue',
      'fp-fit',
    ]) {
      expect(ids).toContain(id)
    }
    expect(FOUNDRY_UPGRADES.some((u) => u.id === 'fp-damage' && u.damageBonus === 0.04)).toBe(true)
  })

  it('Shop Floor shortens crafts-to-next without changing rank 0', () => {
    const s = atFoundry()
    const base = craftsForNextLevel(10, s)
    s.foundry.upgrades['fp-xp'] = 2
    expect(craftsForNextLevel(10, s)).toBeLessThan(base)
    expect(craftsForNextLevel(10)).toBe(base)
  })

  it('Yield Press adds output; Pattern Memory opens gates sooner', () => {
    const s = atFoundry(6)
    s.foundry.recipeLevels['slag-ingot'] = 3
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(false)
    s.foundry.upgrades['fp-mastery'] = 3
    expect(foundryRecipeGateNeed(s, 4)).toBe(1)
    expect(isFoundryRecipeUnlocked(s, 'hardened-plate')).toBe(true)
    s.foundry.recipeLevels['slag-ingot'] = 5
    s.foundry.upgrades['fp-output'] = 1
    expect(foundryCraftOutput(s, 'slag-ingot')).toBe(2)
  })

  it('gates later shop-floor ranks on career sector', () => {
    const early = atFoundry(2)
    early.foundry.points = 40
    expect(canBuyFoundryUpgrade(early, 'fp-output').ok).toBe(false)
    expect(canBuyFoundryUpgrade(early, 'fp-xp').ok).toBe(true)
    const mid = atFoundry(4)
    mid.foundry.points = 40
    expect(canBuyFoundryUpgrade(mid, 'fp-output').ok).toBe(true)
    const bought = buyFoundryUpgrade(mid, 'fp-output')
    expect(bought.foundry.upgrades['fp-output']).toBe(1)
  })

  it('hooks Network, Ash, Research, Reliquary, prints, queue, and fit', () => {
    const s = atFoundry(10)
    expect(foundryNetworkFillMult(s)).toBe(1)
    expect(foundryAshHeatMult(s)).toBe(1)
    expect(foundryResearchXpMult(s)).toBe(1)
    expect(foundryShardDropBonus(s)).toBe(0)
    expect(foundryPartDropMult(s)).toBe(1)
    expect(foundryQueueCap(s)).toBe(3)
    expect(foundryFitSlots(s)).toBe(2)

    s.foundry.upgrades['fp-network'] = 2
    s.foundry.upgrades['fp-ash'] = 1
    s.foundry.upgrades['fp-research'] = 2
    s.foundry.upgrades['fp-reliquary'] = 1
    s.foundry.upgrades['fp-print'] = 1
    s.foundry.upgrades['fp-queue'] = 2
    s.foundry.upgrades['fp-fit'] = 1
    expect(foundryNetworkFillMult(s)).toBeCloseTo(1.06)
    expect(foundryAshHeatMult(s)).toBeCloseTo(1.04)
    expect(foundryResearchXpMult(s)).toBeCloseTo(1.1)
    expect(foundryShardDropBonus(s)).toBeCloseTo(0.02)
    expect(foundryPartDropMult(s)).toBeCloseTo(1.08)
    expect(foundryQueueCap(s)).toBe(9)
    expect(foundryFitSlots(s)).toBe(3)

    s.base.workerDrones = 1
    s.base.assignments.strike = 1
    const plain = atFoundry(10)
    plain.base.workerDrones = 1
    plain.base.assignments.strike = 1
    expect(networkFillRate(s, 'strike')).toBeGreaterThan(networkFillRate(plain, 'strike'))

    s.meta.highestSectorEver = 34
    s.combat.highestSector = 34
    s.combat.sector = 34
    const xp = grantHiveResearchKillXp(s, false)
    const plainR = atFoundry(34)
    plainR.combat.sector = 34
    const xp0 = grantHiveResearchKillXp(plainR, false)
    expect(xp).toBeGreaterThan(xp0)
  })

  it('Cold Foundry mutes the new shop-floor multipliers', () => {
    const s = atFoundry(10)
    s.foundry.upgrades['fp-xp'] = 4
    s.foundry.upgrades['fp-network'] = 5
    s.foundry.upgrades['fp-ash'] = 5
    s.foundry.upgrades['fp-fit'] = 1
    s.protocols.activeId = 'cold-foundry'
    expect(foundryNetworkFillMult(s)).toBe(1)
    expect(foundryAshHeatMult(s)).toBe(1)
    expect(foundryFitSlots(s)).toBe(2)
    expect(craftsForNextLevel(10, s)).toBe(craftsForNextLevel(10))
  })
})

describe('Foundry depth: modules and Core prints', () => {
  it('opens the first fitted bits after the first Slag / Filament mastery', () => {
    expect(getFoundryRecipe('slag-ingot')?.unlocksRecipe).toEqual({
      recipeId: 'hardened-plate',
      atLevel: 4,
    })
    expect(getFoundryRecipe('hardened-plate')?.requiresRecipeLevel).toEqual({
      recipeId: 'slag-ingot',
      level: 4,
    })
    const liner = FOUNDRY_MODULES.find((m) => m.id === 'slag-liner')!
    const coil = FOUNDRY_MODULES.find((m) => m.id === 'relay-coil')!
    expect(liner.cost['hardened-plate']).toBe(3)
    expect(coil.cost.relay).toBe(3)
    let crafts = 0
    for (let level = 0; level < 4; level++) crafts += craftsForNextLevel(level)
    expect(crafts).toBeLessThanOrEqual(16)
  })

  it('prints later bits from the new chain recipes', () => {
    expect(FOUNDRY_MODULES.some((m) => m.id === 'temper-sleeve')).toBe(true)
    expect(FOUNDRY_MODULES.some((m) => m.id === 'hearth-plate')).toBe(true)
    const s = atFoundry(5)
    expect(isFoundryModuleUnlocked(s, 'temper-sleeve')).toBe(false)
    s.foundry.recipeLevels['temper-bar'] = 1
    expect(isFoundryModuleUnlocked(s, 'temper-sleeve')).toBe(true)
    s.foundry.materials['temper-bar'] = 5
    s.combat.docked = true
    const fitted = equipFoundryModule(s, 'temper-sleeve')
    expect(fitted.foundry.equipped).toContain('temper-sleeve')
  })

  it('asks Choir Tap for a Hearth Core and Void Slag mastery', () => {
    const recipe = BLUEPRINTS.find((b) => b.moduleId === 'choir-tap')!
    expect(recipe.foundry?.['hearth-core']).toBe(1)
    expect(recipe.requiresRecipeLevel).toEqual({ recipeId: 'void-slag', level: 1 })

    const s = atFoundry(18)
    s.combat.sector = 18
    s.parts = {
      [partId('choir-tap', 'casing')]: recipe.casing,
      [partId('choir-tap', 'core')]: recipe.core,
      [partId('choir-tap', 'lens')]: recipe.lens,
    }
    expect(canAssembleBlueprint(s, 'choir-tap').reason).toBe('Need more Foundry mastery')
    s.foundry.recipeLevels['void-slag'] = 1
    expect(canAssembleBlueprint(s, 'choir-tap').reason).toBe('Need Foundry stock')
    s.foundry.materials['hearth-core'] = 1
    expect(canAssembleBlueprint(s, 'choir-tap').ok).toBe(true)
    const printed = assembleBlueprint(s, 'choir-tap')
    expect(printed.shipyard.unlockedModules).toContain('choir-tap')
    expect(printed.foundry.materials['hearth-core'] ?? 0).toBe(0)
  })

  it('asks Nano Lathe for Brace Pins without changing Charge Prism', () => {
    expect(BLUEPRINTS.find((b) => b.moduleId === 'nano-lathe')?.foundry?.['brace-pin']).toBe(2)
    expect(BLUEPRINTS.find((b) => b.moduleId === 'charge-prism')?.foundry).toBeUndefined()
  })
})

describe('Foundry depth: Process automation', () => {
  it('walks precursor stock toward a pinned target', () => {
    const s = atFoundry(5)
    s.process.purchased = ['smart-smelt', 'foundry-queue', 'foundry-prereqs']
    s.process.config.foundry.targetRecipe = 'temper-bar'
    s.foundry.recipeLevels['slag-ingot'] = 4
    s.foundry.materials.filament = 4
    s.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBe('slag-ingot')
  })

  it('honours Queue Rack capacity before Smart Smelt', () => {
    const s = atFoundry(3)
    s.process.purchased = ['foundry-queue']
    s.process.config.foundry.queue = ['filament', 'slag-ingot', 'filament', 'slag-ingot']
    s.foundry.infinite = ['filament']
    s.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(s)
    expect(s.foundry.slots[0]?.recipeId).toBe('slag-ingot')

    const wide = atFoundry(3)
    wide.process.purchased = ['foundry-queue']
    wide.foundry.upgrades['fp-queue'] = 1
    expect(foundryQueueCap(wide)).toBe(6)
    wide.process.config.foundry.queue = [
      'filament',
      'filament',
      'filament',
      'slag-ingot',
    ]
    wide.foundry.infinite = ['filament']
    wide.foundry.slots[0] = { recipeId: null, progress: 0, paid: false }
    tickAutomation(wide)
    expect(wide.foundry.slots[0]?.recipeId).toBe('slag-ingot')
  })
})

describe('Foundry depth: Rebuild, save, onboarding', () => {
  it('keeps save version 34', () => {
    expect(SAVE_VERSION).toBe(34)
  })

  it('Rebuild keeps chain mastery, points, and solved stock, not fitted bits', () => {
    let s = atFoundry(12)
    s.combat.sector = 12
    s.foundry.recipeLevels['temper-bar'] = 6
    s.foundry.materials['temper-bar'] = 8
    s.foundry.points = 11
    s.foundry.upgrades['fp-xp'] = 1
    s.foundry.infinite = ['slag-ingot']
    s.combat.docked = true
    s = equipFoundryModule(s, 'temper-sleeve')
    expect(s.foundry.equipped).toContain('temper-sleeve')
    s = performRebuild(s, { frameId: 'scout-frame', modules: ['pulse-cannon', 'plate-layer'] })
    expect(s.foundry.equipped).toEqual([])
    expect(s.foundry.recipeLevels['temper-bar']).toBe(6)
    expect(s.foundry.points).toBe(11)
    expect(s.foundry.upgrades['fp-xp']).toBe(1)
    expect(s.foundry.infinite).toContain('slag-ingot')
    expect(s.foundry.materials['temper-bar']).toBe(3)
  })

  it('round-trips new recipe ids and shop-floor ranks through save', () => {
    const s = atFoundry(9)
    s.foundry.recipeLevels['coil-stack'] = 3
    s.foundry.upgrades['fp-queue'] = 1
    s.foundry.infinite = ['filament']
    s.foundry.trackedPrintId = 'heavy-lance'
    const loaded = importSave(exportSave(s))
    expect(loaded?.foundry.recipeLevels['coil-stack']).toBe(3)
    expect(loaded?.foundry.upgrades['fp-queue']).toBe(1)
    expect(loaded?.foundry.infinite).toContain('filament')
    expect(loaded?.foundry.trackedPrintId).toBe('heavy-lance')
    expect(foundryQueueCap(loaded!)).toBe(6)
  })

  it('teaches Foundry with a single Slag Ingot action', () => {
    const s = atFoundry()
    s.meta.seenOnboarding = [...STARTER_GUIDE_IDS, ...NETWORK_GUIDE_IDS]
    expect(activeGuideStep(s, 'foundry')?.id).toBe('guide-foundry-recipe')
    const skipped = skipOnboarding(s, 'guide-foundry-recipe')
    for (const id of FOUNDRY_V2_GUIDE_IDS) {
      expect(skipped.meta.seenOnboarding).toContain(id)
    }
    expect(activeGuideStep(skipped, 'foundry')).toBeNull()
  })

  it('does not tour mastery milestones, chains, or Process queues', () => {
    const ids = new Set(GUIDE_STEPS.map((g) => g.id))
    for (const id of ['guide-foundry-what', 'guide-foundry-chain', 'guide-foundry-solved', 'guide-foundry-queue']) {
      expect(ids.has(id)).toBe(false)
    }
  })

  it('keeps Foundry inspect and guide copy free of designer jargon', () => {
    const s = atFoundry(8)
    s.foundry.recipeLevels['slag-ingot'] = 8
    const blob = [
      inspectCopyCorpus(s).join('\n'),
      inspectFoundryRecipe(s, 'temper-bar')?.body.join('\n') ?? '',
      GUIDE_STEPS.filter((g) => g.id.startsWith('guide-foundry'))
        .flatMap((g) => [g.title, ...guideBodyLines(g)])
        .join('\n'),
    ].join('\n')
    expect(blob).not.toMatch(JARGON)
  })
})
