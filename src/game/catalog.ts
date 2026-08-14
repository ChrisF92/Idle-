/** Game content catalogs — costs, unlocks, and combat profiles. */

import { PRESTIGE_MIN_SECTOR as PROGRESSION_PRESTIGE_MIN, isSystemUnlocked } from './progression'
import { formatCompact, formatStat } from './format'
import type { CoreAttrId, GameState, PartType, Resources, WeaponDelivery, WeaponTag } from './types'

export type ResourceCost = Partial<Record<keyof Resources, number>>

/** Named production stations — worker drones are assigned here (ITRTG-style). */
export interface StationDef {
  id: string
  name: string
  description: string
  requiresResearch?: string
  /** System that must be unlocked before drones can be assigned. */
  requiresSystem?: 'base' | 'research' | 'ai' | 'prestige' | 'core'
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
  /** Career sector clear required before this node can be bought. */
  requiresSectorEver?: number
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
  /**
   * Combat sim speed multiplier while owned.
   * Highest owned value wins; never applied to industry / fab / training.
   */
  combatSpeedMult?: number
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

export interface ShopRankGate {
  shop: 'challenge' | 'matter'
  id: string
  rank: number
}

/** Soft meta gate: pass if ANY listed condition is met. */
export interface ShopMetaAnyGate {
  act1Cleared?: boolean
  prestiges?: number
  sectorEver?: number
  anyChallengeClear?: boolean
}

export interface ChallengeShopDef {
  id: string
  name: string
  description: string
  costCp: number
  /** Max purchase rank (default 1 = unique unlock). */
  maxRank?: number
  damageBonus?: number
  /** Overrides default prestige sector requirement when owned. */
  prestigeMinSector?: number
  startingScrap?: number
  startingAiPoints?: number
  /** Bonus salvage at the start of each run. */
  startingSalvage?: number
  offlineHours?: number
  /** Extra effectiveness on role matchup bonuses (0.15 = +15%). */
  matchupBonus?: number
  /** @deprecated Prefer droneCapBonus — instant grants ignored under corps cap. */
  bonusWorkerDrones?: number
  /** Flat corps capacity per rank (summed; not diminishing-scaled). */
  droneCapBonus?: number
  /** Additive drone power per rank scale (0.15 = +15% at rank 1). */
  dronePowerBonus?: number
  manufactureBonus?: number
  /** Additive blueprint part drop chance (0.15 = +15% at rank 1). */
  dropBonus?: number
  requiresPrestiges?: number
  requiresSectorEver?: number
  requiresAct1?: boolean
  requiresShopRank?: ShopRankGate
  requiresMetaAny?: ShopMetaAnyGate
  /** When purchased rank≥1, ensure this module is in unlockedModules. */
  unlockModuleId?: string
}

export interface MatterShopDef {
  id: string
  name: string
  description: string
  costPm: number
  /** Max purchase rank (default 1). */
  maxRank?: number
  damageBonus?: number
  productionBonus?: number
  hullBonus?: number
  shieldBonus?: number
  /** Multiplier on combat scrap rewards (0.25 = +25%). */
  scrapBonus?: number
  bonusDataPerClear?: number
  /**
   * Marker for drydock repair speed item. Rank r grants speed
   * `0.4 * (1 + 0.45*(r-1))`, applied as repairMult = 1/(1+speed).
   */
  repairMult?: number
  /** @deprecated Prefer droneCapBonus. */
  bonusWorkerDrones?: number
  /** Flat corps capacity per rank (summed; not diminishing-scaled). */
  droneCapBonus?: number
  /** Additive drone power per rank scale (0.2 = +20% at rank 1). */
  dronePowerBonus?: number
  manufactureBonus?: number
  /** Additive Core training speed bonus per rank scale (0.12 = +12% at rank 1). */
  trainingBonus?: number
  /** Additive blueprint part drop chance (0.1 = +10% at rank 1). */
  dropBonus?: number
}

export interface ChallengeDef {
  id: string
  name: string
  description: string
  restriction: string
  goalSector: number
  rewardChallengePoints: number
  /** ITRTG-style repeat cap (5–100). */
  maxClears: number
  stackDamageBonus?: number
  stackProductionBonus?: number
  stackRepairBonus?: number
  /** Optional lock: requires N clears of another challenge. */
  requiresChallengeClears?: { challengeId: string; clears: number }
  requiresPrestiges?: number
  /** Career highest sector ever required. */
  requiresSectorEver?: number
  /**
   * Career ascensions required to unlock (AND with other non-OR gates when set
   * alone; combined with OR group when other OR gates exist — see isChallengeUnlocked).
   */
  requiresAscensions?: number
  /**
   * How the challenge is entered. Ascension-entry challenges are only startable
   * when Ascension is available (sector 30+) and consume an Ascension rather than
   * a Prestige (ITRTG double-rebirth style).
   */
  entryCost?: 'prestige' | 'ascension'
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
  dotDuration?: number
  dotDamage?: number
  /** USI hull / shield / armor damage multipliers. */
  hullDamage?: number
  shieldDamage?: number
  armorDamage?: number
  /** Connected beam vs travelling bolt. Charge lasers use telegraph + bolt. */
  delivery?: WeaponDelivery
}

/**
 * Max Salvage levels per Core in a run.
 * USI T1 cores routinely go past 70–110 before a T2 swap; 12 was a Cosmic Idle cap.
 */
export const MAX_MODULE_LEVEL = 110

export type ModuleRole = 'weapon' | 'defense' | 'utility'

export interface ShipFrameDef {
  id: string
  name: string
  /** Attack / weapon module capacity. */
  weaponSlots: number
  defenseSlots: number
  utilitySlots: number
  /**
   * Intrinsic flagship weapon damage. USI ships fire only equipped Cores —
   * starter hulls use 0 (no free frame battery).
   */
  baseDamage: number
  baseHull: number
  unlockCost: ResourceCost
  /** Career sector clear required to purchase. */
  requiresSectorEver?: number
}

export interface ShipModuleDef {
  id: string
  name: string
  role: ModuleRole
  description: string
  /** Used for DPS estimates when no weapon profile is present. */
  damageBonus: number
  hullBonus: number
  /** Flat hull added per Salvage level. Omit to keep the old 8%/level curve. */
  hullBonusPerLevel?: number
  armorBonus?: number
  armorBonusPerLevel?: number
  shieldBonus?: number
  /** Flat shield added per Salvage level (USI Continuous Generator: +5). */
  shieldBonusPerLevel?: number
  /**
   * In-combat shield regen as a fraction of max shields per second
   * (USI Continuous Generator: 0.05).
   */
  shieldRegen?: number
  evasionBonus?: number
  /** Multiplier on incoming damage (0.9 = take 10% less). */
  damageTakenMult: number
  weapon?: ModuleWeaponDef
  /** Combat escort drones spawned from this module. Retired — Hiveworks keeps guns on the ship. */
  escorts?: number
  /** Extra salvage from kills while fitted (utility Cores). */
  salvageKillBonus?: number
  /** USI Core salvage cost for level 0 → 1 (weapons 3, shields 6). */
  upgradeBaseCost?: number
  /** USI Core cost scaling per level (weapons 1.21, shields 1.2). */
  upgradeCostScaling?: number
  unlockCost: ResourceCost
  requiresSectorEver?: number
  /** Challenge shop schematic id required before scrap unlock (rank ≥ 1). */
  requiresChallengeShop?: string
}

/** Re-export progression prestige gate for existing imports. */
export const PRESTIGE_MIN_SECTOR = PROGRESSION_PRESTIGE_MIN

/** Base seconds to manufacture one worker drone at 1.0 speed. */
export const WORKER_MANUFACTURE_SECONDS = 90

/** Fresh-career worker drone corps capacity before bonuses. */
export const BASE_DRONE_CAP = 10
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
    name: 'Scrap Field',
    description: 'Workers haul debris into usable scrap.',
    requiresSystem: 'base',
    rates: { scrap: 0.4 },
    baseSlots: 20,
  },
  {
    id: 'power-grid',
    name: 'Power Grid',
    description: 'Workers stabilize reactor feeds for energy.',
    requiresSystem: 'base',
    rates: { energy: 0.16 },
    baseSlots: 16,
  },
  {
    id: 'sensor-net',
    name: 'Sensor Net',
    description: 'Workers sift anomaly noise into research data.',
    requiresSystem: 'research',
    rates: { data: 0.045 },
    baseSlots: 16,
  },
  {
    id: 'alloy-foundry',
    name: 'Alloy Foundry',
    description: 'Workers convert scrap into alloys.',
    requiresSystem: 'research',
    requiresResearch: 'alloy-smelting',
    rates: { alloys: 0.12 },
    upkeepScrapPerDrone: 0.16,
    baseSlots: 12,
  },
  {
    id: 'repair-bay',
    name: 'Repair Bay',
    description: 'Workers speed hangar hull/shield restoration while Paused.',
    requiresSystem: 'base',
    rates: {},
    repairPerDrone: 1.2,
    baseSlots: 16,
  },
  {
    id: 'drone-fab',
    name: 'Drone Fabricator',
    description: 'Workers accelerate manufacturing of new worker drones.',
    requiresSystem: 'base',
    requiresResearch: 'drone-logistics',
    rates: {},
    manufactureBonusPerDrone: 0.35,
    baseSlots: 10,
  },
  {
    id: 'fab-bay',
    name: 'Fabrication Bay',
    description: 'Workers assemble deposited blueprint parts into modules.',
    requiresSystem: 'base',
    requiresResearch: 'module-fab',
    rates: {},
    kind: 'special',
    baseSlots: 40,
  },
  {
    id: 'train-ballistics',
    name: 'Ballistics Range',
    description: 'Workers drill targeting drills — trains the Ballistics Core attribute (fleet DPS).',
    requiresSystem: 'base',
    requiresResearch: 'core-training',
    rates: {},
    kind: 'training',
    trainsAttr: 'ballistics',
  },
  {
    id: 'train-plating',
    name: 'Plating Yard',
    description: 'Workers harden armor schemes — trains the Plating Core attribute (hull + armor).',
    requiresSystem: 'base',
    requiresResearch: 'core-training',
    rates: {},
    kind: 'training',
    trainsAttr: 'plating',
  },
  {
    id: 'train-reactors',
    name: 'Reactor Lab',
    description: 'Workers tune reactor feeds — trains the Reactors Core attribute (shields + repair).',
    requiresSystem: 'base',
    requiresResearch: 'core-training',
    rates: {},
    kind: 'training',
    trainsAttr: 'reactors',
  },
  {
    id: 'train-sensors',
    name: 'Sensor Academy',
    description: 'Workers calibrate sensor nets — trains the Sensors Core attribute (evasion + matchup).',
    requiresSystem: 'base',
    requiresResearch: 'core-training',
    rates: {},
    kind: 'training',
    trainsAttr: 'sensors',
  },
  {
    id: 'train-logistics',
    name: 'Logistics Hub',
    description:
      'Workers practice supply chains — trains Logistics (industry, Fab Bay speed, part drops, and training speed).',
    requiresSystem: 'base',
    requiresResearch: 'core-training',
    rates: {},
    kind: 'training',
    trainsAttr: 'logistics',
  },
]

