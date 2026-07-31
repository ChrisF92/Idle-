/** Game content catalogs — costs, unlocks, and combat profiles. */

import { PRESTIGE_MIN_SECTOR as PROGRESSION_PRESTIGE_MIN, isSystemUnlocked } from './progression'
import { formatCompact, formatStat } from './format'
import type { GameState, Resources, WeaponTag } from './types'

export type ResourceCost = Partial<Record<keyof Resources, number>>

/** Named production stations — worker drones are assigned here (ITRTG-style). */
export interface StationDef {
  id: string
  name: string
  description: string
  requiresResearch?: string
  /** System that must be unlocked before drones can be assigned. */
  requiresSystem?: 'base' | 'research' | 'ai' | 'prestige'
  /** Resource rates per assigned worker drone (per second). */
  rates: ResourceCost
  /** Scrap drained per assigned drone per second (Foundry-style). */
  upkeepScrapPerDrone?: number
  /** Extra docked hull repair per second per drone. */
  repairPerDrone?: number
  /** Multiplier added to worker manufacture speed per drone (0.25 = +25%). */
  manufactureBonusPerDrone?: number
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
  /** Extra manufacture speed while owned (permanent AI). */
  manufactureBonus?: number
}

export interface EssenceUpgradeDef {
  id: string
  name: string
  description: string
  costEssence: number
  damageBonus?: number
  hullBonus?: number
  productionBonus?: number
  bonusDataPerClear?: number
}

export interface ChallengeShopDef {
  id: string
  name: string
  description: string
  costCp: number
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
  /** Permanent bonus worker drones granted once when purchased. */
  bonusWorkerDrones?: number
  manufactureBonus?: number
}

export interface MatterShopDef {
  id: string
  name: string
  description: string
  costPm: number
  damageBonus?: number
  productionBonus?: number
  hullBonus?: number
  shieldBonus?: number
  /** Multiplier on combat scrap rewards (0.25 = +25%). */
  scrapBonus?: number
  bonusDataPerClear?: number
  /** Multiplier on docked repair duration (0.6 = 40% faster). */
  repairMult?: number
  bonusWorkerDrones?: number
  manufactureBonus?: number
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
}

export interface ModuleWeaponDef {
  name: string
  damage: number
  cooldown: number
  /** Lane distance the weapon can reach. */
  range: number
  tags: WeaponTag[]
  splash?: number
  dotDuration?: number
  dotDamage?: number
}

/** Max salvage upgrades per module in a run. */
export const MAX_MODULE_LEVEL = 15

export type ModuleRole = 'weapon' | 'defense' | 'utility'

export interface ShipFrameDef {
  id: string
  name: string
  /** Attack / weapon module capacity. */
  weaponSlots: number
  defenseSlots: number
  utilitySlots: number
  /** Intrinsic flagship weapon damage (cooldown 1s kinetic). */
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
  armorBonus?: number
  shieldBonus?: number
  evasionBonus?: number
  /** Multiplier on incoming damage (0.9 = take 10% less). */
  damageTakenMult: number
  weapon?: ModuleWeaponDef
  /** Combat escort drones spawned from this module. */
  escorts?: number
  unlockCost: ResourceCost
  requiresSectorEver?: number
}

/** Re-export progression prestige gate for existing imports. */
export const PRESTIGE_MIN_SECTOR = PROGRESSION_PRESTIGE_MIN

/** Base seconds to manufacture one worker drone at 1.0 speed. */
export const WORKER_MANUFACTURE_SECONDS = 90

/** Combat drone corps unlocks after this career clear. */
export const COMBAT_DRONES_UNLOCK_SECTOR = 15

