/** Foundry — USI Synth analogue. Recipes, smelter slots, Foundry Points, equippable bits. */

import type { FoundryRecipeId, FoundrySlot, FoundryState, GameState } from './types'
import { networkManufactureMult } from './network'
import { reliquaryFoundrySpeedMult } from './reliquary'
import { furnaceFoundrySpeedMult } from './furnace'
import { hiveResearchFoundrySpeedMult } from './hiveResearch'
import { protocolBonusMult, protocolModifiers, protocolMutes } from './protocols'
import { echoFoundrySpeedMult } from './echo'
import { processFoundrySpeedMult } from './process'
import {
  foundryExtraFitSlots,
  foundryGlobalOutputAdd,
  foundryMasteryGateReduce,
  foundryXpMult,
} from './foundryBonuses'

export {
  foundryAshHeatMult,
  foundryNetworkFillMult,
  foundryPartDropMult,
  foundryQueueCap,
  foundryResearchXpMult,
  foundryShardDropBonus,
  foundryXpMult,
} from './foundryBonuses'

export interface FoundryCost {
  salvage?: number
  scrap?: number
  materials?: Partial<Record<FoundryRecipeId, number>>
}

export interface FoundryRecipeDef {
  id: FoundryRecipeId
  name: string
  blurb: string
  maxLevel: number
  craftTime: number
  costs: FoundryCost
  requiresSectorEver: number
  requiresRecipeLevel?: { recipeId: FoundryRecipeId; level: number }
  /** Need this many smelters unlocked before the recipe opens. */
  requiresSlots?: number
  unlocksRecipe?: { recipeId: FoundryRecipeId; atLevel: number }
}

export interface FoundryUpgradeDef {
  id: string
  name: string
  blurb: string
  baseCost: number
  maxRank: number
  extraSlots?: number
  extraFitSlots?: number
  damageBonus?: number
  shieldBonus?: number
  speedBonus?: number
  salvageBonus?: number
  xpBonus?: number
  outputAdd?: number
  masteryReduce?: number
  networkFillBonus?: number
  ashHeatBonus?: number
  researchXpBonus?: number
  shardDropBonus?: number
  partDropBonus?: number
  queueBonus?: number
  requiresSectorEver?: number
}

export interface FoundryModuleDef {
  id: string
  name: string
  blurb: string
  cost: Partial<Record<FoundryRecipeId, number>>
  requiresRecipeLevel: { recipeId: FoundryRecipeId; level: number }
  damageMult?: number
  shieldFlat?: number
}

export const FOUNDRY_STARTING_SLOTS = 1
export const FOUNDRY_MAX_SLOTS = 4
export const FOUNDRY_MODULE_SLOTS = 2

