/**
 * PR5 Foundry / Worker / Blueprint numeric seeds.
 *
 * These are implementation/simulator values for PR11 tuning, not locked
 * canonical design. Canonical design leaves ratios, times, XP, fragment
 * counts, fabrication costs, and infrastructure magnitudes unspecified.
 */

import type { FoundryMaterialId } from './types'

/** Scrap / material / Ash paid per Processing cycle. Output is always 1. */
export const PROCESSING_INPUTS: Record<
  FoundryMaterialId,
  { scrap?: number; ash?: number; materials?: Partial<Record<FoundryMaterialId, number>> }
> = {
  'recovered-stock': { scrap: 8 },
  'conductive-filament': { scrap: 6 },
  'tempered-alloy': { scrap: 4, materials: { 'recovered-stock': 2 } },
  'ballistic-composite': { materials: { 'recovered-stock': 2, 'conductive-filament': 2 } },
  'optical-glass': { scrap: 4, materials: { 'conductive-filament': 2 } },
  'shield-lattice': { materials: { 'tempered-alloy': 2, 'conductive-filament': 2 } },
  'control-mesh': { materials: { 'optical-glass': 2, 'conductive-filament': 2 } },
  'phase-crystal': { materials: { 'optical-glass': 3 } },
  'nanite-compound': { materials: { 'control-mesh': 2, 'tempered-alloy': 2 } },
  'resonant-ceramic': { ash: 10, materials: { 'tempered-alloy': 2 } },
  'thermal-conductor': {
    ash: 15,
    materials: { 'resonant-ceramic': 2, 'conductive-filament': 2 },
  },
  'crown-matrix': {},
}

/** Real-time seconds for one Processing cycle. */
export const PROCESSING_SECONDS: Record<FoundryMaterialId, number> = {
  'recovered-stock': 20,
  'conductive-filament': 20,
  'tempered-alloy': 40,
  'ballistic-composite': 45,
  'optical-glass': 45,
  'shield-lattice': 60,
  'control-mesh': 75,
  'phase-crystal': 90,
  'nanite-compound': 120,
  'resonant-ceramic': 90,
  'thermal-conductor': 120,
  'crown-matrix': 180,
}

/** Material Mastery XP awarded to the OUTPUT material per completed cycle. */
export const MATERIAL_MASTERY_XP_PER_CYCLE = 1

/**
 * Cumulative XP required to sit at rank 0..5.
 * Rank 5 is the cap. Further XP is ignored.
 */
export const MATERIAL_MASTERY_XP_CUMULATIVE = [0, 4, 10, 20, 36, 60] as const

export const MATERIAL_MASTERY_MAX_RANK = 5

/** Duplicate Core/Frame fabrication cost multiplier after the first physical copy. */
export const FABRICATION_DUPLICATE_COST_MULT = 0.7

/** Base Worker capacity before Matter Racks / later Research. */
export const BASE_WORKER_CAPACITY = 6

/** Worker Fabricator job. */
export const WORKER_FABRICATION_SECONDS = 90
export const WORKER_FABRICATION_COST = {
  scrap: 20,
  materials: { 'recovered-stock': 8, 'conductive-filament': 4 },
} as const

export const INFRASTRUCTURE_MAX_OWNED = {
  'processing-line': 2,
  'fabrication-bay': 2,
  'worker-fabricator': 1,
  'research-annex': 1,
  'recovery-storage': 1,
} as const

export const INFRASTRUCTURE_SECONDS = {
  'processing-line': 8 * 60,
  'fabrication-bay': 10 * 60,
  'worker-fabricator': 12 * 60,
  'research-annex': 15 * 60,
  'recovery-storage': 8 * 60,
} as const

export const RESEARCH_ANNEX_SPEED_MULT = 1.25
export const RECOVERY_STORAGE_SALVAGE_OPS_MULT = 1.25

/** Base chance a matching-family kill grants one direct material. */
export const DIRECT_RECOVERY_CHANCE = 0.04
export const DIRECT_RECOVERY_BOSS_MULT = 2.2

/** Base chance an eligible kill grants one Blueprint-specific schematic fragment. */
export const FRAGMENT_DROP_CHANCE = 0.025
export const FRAGMENT_DROP_BOSS_MULT = 2.2

/** Fragments may begin dropping this many Waves before the guaranteed source Wave. */
export const FRAGMENT_ELIGIBILITY_LEAD_WAVES = 40

/**
 * Worker contribution curve (existing industrial seed, centralized).
 * Full value through `efficient`, then 0.35× through `hard`.
 */
export const WORKER_CONTRIBUTION_EXCESS = 0.35
export const WORKER_SPEED_PER_CONTRIBUTION = 0.12
