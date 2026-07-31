/** Game content catalogs — costs, unlocks, and combat profiles. */

import type { Resources, WeaponTag } from './types'

export type ResourceCost = Partial<Record<keyof Resources, number>>

export interface BuildingDef {
  id: string
  name: string
  description: string
  requiresResearch?: string
  baseCost: ResourceCost
  costScale: number
  rates: ResourceCost
  upkeepScrapPerLevel?: number
}

export interface ResearchDef {
  id: string
  name: string
  description: string
  costData: number
  costEssence?: number
  damageBonus?: number
  essenceBonus?: number
}

export interface AiNodeDef {
  id: string
  name: string
  description: string
  costAiPoints: number
  kind: 'automation' | 'doctrine' | 'qol'
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
}

/** First prestige is meant to be reachable on a starter loadout with light upgrades. */
export const PRESTIGE_MIN_SECTOR = 6

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'scrapYard',
    name: 'Scrap Yard',
    description: 'Passive scrap from debris fields.',
    baseCost: { scrap: 15 },
    costScale: 1.4,
    rates: { scrap: 0.5 },
  },
  {
    id: 'powerCell',
    name: 'Power Cell',
    description: 'Generates energy for operations.',
    baseCost: { scrap: 20, energy: 5 },
    costScale: 1.45,
    rates: { energy: 0.2 },
  },
  {
    id: 'sensorArray',
    name: 'Sensor Array',
    description: 'Collects research data from anomaly noise.',
    baseCost: { scrap: 30, energy: 10 },
    costScale: 1.5,
    rates: { data: 0.08 },
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Burns scrap into alloys.',
    requiresResearch: 'alloy-smelting',
    baseCost: { scrap: 40, energy: 15 },
    costScale: 1.5,
    rates: { alloys: 0.15 },
    upkeepScrapPerLevel: 0.2,
  },
  {
    id: 'workDroneHangar',
    name: 'Work Drone Hangar',
    description:
      'Industrial work drones haul scrap and skim anomaly data. Separate from combat Drone Bay escorts.',
    requiresResearch: 'drone-logistics',
    baseCost: { scrap: 55, energy: 20, alloys: 12 },
    costScale: 1.48,
    rates: { scrap: 0.35, data: 0.05 },
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
    description: 'Unlocks the Foundry building.',
    costData: 25,
  },
  {
    id: 'drone-logistics',
    name: 'Drone Logistics',
    description: 'Unlocks the Work Drone Hangar for industrial scrap and data.',
    costData: 35,
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
    description: 'Doubles hull / shield repair rate while Docked.',
    costAiPoints: 1,
    kind: 'automation',
  },
  {
    id: 'focus-fire',
    name: 'Focus Fire',
    description: 'Doctrine: +12% weapon damage; AI prioritizes weakest targets.',
    costAiPoints: 2,
    kind: 'doctrine',
  },
  {
    id: 'boss-protocol',
    name: 'Boss Protocol',
    description: 'Doctrine: +25% damage vs boss units.',
    costAiPoints: 3,
    kind: 'doctrine',
  },
  {
    id: 'scavenger',
    name: 'Scavenger Protocol',
    description: 'Doctrine: +30% scrap from combat clears.',
    costAiPoints: 2,
    kind: 'doctrine',
  },
  {
    id: 'tactical-retreat',
    name: 'Tactical Retreat',
    description: 'Doctrine: disengage at 25% flagship hull instead of destruction.',
    costAiPoints: 2,
    kind: 'doctrine',
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
    description: 'Prestige / enter challenges from sector 5.',
    costCp: 1,
    prestigeMinSector: 5,
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
]

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

export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id)
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

export function buildingUpgradeCost(building: BuildingDef, currentLevel: number): ResourceCost {
  const factor = building.costScale ** currentLevel
  const cost: ResourceCost = {}
  for (const [key, amount] of Object.entries(building.baseCost)) {
    cost[key as keyof Resources] = Math.ceil((amount ?? 0) * factor)
  }
  return cost
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