export const FOUNDRY_RECIPES: FoundryRecipeDef[] = [
  {
    id: 'slag-ingot',
    name: 'Slag Ingot',
    blurb: 'Salvage smelted into stock plate. Later recipes eat these.',
    maxLevel: 20,
    craftTime: 8,
    costs: { salvage: 16 },
    requiresSectorEver: 2,
    unlocksRecipe: { recipeId: 'hardened-plate', atLevel: 8 },
  },
  {
    id: 'filament',
    name: 'Filament',
    blurb: 'Drawn scrap wire for relays and pins.',
    maxLevel: 20,
    craftTime: 8,
    costs: { scrap: 6 },
    requiresSectorEver: 2,
    unlocksRecipe: { recipeId: 'relay', atLevel: 4 },
  },
  {
    id: 'temper-bar',
    name: 'Temper Bar',
    blurb: 'Ingot and wire pressed together. First two-input stock.',
    maxLevel: 20,
    craftTime: 10,
    costs: { materials: { 'slag-ingot': 3, filament: 1 } },
    requiresSectorEver: 5,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 4 },
  },
  {
    id: 'hardened-plate',
    name: 'Hardened Plate',
    blurb: 'Pressed ingots. Feeds Slag Liner and later flux work.',
    maxLevel: 20,
    craftTime: 12,
    costs: { materials: { 'slag-ingot': 4 } },
    requiresSectorEver: 2,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 8 },
    unlocksRecipe: { recipeId: 'void-slag', atLevel: 8 },
  },
  {
    id: 'relay',
    name: 'Relay',
    blurb: 'Wound filament. Feeds Relay Coil and later glass.',
    maxLevel: 20,
    craftTime: 12,
    costs: { materials: { filament: 3 } },
    requiresSectorEver: 2,
    requiresRecipeLevel: { recipeId: 'filament', level: 4 },
    unlocksRecipe: { recipeId: 'focus-lens', atLevel: 6 },
  },
  {
    id: 'brace-pin',
    name: 'Brace Pin',
    blurb: 'Pinned ingot and wire. Feeds Pin Brace.',
    maxLevel: 20,
    craftTime: 11,
    costs: { materials: { 'slag-ingot': 2, filament: 2 } },
    requiresSectorEver: 6,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 4 },
  },
  {
    id: 'choir-flux',
    name: 'Choir Flux',
    blurb: 'Condensed wreck vapour. Feeds Keel Strip.',
    maxLevel: 20,
    craftTime: 14,
    costs: { salvage: 22, scrap: 8 },
    requiresSectorEver: 8,
    unlocksRecipe: { recipeId: 'keel-strip', atLevel: 4 },
  },
  {
    id: 'coil-stack',
    name: 'Coil Stack',
    blurb: 'Relays bundled on filament. Needs a second smelter.',
    maxLevel: 20,
    craftTime: 13,
    costs: { materials: { relay: 2, filament: 2 } },
    requiresSectorEver: 9,
    requiresRecipeLevel: { recipeId: 'relay', level: 4 },
    requiresSlots: 2,
  },
  {
    id: 'keel-strip',
    name: 'Keel Strip',
    blurb: 'Flux pressed over plate. Two precursors.',
    maxLevel: 20,
    craftTime: 16,
    costs: { materials: { 'choir-flux': 3, 'hardened-plate': 1 } },
    requiresSectorEver: 8,
    requiresRecipeLevel: { recipeId: 'choir-flux', level: 4 },
    unlocksRecipe: { recipeId: 'warp-thread', atLevel: 4 },
  },
  {
    id: 'slag-glass',
    name: 'Slag Glass',
    blurb: 'Drawn relay glass. Feeds Glass Sight.',
    maxLevel: 20,
    craftTime: 13,
    costs: { materials: { filament: 2, relay: 2 } },
    requiresSectorEver: 10,
    requiresRecipeLevel: { recipeId: 'relay', level: 4 },
  },
  {
    id: 'flux-weave',
    name: 'Flux Weave',
    blurb: 'Plate and flux laminated. Needs a second smelter.',
    maxLevel: 20,
    craftTime: 15,
    costs: { materials: { 'choir-flux': 2, 'hardened-plate': 2 } },
    requiresSectorEver: 11,
    requiresRecipeLevel: { recipeId: 'choir-flux', level: 4 },
    requiresSlots: 2,
  },
  {
    id: 'focus-lens',
    name: 'Focus Lens',
    blurb: 'Ground relay glass. Feeds Focus Array.',
    maxLevel: 20,
    craftTime: 14,
    costs: { materials: { relay: 3, 'slag-glass': 1 } },
    requiresSectorEver: 12,
    requiresRecipeLevel: { recipeId: 'relay', level: 6 },
    unlocksRecipe: { recipeId: 'control-mesh', atLevel: 4 },
  },
  {
    id: 'void-slag',
    name: 'Void Slag',
    blurb: 'Re-smelted plate. Feeds Void Liner.',
    maxLevel: 20,
    craftTime: 16,
    costs: { materials: { 'hardened-plate': 3 } },
    requiresSectorEver: 14,
    requiresRecipeLevel: { recipeId: 'hardened-plate', level: 8 },
  },
  {
    id: 'hearth-core',
    name: 'Hearth Core',
    blurb: 'Void slag, keel, and temper stock. Needs three smelters.',
    maxLevel: 18,
    craftTime: 18,
    costs: { materials: { 'void-slag': 2, 'keel-strip': 2, 'temper-bar': 1 } },
    requiresSectorEver: 15,
    requiresRecipeLevel: { recipeId: 'void-slag', level: 4 },
    requiresSlots: 3,
  },
  {
    id: 'sight-lattice',
    name: 'Sight Lattice',
    blurb: 'Glass and lenses stacked. Needs a second smelter.',
    maxLevel: 18,
    craftTime: 17,
    costs: { materials: { 'slag-glass': 2, 'focus-lens': 2 } },
    requiresSectorEver: 16,
    requiresRecipeLevel: { recipeId: 'focus-lens', level: 4 },
    requiresSlots: 2,
  },
  {
    id: 'control-mesh',
    name: 'Control Mesh',
    blurb: 'Woven lenses and coil. Feeds Mesh Brace.',
    maxLevel: 18,
    craftTime: 18,
    costs: { materials: { 'focus-lens': 3, 'coil-stack': 1 } },
    requiresSectorEver: 19,
    requiresRecipeLevel: { recipeId: 'focus-lens', level: 4 },
  },
  {
    id: 'warp-thread',
    name: 'Warp Thread',
    blurb: 'Keel fibre for Echo-side crafts. Feeds Warp Keel.',
    maxLevel: 18,
    craftTime: 20,
    costs: { materials: { 'keel-strip': 3, 'choir-flux': 2 } },
    requiresSectorEver: 22,
    requiresRecipeLevel: { recipeId: 'keel-strip', level: 4 },
  },
  {
    id: 'keel-lattice',
    name: 'Keel Lattice',
    blurb: 'Warp, mesh, and hearth stock. Needs three smelters.',
    maxLevel: 16,
    craftTime: 22,
    costs: { materials: { 'warp-thread': 2, 'control-mesh': 1, 'hearth-core': 1 } },
    requiresSectorEver: 22,
    requiresRecipeLevel: { recipeId: 'warp-thread', level: 4 },
    requiresSlots: 3,
  },
]

