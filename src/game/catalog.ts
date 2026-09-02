/** Game content catalogs — costs, unlocks, and combat profiles. */

import { LEGACY_CORE_IDS, SHIP_MODULE_DEFS } from './coreCatalogue'
import { careerBestWave, isSystemUnlocked } from './progression'
import { WORKER_JOB_IDS, workerCapacity, workerJobContribution, workerJobHasWork } from './workers'
import { BASE_WORKER_CAPACITY, WORKER_FABRICATION_SECONDS } from './foundrySeeds'
import { ACT1_CADENCE } from './cadence'
import { formatCompact, formatStat } from './format'
import { resolvedResearchIds, sumResearchNumber } from './hiveResearchTree'
import {
  MATTER_SHOP,
  MATTER_SHOP_CATEGORIES,
  canBuyMatterShop as canBuyCanonicalMatterShop,
  getMatterShopItem as getCanonicalMatterItem,
  matterShopEffectBlurb as canonicalMatterBlurb,
  matterShopItemsIn as canonicalMatterItemsIn,
  type MatterShopCategory,
  type MatterShopDef,
} from './matter'
import {
  BLUEPRINTS as FOUNDRY_BLUEPRINTS,
  blueprintFragmentCount,
  getBlueprint,
  isBlueprintDiscovered,
} from './blueprints'
import type {
  CoreAttrId,
  GameState,
  RelicSocketSpec,
  Resources,
  WeaponDelivery,
  WeaponTag,
} from './types'

export {
  MATTER_SHOP,
  MATTER_SHOP_CATEGORIES,
  type MatterShopCategory,
  type MatterShopDef,
}

export { getBlueprint }

export type ResourceCost = Partial<Record<keyof Resources, number>>

/** Named production stations — worker drones are assigned here (ITRTG-style). */
export interface StationDef {
  id: string
  name: string
  description: string
  requiresResearch?: string
  /** System that must be unlocked before drones can be assigned. */
  requiresSystem?: 'base' | 'network' | 'research' | 'ai' | 'prestige' | 'core' | 'foundry'
  /** Resource rates per assigned worker drone (per second). */
  rates: ResourceCost
  /** Scrap drained per assigned drone per second (Foundry-style). */
  upkeepScrapPerDrone?: number
  /** Extra docked hull repair per second per drone. */
  repairPerDrone?: number
  /** Multiplier added to worker manufacture speed per drone (0.25 = +25%). */
  manufactureBonusPerDrone?: number
  /**
   * Effective-drone slots to black-bar this station.
   * 0 / omitted = uncapped (Core training overflow sink).
   */
  baseSlots?: number
  /** Production stations show in Base; training stations only on Core tab. */
  kind?: 'production' | 'training' | 'special'
  /** Core attribute trained by this station (training kind). */
  trainsAttr?: CoreAttrId
}

export interface ResearchDef {
  id: string
  name: string
  description: string
  costData: number
  costEssence?: number
  damageBonus?: number
  essenceBonus?: number
  /** Multiplier on worker drone manufacture speed. */
  manufactureBonus?: number
  /** Additive Core training speed bonus (0.5 = +50%). */
  trainingBonus?: number
  /** Flat permanent bonus to worker drone corps capacity. */
  droneCapBonus?: number
  /** Additive drone power (0.1 = +10%). */
  dronePowerBonus?: number
}

export interface AiNodeDef {
  id: string
  name: string
  description: string
  costAiPoints: number
  kind: 'automation' | 'doctrine' | 'qol'
  /** If true (default for automation/qol), kept across prestige. */
  permanent?: boolean
  /** Career best Wave required before this node can be bought. */
  requiresBestWave?: number
  /** Must own this AI node first. */
  requiresAiNode?: string
  /** Extra manufacture speed while owned (permanent AI). */
  manufactureBonus?: number
  /** Additive Core training speed bonus (0.4 = +40%). */
  trainingBonus?: number
  /** Additive station production bonus (0.4 = +40%). Non-combat. */
  productionBonus?: number
  /**
   * Multiplier on drone power for station saturation (1.35 = each drone
   * counts as 1.35 toward black-bar). Highest owned wins.
   */
  droneEfficiencyMult?: number
  /** Flat permanent bonus to worker drone corps capacity. */
  droneCapBonus?: number
  /** Additive Fabrication Bay craft speed (0.5 = +50%). Non-combat. */
  fabBonus?: number
}

export interface EssenceUpgradeDef {
  id: string
  name: string
  description: string
  costEssence: number
  /** @deprecated Unused — essence no longer grants flat combat damage. */
  damageBonus?: number
  hullBonus?: number
  /** @deprecated Unused — essence no longer grants flat production. */
  productionBonus?: number
  bonusDataPerClear?: number
  /** Additive boss essence gain (0.5 = +50%). */
  bossEssenceBonus?: number
  /** Additive offline essence gain (0.5 = +50%). */
  offlineEssenceBonus?: number
  /** Fraction of Alloy Foundry scrap upkeep removed (0.25 = −25%). */
  alloyUpkeepReduction?: number
}

export interface ModuleWeaponDef {
  name: string
  /** USI-style base damage at Core level 0. */
  damage: number
  /** Flat damage added per Salvage level (USI Laser Cannon: +5). */
  damagePerLevel?: number
  cooldown: number
  /** Lane distance the weapon can reach. */
  range: number
  tags: WeaponTag[]
  splash?: number
  /** Flak / area weapons: explosion radius in simulation units. */
  explosionRadius?: number
  dotDuration?: number
  dotDamage?: number
  /** USI hull / shield / armor damage multipliers. */
  hullDamage?: number
  shieldDamage?: number
  armorDamage?: number
  /** Connected beam vs travelling bolt. Charge lasers use telegraph + bolt. */
  delivery?: WeaponDelivery
  /** Wind-up before the shot (player Charge Prism / enemy snipers). */
  telegraphDuration?: number
}

export type ModuleRole = 'weapon' | 'defense' | 'utility'

export type FrameUnlockSource = 'start' | 'wave' | 'material-mastery' | 'challenge'

export type CoreUnlockSource =
  | 'start'
  | 'wave'
  | 'material-mastery'
  | 'foundry'
  | 'challenge'
  | 'furnace'

export type CoreSlewClass = 'slow' | 'medium' | 'fast' | 'very-fast'

export const STARTER_FRAME_ID = 'starter-frame'
export const STANDARD_FRAME_ID = STARTER_FRAME_ID
export const SWARM_FRAME_ID = 'swarm-frame'

export interface ShipFrameDef {
  id: string
  name: string
  description: string
  /** Short identity line shown in Frame presentation. */
  identity: string
  /** Meaningful tradeoff vs other Frames. */
  tradeoff: string
  /**
   * Intrinsic Hive weapon damage. Act 1 Frames fire only equipped Cores —
   * starter hulls use 0 (no free frame battery).
   */
  baseDamage: number
  baseHull: number
  baseShield?: number
  /** Multiplier on Hive hull after modules. */
  hullMult?: number
  /** Multiplier on Hive shield after modules. */
  shieldMult?: number
  /** Multiplier on fitted Core weapon damage. */
  coreDamageMult?: number
  /** Combat Salvage pickup multiplier. Combat rewards only. */
  salvageMult?: number
  /** Combat scrap drop multiplier. Combat rewards only. */
  scrapMult?: number
  /** Combat Ash drop multiplier. Combat rewards only. */
  ashMult?: number
  /** Ash → Heat conversion multiplier. PR8 Furnace consumes this. */
  heatMult?: number
  /** Furnace channel output multiplier. PR8 consumes this. Never extra channels. */
  furnaceOutputMult?: number
  /** Always 0 in Act 1. Exposed so PR8 does not invent extra Reactor channels. */
  extraFurnaceChannels: 0
  /** Modest targeting responsiveness. Composed through PR2 slew modifiers. */
  targetingSlewMult?: number
  /** Offline Foundry must stay 1. Harvester never exploits industry. */
  foundryOutputMult?: number
  unlockCost: ResourceCost
  unlockSource: FrameUnlockSource
}

