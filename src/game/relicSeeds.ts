/**
 * PR6 Relic fabrication / upgrade numeric seeds.
 *
 * Canonical does not author Relic recipes. Values are PR11-tunable.
 * Standard and Behavioural families use the same cost tables.
 */

import type { RelicFamilyId, RelicTier } from './relicCatalogue'
import { getRelicFamily } from './relicCatalogue'
import type { FoundryMaterialId, RelicSocketClass } from './types'

export interface RelicRecipeSeed {
  craftTime: number
  costs: { materials: Partial<Record<FoundryMaterialId, number>> }
}

const SOCKET_T1: Record<RelicSocketClass, RelicRecipeSeed> = {
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

/** Tier I fabrication seed for a family. Same for Standard and Behavioural. */
export function relicTier1Recipe(familyId: RelicFamilyId): RelicRecipeSeed {
  const def = getRelicFamily(familyId)
  if (!def) return SOCKET_T1.industrial
  return structuredClone(SOCKET_T1[def.socket])
}

/**
 * Upgrade seeds:
 * II = 2.5× Tier I materials + 2 Phase Crystal, 180s
 * III = 2.5× Tier II materials + 2 Thermal Conductor, 300s
 */
export function relicUpgradeRecipe(familyId: RelicFamilyId, toTier: 2 | 3): RelicRecipeSeed {
  const t1 = relicTier1Recipe(familyId)
  if (toTier === 2) {
    return {
      craftTime: 180,
      costs: {
        materials: withExtra(scaleMaterials(t1.costs.materials, 2.5), { 'phase-crystal': 2 }),
      },
    }
  }
  const t2 = relicUpgradeRecipe(familyId, 2)
  return {
    craftTime: 300,
    costs: {
      materials: withExtra(scaleMaterials(t2.costs.materials, 2.5), { 'thermal-conductor': 2 }),
    },
  }
}

export function relicRecipeForTier(familyId: RelicFamilyId, tier: RelicTier): RelicRecipeSeed {
  if (tier === 1) return relicTier1Recipe(familyId)
  return relicUpgradeRecipe(familyId, tier)
}

export const RELIC_UPGRADE_JOB_PREFIX = 'upgrade:t'

export function relicUpgradeJobId(instanceId: string, toTier: 2 | 3): string {
  return `${RELIC_UPGRADE_JOB_PREFIX}${toTier}:${instanceId}`
}

export function parseRelicUpgradeJob(
  jobId: string,
): { instanceId: string; toTier: 2 | 3 } | null {
  const match = /^upgrade:t([23]):(.+)$/.exec(jobId)
  if (!match) return null
  const toTier = Number(match[1]) as 2 | 3
  const instanceId = match[2]
  if (!instanceId) return null
  return { instanceId, toTier }
}

export function isRelicUpgradeJobId(jobId: string): boolean {
  return parseRelicUpgradeJob(jobId) != null
}