export const FOUNDRY_UPGRADES: FoundryUpgradeDef[] = [
  {
    id: 'fp-damage',
    name: 'Foundry Strike',
    blurb: '+4% sortie damage per rank',
    baseCost: 2,
    maxRank: 10,
    damageBonus: 0.04,
  },
  {
    id: 'fp-shield',
    name: 'Foundry Ward',
    blurb: '+4% max shield per rank',
    baseCost: 2,
    maxRank: 10,
    shieldBonus: 0.04,
  },
  {
    id: 'fp-speed',
    name: 'Smelt Speed',
    blurb: '+8% craft speed per rank',
    baseCost: 2,
    maxRank: 10,
    speedBonus: 0.08,
  },
  {
    id: 'fp-slot',
    name: 'Second Smelter',
    blurb: 'One extra Foundry slot',
    baseCost: 8,
    maxRank: 1,
    extraSlots: 1,
  },
  {
    id: 'fp-slot-2',
    name: 'Third Smelter',
    blurb: 'One extra Foundry slot',
    baseCost: 18,
    maxRank: 1,
    extraSlots: 1,
  },
  {
    id: 'fp-slot-3',
    name: 'Fourth Smelter',
    blurb: 'One extra Foundry slot. Four smelters is the cap.',
    baseCost: 32,
    maxRank: 1,
    extraSlots: 1,
  },
  {
    id: 'fp-salvage',
    name: 'Foundry Hold',
    blurb: '+3% salvage per rank',
    baseCost: 3,
    maxRank: 10,
    salvageBonus: 0.03,
  },
  {
    id: 'fp-xp',
    name: 'Shop Floor',
    blurb: 'Recipes need fewer crafts per mastery rank.',
    baseCost: 4,
    maxRank: 4,
    xpBonus: 0.15,
  },
  {
    id: 'fp-output',
    name: 'Yield Press',
    blurb: '+1 piece per finished craft, each rank.',
    baseCost: 8,
    maxRank: 2,
    outputAdd: 1,
    requiresSectorEver: 4,
  },
  {
    id: 'fp-mastery',
    name: 'Pattern Memory',
    blurb: 'Recipe mastery gates open 1 rank sooner per rank.',
    baseCost: 6,
    maxRank: 3,
    masteryReduce: 1,
    requiresSectorEver: 6,
  },
  {
    id: 'fp-network',
    name: 'Loom Coupling',
    blurb: 'Assigned drones fill Network bars a little faster.',
    baseCost: 4,
    maxRank: 5,
    networkFillBonus: 0.03,
    requiresSectorEver: 4,
  },
  {
    id: 'fp-ash',
    name: 'Flue Catch',
    blurb: 'Choir-ash makes Heat a little faster.',
    baseCost: 4,
    maxRank: 5,
    ashHeatBonus: 0.04,
    requiresSectorEver: 5,
  },
  {
    id: 'fp-research',
    name: 'Lab Feed',
    blurb: 'Kill Research XP climbs a little faster.',
    baseCost: 5,
    maxRank: 4,
    researchXpBonus: 0.05,
    requiresSectorEver: 7,
  },
  {
    id: 'fp-reliquary',
    name: 'Shard Press',
    blurb: 'Wrecks drop shards a little more often.',
    baseCost: 5,
    maxRank: 4,
    shardDropBonus: 0.02,
    requiresSectorEver: 3,
  },
  {
    id: 'fp-print',
    name: 'Print Feed',
    blurb: 'Wrecks drop Core print fragments a little more often.',
    baseCost: 5,
    maxRank: 4,
    partDropBonus: 0.08,
    requiresSectorEver: 4,
  },
  {
    id: 'fp-queue',
    name: 'Queue Rack',
    blurb: 'Process Production Queue can hold 3 more recipes per rank.',
    baseCost: 6,
    maxRank: 2,
    queueBonus: 3,
    requiresSectorEver: 3,
  },
  {
    id: 'fp-fit',
    name: 'Fit Rack',
    blurb: 'One extra fitted Foundry bit.',
    baseCost: 20,
    maxRank: 1,
    extraFitSlots: 1,
    requiresSectorEver: 10,
  },
]