export interface ShipModuleDef {
  id: string
  name: string
  role: ModuleRole
  description: string
  identity: string
  /** Simulation orbit radius. Canonical seed band 38–58. */
  orbitRadius: number
  unlockSource: CoreUnlockSource
  /** Mature Relic socket layout. PR6 consumes this; PR4 authors it. */
  matureSockets: RelicSocketSpec[]
  /** Used for DPS estimates when no weapon profile is present. */
  damageBonus: number
  hullBonus: number
  hullBonusPerLevel?: number
  armorBonus?: number
  armorBonusPerLevel?: number
  shieldBonus?: number
  shieldBonusPerLevel?: number
  /**
   * In-combat shield regen as a fraction of max shields per second.
   */
  shieldRegen?: number
  evasionBonus?: number
  damageTakenMult: number
  weapon?: ModuleWeaponDef
  escorts?: number
  salvageKillBonus?: number
  unlockCost: ResourceCost
  requiresBestWave?: number
}

/** Rebuild hangar gate. cadence.ts is dependency-free, so this stays cycle-safe. */
export const PRESTIGE_MIN_SECTOR = ACT1_CADENCE.rebuild

/** Base seconds to manufacture one worker drone at 1.0 speed. */
export const WORKER_MANUFACTURE_SECONDS = WORKER_FABRICATION_SECONDS

/** Fresh-career worker capacity before Matter Racks / later Research. */
export const BASE_DRONE_CAP = BASE_WORKER_CAPACITY
/** Lifetime drones built per +1 permanent corps capacity. */
export const LIFETIME_DRONES_PER_CAP = 20
/** Soft ceiling on lifetime-built capacity raises. */
export const LIFETIME_DRONE_CAP_MAX = 50
/** Corps racks Link: +1 drone cap per rank. */
export const NETWORK_RACK_CAP_PER_RANK = 1
/** Drone acuity Link: +8% efficiency per rank. */
export const NETWORK_ACUITY_PER_RANK = 0.08

export const STATIONS: StationDef[] = [
  {
    id: 'scrap-field',
    name: 'Salvage Operations',
    description: 'Worker Drones haul debris into usable Scrap.',
    requiresSystem: 'base',
    rates: { scrap: 0.4 },
    baseSlots: 20,
  },
  {
    id: 'sensor-net',
    name: 'Research',
    description: 'Worker Drones accelerate the active Research project.',
    requiresSystem: 'network',
    rates: {},
    baseSlots: 16,
  },
  {
    id: 'alloy-foundry',
    name: 'Processing',
    description: 'Workers speed Foundry Processing.',
    requiresSystem: 'foundry',
    rates: {},
    baseSlots: 12,
  },
  {
    id: 'drone-fab',
    name: 'Worker Drone Fabrication',
    description: 'Worker Drones manufacture the next Worker Drone. Needs a Fabricator.',
    requiresSystem: 'foundry',
    rates: {},
    manufactureBonusPerDrone: 0.35,
    baseSlots: 10,
  },
  {
    id: 'fab-bay',
    name: 'Fabrication',
    description: 'Workers speed Foundry Fabrication of Cores and Relics.',
    requiresSystem: 'foundry',
    rates: {},
    kind: 'special',
    baseSlots: 8,
  },
  {
    id: 'construction',
    name: 'Infrastructure',
    description: 'Worker Drones accelerate an active Infrastructure project.',
    requiresSystem: 'foundry',
    rates: {},
    kind: 'special',
    baseSlots: 8,
  },
]

/** Leftover Data shop. Unlocks stations only — combat / essence / training bonuses are frozen. */
export const RESEARCH: ResearchDef[] = [
  {
    id: 'basic-optics',
    name: 'Basic Optics',
    description: 'Improves sensor calibration. Prerequisite for later research. Permanent.',
    costData: 35,
  },
  {
    id: 'alloy-smelting',
    name: 'Materials Processing',
    description: 'Unlocks the Foundry Processing station. Permanent.',
    costData: 45,
  },
  {
    id: 'module-fab',
    name: 'Module Fabrication',
    description: 'Unlocks timed Fabrication projects for completed Blueprints. Permanent.',
    costData: 110,
  },
  {
    id: 'core-training',
    name: 'Core Training',
    description:
      'Unlocks the Core tab and five training stations for run attributes (ranks still wipe). Permanent unlock.',
    costData: 130,
  },
  {
    id: 'drone-logistics',
    name: 'Drone Logistics',
    description: 'Unlocks the Drone Fabricator and raises corps capacity by +5. Permanent.',
    costData: 55,
    droneCapBonus: 5,
  },
  {
    id: 'tactical-codex',
    name: 'Tactical Codex',
    description:
      'Unlocks the Codex permanently: enemy family intel and soft counters (survives Rebuild).',
    costData: 50,
  },
  {
    id: 'core-drills',
    name: 'Core Drills',
    description: '+35% Core attribute training speed. Permanent.',
    costData: 120,
  },
  {
    id: 'entity-anatomy',
    name: 'Entity Anatomy',
    description: 'Deep autopsy protocols. +25% Essence from bosses. Required for advanced study. Permanent.',
    costData: 150,
  },
  {
    id: 'boss-harvester',
    name: 'Boss Harvester',
    description: 'Extract more Essence from bosses (+100%). Permanent.',
    costData: 70,
    costEssence: 1,
  },
]

