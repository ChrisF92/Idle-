/**
 * PR6 Relic fabrication / upgrade numeric seeds.
 *
 * Canonical does not author Relic recipes. Values are PR11-tunable.
 * Socket-class Tier I tables are generic recipe *templates*. They are not
 * bound to a final family until that family's socket class is authored.
 * Standard and Behavioural families use the same cost tables.
 */

import {
  authoredRelicSocket,
  isRelicFamilyFabricatable,
  resolveRelicDescriptor,
  type RelicTier,
} from './relicCatalogue'
import type { FoundryMaterialId, RelicSocketClass } from './types'

export interface RelicRecipeSeed {
  craftTime: number
  costs: { materials: Partial<Record<FoundryMaterialId, number>> }
}

/**
 * Generic Tier I recipe templates by socket class.
 * Not assigned to any production family while socket classes are pending.
 *
 * - Power: 4 Conductive Filament + 2 Recovered Stock, 90s
 * - Optical: 4 Optical Glass + 2 Conductive Filament, 90s
 * - Ballistic: 4 Ballistic Composite + 2 Recovered Stock, 90s
 * - Shield: 4 Shield Lattice + 2 Tempered Alloy, 90s
 * - Industrial: 4 Control Mesh + 2 Recovered Stock, 90s
 * - Universal: 4 Control Mesh + 2 Resonant Ceramic, 120s
 */
export const GENERIC_SOCKET_T1_SEEDS: Record<RelicSocketClass, RelicRecipeSeed> = {
  power: {
    craftTime: 90,
    costs: { materials: { 'conductive-filament': 4, 'recovered-stock': 2 } },
  },
  optical: {
    craftTime: 90,
    costs: { materials: { 'optical-glass': 4, 'conductive-filament': 2 } },
  },
  ballistic: {
    craftTime: 90,
    costs: { materials: { 'ballistic-composite': 4, 'recovered-stock': 2 } },
  },
  shield: {
    craftTime: 90,
    costs: { materials: { 'shield-lattice': 4, 'tempered-alloy': 2 } },
  },
  industrial: {
    craftTime: 90,
    costs: { materials: { 'control-mesh': 4, 'recovered-stock': 2 } },
  },
  universal: {
    craftTime: 120,
    costs: { materials: { 'control-mesh': 4, 'resonant-ceramic': 2 } },
  },
}

/**
 * Untyped T2/T3 infrastructure base while a family's socket class is
 * unauthored. Same numbers as the Power T1 *template*, but not bound to a
 * family or claimed as that family's authored recipe.
 *
 * - 4 Conductive Filament + 2 Recovered Stock, 90s
 */
export const GENERIC_UPGRADE_T1_BASE: RelicRecipeSeed = {
  craftTime: 90,
  costs: { materials: { 'conductive-filament': 4, 'recovered-stock': 2 } },
}

function scaleMaterials(
  materials: Partial<Record<FoundryMaterialId, number>> | undefined,
  factor: number,
): Partial<Record<FoundryMaterialId, number>> {
  const out: Partial<Record<FoundryMaterialId, number>> = {}
  for (const [id, n] of Object.entries(materials ?? {})) {
    if (!n) continue
    out[id as FoundryMaterialId] = Math.max(1, Math.ceil(n * factor))
  }
  return out
}

function withExtra(
  base: Partial<Record<FoundryMaterialId, number>>,
  extra: Partial<Record<FoundryMaterialId, number>>,
): Partial<Record<FoundryMaterialId, number>> {
  const out = { ...base }
  for (const [id, n] of Object.entries(extra)) {
    if (!n) continue
    const key = id as FoundryMaterialId
    out[key] = (out[key] ?? 0) + n
  }
  return out
}

/** Generic Tier I template for an authored socket class. */
export function relicTier1RecipeForSocket(socket: RelicSocketClass): RelicRecipeSeed {
  return structuredClone(GENERIC_SOCKET_T1_SEEDS[socket])
}

/**
 * Tier I fabrication seed for a family. `null` when socket class is pending
 * so production families are not bound to an invented template.
 */
export function relicTier1Recipe(familyId: string): RelicRecipeSeed | null {
  const def = resolveRelicDescriptor(familyId)
  if (!def || !isRelicFamilyFabricatable(def)) return null
  const socket = authoredRelicSocket(def)
  if (!socket) return null
  return relicTier1RecipeForSocket(socket)
}

/**
 * Upgrade seeds (generic infrastructure):
 * II = 2.5× base materials + 2 Phase Crystal, 180s
 * III = 2.5× Tier II materials + 2 Thermal Conductor, 300s
 *
 * Base is the family's authored T1 template when its socket is authored,
 * otherwise GENERIC_UPGRADE_T1_BASE.
 */
export function relicUpgradeFromBase(base: RelicRecipeSeed, toTier: 2 | 3): RelicRecipeSeed {
  if (toTier === 2) {
    return {
      craftTime: 180,
      costs: {
        materials: withExtra(scaleMaterials(base.costs.materials, 2.5), { 'phase-crystal': 2 }),
      },
    }
  }
  const t2 = relicUpgradeFromBase(base, 2)
  return {
    craftTime: 300,
    costs: {
      materials: withExtra(scaleMaterials(t2.costs.materials, 2.5), { 'thermal-conductor': 2 }),
    },
  }
}

export function relicUpgradeBaseForFamily(familyId: string): RelicRecipeSeed {
  const def = resolveRelicDescriptor(familyId)
  const socket = def ? authoredRelicSocket(def) : null
  if (socket) return relicTier1RecipeForSocket(socket)
  return structuredClone(GENERIC_UPGRADE_T1_BASE)
}

export function relicUpgradeRecipe(familyId: string, toTier: 2 | 3): RelicRecipeSeed {
  return relicUpgradeFromBase(relicUpgradeBaseForFamily(familyId), toTier)
}

export function relicRecipeForTier(familyId: string, tier: RelicTier): RelicRecipeSeed | null {
  if (tier === 1) return relicTier1Recipe(familyId)
  return relicUpgradeRecipe(familyId, tier)
}

export const RELIC_UPGRADE_JOB_PREFIX = 'upgrade:t'

export function relicUpgradeJobId(instanceId: string, toTier: 2 | 3): string {
  return `${RELIC_UPGRADE_JOB_PREFIX}${toTier}:${instanceId}`
}

export function familyIdFromRelicInstanceId(instanceId: string): string | null {
  const cut = instanceId.lastIndexOf(':')
  if (cut <= 0) return null
  const familyId = instanceId.slice(0, cut)
  return familyId.length > 0 ? familyId : null
}

export function parseRelicUpgradeJob(
  jobId: string,
): { instanceId: string; toTier: 2 | 3; familyId: string } | null {
  const match = /^upgrade:t([23]):(.+)$/.exec(jobId)
  if (!match) return null
  const toTier = Number(match[1]) as 2 | 3
  const instanceId = match[2]
  if (!instanceId) return null
  const familyId = familyIdFromRelicInstanceId(instanceId)
  if (!familyId) return null
  return { instanceId, toTier, familyId }
}

export function isRelicUpgradeJobId(jobId: string): boolean {
  return parseRelicUpgradeJob(jobId) != null
}