export const FOUNDRY_MODULES: FoundryModuleDef[] = [
  {
    id: 'slag-liner',
    name: 'Slag Liner',
    blurb: '+12 max shield',
    cost: { 'hardened-plate': 5 },
    requiresRecipeLevel: { recipeId: 'hardened-plate', level: 1 },
    shieldFlat: 12,
  },
  {
    id: 'relay-coil',
    name: 'Relay Coil',
    blurb: '×1.10 sortie damage',
    cost: { relay: 5 },
    requiresRecipeLevel: { recipeId: 'relay', level: 1 },
    damageMult: 1.1,
  },
  {
    id: 'keel-brace',
    name: 'Keel Brace',
    blurb: '+20 max shield · ×1.06 damage',
    cost: { 'keel-strip': 4 },
    requiresRecipeLevel: { recipeId: 'keel-strip', level: 1 },
    shieldFlat: 20,
    damageMult: 1.06,
  },
  {
    id: 'focus-array',
    name: 'Focus Array',
    blurb: '×1.08 sortie damage',
    cost: { 'focus-lens': 5 },
    requiresRecipeLevel: { recipeId: 'focus-lens', level: 1 },
    damageMult: 1.08,
  },
  {
    id: 'void-liner',
    name: 'Void Liner',
    blurb: '+28 max shield',
    cost: { 'void-slag': 5 },
    requiresRecipeLevel: { recipeId: 'void-slag', level: 1 },
    shieldFlat: 28,
  },
  {
    id: 'mesh-brace',
    name: 'Mesh Brace',
    blurb: '+16 max shield · ×1.08 damage',
    cost: { 'control-mesh': 4 },
    requiresRecipeLevel: { recipeId: 'control-mesh', level: 1 },
    shieldFlat: 16,
    damageMult: 1.08,
  },
  {
    id: 'warp-keel',
    name: 'Warp Keel',
    blurb: '+24 max shield · ×1.10 damage',
    cost: { 'warp-thread': 4 },
    requiresRecipeLevel: { recipeId: 'warp-thread', level: 1 },
    shieldFlat: 24,
    damageMult: 1.1,
  },
  {
    id: 'pin-brace',
    name: 'Pin Brace',
    blurb: '+10 max shield · ×1.04 damage',
    cost: { 'brace-pin': 5 },
    requiresRecipeLevel: { recipeId: 'brace-pin', level: 1 },
    shieldFlat: 10,
    damageMult: 1.04,
  },
  {
    id: 'glass-sight',
    name: 'Glass Sight',
    blurb: '×1.07 sortie damage',
    cost: { 'slag-glass': 5 },
    requiresRecipeLevel: { recipeId: 'slag-glass', level: 1 },
    damageMult: 1.07,
  },
  {
    id: 'temper-sleeve',
    name: 'Temper Sleeve',
    blurb: '+8 max shield · ×1.04 damage',
    cost: { 'temper-bar': 5 },
    requiresRecipeLevel: { recipeId: 'temper-bar', level: 1 },
    shieldFlat: 8,
    damageMult: 1.04,
  },
  {
    id: 'coil-rack',
    name: 'Coil Rack',
    blurb: '×1.07 sortie damage',
    cost: { 'coil-stack': 5 },
    requiresRecipeLevel: { recipeId: 'coil-stack', level: 1 },
    damageMult: 1.07,
  },
  {
    id: 'flux-wrap',
    name: 'Flux Wrap',
    blurb: '+18 max shield',
    cost: { 'flux-weave': 5 },
    requiresRecipeLevel: { recipeId: 'flux-weave', level: 1 },
    shieldFlat: 18,
  },
  {
    id: 'hearth-plate',
    name: 'Hearth Plate',
    blurb: '+22 max shield · ×1.06 damage',
    cost: { 'hearth-core': 4 },
    requiresRecipeLevel: { recipeId: 'hearth-core', level: 1 },
    shieldFlat: 22,
    damageMult: 1.06,
  },
  {
    id: 'lattice-sight',
    name: 'Lattice Sight',
    blurb: '×1.09 sortie damage',
    cost: { 'sight-lattice': 4 },
    requiresRecipeLevel: { recipeId: 'sight-lattice', level: 1 },
    damageMult: 1.09,
  },
  {
    id: 'lattice-keel',
    name: 'Lattice Keel',
    blurb: '+30 max shield · ×1.08 damage',
    cost: { 'keel-lattice': 3 },
    requiresRecipeLevel: { recipeId: 'keel-lattice', level: 1 },
    shieldFlat: 30,
    damageMult: 1.08,
  },
]

export function createEmptyFoundryState(): FoundryState {
  return {
    recipeLevels: {},
    recipeXp: {},
    materials: {},
    infinite: [],
    points: 0,
    upgrades: {},
    slots: [emptySlot()],
    equipped: [],
  }
}

function emptySlot(): FoundrySlot {
  return { recipeId: null, progress: 0, paid: false }
}

function careerEver(state: GameState): number {
  return Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
}