export const RESEARCH: ResearchDef[] = [
  {
    id: 'basic-optics',
    name: 'Basic Optics',
    description: 'Improves sensor calibration. Prerequisite for later research. Permanent.',
    costData: 35,
  },
  {
    id: 'alloy-smelting',
    name: 'Alloy Smelting',
    description: 'Unlocks the Alloy Foundry station. Permanent.',
    costData: 45,
  },
  {
    id: 'module-fab',
    name: 'Module Fabrication',
    description: 'Unlocks the Fabrication Bay — assemble blueprint parts into modules. Permanent.',
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
      'Unlocks the Codex permanently: enemy family intel and soft counters (survives prestige / ascension).',
    costData: 50,
  },
  {
    id: 'core-drills',
    name: 'Core Drills',
    description: '+35% Core attribute training speed. Permanent.',
    costData: 120,
    trainingBonus: 0.35,
  },
  {
    id: 'entity-anatomy',
    name: 'Entity Anatomy',
    description: 'Deep autopsy protocols. +25% Essence from bosses. Required for advanced study. Permanent.',
    costData: 150,
    essenceBonus: 0.25,
  },
  {
    id: 'boss-harvester',
    name: 'Boss Harvester',
    description: 'Extract more Essence from bosses (+100%). Permanent.',
    costData: 70,
    costEssence: 1,
    essenceBonus: 1,
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
      'Much faster out-of-combat hull / shield repair while flagship hull is below 35%. Does not Pause combat.',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'auto-launch-ready',
    name: 'Field Repairs',
    description:
      'Much faster hull / shield regen out of combat while undocked. Never Pauses or Resumes for you.',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'auto-assign-workers',
    name: 'Labor Router',
    description:
      'Industry presets (Balanced / Scrap / Data / Foundry-Safe), Fill, Clear, and +5 assign buttons.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 6,
  },
  {
    id: 'labor-loop',
    name: 'Labor Loop',
    description:
      'Continuously re-applies your Labor Router profile when drones finish manufacturing or sit idle.',
    costAiPoints: 4,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 10,
    requiresAiNode: 'auto-assign-workers',
  },
  {
    id: 'drone-hangar',
    name: 'Expanded Hangar',
    description: '+8 worker drone corps capacity.',
    costAiPoints: 3,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 8,
    droneCapBonus: 8,
  },
  {
    id: 'drone-efficiency-1',
    name: 'Swarm Optics',
    description:
      '+35% drone power — each worker counts for more toward station black-bar (fewer bodies needed).',
    costAiPoints: 4,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 12,
    droneEfficiencyMult: 1.35,
  },
  {
    id: 'drone-efficiency-2',
    name: 'Hive Lattice',
    description: '+65% drone power toward station black-bar. Requires Swarm Optics.',
    costAiPoints: 8,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 18,
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
    requiresSectorEver: 10,
    manufactureBonus: 0.5,
  },
  {
    id: 'neural-drill',
    name: 'Neural Drill',
    description: '+40% Core attribute training speed (permanent).',
    costAiPoints: 3,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 12,
    trainingBonus: 0.4,
  },
  {
    id: 'salvage-optimizer',
    name: 'Salvage Optimizer',
    description: 'Unlocks Upgrade Cheapest: spend salvage on the lowest-level owned module.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'batch-refit',
    name: 'Batch Refit',
    description: 'Unlocks Unequip All in the Shipyard while Paused.',
    costAiPoints: 1,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'hold-accountant',
    name: 'Hold Accountant',
    description: 'Shows estimated clear rewards while farming on Hold.',
    costAiPoints: 1,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'warp-navigator',
    name: 'Warp Navigator',
    description: 'Unlocks the Warp button once any sector has been cleared.',
    costAiPoints: 2,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 8,
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
    name: 'Boss Protocol',
    description: 'Doctrine: +25% damage vs boss units.',
    costAiPoints: 3,
    kind: 'doctrine',
    permanent: false,
  },
  {
    id: 'scavenger',
    name: 'Scavenger Protocol',
    description: 'Doctrine: +30% scrap from combat clears.',
    costAiPoints: 2,
    kind: 'doctrine',
    permanent: false,
  },
  {
    id: 'tactical-retreat',
    name: 'Tactical Retreat',
    description: 'Doctrine: disengage at 25% flagship hull instead of destruction.',
    costAiPoints: 2,
    kind: 'doctrine',
    permanent: false,
  },
  // --- Combat speed (combat dt only) ---
  {
    id: 'combat-chrono-1',
    name: 'Combat Chrono I',
    description: 'Combat runs at 1.5× speed. Industry, fab, and training stay at 1×.',
    costAiPoints: 5,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 15,
    combatSpeedMult: 1.5,
  },
  {
    id: 'combat-chrono-2',
    name: 'Combat Chrono II',
    description: 'Combat runs at 2× speed. Requires Chrono I.',
    costAiPoints: 8,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 20,
    requiresAiNode: 'combat-chrono-1',
    combatSpeedMult: 2,
  },
  {
    id: 'combat-chrono-3',
    name: 'Combat Chrono III',
    description: 'Combat runs at 3× speed. Requires Chrono II.',
    costAiPoints: 12,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 25,
    requiresAiNode: 'combat-chrono-2',
    combatSpeedMult: 3,
  },
  // --- Non-combat speed ---
  {
    id: 'chrono-industry',
    name: 'Industrial Chrono',
    description: '+40% station production rates (scrap / alloys / energy). Not combat.',
    costAiPoints: 6,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 18,
    productionBonus: 0.4,
  },
  {
    id: 'chrono-fab',
    name: 'Fabrication Chrono',
    description: '+50% Fabrication Bay craft speed.',
    costAiPoints: 6,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 18,
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
    requiresSectorEver: 16,
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
    requiresSectorEver: 18,
  },
  {
    id: 'auto-fab-bay',
    name: 'Auto Fabricator',
    description:
      'Automatically starts Fab Bay projects for the most complete discovered blueprint and deposits parts.',
    costAiPoints: 10,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 20,
  },
  {
    id: 'auto-merge-signal',
    name: 'Signal Collider',
    description: 'Automatically merges unequipped Signal Cores when three matching ranks exist.',
    costAiPoints: 12,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 22,
  },
]

export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'essence-lattice',
    name: 'Essence Lattice',
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
    description: 'Permanent +1 Data on every sector clear.',
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

export const CHALLENGE_SHOP: ChallengeShopDef[] = [
  {
    id: 'iron-will',
    name: 'Iron Will',
    description:
      'Permanent +6% role matchup effectiveness per rank (extra ranks +45% of base). Not a raw damage clone.',
    costCp: 1,
    maxRank: 6,
    matchupBonus: 0.06,
  },
  {
    id: 'early-gate',
    name: 'Early Gate',
    description: 'Rebuild / enter challenges from sector 2.',
    costCp: 1,
    maxRank: 1,
    prestigeMinSector: 2,
  },
  {
    id: 'supply-cache',
    name: 'Supply Cache',
    description: 'Each run starts with +20 scrap per rank.',
    costCp: 1,
    maxRank: 4,
    startingScrap: 20,
  },
  {
    id: 'doctrine-seed',
    name: 'Doctrine Seed',
    description: 'Each run starts with +1 AI Point per rank.',
    costCp: 2,
    maxRank: 5,
    startingAiPoints: 1,
  },
  {
    id: 'deep-cache',
    name: 'Deep Cache',
    description: 'Offline catch-up cap becomes 12 hours.',
    costCp: 2,
    maxRank: 1,
    offlineHours: 12,
  },
  {
    id: 'role-drills',
    name: 'Role Drills',
    description: '+20% role matchup effectiveness per rank (extra ranks +45% of base).',
    costCp: 2,
    maxRank: 5,
    matchupBonus: 0.2,
  },
  {
    id: 'hangar-rights',
    name: 'Hangar Rights',
    description: 'Each run starts with +10 Salvage per rank.',
    costCp: 2,
    maxRank: 5,
    startingSalvage: 10,
  },
  {
    id: 'drone-bay-rights',
    name: 'Drone Bay Rights',
    description: '+3 worker drone corps capacity per rank.',
    costCp: 2,
    maxRank: 8,
    droneCapBonus: 3,
  },
  {
    id: 'schematic-surge',
    name: 'Schematic: Surge Cap',
    description: 'Unlocks Surge Capacitor — unique schematic not found as loot.',
    costCp: 3,
    maxRank: 1,
    requiresPrestiges: 1,
    unlockModuleId: 'surge-capacitor',
  },
  {
    id: 'schematic-mirror',
    name: 'Schematic: Mirror Plate',
    description: 'Unlocks Mirror Plate defense — unique schematic not found as loot.',
    costCp: 3,
    maxRank: 1,
    requiresPrestiges: 1,
    unlockModuleId: 'mirror-plate',
  },
  {
    id: 'deep-vault',
    name: 'Deep Vault',
    description: 'Offline catch-up cap becomes 24 hours. Requires Deep Cache.',
    costCp: 4,
    maxRank: 1,
    offlineHours: 24,
    requiresShopRank: { shop: 'challenge', id: 'deep-cache', rank: 1 },
    requiresMetaAny: { act1Cleared: true, prestiges: 3, sectorEver: 30 },
  },
  {
    id: 'clearance-board',
    name: 'Clearance Board',
    description: 'Permanently +5 to every challenge’s effective max clears.',
    costCp: 3,
    maxRank: 1,
    requiresMetaAny: { anyChallengeClear: true, prestiges: 2 },
  },
  {
    id: 'loot-protocols',
    name: 'Loot Protocols',
    description:
      'Permanent +15% blueprint part drop chance per rank (extra ranks +45% of base).',
    costCp: 2,
    maxRank: 6,
    dropBonus: 0.15,
    requiresPrestiges: 1,
  },
]