export const STATIONS: StationDef[] = [
  {
    id: 'scrap-field',
    name: 'Scrap Field',
    description: 'Workers haul debris into usable scrap.',
    requiresSystem: 'base',
    rates: { scrap: 0.45 },
  },
  {
    id: 'power-grid',
    name: 'Power Grid',
    description: 'Workers stabilize reactor feeds for energy.',
    requiresSystem: 'base',
    rates: { energy: 0.18 },
  },
  {
    id: 'sensor-net',
    name: 'Sensor Net',
    description: 'Workers sift anomaly noise into research data.',
    requiresSystem: 'research',
    rates: { data: 0.07 },
  },
  {
    id: 'alloy-foundry',
    name: 'Alloy Foundry',
    description: 'Workers convert scrap into alloys.',
    requiresSystem: 'research',
    requiresResearch: 'alloy-smelting',
    rates: { alloys: 0.14 },
    upkeepScrapPerDrone: 0.18,
  },
  {
    id: 'repair-bay',
    name: 'Repair Bay',
    description: 'Workers speed hangar hull/shield restoration while Docked.',
    requiresSystem: 'base',
    rates: {},
    repairPerDrone: 1.2,
  },
  {
    id: 'drone-fab',
    name: 'Drone Fabricator',
    description: 'Workers accelerate manufacturing of new worker drones.',
    requiresSystem: 'base',
    requiresResearch: 'drone-logistics',
    rates: {},
    manufactureBonusPerDrone: 0.35,
  },
]

export const RESEARCH: ResearchDef[] = [
  {
    id: 'basic-optics',
    name: 'Basic Optics',
    description: 'Sharper target acquisition. +25% combat damage.',
    costData: 10,
    damageBonus: 0.25,
  },
  {
    id: 'alloy-smelting',
    name: 'Alloy Smelting',
    description: 'Unlocks the Alloy Foundry station.',
    costData: 25,
  },
  {
    id: 'drone-logistics',
    name: 'Drone Logistics',
    description: 'Unlocks the Drone Fabricator station and +40% manufacture speed.',
    costData: 35,
    manufactureBonus: 0.4,
  },
  {
    id: 'tactical-codex',
    name: 'Tactical Codex',
    description: 'Unlocks the Codex: enemy family intel and soft counters.',
    costData: 30,
  },
  {
    id: 'entity-anatomy',
    name: 'Entity Anatomy',
    description: 'Study remains. +50% combat damage.',
    costData: 60,
    damageBonus: 0.5,
  },
  {
    id: 'boss-harvester',
    name: 'Boss Harvester',
    description: 'Extract more Essence from bosses (+100%).',
    costData: 40,
    costEssence: 1,
    essenceBonus: 1,
  },
]

export const AI_NODES: AiNodeDef[] = [
  {
    id: 'auto-engage',
    name: 'Rapid Recovery',
    description: 'Doubles hull / shield repair rate while Paused and during intermission.',
    costAiPoints: 1,
    kind: 'automation',
    permanent: true,
  },
  {
    id: 'auto-dock-critical',
    name: 'Crisis Pause',
    description:
      'Automatically Pause between fights when flagship hull falls below 35%. Resume when ready (never auto-resumes).',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'auto-launch-ready',
    name: 'Field Repairs',
    description:
      'Much faster hull / shield regen between fights while undocked (no auto-Launch).',
    costAiPoints: 2,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 8,
  },
  {
    id: 'auto-assign-workers',
    name: 'Labor Router',
    description: 'Unlocks Auto-Balance: evenly assign idle workers across unlocked stations.',
    costAiPoints: 3,
    kind: 'qol',
    permanent: true,
    requiresSectorEver: 10,
  },
  {
    id: 'fabricator-overclock',
    name: 'Fabricator Overclock',
    description: '+50% worker drone manufacture speed.',
    costAiPoints: 3,
    kind: 'automation',
    permanent: true,
    requiresSectorEver: 10,
    manufactureBonus: 0.5,
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
    description: 'Unlocks Unequip All in the Shipyard between fights or while Paused.',
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
    description: 'Doctrine: +12% weapon damage; AI prioritizes weakest targets.',
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
]

export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'essence-lattice',
    name: 'Essence Lattice',
    description: 'Permanent +10% combat damage.',
    costEssence: 2,
    damageBonus: 0.1,
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
    description: 'Permanent +15% base production.',
    costEssence: 3,
    productionBonus: 0.15,
  },
]