export const AI_NODES: AiNodeDef[] = [
  {
    id: 'auto-engage',
    name: 'Rapid Recovery',
    description: 'Doubles hull / shield repair rate while Paused and out of combat.',
    costAiPoints: 1,
    kind: 'automation',
    permanent: true,
  },
  {
    id: 'auto-dock-critical',
    name: 'Crisis Patching',
    description:
      'Much faster out-of-combat hull / shield repair while Hive hull is below 35%. Does not Pause combat.',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'auto-launch-ready',
    name: 'Field Repairs',
    description:
      'Much faster hull / shield regen out of combat while undocked. Never Pauses or Resumes for you.',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'auto-assign-workers',
    name: 'Labor Router',
    description:
      'Industry presets (Balanced / Scrap / Data / Foundry-Safe), Fill, Clear, and +5 assign buttons.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 60,
  },
  {
    id: 'labor-loop',
    name: 'Labor Loop',
    description:
      'Continuously re-applies your Labor Router profile when drones finish manufacturing or sit idle.',
    costAiPoints: 4,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 100,
    requiresAiNode: 'auto-assign-workers',
  },
  {
    id: 'drone-hangar',
    name: 'Expanded Hangar',
    description: '+8 worker drone corps capacity.',
    costAiPoints: 3,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 80,
    droneCapBonus: 8,
  },
  {
    id: 'drone-efficiency-1',
    name: 'Swarm Optics',
    description:
      '+35% Worker Drone contribution to real jobs.',
    costAiPoints: 4,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 120,
    droneEfficiencyMult: 1.35,
  },
  {
    id: 'drone-efficiency-2',
    name: 'Hive Calibration',
    description: '+65% Worker Drone contribution to real jobs. Requires Swarm Optics.',
    costAiPoints: 8,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 180,
    requiresAiNode: 'drone-efficiency-1',
    droneEfficiencyMult: 1.65,
  },
  {
    id: 'fabricator-overclock',
    name: 'Fabricator Overclock',
    description: '+50% worker drone manufacture speed (still stops at corps capacity).',
    costAiPoints: 3,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 100,
    manufactureBonus: 0.5,
  },
  {
    id: 'neural-drill',
    name: 'Neural Drill',
    description: '+40% Core attribute training speed (permanent).',
    costAiPoints: 3,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 120,
    trainingBonus: 0.4,
  },
  {
    id: 'salvage-optimizer',
    name: 'Salvage Optimizer',
    description: 'Unlocks Upgrade Cheapest: spend salvage on the lowest-level owned module.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'batch-refit',
    name: 'Batch Refit',
    description: 'Unlocks Unequip All in the Shipyard while Paused.',
    costAiPoints: 1,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'hold-accountant',
    name: 'Hold Accountant',
    description: 'Shows estimated clear rewards while farming on Hold.',
    costAiPoints: 1,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'warp-navigator',
    name: 'Warp Navigator',
    description: 'Leftover Warp control. Hiveworks Sorties always start at Wave 1.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresBestWave: 80,
  },
  {
    id: 'focus-fire',
    name: 'Focus Fire',
    description: 'Doctrine: +6% weapon damage; AI prioritizes weakest targets.',
    costAiPoints: 2,
    kind: 'doctrine',
    permanent: false,
  },
  {
    id: 'boss-protocol',
    name: 'Boss Doctrine',
    description: 'Doctrine: +25% damage vs boss units.',
    costAiPoints: 3,
    kind: 'doctrine',
    permanent: false,
  },
  {
    id: 'scavenger',
    name: 'Scavenger Sweep',
    description: 'Doctrine: +30% scrap from combat clears.',
    costAiPoints: 2,
    kind: 'doctrine',
    permanent: false,
  },
  // --- Non-combat speed ---
  {
    id: 'chrono-industry',
    name: 'Industrial Chrono',
    description: '+40% station production rates (scrap / alloys / energy). Not combat.',
    costAiPoints: 6,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 180,
    productionBonus: 0.4,
  },
  {
    id: 'chrono-fab',
    name: 'Fabrication Chrono',
    description: '+50% Fabrication Bay craft speed.',
    costAiPoints: 6,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 180,
    fabBonus: 0.5,
  },
  // --- Deep automation (USI-style) ---
  {
    id: 'auto-salvage-loop',
    name: 'Salvage Loop',
    description:
      'Automatically spends salvage on Upgrade Cheapest whenever you can afford it. Requires Salvage Optimizer.',
    costAiPoints: 6,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 160,
    requiresAiNode: 'salvage-optimizer',
  },
  {
    id: 'neural-router',
    name: 'Neural Router',
    description:
      'Idle workers auto-assign to the lowest Core training stations.',
    costAiPoints: 8,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 180,
  },
  {
    id: 'auto-fab-bay',
    name: 'Auto Fabricator',
    description:
      'Automatically starts Fab Bay projects for the most complete discovered blueprint and deposits parts.',
    costAiPoints: 10,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 200,
  },
  {
    id: 'auto-merge-signal',
    name: 'Signal Collider',
    description: 'Automatically merges unequipped Signal Cores when three matching ranks exist.',
    costAiPoints: 12,
    kind: 'automation',
    permanent: true,
    requiresBestWave: 220,
  },
]

export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'essence-lattice',
    name: 'Essence Matrix',
    description: 'Permanent +50% Essence from bosses.',
    costEssence: 2,
    bossEssenceBonus: 0.5,
  },
  {
    id: 'resonant-plates',
    name: 'Resonant Plates',
    description: 'Permanent +25 hull.',
    costEssence: 3,
    hullBonus: 25,
  },
  {
    id: 'siphon-array',
    name: 'Siphon Array',
    description: 'Permanent +1 Data on every 10-wave clear.',
    costEssence: 2,
    bonusDataPerClear: 1,
  },
  {
    id: 'catalyst-feed',
    name: 'Catalyst Feed',
    description: 'Permanent −25% Alloy Foundry scrap upkeep.',
    costEssence: 3,
    alloyUpkeepReduction: 0.25,
  },
]

/**
 * Farthest legal enemy park. Parks are role-authored and do not move when the
 * player swaps Cores. Every catalog weapon must reach this hold.
 */
export const ENEMY_PARK_MAX = 125

/** Shortest legal player Core range — must reach `ENEMY_PARK_MAX`. */
export const MIN_CORE_WEAPON_RANGE = ENEMY_PARK_MAX

export const SHIP_FRAMES: ShipFrameDef[] = [
  {
    id: STARTER_FRAME_ID,
    name: 'Standard',
    identity: 'Balanced generalist. Modest targeting responsiveness. No economic gimmick.',
    tradeoff: 'No specialist bonus — and no specialist tax. Valid at W1000.',
    description:
      'Balanced Hive and a competent W1000 hull. Modest targeting responsiveness. Sidegrades specialise; they do not obsolete Standard.',
    baseDamage: 0,
    baseHull: 40,
    targetingSlewMult: 1.08,
    extraFurnaceChannels: 0,
    foundryOutputMult: 1,
    unlockCost: {},
    unlockSource: 'start',
  },
  {
    id: 'bastion-frame',
    name: 'Bastion',
    identity: 'Hull / Shield defensive bias with a heavier, slower feel.',
    tradeoff: 'Lower offensive efficiency. Not immunity and not a mandatory survival hull.',
    description:
      'Heavier Hive with more Hull and Shield. Cores hit less hard and slew more slowly. A defensive bias, not an immunity frame.',
    baseDamage: 0,
    baseHull: 58,
    baseShield: 16,
    hullMult: 1.12,
    shieldMult: 1.2,
    coreDamageMult: 0.9,
    targetingSlewMult: 0.82,
    extraFurnaceChannels: 0,
    foundryOutputMult: 1,
    unlockCost: {},
    unlockSource: 'material-mastery',
  },
  {
    id: SWARM_FRAME_ID,
    name: 'Swarm',
    identity: 'Only Act 1 Frame with +1 Core position, capped at six.',
    tradeoff: 'Weaker Hive baseline and reduced per-Core output. The extra Core is the build.',
    description:
      'One extra universal Core position relative to the account bus, never above six. The Hive is thinner and each Core hits less hard.',
    baseDamage: 0,
    baseHull: 30,
    hullMult: 0.88,
    coreDamageMult: 0.85,
    extraFurnaceChannels: 0,
    foundryOutputMult: 1,
    unlockCost: {},
    unlockSource: 'challenge',
  },
  {
    id: 'reactor-frame',
    name: 'Reactor',
    identity: 'Ash→Heat and Furnace output specialist. Fragile baseline. No extra channels.',
    tradeoff: 'Thinner Hive. Furnace runs hotter; channel count does not increase.',
    description:
      'Improved Ash→Heat conversion and Furnace channel strength. The Hive itself is fragile. Does not grant extra Furnace channels.',
    baseDamage: 0,
    baseHull: 28,
    hullMult: 0.85,
    heatMult: 1.35,
    furnaceOutputMult: 1.2,
    extraFurnaceChannels: 0,
    foundryOutputMult: 1,
    unlockCost: {},
    unlockSource: 'wave',
  },
  {
    id: 'harvester-frame',
    name: 'Harvester',
    identity: 'Combat-economy Frame. Salvage / Scrap / Ash bias.',
    tradeoff: 'Lower frontier combat. Never multiplies offline Foundry production.',
    description:
      'Combat Salvage, Scrap, and Ash pay more. Per-Core output is lower. Foundry jobs are unchanged while this Frame is equipped.',
    baseDamage: 0,
    baseHull: 34,
    coreDamageMult: 0.8,
    salvageMult: 1.2,
    scrapMult: 1.15,
    ashMult: 1.25,
    extraFurnaceChannels: 0,
    foundryOutputMult: 1,
    unlockCost: {},
    unlockSource: 'challenge',
  },
]