/** Spend Rebuild Matter for stronger specialized permanents (vs banked +0.5% dmg/prod). */
export const MATTER_SHOP: MatterShopDef[] = [
  {
    id: 'matter-blade',
    name: 'Slag Edge',
    description: 'Permanent +8% combat damage (deep ranks; extra ranks +45% of base).',
    costPm: 3,
    maxRank: 25,
    damageBonus: 0.08,
  },
  {
    id: 'matter-forge',
    name: 'Slag Forge',
    description: 'Permanent +12% base production (deep ranks).',
    costPm: 3,
    maxRank: 25,
    productionBonus: 0.12,
  },
  {
    id: 'matter-plating',
    name: 'Slag Plate',
    description: 'Permanent +50 hull (deep ranks).',
    costPm: 4,
    maxRank: 25,
    hullBonus: 50,
  },
  {
    id: 'salvage-rights',
    name: 'Salvage Rights',
    description: 'Permanent +25% scrap from combat clears (deep ranks).',
    costPm: 3,
    maxRank: 30,
    scrapBonus: 0.25,
  },
  {
    id: 'archive-spur',
    name: 'Archive Spur',
    description: 'Permanent +2 Data on every sector clear (deep ranks).',
    costPm: 3,
    maxRank: 30,
    bonusDataPerClear: 2,
  },
  {
    id: 'drydock-boost',
    name: 'Drydock Boost',
    description: 'Permanent faster hull / shield repair while Paused (deep ranks).',
    costPm: 4,
    maxRank: 25,
    repairMult: 0.6,
  },
  {
    id: 'shield-bank',
    name: 'Shield Bank',
    description: 'Permanent +40 shield capacity on the flagship (deep ranks).',
    costPm: 4,
    maxRank: 25,
    shieldBonus: 40,
  },
  {
    id: 'drone-corps',
    name: 'Drone Corps Charter',
    description: '+5 worker drone corps capacity per rank (deep ranks).',
    costPm: 5,
    maxRank: 20,
    droneCapBonus: 5,
  },
  {
    id: 'drone-acuity',
    name: 'Drone Acuity',
    description:
      '+20% drone power per rank (extra ranks +45% of base). Black-bar stations with fewer bodies.',
    costPm: 4,
    maxRank: 25,
    dronePowerBonus: 0.2,
  },
  {
    id: 'synapse-lattice',
    name: 'Synapse Lattice',
    description: '+12% Core training speed per rank (deep ranks; extra ranks +45% of base).',
    costPm: 4,
    maxRank: 25,
    trainingBonus: 0.12,
  },
  {
    id: 'fragment-magnet',
    name: 'Fragment Magnet',
    description:
      'Permanent +10% blueprint part drop chance per rank (deep ranks; extra ranks +45% of base).',
    costPm: 4,
    maxRank: 25,
    dropBonus: 0.1,
  },
]

/** Knife Fight caps every flagship weapon (including Frame Battery) to flak reach. */
export const SHORT_RANGE_MAX = 55

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'no-ai',
    name: 'Silent Bridge',
    description: 'Reach sector 30 with AI assists disabled. Repeatable.',
    restriction: 'AI purchases and doctrines inactive',
    goalSector: 30,
    rewardChallengePoints: 1,
    maxClears: 20,
    stackDamageBonus: 0.005,
  },
  {
    id: 'thin-hull',
    name: 'Glass Frame',
    description: 'Reach sector 30 with half hull. Stacks boost Paused repair.',
    restriction: 'Player hull max ×0.5',
    goalSector: 30,
    rewardChallengePoints: 1,
    maxClears: 15,
    stackRepairBonus: 0.015,
    requiresPrestiges: 1,
  },
  {
    id: 'data-drought',
    name: 'Data Drought',
    description: 'Reach sector 30 without Data gains from combat. Repeatable.',
    restriction: 'Combat data drops disabled',
    goalSector: 30,
    rewardChallengePoints: 2,
    maxClears: 10,
    stackProductionBonus: 0.008,
    requiresChallengeClears: { challengeId: 'no-ai', clears: 1 },
  },
  {
    id: 'no-utility',
    name: 'Bare Rig',
    description: 'Reach sector 30 without utility modules. Repeatable.',
    restriction: 'Utility modules unequipped and blocked',
    goalSector: 30,
    rewardChallengePoints: 1,
    maxClears: 15,
    stackDamageBonus: 0.006,
    requiresPrestiges: 1,
  },
  {
    id: 'short-range',
    name: 'Knife Fight',
    description: 'Reach sector 30 with all weapons capped to flak range. Repeatable.',
    restriction: `Weapon range capped at ${SHORT_RANGE_MAX}`,
    goalSector: 30,
    rewardChallengePoints: 2,
    maxClears: 12,
    stackRepairBonus: 0.015,
    requiresChallengeClears: { challengeId: 'no-utility', clears: 1 },
  },
  {
    id: 'mono-pulse',
    name: 'Mono Pulse',
    description: 'Reach sector 30 with only the Pulse Cannon weapon module. Repeatable.',
    restriction: 'Only Pulse Cannon weapon modules (Frame Battery ok)',
    goalSector: 30,
    rewardChallengePoints: 2,
    maxClears: 12,
    stackDamageBonus: 0.005,
    requiresChallengeClears: { challengeId: 'short-range', clears: 1 },
    requiresPrestiges: 2,
  },
  {
    id: 'attrition',
    name: 'Attrition',
    description:
      'Reach sector 30 with no hangar or field repair — hull only recovers on death warp. Repeatable.',
    restriction: 'No Pause / field hull or shield repair',
    goalSector: 30,
    rewardChallengePoints: 2,
    maxClears: 12,
    stackRepairBonus: 0.015,
    requiresChallengeClears: { challengeId: 'thin-hull', clears: 1 },
  },
  {
    id: 'long-haul',
    name: 'Long Haul',
    description:
      'Ascension challenge: reach sector 30. Entering costs an Ascension (not a Prestige).',
    restriction: 'None — endurance goal · starts via Ascension',
    goalSector: 30,
    rewardChallengePoints: 3,
    maxClears: 8,
    stackProductionBonus: 0.012,
    requiresAscensions: 0,
    entryCost: 'ascension',
  },
  {
    id: 'null-signal',
    name: 'Null Signal',
    description:
      'Ascension challenge: reach sector 30 with no Signal Cores. First clear stabilizes the Signal bank.',
    restriction: 'Signal Cores unequipped and cannot be equipped · starts via Ascension',
    goalSector: 30,
    rewardChallengePoints: 4,
    maxClears: 5,
    stackProductionBonus: 0.012,
    requiresAscensions: 0,
    entryCost: 'ascension',
  },
  {
    id: 'hollow-choir',
    name: 'Hollow Choir',
    description:
      'Ascension challenge: reach sector 30 with AI assists disabled and half hull. Requires 1 prior Ascension.',
    restriction: 'AI inactive · hull ×0.5 · starts via Ascension',
    goalSector: 30,
    rewardChallengePoints: 5,
    maxClears: 6,
    stackDamageBonus: 0.008,
    stackRepairBonus: 0.02,
    requiresAscensions: 1,
    entryCost: 'ascension',
  },
]

export const SHIP_FRAMES: ShipFrameDef[] = [
  {
    id: 'scout-frame',
    name: 'Scout Frame',
    weaponSlots: 1,
    defenseSlots: 1,
    utilitySlots: 0,
    baseDamage: 0,
    baseHull: 40,
    unlockCost: {},
  },
  {
    id: 'line-frame',
    name: 'Frigate Hull',
    weaponSlots: 2,
    defenseSlots: 1,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 48,
    unlockCost: {},
    requiresSectorEver: 4,
  },
  {
    id: 'cruiser-frame',
    name: 'Cruiser Hull',
    weaponSlots: 2,
    defenseSlots: 2,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 70,
    unlockCost: {},
    requiresSectorEver: 8,
  },
  {
    id: 'heavy-cruiser-frame',
    name: 'Heavy Cruiser Hull',
    weaponSlots: 3,
    defenseSlots: 2,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 95,
    unlockCost: {},
    requiresSectorEver: 24,
  },
  {
    id: 'battlecruiser-frame',
    name: 'Battlecruiser Hull',
    weaponSlots: 3,
    defenseSlots: 3,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 125,
    unlockCost: {},
    requiresSectorEver: 41,
  },
  {
    id: 'capital-frame',
    name: 'Capital Hull',
    weaponSlots: 4,
    defenseSlots: 3,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 160,
    unlockCost: {},
    requiresSectorEver: 75,
  },
  {
    id: 'razor-frame',
    name: 'Razor Frame',
    weaponSlots: 2,
    defenseSlots: 0,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 24,
    unlockCost: { alloys: 55, scrap: 120, energy: 20 },
    requiresSectorEver: 12,
  },
  {
    id: 'pathfinder-frame',
    name: 'Pathfinder Frame',
    weaponSlots: 1,
    defenseSlots: 0,
    utilitySlots: 2,
    baseDamage: 0,
    baseHull: 28,
    unlockCost: { alloys: 50, scrap: 110, data: 25 },
    requiresSectorEver: 12,
  },
  {
    id: 'bastion-frame',
    name: 'Bastion Frame',
    weaponSlots: 1,
    defenseSlots: 2,
    utilitySlots: 1,
    baseDamage: 0,
    baseHull: 52,
    unlockCost: { alloys: 95, scrap: 180, energy: 35 },
    requiresSectorEver: 14,
  },
]