export function getFoundryRecipe(id: string): FoundryRecipeDef | undefined {
  return FOUNDRY_RECIPES.find((r) => r.id === id)
}

export function getFoundryUpgrade(id: string): FoundryUpgradeDef | undefined {
  return FOUNDRY_UPGRADES.find((u) => u.id === id)
}

export function getFoundryModule(id: string): FoundryModuleDef | undefined {
  return FOUNDRY_MODULES.find((m) => m.id === id)
}

export function foundryRecipeLevel(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.foundry?.recipeLevels[id] ?? 0))
}

export function isFoundryInfinite(state: GameState, id: string): boolean {
  return (state.foundry?.infinite ?? []).includes(id)
}

export function foundryRecipeGateNeed(state: GameState, level: number): number {
  return Math.max(1, level - foundryMasteryGateReduce(state))
}

export function isFoundryRecipeUnlocked(state: GameState, id: FoundryRecipeId): boolean {
  const def = getFoundryRecipe(id)
  if (!def) return false
  if (careerEver(state) < def.requiresSectorEver) return false
  if (def.requiresSlots && foundrySlotCount(state) < def.requiresSlots) return false
  if (def.requiresRecipeLevel) {
    return (
      foundryRecipeLevel(state, def.requiresRecipeLevel.recipeId) >=
      foundryRecipeGateNeed(state, def.requiresRecipeLevel.level)
    )
  }
  return true
}

export type FoundryMasteryKind = 'speed' | 'output' | 'efficiency' | 'fp' | 'infinite'

export interface FoundryMasteryStep {
  at: number
  kind: FoundryMasteryKind
  blurb: string
}

/** Mastery steps sit on existing unlock ranks — not a 5/10/20/30 shop. */
export const FOUNDRY_MASTERY_STEPS: FoundryMasteryStep[] = [
  { at: 4, kind: 'speed', blurb: 'This recipe smelts faster.' },
  { at: 8, kind: 'output', blurb: 'Each finish now yields an extra piece.' },
  { at: 12, kind: 'efficiency', blurb: 'This recipe spends less per craft.' },
  { at: 16, kind: 'fp', blurb: 'Levelling this recipe now pays 2 Foundry Points.' },
  { at: 20, kind: 'infinite', blurb: 'Solved — the floor supplies this material on its own.' },
]

export function foundryMasteryStepsFor(def: FoundryRecipeDef): FoundryMasteryStep[] {
  const steps = FOUNDRY_MASTERY_STEPS.filter((step) => step.at < def.maxLevel && step.kind !== 'infinite')
  steps.push({
    at: def.maxLevel,
    kind: 'infinite',
    blurb: 'Solved — the floor supplies this material on its own.',
  })
  return steps
}

export function foundryNextMastery(state: GameState, id: string): FoundryMasteryStep | null {
  const def = getFoundryRecipe(id)
  if (!def) return null
  const level = foundryRecipeLevel(state, id)
  return foundryMasteryStepsFor(def).find((step) => step.at > level) ?? null
}

export function foundryReachedMastery(state: GameState, id: string): FoundryMasteryStep[] {
  const def = getFoundryRecipe(id)
  if (!def) return []
  const level = foundryRecipeLevel(state, id)
  return foundryMasteryStepsFor(def).filter((step) => step.at <= level)
}

export function foundryCraftOutput(state: GameState, id: string): number {
  const level = foundryRecipeLevel(state, id)
  let n = 1
  if (level >= 8) n += 1
  if (level >= 16) n += 1
  return n + foundryGlobalOutputAdd(state)
}

function masteryTimeStep(level: number): number {
  return level >= 4 ? 0.88 : 1
}

function masteryCostStep(level: number): number {
  return level >= 12 ? 0.82 : 1
}

export function craftsForNextLevel(level: number, state?: GameState): number {
  const growth = 1.15 * (state ? protocolModifiers(state).foundryXpNeedMult : 1)
  const raw = Math.max(2, 2 + Math.floor(level * growth))
  const xp = state ? foundryXpMult(state) : 1
  return Math.max(2, Math.ceil(raw / Math.max(1, xp)))
}

export function foundryCostMult(level: number, state?: GameState): number {
  const bend = 0.03 * (state ? 1 / Math.max(0.5, protocolModifiers(state).foundryCostGrowthMult) : 1)
  return Math.max(0.2, (1 - bend * Math.max(0, level)) * masteryCostStep(level))
}

export function foundryTimeMult(level: number): number {
  return Math.max(0.15, (1 - 0.025 * Math.max(0, level)) * masteryTimeStep(level))
}

export function foundrySlotCount(state: GameState): number {
  let extra = 0
  for (const def of FOUNDRY_UPGRADES) {
    if (!def.extraSlots) continue
    extra += (state.foundry?.upgrades[def.id] ?? 0) * def.extraSlots
  }
  return Math.min(FOUNDRY_MAX_SLOTS, FOUNDRY_STARTING_SLOTS + extra)
}