/** Role counts for statistics / filters. Not slot legality. */
export function fittedRoleSlotCounts(
  moduleIds: string[],
): Record<ModuleRole, number> {
  const counts: Record<ModuleRole, number> = {
    weapon: 0,
    defense: 0,
    utility: 0,
  }
  for (const id of moduleIds) {
    const role = getModule(id)?.role
    if (role) counts[role] += 1
  }
  return counts
}

export function canFitModuleOnFrame(
  fittedModuleIds: string[],
  moduleId: string,
  usableSlots: number,
): boolean {
  if (!getModule(moduleId)) return false
  return fittedModuleIds.length < usableSlots
}

export function trimModulesToFrame(moduleIds: string[], usableSlots: number): string[] {
  const kept: string[] = []
  for (const id of moduleIds) {
    if (!getModule(id)) continue
    if (kept.length >= usableSlots) break
    kept.push(id)
  }
  return kept
}

export function frameTotalSlots(_frame: ShipFrameDef, usableSlots: number): number {
  return usableSlots
}

export function resolveFrameId(frameId: string | undefined | null): string {
  return getFrame(frameId ?? '') ? (frameId as string) : STARTER_FRAME_ID
}

export function equippedFrame(state: GameState): ShipFrameDef {
  return getFrame(resolveFrameId(state.shipyard.frameId)) ?? getFrame(STARTER_FRAME_ID)!
}

export function frameSalvageMult(state: GameState): number {
  return equippedFrame(state).salvageMult ?? 1
}

export function frameScrapMult(state: GameState): number {
  return equippedFrame(state).scrapMult ?? 1
}

export function frameAshMult(state: GameState): number {
  return equippedFrame(state).ashMult ?? 1
}

export function frameHeatMult(state: GameState): number {
  return equippedFrame(state).heatMult ?? 1
}

export function frameFurnaceOutputMult(state: GameState): number {
  return equippedFrame(state).furnaceOutputMult ?? 1
}

export function frameCoreDamageMult(state: GameState): number {
  return equippedFrame(state).coreDamageMult ?? 1
}

export function frameFoundryOutputMult(state: GameState): number {
  return equippedFrame(state).foundryOutputMult ?? 1
}

export function frameTargetingSlewMult(state: GameState): number {
  return equippedFrame(state).targetingSlewMult ?? 1
}

/** PR8 consumes this. Extra channels stay 0 for every Act 1 Frame. */
export function frameFurnaceModifiers(state: GameState): {
  ashToHeatMult: number
  furnaceOutputMult: number
  extraChannels: 0
} {
  const frame = equippedFrame(state)
  return {
    ashToHeatMult: frame.heatMult ?? 1,
    furnaceOutputMult: frame.furnaceOutputMult ?? 1,
    extraChannels: 0,
  }
}

/**
 * Locked Frames do not advertise unimplemented later-system acquisition.
 * Owned / equipped state is shown by the UI separately.
 */
export function frameUnlockLine(frame: ShipFrameDef): string {
  switch (frame.unlockSource) {
    case 'start':
      return 'Starter Frame'
    case 'material-mastery':
    case 'wave':
    case 'challenge':
      return 'Not yet obtainable'
  }
}

export function coreUnlockLine(mod: ShipModuleDef): string {
  switch (mod.unlockSource) {
    case 'start':
      return 'Starter Core'
    default:
      return 'Not yet obtainable'
  }
}

export function grantUnlockedFrame(state: GameState, frameId: string, log?: string): boolean {
  if (!getFrame(frameId)) return false
  if (state.shipyard.unlockedFrames.includes(frameId)) return false
  state.shipyard.unlockedFrames = [...state.shipyard.unlockedFrames, frameId]
  if (log) state.combat.log = [log, ...state.combat.log].slice(0, 40)
  return true
}

export { LEGACY_CORE_IDS }
export const SHIP_MODULES: ShipModuleDef[] = SHIP_MODULE_DEFS as ShipModuleDef[]

export function moduleLevel(
  levels: Record<string, number> | undefined,
  moduleId: string,
): number {
  return Math.max(0, levels?.[moduleId] ?? 0)
}

/** Starter Core definitions used by onboarding and telemetry. */
export const STARTER_CORE_IDS = ['pulse-cannon', 'plate-layer'] as const

/**
 * Percent curve for stats that are not USI-flat (evasion, incoming).
 * Damage / shield / hull use `moduleLeveledBonus` instead.
 */
export function moduleLevelMultiplier(level: number): number {
  return 1 + Math.max(0, level) * 0.08
}

/** USI-style flat stat: `base + perLevel * level`. Falls back to 8%/level when perLevel is omitted. */
export function moduleLeveledBonus(
  base: number,
  perLevel: number | undefined,
  level: number,
  mastery = 1,
): number {
  if (!base && !perLevel) return 0
  const n = Math.max(0, level)
  const value =
    perLevel != null ? base + perLevel * n : base * moduleLevelMultiplier(n)
  return value * mastery
}

export function moduleWeaponDamage(
  mod: ShipModuleDef,
  level: number,
  mastery = 1,
): number {
  if (!mod.weapon) return 0
  const per = mod.weapon.damagePerLevel ?? mod.weapon.damage * 0.5
  return moduleLeveledBonus(mod.weapon.damage, per, level, mastery)
}

/** Highest in-combat shield regen fraction among fitted Cores. */
export function fittedShieldRegenFraction(moduleIds: string[]): number {
  let best = 0
  for (const id of moduleIds) {
    const regen = getModule(id)?.shieldRegen ?? 0
    if (regen > best) best = regen
  }
  return best
}

// ── Blueprint / Fabrication Bay ─────────────────────────────────────────────

/** Seconds for one fab-bay worker to finish a filled recipe. */
export const FAB_SECONDS = 120

export const MAX_MODULE_MASTERY = 100
export const LATE_ACT1_MODULE_MASTERY = 100

export function moduleMasteryCap(_state: GameState): number {
  return MAX_MODULE_MASTERY
}

/** Leftover Foundry part cost. Core Mastery is use-driven, not part-invested. */
export const MASTERY_PARTS_COST = 3

const STARTER_UNLOCK_MODULES = new Set(['pulse-cannon', 'plate-layer'])

interface EnemyPartDropEntry {
  moduleId: string
  partType: string
  weight: number
}

interface EnemyPartDropTable {
  family: string
  entries: EnemyPartDropEntry[]
  chance: number
  bossChanceMult?: number
  bossRolls?: number
}

export function isFarmableModule(moduleId: string): boolean {
  return getBlueprint(moduleId) != null
}

export function isStarterUnlockModule(moduleId: string): boolean {
  return STARTER_UNLOCK_MODULES.has(moduleId)
}

export function isSchematicModule(_moduleId: string): boolean {
  return false
}