export function frameTotalSlots(frame: ShipFrameDef): number {
  return frame.weaponSlots + frame.defenseSlots + frame.utilitySlots
}

export function frameRoleCap(frame: ShipFrameDef, role: ModuleRole): number {
  if (role === 'weapon') return frame.weaponSlots
  if (role === 'defense') return frame.defenseSlots
  return frame.utilitySlots
}

/** Count fitted modules by role. */
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

/** Keep modules that fit the frame's role caps (preserves order). */
export function trimModulesToFrame(
  moduleIds: string[],
  frame: ShipFrameDef,
): string[] {
  const kept: string[] = []
  const used: Record<ModuleRole, number> = {
    weapon: 0,
    defense: 0,
    utility: 0,
  }
  for (const id of moduleIds) {
    const role = getModule(id)?.role
    if (!role) continue
    if (used[role] >= frameRoleCap(frame, role)) continue
    used[role] += 1
    kept.push(id)
  }
  return kept
}

export function canFitModuleOnFrame(
  frame: ShipFrameDef,
  fittedModuleIds: string[],
  moduleId: string,
): boolean {
  const mod = getModule(moduleId)
  if (!mod) return false
  if (fittedModuleIds.includes(moduleId)) return false
  const used = fittedRoleSlotCounts(fittedModuleIds)
  return used[mod.role] < frameRoleCap(frame, mod.role)
}

export const SHIP_MODULES: ShipModuleDef[] = [
  {
    id: 'pulse-cannon',
    name: 'Pulse Cannon',
    role: 'weapon',
    description:
      'Starter weapon. Energy bolts with long reach. Weak against armour. Salvage levels raise the damage of every shot.',
    damageBonus: 3,
    hullBonus: 0,
    damageTakenMult: 1,
    upgradeBaseCost: 3,
    upgradeCostScaling: 1.21,
    weapon: {
      name: 'Pulse',
      damage: 10,
      damagePerLevel: 5,
      cooldown: 2,
      range: 180,
      tags: ['energy'],
      hullDamage: 1,
      shieldDamage: 1,
      armorDamage: 0.25,
    },
    unlockCost: {},
  },
  {
    id: 'plate-layer',
    name: 'Plate Layer',
    role: 'defense',
    description:
      'Starter shield. Raises the shield ceiling and regenerates in the fight. Regeneration pauses briefly after a hit. Salvage levels thicken the bank.',
    damageBonus: 0,
    hullBonus: 0,
    shieldBonus: 30,
    shieldBonusPerLevel: 5,
    shieldRegen: 0.05,
    damageTakenMult: 1,
    upgradeBaseCost: 6,
    upgradeCostScaling: 1.2,
    unlockCost: {},
  },
  {
    id: 'vector-thruster',
    name: 'Vector Thruster',
    role: 'utility',
    description:
      'Steering jets. Harder to hit, and each incoming shot hurts less. Helps against twitchy, hard-to-lock hulls.',
    damageBonus: 0,
    hullBonus: 0,
    evasionBonus: 0.12,
    damageTakenMult: 0.88,
    unlockCost: { scrap: 30, alloys: 12 },
  },
  {
    id: 'heavy-lance',
    name: 'Heavy Lance',
    role: 'weapon',
    description:
      'Heavy pierce lance. Hits hard and slowly. Strong against plated hulls and bosses; weaker at clearing packs.',
    damageBonus: 10,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Lance',
      damage: 38,
      cooldown: 2.5,
      range: 145,
      tags: ['kinetic', 'pierce'],
    },
    unlockCost: { scrap: 50, alloys: 20 },
  },
  {
    id: 'flak-array',
    name: 'Flak Array',
    role: 'weapon',
    description:
      'Short-range splash. Best at shredding packs that close in. Weak if the fight stays at long range.',
    damageBonus: 6,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Flak',
      damage: 14,
      cooldown: 1.05,
      range: 55,
      tags: ['kinetic', 'splash'],
      splash: 2,
    },
    unlockCost: { scrap: 45, alloys: 18 },
  },
  {
    id: 'phase-beam',
    name: 'Phase Beam',
    role: 'weapon',
    description:
      'A held energy beam that strips shields. Strong against glowing, hard-to-lock hulls once they enter range.',
    damageBonus: 7,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Phase Beam',
      damage: 19,
      cooldown: 1.4,
      range: 130,
      tags: ['energy', 'antiShield'],
      delivery: 'beam',
    },
    unlockCost: { scrap: 55, alloys: 22, data: 8 },
  },
  {
    id: 'barrier-projector',
    name: 'Barrier Projector',
    role: 'defense',
    description:
      'A second shield envelope plus a little hull. The bank regenerates in the fight and while you sit docked.',
    damageBonus: 0,
    hullBonus: 12,
    shieldBonus: 60,
    damageTakenMult: 1,
    unlockCost: { scrap: 40, alloys: 16, energy: 20 },
  },
  {
    id: 'drone-bay',
    name: 'Yield Link',
    role: 'utility',
    description:
      'Marks wrecks so each kill pays more Salvage. Drones stay on the Network — nothing extra flies on Sortie.',
    damageBonus: 0,
    hullBonus: 0,
    damageTakenMult: 1,
    salvageKillBonus: 0.12,
    unlockCost: { scrap: 60, alloys: 25, energy: 15 },
  },
  {
    id: 'rail-driver',
    name: 'Rail Driver',
    role: 'weapon',
    description:
      'Longest-range pierce rails. Punishes hulls that hang back. Slightly slower than Pulse at close range.',
    damageBonus: 8,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Rail',
      damage: 26,
      cooldown: 1.85,
      range: 165,
      tags: ['kinetic', 'pierce'],
    },
    unlockCost: { scrap: 70, alloys: 28, data: 6 },
  },
  {
    id: 'ion-burst',
    name: 'Ion Burst',
    role: 'weapon',
    description:
      'Mid-range energy splash. Softens pack shields between Flak’s short burst and Phase Beam’s long hold.',
    damageBonus: 6,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Ion Burst',
      damage: 13,
      cooldown: 1.15,
      range: 100,
      tags: ['energy', 'antiShield', 'splash'],
      splash: 1,
    },
    unlockCost: { scrap: 65, alloys: 24, energy: 18 },
  },
  {
    id: 'ablative-mesh',
    name: 'Ablative Mesh',
    role: 'defense',
    description:
      'Hybrid plating: hull, armour, and a modest shield bank. Built to soak boss chip rather than dodge it.',
    damageBonus: 0,
    hullBonus: 30,
    armorBonus: 3,
    shieldBonus: 25,
    damageTakenMult: 1,
    unlockCost: { scrap: 55, alloys: 22 },
  },
  {
    id: 'grav-tether',
    name: 'Grav Tether',
    role: 'utility',
    description:
      'A gravity snare. You take less from each shot and dodge more. Helps hold short-range guns on hulls that hang back.',
    damageBonus: 0,
    hullBonus: 10,
    evasionBonus: 0.08,
    damageTakenMult: 0.85,
    unlockCost: { scrap: 50, alloys: 20, energy: 12 },
  },
  {
    id: 'nano-lathe',
    name: 'Nano Lathe',
    role: 'utility',
    description:
      'Dockside repair lathe. Hull and shield restore faster while you sit out of the fight. Small hull pad.',
    damageBonus: 0,
    hullBonus: 10,
    damageTakenMult: 1,
    unlockCost: { scrap: 45, alloys: 18, data: 10 },
  },
  {
    id: 'salvage-rig',
    name: 'Salvage Rig',
    role: 'utility',
    description:
      'A wreck claw. Sector clears this run pay more scrap. Comes off when you Rebuild.',
    damageBonus: 2,
    hullBonus: 0,
    damageTakenMult: 1,
    unlockCost: { scrap: 40, alloys: 15 },
  },
  {
    id: 'surge-capacitor',
    name: 'Surge Capacitor',
    role: 'utility',
    description:
      'Printed schematic. You take less from each shot and gain hull. Not found as wreck loot — buy the print, then fit it.',
    damageBonus: 0,
    hullBonus: 20,
    damageTakenMult: 0.9,
    unlockCost: {},
    requiresChallengeShop: 'schematic-surge',
  },
  {
    id: 'mirror-plate',
    name: 'Mirror Plate',
    role: 'defense',
    description:
      'Printed schematic plating. Extra hull and armour. Not found as wreck loot — buy the print, then fit it.',
    damageBonus: 0,
    hullBonus: 40,
    armorBonus: 5,
    damageTakenMult: 1,
    unlockCost: {},
    requiresChallengeShop: 'schematic-mirror',
  },
]

export function moduleLevel(
  levels: Record<string, number> | undefined,
  moduleId: string,
): number {
  return Math.max(0, levels?.[moduleId] ?? 0)
}

/**
 * Salvage cost to raise a Core from `level` → level+1.
 * USI: weapons 3 × 1.21^n, shields 6 × 1.2^n.
 */