export function foundryCraftSpeed(state: GameState): number {
  const rank = protocolMutes(state, 'foundry') ? 0 : state.foundry?.upgrades['fp-speed'] ?? 0
  const bonus = (getFoundryUpgrade('fp-speed')?.speedBonus ?? 0) * rank
  return (
    (1 + bonus) *
    networkManufactureMult(state) *
    reliquaryFoundrySpeedMult(state) *
    furnaceFoundrySpeedMult(state) *
    hiveResearchFoundrySpeedMult(state) *
    echoFoundrySpeedMult(state) *
    protocolBonusMult(state, 'foundry') *
    processFoundrySpeedMult(state)
  )
}

export function foundryCraftTime(state: GameState, id: FoundryRecipeId): number {
  const def = getFoundryRecipe(id)
  if (!def) return 999
  return def.craftTime * foundryTimeMult(foundryRecipeLevel(state, id))
}

export function scaledFoundryCost(state: GameState, id: FoundryRecipeId): FoundryCost {
  const def = getFoundryRecipe(id)
  if (!def) return {}
  const m = foundryCostMult(foundryRecipeLevel(state, id), state)
  const costs: FoundryCost = {}
  if (def.costs.salvage) costs.salvage = Math.max(1, Math.ceil(def.costs.salvage * m))
  if (def.costs.scrap) costs.scrap = Math.max(1, Math.ceil(def.costs.scrap * m))
  if (def.costs.materials) {
    costs.materials = {}
    for (const [mat, n] of Object.entries(def.costs.materials)) {
      if (!n) continue
      costs.materials[mat as FoundryRecipeId] = Math.max(1, Math.ceil(n * m))
    }
  }
  return costs
}

export function foundryMaterialCount(state: GameState, id: string): number {
  if (isFoundryInfinite(state, id)) return Number.POSITIVE_INFINITY
  return Math.max(0, state.foundry?.materials[id] ?? 0)
}

function canPayCost(state: GameState, cost: FoundryCost): boolean {
  if ((cost.salvage ?? 0) > state.resources.salvage) return false
  if ((cost.scrap ?? 0) > state.resources.scrap) return false
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) return false
  }
  return true
}

function payCost(state: GameState, cost: FoundryCost): void {
  state.resources.salvage -= cost.salvage ?? 0
  state.resources.scrap -= cost.scrap ?? 0
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if (!n || isFoundryInfinite(state, id)) continue
    state.foundry.materials[id] = Math.max(0, (state.foundry.materials[id] ?? 0) - n)
  }
}

function grantCraft(state: GameState, id: FoundryRecipeId): void {
  const def = getFoundryRecipe(id)
  if (!def) return
  if (isFoundryInfinite(state, id)) return
  const output = foundryCraftOutput(state, id)
  state.foundry.materials[id] = (state.foundry.materials[id] ?? 0) + output
  const level = foundryRecipeLevel(state, id)
  if (level >= def.maxLevel) {
    markInfinite(state, id)
    return
  }
  const need = craftsForNextLevel(level, state)
  const xp = (state.foundry.recipeXp[id] ?? 0) + 1
  if (xp >= need) {
    state.foundry.recipeXp[id] = 0
    const nextLevel = level + 1
    state.foundry.recipeLevels[id] = nextLevel
    state.foundry.points += nextLevel >= 16 ? 2 : 1
    if (nextLevel >= def.maxLevel) markInfinite(state, id)
  } else {
    state.foundry.recipeXp[id] = xp
  }
}

function markInfinite(state: GameState, id: string): void {
  if (!state.foundry.infinite.includes(id)) {
    state.foundry.infinite = [...state.foundry.infinite, id]
  }
}

function tryPaySlot(state: GameState, slot: FoundrySlot): boolean {
  if (!slot.recipeId || slot.paid) return slot.paid
  if (isFoundryInfinite(state, slot.recipeId)) return false
  const cost = scaledFoundryCost(state, slot.recipeId)
  if (!canPayCost(state, cost)) return false
  payCost(state, cost)
  slot.paid = true
  slot.progress = 0
  return true
}

export function tickFoundry(state: GameState, dtSeconds: number): void {
  if (!state.foundry) state.foundry = createEmptyFoundryState()
  if (careerEver(state) < 2) return
  ensureSlotCount(state)
  const speed = foundryCraftSpeed(state)
  const budget = Math.max(0, dtSeconds) * speed

  for (const slot of state.foundry.slots) {
    if (!slot.recipeId) continue
    if (isFoundryInfinite(state, slot.recipeId)) {
      slot.recipeId = null
      slot.progress = 0
      slot.paid = false
      continue
    }
    let left = budget
    while (left > 1e-9) {
      if (!tryPaySlot(state, slot)) break
      const time = foundryCraftTime(state, slot.recipeId)
      const remain = (1 - slot.progress) * time
      if (left >= remain) {
        left -= remain
        grantCraft(state, slot.recipeId)
        slot.progress = 0
        slot.paid = false
      } else {
        slot.progress += left / time
        left = 0
      }
    }
  }
}