/** Leftover Foundry fragment tables. Final 14 Core IDs are not awarded here. */
export const ENEMY_PART_DROPS: EnemyPartDropTable[] = []

function waveBonusDropEntries(_wave: number): EnemyPartDropEntry[] {
  return []
}

export function modulePrintWave(moduleId: string): number {
  const originalWave = Math.max(0, getModule(moduleId)?.requiresBestWave ?? 0)
  if (originalWave <= 0) return ACT1_CADENCE.foundry
  return originalWave
}

/** Career has reached the Wave that unlocks this Core print. Blueprint != ownership. */
export function isCorePrintUnlocked(state: GameState, moduleId: string): boolean {
  return careerBestWave(state) >= modulePrintWave(moduleId)
}

export const GDD_ROSTER_CORE_IDS = [
  'pulse-cannon',
  'heavy-lance',
  'flak-array',
  'phase-beam',
  'slag-spitter',
  'plate-layer',
  'rapid-aegis',
  'ablative-mesh',
  'barrier-projector',
  'salvage-beacon',
  'grav-tether',
  'nano-lathe',
  'sensor-array',
  'choir-tap',
] as const

export function isGddRosterCore(moduleId: string): boolean {
  return (GDD_ROSTER_CORE_IDS as readonly string[]).includes(moduleId)
}

/** Blueprints and wreck drops show leftovers only after they are already unlocked. */
export function isCoreOnRoster(state: GameState, moduleId: string): boolean {
  return isGddRosterCore(moduleId) || state.shipyard.unlockedModules.includes(moduleId)
}

/** Career print is unlocked and the fight Wave is at/past the print door. */
export function canDropModulePart(state: GameState, moduleId: string, fightWave?: number): boolean {
  if (!isFarmableModule(moduleId)) return false
  if (!isCoreOnRoster(state, moduleId)) return false
  const need = modulePrintWave(moduleId)
  const wave = Math.max(
    1,
    Math.floor(fightWave ?? state.combat?.waveReached ?? state.combat?.wave ?? 1),
  )
  return isCorePrintUnlocked(state, moduleId) && wave >= need
}

export function listFarmableCores(state: GameState): ShipModuleDef[] {
  if (!isSystemUnlocked(state, 'foundry')) return []
  return FOUNDRY_BLUEPRINTS.map((b) => getModule(b.id)).filter((m): m is ShipModuleDef => {
    if (!m) return false
    if (state.shipyard.unlockedModules.includes(m.id)) return true
    if (!isGddRosterCore(m.id)) return false
    return isCorePrintUnlocked(state, m.id)
  })
}

/** Foundry Fabrication list — GDD roster prints, including upcoming drop waves. */
export function listFoundryPrintCards(state: GameState): ShipModuleDef[] {
  if (!isSystemUnlocked(state, 'foundry')) return []
  const rows = FOUNDRY_BLUEPRINTS.map((b) => getModule(b.id)).filter((m): m is ShipModuleDef => {
    if (!m) return false
    if (state.shipyard.unlockedModules.includes(m.id)) return true
    return isGddRosterCore(m.id)
  })
  rows.sort((a, b) => modulePrintWave(a.id) - modulePrintWave(b.id) || a.name.localeCompare(b.name))
  return rows
}

export function getEnemyDropTable(family: string): EnemyPartDropTable | undefined {
  return ENEMY_PART_DROPS.find((t) => t.family === family)
}

/** Hidden early-career fragment-rate taper. Not shown in the UI. */
export function earlyCareerFragmentMult(careerSector: number): number {
  const n = Math.max(0, careerSector)
  if (n <= ACT1_CADENCE.foundry + 3) return 3.25
  if (n <= ACT1_CADENCE.foundry + 8) return 2.15
  if (n <= ACT1_CADENCE.foundry + 15) return 1.35
  return 1
}

/** Extra fragment-roll chance while Hold-farming a tracked, eligible Core. */
export const HOLD_TRACKED_FRAGMENT_MULT = 1.65

/** Chance a successful eligible roll resolves as the tracked print. */
export const TRACKED_PRINT_ROLL_BIAS = 0.7

/** Untracked discovery: funnel early rolls into the closest incomplete print. */
export const DISCOVERY_PRINT_ROLL_BIAS = 0.62

/** Extra weight on still-needed part types while tracking an incomplete print. */
export const TRACKED_MISSING_PART_WEIGHT = 8

/** Milder than tracking: finish the closest print instead of flooding one leftover part. */
export const DISCOVERY_MISSING_PART_WEIGHT = 4

export const ENEMY_FAMILY_LABELS: Record<string, string> = {
  swarm: 'Swarm',
  armored: 'Armored',
  veil: 'Veil',
  siege: 'Siege',
  choir: 'Choir',
  apex: 'Apex',
}

export function enemyFamilyLabel(family: string): string {
  return ENEMY_FAMILY_LABELS[family] ?? family
}

export function dropTableEntries(family: string, wave: number): EnemyPartDropEntry[] {
  const table = getEnemyDropTable(family)
  if (!table) return []
  return [...table.entries, ...waveBonusDropEntries(wave)].filter(
    (e) => modulePrintWave(e.moduleId) <= wave,
  )
}

export function familyCanDropPrint(family: string, moduleId: string, wave: number): boolean {
  return dropTableEntries(family, wave).some((e) => e.moduleId === moduleId)
}

export interface PrintDropSource {
  family: string
  wave: number
  weight: number
}

/** Families whose base tables can drop this print, derived from live drop data. */
export function printDropSources(moduleId: string): PrintDropSource[] {
  const wave = modulePrintWave(moduleId)
  const sources: PrintDropSource[] = []
  for (const table of ENEMY_PART_DROPS) {
    const weight = table.entries
      .filter((e) => e.moduleId === moduleId)
      .reduce((sum, e) => sum + e.weight, 0)
    if (weight <= 0) continue
    sources.push({ family: table.family, wave, weight })
  }
  sources.sort((a, b) => b.weight - a.weight || a.wave - b.wave)
  return sources
}

export function formatPrintSourceLine(moduleId: string): string {
  const sources = printDropSources(moduleId)
  const wave = modulePrintWave(moduleId)
  if (wave <= 0) return ''
  if (sources.length === 0) return `Fragments from Wave ${wave}+`
  const families = sources.map((s) => enemyFamilyLabel(s.family))
  const unique = [...new Set(families)]
  return `${unique.join(', ')} · Wave ${wave}+`
}

export interface TrackedDropContext {
  trackedModuleId?: string | null
  focusModuleId?: string | null
}

function pickFromWeightedEntries(
  entries: EnemyPartDropEntry[],
  rng: () => number,
  _ctx?: TrackedDropContext,
): EnemyPartDropEntry | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return entries[entries.length - 1] ?? null
  let roll = rng() * total
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return entries[entries.length - 1] ?? null
}

/** Weighted pick among drop entries (+ sector extras). Pure helper for tests. */
export function pickWeightedDropEntry(
  family: string,
  sector: number,
  rng: () => number = Math.random,
  ctx?: TrackedDropContext,
): EnemyPartDropEntry | null {
  const entries = dropTableEntries(family, sector)
  if (entries.length === 0) return null
  const tracked = ctx?.trackedModuleId
  const trackedEntries = tracked ? entries.filter((e) => e.moduleId === tracked) : []
  const focus = ctx?.focusModuleId
  const focusEntries = focus ? entries.filter((e) => e.moduleId === focus) : []
  let pool = entries
  if (trackedEntries.length > 0 && rng() < TRACKED_PRINT_ROLL_BIAS) {
    pool = trackedEntries
  } else if (trackedEntries.length === 0 && focusEntries.length > 0 && rng() < DISCOVERY_PRINT_ROLL_BIAS) {
    pool = focusEntries
  }
  return pickFromWeightedEntries(pool, rng, ctx)
}