export function moduleUpgradeCost(level: number, moduleId?: string): number {
  const n = Math.max(0, level)
  const mod = moduleId ? getModule(moduleId) : undefined
  const base =
    mod?.upgradeBaseCost ?? (mod?.role === 'defense' ? 6 : 3)
  const scaling =
    mod?.upgradeCostScaling ?? (mod?.role === 'defense' ? 1.2 : 1.21)
  return Math.ceil(base * scaling ** n)
}

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

export type { PartType }

export const PART_TYPES: PartType[] = ['casing', 'core', 'lens']

/** Seconds for one fab-bay worker to finish a filled recipe. */
export const FAB_SECONDS = 120

export const MAX_MODULE_MASTERY = 10

/** Parts consumed per mastery rank (any part types of that module). */
export const MASTERY_PARTS_COST = 3

const STARTER_UNLOCK_MODULES = new Set(['pulse-cannon', 'plate-layer'])
const SCHEMATIC_MODULES = new Set(['surge-capacitor', 'mirror-plate'])

export interface BlueprintRecipe {
  moduleId: string
  casing: number
  core: number
  lens: number
}

export interface EnemyPartDropEntry {
  moduleId: string
  partType: PartType
  weight: number
}

export interface EnemyPartDropTable {
  family: string
  entries: EnemyPartDropEntry[]
  /** Base chance per kill (0..1). */
  chance: number
  bossChanceMult?: number
  bossRolls?: number
}

export function partId(moduleId: string, partType: PartType): string {
  return `${moduleId}:${partType}`
}

export function parsePartId(
  id: string,
): { moduleId: string; partType: PartType } | null {
  const idx = id.lastIndexOf(':')
  if (idx <= 0) return null
  const moduleId = id.slice(0, idx)
  const partType = id.slice(idx + 1) as PartType
  if (!PART_TYPES.includes(partType)) return null
  if (!getModule(moduleId)) return null
  return { moduleId, partType }
}

/** Farmable blueprint recipes (not starter scrap unlocks, not CP schematics). */
export const BLUEPRINTS: BlueprintRecipe[] = [
  { moduleId: 'flak-array', casing: 5, core: 3, lens: 2 },
  { moduleId: 'vector-thruster', casing: 5, core: 3, lens: 2 },
  { moduleId: 'heavy-lance', casing: 4, core: 3, lens: 2 },
  { moduleId: 'phase-beam', casing: 4, core: 3, lens: 2 },
  { moduleId: 'barrier-projector', casing: 5, core: 3, lens: 2 },
  { moduleId: 'drone-bay', casing: 4, core: 3, lens: 2 },
  { moduleId: 'rail-driver', casing: 5, core: 4, lens: 3 },
  { moduleId: 'ion-burst', casing: 5, core: 4, lens: 3 },
  { moduleId: 'ablative-mesh', casing: 5, core: 4, lens: 3 },
  { moduleId: 'grav-tether', casing: 5, core: 4, lens: 3 },
  { moduleId: 'nano-lathe', casing: 5, core: 4, lens: 3 },
  { moduleId: 'salvage-rig', casing: 5, core: 4, lens: 3 },
]

export function getBlueprint(moduleId: string): BlueprintRecipe | undefined {
  return BLUEPRINTS.find((b) => b.moduleId === moduleId)
}

export function isFarmableModule(moduleId: string): boolean {
  return getBlueprint(moduleId) != null
}

export function isStarterUnlockModule(moduleId: string): boolean {
  return STARTER_UNLOCK_MODULES.has(moduleId)
}

export function isSchematicModule(moduleId: string): boolean {
  return SCHEMATIC_MODULES.has(moduleId) || !!getModule(moduleId)?.requiresChallengeShop
}

/** Base part drop chances — intentionally sparse; buff via Logistics / shops / cores. */
export const ENEMY_PART_DROPS: EnemyPartDropTable[] = [
  {
    family: 'swarm',
    chance: 0.028,
    bossChanceMult: 2.2,
    bossRolls: 2,
    entries: [
      { moduleId: 'flak-array', partType: 'casing', weight: 4 },
      { moduleId: 'flak-array', partType: 'core', weight: 2 },
      { moduleId: 'flak-array', partType: 'lens', weight: 1 },
      { moduleId: 'salvage-rig', partType: 'casing', weight: 2 },
      { moduleId: 'salvage-rig', partType: 'core', weight: 1 },
      { moduleId: 'drone-bay', partType: 'casing', weight: 1 },
    ],
  },
  {
    family: 'armored',
    chance: 0.028,
    bossChanceMult: 2.2,
    bossRolls: 2,
    entries: [
      { moduleId: 'heavy-lance', partType: 'casing', weight: 3 },
      { moduleId: 'heavy-lance', partType: 'core', weight: 2 },
      { moduleId: 'heavy-lance', partType: 'lens', weight: 1 },
      { moduleId: 'ablative-mesh', partType: 'casing', weight: 2 },
      { moduleId: 'ablative-mesh', partType: 'core', weight: 2 },
      { moduleId: 'ablative-mesh', partType: 'lens', weight: 1 },
    ],
  },
  {
    family: 'ethereal',
    chance: 0.026,
    bossChanceMult: 2.3,
    bossRolls: 2,
    entries: [
      { moduleId: 'phase-beam', partType: 'casing', weight: 2 },
      { moduleId: 'phase-beam', partType: 'core', weight: 2 },
      { moduleId: 'phase-beam', partType: 'lens', weight: 2 },
      { moduleId: 'vector-thruster', partType: 'casing', weight: 3 },
      { moduleId: 'vector-thruster', partType: 'core', weight: 2 },
      { moduleId: 'vector-thruster', partType: 'lens', weight: 1 },
    ],
  },
  {
    family: 'divine',
    chance: 0.024,
    bossChanceMult: 2.4,
    bossRolls: 2,
    entries: [
      { moduleId: 'ion-burst', partType: 'casing', weight: 2 },
      { moduleId: 'ion-burst', partType: 'core', weight: 2 },
      { moduleId: 'ion-burst', partType: 'lens', weight: 2 },
      { moduleId: 'grav-tether', partType: 'casing', weight: 2 },
      { moduleId: 'grav-tether', partType: 'core', weight: 2 },
      { moduleId: 'grav-tether', partType: 'lens', weight: 1 },
    ],
  },
  {
    family: 'titan',
    chance: 0.072,
    bossChanceMult: 1.4,
    bossRolls: 2,
    entries: [
      { moduleId: 'rail-driver', partType: 'casing', weight: 3 },
      { moduleId: 'rail-driver', partType: 'core', weight: 2 },
      { moduleId: 'rail-driver', partType: 'lens', weight: 2 },
      { moduleId: 'nano-lathe', partType: 'casing', weight: 2 },
      { moduleId: 'nano-lathe', partType: 'core', weight: 2 },
      { moduleId: 'nano-lathe', partType: 'lens', weight: 2 },
      { moduleId: 'barrier-projector', partType: 'casing', weight: 2 },
      { moduleId: 'barrier-projector', partType: 'core', weight: 2 },
      { moduleId: 'barrier-projector', partType: 'lens', weight: 1 },
    ],
  },
]

/** Extra late-module weights unlocked at higher sectors. */
function sectorBonusDropEntries(sector: number): EnemyPartDropEntry[] {
  const extras: EnemyPartDropEntry[] = []
  if (sector >= 8) {
    extras.push(
      { moduleId: 'barrier-projector', partType: 'casing', weight: 1 },
      { moduleId: 'drone-bay', partType: 'core', weight: 1 },
      { moduleId: 'salvage-rig', partType: 'lens', weight: 1 },
    )
  }
  if (sector >= 12) {
    extras.push(
      { moduleId: 'rail-driver', partType: 'casing', weight: 1 },
      { moduleId: 'ion-burst', partType: 'core', weight: 1 },
      { moduleId: 'ablative-mesh', partType: 'lens', weight: 1 },
    )
  }
  if (sector >= 18) {
    extras.push(
      { moduleId: 'grav-tether', partType: 'core', weight: 1 },
      { moduleId: 'nano-lathe', partType: 'lens', weight: 1 },
      { moduleId: 'rail-driver', partType: 'lens', weight: 1 },
    )
  }
  return extras
}

export function getEnemyDropTable(family: string): EnemyPartDropTable | undefined {
  return ENEMY_PART_DROPS.find((t) => t.family === family)
}

