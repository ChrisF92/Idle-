/**
 * Blueprint lifecycle: UNKNOWN → FRAGMENTED → DISCOVERED → OWNED.
 *
 * Blueprint knowledge is design-only. Physical Cores live on
 * `shipyard.coreInstances`. Physical Frames live on `shipyard.unlockedFrames`.
 * Relic physical inventory is PR6.
 */

import type { FabJobKind, FoundryMaterialId, GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { FRAGMENT_ELIGIBILITY_LEAD_WAVES } from './foundrySeeds'
import {
  FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY,
  type FoundryCapabilityId,
} from './foundryCatalogue'
import { addCoreInstance } from './coreInstances'

export type BlueprintLifecycle = 'unknown' | 'fragmented' | 'discovered' | 'owned'

export type BlueprintSourceKind =
  | 'starter'
  | 'wave-secure'
  | 'material-mastery'
  | 'foundry-capability'
  | 'furnace-progression'
  | 'challenge'
  | 'research'

export interface BlueprintSource {
  kind: BlueprintSourceKind
  /** Boss-secure Wave. Used only for `wave-secure`. */
  wave?: number
  /** Canonical material. Rank is omitted when the design has not authored it. */
  materialId?: FoundryMaterialId
  /**
   * Required Material Mastery rank. `null` means the route exists but the
   * exact M-level is unauthored — the source never auto-completes.
   */
  minRank?: number | null
  capability?: FoundryCapabilityId
  challengeId?: string
  label: string
}

export interface BlueprintDef {
  id: string
  name: string
  schematicName: string
  productKind: Extract<FabJobKind, 'core' | 'frame' | 'relic'>
  fragmentsRequired: number
  sources: BlueprintSource[]
  /** Wave at which combat fragment drops may begin. */
  fragmentEligibleFromWave: number
}

const foundryWave = () => ACT1_CADENCE.foundry

function eligibilityForWaveSource(sourceWave: number): number {
  return Math.max(foundryWave(), sourceWave - FRAGMENT_ELIGIBILITY_LEAD_WAVES)
}

export const BLUEPRINTS: BlueprintDef[] = [
  {
    id: 'pulse-cannon',
    name: 'Pulse Cannon',
    schematicName: 'Pulse Cannon Schematic',
    productKind: 'core',
    fragmentsRequired: 0,
    sources: [{ kind: 'starter', label: 'Starter Core' }],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'plate-layer',
    name: 'Plate Layer',
    schematicName: 'Plate Layer Schematic',
    productKind: 'core',
    fragmentsRequired: 0,
    sources: [{ kind: 'starter', label: 'Starter Core' }],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'flak-array',
    name: 'Flak Array',
    schematicName: 'Flak Array Schematic',
    productKind: 'core',
    fragmentsRequired: 3,
    sources: [{ kind: 'wave-secure', wave: 50, label: 'W50 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(50),
  },
  {
    id: 'heavy-lance',
    name: 'Heavy Lance',
    schematicName: 'Heavy Lance Schematic',
    productKind: 'core',
    fragmentsRequired: 5,
    sources: [{ kind: 'wave-secure', wave: 100, label: 'W100 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(100),
  },
  {
    id: 'grav-tether',
    name: 'Grav Tether',
    schematicName: 'Grav Tether Schematic',
    productKind: 'core',
    fragmentsRequired: 5,
    sources: [{ kind: 'wave-secure', wave: 150, label: 'W150 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(150),
  },
  {
    id: 'slag-spitter',
    name: 'Slag Spitter',
    schematicName: 'Slag Spitter Schematic',
    productKind: 'core',
    fragmentsRequired: 5,
    sources: [{ kind: 'wave-secure', wave: 200, label: 'W200 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(200),
  },
  {
    id: 'phase-beam',
    name: 'Phase Beam',
    schematicName: 'Phase Beam Schematic',
    productKind: 'core',
    fragmentsRequired: 6,
    sources: [{ kind: 'wave-secure', wave: 250, label: 'W250 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(250),
  },
  {
    id: 'sensor-array',
    name: 'Sensor Array',
    schematicName: 'Sensor Array Schematic',
    productKind: 'core',
    fragmentsRequired: 6,
    sources: [{ kind: 'wave-secure', wave: 300, label: 'W300 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(300),
  },
  {
    id: 'barrier-projector',
    name: 'Barrier Projector',
    schematicName: 'Barrier Projector Schematic',
    productKind: 'core',
    fragmentsRequired: 6,
    sources: [{ kind: 'wave-secure', wave: 350, label: 'W350 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(350),
  },
  {
    id: 'salvage-beacon',
    name: 'Salvage Beacon',
    schematicName: 'Salvage Beacon Schematic',
    productKind: 'core',
    fragmentsRequired: 4,
    sources: [
      {
        kind: 'material-mastery',
        materialId: 'recovered-stock',
        minRank: null,
        label: 'Early Material Mastery (rank pending design)',
      },
    ],
    fragmentEligibleFromWave: foundryWave(),
  },
  {
    id: 'rapid-aegis',
    name: 'Rapid Aegis',
    schematicName: 'Rapid Aegis Schematic',
    productKind: 'core',
    fragmentsRequired: 4,
    sources: [
      {
        kind: 'material-mastery',
        materialId: 'shield-lattice',
        minRank: null,
        label: 'Shield-Lattice Material Mastery (rank pending design)',
      },
    ],
    fragmentEligibleFromWave: foundryWave(),
  },
  {
    id: 'nano-lathe',
    name: 'Nano Lathe',
    schematicName: 'Nano Lathe Schematic',
    productKind: 'core',
    fragmentsRequired: 4,
    sources: [
      {
        kind: 'foundry-capability',
        capability: FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY,
        label: 'Advanced Foundry (capability pending design)',
      },
    ],
    fragmentEligibleFromWave: foundryWave(),
  },
  {
    id: 'ablative-mesh',
    name: 'Ablative Mesh',
    schematicName: 'Ablative Mesh Schematic',
    productKind: 'core',
    fragmentsRequired: 5,
    sources: [
      {
        kind: 'challenge',
        challengeId: 'glass-frame',
        label: 'Glass Frame Challenge (PR10)',
      },
    ],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'choir-tap',
    name: 'Choir Tap',
    schematicName: 'Choir Tap Schematic',
    productKind: 'core',
    fragmentsRequired: 5,
    sources: [
      {
        kind: 'furnace-progression',
        label: 'Resonant / Furnace progression (PR8)',
      },
    ],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'starter-frame',
    name: 'Standard',
    schematicName: 'Standard Frame Schematic',
    productKind: 'frame',
    fragmentsRequired: 0,
    sources: [{ kind: 'starter', label: 'Starter Frame' }],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'bastion-frame',
    name: 'Bastion',
    schematicName: 'Bastion Frame Schematic',
    productKind: 'frame',
    fragmentsRequired: 5,
    sources: [
      {
        kind: 'material-mastery',
        materialId: 'tempered-alloy',
        minRank: null,
        label: 'Tempered Alloy mastery (rank pending design)',
      },
    ],
    fragmentEligibleFromWave: foundryWave(),
  },
  {
    id: 'reactor-frame',
    name: 'Reactor',
    schematicName: 'Reactor Frame Schematic',
    productKind: 'frame',
    fragmentsRequired: 5,
    sources: [{ kind: 'wave-secure', wave: 500, label: 'W500 Boss secure' }],
    fragmentEligibleFromWave: eligibilityForWaveSource(500),
  },
  {
    id: 'swarm-frame',
    name: 'Swarm',
    schematicName: 'Swarm Frame Schematic',
    productKind: 'frame',
    fragmentsRequired: 5,
    sources: [
      {
        kind: 'challenge',
        challengeId: 'single-pattern',
        label: 'Single Pattern Challenge (PR10)',
      },
    ],
    fragmentEligibleFromWave: Infinity,
  },
  {
    id: 'harvester-frame',
    name: 'Harvester',
    schematicName: 'Harvester Frame Schematic',
    productKind: 'frame',
    fragmentsRequired: 5,
    sources: [
      {
        kind: 'challenge',
        challengeId: 'cold-furnace',
        label: 'Cold Furnace Challenge (PR10)',
      },
    ],
    fragmentEligibleFromWave: Infinity,
  },
]

export const WAVE_SECURE_BLUEPRINTS: ReadonlyArray<{ wave: number; blueprintId: string }> = BLUEPRINTS.flatMap(
  (def) =>
    def.sources
      .filter((source) => source.kind === 'wave-secure' && typeof source.wave === 'number')
      .map((source) => ({ wave: source.wave!, blueprintId: def.id })),
)

export function getBlueprint(id: string): BlueprintDef | undefined {
  return BLUEPRINTS.find((row) => row.id === id)
}

export function starterBlueprintIds(): string[] {
  return BLUEPRINTS.filter((row) => row.sources.some((source) => source.kind === 'starter')).map((row) => row.id)
}

export function blueprintFragmentCount(state: GameState, id: string): number {
  return Math.max(0, Math.floor(state.foundry?.fragments[id] ?? 0))
}

export function isBlueprintDiscovered(state: GameState, id: string): boolean {
  return (state.foundry?.discovered ?? []).includes(id)
}

export function physicalProductOwned(state: GameState, def: BlueprintDef): boolean {
  if (def.productKind === 'core') {
    return (state.shipyard.coreInstances ?? []).some((row) => row.moduleId === def.id)
  }
  if (def.productKind === 'frame') {
    return (state.shipyard.unlockedFrames ?? []).includes(def.id)
  }
  return false
}

export function blueprintLifecycle(state: GameState, id: string): BlueprintLifecycle {
  const def = getBlueprint(id)
  if (!def) return 'unknown'
  const discovered = isBlueprintDiscovered(state, id)
  if (discovered || physicalProductOwned(state, def)) {
    return physicalProductOwned(state, def) ? 'owned' : 'discovered'
  }
  if (blueprintFragmentCount(state, id) > 0) return 'fragmented'
  return 'unknown'
}

/**
 * Type knowledge for PR4 consumers. Discovery never fabricates a physical copy.
 */
export function noteBlueprintTypeKnowledge(state: GameState, moduleId: string): void {
  if (!state.shipyard.unlockedModules.includes(moduleId)) {
    state.shipyard.unlockedModules = [...state.shipyard.unlockedModules, moduleId]
  }
  if (!state.meta.discoveredModules.includes(moduleId)) {
    state.meta.discoveredModules = [...state.meta.discoveredModules, moduleId]
  }
}

/** Idempotent. Does not create a physical item. */
export function discoverBlueprint(state: GameState, id: string, log?: string): boolean {
  const def = getBlueprint(id)
  if (!def) return false
  if (isBlueprintDiscovered(state, id)) return false
  state.foundry.discovered = [...state.foundry.discovered, id]
  if (def.productKind === 'core') noteBlueprintTypeKnowledge(state, id)
  if (log) state.combat.log = [log, ...state.combat.log].slice(0, 40)
  return true
}

export function grantBlueprintFragment(state: GameState, id: string, amount = 1): boolean {
  const def = getBlueprint(id)
  if (!def || amount <= 0) return false
  if (isBlueprintDiscovered(state, id) || physicalProductOwned(state, def)) return false
  const have = blueprintFragmentCount(state, id) + amount
  state.foundry.fragments[id] = have
  if (def.fragmentsRequired > 0 && have >= def.fragmentsRequired) {
    discoverBlueprint(state, id, `${def.name} Blueprint discovered. Fabrication required.`)
  }
  return true
}

/**
 * Guaranteed source. Completes DISCOVERED from any fragment count.
 * Does not refund fragments. Does not manufacture the product.
 */
export function completeBlueprintFromSource(state: GameState, id: string): boolean {
  const def = getBlueprint(id)
  if (!def) return false
  return discoverBlueprint(state, id, `${def.name} Blueprint secured. Design known — fabrication required.`)
}

/**
 * Canonical Wave/Boss-secure provider. Call from the Wave-secure event,
 * not from a careerBestWave backfill.
 */
export function applyWaveSecureBlueprintSources(state: GameState, wave: number, kind: string): void {
  if (kind !== 'boss') return
  for (const row of WAVE_SECURE_BLUEPRINTS) {
    if (row.wave === wave) completeBlueprintFromSource(state, row.blueprintId)
  }
}

export function canDropBlueprintFragment(
  state: GameState,
  id: string,
  rewardWave: number,
): boolean {
  const def = getBlueprint(id)
  if (!def) return false
  if (isBlueprintDiscovered(state, id) || physicalProductOwned(state, def)) return false
  if (!Number.isFinite(def.fragmentEligibleFromWave)) return false
  return rewardWave >= def.fragmentEligibleFromWave
}

export function eligibleFragmentBlueprints(state: GameState, rewardWave: number): BlueprintDef[] {
  return BLUEPRINTS.filter((def) => canDropBlueprintFragment(state, def.id, rewardWave))
}

export function tryCompleteAuthoredMasterySources(
  state: GameState,
  materialRank: (materialId: FoundryMaterialId) => number,
  hasCapability: (id: FoundryCapabilityId) => boolean,
): void {
  for (const def of BLUEPRINTS) {
    if (isBlueprintDiscovered(state, def.id)) continue
    for (const source of def.sources) {
      if (source.kind === 'material-mastery') {
        if (source.minRank == null || !source.materialId) continue
        if (materialRank(source.materialId) >= source.minRank) {
          completeBlueprintFromSource(state, def.id)
        }
      }
      if (source.kind === 'foundry-capability' && source.capability && hasCapability(source.capability)) {
        completeBlueprintFromSource(state, def.id)
      }
    }
  }
}

export function syncOwnedBlueprintsFromPhysical(state: GameState): void {
  for (const def of BLUEPRINTS) {
    if (!physicalProductOwned(state, def)) continue
    if (!isBlueprintDiscovered(state, def.id)) {
      state.foundry.discovered = [...state.foundry.discovered, def.id]
    }
    if (def.productKind === 'core') noteBlueprintTypeKnowledge(state, def.id)
  }
}

/** Test/debug only. Never used as a production ownership path. */
export function debugAddCoreInstance(state: GameState, moduleId: string) {
  return addCoreInstance(state.shipyard, moduleId)
}