export const CHALLENGE_SHOP: ChallengeShopDef[] = [
  {
    id: 'iron-will',
    name: 'Iron Will',
    description: 'Permanent +8% combat damage (spent CP).',
    costCp: 1,
    damageBonus: 0.08,
  },
  {
    id: 'early-gate',
    name: 'Early Gate',
    description: 'Prestige / enter challenges from sector 6.',
    costCp: 1,
    prestigeMinSector: 6,
  },
  {
    id: 'supply-cache',
    name: 'Supply Cache',
    description: 'Each run starts with +40 scrap.',
    costCp: 1,
    startingScrap: 40,
  },
  {
    id: 'doctrine-seed',
    name: 'Doctrine Seed',
    description: 'Each run starts with +1 AI Point.',
    costCp: 2,
    startingAiPoints: 1,
  },
  {
    id: 'deep-cache',
    name: 'Deep Cache',
    description: 'Offline catch-up cap becomes 12 hours.',
    costCp: 2,
    offlineHours: 12,
  },
  {
    id: 'role-drills',
    name: 'Role Drills',
    description: '+20% effectiveness on role matchup bonuses.',
    costCp: 2,
    matchupBonus: 0.2,
  },
  {
    id: 'hangar-rights',
    name: 'Hangar Rights',
    description: 'Each run starts with +20 Salvage for module upgrades.',
    costCp: 2,
    startingSalvage: 20,
  },
  {
    id: 'drone-bay-rights',
    name: 'Drone Bay Rights',
    description: 'Permanently gain +2 worker drones when purchased.',
    costCp: 2,
    bonusWorkerDrones: 2,
  },
]

/** Spend Prestige Matter for stronger specialized permanents (vs banked +2% dmg/prod). */
export const MATTER_SHOP: MatterShopDef[] = [
  {
    id: 'matter-blade',
    name: 'Matter Blade',
    description: 'Permanent +15% combat damage (stronger than banking 3 PM).',
    costPm: 3,
    damageBonus: 0.15,
  },
  {
    id: 'matter-forge',
    name: 'Matter Forge',
    description: 'Permanent +18% base production.',
    costPm: 3,
    productionBonus: 0.18,
  },
  {
    id: 'matter-plating',
    name: 'Matter Plating',
    description: 'Permanent +50 hull.',
    costPm: 4,
    hullBonus: 50,
  },
  {
    id: 'salvage-rights',
    name: 'Salvage Rights',
    description: 'Permanent +25% scrap from combat clears.',
    costPm: 3,
    scrapBonus: 0.25,
  },
  {
    id: 'archive-spur',
    name: 'Archive Spur',
    description: 'Permanent +2 Data on every sector clear.',
    costPm: 3,
    bonusDataPerClear: 2,
  },
  {
    id: 'drydock-boost',
    name: 'Drydock Boost',
    description: 'Permanent 40% faster hull / shield repair while Docked.',
    costPm: 4,
    repairMult: 0.6,
  },
  {
    id: 'shield-bank',
    name: 'Shield Bank',
    description: 'Permanent +40 shield capacity on the flagship.',
    costPm: 4,
    shieldBonus: 40,
  },
  {
    id: 'drone-corps',
    name: 'Drone Corps Charter',
    description: 'Permanently gain +3 worker drones and +25% manufacture speed.',
    costPm: 5,
    bonusWorkerDrones: 3,
    manufactureBonus: 0.25,
  },
]

/** Knife Fight caps every flagship weapon (including Frame Battery) to flak reach. */
export const SHORT_RANGE_MAX = 55

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'no-ai',
    name: 'Silent Bridge',
    description: 'Reach sector 5 with AI assists disabled. Repeatable.',
    restriction: 'AI purchases and doctrines inactive',
    goalSector: 5,
    rewardChallengePoints: 1,
    maxClears: 20,
    stackDamageBonus: 0.01,
  },
  {
    id: 'thin-hull',
    name: 'Glass Frame',
    description: 'Reach sector 5 with half hull. Stacks boost Docked repair.',
    restriction: 'Player hull max ×0.5',
    goalSector: 5,
    rewardChallengePoints: 1,
    maxClears: 15,
    stackRepairBonus: 0.02,
    requiresPrestiges: 1,
  },
  {
    id: 'data-drought',
    name: 'Data Drought',
    description: 'Reach sector 8 without Data gains from combat. Repeatable.',
    restriction: 'Combat data drops disabled',
    goalSector: 8,
    rewardChallengePoints: 2,
    maxClears: 10,
    stackProductionBonus: 0.015,
    requiresChallengeClears: { challengeId: 'no-ai', clears: 1 },
  },
  {
    id: 'no-utility',
    name: 'Bare Rig',
    description: 'Reach sector 6 without utility modules. Repeatable.',
    restriction: 'Utility modules unequipped and blocked',
    goalSector: 6,
    rewardChallengePoints: 1,
    maxClears: 15,
    stackDamageBonus: 0.012,
    requiresPrestiges: 1,
  },
  {
    id: 'short-range',
    name: 'Knife Fight',
    description: 'Reach sector 6 with all weapons capped to flak range. Repeatable.',
    restriction: `Weapon range capped at ${SHORT_RANGE_MAX}`,
    goalSector: 6,
    rewardChallengePoints: 2,
    maxClears: 12,
    stackRepairBonus: 0.015,
    requiresChallengeClears: { challengeId: 'no-utility', clears: 1 },
  },
]