/** Weighted pick among drop entries (+ sector extras). Pure helper for tests. */
export function pickWeightedDropEntry(
  family: string,
  sector: number,
  rng: () => number = Math.random,
): EnemyPartDropEntry | null {
  const table = getEnemyDropTable(family)
  if (!table) return null
  const entries = [...table.entries, ...sectorBonusDropEntries(sector)]
  const total = entries.reduce((s, e) => s + e.weight, 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return entries[entries.length - 1] ?? null
}

export function isBlueprintComplete(
  contributed: Partial<Record<PartType, number>> | undefined,
  recipe: BlueprintRecipe,
): boolean {
  return (
    (contributed?.casing ?? 0) >= recipe.casing &&
    (contributed?.core ?? 0) >= recipe.core &&
    (contributed?.lens ?? 0) >= recipe.lens
  )
}

/** Inventory + project contributed vs recipe needs. */
export function blueprintProgress(
  state: GameState,
  moduleId: string,
): { owned: Record<PartType, number>; need: Record<PartType, number>; complete: boolean } | null {
  const recipe = getBlueprint(moduleId)
  if (!recipe) return null
  const owned: Record<PartType, number> = { casing: 0, core: 0, lens: 0 }
  for (const pt of PART_TYPES) {
    owned[pt] = state.parts[partId(moduleId, pt)] ?? 0
  }
  const project = state.base.fabProject
  if (project?.moduleId === moduleId) {
    for (const pt of PART_TYPES) {
      owned[pt] += project.contributed[pt] ?? 0
    }
  }
  const need: Record<PartType, number> = {
    casing: recipe.casing,
    core: recipe.core,
    lens: recipe.lens,
  }
  return {
    owned,
    need,
    complete: isBlueprintComplete(owned, recipe),
  }
}

export function canDepositPart(
  state: GameState,
  partType: PartType,
  qty = 1,
): boolean {
  const project = state.base.fabProject
  if (!project || qty <= 0) return false
  const recipe = getBlueprint(project.moduleId)
  if (!recipe) return false
  const need = recipe[partType]
  const have = project.contributed[partType] ?? 0
  const room = need - have
  if (room <= 0) return false
  const inv = state.parts[partId(project.moduleId, partType)] ?? 0
  return inv >= Math.min(qty, room)
}

export function partSellScrap(partIdStr: string): number {
  const parsed = parsePartId(partIdStr)
  if (!parsed) return 0
  if (parsed.partType === 'casing') return 4
  if (parsed.partType === 'core') return 6
  return 8
}

export function masteryBonus(rank: number): number {
  return 1 + 0.025 * Math.min(MAX_MODULE_MASTERY, Math.max(0, rank))
}

export function moduleMasteryRank(
  state: { meta: { moduleMastery?: Record<string, number> } },
  moduleId: string,
): number {
  return Math.max(0, state.meta.moduleMastery?.[moduleId] ?? 0)
}

/** Count of any parts for a module in account inventory. */
export function countModuleParts(state: GameState, moduleId: string): number {
  let n = 0
  for (const pt of PART_TYPES) {
    n += state.parts[partId(moduleId, pt)] ?? 0
  }
  return n
}

export function isModuleVisible(state: GameState, moduleId: string): boolean {
  if (isStarterUnlockModule(moduleId)) return true
  if (state.shipyard.unlockedModules.includes(moduleId)) return true
  if (state.meta.discoveredModules.includes(moduleId)) return true
  const mod = getModule(moduleId)
  if (mod?.requiresChallengeShop) {
    return shopRank(state.prestige.shop, mod.requiresChallengeShop) >= 1
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
    activeChallengeId: string | null
    shop: Record<string, number>
    matterShop: Record<string, number>
  }
  meta?: { lifetimeDronesBuilt?: number }
  network?: { links?: { racks?: number; acuity?: number } }
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
  for (const [id, rank] of Object.entries(state.prestige.matterShop)) {
    const bonus = getMatterShopItem(id)?.dronePowerBonus ?? 0
    if (bonus) power += bonus * matterShopEffectScale(rank)
  }
  for (const [id, rank] of Object.entries(state.prestige.shop)) {
    const bonus = getChallengeShopItem(id)?.dronePowerBonus ?? 0
    if (bonus) power += bonus * matterShopEffectScale(rank)
  }
  const acuity = Math.max(0, Math.floor(state.network?.links?.acuity ?? 0))
  power += NETWORK_ACUITY_PER_RANK * acuity
  return Math.max(0.05, power)
}

/** Max worker drones the corps may hold (manufacture stops at cap). */
export function droneCap(state: DroneEconomyState): number {
  let cap = BASE_DRONE_CAP
  for (const id of state.research.unlocked) {
    cap += RESEARCH.find((r) => r.id === id)?.droneCapBonus ?? 0
  }
  if (!challengeBlocksAi(state)) {
    for (const id of state.ai.purchased) {
      cap += getAiNode(id)?.droneCapBonus ?? 0
    }
  }
  for (const [id, rank] of Object.entries(state.prestige.matterShop)) {
    const bonus = getMatterShopItem(id)?.droneCapBonus ?? 0
    if (bonus) cap += bonus * Math.max(0, rank)
  }
  for (const [id, rank] of Object.entries(state.prestige.shop)) {
    const bonus = getChallengeShopItem(id)?.droneCapBonus ?? 0
    if (bonus) cap += bonus * Math.max(0, rank)
  }
  const lifetime = Math.max(0, Math.floor(state.meta?.lifetimeDronesBuilt ?? 0))
  cap += Math.min(
    LIFETIME_DRONE_CAP_MAX,
    Math.floor(lifetime / LIFETIME_DRONES_PER_CAP),
  )
  const racks = Math.max(0, Math.floor(state.network?.links?.racks ?? 0))
  cap += NETWORK_RACK_CAP_PER_RANK * racks
  return Math.max(1, Math.floor(cap))
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
  const effective = assigned * dronePower(state)
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

/**
 * Advance Fabrication Bay craft when recipe is filled and workers are assigned.
 * Mutates state. Returns true if a module was completed this call.
 * `fabSpeedMult` comes from Logistics Core (default 1).
 */
export function advanceFabProject(
  state: GameState,
  dtSeconds: number,
  log?: (line: string) => void,
  fabSpeedMult = 1,
): boolean {
  if (dtSeconds <= 0) return false
  if (!isStationUnlocked(state, 'fab-bay')) return false
  const workers = stationEffectiveDrones(state, 'fab-bay')
  const project = state.base.fabProject
  if (workers <= 0 || !project) return false
  const recipe = getBlueprint(project.moduleId)
  if (!recipe || !isBlueprintComplete(project.contributed, recipe)) return false

  project.progress += (workers * dtSeconds * Math.max(0.05, fabSpeedMult)) / FAB_SECONDS
  if (project.progress < 1) return false

  const mod = getModule(project.moduleId)
  const name = mod?.name ?? project.moduleId
  if (!state.shipyard.unlockedModules.includes(project.moduleId)) {
    state.shipyard.unlockedModules = [
      ...state.shipyard.unlockedModules,
      project.moduleId,
    ]
  }
  if (!state.meta.discoveredModules.includes(project.moduleId)) {
    state.meta.discoveredModules = [
      ...state.meta.discoveredModules,
      project.moduleId,
    ]
  }
  state.base.fabProject = null
  state.meta.lifetimeFabCrafts = (state.meta.lifetimeFabCrafts ?? 0) + 1
  log?.(`Fabrication complete: ${name} unlocked permanently.`)
  return true
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

export function getChallenge(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id)
}

export function getEssenceUpgrade(id: string): EssenceUpgradeDef | undefined {
  return ESSENCE_UPGRADES.find((e) => e.id === id)
}

export function getChallengeShopItem(id: string): ChallengeShopDef | undefined {
  return CHALLENGE_SHOP.find((c) => c.id === id)
}

export function getMatterShopItem(id: string): MatterShopDef | undefined {
  return MATTER_SHOP.find((m) => m.id === id)
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
  return true
}

export function assignedWorkers(assignments: Record<string, number>): number {
  return Object.values(assignments).reduce((sum, n) => sum + Math.max(0, n), 0)
}

export function idleWorkers(state: {
  base: { workerDrones: number; assignments: Record<string, number> }
}): number {
  return Math.max(0, state.base.workerDrones - assignedWorkers(state.base.assignments))
}

/** Rank owned for a shop id (0 if missing). */
export function shopRank(ranks: Record<string, number> | undefined, id: string): number {
  return Math.max(0, ranks?.[id] ?? 0)
}

/** Cost to buy the next rank (rank 0→1 = base cost). */
export function nextShopCost(baseCost: number, currentRank: number): number {
  return Math.ceil(baseCost * 2 ** Math.max(0, currentRank))
}

/** Diminishing stack: rank 1 = 1× base; each extra rank adds 45% of base. */
export function matterShopEffectScale(rank: number): number {
  if (rank <= 0) return 0
  return 1 + 0.45 * (rank - 1)
}

export function shopMaxRank(def: { maxRank?: number }): number {
  return def.maxRank ?? 1
}

function metaAnyGatePasses(
  state: {
    prestige: { prestigeCount: number; challengeClears: Record<string, number> }
    meta: { act1Cleared: boolean; highestSectorEver: number }
    combat?: { highestSector?: number }
  },
  gate: ShopMetaAnyGate,
): boolean {
  if (gate.act1Cleared && state.meta.act1Cleared) return true
  if (gate.prestiges != null && state.prestige.prestigeCount >= gate.prestiges) return true
  if (gate.sectorEver != null) {
    const ever = Math.max(state.meta.highestSectorEver, state.combat?.highestSector ?? 0)
    if (ever >= gate.sectorEver) return true
  }
  if (gate.anyChallengeClear) {
    const clears = Object.values(state.prestige.challengeClears).some((n) => n > 0)
    if (clears) return true
  }
  return false
}

export type ShopBuyCheck =
  | { ok: true; cost: number; nextRank: number; maxRank: number }
  | { ok: false; reason: string; cost?: number; nextRank?: number; maxRank?: number }

function matterRankGateReason(
  state: {
    prestige: { prestigeCount: number }
    meta: { act1Cleared: boolean; highestSectorEver: number; ascensionCount?: number }
  },
  nextRank: number,
): string | null {
  const ascensions = state.meta.ascensionCount ?? 0
  if (nextRank >= 20) {
    if (ascensions < 2) return 'Need 2 Reinforces for rank 20+'
  }
  if (nextRank >= 15) {
    if (ascensions < 1) return 'Need 1 Reinforce for rank 15+'
  }
  if (nextRank >= 10) {
    if (!state.meta.act1Cleared && ascensions < 1 && state.prestige.prestigeCount < 8) {
      return 'Need Act 1, 1 Reinforce, or 8 Rebuilds for rank 10+'
    }
  }
  if (nextRank >= 7) {
    if (!state.meta.act1Cleared && state.prestige.prestigeCount < 5) {
      return 'Need Act 1 cleared or 5 Rebuilds for rank 7+'
    }
  }
  if (nextRank >= 4) {
    if (state.prestige.prestigeCount < 1 && state.meta.highestSectorEver < 12) {
      return 'Need 1 Rebuild or sector 12 career for rank 4+'
    }
  }
  return null
}

export function canBuyMatterShop(
  state: {
    resources: { prestigeMatter: number }
    prestige: { prestigeCount: number; matterShop: Record<string, number> }
    meta: { act1Cleared: boolean; highestSectorEver: number; ascensionCount?: number }
  },
  itemId: string,
): ShopBuyCheck {
  const def = getMatterShopItem(itemId)
  if (!def) return { ok: false, reason: 'Unknown item' }
  const current = shopRank(state.prestige.matterShop, itemId)
  const maxRank = shopMaxRank(def)
  const nextRank = current + 1
  const cost = nextShopCost(def.costPm, current)
  if (current >= maxRank) {
    return { ok: false, reason: 'Max rank', cost, nextRank, maxRank }
  }
  const gate = matterRankGateReason(state, nextRank)
  if (gate) return { ok: false, reason: gate, cost, nextRank, maxRank }
  if (state.resources.prestigeMatter < cost) {
    return { ok: false, reason: `Need ${cost} Rebuild Matter`, cost, nextRank, maxRank }
  }
  return { ok: true, cost, nextRank, maxRank }
}

export function canBuyChallengeShop(
  state: {
    resources: { challengePoints: number }
    prestige: {
      prestigeCount: number
      shop: Record<string, number>
      matterShop: Record<string, number>
      challengeClears: Record<string, number>
    }
    meta: { act1Cleared: boolean; highestSectorEver: number }
    combat?: { highestSector?: number }
  },
  itemId: string,
): ShopBuyCheck {
  const def = getChallengeShopItem(itemId)
  if (!def) return { ok: false, reason: 'Unknown item' }
  const current = shopRank(state.prestige.shop, itemId)
  const maxRank = shopMaxRank(def)
  const nextRank = current + 1
  const cost = nextShopCost(def.costCp, current)
  if (current >= maxRank) {
    return { ok: false, reason: 'Max rank', cost, nextRank, maxRank }
  }
  if (def.requiresPrestiges != null && state.prestige.prestigeCount < def.requiresPrestiges) {
    return {
      ok: false,
      reason: `Need ${def.requiresPrestiges} prestige${def.requiresPrestiges === 1 ? '' : 's'}`,
      cost,
      nextRank,
      maxRank,
    }
  }
  if (def.requiresSectorEver != null) {
    const ever = Math.max(state.meta.highestSectorEver, state.combat?.highestSector ?? 0)
    if (ever < def.requiresSectorEver) {
      return {
        ok: false,
        reason: `Need career sector ${def.requiresSectorEver}`,
        cost,
        nextRank,
        maxRank,
      }
    }
  }
  if (def.requiresAct1 && !state.meta.act1Cleared) {
    return { ok: false, reason: 'Need Act 1 cleared', cost, nextRank, maxRank }
  }
  if (def.requiresShopRank) {
    const ranks =
      def.requiresShopRank.shop === 'matter'
        ? state.prestige.matterShop
        : state.prestige.shop
    if (shopRank(ranks, def.requiresShopRank.id) < def.requiresShopRank.rank) {
      const need = getChallengeShopItem(def.requiresShopRank.id)?.name
        ?? getMatterShopItem(def.requiresShopRank.id)?.name
        ?? def.requiresShopRank.id
      return {
        ok: false,
        reason: `Need ${need} rank ${def.requiresShopRank.rank}`,
        cost,
        nextRank,
        maxRank,
      }
    }
  }
  if (def.requiresMetaAny && !metaAnyGatePasses(state, def.requiresMetaAny)) {
    return { ok: false, reason: 'Meta requirements not met', cost, nextRank, maxRank }
  }
  if (state.resources.challengePoints < cost) {
    return { ok: false, reason: `Need ${cost} CP`, cost, nextRank, maxRank }
  }
  return { ok: true, cost, nextRank, maxRank }
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
  for (const [id, rank] of Object.entries(state.prestige.shop)) {
    const bonus = getChallengeShopItem(id)?.manufactureBonus ?? 0
    if (bonus) speed += bonus * matterShopEffectScale(rank)
  }
  for (const [id, rank] of Object.entries(state.prestige.matterShop)) {
    const bonus = getMatterShopItem(id)?.manufactureBonus ?? 0
    if (bonus) speed += bonus * matterShopEffectScale(rank)
  }
  const fab = stationEffectiveDrones(state, 'drone-fab')
  const fabDef = getStation('drone-fab')
  if (fab > 0 && fabDef?.manufactureBonusPerDrone) {
    speed += fab * fabDef.manufactureBonusPerDrone
  }
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
  shop: Record<string, number> = {},
  matterShop: Record<string, number> = {},
  challengeClears: Record<string, number> = {},
): number {
  // Unspent PM/CP still help a little; spending unlocks stronger shop effects.
  let mult = 1 + prestigeMatter * 0.006 + challengePoints * 0.01
  for (const [id, rank] of Object.entries(shop)) {
    const def = getChallengeShopItem(id)
    if (def?.damageBonus) mult += def.damageBonus * matterShopEffectScale(rank)
  }
  for (const [id, rank] of Object.entries(matterShop)) {
    const def = getMatterShopItem(id)
    if (def?.damageBonus) mult += def.damageBonus * matterShopEffectScale(rank)
  }
  mult += challengeStackDamageBonus(challengeClears)
  return mult
}

export function metaProductionMultiplier(
  prestigeMatter: number,
  matterShop: Record<string, number> = {},
  challengeClears: Record<string, number> = {},
): number {
  let mult = 1 + prestigeMatter * 0.006
  for (const [id, rank] of Object.entries(matterShop)) {
    const def = getMatterShopItem(id)
    if (def?.productionBonus) mult += def.productionBonus * matterShopEffectScale(rank)
  }
  mult += challengeStackProductionBonus(challengeClears)
  return mult
}

/**
 * Soft USI-style run acceleration from career prestiges / ascensions.
 * Each Rebuild should feel like a USI core-swap recover, not a dead zone.
 * Caps keep late-game from exploding; shops remain the main sink.
 */
export function prestigeMomentumDamageBonus(
  prestigeCount: number,
  ascensionCount: number,
): number {
  const fromPrestige = Math.min(0.5, Math.max(0, prestigeCount) * 0.04)
  const fromAscension = Math.min(0.5, Math.max(0, ascensionCount) * 0.08)
  return fromPrestige + fromAscension
}

export function prestigeMomentumProductionBonus(
  prestigeCount: number,
  ascensionCount: number,
): number {
  const fromPrestige = Math.min(0.42, Math.max(0, prestigeCount) * 0.03)
  const fromAscension = Math.min(0.4, Math.max(0, ascensionCount) * 0.06)
  return fromPrestige + fromAscension
}

export function matterShopHullBonus(matterShop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(matterShop)) {
    const bonus = getMatterShopItem(id)?.hullBonus ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

export function matterShopShieldBonus(matterShop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(matterShop)) {
    const bonus = getMatterShopItem(id)?.shieldBonus ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

export function matterShopScrapBonus(matterShop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(matterShop)) {
    const bonus = getMatterShopItem(id)?.scrapBonus ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

/** Additive blueprint part drop chance from Matter shop ranks. */
export function matterShopDropBonus(matterShop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(matterShop)) {
    const bonus = getMatterShopItem(id)?.dropBonus ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

/** Additive blueprint part drop chance from Challenge shop ranks. */
export function challengeShopDropBonus(shop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(shop)) {
    const bonus = getChallengeShopItem(id)?.dropBonus ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

export function matterShopDataPerClear(matterShop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(matterShop)) {
    const bonus = getMatterShopItem(id)?.bonusDataPerClear ?? 0
    if (bonus) total += bonus * matterShopEffectScale(rank)
  }
  return total
}

/** Repair duration multiplier from drydock ranks (lower = faster). */
export function matterShopRepairMult(matterShop: Record<string, number>): number {
  let mult = 1
  for (const [id, rank] of Object.entries(matterShop)) {
    const def = getMatterShopItem(id)
    if (def?.repairMult == null || rank <= 0) continue
    const speed = 0.4 * matterShopEffectScale(rank)
    mult *= 1 / (1 + speed)
  }
  return mult
}

export function prestigeMinSectorFor(shop: Record<string, number>): number {
  let min = PRESTIGE_MIN_SECTOR
  for (const [id, rank] of Object.entries(shop)) {
    if (rank < 1) continue
    const def = getChallengeShopItem(id)
    if (def?.prestigeMinSector) min = Math.min(min, def.prestigeMinSector)
  }
  return min
}

export function challengeShopStartingScrap(shop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(shop)) {
    const base = getChallengeShopItem(id)?.startingScrap ?? 0
    if (base) total += base * rank
  }
  return total
}

export function challengeShopStartingAi(shop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(shop)) {
    const base = getChallengeShopItem(id)?.startingAiPoints ?? 0
    if (base) total += base * rank
  }
  return total
}

export function challengeShopStartingSalvage(shop: Record<string, number>): number {
  let total = 0
  for (const [id, rank] of Object.entries(shop)) {
    const base = getChallengeShopItem(id)?.startingSalvage ?? 0
    if (base) total += base * rank
  }
  return total
}

export function challengeShopOfflineMs(shop: Record<string, number>): number {
  let hours = 8
  for (const [id, rank] of Object.entries(shop)) {
    if (rank < 1) continue
    const h = getChallengeShopItem(id)?.offlineHours
    if (h) hours = Math.max(hours, h)
  }
  return hours * 60 * 60 * 1000
}

export function challengeShopMatchupBonus(shop: Record<string, number>): number {
  let bonus = 0
  for (const [id, rank] of Object.entries(shop)) {
    const base = getChallengeShopItem(id)?.matchupBonus ?? 0
    if (base) bonus += base * matterShopEffectScale(rank)
  }
  return bonus
}

export function effectiveMaxClears(
  def: ChallengeDef,
  shopRanks: Record<string, number>,
): number {
  const bonus = shopRank(shopRanks, 'clearance-board') >= 1 ? 5 : 0
  return def.maxClears + bonus
}

/** Short UI blurb for matter shop total effect at rank. */
export function matterShopEffectBlurb(def: MatterShopDef, rank: number): string {
  if (rank <= 0) return 'Not owned'
  const s = matterShopEffectScale(rank)
  const bits: string[] = []
  if (def.damageBonus) bits.push(`+${(def.damageBonus * s * 100).toFixed(1)}% dmg`)
  if (def.productionBonus) bits.push(`+${(def.productionBonus * s * 100).toFixed(1)}% prod`)
  if (def.hullBonus) bits.push(`+${(def.hullBonus * s).toFixed(0)} hull`)
  if (def.shieldBonus) bits.push(`+${(def.shieldBonus * s).toFixed(0)} shield`)
  if (def.scrapBonus) bits.push(`+${(def.scrapBonus * s * 100).toFixed(1)}% scrap`)
  if (def.bonusDataPerClear) {
    bits.push(`+${(def.bonusDataPerClear * s).toFixed(1)} data/clear`)
  }
  if (def.repairMult != null) {
    const speed = 0.4 * s
    bits.push(`+${(speed * 100).toFixed(0)}% repair speed`)
  }
  if (def.droneCapBonus) bits.push(`+${def.droneCapBonus * rank} drone cap`)
  if (def.dronePowerBonus) {
    bits.push(`+${(def.dronePowerBonus * s * 100).toFixed(1)}% drone power`)
  }
  if (def.manufactureBonus) {
    bits.push(`+${(def.manufactureBonus * s * 100).toFixed(1)}% manufacture`)
  }
  if (def.trainingBonus) {
    bits.push(`+${(def.trainingBonus * s * 100).toFixed(1)}% Core training`)
  }
  if (def.dropBonus) bits.push(`+${(def.dropBonus * s * 100).toFixed(1)}% part drops`)
  return bits.join(' · ') || 'Owned'
}

/** Short UI blurb for challenge shop total effect at rank. */
export function challengeShopEffectBlurb(def: ChallengeShopDef, rank: number): string {
  if (rank <= 0) return 'Not owned'
  const s = matterShopEffectScale(rank)
  const bits: string[] = []
  if (def.damageBonus) bits.push(`+${(def.damageBonus * s * 100).toFixed(1)}% dmg`)
  if (def.prestigeMinSector) bits.push(`prestige from sector ${def.prestigeMinSector}`)
  if (def.startingScrap) bits.push(`+${def.startingScrap * rank} start scrap`)
  if (def.startingAiPoints) bits.push(`+${def.startingAiPoints * rank} start AIP`)
  if (def.startingSalvage) bits.push(`+${def.startingSalvage * rank} start salvage`)
  if (def.offlineHours) bits.push(`${def.offlineHours}h offline cap`)
  if (def.matchupBonus) bits.push(`+${(def.matchupBonus * s * 100).toFixed(0)}% matchup`)
  if (def.droneCapBonus) bits.push(`+${def.droneCapBonus * rank} drone cap`)
  if (def.dronePowerBonus) {
    bits.push(`+${(def.dronePowerBonus * s * 100).toFixed(1)}% drone power`)
  }
  if (def.dropBonus) bits.push(`+${(def.dropBonus * s * 100).toFixed(1)}% part drops`)
  if (def.unlockModuleId) {
    const mod = getModule(def.unlockModuleId)
    bits.push(`unlocks ${mod?.name ?? def.unlockModuleId}`)
  }
  if (def.id === 'clearance-board') bits.push('+5 max clears on all challenges')
  return bits.join(' · ') || 'Owned'
}

/** Silent Bridge / Hollow Choir — AI purchases and doctrines inactive. */
export function challengeBlocksAi(state: {
  prestige: { activeChallengeId: string | null }
}): boolean {
  const id = state.prestige.activeChallengeId
  return id === 'no-ai' || id === 'hollow-choir'
}

/** Glass Frame / Hollow Choir — player hull max ×0.5. */
export function challengeThinHull(state: {
  prestige: { activeChallengeId: string | null }
}): boolean {
  const id = state.prestige.activeChallengeId
  return id === 'thin-hull' || id === 'hollow-choir'
}

/** AI combat doctrines are disabled during Silent Bridge / Hollow Choir. */
export function aiDoctrinesActive(
  state: {
    prestige: { activeChallengeId: string | null }
    ai: { purchased: string[] }
  },
  nodeId: string,
): boolean {
  if (challengeBlocksAi(state)) return false
  return state.ai.purchased.includes(nodeId)
}

/** Highest owned combat-speed multiplier (1 = real-time). Combat path only. */
export function combatSpeedMultiplier(state: {
  prestige: { activeChallengeId: string | null }
  ai: { purchased: string[] }
}): number {
  if (challengeBlocksAi(state)) return 1
  let best = 1
  for (const id of state.ai.purchased) {
    const m = getAiNode(id)?.combatSpeedMult
    if (m != null && m > best) best = m
  }
  return best
}

/** Additive station production from AI (non-combat). */
export function aiProductionBonus(state: {
  prestige: { activeChallengeId: string | null }
  ai: { purchased: string[] }
}): number {
  if (challengeBlocksAi(state)) return 0
  let bonus = 0
  for (const id of state.ai.purchased) {
    bonus += getAiNode(id)?.productionBonus ?? 0
  }
  return bonus
}

/** Additive Fab Bay craft speed from AI (non-combat). */
export function aiFabBonus(state: {
  prestige: { activeChallengeId: string | null }
  ai: { purchased: string[] }
}): number {
  if (challengeBlocksAi(state)) return 0
  let bonus = 0
  for (const id of state.ai.purchased) {
    bonus += getAiNode(id)?.fabBonus ?? 0
  }
  return bonus
}

/** True when an active challenge forbids fitting this module. */
export function isModuleBlockedByChallenge(
  activeChallengeId: string | null,
  moduleId: string,
): boolean {
  if (!activeChallengeId) return false
  const mod = getModule(moduleId)
  if (!mod) return false
  if (activeChallengeId === 'no-utility' && mod.role === 'utility') return true
  if (
    activeChallengeId === 'mono-pulse' &&
    mod.role === 'weapon' &&
    moduleId !== 'pulse-cannon'
  ) {
    return true
  }
  return false
}

/** Drop modules forbidden by the active challenge (Bare Rig strips utilities). */
export function filterModulesForChallenge(
  moduleIds: string[],
  activeChallengeId: string | null,
): string[] {
  if (!activeChallengeId) return moduleIds
  return moduleIds.filter((id) => !isModuleBlockedByChallenge(activeChallengeId, id))
}

export function challengeClearCount(
  clears: Record<string, number> | undefined,
  challengeId: string,
): number {
  return clears?.[challengeId] ?? 0
}

export function challengeStackDamageBonus(clears: Record<string, number> = {}): number {
  let bonus = 0
  for (const def of CHALLENGES) {
    const n = challengeClearCount(clears, def.id)
    if (n > 0 && def.stackDamageBonus) bonus += n * def.stackDamageBonus
  }
  return bonus
}

export function challengeStackProductionBonus(clears: Record<string, number> = {}): number {
  let bonus = 0
  for (const def of CHALLENGES) {
    const n = challengeClearCount(clears, def.id)
    if (n > 0 && def.stackProductionBonus) bonus += n * def.stackProductionBonus
  }
  return bonus
}

export function challengeStackRepairBonus(clears: Record<string, number> = {}): number {
  let bonus = 0
  for (const def of CHALLENGES) {
    const n = challengeClearCount(clears, def.id)
    if (n > 0 && def.stackRepairBonus) bonus += n * def.stackRepairBonus
  }
  return bonus
}

export function isChallengeUnlocked(
  state: {
    prestige: { challengeClears: Record<string, number>; prestigeCount: number }
    meta?: { highestSectorEver?: number; act1Cleared?: boolean; ascensionCount?: number }
    combat?: { highestSector?: number }
  },
  challengeId: string,
): boolean {
  const def = getChallenge(challengeId)
  if (!def) return false

  // Ascension-entry challenges only appear once Act 1 is cleared (ascension available).
  if (def.entryCost === 'ascension') {
    const act1 =
      state.meta?.act1Cleared === true ||
      Math.max(state.meta?.highestSectorEver ?? 0, state.combat?.highestSector ?? 0) >= 30
    if (!act1) return false
    if ((state.meta?.ascensionCount ?? 0) < (def.requiresAscensions ?? 0)) {
      return false
    }
    return true
  }

  const gates: boolean[] = []
  if (def.requiresPrestiges != null) {
    gates.push(state.prestige.prestigeCount >= def.requiresPrestiges)
  }
  if (def.requiresChallengeClears) {
    const have = challengeClearCount(
      state.prestige.challengeClears,
      def.requiresChallengeClears.challengeId,
    )
    gates.push(have >= def.requiresChallengeClears.clears)
  }
  if (def.requiresSectorEver != null) {
    const ever = Math.max(
      state.meta?.highestSectorEver ?? 0,
      state.combat?.highestSector ?? 0,
    )
    gates.push(ever >= def.requiresSectorEver)
  }
  if (def.requiresAscensions != null) {
    gates.push((state.meta?.ascensionCount ?? 0) >= def.requiresAscensions)
  }
  // No gates → unlocked; multiple gates are OR (e.g. Mono Pulse).
  if (gates.length === 0) return true
  return gates.some(Boolean)
}

/**
 * AI drone power mult (highest owned wins).
 * Feeds dronePower() saturation — not a post-BB output multiplier.
 */
export function aiDroneEfficiencyMult(state: {
  prestige: { activeChallengeId: string | null }
  ai: { purchased: string[] }
}): number {
  if (challengeBlocksAi(state)) return 1
  let best = 1
  for (const id of state.ai.purchased) {
    const m = getAiNode(id)?.droneEfficiencyMult
    if (m != null && m > best) best = m
  }
  return best
}