function ensureSlotCount(state: GameState): void {
  const need = foundrySlotCount(state)
  while (state.foundry.slots.length < need) {
    state.foundry.slots.push(emptySlot())
  }
  if (state.foundry.slots.length > need) {
    state.foundry.slots = state.foundry.slots.slice(0, need)
  }
}

export function foundryDamageMult(state: GameState): number {
  if (protocolMutes(state, 'foundry')) return 1
  const rank = state.foundry?.upgrades['fp-damage'] ?? 0
  let mult = 1 + (getFoundryUpgrade('fp-damage')?.damageBonus ?? 0) * rank
  for (const id of state.foundry?.equipped ?? []) {
    const mod = getFoundryModule(id)
    if (mod?.damageMult) mult *= mod.damageMult
  }
  return mult
}

export function foundryShieldMult(state: GameState): number {
  if (protocolMutes(state, 'foundry')) return 1
  const rank = state.foundry?.upgrades['fp-shield'] ?? 0
  return 1 + (getFoundryUpgrade('fp-shield')?.shieldBonus ?? 0) * rank
}

export function foundryFitSlots(state: GameState): number {
  return FOUNDRY_MODULE_SLOTS + foundryExtraFitSlots(state)
}

export function foundryShieldFlat(state: GameState): number {
  if (protocolMutes(state, 'foundry')) return 0
  let flat = 0
  for (const id of state.foundry?.equipped ?? []) {
    flat += getFoundryModule(id)?.shieldFlat ?? 0
  }
  return flat
}

export function foundrySalvageMult(state: GameState): number {
  if (protocolMutes(state, 'foundry')) return 1
  const rank = state.foundry?.upgrades['fp-salvage'] ?? 0
  return 1 + (getFoundryUpgrade('fp-salvage')?.salvageBonus ?? 0) * rank
}

export function foundryUpgradeCost(state: GameState, id: string): number {
  const def = getFoundryUpgrade(id)
  if (!def) return Infinity
  const rank = state.foundry?.upgrades[id] ?? 0
  return Math.ceil(def.baseCost * 2 ** rank)
}

export function canBuyFoundryUpgrade(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string } {
  const def = getFoundryUpgrade(id)
  if (!def) return { ok: false, reason: 'Unknown' }
  const rank = state.foundry?.upgrades[id] ?? 0
  if (rank >= def.maxRank) return { ok: false, reason: 'Maxed' }
  if (def.requiresSectorEver && careerEver(state) < def.requiresSectorEver) {
    return { ok: false, reason: `Clear sector ${def.requiresSectorEver}` }
  }
  const cost = foundryUpgradeCost(state, id)
  if ((state.foundry?.points ?? 0) < cost) return { ok: false, reason: `Need ${cost} FP` }
  return { ok: true }
}

export function buyFoundryUpgrade(state: GameState, id: string): GameState {
  if (!canBuyFoundryUpgrade(state, id).ok) return state
  const next = structuredClone(state)
  const cost = foundryUpgradeCost(next, id)
  next.foundry.points -= cost
  next.foundry.upgrades[id] = (next.foundry.upgrades[id] ?? 0) + 1
  ensureSlotCount(next)
  return next
}

export function setFoundrySlot(
  state: GameState,
  slotIndex: number,
  recipeId: FoundryRecipeId | null,
): GameState {
  if (careerEver(state) < 2) return state
  const next = structuredClone(state)
  ensureSlotCount(next)
  const slot = next.foundry.slots[slotIndex]
  if (!slot) return state
  if (recipeId && !isFoundryRecipeUnlocked(next, recipeId)) return state
  if (recipeId && isFoundryInfinite(next, recipeId)) return state
  slot.recipeId = recipeId
  slot.progress = 0
  slot.paid = false
  return next
}

function canPayModule(state: GameState, cost: Partial<Record<FoundryRecipeId, number>>): boolean {
  for (const [id, n] of Object.entries(cost)) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) return false
  }
  return true
}

export function isFoundryModuleUnlocked(state: GameState, id: string): boolean {
  const def = getFoundryModule(id)
  if (!def) return false
  return foundryRecipeLevel(state, def.requiresRecipeLevel.recipeId) >= def.requiresRecipeLevel.level
}