export const SHIP_FRAMES: ShipFrameDef[] = [
  {
    id: 'scout-frame',
    name: 'Scout Frame',
    weaponSlots: 1,
    defenseSlots: 1,
    utilitySlots: 0,
    baseDamage: 12,
    baseHull: 130,
    unlockCost: {},
  },
  {
    id: 'line-frame',
    name: 'Line Frame',
    weaponSlots: 1,
    defenseSlots: 1,
    utilitySlots: 1,
    baseDamage: 9,
    baseHull: 140,
    unlockCost: { alloys: 25, scrap: 40 },
    requiresSectorEver: 6,
  },
  {
    id: 'razor-frame',
    name: 'Razor Frame',
    weaponSlots: 2,
    defenseSlots: 0,
    utilitySlots: 1,
    baseDamage: 14,
    baseHull: 95,
    unlockCost: { alloys: 35, scrap: 55, energy: 15 },
    requiresSectorEver: 10,
  },
  {
    id: 'pathfinder-frame',
    name: 'Pathfinder Frame',
    weaponSlots: 1,
    defenseSlots: 0,
    utilitySlots: 2,
    baseDamage: 8,
    baseHull: 110,
    unlockCost: { alloys: 30, scrap: 50, data: 20 },
    requiresSectorEver: 10,
  },
  {
    id: 'bastion-frame',
    name: 'Bastion Frame',
    weaponSlots: 1,
    defenseSlots: 2,
    utilitySlots: 1,
    baseDamage: 8,
    baseHull: 190,
    unlockCost: { alloys: 60, scrap: 90, energy: 25 },
    requiresSectorEver: 12,
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
    description: 'Steady kinetic pulses with enough reach for early kite packs.',
    damageBonus: 4,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Pulse',
      damage: 18,
      cooldown: 1,
      range: 125,
      tags: ['kinetic'],
    },
    unlockCost: {},
  },
  {
    id: 'plate-layer',
    name: 'Plate Layer',
    role: 'defense',
    description: '+40 hull, +3 armor. Blunts Swarm / Boss chip.',
    damageBonus: 0,
    hullBonus: 40,
    armorBonus: 3,
    damageTakenMult: 1,
    unlockCost: { scrap: 15, alloys: 5 },
  },
  {
    id: 'vector-thruster',
    name: 'Vector Thruster',
    role: 'utility',
    description: '+10% evasion, −10% incoming. Helps vs Ethereal / Divine.',
    damageBonus: 0,
    hullBonus: 0,
    evasionBonus: 0.1,
    damageTakenMult: 0.9,
    unlockCost: { scrap: 30, alloys: 12 },
  },
  {
    id: 'heavy-lance',
    name: 'Heavy Lance',
    role: 'weapon',
    description: 'Long-range pierce shot. Strong vs Armored / Bosses.',
    damageBonus: 10,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Lance',
      damage: 32,
      cooldown: 2.2,
      range: 140,
      tags: ['kinetic', 'pierce'],
    },
    unlockCost: { scrap: 50, alloys: 20 },
  },
  {
    id: 'flak-array',
    name: 'Flak Array',
    role: 'weapon',
    description: 'Short-range splash bursts. Clears Swarm packs.',
    damageBonus: 6,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Flak',
      damage: 9,
      cooldown: 1.1,
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
    description: 'Long energy beam. Burns shields; strong vs Ethereal / Divine.',
    damageBonus: 7,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Phase Beam',
      damage: 16,
      cooldown: 1.4,
      range: 125,
      tags: ['energy', 'antiShield'],
    },
    unlockCost: { scrap: 55, alloys: 22, data: 8 },
  },
  {
    id: 'barrier-projector',
    name: 'Barrier Projector',
    role: 'defense',
    description: '+50 shield capacity (restores while Docked).',
    damageBonus: 0,
    hullBonus: 10,
    shieldBonus: 50,
    damageTakenMult: 1,
    unlockCost: { scrap: 40, alloys: 16, energy: 20 },
  },
  {
    id: 'drone-bay',
    name: 'Drone Bay',
    role: 'utility',
    description: 'Deploys 2 escort drones into the fleet.',
    damageBonus: 0,
    hullBonus: 0,
    damageTakenMult: 1,
    escorts: 2,
    unlockCost: { scrap: 60, alloys: 25, energy: 15 },
  },
  {
    id: 'rail-driver',
    name: 'Rail Driver',
    role: 'weapon',
    description: 'Ultra-long kinetic rails. Punishes kiters before they settle.',
    damageBonus: 8,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Rail',
      damage: 22,
      cooldown: 1.6,
      range: 155,
      tags: ['kinetic', 'pierce'],
    },
    unlockCost: { scrap: 70, alloys: 28, data: 6 },
  },
  {
    id: 'ion-burst',
    name: 'Ion Burst',
    role: 'weapon',
    description: 'Mid-range energy splash. Softens shields across a pack.',
    damageBonus: 6,
    hullBonus: 0,
    damageTakenMult: 1,
    weapon: {
      name: 'Ion Burst',
      damage: 11,
      cooldown: 1.25,
      range: 95,
      tags: ['energy', 'antiShield', 'splash'],
      splash: 1,
    },
    unlockCost: { scrap: 65, alloys: 24, energy: 18 },
  },
  {
    id: 'ablative-mesh',
    name: 'Ablative Mesh',
    role: 'defense',
    description: '+25 hull, +2 armor, +20 shield. Soaks boss chip damage.',
    damageBonus: 0,
    hullBonus: 25,
    armorBonus: 2,
    shieldBonus: 20,
    damageTakenMult: 1,
    unlockCost: { scrap: 55, alloys: 22 },
  },
  {
    id: 'grav-tether',
    name: 'Grav Tether',
    role: 'utility',
    description: '−12% incoming and +6% evasion. Helps hold flak range vs kiters.',
    damageBonus: 0,
    hullBonus: 8,
    evasionBonus: 0.06,
    damageTakenMult: 0.88,
    unlockCost: { scrap: 50, alloys: 20, energy: 12 },
  },
  {
    id: 'nano-lathe',
    name: 'Nano Lathe',
    role: 'utility',
    description: '+50% hull / shield repair rate while Docked.',
    damageBonus: 0,
    hullBonus: 5,
    damageTakenMult: 1,
    unlockCost: { scrap: 45, alloys: 18, data: 10 },
  },
  {
    id: 'salvage-rig',
    name: 'Salvage Rig',
    role: 'utility',
    description: '+20% scrap from sector clears this run.',
    damageBonus: 2,
    hullBonus: 0,
    damageTakenMult: 1,
    unlockCost: { scrap: 40, alloys: 15 },
  },
]

