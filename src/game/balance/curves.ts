/**
 * Named Act 1 balance curves (GDD Phase 9).
 *
 * Each export is a live constant already used by combat / economy / Workshop /
 * Matter. This file exists so later balance PRs can change **one layer**
 * without hunting magic numbers. Do not retune several layers in the same PR.
 *
 * Layers:
 * - Enemy hull / damage vs Wave (central exponential curves live in enemyScaling.ts)
 * - Salvage income
 * - Scrap income
 * - Workshop starting power
 * - Matter
 * - Reclaim compression
 */

export { salvageWaveBase, salvageFromKill } from '../combat'

export {
  ACT1_ENEMY_SCALING,
  ENEMY_DAMAGE_SCALE,
  ENEMY_HULL_SHIELD_SCALE,
  ENEMY_REWARD_SCALE,
  enemyDamageScale,
  enemyScalingAtWave,
  enemyWaveScale,
} from '../enemyScaling'

export {
  RUN_UPGRADE_COST_BASE,
  RUN_UPGRADE_COST_GROWTH,
  RUN_UPGRADE_POWER_SCALE,
  RUN_UPGRADE_POWER_SCALE_OPENING,
  RUN_UPGRADE_OPENING_RANKS,
  WORKSHOP_WEAPON_POWER_PER_LEVEL,
  WORKSHOP_CYCLE_RATE_PER_LEVEL,
  WORKSHOP_HULL_PER_LEVEL,
  WORKSHOP_SHIELD_PER_LEVEL,
  WORKSHOP_SALVAGE_KILL_PER_LEVEL,
} from '../workshop'

export { EXTRACTION_SCRAP_BONUS } from '../extraction'

export { REBUILD_MIN_WAVE, REBUILD_MIN_SORTIES } from '../rebuild'

export const CURVE_LAYERS = [
  'enemy-hull',
  'enemy-damage',
  'salvage',
  'scrap',
  'workshop-start',
  'matter',
  'reclaim',
] as const

export type CurveLayer = (typeof CURVE_LAYERS)[number]