export function discoveryFocusPrint(
  _state: GameState,
  _family: string,
  _wave: number,
): string | null {
  return null
}

export function blueprintProgress(
  state: GameState,
  moduleId: string,
): { have: number; need: number; complete: boolean } | null {
  const recipe = getBlueprint(moduleId)
  if (!recipe) return null
  const have = blueprintFragmentCount(state, moduleId)
  return {
    have,
    need: recipe.fragmentsRequired,
    complete: isBlueprintDiscovered(state, moduleId),
  }
}

export function canDepositPart(
  _state: GameState,
  _partType: string,
  _qty = 1,
): boolean {
  return false
}

export function partSellScrap(_partIdStr: string): number {
  return 0
}

export function masteryBonus(rank: number): number {
  return 1 + 0.025 * Math.min(LATE_ACT1_MODULE_MASTERY, Math.max(0, rank))
}

export function moduleMasteryRank(
  state: { meta: { moduleMastery?: Record<string, number> } },
  moduleId: string,
): number {
  return Math.max(0, state.meta.moduleMastery?.[moduleId] ?? 0)
}

export function countModuleParts(state: GameState, moduleId: string): number {
  return blueprintFragmentCount(state, moduleId)
}

export function isModuleVisible(state: GameState, moduleId: string): boolean {
  if (isStarterUnlockModule(moduleId)) return true
  if (state.shipyard.unlockedModules.includes(moduleId)) return true
  if (state.meta.discoveredModules.includes(moduleId)) return true
  if (isGddRosterCore(moduleId)) return true
  if (isFarmableModule(moduleId) && isSystemUnlocked(state, 'foundry')) {
    return isCorePrintUnlocked(state, moduleId)
  }
  return false
}

export function getVisibleModules(state: GameState): ShipModuleDef[] {
  return SHIP_MODULES.filter((m) => isModuleVisible(state, m.id))
}

/** Minimal shape for drone power / cap / saturation helpers. */
export type DroneEconomyState = {
  base: { assignments: Record<string, number>; workerDrones?: number }
  research: { unlocked: string[] }
  ai: { purchased: string[] }
  prestige: {
    matterShop: Record<string, number>
  }
  meta?: { lifetimeDronesBuilt?: number }
  network?: { links?: { racks?: number; acuity?: number } }
  foundry?: { facilities?: string[] }
  hiveResearch?: { completedIds?: string[]; completed?: Record<string, number> }
}

/** Black-bar slot count (0 = uncapped linear scaling). */
export function stationBaseSlots(station: StationDef): number {
  return Math.max(0, station.baseSlots ?? 0)
}

/**
 * Drone power: how much each assigned body counts toward station saturation.
 * Early ≈ 1 (need many bodies to BB); late a single strong drone can BB.
 */
export function dronePower(state: DroneEconomyState): number {
  let power = aiDroneEfficiencyMult(state)
  for (const id of state.research.unlocked) {
    power += RESEARCH.find((r) => r.id === id)?.dronePowerBonus ?? 0
  }
  const acuity = Math.max(0, Math.floor(state.network?.links?.acuity ?? 0))
  power += NETWORK_ACUITY_PER_RANK * acuity
  return Math.max(0.05, power)
}

/** Max worker drones the account may hold. Ownership is separate. */
export function droneCap(state: DroneEconomyState): number {
  return workerCapacity(state)
}

/** Assigned bodies × power, hard-capped at station black-bar slots when set. */
export function stationEffectiveDrones(
  state: DroneEconomyState,
  stationId: string,
): number {
  const station = getStation(stationId)
  if (!station) return 0
  const assigned = Math.max(0, state.base.assignments[stationId] ?? 0)
  if (assigned <= 0) return 0
  const effective = workerJobContribution(assigned, stationId) * dronePower(state)
  const slots = stationBaseSlots(station)
  if (slots <= 0) return effective
  return Math.min(effective, slots)
}

/** 0–1 fill toward black-bar (1 = saturated). Uncapped stations report 0. */
export function stationThroughput(
  state: DroneEconomyState,
  stationId: string,
): number {
  const station = getStation(stationId)
  if (!station) return 0
  const slots = stationBaseSlots(station)
  if (slots <= 0) return 0
  const assigned = Math.max(0, state.base.assignments[stationId] ?? 0)
  return Math.min(1, (assigned * dronePower(state)) / slots)
}

/** Bodies needed to black-bar at current drone power (1 if uncapped). */
export function stationBlackBarNeed(
  state: DroneEconomyState,
  stationId: string,
): number {
  const station = getStation(stationId)
  if (!station) return 1
  const slots = stationBaseSlots(station)
  if (slots <= 0) return Number.POSITIVE_INFINITY
  return Math.max(1, Math.ceil(slots / dronePower(state) - 1e-9))
}

export function isStationBlackBarred(
  state: DroneEconomyState,
  stationId: string,
): boolean {
  const station = getStation(stationId)
  if (!station) return false
  if (stationBaseSlots(station) <= 0) return false
  return stationThroughput(state, stationId) >= 1 - 1e-9
}

/** @deprecated Instant assembly was removed; Foundry Fabricators own all item jobs. */
export function advanceFabProject(
  _state: GameState,
  _dtSeconds: number,
  _log?: (line: string) => void,
  _fabSpeedMult = 1,
): boolean {
  return false
}

export function getStation(id: string): StationDef | undefined {
  return STATIONS.find((s) => s.id === id)
}

export function getFrame(id: string): ShipFrameDef | undefined {
  return SHIP_FRAMES.find((f) => f.id === id)
}

export function getModule(id: string): ShipModuleDef | undefined {
  return SHIP_MODULES.find((m) => m.id === id)
}

/** Shortest weapon range on any player Core in the catalog. Must be ≥ ENEMY_PARK_MAX. */
export function lowestPlayerCoreRange(): number {
  let min = Infinity
  for (const mod of SHIP_MODULES) {
    const range = mod.weapon?.range
    if (typeof range === 'number' && range > 0) min = Math.min(min, range)
  }
  return Number.isFinite(min) ? min : MIN_CORE_WEAPON_RANGE
}

export function getEssenceUpgrade(id: string): EssenceUpgradeDef | undefined {
  return ESSENCE_UPGRADES.find((e) => e.id === id)
}

export function getMatterShopItem(id: string): MatterShopDef | undefined {
  return getCanonicalMatterItem(id)
}

export function matterShopItemsIn(category: MatterShopCategory): MatterShopDef[] {
  return canonicalMatterItemsIn(category)
}

export function getAiNode(id: string): AiNodeDef | undefined {
  return AI_NODES.find((n) => n.id === id)
}

export function isAiNodePermanent(node: AiNodeDef): boolean {
  if (node.permanent != null) return node.permanent
  return node.kind !== 'doctrine'
}

export function isStationUnlocked(state: GameState, stationId: string): boolean {
  const def = getStation(stationId)
  if (!def) return false
  if (def.requiresSystem && !isSystemUnlocked(state, def.requiresSystem)) return false
  if (def.requiresResearch && !state.research.unlocked.includes(def.requiresResearch)) {
    return false
  }
  if (stationId === 'drone-fab') {
    return (state.foundry?.facilities ?? []).includes('worker-fabricator')
  }
  return true
}