export function moduleLevel(
  levels: Record<string, number> | undefined,
  moduleId: string,
): number {
  return Math.max(0, levels?.[moduleId] ?? 0)
}

/** Salvage cost to raise a module from `level` → level+1. */
export function moduleUpgradeCost(level: number): number {
  return Math.ceil(6 * 1.55 ** Math.max(0, level))
}

/** Multiplier on module combat stats from run upgrades. */
export function moduleLevelMultiplier(level: number): number {
  return 1 + Math.max(0, level) * 0.12
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

/** Total manufacture speed multiplier (1 = baseline). */
export function workerManufactureSpeed(state: {
  base: { assignments: Record<string, number> }
  research: { unlocked: string[] }
  ai: { purchased: string[] }
  prestige: { shop: string[]; matterShop: string[] }
}): number {
  let speed = 1
  for (const id of state.research.unlocked) {
    speed += RESEARCH.find((r) => r.id === id)?.manufactureBonus ?? 0
  }
  for (const id of state.ai.purchased) {
    speed += getAiNode(id)?.manufactureBonus ?? 0
  }
  for (const id of state.prestige.shop) {
    speed += getChallengeShopItem(id)?.manufactureBonus ?? 0
  }
  for (const id of state.prestige.matterShop) {
    speed += getMatterShopItem(id)?.manufactureBonus ?? 0
  }
  const fab = state.base.assignments['drone-fab'] ?? 0
  const fabDef = getStation('drone-fab')
  if (fab > 0 && fabDef?.manufactureBonusPerDrone) {
    speed += fab * fabDef.manufactureBonusPerDrone
  }
  return Math.max(0.05, speed)
}

export function stationRepairBonus(state: {
  base: { assignments: Record<string, number> }
}): number {
  let bonus = 0
  for (const station of STATIONS) {
    const n = state.base.assignments[station.id] ?? 0
    if (n > 0 && station.repairPerDrone) bonus += n * station.repairPerDrone
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
): ModuleStatPreview[] {
  const mod = getModule(moduleId)
  if (!mod) return []
  const a = moduleLevelMultiplier(level)
  const b = moduleLevelMultiplier(level + 1)
  const lines: ModuleStatPreview[] = []

  if (mod.weapon) {
    lines.push({
      label: 'Damage',
      current: formatStat(mod.weapon.damage * a, 2),
      next: showNext ? formatStat(mod.weapon.damage * b, 2) : null,
    })
    lines.push({
      label: 'Range',
      current: formatCompact(mod.weapon.range, 0),
      next: null,
    })
  }
  if (mod.hullBonus) {
    lines.push({
      label: 'Hull',
      current: `+${formatCompact(mod.hullBonus * a, 1)}`,
      next: showNext ? `+${formatCompact(mod.hullBonus * b, 1)}` : null,
    })
  }
  if (mod.armorBonus) {
    lines.push({
      label: 'Armor',
      current: `+${formatStat(mod.armorBonus * a, 2)}`,
      next: showNext ? `+${formatStat(mod.armorBonus * b, 2)}` : null,
    })
  }
  if (mod.shieldBonus) {
    lines.push({
      label: 'Shield',
      current: `+${formatCompact(mod.shieldBonus * a, 1)}`,
      next: showNext ? `+${formatCompact(mod.shieldBonus * b, 1)}` : null,
    })
  }
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
  const a = moduleLevelMultiplier(fromLevel)
  const b = moduleLevelMultiplier(toLevel)
  const lines: string[] = []
  const pct = formatCompact(((b / a - 1) * 100), 0)
  if (mod.weapon) {
    lines.push(
      `Weapon ${formatStat(mod.weapon.damage * a, 2)} → ${formatStat(mod.weapon.damage * b, 2)} dmg (+${pct}%)`,
    )
  }
  if (mod.hullBonus) {
    lines.push(
      `Hull +${formatCompact(mod.hullBonus * a, 1)} → +${formatCompact(mod.hullBonus * b, 1)}`,
    )
  }
  if (mod.armorBonus) {
    lines.push(
      `Armor +${formatStat(mod.armorBonus * a, 2)} → +${formatStat(mod.armorBonus * b, 2)}`,
    )
  }
  if (mod.shieldBonus) {
    lines.push(
      `Shield +${formatCompact(mod.shieldBonus * a, 1)} → +${formatCompact(mod.shieldBonus * b, 1)}`,
    )
  }
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
    lines.push(`Module combat contribution +${pct}% (Lv ${fromLevel} → ${toLevel})`)
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

export function essenceDamageMultiplier(purchased: string[]): number {
  let bonus = 1
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.damageBonus) bonus += def.damageBonus
  }
  return bonus
}

export function essenceHullBonus(purchased: string[]): number {
  let hull = 0
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.hullBonus) hull += def.hullBonus
  }
  return hull
}

