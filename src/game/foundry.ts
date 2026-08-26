/** Foundry — GDD §49–65. Processing (continuous) and timed Fabrication. */

import type {
  FabricationSlot,
  FacilityId,
  FabJobKind,
  FoundryRecipeId,
  FoundrySlot,
  FoundryState,
  GameState,
  PendingRelicUpgrade,
} from './types'
import { reliquaryFoundrySpeedMult } from './reliquary'
import { furnaceFoundrySpeedMult } from './furnace'
import { foundryThroughputMult } from './matter'
import {
  hiveResearchFitSlots,
  hiveResearchDroneEffMult,
  hiveResearchFoundryOutput,
  hiveResearchFoundrySlots,
  hiveResearchFoundrySpeedMult,
  hiveResearchMasteryReduce,
} from './hiveResearch'
import { protocolBonusMult, protocolModifiers } from './protocols'
import { echoFoundrySpeedMult } from './echo'
import { processFoundrySpeedMult } from './process'
import { noteSystemAction, recordPlaytest } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'
import {
  getBlueprint,
  getFrame,
  getModule,
  grantUnlockedFrame,
  PART_TYPES,
  partId,
  stationEffectiveDrones,
} from './catalog'

export type FoundryPaneId = 'processing' | 'fabrication' | 'mastery' | 'blueprints'

export const FOUNDRY_PANE_LABELS: Record<FoundryPaneId, string> = {
  processing: 'Processing',
  fabrication: 'Fabrication',
  mastery: 'Mastery',
  blueprints: 'Blueprints',
}

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
  requiresBestWave: number
  requiresRecipeLevel?: { recipeId: FoundryRecipeId; level: number }
  /** Need this many processors unlocked before the recipe opens. */
  requiresSlots?: number
  unlocksRecipe?: { recipeId: FoundryRecipeId; atLevel: number }
  /** First craft of this recipe unlocks a Hive Frame. */
  unlocksFrame?: string
}

export interface FacilityDef {
  id: FacilityId
  name: string
  blurb: string
  craftTime: number
  costs: FoundryCost
  requiresBestWave: number
  maxOwned: number
}

export const FOUNDRY_STARTING_SLOTS = 1
export const FOUNDRY_STARTING_FAB_SLOTS = 1
export const FOUNDRY_MAX_SLOTS = 5
export const FOUNDRY_MAX_FAB_SLOTS = 4
export const FOUNDRY_QUEUE_BASE = 3

/** @deprecated Ranks / Fit were removed. Kept so leftover tests compile while they are rewritten. */
export const FOUNDRY_MODULE_SLOTS = 0
export type FoundryUpgradeDef = { id: string; name: string; blurb: string; maxRank: number; baseCost: number }
export type FoundryModuleDef = {
  id: string
  name: string
  blurb: string
  cost: Partial<Record<FoundryRecipeId, number>>
  requiresRecipeLevel: { recipeId: FoundryRecipeId; level: number }
}
export const FOUNDRY_UPGRADES: FoundryUpgradeDef[] = []
export const FOUNDRY_MODULES: FoundryModuleDef[] = []