/** Jobs shown in Systems / Worker UI. Hidden until the station is legal. */
export function visibleWorkerJobIds(state: GameState): string[] {
  return WORKER_JOB_IDS.filter((id) => {
    if (!isStationUnlocked(state, id) || !workerJobHasWork(state, id)) return false
    if (id === 'drone-fab') return state.base.workerDrones < droneCap(state)
    return true
  })
}

export function assignedWorkers(assignments: Record<string, number>): number {
  return Object.values(assignments).reduce((sum, n) => sum + Math.max(0, n), 0)
}

export function idleWorkers(state: {
  base: { workerDrones: number; assignments: Record<string, number> }
}): number {
  const assigned = WORKER_JOB_IDS.reduce(
    (sum, id) => sum + Math.max(0, state.base.assignments[id] ?? 0),
    0,
  )
  return Math.max(0, state.base.workerDrones - assigned)
}

/** Rank owned for a shop id (0 if missing). */
export function shopRank(ranks: Record<string, number> | undefined, id: string): number {
  return Math.max(0, ranks?.[id] ?? 0)
}

/** Cost to buy the next rank (rank 0→1 = base cost). */
export function nextShopCost(baseCost: number, currentRank: number): number {
  return Math.ceil(baseCost * 2 ** Math.max(0, currentRank))
}

/** Soft stacking used by probability-like Matter effects. */
export function matterShopEffectScale(rank: number): number {
  if (rank <= 0) return 0
  return 1 + 0.45 * (rank - 1)
}

/** True prestige growth: a per-rank percentage compounds multiplicatively. */
export function matterShopRankMultiplier(perRank: number, rank: number): number {
  return Math.pow(1 + Math.max(0, perRank), Math.max(0, rank))
}

export function matterShopCompoundBonus(perRank: number, rank: number): number {
  return matterShopRankMultiplier(perRank, rank) - 1
}

/** Accelerating flat-stat ranks without turning a flat stat into a percentage stat. */
export function matterShopFlatScale(rank: number, growth = 0.12): number {
  const r = Math.max(0, rank)
  if (r <= 0) return 0
  if (growth <= 0) return r
  return (Math.pow(1 + growth, r) - 1) / growth
}

export function shopMaxRank(def: { maxRank?: number }): number {
  return def.maxRank ?? 1
}

export type ShopBuyCheck =
  | { ok: true; cost: number; nextRank: number; maxRank: number }
  | { ok: false; reason: string; cost?: number; nextRank?: number; maxRank?: number }

export function canBuyMatterShop(state: GameState, itemId: string): ShopBuyCheck {
  return canBuyCanonicalMatterShop(state, itemId)
}

/** Total manufacture speed multiplier (1 = baseline). */
export function workerManufactureSpeed(state: DroneEconomyState): number {
  let speed = 1
  for (const id of state.research.unlocked) {
    speed += RESEARCH.find((r) => r.id === id)?.manufactureBonus ?? 0
  }
  for (const id of state.ai.purchased) {
    speed += getAiNode(id)?.manufactureBonus ?? 0
  }
  const fab = stationEffectiveDrones(state, 'drone-fab')
  const fabDef = getStation('drone-fab')
  if (fab > 0 && fabDef?.manufactureBonusPerDrone) {
    speed += fab * fabDef.manufactureBonusPerDrone
  }
  speed += sumResearchNumber(resolvedResearchIds(state.hiveResearch), 'workerManufacture')
  return Math.max(0.05, speed)
}

export function stationRepairBonus(state: DroneEconomyState): number {
  let bonus = 0
  for (const station of STATIONS) {
    if (!station.repairPerDrone) continue
    const n = stationEffectiveDrones(state, station.id)
    if (n > 0) bonus += n * station.repairPerDrone
  }
  return bonus
}

export interface ModuleStatPreview {
  label: string
  /** Current value at this run level. */
  current: string
  /** Next-level value, or null if maxed / N/A. */
  next: string | null
}

/** Structured module stats for the Shipyard UI (2dp where needed). */
export function moduleStatPreviews(
  moduleId: string,
  level: number,
  showNext: boolean,
  masteryRank = 0,
): ModuleStatPreview[] {
  const mod = getModule(moduleId)
  if (!mod) return []
  const mastery = masteryBonus(masteryRank)
  const lines: ModuleStatPreview[] = []

  if (mod.weapon) {
    const dmg = moduleWeaponDamage(mod, level, mastery)
    const dmgNext = moduleWeaponDamage(mod, level + 1, mastery)
    lines.push({
      label: 'Damage',
      current: formatStat(dmg, 2),
      next: showNext ? formatStat(dmgNext, 2) : null,
    })
    const rof = 1 / Math.max(0.01, mod.weapon.cooldown)
    lines.push({
      label: 'RoF',
      current: `${formatStat(rof, 2)}/s`,
      next: null,
    })
    lines.push({
      label: 'Range',
      current: formatCompact(mod.weapon.range, 0),
      next: null,
    })
  }
  if (mod.hullBonus) {
    const hull = moduleLeveledBonus(mod.hullBonus, mod.hullBonusPerLevel, level, mastery)
    const hullNext = moduleLeveledBonus(
      mod.hullBonus,
      mod.hullBonusPerLevel,
      level + 1,
      mastery,
    )
    lines.push({
      label: 'Hull',
      current: `+${formatCompact(hull, 1)}`,
      next: showNext ? `+${formatCompact(hullNext, 1)}` : null,
    })
  }
  if (mod.armorBonus) {
    const armor = moduleLeveledBonus(mod.armorBonus, mod.armorBonusPerLevel, level, mastery)
    const armorNext = moduleLeveledBonus(
      mod.armorBonus,
      mod.armorBonusPerLevel,
      level + 1,
      mastery,
    )
    lines.push({
      label: 'Armor',
      current: `+${formatStat(armor, 2)}`,
      next: showNext ? `+${formatStat(armorNext, 2)}` : null,
    })
  }
  if (mod.shieldBonus) {
    const shield = moduleLeveledBonus(
      mod.shieldBonus,
      mod.shieldBonusPerLevel,
      level,
      mastery,
    )
    const shieldNext = moduleLeveledBonus(
      mod.shieldBonus,
      mod.shieldBonusPerLevel,
      level + 1,
      mastery,
    )
    lines.push({
      label: 'Shield',
      current: `+${formatCompact(shield, 1)}`,
      next: showNext ? `+${formatCompact(shieldNext, 1)}` : null,
    })
  }
  if (mod.shieldRegen) {
    lines.push({
      label: 'Regen',
      current: `${formatStat(mod.shieldRegen * 100, 0)}%/s`,
      next: null,
    })
  }
  const a = moduleLevelMultiplier(level) * mastery
  const b = moduleLevelMultiplier(level + 1) * mastery
  if (mod.evasionBonus) {
    lines.push({
      label: 'Evasion',
      current: `+${formatCompact(mod.evasionBonus * 100 * Math.min(1.4, a), 1)}%`,
      next: showNext
        ? `+${formatCompact(mod.evasionBonus * 100 * Math.min(1.4, b), 1)}%`
        : null,
    })
  }
  if (mod.damageTakenMult < 1) {
    lines.push({
      label: 'Incoming',
      current: `×${formatStat(mod.damageTakenMult, 2)}`,
      next: null,
    })
  }
  if (mod.salvageKillBonus) {
    lines.push({
      label: 'Kill salvage',
      current: `+${Math.round(mod.salvageKillBonus * 100)}%`,
      next: null,
    })
  }
  if (mod.escorts) {
    lines.push({
      label: 'Escorts',
      current: String(mod.escorts),
      next: null,
    })
  }
  return lines
}

