/**
 * Canonical Act 1 Foundry catalogue: 12 materials, Processing network,
 * infrastructure, and physical fabrication recipes.
 */

import type {
  FacilityId,
  FabJobKind,
  FoundryMaterialId,
  GameState,
} from './types'
import {
  FABRICATION_DUPLICATE_COST_MULT,
  INFRASTRUCTURE_MAX_OWNED,
  INFRASTRUCTURE_SECONDS,
  PROCESSING_INPUTS,
  PROCESSING_SECONDS,
  WORKER_FABRICATION_COST,
  WORKER_FABRICATION_SECONDS,
} from './foundrySeeds'

export const FOUNDRY_MATERIAL_IDS = [
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
] as const satisfies readonly FoundryMaterialId[]

export const FOUNDRY_MATERIAL_NAMES: Record<FoundryMaterialId, string> = {
  'recovered-stock': 'Recovered Stock',
  'conductive-filament': 'Conductive Filament',
  'tempered-alloy': 'Tempered Alloy',
  'ballistic-composite': 'Ballistic Composite',
  'optical-glass': 'Optical Glass',
  'shield-lattice': 'Shield Lattice',
  'control-mesh': 'Control Mesh',
  'phase-crystal': 'Phase Crystal',
  'nanite-compound': 'Nanite Compound',
  'resonant-ceramic': 'Resonant Ceramic',
  'thermal-conductor': 'Thermal Conductor',
  'crown-matrix': 'Crown Matrix',
}

export const LEGACY_FOUNDRY_MATERIAL_IDS = [
  'slag-ingot',
  'filament',
  'hardened-plate',
  'relay',
  'choir-flux',
  'keel-strip',
  'focus-lens',
  'void-slag',
  'warp-thread',
  'brace-pin',
  'slag-glass',
  'temper-bar',
  'coil-stack',
  'flux-weave',
  'hearth-core',
  'sight-lattice',
  'keel-lattice',
] as const

export const FOUNDRY_CAPABILITY_ADVANCED_PROCESSING = 'advanced-processing'
export const FOUNDRY_CAPABILITY_LATE_RECOVERY = 'late-choir-apex-recovery'
export const FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY = 'advanced-foundry'

export type FoundryCapabilityId =
  | typeof FOUNDRY_CAPABILITY_ADVANCED_PROCESSING
  | typeof FOUNDRY_CAPABILITY_LATE_RECOVERY
  | typeof FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY

export interface FoundryCost {
  salvage?: number
  scrap?: number
  ash?: number
  materials?: Partial<Record<FoundryMaterialId, number>>
}

export interface FoundryRecipeDef {
  id: FoundryMaterialId
  name: string
  blurb: string
  craftTime: number
  costs: FoundryCost
  capabilities?: FoundryCapabilityId[]
  /** False when canonical text does not yet specify a deterministic recipe. */
  recipeAuthored: boolean
}