export const FOUNDRY_RECIPES: FoundryRecipeDef[] = [
  {
    id: 'slag-ingot',
    name: 'Recovered Stock',
    blurb: 'Scrap pressed into persistent plate. First Processing job.',
    maxLevel: 100,
    craftTime: 30,
    costs: { scrap: 8 },
    requiresBestWave: 20,
    unlocksRecipe: { recipeId: 'hardened-plate', atLevel: 10 },
  },
  {
    id: 'filament',
    name: 'Filament',
    blurb: 'Drawn scrap wire for relays and pins.',
    maxLevel: 100,
    craftTime: 30,
    costs: { scrap: 6 },
    requiresBestWave: 20,
    unlocksRecipe: { recipeId: 'relay', atLevel: 10 },
  },
  {
    id: 'hardened-plate',
    name: 'Alloy Plate',
    blurb: 'Recovered stock refined into plate. Feeds later stock.',
    maxLevel: 100,
    craftTime: 120,
    costs: { materials: { 'slag-ingot': 3 } },
    requiresBestWave: 20,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 10 },
    unlocksRecipe: { recipeId: 'void-slag', atLevel: 50 },
  },
  {
    id: 'relay',
    name: 'Wound Coil',
    blurb: 'Wound filament. Feeds later glass and coil work.',
    maxLevel: 100,
    craftTime: 150,
    costs: { materials: { filament: 3 } },
    requiresBestWave: 20,
    requiresRecipeLevel: { recipeId: 'filament', level: 10 },
    unlocksRecipe: { recipeId: 'focus-lens', atLevel: 50 },
  },
  {
    id: 'temper-bar',
    name: 'Temper Bar',
    blurb: 'Stock and wire pressed together. First print also unlocks the Swarm Frame.',
    maxLevel: 100,
    craftTime: 180,
    costs: { materials: { 'slag-ingot': 2, filament: 1 } },
    requiresBestWave: 30,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 5 },
    unlocksFrame: 'swarm-frame',
  },
  {
    id: 'brace-pin',
    name: 'Brace Pin',
    blurb: 'Pinned stock and wire. Mid-chain fastener.',
    maxLevel: 100,
    craftTime: 180,
    costs: { materials: { 'slag-ingot': 2, filament: 2 } },
    requiresBestWave: 40,
    requiresRecipeLevel: { recipeId: 'slag-ingot', level: 5 },
  },
  {
    id: 'choir-flux',
    name: 'Choir Flux',
    blurb: 'Condensed wreck vapour drawn from scrap.',
    maxLevel: 100,
    craftTime: 240,
    costs: { scrap: 18 },
    requiresBestWave: 50,
    unlocksRecipe: { recipeId: 'keel-strip', atLevel: 10 },
  },
  {
    id: 'coil-stack',
    name: 'Coil Stack',
    blurb: 'Wound coils bundled on filament. Needs a second processor.',
    maxLevel: 100,
    craftTime: 300,
    costs: { materials: { relay: 2, filament: 2 } },
    requiresBestWave: 90,
    requiresRecipeLevel: { recipeId: 'relay', level: 10 },
    requiresSlots: 2,
  },
  {
    id: 'keel-strip',
    name: 'Keel Strip',
    blurb: 'Flux pressed over plate.',
    maxLevel: 100,
    craftTime: 360,
    costs: { materials: { 'choir-flux': 3, 'hardened-plate': 1 } },
    requiresBestWave: 50,
    requiresRecipeLevel: { recipeId: 'choir-flux', level: 10 },
  },
  {
    id: 'slag-glass',
    name: 'Slag Glass',
    blurb: 'Drawn relay glass.',
    maxLevel: 100,
    craftTime: 300,
    costs: { materials: { filament: 2, relay: 2 } },
    requiresBestWave: 70,
    requiresRecipeLevel: { recipeId: 'relay', level: 10 },
  },
  {
    id: 'flux-weave',
    name: 'Flux Weave',
    blurb: 'Plate and flux laminated. Needs a second processor.',
    maxLevel: 100,
    craftTime: 400,
    costs: { materials: { 'choir-flux': 2, 'hardened-plate': 2 } },
    requiresBestWave: 90,
    requiresRecipeLevel: { recipeId: 'choir-flux', level: 10 },
    requiresSlots: 2,
  },
  {
    id: 'focus-lens',
    name: 'Focus Lens',
    blurb: 'Ground relay glass.',
    maxLevel: 100,
    craftTime: 480,
    costs: { materials: { relay: 3, 'slag-glass': 1 } },
    requiresBestWave: 90,
    requiresRecipeLevel: { recipeId: 'relay', level: 50 },
    unlocksRecipe: { recipeId: 'control-mesh', atLevel: 50 },
  },
  {
    id: 'void-slag',
    name: 'Void Slag',
    blurb: 'Plate reprocessed under vacuum.',
    maxLevel: 100,
    craftTime: 480,
    costs: { materials: { 'hardened-plate': 3 } },
    requiresBestWave: 140,
    requiresRecipeLevel: { recipeId: 'hardened-plate', level: 50 },
  },
  {
    id: 'hearth-core',
    name: 'Hearth Core',
    blurb: 'Void slag, keel, and temper stock. Needs three processors.',
    maxLevel: 100,
    craftTime: 900,
    costs: { materials: { 'void-slag': 2, 'keel-strip': 2, 'temper-bar': 1 } },
    requiresBestWave: 150,
    requiresRecipeLevel: { recipeId: 'void-slag', level: 10 },
    requiresSlots: 3,
  },
  {
    id: 'sight-lattice',
    name: 'Sight Array',
    blurb: 'Glass and lenses stacked. Needs a second processor.',
    maxLevel: 100,
    craftTime: 720,
    costs: { materials: { 'slag-glass': 2, 'focus-lens': 2 } },
    requiresBestWave: 160,
    requiresRecipeLevel: { recipeId: 'focus-lens', level: 10 },
    requiresSlots: 2,
  },
  {
    id: 'control-mesh',
    name: 'Control Mesh',
    blurb: 'Woven lenses and coil.',
    maxLevel: 100,
    craftTime: 900,
    costs: { materials: { 'focus-lens': 3, 'coil-stack': 1 } },
    requiresBestWave: 190,
    requiresRecipeLevel: { recipeId: 'focus-lens', level: 50 },
  },
]

