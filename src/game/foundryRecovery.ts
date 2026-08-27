/**
 * Direct enemy-family material recovery.
 *
 * Accelerates Processing. Never replaces it. Never grants Material Mastery XP.
 *
 * Keyed by canonical family identity (Swarm / Armored / Veil / Siege / Choir / Apex).
 * Current production families that already match (swarm, armored) are wired.
 * PR7 populates Veil / Siege / Choir / Apex. Legacy ids such as ethereal /
 * divine / titan are NOT silently remapped.
 */

import type { FoundryMaterialId, GameState } from './types'
import { DIRECT_RECOVERY_BOSS_MULT, DIRECT_RECOVERY_CHANCE } from './foundrySeeds'
import { FOUNDRY_MATERIAL_NAMES, isFoundryMaterialId } from './foundryCatalogue'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export const CANONICAL_FAMILY_MATERIALS: Record<string, FoundryMaterialId[]> = {
  swarm: ['recovered-stock', 'conductive-filament', 'ballistic-composite'],
  armored: ['recovered-stock', 'tempered-alloy'],
  veil: ['optical-glass', 'shield-lattice', 'phase-crystal'],
  siege: ['conductive-filament', 'ballistic-composite', 'control-mesh'],
  choir: ['resonant-ceramic', 'thermal-conductor'],
  apex: ['control-mesh', 'phase-crystal', 'nanite-compound', 'crown-matrix'],
}

export function recoveredMaterialsForFamily(family: string): FoundryMaterialId[] {
  return CANONICAL_FAMILY_MATERIALS[family] ?? []
}

export interface MaterialRecoveryResult {
  materialId: FoundryMaterialId
  amount: number
}

export function grantDirectMaterial(
  state: GameState,
  materialId: FoundryMaterialId,
  amount = 1,
): void {
  if (!isFoundryMaterialId(materialId) || amount <= 0) return
  state.foundry.materials[materialId] = (state.foundry.materials[materialId] ?? 0) + amount
}

export function rollDirectMaterialRecovery(
  state: GameState,
  unit: { family: string; isBoss?: boolean; rewardWeight?: number },
  rng: () => number = Math.random,
): MaterialRecoveryResult[] {
  if (careerBestWave(state) < ACT1_CADENCE.foundry) return []
  const pool = recoveredMaterialsForFamily(unit.family)
  if (pool.length === 0) return []
  let chance = DIRECT_RECOVERY_CHANCE * Math.max(0, Math.min(1, unit.rewardWeight ?? 1))
  if (unit.isBoss) chance = Math.min(1, chance * DIRECT_RECOVERY_BOSS_MULT)
  if (rng() > chance) return []
  const materialId = pool[Math.floor(rng() * pool.length)]!
  grantDirectMaterial(state, materialId, 1)
  return [{ materialId, amount: 1 }]
}

export function recoveryMaterialName(id: FoundryMaterialId): string {
  return FOUNDRY_MATERIAL_NAMES[id]
}