export function essenceProductionMultiplier(purchased: string[]): number {
  let bonus = 1
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.productionBonus) bonus += def.productionBonus
  }
  return bonus
}

export function essenceBonusDataPerClear(purchased: string[]): number {
  let total = 0
  for (const id of purchased) {
    const def = getEssenceUpgrade(id)
    if (def?.bonusDataPerClear) total += def.bonusDataPerClear
  }
  return total
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
  shop: string[] = [],
  matterShop: string[] = [],
  challengeClears: Record<string, number> = {},
): number {
  // Unspent PM/CP still help a little; spending unlocks stronger shop effects.
  let mult = 1 + prestigeMatter * 0.02 + challengePoints * 0.02
  for (const id of shop) {
    const def = getChallengeShopItem(id)
    if (def?.damageBonus) mult += def.damageBonus
  }
  for (const id of matterShop) {
    const def = getMatterShopItem(id)
    if (def?.damageBonus) mult += def.damageBonus
  }
  mult += challengeStackDamageBonus(challengeClears)
  return mult
}

export function metaProductionMultiplier(
  prestigeMatter: number,
  matterShop: string[] = [],
  challengeClears: Record<string, number> = {},
): number {
  let mult = 1 + prestigeMatter * 0.02
  for (const id of matterShop) {
    const def = getMatterShopItem(id)
    if (def?.productionBonus) mult += def.productionBonus
  }
  mult += challengeStackProductionBonus(challengeClears)
  return mult
}