export const FOUNDRY_RECIPES: FoundryRecipeDef[] = [
  {
    id: 'recovered-stock',
    name: 'Recovered Stock',
    blurb: 'Scrap pressed into persistent plate.',
    craftTime: PROCESSING_SECONDS['recovered-stock'],
    costs: { ...PROCESSING_INPUTS['recovered-stock'] },
    recipeAuthored: true,
  },
  {
    id: 'conductive-filament',
    name: 'Conductive Filament',
    blurb: 'Drawn scrap wire for relays and pins.',
    craftTime: PROCESSING_SECONDS['conductive-filament'],
    costs: { ...PROCESSING_INPUTS['conductive-filament'] },
    recipeAuthored: true,
  },
  {
    id: 'tempered-alloy',
    name: 'Tempered Alloy',
    blurb: 'Recovered Stock and Scrap pressed together.',
    craftTime: PROCESSING_SECONDS['tempered-alloy'],
    costs: { scrap: 4, materials: { 'recovered-stock': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'ballistic-composite',
    name: 'Ballistic Composite',
    blurb: 'Stock and filament laminated for ballistic work.',
    craftTime: PROCESSING_SECONDS['ballistic-composite'],
    costs: { materials: { 'recovered-stock': 2, 'conductive-filament': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'optical-glass',
    name: 'Optical Glass',
    blurb: 'Filament drawn with Scrap into optical stock.',
    craftTime: PROCESSING_SECONDS['optical-glass'],
    costs: { scrap: 4, materials: { 'conductive-filament': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'shield-lattice',
    name: 'Shield Lattice',
    blurb: 'Tempered Alloy woven with Conductive Filament.',
    craftTime: PROCESSING_SECONDS['shield-lattice'],
    costs: { materials: { 'tempered-alloy': 2, 'conductive-filament': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'control-mesh',
    name: 'Control Mesh',
    blurb: 'Optical Glass bound on Conductive Filament.',
    craftTime: PROCESSING_SECONDS['control-mesh'],
    costs: { materials: { 'optical-glass': 2, 'conductive-filament': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'phase-crystal',
    name: 'Phase Crystal',
    blurb: 'Optical Glass under advanced processing.',
    craftTime: PROCESSING_SECONDS['phase-crystal'],
    costs: { materials: { 'optical-glass': 3 } },
    capabilities: [FOUNDRY_CAPABILITY_ADVANCED_PROCESSING],
    recipeAuthored: true,
  },
  {
    id: 'nanite-compound',
    name: 'Nanite Compound',
    blurb: 'Control Mesh bonded into Tempered Alloy.',
    craftTime: PROCESSING_SECONDS['nanite-compound'],
    costs: { materials: { 'control-mesh': 2, 'tempered-alloy': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'resonant-ceramic',
    name: 'Resonant Ceramic',
    blurb: 'Tempered Alloy fired with Ash. The material persists after Rebuild.',
    craftTime: PROCESSING_SECONDS['resonant-ceramic'],
    costs: { ash: 10, materials: { 'tempered-alloy': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'thermal-conductor',
    name: 'Thermal Conductor',
    blurb: 'Resonant Ceramic, Filament, and Ash drawn into a thermal path.',
    craftTime: PROCESSING_SECONDS['thermal-conductor'],
    costs: { ash: 15, materials: { 'resonant-ceramic': 2, 'conductive-filament': 2 } },
    recipeAuthored: true,
  },
  {
    id: 'crown-matrix',
    name: 'Crown Matrix',
    blurb:
      'Late Choir / Apex recovery plus advanced processing. Deterministic inputs are not yet authored.',
    craftTime: PROCESSING_SECONDS['crown-matrix'],
    costs: {},
    capabilities: [FOUNDRY_CAPABILITY_ADVANCED_PROCESSING, FOUNDRY_CAPABILITY_LATE_RECOVERY],
    recipeAuthored: false,
  },
]

export function getFoundryRecipe(id: string): FoundryRecipeDef | undefined {
  return FOUNDRY_RECIPES.find((row) => row.id === id)
}

export function isFoundryMaterialId(id: string): id is FoundryMaterialId {
  return (FOUNDRY_MATERIAL_IDS as readonly string[]).includes(id)
}

export const FOUNDRY_INFRASTRUCTURE_IDS = [
  'processing-line',
  'fabrication-bay',
  'worker-fabricator',
  'research-annex',
  'recovery-storage',
] as const satisfies readonly FacilityId[]

export const LEGACY_FACILITY_IDS = [
  'drone-racks',
  'drone-fabricator',
  'storage-bay',
  'specialised-works',
] as const

export interface FacilityDef {
  id: FacilityId
  name: string
  blurb: string
  craftTime: number
  costs: FoundryCost
  maxOwned: number
  /** Seed effect. Unauthored magnitudes are labeled in the implementation note. */
  effect: string
}

export const FOUNDRY_FACILITIES: FacilityDef[] = [
  {
    id: 'processing-line',
    name: 'Processing Line',
    blurb: 'Adds a Processing slot. Online as soon as the job finishes.',
    craftTime: INFRASTRUCTURE_SECONDS['processing-line'],
    costs: { materials: { 'recovered-stock': 10, 'tempered-alloy': 6 } },
    maxOwned: INFRASTRUCTURE_MAX_OWNED['processing-line'],
    effect: '+1 Processing slot',
  },
  {
    id: 'fabrication-bay',
    name: 'Fabrication Bay',
    blurb: 'Adds a Fabrication slot. Online as soon as the job finishes.',
    craftTime: INFRASTRUCTURE_SECONDS['fabrication-bay'],
    costs: { materials: { 'conductive-filament': 10, 'ballistic-composite': 6 } },
    maxOwned: INFRASTRUCTURE_MAX_OWNED['fabrication-bay'],
    effect: '+1 Fabrication slot',
  },
  {
    id: 'worker-fabricator',
    name: 'Worker Fabricator',
    blurb: 'Manufactures physical Worker Drones. Does not raise capacity.',
    craftTime: INFRASTRUCTURE_SECONDS['worker-fabricator'],
    costs: {
      materials: { 'recovered-stock': 12, 'tempered-alloy': 8, 'conductive-filament': 6 },
    },
    maxOwned: INFRASTRUCTURE_MAX_OWNED['worker-fabricator'],
    effect: 'Enables Worker Drone fabrication',
  },
  {
    id: 'research-annex',
    name: 'Research Annex',
    blurb: 'Extension point for PR9 Research. Seed: active Research runs faster.',
    craftTime: INFRASTRUCTURE_SECONDS['research-annex'],
    costs: { materials: { 'optical-glass': 8, 'control-mesh': 6 } },
    maxOwned: INFRASTRUCTURE_MAX_OWNED['research-annex'],
    effect: 'Research speed ×1.25 (seed)',
  },
  {
    id: 'recovery-storage',
    name: 'Recovery Storage',
    blurb: 'Persistent recovery infrastructure. Not a material storage cap.',
    craftTime: INFRASTRUCTURE_SECONDS['recovery-storage'],
    costs: { materials: { 'recovered-stock': 12, 'tempered-alloy': 4 } },
    maxOwned: INFRASTRUCTURE_MAX_OWNED['recovery-storage'],
    effect: 'Salvage-ops Scrap ×1.25 (seed)',
  },
]

export function getFacility(id: string): FacilityDef | undefined {
  return FOUNDRY_FACILITIES.find((row) => row.id === id)
}

export interface FabricationRecipeDef {
  kind: FabJobKind
  productId: string
  name: string
  blurb: string
  craftTime: number
  costs: FoundryCost
  maxOwned?: number
}

export const CORE_FABRICATION_RECIPES: FabricationRecipeDef[] = [
  {
    kind: 'core',
    productId: 'pulse-cannon',
    name: 'Pulse Cannon',
    blurb: 'Duplicate starter weapon Core.',
    craftTime: 60,
    costs: { materials: { 'recovered-stock': 4, 'conductive-filament': 2 } },
  },
  {
    kind: 'core',
    productId: 'plate-layer',
    name: 'Plate Layer',
    blurb: 'Duplicate starter Shield Core.',
    craftTime: 60,
    costs: { materials: { 'recovered-stock': 4, 'tempered-alloy': 2 } },
  },
  {
    kind: 'core',
    productId: 'flak-array',
    name: 'Flak Array',
    blurb: 'Backlog-control specialist.',
    craftTime: 90,
    costs: {
      materials: { 'recovered-stock': 6, 'ballistic-composite': 4, 'conductive-filament': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'heavy-lance',
    name: 'Heavy Lance',
    blurb: 'Line-breaking anti-heavy Core.',
    craftTime: 150,
    costs: {
      materials: { 'tempered-alloy': 8, 'ballistic-composite': 4, 'conductive-filament': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'grav-tether',
    name: 'Grav Tether',
    blurb: 'Control / formation Core.',
    craftTime: 150,
    costs: {
      materials: { 'control-mesh': 6, 'conductive-filament': 4, 'optical-glass': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'slag-spitter',
    name: 'Slag Spitter',
    blurb: 'Area-denial / Armor degradation.',
    craftTime: 180,
    costs: {
      materials: { 'tempered-alloy': 8, 'ballistic-composite': 4, 'conductive-filament': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'phase-beam',
    name: 'Phase Beam',
    blurb: 'Sustained single-target anchor.',
    craftTime: 180,
    costs: {
      materials: { 'optical-glass': 6, 'shield-lattice': 4, 'conductive-filament': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'sensor-array',
    name: 'Sensor Array',
    blurb: 'Targeting support Core.',
    craftTime: 180,
    costs: {
      materials: { 'control-mesh': 6, 'optical-glass': 4, 'conductive-filament': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'barrier-projector',
    name: 'Barrier Projector',
    blurb: 'Reactive emergency defense.',
    craftTime: 210,
    costs: {
      materials: { 'shield-lattice': 8, 'tempered-alloy': 4, 'control-mesh': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'salvage-beacon',
    name: 'Salvage Beacon',
    blurb: 'Marked-kill Salvage specialist.',
    craftTime: 120,
    costs: {
      materials: { 'recovered-stock': 6, 'conductive-filament': 4, 'control-mesh': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'rapid-aegis',
    name: 'Rapid Aegis',
    blurb: 'Shield recovery specialist.',
    craftTime: 150,
    costs: { materials: { 'shield-lattice': 8, 'conductive-filament': 4 } },
  },
  {
    kind: 'core',
    productId: 'nano-lathe',
    name: 'Nano Lathe',
    blurb: 'In-combat Hull repair.',
    craftTime: 210,
    costs: {
      materials: { 'nanite-compound': 6, 'tempered-alloy': 4, 'control-mesh': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'ablative-mesh',
    name: 'Ablative Mesh',
    blurb: 'Hull / Armor spike survival. Challenge acquisition is PR10.',
    craftTime: 180,
    costs: {
      materials: { 'tempered-alloy': 8, 'ballistic-composite': 4, 'shield-lattice': 2 },
    },
  },
  {
    kind: 'core',
    productId: 'choir-tap',
    name: 'Choir Tap',
    blurb: 'Ash / Furnace economy. Furnace acquisition is PR8.',
    craftTime: 240,
    costs: {
      materials: { 'resonant-ceramic': 6, 'thermal-conductor': 4, 'control-mesh': 2 },
    },
  },
]

export const FRAME_FABRICATION_RECIPES: FabricationRecipeDef[] = [
  {
    kind: 'frame',
    productId: 'starter-frame',
    name: 'Standard',
    blurb: 'Starter Frame. Already owned.',
    craftTime: 120,
    costs: { materials: { 'recovered-stock': 8, 'tempered-alloy': 4 } },
  },
  {
    kind: 'frame',
    productId: 'bastion-frame',
    name: 'Bastion',
    blurb: 'Defensive Frame. Source is Tempered Alloy mastery (rank pending design).',
    craftTime: 300,
    costs: {
      materials: { 'tempered-alloy': 10, 'recovered-stock': 6, 'shield-lattice': 4 },
    },
  },
  {
    kind: 'frame',
    productId: 'reactor-frame',
    name: 'Reactor',
    blurb: 'Furnace-economy Frame. W500 Blueprint source.',
    craftTime: 480,
    costs: {
      materials: { 'thermal-conductor': 8, 'control-mesh': 6, 'tempered-alloy': 4 },
    },
  },
  {
    kind: 'frame',
    productId: 'swarm-frame',
    name: 'Swarm',
    blurb: 'Six-Core Frame. Challenge acquisition is PR10.',
    craftTime: 360,
    costs: {
      materials: { 'control-mesh': 8, 'ballistic-composite': 6, 'conductive-filament': 4 },
    },
  },
  {
    kind: 'frame',
    productId: 'harvester-frame',
    name: 'Harvester',
    blurb: 'Combat-economy Frame. Challenge acquisition is PR10. No offline Foundry exploit.',
    craftTime: 360,
    costs: {
      materials: { 'recovered-stock': 10, 'control-mesh': 6, 'optical-glass': 4 },
    },
  },
]

/** PR6 populates Relic recipes. Engine accepts kind: 'relic'. */
export const RELIC_FABRICATION_RECIPES: FabricationRecipeDef[] = []

export const WORKER_FABRICATION_RECIPE: FabricationRecipeDef = {
  kind: 'worker',
  productId: 'worker',
  name: 'Worker Drone',
  blurb: 'Permanent physical Worker. Capped by capacity, not by ownership.',
  craftTime: WORKER_FABRICATION_SECONDS,
  costs: {
    scrap: WORKER_FABRICATION_COST.scrap,
    materials: { ...WORKER_FABRICATION_COST.materials },
  },
}

export const INFRASTRUCTURE_FABRICATION_RECIPES: FabricationRecipeDef[] = FOUNDRY_FACILITIES.map(
  (row) => ({
    kind: 'facility' as const,
    productId: row.id,
    name: row.name,
    blurb: row.blurb,
    craftTime: row.craftTime,
    costs: row.costs,
    maxOwned: row.maxOwned,
  }),
)

export function getFabricationRecipe(kind: FabJobKind, productId: string): FabricationRecipeDef | undefined {
  if (kind === 'core') return CORE_FABRICATION_RECIPES.find((row) => row.productId === productId)
  if (kind === 'frame') return FRAME_FABRICATION_RECIPES.find((row) => row.productId === productId)
  if (kind === 'relic') return RELIC_FABRICATION_RECIPES.find((row) => row.productId === productId)
  if (kind === 'worker') return productId === 'worker' ? WORKER_FABRICATION_RECIPE : undefined
  if (kind === 'facility') return INFRASTRUCTURE_FABRICATION_RECIPES.find((row) => row.productId === productId)
  return undefined
}

export function scaleFabricationCost(cost: FoundryCost, copiesOwned: number): FoundryCost {
  if (copiesOwned <= 0) return structuredClone(cost)
  const m = FABRICATION_DUPLICATE_COST_MULT
  const next: FoundryCost = {}
  if (cost.salvage) next.salvage = Math.max(1, Math.ceil(cost.salvage * m))
  if (cost.scrap) next.scrap = Math.max(1, Math.ceil(cost.scrap * m))
  if (cost.ash) next.ash = Math.max(1, Math.ceil(cost.ash * m))
  if (cost.materials) {
    next.materials = {}
    for (const [id, n] of Object.entries(cost.materials)) {
      if (!n) continue
      next.materials[id as FoundryMaterialId] = Math.max(1, Math.ceil(n * m))
    }
  }
  return next
}

export function hasFoundryCapability(state: GameState, id: FoundryCapabilityId): boolean {
  return (state.foundry?.capabilities ?? []).includes(id)
}

export function grantFoundryCapability(state: GameState, id: FoundryCapabilityId): void {
  if (!state.foundry) return
  if (state.foundry.capabilities.includes(id)) return
  state.foundry.capabilities = [...state.foundry.capabilities, id]
}