/** @deprecated Prefer moduleStatPreviews for UI. */
export function moduleUpgradeEffectLines(
  moduleId: string,
  fromLevel: number,
  toLevel: number,
): string[] {
  const mod = getModule(moduleId)
  if (!mod) return []
  const lines: string[] = []
  if (mod.weapon) {
    const from = moduleWeaponDamage(mod, fromLevel)
    const to = moduleWeaponDamage(mod, toLevel)
    lines.push(
      `Weapon ${formatStat(from, 2)} → ${formatStat(to, 2)} dmg (+${formatCompact(to - from, 1)})`,
    )
    const rof = 1 / Math.max(0.01, mod.weapon.cooldown)
    lines.push(`RoF ${formatStat(rof, 2)}/s (unchanged with level)`)
  }
  if (mod.hullBonus) {
    lines.push(
      `Hull +${formatCompact(moduleLeveledBonus(mod.hullBonus, mod.hullBonusPerLevel, fromLevel), 1)} → +${formatCompact(moduleLeveledBonus(mod.hullBonus, mod.hullBonusPerLevel, toLevel), 1)}`,
    )
  }
  if (mod.armorBonus) {
    lines.push(
      `Armor +${formatStat(moduleLeveledBonus(mod.armorBonus, mod.armorBonusPerLevel, fromLevel), 2)} → +${formatStat(moduleLeveledBonus(mod.armorBonus, mod.armorBonusPerLevel, toLevel), 2)}`,
    )
  }
  if (mod.shieldBonus) {
    lines.push(
      `Shield +${formatCompact(moduleLeveledBonus(mod.shieldBonus, mod.shieldBonusPerLevel, fromLevel), 1)} → +${formatCompact(moduleLeveledBonus(mod.shieldBonus, mod.shieldBonusPerLevel, toLevel), 1)}`,
    )
  }
  const a = moduleLevelMultiplier(fromLevel)
  const b = moduleLevelMultiplier(toLevel)
  if (mod.evasionBonus) {
    lines.push(
      `Evasion +${formatCompact(mod.evasionBonus * 100 * Math.min(1.4, a), 1)}% → +${formatCompact(mod.evasionBonus * 100 * Math.min(1.4, b), 1)}%`,
    )
  }
  if (mod.damageTakenMult < 1) {
    lines.push(`Damage taken ×${formatStat(mod.damageTakenMult, 2)} (scales softer with levels)`)
  }
  if (mod.escorts) {
    lines.push(`Escorts ×${mod.escorts} (count unchanged; damage scales with fleet)`)
  }
  if (lines.length === 0) {
    lines.push(`Module combat contribution (Lv ${fromLevel} → ${toLevel})`)
  }
  return lines
}

export function researchDamageMultiplier(unlocked: string[]): number {
  let bonus = 1
  for (const id of unlocked) {
    const def = RESEARCH.find((r) => r.id === id)
    if (def?.damageBonus) bonus += def.damageBonus
  }
  return bonus
}

/** Essence no longer grants flat combat damage — always 1. */
export function essenceDamageMultiplier(_purchased: string[]): number {
  return 1
}

export function essenceHullBonus(purchased: string[]): number {
  let hull = 0
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.hullBonus) hull += def.hullBonus
  }
  return hull
}

/** Essence no longer grants flat production — always 1. */
export function essenceProductionMultiplier(_purchased: string[]): number {
  return 1
}

export function essenceBonusDataPerClear(purchased: string[]): number {
  let total = 0
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.bonusDataPerClear) total += def.bonusDataPerClear
  }
  return total
}

/** Boss essence multiplier from essence constructs (1 = baseline). */
export function essenceBossEssenceMultiplier(purchased: string[]): number {
  let bonus = 1
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.bossEssenceBonus) bonus += def.bossEssenceBonus
  }
  return bonus
}

/** Offline essence multiplier from essence constructs (1 = baseline). */
export function essenceOfflineEssenceMultiplier(purchased: string[]): number {
  let bonus = 1
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.offlineEssenceBonus) bonus += def.offlineEssenceBonus
  }
  return bonus
}

/** Multiplier on Alloy Foundry scrap upkeep (1 = full upkeep). */
export function essenceAlloyUpkeepMult(purchased: string[]): number {
  let reduction = 0
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.alloyUpkeepReduction) reduction += def.alloyUpkeepReduction
  }
  return Math.max(0.05, 1 - reduction)
}

/** Effective scrap upkeep per drone for a station after essence modifiers. */
export function stationUpkeepScrapPerDrone(
  state: { essence: { purchased: string[] } },
  station: StationDef,
): number {
  const base = station.upkeepScrapPerDrone ?? 0
  if (base <= 0) return 0
  if (station.id === 'alloy-foundry') {
    return base * essenceAlloyUpkeepMult(state.essence.purchased)
  }
  return base
}

export function researchEssenceMultiplier(unlocked: string[]): number {
  let mult = 1
  for (const id of unlocked) {
    const def = RESEARCH.find((r) => r.id === id)
    if (def?.essenceBonus) mult += def.essenceBonus
  }
  return mult
}

export function metaDamageMultiplier(
  prestigeMatter: number,
  challengePoints: number,
  matterShop: Record<string, number> = {},
): number {
  void prestigeMatter
  void challengePoints
  void matterShop
  return 1
}

export function metaProductionMultiplier(
  prestigeMatter: number,
  matterShop: Record<string, number> = {},
): number {
  void prestigeMatter
  void matterShop
  return 1
}

/**
 * Soft run acceleration from career Rebuilds.
 * Each Rebuild should feel like a USI core-swap recover, not a dead zone.
 * Caps keep late-game from exploding; shops remain the main sink.
 */
export function prestigeMomentumDamageBonus(
  prestigeCount: number,
): number {
  return Math.pow(1.08, Math.max(0, prestigeCount)) - 1
}

export function prestigeMomentumProductionBonus(
  prestigeCount: number,
): number {
  return Math.pow(1.06, Math.max(0, prestigeCount)) - 1
}

/** Short UI blurb for matter shop total effect at rank. */
export function matterShopEffectBlurb(def: MatterShopDef, rank: number): string {
  return canonicalMatterBlurb(def, rank)
}

export function aiDoctrinesActive(
  state: {
    ai: { purchased: string[] }
  },
  nodeId: string,
): boolean {
  return state.ai.purchased.includes(nodeId)
}

/** Additive station production from AI (non-combat). */
export function aiProductionBonus(state: {
  ai: { purchased: string[] }
}): number {
  let bonus = 0
  for (const id of state.ai.purchased) {
    bonus += getAiNode(id)?.productionBonus ?? 0
  }
  return bonus
}

/** Additive Fab Bay craft speed from AI (non-combat). */
export function aiFabBonus(state: {
  ai: { purchased: string[] }
}): number {
  let bonus = 0
  for (const id of state.ai.purchased) {
    bonus += getAiNode(id)?.fabBonus ?? 0
  }
  return bonus
}

/**
 * AI drone power mult (highest owned wins).
 * Feeds dronePower() saturation — not a post-BB output multiplier.
 */
export function aiDroneEfficiencyMult(state: {
  ai: { purchased: string[] }
}): number {
  let best = 1
  for (const id of state.ai.purchased) {
    const m = getAiNode(id)?.droneEfficiencyMult
    if (m != null && m > best) best = m
  }
  return best
}