export function matterShopHullBonus(matterShop: string[]): number {
  let total = 0
  for (const id of matterShop) {
    total += getMatterShopItem(id)?.hullBonus ?? 0
  }
  return total
}

export function matterShopShieldBonus(matterShop: string[]): number {
  let total = 0
  for (const id of matterShop) {
    total += getMatterShopItem(id)?.shieldBonus ?? 0
  }
  return total
}

export function matterShopScrapBonus(matterShop: string[]): number {
  let total = 0
  for (const id of matterShop) {
    total += getMatterShopItem(id)?.scrapBonus ?? 0
  }
  return total
}

export function matterShopDataPerClear(matterShop: string[]): number {
  let total = 0
  for (const id of matterShop) {
    total += getMatterShopItem(id)?.bonusDataPerClear ?? 0
  }
  return total
}

export function matterShopRepairMult(matterShop: string[]): number {
  let mult = 1
  for (const id of matterShop) {
    const r = getMatterShopItem(id)?.repairMult
    if (r != null) mult *= r
  }
  return mult
}

export function prestigeMinSectorFor(shop: string[]): number {
  let min = PRESTIGE_MIN_SECTOR
  for (const id of shop) {
    const def = getChallengeShopItem(id)
    if (def?.prestigeMinSector) min = Math.min(min, def.prestigeMinSector)
  }
  return min
}

export function challengeShopStartingScrap(shop: string[]): number {
  let total = 0
  for (const id of shop) {
    total += getChallengeShopItem(id)?.startingScrap ?? 0
  }
  return total
}

export function challengeShopStartingAi(shop: string[]): number {
  let total = 0
  for (const id of shop) {
    total += getChallengeShopItem(id)?.startingAiPoints ?? 0
  }
  return total
}

export function challengeShopStartingSalvage(shop: string[]): number {
  let total = 0
  for (const id of shop) {
    total += getChallengeShopItem(id)?.startingSalvage ?? 0
  }
  return total
}

export function challengeShopOfflineMs(shop: string[]): number {
  let hours = 8
  for (const id of shop) {
    const h = getChallengeShopItem(id)?.offlineHours
    if (h) hours = Math.max(hours, h)
  }
  return hours * 60 * 60 * 1000
}

export function challengeShopMatchupBonus(shop: string[]): number {
  let bonus = 0
  for (const id of shop) {
    bonus += getChallengeShopItem(id)?.matchupBonus ?? 0
  }
  return bonus
}

/** AI combat doctrines are disabled during Silent Bridge. */
export function aiDoctrinesActive(
  state: {
    prestige: { activeChallengeId: string | null }
    ai: { purchased: string[] }
  },
  nodeId: string,
): boolean {
  if (state.prestige.activeChallengeId === 'no-ai') return false
  return state.ai.purchased.includes(nodeId)
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
  },
  challengeId: string,
): boolean {
  const def = getChallenge(challengeId)
  if (!def) return false
  if (def.requiresPrestiges && state.prestige.prestigeCount < def.requiresPrestiges) {
    return false
  }
  if (def.requiresChallengeClears) {
    const have = challengeClearCount(
      state.prestige.challengeClears,
      def.requiresChallengeClears.challengeId,
    )
    if (have < def.requiresChallengeClears.clears) return false
  }
  return true
}
