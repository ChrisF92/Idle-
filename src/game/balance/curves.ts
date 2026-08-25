/**
 * Named Act 1 balance curves (GDD Phase 9).
 *
 * Each export is a live constant already used by combat / economy / Workshop /
 * Matter. This file exists so later balance PRs can change **one layer**
 * without hunting magic numbers. Do not retune several layers in the same PR.
 *
 * Layers:
 * - Enemy hull / damage vs Wave (band scale still lives in combat.ts)
 * - Salvage income
 * - Scrap income
 * - Workshop starting power
 * - Matter
 * - Reclaim compression
 */

export {
  ENEMY_HULL_BASE,
  ENEMY_HULL_OPENING,
  ENEMY_HULL_EARLY,
  ENEMY_HULL_MID,
  ENEMY_HULL_LATE,
  ENEMY_DMG_BASE,
  ENEMY_DMG_OPENING,
  ENEMY_DMG_EARLY,
  ENEMY_DMG_MID,
  ENEMY_DMG_LATE,
  ENEMY_OPENING_SECTOR as ENEMY_OPENING_BAND,
  ENEMY_EARLY_SECTOR as ENEMY_EARLY_BAND,
  ENEMY_MID_SECTOR as ENEMY_MID_BAND,
  ENEMY_WAVE_HULL_RAMP,
  salvageSectorBase,
  salvageFromKill,
  SALVAGE_MID_EXPONENT,
  SALVAGE_LATE_EXPONENT,
} from '../combat'

export {
  RUN_UPGRADE_COST_BASE,
  RUN_UPGRADE_COST_GROWTH,
  RUN_UPGRADE_POWER_SCALE,
  RUN_UPGRADE_POWER_SCALE_OPENING,
  RUN_UPGRADE_OPENING_RANKS,
  EXTRACTION_SCRAP_BONUS,
  RUN_UPGRADE_CAP,
  WORKSHOP_WEAPON_POWER_PER_LEVEL,
  WORKSHOP_CYCLE_RATE_PER_LEVEL,
  WORKSHOP_HULL_PER_LEVEL,
  WORKSHOP_SHIELD_PER_LEVEL,
  WORKSHOP_SALVAGE_KILL_PER_LEVEL,
  RECLAIM_PER_TEN_WAVES,
  RECLAIM_SPEED_CAP,
} from '../workshop'

export { REBUILD_SCRAP_PER_MATTER, REBUILD_MIN_WAVE, REBUILD_MIN_SORTIES } from '../rebuild'

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