export function equipFoundryModule(state: GameState, moduleId: string): GameState {
  if (!state.combat.docked) return state
  const def = getFoundryModule(moduleId)
  if (!def || !isFoundryModuleUnlocked(state, moduleId)) return state
  if (state.foundry.equipped.includes(moduleId)) return state
  if (!canPayModule(state, def.cost)) return state
  const next = structuredClone(state)
  for (const [id, n] of Object.entries(def.cost)) {
    if (!n || isFoundryInfinite(next, id)) continue
    next.foundry.materials[id] = Math.max(0, (next.foundry.materials[id] ?? 0) - n)
  }
  if (next.foundry.equipped.length >= foundryFitSlots(next)) {
    const prev = getFoundryModule(next.foundry.equipped[0]!)
    if (prev) {
      for (const [id, n] of Object.entries(prev.cost)) {
        if (!n || isFoundryInfinite(next, id)) continue
        next.foundry.materials[id] = (next.foundry.materials[id] ?? 0) + n
      }
    }
    next.foundry.equipped = [...next.foundry.equipped.slice(1), moduleId]
  } else {
    next.foundry.equipped = [...next.foundry.equipped, moduleId]
  }
  return next
}

export function unequipFoundryModule(state: GameState, moduleId: string): GameState {
  if (!state.combat.docked) return state
  if (!state.foundry.equipped.includes(moduleId)) return state
  const def = getFoundryModule(moduleId)
  const next = structuredClone(state)
  next.foundry.equipped = next.foundry.equipped.filter((id) => id !== moduleId)
  if (def) {
    for (const [id, n] of Object.entries(def.cost)) {
      if (!n || isFoundryInfinite(next, id)) continue
      next.foundry.materials[id] = (next.foundry.materials[id] ?? 0) + n
    }
  }
  return next
}

export function formatFoundryCost(cost: FoundryCost): string {
  const bits: string[] = []
  if (cost.salvage) bits.push(`${cost.salvage} salvage`)
  if (cost.scrap) bits.push(`${cost.scrap} scrap`)
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    const name = getFoundryRecipe(id)?.name ?? id
    bits.push(`${n} ${name}`)
  }
  return bits.join(' · ') || 'free'
}

/** Locked-recipe encyclopedia line: sector, parent level, what it unlocks. */
export function foundryRecipeGateLine(recipe: FoundryRecipeDef): string {
  const bits = [`S${recipe.requiresSectorEver}`]
  if (recipe.requiresRecipeLevel) {
    const parent = getFoundryRecipe(recipe.requiresRecipeLevel.recipeId)?.name ?? recipe.requiresRecipeLevel.recipeId
    bits.push(`${parent} Lv ${recipe.requiresRecipeLevel.level}`)
  }
  if (recipe.unlocksRecipe) {
    const child = getFoundryRecipe(recipe.unlocksRecipe.recipeId)?.name ?? recipe.unlocksRecipe.recipeId
    bits.push(`unlocks ${child} at Lv ${recipe.unlocksRecipe.atLevel}`)
  }
  if (recipe.requiresSlots) bits.push(`${recipe.requiresSlots} smelters`)
  const feeds = FOUNDRY_MODULES.filter((m) => m.requiresRecipeLevel.recipeId === recipe.id).map(
    (m) => m.name,
  )
  if (feeds.length > 0) bits.push(`feeds ${feeds.join(', ')}`)
  return bits.join(' · ')
}

export function foundryRecipeChainLine(recipe: FoundryRecipeDef): string {
  const mats = Object.entries(recipe.costs.materials ?? {})
  if (mats.length === 0) return recipe.blurb
  const parts = mats.map(([id, n]) => `${n} ${getFoundryRecipe(id)?.name ?? id}`)
  return `${parts.join(' + ')} → ${recipe.name}`
}

export function foundryHasMaterialChain(recipe: FoundryRecipeDef): boolean {
  return Object.keys(recipe.costs.materials ?? {}).length > 0
}

export function foundryHasMasteryMilestone(state: GameState): boolean {
  return FOUNDRY_RECIPES.some((r) => foundryRecipeLevel(state, r.id) >= 4)
}

export function foundryHasChainRecipe(state: GameState): boolean {
  return FOUNDRY_RECIPES.some((r) => isFoundryRecipeUnlocked(state, r.id) && foundryHasMaterialChain(r))
}

export function foundryHasSolvedMaterial(state: GameState): boolean {
  return (state.foundry?.infinite ?? []).length > 0
}

export function persistFoundryOnRebuild(foundry: FoundryState): FoundryState {
  return {
    recipeLevels: { ...foundry.recipeLevels },
    recipeXp: { ...foundry.recipeXp },
    materials: { ...foundry.materials },
    infinite: [...foundry.infinite],
    points: foundry.points,
    upgrades: { ...foundry.upgrades },
    slots: foundry.slots.map((s) => ({
      recipeId: s.recipeId,
      progress: 0,
      paid: false,
    })),
    equipped: [],
  }
}