export const FOUNDRY_FACILITIES: FacilityDef[] = [
  {
    id: 'processing-line',
    name: 'Processing Line',
    blurb: 'Adds a Processing slot. Online as soon as the job finishes.',
    craftTime: 15 * 60,
    costs: { materials: { 'slag-ingot': 8, 'hardened-plate': 4 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 2,
  },
  {
    id: 'fabrication-bay',
    name: 'Fabrication Machinery',
    blurb: 'Adds a Fabrication slot. Online as soon as the job finishes.',
    craftTime: 20 * 60,
    costs: { materials: { filament: 8, relay: 4 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 2,
  },
  {
    id: 'drone-racks',
    name: 'Drone Racks',
    blurb: '+4 Worker Drone capacity. Online as soon as the job finishes.',
    craftTime: 15 * 60,
    costs: { materials: { 'slag-ingot': 6, filament: 4 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 3,
  },
  {
    id: 'drone-fabricator',
    name: 'Worker Drone Fabricator',
    blurb: 'Unlocks the Drone production job. Online as soon as the job finishes.',
    craftTime: 25 * 60,
    costs: { materials: { 'slag-ingot': 10, 'temper-bar': 6 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 1,
  },
  {
    id: 'research-annex',
    name: 'Research Annex',
    blurb: 'Research projects run faster. Online as soon as the job finishes.',
    craftTime: 30 * 60,
    costs: { materials: { relay: 8, 'slag-glass': 4 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 1,
  },
  {
    id: 'storage-bay',
    name: 'Storage',
    blurb: 'Salvage ops haul more scrap. Online as soon as the job finishes.',
    craftTime: 15 * 60,
    costs: { materials: { 'slag-ingot': 12 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 1,
  },
  {
    id: 'specialised-works',
    name: 'Specialised Works',
    blurb: 'Processing runs faster and may yield a rare extra piece. Online as soon as the job finishes.',
    craftTime: 45 * 60,
    costs: { materials: { 'temper-bar': 6, 'keel-strip': 4 } },
    requiresBestWave: ACT1_CADENCE.foundryAdvanced,
    maxOwned: 1,
  },
]

export function createEmptyFoundryState(): FoundryState {
  return {
    recipeLevels: {},
    recipeXp: {},
    materials: {},
    slots: [emptySlot()],
    fabrication: [emptyFabSlot()],
    trackedPrintId: null,
    facilities: [],
    pendingFacilities: [],
    pendingCores: [],
    pendingRelics: [],
  }
}

function emptySlot(): FoundrySlot {
  return { recipeId: null, progress: 0, paid: false }
}

function emptyFabSlot(): FabricationSlot {
  return { kind: null, jobId: null, progress: 0, paid: false, complete: false }
}

export function getFoundryRecipe(id: string): FoundryRecipeDef | undefined {
  return FOUNDRY_RECIPES.find((r) => r.id === id)
}

export function getFacility(id: string): FacilityDef | undefined {
  return FOUNDRY_FACILITIES.find((f) => f.id === id)
}

export function getFoundryUpgrade(_id: string): FoundryUpgradeDef | undefined {
  return undefined
}

export function getFoundryModule(_id: string): FoundryModuleDef | undefined {
  return undefined
}

export function foundryRecipeLevel(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.foundry?.recipeLevels[id] ?? 0))
}

export function isFoundryInfinite(_state: GameState, _id: string): boolean {
  return false
}

export function foundryOwnedCount(state: GameState, id: FacilityId): number {
  return (state.foundry?.facilities ?? []).filter((row) => row === id).length
}

export function foundryPendingCount(state: GameState, id: FacilityId): number {
  return (state.foundry?.pendingFacilities ?? []).filter((row) => row === id).length
}

export function foundryFacilityCommitted(state: GameState, id: FacilityId): number {
  const queued = (state.foundry?.fabrication ?? []).filter(
    (slot) => slot.kind === 'facility' && slot.jobId === id,
  ).length
  return foundryOwnedCount(state, id) + foundryPendingCount(state, id) + queued
}

export function hasFacility(state: GameState, id: FacilityId): boolean {
  return foundryOwnedCount(state, id) > 0
}

export function foundryRecipeGateNeed(state: GameState, level: number): number {
  return Math.max(1, level - hiveResearchMasteryReduce(state))
}

export function isFoundryRecipeUnlocked(state: GameState, id: FoundryRecipeId): boolean {
  const def = getFoundryRecipe(id)
  if (!def) return false
  if (careerBestWave(state) < def.requiresBestWave) return false
  if (def.requiresSlots && foundrySlotCount(state) < def.requiresSlots) return false
  if (def.requiresRecipeLevel) {
    return (
      foundryRecipeLevel(state, def.requiresRecipeLevel.recipeId) >=
      foundryRecipeGateNeed(state, def.requiresRecipeLevel.level)
    )
  }
  return true
}

export type FoundryMasteryKind = 'basic' | 'output' | 'refined' | 'efficiency' | 'multiplier' | 'advanced' | 'rare' | 'major'

export interface FoundryMasteryStep {
  at: number
  kind: FoundryMasteryKind
  blurb: string
}

export const FOUNDRY_MASTERY_STEPS: FoundryMasteryStep[] = [
  { at: 1, kind: 'basic', blurb: 'Basic recipe online.' },
  { at: 5, kind: 'output', blurb: 'Each finish yields an extra piece.' },
  { at: 10, kind: 'refined', blurb: 'Refined child recipes can open.' },
  { at: 20, kind: 'efficiency', blurb: 'This recipe spends less per craft.' },
  { at: 30, kind: 'multiplier', blurb: 'Output multiplier.' },
  { at: 50, kind: 'advanced', blurb: 'Advanced components can open.' },
  { at: 75, kind: 'rare', blurb: 'Rare extra piece chance.' },
  { at: 100, kind: 'major', blurb: 'Major mastery: faster crafts and more output.' },
]

export function foundryMasteryStepsFor(def: FoundryRecipeDef, _state?: GameState): FoundryMasteryStep[] {
  return FOUNDRY_MASTERY_STEPS.filter((step) => step.at <= def.maxLevel)
}

export function foundryNextMastery(state: GameState, id: string): FoundryMasteryStep | null {
  const def = getFoundryRecipe(id)
  if (!def) return null
  const level = foundryRecipeLevel(state, id)
  return foundryMasteryStepsFor(def, state).find((step) => step.at > level) ?? null
}

export function foundryReachedMastery(state: GameState, id: string): FoundryMasteryStep[] {
  const def = getFoundryRecipe(id)
  if (!def) return []
  const level = foundryRecipeLevel(state, id)
  return foundryMasteryStepsFor(def, state).filter((step) => step.at <= level)
}

export const FOUNDRY_MASTERY_TIME_MULT = 0.88
export const FOUNDRY_MASTERY_COST_MULT = 0.82
export const FOUNDRY_RARE_CHANCE = 0.08

export function foundryCraftOutput(state: GameState, id: string, roll = 1): number {
  const level = foundryRecipeLevel(state, id)
  let n = 1
  if (level >= 5) n += 1
  if (level >= 30) n *= 2
  if (level >= 100) n += 2
  if (hasFacility(state, 'storage-bay')) n += 1
  if (level >= 75 && roll < FOUNDRY_RARE_CHANCE) n += 1
  if (hasFacility(state, 'specialised-works') && roll < FOUNDRY_RARE_CHANCE) n += 1
  n += hiveResearchFoundryOutput(state)
  return n
}

export function foundryMasteryEffect(step: FoundryMasteryStep): string {
  switch (step.kind) {
    case 'basic':
      return 'Recipe available'
    case 'output':
      return 'Output +1 per craft'
    case 'refined':
      return 'Refined recipes may unlock'
    case 'efficiency':
      return `Craft cost ×${FOUNDRY_MASTERY_COST_MULT.toFixed(2)}`
    case 'multiplier':
      return 'Output ×2'
    case 'advanced':
      return 'Advanced recipes may unlock'
    case 'rare':
      return `${Math.round(FOUNDRY_RARE_CHANCE * 100)}% chance of +1 piece`
    case 'major':
      return 'Craft time ×0.70 · Output +2'
  }
}

export function craftsForNextLevel(level: number, state?: GameState): number {
  const growth = 1.25 * (state ? protocolModifiers(state).foundryXpNeedMult : 1)
  return Math.max(2, 2 + Math.floor(level * growth))
}

export function foundryCostMult(level: number, state?: GameState): number {
  const bend = 0.02 * (state ? 1 / Math.max(0.5, protocolModifiers(state).foundryCostGrowthMult) : 1)
  const mastery = level >= 20 ? FOUNDRY_MASTERY_COST_MULT : 1
  return Math.max(0.2, (1 - bend * Math.max(0, level)) * mastery)
}

export function foundryTimeMult(level: number): number {
  const major = level >= 100 ? 0.7 : 1
  return Math.max(0.12, (1 - 0.012 * Math.max(0, level)) * major)
}

export function workerJobSpeedMult(state: GameState, jobId: string): number {
  return 1 + stationEffectiveDrones(state, jobId) * hiveResearchDroneEffMult(state) * 0.12
}

export function foundrySlotCount(state: GameState): number {
  const extra = foundryOwnedCount(state, 'processing-line') + hiveResearchFoundrySlots(state)
  return Math.min(FOUNDRY_MAX_SLOTS, FOUNDRY_STARTING_SLOTS + extra)
}

export function foundryFabSlotCount(state: GameState): number {
  const extra = foundryOwnedCount(state, 'fabrication-bay') + hiveResearchFitSlots(state)
  return Math.min(FOUNDRY_MAX_FAB_SLOTS, FOUNDRY_STARTING_FAB_SLOTS + extra)
}

export function foundryCraftSpeed(state: GameState): number {
  const specialised = hasFacility(state, 'specialised-works') ? 1.2 : 1
  return (
    specialised *
    reliquaryFoundrySpeedMult(state) *
    furnaceFoundrySpeedMult(state) *
    hiveResearchFoundrySpeedMult(state) *
    echoFoundrySpeedMult(state) *
    protocolBonusMult(state, 'foundry') *
    processFoundrySpeedMult(state)
  )
}

export function foundryProcessingSpeed(state: GameState): number {
  return foundryCraftSpeed(state) * workerJobSpeedMult(state, 'alloy-foundry') * foundryThroughputMult(state)
}

export function foundryFabricationSpeed(state: GameState, kind: FabJobKind | null): number {
  const job = kind === 'facility' ? 'construction' : 'fab-bay'
  return foundryCraftSpeed(state) * workerJobSpeedMult(state, job) * foundryThroughputMult(state)
}

export function foundryCraftTime(state: GameState, id: FoundryRecipeId): number {
  const def = getFoundryRecipe(id)
  if (!def) return 999
  return def.craftTime * foundryTimeMult(foundryRecipeLevel(state, id))
}

export function scaledFoundryCost(state: GameState, id: FoundryRecipeId): FoundryCost {
  const def = getFoundryRecipe(id)
  if (!def) return {}
  return scaleCost(def.costs, foundryCostMult(foundryRecipeLevel(state, id), state))
}

function scaleCost(cost: FoundryCost, m: number): FoundryCost {
  const costs: FoundryCost = {}
  if (cost.salvage) costs.salvage = Math.max(1, Math.ceil(cost.salvage * m))
  if (cost.scrap) costs.scrap = Math.max(1, Math.ceil(cost.scrap * m))
  if (cost.materials) {
    costs.materials = {}
    for (const [mat, n] of Object.entries(cost.materials)) {
      if (!n) continue
      costs.materials[mat as FoundryRecipeId] = Math.max(1, Math.ceil(n * m))
    }
  }
  return costs
}

export function foundrySalvageReserve(_state: GameState): number {
  return 0
}

export function foundryMaterialCount(state: GameState, id: string): number {
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

export function foundryMissingCost(state: GameState, cost: FoundryCost): string | null {
  if ((cost.salvage ?? 0) > state.resources.salvage) return 'Salvage'
  if ((cost.scrap ?? 0) > state.resources.scrap) return 'Scrap'
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) return getFoundryRecipe(id)?.name ?? id
  }
  return null
}

function payCost(state: GameState, cost: FoundryCost): void {
  state.resources.salvage -= cost.salvage ?? 0
  state.resources.scrap -= cost.scrap ?? 0
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if (!n) continue
    state.foundry.materials[id] = Math.max(0, (state.foundry.materials[id] ?? 0) - n)
  }
}

function grantCraft(state: GameState, id: FoundryRecipeId): void {
  const def = getFoundryRecipe(id)
  if (!def) return
  const output = foundryCraftOutput(state, id, Math.random())
  state.foundry.materials[id] = (state.foundry.materials[id] ?? 0) + output
  if (def.unlocksFrame) {
    const frame = getFrame(def.unlocksFrame)
    grantUnlockedFrame(
      state,
      def.unlocksFrame,
      frame ? `Foundry fabricated the ${frame.name}.` : `Foundry fabricated a new Frame.`,
    )
  }
  const level = foundryRecipeLevel(state, id)
  if (level >= def.maxLevel) return
  const need = craftsForNextLevel(level, state)
  const xp = (state.foundry.recipeXp[id] ?? 0) + 1
  if (xp >= need) {
    state.foundry.recipeXp[id] = 0
    const nextLevel = level + 1
    state.foundry.recipeLevels[id] = nextLevel
    recordPlaytest(state, 'foundry_craft', {
      n: def.name,
      v: nextLevel,
      firstKey: `foundry_craft:${id}:${nextLevel}`,
    })
    noteSystemAction(state, 'foundry')
  } else {
    state.foundry.recipeXp[id] = xp
  }
}

function tryPaySlot(state: GameState, slot: FoundrySlot): boolean {
  if (!slot.recipeId || slot.paid) return slot.paid
  const cost = scaledFoundryCost(state, slot.recipeId)
  if (!canPayCost(state, cost)) return false
  payCost(state, cost)
  slot.paid = true
  slot.progress = 0
  return true
}

export function tickFoundry(state: GameState, dtSeconds: number): void {
  if (!state.foundry) state.foundry = createEmptyFoundryState()
  if (careerBestWave(state) < ACT1_CADENCE.foundry) return
  ensureSlotCount(state)
  tickProcessing(state, dtSeconds)
  tickFabrication(state, dtSeconds)
  if (state.combat.docked) claimFoundryCompletions(state)
}

function tickProcessing(state: GameState, dtSeconds: number): void {
  const budget = Math.max(0, dtSeconds) * foundryProcessingSpeed(state)
  for (const slot of state.foundry.slots) {
    if (!slot.recipeId) continue
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

function tickFabrication(state: GameState, dtSeconds: number): void {
  for (const slot of state.foundry.fabrication) {
    if (!slot.kind || !slot.jobId || slot.complete || !slot.paid) continue
    const time = fabricationJobTime(state, slot.kind, slot.jobId)
    if (time <= 0) continue
    const speed = foundryFabricationSpeed(state, slot.kind)
    slot.progress = Math.min(1, slot.progress + (Math.max(0, dtSeconds) * speed) / time)
    if (slot.progress < 1) continue
    slot.progress = 1
    slot.complete = true
    completeFabrication(state, slot)
  }
}

export function fabricationJobTime(state: GameState, kind: FabJobKind, jobId: string): number {
  if (kind === 'facility') return getFacility(jobId)?.craftTime ?? 900
  if (kind === 'relic') return jobId.endsWith('-iii') || relicTierHint(jobId) >= 3 ? 25 * 60 : 10 * 60
  const wave = Math.max(1, careerBestWave(state))
  if (wave <= 40) return 8 * 60
  if (wave <= 90) return 12 * 60
  if (wave <= 170) return 25 * 60
  return 60 * 60
}

function relicTierHint(id: string): number {
  if (id.endsWith('-iii') || id.includes('iii')) return 3
  if (id.endsWith('-ii') || id.includes('ii')) return 2
  return 1
}

function completeFabrication(state: GameState, slot: FabricationSlot): void {
  if (!slot.kind || !slot.jobId) return
  if (slot.kind === 'facility') {
    const def = getFacility(slot.jobId)
    state.foundry.facilities = [...(state.foundry.facilities ?? []), slot.jobId as FacilityId]
    state.foundry.pendingFacilities = (state.foundry.pendingFacilities ?? []).filter((id) => id !== slot.jobId)
    ensureSlotCount(state)
    pushFoundryLog(state, `${def?.name ?? 'Facility'} online.`)
    recordPlaytest(state, 'foundry_craft', { n: def?.name ?? slot.jobId, firstKey: `facility:${slot.jobId}` })
    noteSystemAction(state, 'foundry')
    return
  }
  if (slot.kind === 'core') {
    state.foundry.pendingCores = [...(state.foundry.pendingCores ?? []), slot.jobId]
    const name = getModule(slot.jobId)?.name ?? slot.jobId
    pushFoundryLog(
      state,
      state.combat.docked ? `Core fabricated: ${name}. Equip it at Dock.` : `${name.toUpperCase()} COMPLETE. Available next Sortie.`,
    )
    if (state.foundry.trackedPrintId === slot.jobId) state.foundry.trackedPrintId = null
    noteSystemAction(state, 'foundry')
    return
  }
  if (slot.kind === 'relic') {
    const [from, to] = slot.jobId.split('>')
    if (from && to) {
      state.foundry.pendingRelics = [...(state.foundry.pendingRelics ?? []), { from, to }]
      pushFoundryLog(
        state,
        state.combat.docked ? `Relic upgrade ready.` : `RELIC UPGRADE COMPLETE. Available next Sortie.`,
      )
      noteSystemAction(state, 'foundry')
    }
  }
}

function pushFoundryLog(state: GameState, line: string): void {
  state.combat.log = [line, ...state.combat.log].slice(0, 40)
}

export function claimFoundryCompletions(state: GameState): void {
  if (!state.foundry) return
  for (const moduleId of state.foundry.pendingCores ?? []) {
    grantPendingCore(state, moduleId)
  }
  state.foundry.pendingCores = []
  for (const relic of state.foundry.pendingRelics ?? []) {
    applyPendingRelic(state, relic)
  }
  state.foundry.pendingRelics = []
  for (const slot of state.foundry.fabrication ?? []) {
    if (slot.complete) {
      slot.kind = null
      slot.jobId = null
      slot.progress = 0
      slot.paid = false
      slot.complete = false
    }
  }
}

/** Drain leftover next-Sortie facilities from old saves. Bonuses apply immediately. */
export function armPendingFacilities(state: GameState): void {
  if (!state.foundry) return
  const pending = state.foundry.pendingFacilities ?? []
  if (pending.length === 0) return
  state.foundry.facilities = [...(state.foundry.facilities ?? []), ...pending]
  state.foundry.pendingFacilities = []
  ensureSlotCount(state)
}

function grantPendingCore(state: GameState, moduleId: string): void {
  if (!state.shipyard.unlockedModules.includes(moduleId)) {
    state.shipyard.unlockedModules = [...state.shipyard.unlockedModules, moduleId]
  }
  if (!state.meta.discoveredModules.includes(moduleId)) {
    state.meta.discoveredModules = [...state.meta.discoveredModules, moduleId]
  }
  state.shipyard.moduleCopies = {
    ...(state.shipyard.moduleCopies ?? {}),
    [moduleId]: Math.max(1, (state.shipyard.moduleCopies?.[moduleId] ?? 0) + 1),
  }
  state.meta.lifetimeFabCrafts = (state.meta.lifetimeFabCrafts ?? 0) + 1
}

function applyPendingRelic(state: GameState, relic: PendingRelicUpgrade): void {
  if (!state.reliquary) return
  const owned = state.reliquary.owned ?? {}
  owned[relic.to] = (owned[relic.to] ?? 0) + 1
  state.reliquary.owned = owned
}

function ensureSlotCount(state: GameState): void {
  const need = foundrySlotCount(state)
  while (state.foundry.slots.length < need) state.foundry.slots.push(emptySlot())
  if (state.foundry.slots.length > need) state.foundry.slots = state.foundry.slots.slice(0, need)

  const fabNeed = foundryFabSlotCount(state)
  if (!state.foundry.fabrication) state.foundry.fabrication = [emptyFabSlot()]
  while (state.foundry.fabrication.length < fabNeed) state.foundry.fabrication.push(emptyFabSlot())
  if (state.foundry.fabrication.length > fabNeed) {
    state.foundry.fabrication = state.foundry.fabrication.slice(0, fabNeed)
  }
}

export function foundryDamageMult(_state: GameState): number {
  return 1
}

export function foundryShieldMult(_state: GameState): number {
  return 1
}

export function foundryFitSlots(_state: GameState): number {
  return 0
}

export function foundryShieldFlat(_state: GameState): number {
  return 0
}

export function foundrySalvageMult(_state: GameState): number {
  return 1
}

export function foundryXpMult(_state: GameState): number {
  return 1
}

export function foundryGlobalOutputAdd(_state: GameState): number {
  return 0
}

export function foundryMasteryGateReduce(state: GameState): number {
  return hiveResearchMasteryReduce(state)
}

export function foundryNetworkFillMult(_state: GameState): number {
  return 1
}

export function foundryAshHeatMult(_state: GameState): number {
  return 1
}

export function foundryResearchXpMult(state: GameState): number {
  return hasFacility(state, 'research-annex') ? 1.2 : 1
}

export function foundryShardDropBonus(_state: GameState): number {
  return 0
}

export function foundryPartDropMult(_state: GameState): number {
  return 1
}

export function foundryQueueCap(_state: GameState): number {
  return FOUNDRY_QUEUE_BASE
}

export function foundryDroneCapBonus(state: GameState): number {
  return foundryOwnedCount(state, 'drone-racks') * 4
}

export function foundryResearchSpeedMult(state: GameState): number {
  return hasFacility(state, 'research-annex') ? 1.25 : 1
}

export function foundrySalvageOpsMult(state: GameState): number {
  return hasFacility(state, 'storage-bay') ? 1.25 : 1
}

export function foundryUpgradeCost(_state: GameState, _id: string): number {
  return Infinity
}

export function canBuyFoundryUpgrade(
  _state: GameState,
  _id: string,
): { ok: boolean; reason?: string } {
  return { ok: false, reason: 'Ranks removed' }
}

export function buyFoundryUpgrade(state: GameState, _id: string): GameState {
  return state
}

export function setFoundrySlot(
  state: GameState,
  slotIndex: number,
  recipeId: FoundryRecipeId | null,
): GameState {
  if (careerBestWave(state) < ACT1_CADENCE.foundry) return state
  const next = structuredClone(state)
  ensureSlotCount(next)
  const slot = next.foundry.slots[slotIndex]
  if (!slot) return state
  if (recipeId && !isFoundryRecipeUnlocked(next, recipeId)) return state
  slot.recipeId = recipeId
  slot.progress = 0
  slot.paid = false
  if (recipeId) noteSystemAction(next, 'foundry')
  return next
}

export function idleFabricationSlot(state: GameState): number {
  ensureSlotCount(state)
  return (state.foundry.fabrication ?? []).findIndex((slot) => !slot.kind && !slot.complete)
}

export function canStartFabrication(
  state: GameState,
  kind: FabJobKind,
  jobId: string,
): { ok: boolean; reason?: string; cost?: FoundryCost } {
  if (careerBestWave(state) < ACT1_CADENCE.foundry) {
    return { ok: false, reason: `Reach Wave ${ACT1_CADENCE.foundry}` }
  }
  if (idleFabricationSlot(state) < 0) return { ok: false, reason: 'No fabrication slot' }
  if (kind === 'facility') {
    const def = getFacility(jobId)
    if (!def) return { ok: false, reason: 'Unknown facility' }
    if (careerBestWave(state) < def.requiresBestWave) {
      return { ok: false, reason: `Reach Wave ${def.requiresBestWave}` }
    }
    if (foundryFacilityCommitted(state, def.id) >= def.maxOwned) {
      return { ok: false, reason: 'Already built' }
    }
    if (!canPayCost(state, def.costs)) return { ok: false, reason: 'Need Foundry stock', cost: def.costs }
    return { ok: true, cost: def.costs }
  }
  if (kind === 'core') {
    const recipe = getBlueprint(jobId)
    if (!recipe) return { ok: false, reason: 'Unknown blueprint' }
    if (state.shipyard.unlockedModules.includes(jobId) && (state.foundry.pendingCores ?? []).includes(jobId)) {
      return { ok: false, reason: 'Already queued' }
    }
    for (const pt of PART_TYPES) {
      const need = recipe[pt] ?? 0
      if (need > 0 && (state.parts[partId(jobId, pt)] ?? 0) < need) {
        return { ok: false, reason: 'Need more fragments' }
      }
    }
    const cost: FoundryCost = { materials: { ...(recipe.foundry ?? {}) } }
    if (!canPayCost(state, cost)) return { ok: false, reason: 'Need Foundry stock', cost }
    return { ok: true, cost }
  }
  if (kind === 'relic') {
    const [from, to] = jobId.split('>')
    if (!from || !to) return { ok: false, reason: 'Unknown relic' }
    const cost: FoundryCost = {
      materials: { 'slag-ingot': to.endsWith('iii') || to.includes('-iii') ? 10 : 4 },
    }
    if ((state.reliquary?.owned?.[from] ?? 0) < 1) return { ok: false, reason: 'Need a spare Relic' }
    if (!canPayCost(state, cost)) return { ok: false, reason: 'Need Foundry stock', cost }
    return { ok: true, cost }
  }
  return { ok: false, reason: 'Unknown job' }
}

export function startFabrication(state: GameState, kind: FabJobKind, jobId: string): GameState {
  const check = canStartFabrication(state, kind, jobId)
  if (!check.ok) return state
  const next = structuredClone(state)
  ensureSlotCount(next)
  const index = idleFabricationSlot(next)
  const slot = next.foundry.fabrication[index]
  if (!slot) return state
  if (kind === 'core') {
    const recipe = getBlueprint(jobId)
    if (!recipe) return state
    for (const pt of PART_TYPES) {
      const need = recipe[pt] ?? 0
      const id = partId(jobId, pt)
      next.parts[id] = Math.max(0, (next.parts[id] ?? 0) - need)
      if (next.parts[id] <= 0) delete next.parts[id]
    }
  }
  if (kind === 'relic') {
    const [from] = jobId.split('>')
    if (from && next.reliquary?.owned) {
      next.reliquary.owned[from] = Math.max(0, (next.reliquary.owned[from] ?? 0) - 1)
      if (next.reliquary.owned[from] <= 0) delete next.reliquary.owned[from]
    }
  }
  if (check.cost) payCost(next, check.cost)
  slot.kind = kind
  slot.jobId = jobId
  slot.progress = 0
  slot.paid = true
  slot.complete = false
  noteSystemAction(next, 'foundry')
  return next
}

export function stopFabrication(state: GameState, slotIndex: number): GameState {
  const slot = state.foundry.fabrication[slotIndex]
  if (!slot?.kind || slot.complete) return state
  const next = structuredClone(state)
  const copy = next.foundry.fabrication[slotIndex]
  if (!copy) return state
  copy.kind = null
  copy.jobId = null
  copy.progress = 0
  copy.paid = false
  copy.complete = false
  return next
}

export function isFoundryModuleUnlocked(_state: GameState, _id: string): boolean {
  return false
}

export function isFoundryModuleAffordable(_state: GameState, _id: string): boolean {
  return false
}

export function equipFoundryModule(state: GameState, _moduleId: string): GameState {
  return state
}

export function unequipFoundryModule(state: GameState, _moduleId: string): GameState {
  return state
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

export function foundryRecipeGateLine(recipe: FoundryRecipeDef): string {
  const bits = [`W${recipe.requiresBestWave}`]
  if (recipe.requiresRecipeLevel) {
    const parent = getFoundryRecipe(recipe.requiresRecipeLevel.recipeId)?.name ?? recipe.requiresRecipeLevel.recipeId
    bits.push(`${parent} Lv ${recipe.requiresRecipeLevel.level}`)
  }
  if (recipe.unlocksRecipe) {
    const child = getFoundryRecipe(recipe.unlocksRecipe.recipeId)?.name ?? recipe.unlocksRecipe.recipeId
    bits.push(`unlocks ${child} at Lv ${recipe.unlocksRecipe.atLevel}`)
  }
  if (recipe.requiresSlots) bits.push(`${recipe.requiresSlots} processors`)
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
  return FOUNDRY_RECIPES.some((r) => foundryRecipeLevel(state, r.id) >= 5)
}

export function foundryHasChainRecipe(state: GameState): boolean {
  return FOUNDRY_RECIPES.some((r) => isFoundryRecipeUnlocked(state, r.id) && foundryHasMaterialChain(r))
}

export function foundryHasSolvedMaterial(_state: GameState): boolean {
  return false
}

export function persistFoundryOnRebuild(foundry: FoundryState): FoundryState {
  return structuredClone(foundry)
}

export function foundryUpgradeEffectLine(_def: FoundryUpgradeDef): string {
  return ''
}

export function fabricationJobLabel(_state: GameState, slot: FabricationSlot): string {
  if (!slot.kind || !slot.jobId) return 'Idle'
  if (slot.kind === 'facility') return getFacility(slot.jobId)?.name ?? slot.jobId
  if (slot.kind === 'core') return getModule(slot.jobId)?.name ?? slot.jobId
  if (slot.kind === 'relic') return slot.jobId.replace('>', ' → ')
  return slot.jobId
}
