/** Fleet combat: ranged approach, cooldowns, bosses, salvage drops. */

import type {
  CombatBeam,
  CombatFx,
  CombatProjectile,
  CombatUnit,
  EnemyRole,
  GameState,
  PartType,
  UnitShape,
  WeaponDelivery,
  WeaponInstance,
  WeaponTag,
} from './types'
import {
  aiDoctrinesActive,
  blueprintFragmentTotals,
  blueprintProgress,
  canDropModulePart,
  challengeShopDropBonus,
  challengeShopMatchupBonus,
  challengeStackRepairBonus,
  discoveryFocusPrint,
  earlyCareerFragmentMult,
  essenceBonusDataPerClear,
  familyCanDropPrint,
  getEnemyDropTable,
  getModule,
  HOLD_TRACKED_FRAGMENT_MULT,
  matterShopDataPerClear,
  matterShopDropBonus,
  matterShopRepairMult,
  matterShopScrapBonus,
  fittedShieldRegenFraction,
  partId,
  pickWeightedDropEntry,
  stationRepairBonus,
  ENEMY_PARK_MAX,
  SHORT_RANGE_MAX,
  frameSalvageMult,
} from './catalog'
import { careerHighestSector, isSystemUnlocked } from './progression'
import { isSectorBossWave, wavesForSector, trashWavesForSector, normalizePushMode, normalizeRoute, routeDangerMult, routeSalvageMult } from './sectors'
import type { SectorRoute } from './types'
import { buildCoreWeapon, buildFlagshipWeapons, computeShipStats } from './state'
import { coreOrbitRadius, coreOrbitSpeed, coreVisualKind } from './hiveVisual'
import {
  gddEnemyBandForWave,
  isAct1ClimaxWave,
  isBossWave,
  powerSectorForWave,
  waveForBand,
  waveInBand,
  type GddEnemyBandId,
} from './waves'
import {
  measureThreatRoll,
  newSortieSeed,
  threatBudgetForWave,
  threatSpecForWave,
  varyPackToBudget,
} from './threatBudget'
import {
  bossMechanicBlurb,
  bossMechanicForWave,
  bossMechanicHasAdds,
  bossMechanicHasAura,
  bossMechanicHasShieldPhase,
  bossMechanicTelegraph,
  type BossMechanicId,
} from './bossMechanics'
import { ACT1_FINAL_WAVE } from './cadence'
import {
  armorPenAdd,
  critChance,
  fragmentChanceMult,
  salvageKillMult,
  scrapKillBonus,
  shopShieldRegen,
} from './workshop'
import {
  logisticsDropMult,
  reactorsRepairMult,
  sensorsMatchupBonus,
} from './core'
import { computeSignalCoreBonuses, grantSignalCoreDrop } from './signalCores'
import { fittedRegenBonus } from './milestones'
import { combinedCoreMods } from './coreProgression'
import { grantReliquaryKillLoot, reliquaryResearchXpMult, reliquarySalvageMult } from './reliquary'
import { grantFurnaceKillLoot, furnaceResearchXpMult, furnaceSalvageMult } from './furnace'
import { foundrySalvageMult, foundryPartDropMult, foundryShardDropBonus } from './foundry'
import {
  grantHiveResearchKillXp,
  hiveResearchFocusFire,
  hiveResearchSalvageMult,
  hiveResearchShardDropBonus,
} from './hiveResearch'
import { yardSalvageMult } from './yard'
import { echoSalvageMult } from './echo'
import { specialistSalvageMult } from './specialists'
import { capitalSalvageMult } from './capital'
import { processSalvageMult } from './process'
import { protocolEnemyDensityMult, protocolModifiers, protocolMutes } from './protocols'
import { directiveDensityMult, directiveShieldRegenMult } from './directives'
import { recordPlaytest } from './playtest'
import {
  maybeSampleSortieEnemies,
  noteSortieIncoming,
  noteSortieKill,
  noteSortieOutgoing,
} from './sortieTelemetry'

export type EnemyFamily = 'swarm' | 'armored' | 'ethereal' | 'divine' | 'titan'

export interface SectorEncounter {
  id: string
  name: string
  family: EnemyFamily
  tags: string[]
  isBoss: boolean
  scrapReward: number
  dataReward: number
  aiReward: number
  essenceReward: number
  salvageReward: number
  blurb: string
  units: CombatUnit[]
  mechanicId?: string
  threat?: { seed: number; budget: number; spent: number }
}

const MIXED_FAMILIES: EnemyFamily[] = ['swarm', 'armored', 'ethereal']
const COMPLEX_FAMILIES: EnemyFamily[] = ['swarm', 'armored', 'ethereal', 'divine']

const NAMES: Record<EnemyFamily, string[]> = {
  swarm: ['Void Mite', 'Ashen Drifter', 'Needle Cloud'],
  armored: ['Hive Shard', 'Carapace Walker', 'Iron Cyst'],
  ethereal: ['Phase Wisp', 'Echo Veil', 'Null Mirage'],
  divine: ['God-Spark Remnant', 'Halo Fragment', 'Choir Speck'],
  titan: ['Titan Larva', 'Leviathan Seed', 'Throne Husk'],
}

const FAMILY_SHAPE: Record<EnemyFamily, UnitShape> = {
  swarm: 'circle',
  armored: 'square',
  ethereal: 'diamond',
  divine: 'hex',
  titan: 'hex',
}

const ROLE_SHAPE: Record<EnemyRole, UnitShape> = {
  fighter: 'triangle',
  skirmisher: 'circle',
  sniper: 'diamond',
  juggernaut: 'square',
  shield: 'hex',
  boss: 'hex',
}

/** Lane spawn distance ahead of the player. */
export const SPAWN_DISTANCE = 180

/**
 * Closest legal park. Must sit outside the Hive body (~22) plus the heaviest
 * Core orbit (44) so closers do not stack on the drones. When the equipped
 * weapon cap is shorter than this (Flak / Knife Fight), the cap wins.
 */
export const HIVE_STANDOFF_MIN = 72

/**
 * USI Laser Cannon: range 600, projectile speed 700.
 * Map USI space-units onto this lane (spawn 180). Pulse no longer matches spawn;
 * long guns stop short so inbound hulls are visible before they take fire.
 */
export const USI_SPACE_TO_LANE = SPAWN_DISTANCE / 600

/**
 * Lane-units / second for all normal projectiles (player + enemy).
 * 700 USI × (180/600) = 210, so max-range travel stays ~0.86s.
 */
export const PROJECTILE_SPEED = 700 * USI_SPACE_TO_LANE

/** Sniper charge lasers — USI Charge Laser is a fast bolt after the wind-up. */
export const CHARGE_LASER_SPEED = PROJECTILE_SPEED * 1.5

/** Connected Phase Beam dwell. Total weapon damage is spread across this window. */
export const BEAM_DURATION = 0.42

/** @deprecated Use PROJECTILE_SPEED — tag variance removed; all normal shots share one speed. */
export function projectileSpeedForTag(_tag: string): number {
  return PROJECTILE_SPEED
}

export function projectileSpeedForDelivery(delivery?: WeaponDelivery): number {
  if (delivery === 'charge') return CHARGE_LASER_SPEED
  return PROJECTILE_SPEED
}

let unitSeq = 0
let fxGlobalSeq = 0
let projGlobalSeq = 0
let beamGlobalSeq = 0
function nextUnitId(prefix: string): string {
  unitSeq += 1
  return `${prefix}-${unitSeq}`
}

export function isBossSector(sector: number): boolean {
  return sector > 0 && sector % 5 === 0
}

/**
 * Salvage per kill. S1 trash = 1 so the first Pulse rank (cost 3) lands
 * after the opening pack. S1–S4 stay linear. After that the curve bends
 * so Cores cannot vacuum every other system before the first Rebuild.
 */
export function salvageSectorBase(sector: number): number {
  const s = Math.max(1, sector)
  if (s <= 4) return s
  if (s <= ENEMY_MID_SECTOR) return 4 * Math.pow(s / 4, SALVAGE_MID_EXPONENT)
  const atMid = 4 * Math.pow(ENEMY_MID_SECTOR / 4, SALVAGE_MID_EXPONENT)
  return atMid * Math.pow(s / ENEMY_MID_SECTOR, SALVAGE_LATE_EXPONENT)
}

export function salvageFromKill(
  sector: number,
  isBoss: boolean,
  route: SectorRoute | string = 'A',
  state?: GameState,
): number {
  if (state && protocolMutes(state, 'salvage')) return 0
  const exp = 1 + (state ? protocolModifiers(state).salvageSectorExpAdd : 0)
  const raw = (isBoss ? 5 : 1) * Math.pow(salvageSectorBase(sector), exp)
  return Math.max(1, Math.floor(raw * routeSalvageMult(normalizeRoute(route))))
}

export interface WeaponDamageProfile {
  hullDamage: number
  shieldDamage: number
  armorDamage: number
}

/** USI Laser: hull 1 / shield 1 / armour 0.25. Kinetic Cannon: shield 0.6 / armour 1. */
export function weaponDamageProfile(tags: WeaponTag[], weapon?: WeaponInstance): WeaponDamageProfile {
  if (
    weapon?.hullDamage != null ||
    weapon?.shieldDamage != null ||
    weapon?.armorDamage != null
  ) {
    return {
      hullDamage: weapon.hullDamage ?? 1,
      shieldDamage: weapon.shieldDamage ?? 1,
      armorDamage: weapon.armorDamage ?? 0.25,
    }
  }
  const kinetic = tags.includes('kinetic') && !tags.includes('energy')
  const pierce = tags.includes('pierce')
  return {
    hullDamage: 1,
    shieldDamage: kinetic ? 0.6 : 1,
    armorDamage: kinetic || pierce ? 1 : 0.25,
  }
}

function makeWeapon(
  id: string,
  name: string,
  damage: number,
  cooldown: number,
  range: number,
  tags: WeaponTag[],
  splash = 0,
  telegraphDuration = 0,
  delivery?: WeaponDelivery,
): WeaponInstance {
  return {
    id,
    name,
    damage,
    cooldown,
    cooldownLeft: 0,
    range,
    tags,
    splash,
    dotDuration: 0,
    dotDamage: 0,
    telegraphDuration,
    telegraphLeft: 0,
    delivery,
  }
}

function makeEnemyUnit(opts: {
  name: string
  family: EnemyFamily
  hull: number
  armor?: number
  shield?: number
  evasion?: number
  damage: number
  cooldown?: number
  range: number
  speed: number
  engageRange: number
  kite?: boolean
  tags?: WeaponTag[]
  splash?: number
  telegraphDuration?: number
  isBoss?: boolean
  role?: EnemyRole
  shape?: UnitShape
  x?: number
  y?: number
  rewardWeight?: number
}): CombatUnit {
  const family = opts.family
  const role = opts.role ?? (opts.isBoss ? 'boss' : undefined)
  const delivery: WeaponDelivery | undefined =
    opts.role === 'sniper' ? 'charge' : undefined
  const gunRange = Math.max(opts.range, opts.engageRange + 8, HIVE_STANDOFF_MIN + 8)
  return {
    id: nextUnitId(`e-${family}`),
    side: 'enemy',
    name: opts.name,
    shape: opts.shape ?? (role ? ROLE_SHAPE[role] : FAMILY_SHAPE[family]),
    role,
    family,
    hull: opts.hull,
    hullMax: opts.hull,
    shield: opts.shield ?? 0,
    shieldMax: opts.shield ?? 0,
    armor: opts.armor ?? 0,
    evasion: opts.evasion ?? 0,
    damageTakenMult: 1,
    weapons: [
      makeWeapon(
        nextUnitId('ew'),
        `${opts.name} strike`,
        opts.damage,
        opts.cooldown ?? 1,
        gunRange,
        opts.tags ?? ['kinetic'],
        opts.splash ?? 0,
        opts.telegraphDuration ?? 0,
        delivery,
      ),
    ],
    isBoss: opts.isBoss ?? false,
    isFlagship: opts.isBoss ?? false,
    dots: [],
    x: opts.x ?? SPAWN_DISTANCE,
    y: opts.y ?? 0,
    heading: 0,
    speed: opts.speed,
    engageRange: opts.engageRange,
    kite: opts.kite ?? false,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: opts.rewardWeight ?? 1,
  }
}

function packY(index: number, count: number): number {
  if (count <= 1) return 0
  const spread = Math.min(110, 28 * (count - 1))
  return -spread / 2 + (spread / Math.max(1, count - 1)) * index
}

/**
 * Minimum on-screen formation size. The authored role/family patterns still decide
 * what a wave is; this only fills sparse formations with lighter wing units so
 * combat reads as a fleet engagement rather than one or two stat blocks.
 *
 * Wing units carry reduced rewards so density does not become an economy buff.
 */
function targetFormationSize(sector: number, bossWave: boolean): number {
  const s = Math.max(1, Math.floor(sector))
  if (bossWave) return s < 6 ? 3 : s < 16 ? 4 : 5
  // Preserve the authored tutorial fight. Visual density ramps after S1.
  if (s === 1) return 2
  if (s <= 4) return 3
  if (s <= 8) return 4
  if (s <= 16) return 5
  if (s <= 22) return 6
  return 7
}

function densityPressureBudget(sector: number, bossWave: boolean): number {
  if (bossWave) {
    if (sector <= 5) return 0.06
    if (sector <= 15) return 0.12
    return 0.18
  }
  if (sector <= 1) return 0
  if (sector <= 4) return 0.08
  if (sector <= 8) return 0.14
  if (sector <= 16) return 0.22
  if (sector <= 22) return 0.32
  return 0.4
}

function densifyEncounter(
  units: CombatUnit[],
  sector: number,
  bossWave: boolean,
): CombatUnit[] {
  const target = targetFormationSize(sector, bossWave)
  if (units.length >= target) return units
  const candidates = units
    .filter((u) => !u.isBoss)
    .sort((a, b) => (a.hullMax + a.shieldMax) - (b.hullMax + b.shieldMax))
  if (candidates.length === 0) return units

  const missing = target - units.length
  const authoredEhp = units.reduce((sum, u) => sum + u.hullMax + u.shieldMax, 0)
  const authoredDps = units.reduce(
    (sum, u) => sum + u.weapons.reduce((wSum, w) => wSum + w.damage / Math.max(0.05, w.cooldown), 0),
    0,
  )
  const budget = densityPressureBudget(sector, bossWave)
  const wingEhp = Math.max(1, (authoredEhp * budget) / Math.max(1, missing))
  const wingDps = Math.max(0.1, (authoredDps * budget * 0.85) / Math.max(1, missing))
  const rewardShare = Math.min(0.35, Math.max(0.12, (budget * units.length) / Math.max(1, missing)))

  const out = [...units]
  let wing = 0
  while (out.length < target) {
    const source = candidates[wing % candidates.length]!
    wing += 1
    const sourceEhp = Math.max(1, source.hullMax + source.shieldMax)
    const shieldShare = source.shieldMax / sourceEhp
    const shieldMax = wingEhp * shieldShare
    const hullMax = Math.max(1, wingEhp - shieldMax)
    const weaponCount = Math.max(1, source.weapons.length)
    const clone: CombatUnit = {
      ...source,
      id: nextUnitId(`e-${source.family}-wing`),
      name: `${source.name} Wing ${wing}`,
      hull: hullMax,
      hullMax,
      shield: shieldMax,
      shieldMax,
      armor: source.armor * 0.55,
      weapons: source.weapons.map((weapon) => ({
        ...weapon,
        id: nextUnitId('ew-wing'),
        damage: (wingDps * Math.max(0.05, weapon.cooldown)) / weaponCount,
        cooldownLeft: 0,
        telegraphLeft: 0,
        telegraphToId: undefined,
      })),
      dots: [],
      x: source.x + 8 + wing * 5,
      y: packY(out.length, target),
      phaseWarnLeft: 0,
      regenDelay: 0,
      rewardWeight: rewardShare,
    }
    out.push(clone)
  }
  return out
}

/** Catalog family that carries a GDD §12 wave-band idea. Bosses stay Titans. */
export function primaryFamilyForWave(wave: number, boss = false): EnemyFamily {
  if (boss || isAct1ClimaxWave(wave)) return 'titan'
  const band = gddEnemyBandForWave(wave)
  switch (band) {
    case 'basic':
    case 'swarm':
    case 'skirmisher':
      return 'swarm'
    case 'armored':
      return 'armored'
    case 'shielded':
    case 'sniper':
    case 'support':
      return 'ethereal'
    case 'mixed':
      return MIXED_FAMILIES[(Math.max(1, Math.floor(wave)) - 1) % MIXED_FAMILIES.length] ?? 'swarm'
    case 'elite':
      return 'divine'
    case 'complex':
      return COMPLEX_FAMILIES[(Math.max(1, Math.floor(wave)) - 1) % COMPLEX_FAMILIES.length] ?? 'swarm'
    case 'climax':
      return 'titan'
  }
}

function packPatternForBand(band: GddEnemyBandId, wave: number): 0 | 1 | 2 | 3 | 4 {
  const local = waveInBand(wave)
  switch (band) {
    case 'basic':
      return 0
    case 'swarm': {
      const swarmPatterns = [0, 4, 2, 0, 4, 2, 0, 4, 2] as const
      return swarmPatterns[local - 1] ?? 0
    }
    case 'skirmisher':
      return 1
    case 'armored':
    case 'mixed':
    case 'elite':
    case 'complex':
      return ((local - 1) % 5) as 0 | 1 | 2 | 3 | 4
    case 'shielded':
      return 0
    case 'support': {
      // Shield escorts, snipers, mixed support — several axes, not an HP cliff.
      const supportPatterns = [0, 3, 1, 0, 3, 1, 2, 0, 3] as const
      return supportPatterns[local - 1] ?? 0
    }
    case 'sniper':
      return 1
    case 'climax':
      return 0
  }
}

export function enemyForSector(
  sector: number,
  wave = 1,
  route: SectorRoute | string = 'A',
  extraDanger = 1,
  globalWave?: number,
): SectorEncounter {
  const side = normalizeRoute(route)
  const careerWave = Math.max(1, Math.floor(globalWave ?? waveForBand(sector, wave)))
  const bossWave =
    globalWave != null
      ? isBossWave(careerWave) || isAct1ClimaxWave(careerWave)
      : isSectorBossWave(sector, wave)
  const family = primaryFamilyForWave(careerWave, bossWave)
  const names = NAMES[family]
  const name =
    names[(careerWave + wave - 1) % names.length] ??
    'Unknown Entity'

  // Later waves should be tougher, but not a 40% stat cliff before every boss.
  // Density now carries more of the pressure, so the within-sector ramp is gentler.
  const waveScale = (1 + Math.max(0, wave - 1) * ENEMY_WAVE_HULL_RAMP) * routeDangerMult(side) * extraDanger
  const pattern = packPatternForBand(gddEnemyBandForWave(careerWave), careerWave)
  let units = bossWave
    ? buildBossPack(sector, name, waveScale)
    : buildWavePack(sector, family, name, waveScale, pattern)
  units = densifyEncounter(units, sector, bossWave)
  const reach = Math.min(48, (Math.max(1, sector) - 1) * 2.8)
  for (const unit of units) {
    // Preferred standoff remains role-specific. moveUnits() never parks anyone
    // outside the shortest player Core range in the catalog.
    for (const weapon of unit.weapons) {
      weapon.range += reach
    }
  }

  const waveLabel = `W${wave}`
  const routeTag = side === 'B' ? 'B' : 'A'
  return {
    id: `${family}-${sector}${routeTag}-w${wave}`,
    name: bossWave ? `${name} (Boss)` : `${name} pack (${waveLabel})`,
    family,
    tags: bossWave ? [family, 'boss'] : [family],
    isBoss: bossWave,
    scrapReward: bossWave ? 20 + sector * 4 : 5 + sector * 2,
    dataReward: bossWave ? 4 + Math.floor(sector / 2) : 1 + Math.floor(sector / 3),
    // AI Points come from achievements later — never from combat drops.
    aiReward: 0,
    essenceReward: bossWave ? 1 + Math.floor(sector / 10) : 0,
    // Salvage is granted per kill (USI). Wave-clear field kept for intel only.
    salvageReward: salvageFromKill(sector, bossWave, side),
    blurb: familyBlurb(family, bossWave),
    units,
    threat: measureThreatRoll(units, 0, threatBudgetForWave(careerWave), false),
  }
}

function assignRadialHeadings(units: CombatUnit[], wave: number): void {
  const n = Math.max(1, units.length)
  const base = (Math.max(1, wave) * 2.399963229728653) % (Math.PI * 2)
  units.forEach((unit, i) => {
    unit.heading = base + (i / n) * Math.PI * 2
    unit.y = 0
  })
}

/** GDD encounter for a global Sortie Wave. Bosses land on every 10th Wave. */
export function encounterForWave(wave: number, extraDanger = 1, state?: GameState): SectorEncounter {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1ClimaxWave(w)) return act1ClimaxEncounter(extraDanger, state)
  const sector = powerSectorForWave(w)
  const boss = isBossWave(w)
  const trash = trashWavesForSector(sector)
  const localWave = boss ? wavesForSector(sector) : Math.min(trash, ((w - 1) % 10) % trash + 1)
  const encounter = enemyForSector(sector, localWave, 'A', extraDanger, w)
  const seed = state ? newSortieSeed(state) : 0
  if (!boss) {
    const spec = threatSpecForWave(w)
    const varied = varyPackToBudget(encounter.units, spec, seed)
    encounter.units = varied.units
    encounter.threat = measureThreatRoll(encounter.units, seed, spec.budget, varied.elite)
  }
  const density = state ? directiveDensityMult(state) * protocolEnemyDensityMult(state) : 1
  if (density > 1 && encounter.units.length > 0) {
    const extra = Math.max(1, Math.round(encounter.units.length * (density - 1)))
    for (let i = 0; i < extra; i++) {
      const src = encounter.units[i % encounter.units.length]!
      encounter.units.push({ ...structuredClone(src), id: `${src.id}-pack${i}` })
    }
  }
  assignRadialHeadings(encounter.units, w)
  if (boss) {
    encounter.isBoss = true
    const mechanic = bossMechanicForWave(w)
    if (mechanic) {
      applyBossMechanicToPack(encounter.units, mechanic)
      encounter.mechanicId = mechanic
      encounter.blurb = bossMechanicBlurb(mechanic)
      encounter.name = encounter.name.includes('Boss') ? encounter.name : `${encounter.name} (Boss)`
      encounter.tags = [...encounter.tags, mechanic]
    } else {
      encounter.name = encounter.name.includes('Boss') ? encounter.name : `${encounter.name} (Boss)`
    }
    encounter.threat = measureThreatRoll(encounter.units, seed, threatBudgetForWave(w), false)
  }
  encounter.id = `w${w}-${encounter.family}`
  return encounter
}

function act1ClimaxEncounter(extraDanger = 1, state?: GameState): SectorEncounter {
  const w = ACT1_FINAL_WAVE
  const sector = powerSectorForWave(w)
  const waveScale = extraDanger
  const units = buildAct1ClimaxPack(sector, waveScale)
  const density = state ? directiveDensityMult(state) * protocolEnemyDensityMult(state) : 1
  if (density > 1 && units.length > 0) {
    const extra = Math.max(1, Math.round(units.length * (density - 1)))
    for (let i = 0; i < extra; i++) {
      const src = units[i % units.length]!
      units.push({ ...structuredClone(src), id: `${src.id}-pack${i}` })
    }
  }
  assignRadialHeadings(units, w)
  applyBossMechanicToPack(units, 'climax-choir')
  return {
    id: `w${w}-climax`,
    name: ACT1_CLIMAX_NAME,
    family: 'titan',
    tags: ['titan', 'boss', 'climax', 'climax-choir'],
    isBoss: true,
    mechanicId: 'climax-choir',
    threat: measureThreatRoll(units, state ? newSortieSeed(state) : 0, threatBudgetForWave(w), false),
    scrapReward: 20 + sector * 4,
    dataReward: 4 + Math.floor(sector / 2),
    aiReward: 0,
    essenceReward: 1 + Math.floor(sector / 10),
    salvageReward: salvageFromKill(sector, true, 'A'),
    blurb: ACT1_CLIMAX_BLURB,
    units,
  }
}

/**
 * Piecewise enemy scaling aligned with Act 1 doors.
 *
 * S1 stays on tutorial hull (2-shot mites). S2–S3 grow slower so early
 * Best Δ can land at +2–4. S4–S8 steepen so W40–W80 is the wall that
 * teaches Plate. S9–S16 grow slower so Furnace is a bump, not a cliff.
 * S17+ (Research door) steepens hull, damage, and density toward W300.
 */
export const ENEMY_EARLY_SECTOR = 8
/** Mid band ends at W160. Research-door waves (W170+) use the late curve. */
export const ENEMY_MID_SECTOR = 16
/** S1–S3 opening. S1 uses base only; S2–S3 grow slower so early Best Δ can land. */
export const ENEMY_OPENING_SECTOR = 3

export const ENEMY_HULL_BASE = 1.55
/** Per-band hull growth for S2–S3. S1 mites stay 2-shot (base × mite HP). */
export const ENEMY_HULL_OPENING = 1.2
/** Per-band hull growth for S4–S8. Steeper than the opening so W40–W80 is the wall. */
export const ENEMY_HULL_EARLY = 1.3
export const ENEMY_HULL_MID = 1.2
/** S17+ (W170+). Steeper than mid, but 1.34× locked Economy-first at W200 even at Workshop cap. */
export const ENEMY_HULL_LATE = 1.26

export const ENEMY_DMG_BASE = 0.9
export const ENEMY_DMG_OPENING = 1.22
export const ENEMY_DMG_EARLY = 1.28
export const ENEMY_DMG_MID = 1.16
export const ENEMY_DMG_LATE = 1.22

/** Extra hull/damage per Wave inside a 10-wave band. */
export const ENEMY_WAVE_HULL_RAMP = 0.06

/** Mid-band Salvage income exponent after band 4. S1–S4 stay linear. */
export const SALVAGE_MID_EXPONENT = 0.5
/** After W160, Salvage grows slower so sortie burst doesn't melt Research→W300. */
export const SALVAGE_LATE_EXPONENT = 0.35

function piecewiseSectorScale(
  sector: number,
  base: number,
  openingGrowth: number,
  earlyGrowth: number,
  midGrowth: number,
  lateGrowth: number,
): number {
  const s = Math.max(1, sector)
  if (s <= ENEMY_OPENING_SECTOR) return base * Math.pow(openingGrowth, s - 1)
  const atOpening = base * Math.pow(openingGrowth, ENEMY_OPENING_SECTOR - 1)
  if (s <= ENEMY_EARLY_SECTOR) return atOpening * Math.pow(earlyGrowth, s - ENEMY_OPENING_SECTOR)
  const atEarlyCap = atOpening * Math.pow(earlyGrowth, ENEMY_EARLY_SECTOR - ENEMY_OPENING_SECTOR)
  if (s <= ENEMY_MID_SECTOR) return atEarlyCap * Math.pow(midGrowth, s - ENEMY_EARLY_SECTOR)
  const atMidCap = atEarlyCap * Math.pow(midGrowth, ENEMY_MID_SECTOR - ENEMY_EARLY_SECTOR)
  return atMidCap * Math.pow(lateGrowth, s - ENEMY_MID_SECTOR)
}

/**
 * Enemy hull scale vs sector.
 * S1 mites stay 2-shot by L0 Pulse (12 × 1.55 = 18.6 HP vs 10 dmg).
 * Later sectors thicken so Pulse dumps cannot delete a pack during the close —
 * they have to live long enough to fire, which is what makes Plate matter.
 */
export function enemySectorScale(sector: number): number {
  return piecewiseSectorScale(
    sector,
    ENEMY_HULL_BASE,
    ENEMY_HULL_OPENING,
    ENEMY_HULL_EARLY,
    ENEMY_HULL_MID,
    ENEMY_HULL_LATE,
  )
}

/**
 * Enemy damage scale. S1 packs must chip L0 Plate; the first boss must
 * land shots inside the regen delay so hull actually sees damage.
 * S8 without Plate levels should fail a full sector. After that, damage
 * no longer outruns hull (the old 1.28 vs 1.235 curve), so TTK grows
 * instead of bricking the run at S11/S15.
 */
export function enemyDamageScale(sector: number): number {
  return piecewiseSectorScale(
    sector,
    ENEMY_DMG_BASE,
    ENEMY_DMG_OPENING,
    ENEMY_DMG_EARLY,
    ENEMY_DMG_MID,
    ENEMY_DMG_LATE,
  )
}

/**
 * After a hit, in-combat Plate regen pauses. Must cover a boss slam
 * (cooldown + telegraph + travel) or slow titans never break L0 shield.
 */
export const SHIELD_REGEN_DELAY = 2

/**
 * Wave-aware packs. Pattern is chosen from the GDD §12 band, not a sector carousel.
 */
function buildWavePack(
  sector: number,
  family: EnemyFamily,
  name: string,
  waveScale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
): CombatUnit[] {
  const hullScale = enemySectorScale(sector) * waveScale
  const dmgScale = enemyDamageScale(sector) * waveScale

  switch (family) {
    case 'swarm':
      return buildSwarmWave(name, hullScale, dmgScale, pattern, sector)
    case 'armored':
      return buildArmoredWave(name, hullScale, dmgScale, pattern, sector)
    case 'ethereal':
      return buildEtherealWave(name, hullScale, dmgScale, pattern, sector)
    case 'divine':
      return buildDivineWave(name, hullScale, dmgScale, pattern, sector)
    default:
      return buildSwarmWave(name, hullScale, dmgScale, pattern, sector)
  }
}

function buildSwarmWave(
  name: string,
  hullScale: number,
  dmgScale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0: // fighters — medium speed, stop a short distance out (USI Fighter)
      return Array.from({ length: sector < 4 ? 2 : 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Fighter ${i + 1}`,
          family: 'swarm',
          role: 'fighter',
          hull: 12 * hullScale,
          damage: 2.8 * dmgScale,
          cooldown: 0.9,
          range: 44,
          speed: 36,
          engageRange: 84,
          x: SPAWN_DISTANCE + i * 8,
          y: packY(i, 3),
        }),
      )
    case 1: // skirmishers — faster, stop in your face (USI Skirmisher)
      return Array.from({ length: Math.min(6, 2 + Math.floor(sector / 8)) }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Skirmisher ${i + 1}`,
          family: 'swarm',
          role: 'skirmisher',
          hull: 15 * hullScale,
          damage: 3.1 * dmgScale,
          cooldown: 0.95,
          range: sector < 4 ? 42 : 32,
          speed: sector < 4 ? 38 : 50,
          engageRange: sector < 4 ? 80 : 74,
          x: SPAWN_DISTANCE + i * 7,
          y: packY(i, 6),
        }),
      )
    case 2: // screen fighters + sniper that holds the back line
      return [
        ...Array.from({ length: 3 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} Fighter ${i + 1}`,
            family: 'swarm',
            role: 'fighter',
            hull: 14 * hullScale,
            damage: 3.0 * dmgScale,
            cooldown: 1,
            range: 48,
            speed: 36,
            engageRange: 86,
            x: SPAWN_DISTANCE + i * 6,
            y: packY(i, 3),
          }),
        ),
        makeEnemyUnit({
          name: `${name} Sniper`,
          family: 'swarm',
          role: 'sniper',
          hull: 22 * hullScale,
          damage: 4.2 * dmgScale,
          cooldown: 1.6,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 35,
          y: 0,
        }),
      ]
    case 3: // mixed — swarm + armored wedge
      return [
        ...Array.from({ length: 4 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} Skirmisher ${i + 1}`,
            family: 'swarm',
            role: 'skirmisher',
            hull: 14 * hullScale,
            damage: 3.0 * dmgScale,
            cooldown: 0.95,
            range: 32,
            speed: 48,
            engageRange: 74,
            x: SPAWN_DISTANCE + i * 8,
            y: packY(i, 4),
          }),
        ),
        makeEnemyUnit({
          name: `${name} Juggernaut`,
          family: 'armored',
          role: 'juggernaut',
          hull: 34 * hullScale,
          armor: 2,
          damage: 3.8 * dmgScale,
          cooldown: 1.35,
          range: 80,
          speed: 12,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 28,
          y: 0,
        }),
      ]
    case 4: // climax — max cloud + brute
    default: {
      const count = Math.min(6, 3 + Math.floor(sector / 6))
      const units = Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Skirmisher ${i + 1}`,
          family: 'swarm',
          role: 'skirmisher',
          hull: 16 * hullScale,
          damage: 3.2 * dmgScale,
          cooldown: 0.9,
          range: 32,
          speed: 48,
          engageRange: 74,
          x: SPAWN_DISTANCE + i * 7,
          y: packY(i, count),
        }),
      )
      units.push(
        makeEnemyUnit({
          name: `${name} Juggernaut`,
          family: 'armored',
          role: 'juggernaut',
          hull: 40 * hullScale,
          armor: 3,
          damage: 4.5 * dmgScale,
          cooldown: 1.4,
          range: 80,
          speed: 12,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 42,
          y: 0,
        }),
      )
      return units
    }
  }
}

function buildArmoredWave(
  name: string,
  hullScale: number,
  dmgScale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Juggernaut`,
          family: 'armored',
          role: 'juggernaut',
          hull: 36 * hullScale,
          armor: 2,
          damage: 4 * dmgScale,
          cooldown: 1.3,
          range: 80,
          speed: 12,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1: {
      const count = Math.min(3, 2 + Math.floor(sector / 10))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Juggernaut ${i + 1}`,
          family: 'armored',
          role: 'juggernaut',
          hull: 44 * hullScale,
          armor: 3 + Math.floor(sector / 6),
          damage: 5 * dmgScale,
          cooldown: 1.35,
          range: 80,
          speed: 12,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + i * 14,
          y: packY(i, count),
        }),
      )
    }
    case 2: // siege — slow mortar + escort plate
      return [
        makeEnemyUnit({
          name: `${name} Sniper`,
          family: 'armored',
          role: 'sniper',
          hull: 55 * hullScale,
          armor: 4,
          damage: 7 * dmgScale,
          cooldown: 1.8,
          telegraphDuration: 0.6,
          range: 130,
          speed: 12,
          engageRange: 118,
          kite: true,
          tags: ['kinetic', 'splash'],
          splash: 1,
          x: SPAWN_DISTANCE + 20,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Fighter`,
          family: 'armored',
          role: 'fighter',
          hull: 32 * hullScale,
          armor: 2,
          damage: 4 * dmgScale,
          cooldown: 1.2,
          range: 55,
          speed: 28,
          engageRange: 90,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: -30,
        }),
      ]
    case 3: // mixed — plates + ethereal spotter
      return [
        makeEnemyUnit({
          name: `${name} Juggernaut 1`,
          family: 'armored',
          role: 'juggernaut',
          hull: 46 * hullScale,
          armor: 3,
          damage: 5 * dmgScale,
          cooldown: 1.35,
          range: 80,
          speed: 12,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: -20,
        }),
        makeEnemyUnit({
          name: `${name} Juggernaut 2`,
          family: 'armored',
          role: 'juggernaut',
          hull: 46 * hullScale,
          armor: 3,
          damage: 5 * dmgScale,
          cooldown: 1.35,
          range: 80,
          speed: 12,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: 20,
        }),
        makeEnemyUnit({
          name: `${name} Sniper`,
          family: 'ethereal',
          role: 'sniper',
          hull: 22 * hullScale,
          shield: 12 * hullScale,
          evasion: 0.12,
          damage: 3.2 * dmgScale,
          cooldown: 1.4,
          telegraphDuration: 0.5,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 30,
          y: 0,
        }),
      ]
    case 4:
    default: {
      const count = Math.min(4, 2 + Math.floor(sector / 8))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Juggernaut ${i + 1}`,
          family: 'armored',
          role: 'juggernaut',
          hull: 50 * hullScale,
          armor: 4 + Math.floor(sector / 5),
          damage: 5.5 * dmgScale,
          cooldown: 1.3,
          range: 80,
          speed: 12,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + i * 12,
          y: packY(i, count),
        }),
      )
    }
  }
}

function buildEtherealWave(
  name: string,
  hullScale: number,
  dmgScale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Shield Fighter`,
          family: 'ethereal',
          role: 'shield',
          hull: 22 * hullScale,
          shield: 10 * hullScale,
          evasion: 0.1,
          damage: 3 * dmgScale,
          cooldown: 1.1,
          range: 55,
          speed: 30,
          engageRange: 90,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1: {
      const count = sector <= 3 ? 2 : 3
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Sniper ${i + 1}`,
          family: 'ethereal',
          role: 'sniper',
          hull: 26 * hullScale,
          shield: 14 * hullScale,
          evasion: 0.12,
          damage: 3.5 * dmgScale,
          cooldown: 1.45,
          telegraphDuration: 0.5,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + i * 10,
          y: packY(i, count),
        }),
      )
    }
    case 2: // phase blades — closer cutters
      return Array.from({ length: 3 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} Skirmisher ${i + 1}`,
            family: 'ethereal',
            role: 'skirmisher',
            hull: 24 * hullScale,
            shield: 8 * hullScale,
            evasion: 0.16,
            damage: 4.2 * dmgScale,
            cooldown: 0.95,
            range: 36,
            speed: 46,
            engageRange: 76,
            tags: ['energy', 'pierce'],
            x: SPAWN_DISTANCE + i * 8,
            y: packY(i, 3),
          }),
      )
    case 3: // mixed — wisps + swarm distractors
      return [
        makeEnemyUnit({
          name: `${name} Sniper 1`,
          family: 'ethereal',
          role: 'sniper',
          hull: 28 * hullScale,
          shield: 16 * hullScale,
          evasion: 0.12,
          damage: 3.6 * dmgScale,
          cooldown: 1.4,
          telegraphDuration: 0.5,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 15,
          y: -24,
        }),
        makeEnemyUnit({
          name: `${name} Sniper 2`,
          family: 'ethereal',
          role: 'sniper',
          hull: 28 * hullScale,
          shield: 16 * hullScale,
          evasion: 0.12,
          damage: 3.6 * dmgScale,
          cooldown: 1.4,
          telegraphDuration: 0.5,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 15,
          y: 24,
        }),
        makeEnemyUnit({
          name: `${name} Skirmisher`,
          family: 'swarm',
          role: 'skirmisher',
          hull: 14 * hullScale,
          damage: 2.5 * dmgScale,
          cooldown: 0.9,
          range: 32,
          speed: 48,
          engageRange: 74,
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 4:
    default:
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Sniper ${i + 1}`,
          family: 'ethereal',
          role: 'sniper',
          hull: 30 * hullScale,
          shield: 18 * hullScale,
          evasion: 0.14,
          damage: 3.8 * dmgScale,
          cooldown: 1.4,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy', 'antiShield'],
          x: SPAWN_DISTANCE + i * 10,
          y: packY(i, 3),
        }),
      )
  }
}

function buildDivineWave(
  name: string,
  hullScale: number,
  dmgScale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  _sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Sniper`,
          family: 'divine',
          role: 'sniper',
          hull: 30 * hullScale,
          shield: 8 * hullScale,
          damage: 4 * dmgScale,
          cooldown: 1.5,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1:
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          role: 'sniper',
          hull: 38 * hullScale,
          shield: 12 * hullScale,
          damage: 5 * dmgScale,
          cooldown: 1.5,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Fighter`,
          family: 'divine',
          role: 'fighter',
          hull: 22 * hullScale,
          evasion: 0.08,
          damage: 3.5 * dmgScale,
          cooldown: 1,
          range: 50,
          speed: 32,
          engageRange: 88,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 18,
          y: -26,
        }),
      ]
    case 2: // choir dive — three attendants, no core
      return Array.from({ length: 3 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} Skirmisher ${i + 1}`,
            family: 'divine',
            role: 'skirmisher',
            hull: 26 * hullScale,
            evasion: 0.1,
            damage: 4 * dmgScale,
            cooldown: 0.95,
            range: 32,
            speed: 46,
            engageRange: 74,
            tags: ['energy'],
            x: SPAWN_DISTANCE + i * 10,
            y: packY(i, 3),
          }),
      )
    case 3: // mixed — core + armored votive
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          role: 'sniper',
          hull: 40 * hullScale,
          shield: 14 * hullScale,
          damage: 5.2 * dmgScale,
          cooldown: 1.5,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Juggernaut`,
          family: 'armored',
          role: 'juggernaut',
          hull: 36 * hullScale,
          armor: 3,
          damage: 4 * dmgScale,
          cooldown: 1.3,
          range: 80,
          speed: 12,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 22,
          y: 28,
        }),
      ]
    case 4:
    default:
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          role: 'sniper',
          hull: 42 * hullScale,
          shield: 14 * hullScale,
          damage: 5.5 * dmgScale,
          cooldown: 1.5,
          telegraphDuration: 0.55,
          range: 130,
          speed: 14,
          engageRange: 118,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Fighter`,
          family: 'divine',
          role: 'fighter',
          hull: 24 * hullScale,
          evasion: 0.08,
          damage: 3.8 * dmgScale,
          cooldown: 1,
          range: 50,
          speed: 32,
          engageRange: 88,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 20,
          y: -28,
        }),
        makeEnemyUnit({
          name: `${name} Fighter`,
          family: 'divine',
          role: 'fighter',
          hull: 24 * hullScale,
          evasion: 0.08,
          damage: 3.8 * dmgScale,
          cooldown: 1,
          range: 50,
          speed: 32,
          engageRange: 88,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 20,
          y: 28,
        }),
      ]
  }
}

function buildBossPack(sector: number, name: string, waveScale = 1): CombatUnit[] {
  const hullScale = enemySectorScale(sector) * 0.95 * waveScale
  const dmgScale = enemyDamageScale(sector) * waveScale
  const titan = makeEnemyUnit({
    name: `${name} (Boss)`,
    family: 'titan',
    hull: Math.min(150, 10 + 16 * (sector - 1)) * hullScale,
    armor: 2,
    shield: Math.min(20, 8 + 1.4 * (sector - 1)) * hullScale,
    // Cadence + travel must stay inside SHIELD_REGEN_DELAY or L0 Plate never breaks.
    damage: 10 * dmgScale,
    cooldown: 1,
    telegraphDuration: 0.35,
    range: 120,
    speed: 10,
    engageRange: 100,
    kite: true,
    tags: ['kinetic'],
    isBoss: true,
    role: 'boss',
    shape: 'hex',
    x: SPAWN_DISTANCE + 10,
    y: 0,
  })
  const thrallFamily: EnemyFamily = sector % 10 === 0 ? 'armored' : 'swarm'
  const adds = [
    makeEnemyUnit({
      name: thrallFamily === 'armored' ? 'Plate Thrall' : 'Thrall',
      family: thrallFamily,
      role: thrallFamily === 'armored' ? 'fighter' : 'skirmisher',
      hull: (thrallFamily === 'armored' ? 14 : 4) * hullScale,
      armor: thrallFamily === 'armored' ? 3 : 0,
      damage: 2.8 * dmgScale,
      cooldown: 1,
      range: thrallFamily === 'armored' ? 55 : 40,
      speed: thrallFamily === 'armored' ? 20 : 36,
      engageRange: thrallFamily === 'armored' ? 92 : 82,
      tags: thrallFamily === 'armored' ? ['kinetic'] : ['kinetic'],
      x: SPAWN_DISTANCE + 30,
      y: -34,
    }),
    makeEnemyUnit({
      name: thrallFamily === 'armored' ? 'Plate Thrall' : 'Thrall',
      family: thrallFamily,
      role: thrallFamily === 'armored' ? 'fighter' : 'skirmisher',
      hull: (thrallFamily === 'armored' ? 14 : 4) * hullScale,
      armor: thrallFamily === 'armored' ? 3 : 0,
      damage: 2.8 * dmgScale,
      cooldown: 1,
      range: thrallFamily === 'armored' ? 55 : 40,
      speed: thrallFamily === 'armored' ? 20 : 36,
      engageRange: thrallFamily === 'armored' ? 92 : 82,
      tags: ['kinetic'],
      x: SPAWN_DISTANCE + 30,
      y: 34,
    }),
  ]
  return [titan, ...adds]
}

export const ACT1_CLIMAX_NAME = 'Choir Crown'
export const ACT1_CLIMAX_BLURB = bossMechanicBlurb('climax-choir')

function applyBossMechanicToPack(units: CombatUnit[], mechanic: BossMechanicId): void {
  const boss = units.find((u) => u.isBoss)
  if (!boss) return
  const telegraph = bossMechanicTelegraph(mechanic)
  for (const weapon of boss.weapons) {
    weapon.telegraphDuration = Math.max(weapon.telegraphDuration, telegraph)
    if (mechanic === 'telegraph-slam') weapon.damage *= 1.2
  }
}

function spawnBossAdds(state: GameState, boss: CombatUnit, label: string): void {
  const sector = powerSectorForWave(state.combat.wave || 1)
  const hullScale = enemySectorScale(sector)
  const dmgScale = enemyDamageScale(sector)
  const add = makeEnemyUnit({
    name: label,
    family: 'swarm',
    role: 'skirmisher',
    hull: 5 * hullScale,
    damage: 2.2 * dmgScale,
    cooldown: 0.9,
    range: 36,
    speed: 38,
    engageRange: 78,
    tags: ['kinetic'],
    x: Math.max(HIVE_STANDOFF_MIN, boss.x * 0.72),
    rewardWeight: 0.35,
  })
  add.heading = (boss.heading ?? 0) + 0.7 + state.combat.bossPhase * 0.9
  state.combat.enemyUnits.push(add)
  syncHullAggregates(state)
}

function tickBossSupportAura(state: GameState, dt: number): void {
  const mechanic = (state.combat.bossMechanic ?? bossMechanicForWave(state.combat.wave)) as BossMechanicId | null
  if (!mechanic || !bossMechanicHasAura(mechanic)) return
  const boss = state.combat.enemyUnits.find((u) => u.isBoss && u.hull > 0)
  if (!boss) return
  for (const unit of state.combat.enemyUnits) {
    if (unit.isBoss || unit.hull <= 0) continue
    const dist = Math.abs((unit.x ?? 0) - (boss.x ?? 0))
    if (dist > 70) continue
    unit.hull = Math.min(unit.hullMax, unit.hull + Math.max(0.8, unit.hullMax * 0.04) * dt)
    unit.armor = Math.max(unit.armor, 1)
  }
}

function buildAct1ClimaxPack(sector: number, waveScale = 1): CombatUnit[] {
  const hullScale = enemySectorScale(sector) * 1.15 * waveScale
  const dmgScale = enemyDamageScale(sector) * waveScale
  return [
    makeEnemyUnit({
      name: ACT1_CLIMAX_NAME,
      family: 'titan',
      hull: Math.min(220, 24 + 18 * (sector - 1)) * hullScale,
      armor: 3,
      shield: Math.min(28, 10 + 1.6 * (sector - 1)) * hullScale,
      damage: 12 * dmgScale,
      cooldown: 1,
      telegraphDuration: 0.95,
      range: 125,
      speed: 9,
      engageRange: 105,
      kite: true,
      tags: ['kinetic'],
      isBoss: true,
      role: 'boss',
      shape: 'hex',
      x: SPAWN_DISTANCE + 8,
      y: 0,
      rewardWeight: 3,
    }),
    makeEnemyUnit({
      name: 'Crown Plate',
      family: 'armored',
      role: 'fighter',
      hull: 18 * hullScale,
      armor: 4,
      damage: 3.4 * dmgScale,
      cooldown: 1.05,
      range: 58,
      speed: 18,
      engageRange: 94,
      tags: ['kinetic'],
      x: SPAWN_DISTANCE + 28,
      y: -36,
    }),
    makeEnemyUnit({
      name: 'Loop Mite',
      family: 'swarm',
      role: 'skirmisher',
      hull: 6 * hullScale,
      damage: 2.6 * dmgScale,
      cooldown: 0.8,
      range: 38,
      speed: 42,
      engageRange: 80,
      tags: ['kinetic'],
      x: SPAWN_DISTANCE + 34,
      y: 36,
    }),
    makeEnemyUnit({
      name: 'Veil Echo',
      family: 'ethereal',
      role: 'sniper',
      hull: 12 * hullScale,
      shield: 10 * hullScale,
      damage: 4.0 * dmgScale,
      cooldown: 1.25,
      telegraphDuration: 0.7,
      range: 128,
      speed: 14,
      engageRange: 118,
      kite: true,
      tags: ['energy'],
      x: SPAWN_DISTANCE + 16,
      y: 0,
    }),
  ]
}

function familyBlurb(family: EnemyFamily, boss: boolean): string {
  if (boss) {
    return 'Boss: three phases — kite titan, armored close, ethereal kite with shields.'
  }
  return familyIntel(family)
}

/** Plain-language family description for Codex intel (no loadout advice). */
export function familyIntel(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Basic fighters first, then swarms and skirmishers. Numbers punish slow targeting.'
    case 'armored':
      return 'High-hull plates that hold mid-range. Rewards pierce and sustained damage.'
    case 'ethereal':
      return 'Shield layers, charging snipers, and support that assist the pack.'
    case 'divine':
      return 'Elite formations: a distant core with diving attendants.'
    case 'titan':
      return 'Authored boss. Phases shift the fight around the Hive.'
  }
}

/** Soft-counter guidance shown in the Codex once a family is unlocked. */
export function softCounterForFamily(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Soft counter: Defense modules and Flak / Ion splash punish the rush.'
    case 'armored':
      return 'Soft counter: Weapon role and pierce (Lance / Rail) cut plates.'
    case 'ethereal':
      return 'Soft counter: Utility, Grav Tether, energy / anti-shield, or Rail reach.'
    case 'divine':
      return 'Soft counter: Utility / energy damage; expect diving attendants.'
    case 'titan':
      return 'Soft counter: Defense + Ablative Mesh; pierce helps through phases.'
  }
}

export const CODEX_ROLES: EnemyRole[] = [
  'fighter',
  'skirmisher',
  'sniper',
  'juggernaut',
  'shield',
  'boss',
]

export function roleIntel(role: EnemyRole): string {
  switch (role) {
    case 'fighter':
      return 'Medium stand-off. Stops a short distance out and trades shots.'
    case 'skirmisher':
      return 'Faster and closer. Full dive from Wave 40; early packs keep a milder range.'
    case 'sniper':
      return 'Kites far back. Winds a charge laser, then a fast bolt.'
    case 'juggernaut':
      return 'Slow mid-range plate. Fat silhouette, heavy hull.'
    case 'shield':
      return 'Approaches with a shield layer. The first hit does not spill into hull.'
    case 'boss':
      return 'Kiting titan. Ring telegraph, then a kinetic slam orb — not a charge laser.'
  }
}

export const CODEX_FAMILIES: EnemyFamily[] = [
  'swarm',
  'armored',
  'ethereal',
  'divine',
  'titan',
]

export function familyShape(family: EnemyFamily): UnitShape {
  return FAMILY_SHAPE[family]
}

/** Record families from living (or listed) combat units into career Codex memory. */
export function revealCodexFamilies(state: GameState, families: Iterable<string>): void {
  if (!state.codex) state.codex = { seenFamilies: [] }
  const seen = new Set(state.codex.seenFamilies)
  let changed = false
  for (const raw of families) {
    if (!CODEX_FAMILIES.includes(raw as EnemyFamily)) continue
    if (seen.has(raw as EnemyFamily)) continue
    seen.add(raw as EnemyFamily)
    changed = true
  }
  if (changed) {
    state.codex.seenFamilies = CODEX_FAMILIES.filter((f) => seen.has(f))
  }
}

export interface SectorRosterEntry {
  key: string
  name: string
  family: EnemyFamily
  shape: UnitShape
  isBoss: boolean
  count: number
  summary: string
  hull: number
  shield: number
  armor: number
  evasion: number
  dps: number
  speed: number
  range: number
  weaponTags: WeaponTag[]
}

function rosterStatsFromUnit(u: CombatUnit): Pick<
  SectorRosterEntry,
  'hull' | 'shield' | 'armor' | 'evasion' | 'dps' | 'speed' | 'range' | 'weaponTags'
> {
  const weapon = u.weapons[0]
  const cooldown = Math.max(0.05, weapon?.cooldown ?? 1)
  return {
    hull: u.hullMax,
    shield: u.shieldMax,
    armor: u.armor,
    evasion: u.evasion,
    dps: (weapon?.damage ?? 0) / cooldown,
    speed: u.speed,
    range: weapon?.range ?? 0,
    weaponTags: [...(weapon?.tags ?? [])],
  }
}

/** Unique enemy types across all waves in a sector (for the sector intel panel). */
export function sectorRoster(sector: number): SectorRosterEntry[] {
  const groups = new Map<string, SectorRosterEntry>()
  for (let wave = 1; wave <= wavesForSector(sector); wave++) {
    const encounter = enemyForSector(sector, wave)
    for (const u of encounter.units) {
      const key = `${u.family}:${u.name}`
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        // Keep the strongest sighting for intel numbers.
        if (u.hullMax > existing.hull) {
          Object.assign(existing, rosterStatsFromUnit(u))
        }
        continue
      }
      groups.set(key, {
        key,
        name: u.name,
        family: u.family as EnemyFamily,
        shape: u.shape,
        isBoss: u.isBoss,
        count: 1,
        summary: u.isBoss
          ? familyBlurb(u.family as EnemyFamily, true)
          : familyIntel(u.family as EnemyFamily),
        ...rosterStatsFromUnit(u),
      })
    }
  }
  return [...groups.values()]
}

function preserveWeaponCooldowns(prev: CombatUnit[], next: CombatUnit[]): void {
  for (const unit of next) {
    const old = prev.find((u) => u.id === unit.id)
    if (!old) continue
    unit.weapons = unit.weapons.map((weapon) => {
      const prior = old.weapons.find((pw) => pw.id === weapon.id)
      return prior
        ? { ...weapon, cooldownLeft: prior.cooldownLeft, telegraphLeft: prior.telegraphLeft }
        : weapon
    })
  }
}

export function buildCoreSatellite(state: GameState, slot: number, index: number, count: number): CombatUnit | null {
  const moduleId = state.shipyard.modules[slot]
  const mod = getModule(moduleId)
  if (!mod?.weapon || mod.role !== 'weapon') return null
  const weapon = buildCoreWeapon(state, slot)
  if (!weapon) return null
  const kind = coreVisualKind(moduleId)
  const orbit = coreOrbitRadius(kind)
  return {
    id: `core-${slot}`,
    side: 'player',
    name: mod.name,
    shape: 'circle',
    family: 'core',
    hull: 0,
    hullMax: 0,
    shield: 0,
    shieldMax: 0,
    armor: 0,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [weapon],
    isBoss: false,
    isFlagship: false,
    isCore: true,
    coreModuleId: moduleId,
    coreSlot: slot,
    untargetable: true,
    dots: [],
    x: orbit,
    y: 0,
    heading: count > 0 ? (index / count) * Math.PI * 2 : 0,
    speed: 0,
    engageRange: 0,
    kite: false,
    phaseWarnLeft: 0,
    regenDelay: 0,
  }
}

export function buildPlayerFleet(state: GameState): CombatUnit[] {
  const stats = computeShipStats(state)
  const hull = Math.min(state.combat.playerHull, stats.hullMax)
  const shield = Math.min(state.combat.playerShield, stats.shieldMax)
  const hiveWeapons = buildFlagshipWeapons(state).filter((weapon) => weapon.id === 'frame-battery')
  const hive: CombatUnit = {
    id: 'hive',
    side: 'player',
    name: 'Hive',
    shape: 'hex',
    family: 'player',
    hull: Math.max(1, hull),
    hullMax: stats.hullMax,
    shield,
    shieldMax: stats.shieldMax,
    armor: stats.armor,
    evasion: stats.evasion,
    damageTakenMult: stats.damageTakenMult,
    weapons: hiveWeapons,
    isBoss: false,
    isFlagship: true,
    dots: [],
    x: 0,
    y: 0,
    heading: 0,
    speed: 0,
    engageRange: 0,
    kite: false,
    phaseWarnLeft: 0,
    regenDelay: 0,
  }

  const weaponSlots: number[] = []
  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const mod = getModule(state.shipyard.modules[slot]!)
    if (mod?.weapon && mod.role === 'weapon') weaponSlots.push(slot)
  }
  const cores = weaponSlots
    .map((slot, index) => buildCoreSatellite(state, slot, index, weaponSlots.length))
    .filter((unit): unit is CombatUnit => Boolean(unit))

  return [hive, ...cores]
}

export function syncPlayerFleetWeapons(state: GameState): void {
  const prev = state.combat.playerUnits
  const rebuilt = buildPlayerFleet(state)
  preserveWeaponCooldowns(prev, rebuilt)
  const prevHive = prev.find((u) => u.isFlagship)
  const nextHive = rebuilt.find((u) => u.isFlagship)
  if (prevHive && nextHive && prevHive.hullMax > 0) {
    nextHive.hull = Math.max(1, nextHive.hullMax * (prevHive.hull / prevHive.hullMax))
    nextHive.shield =
      nextHive.shieldMax > 0
        ? nextHive.shieldMax * (prevHive.shield / Math.max(1, prevHive.shieldMax))
        : 0
  }
  state.combat.playerUnits = rebuilt
}

export interface FightSummary {
  playerDps: number
  enemyDps: number
  matchupNotes: string[]
  playerAlive: number
  enemyAlive: number
}

/** Rough DPS / matchup notes for UI (not the live resolution path). */
export function computeFightDamage(state: GameState): FightSummary {
  const stats = computeShipStats(state)
  const family = (state.combat.enemyFamily || 'swarm') as EnemyFamily
  const roles = fittedRoles(state)
  const notes: string[] = []
  const matchupScale =
    1 +
    challengeShopMatchupBonus(state.prestige.shop) +
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup

  let playerDps = stats.damage
  let incomingMult = stats.damageTakenMult

  if (family === 'armored' && roles.weapon > 0) {
    const bonus = 1 + 0.18 * roles.weapon * matchupScale
    playerDps *= bonus
    notes.push(`Weapons vs Armored ×${bonus.toFixed(2)}`)
  }
  if ((family === 'ethereal' || family === 'divine') && roles.utility > 0) {
    const bonus = 1 + 0.2 * Math.min(roles.utility, 2) * matchupScale
    playerDps *= bonus
    notes.push(`Utility vs ${family} ×${bonus.toFixed(2)}`)
  }
  if (family === 'swarm' && roles.defense > 0) {
    const reduce = Math.pow(0.88, roles.defense * matchupScale)
    incomingMult *= reduce
    notes.push(`Defense vs Swarm ×${reduce.toFixed(2)} incoming`)
  }
  if (family === 'titan' || state.combat.isBoss) {
    if (roles.weapon > 0) {
      playerDps *= 1.1
      notes.push('Weapons vs Boss ×1.10')
    }
    if (roles.defense === 0) {
      incomingMult *= 1.2
      notes.push('No Defense vs Boss ×1.20 incoming')
    } else {
      incomingMult *= Math.pow(0.92, roles.defense)
      notes.push('Defense steadies the Hive against bosses')
    }
    if (aiDoctrinesActive(state, 'boss-protocol')) {
      playerDps *= 1.25
      notes.push('Boss Doctrine ×1.25')
    }
  }

  const enemyUnits =
    state.combat.enemyUnits.length > 0
      ? state.combat.enemyUnits
      : enemyForSector(state.combat.sector).units
  const enemyDps =
    enemyUnits
      .filter((u) => u.hull > 0)
      .reduce((s, u) => s + u.weapons.reduce((a, w) => a + w.damage / w.cooldown, 0), 0) *
    incomingMult

  return {
    playerDps,
    enemyDps,
    matchupNotes: notes,
    playerAlive: state.combat.playerUnits.filter((u) => u.hull > 0).length,
    enemyAlive: state.combat.enemyUnits.filter((u) => u.hull > 0).length,
  }
}

function fittedRoles(state: GameState): Record<'weapon' | 'defense' | 'utility', number> {
  const counts = { weapon: 0, defense: 0, utility: 0 }
  for (const id of state.shipyard.modules) {
    const role = getModule(id)?.role
    if (role) counts[role] += 1
  }
  return counts
}

export function matchupHintForSector(sector: number, fittedModuleIds: string[]): string {
  const enemy = enemyForSector(sector)
  const roles = { weapon: 0, defense: 0, utility: 0 }
  for (const id of fittedModuleIds) {
    const role = getModule(id)?.role
    if (role) roles[role] += 1
  }

  if (enemy.family === 'swarm' && roles.defense === 0 && !fittedModuleIds.includes('flak-array')) {
    return 'Hint: Flak or Defense vs Swarm packs.'
  }
  if (enemy.family === 'armored' && roles.weapon === 0) {
    return 'Hint: fit pierce Weapons against Armored.'
  }
  if (
    (enemy.family === 'ethereal' || enemy.family === 'divine') &&
    roles.utility === 0 &&
    !fittedModuleIds.includes('phase-beam')
  ) {
    return 'Hint: Energy weapons or Utility vs Ethereal/Divine.'
  }
  if (enemy.isBoss && roles.defense === 0) {
    return 'Hint: bosses punish naked hull — fit Defense.'
  }
  return enemy.blurb
}

export function syncHullAggregates(state: GameState): void {
  const enemies = state.combat.enemyUnits
  state.combat.enemyHull = enemies.reduce((s, u) => s + Math.max(0, u.hull), 0)
  state.combat.enemyHullMax = enemies.reduce((s, u) => s + u.hullMax, 0)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) {
    state.combat.playerHull = flag.hull
    state.combat.playerHullMax = flag.hullMax
    state.combat.playerShield = flag.shield
    state.combat.playerShieldMax = flag.shieldMax
  }
}

/** Auto boss phase shifts — retags titan resistances. Mutates combat. */
export function maybeAdvanceBossPhase(
  state: GameState,
  pushLog: (state: GameState, line: string) => void,
): void {
  if (!state.combat.isBoss) return
  const boss = state.combat.enemyUnits.find((u) => u.isBoss)
  if (!boss || boss.hull <= 0 || boss.hullMax <= 0) return
  const pct = boss.hull / boss.hullMax

  if (state.combat.bossPhase < 1 && pct <= 2 / 3) {
    state.combat.bossPhase = 1
    state.combat.enemyFamily = 'armored'
    state.combat.enemyTags = ['armored', 'boss']
    boss.family = 'armored'
    boss.armor += 4
    boss.engageRange = 80
    boss.kite = false
    boss.phaseWarnLeft = 0.9
    for (const w of boss.weapons) {
      w.damage *= 1.15
      w.telegraphLeft = 0
      w.cooldownLeft = Math.max(w.cooldownLeft, 0.45)
    }
    const mechanic = (state.combat.bossMechanic ?? bossMechanicForWave(state.combat.wave)) as BossMechanicId | null
    const climax = mechanic === 'climax-choir'
    if (mechanic && bossMechanicHasShieldPhase(mechanic)) {
      boss.shieldMax = Math.max(boss.shieldMax, boss.hullMax * (climax ? 0.7 : 0.45))
      boss.shield = boss.shieldMax
      pushLog(
        state,
        climax
          ? 'Choir Crown — the loop folds. A temporal shield wall closes.'
          : 'Boss phase 2 — shield wall raised.',
      )
    } else {
      pushLog(state, 'Boss phase 2 — shell hardens [armored], closing in.')
    }
    if (mechanic && bossMechanicHasAdds(mechanic)) {
      spawnBossAdds(state, boss, climax ? 'Loop Mite' : 'Called Thrall')
    }
    revealCodexFamilies(state, ['armored'])
  }

  if (state.combat.bossPhase < 2 && pct <= 1 / 3) {
    state.combat.bossPhase = 2
    state.combat.enemyFamily = 'ethereal'
    state.combat.enemyTags = ['ethereal', 'boss']
    boss.family = 'ethereal'
    boss.evasion = Math.min(0.35, boss.evasion + 0.1)
    boss.shield = Math.max(boss.shield, boss.shieldMax * 0.4)
    boss.engageRange = 125
    boss.kite = true
    boss.phaseWarnLeft = 0.9
    for (const w of boss.weapons) {
      w.damage *= 1.2
      w.range = Math.max(w.range, 130)
      w.telegraphLeft = 0
      w.cooldownLeft = Math.max(w.cooldownLeft, 0.45)
    }
    const mechanic = (state.combat.bossMechanic ?? bossMechanicForWave(state.combat.wave)) as BossMechanicId | null
    const climax = mechanic === 'climax-choir'
    if (mechanic && bossMechanicHasAdds(mechanic)) {
      spawnBossAdds(state, boss, climax ? 'Veil Echo' : 'Called Thrall')
    }
    revealCodexFamilies(state, ['ethereal'])
    pushLog(
      state,
      climax
        ? 'Choir Crown — reconstruction tears. Time around the Hive unthreads.'
        : 'Boss phase 3 — form frays [ethereal], kiting out.',
    )
  }
}

/** Hull points restored per second while Paused (full) or between fights (field rate). */
export function repairRatePerSecond(state: GameState): number {
  let rate = 5
  if (aiDoctrinesActive(state, 'auto-engage')) rate *= 2
  if (state.shipyard.modules.includes('nano-lathe')) rate *= 1.6
  const shopMult = matterShopRepairMult(state.prestige.matterShop)
  rate /= Math.max(0.2, shopMult)
  rate *= 1 + challengeStackRepairBonus(state.prestige.challengeClears)
  rate += stationRepairBonus(state)
  rate *= reactorsRepairMult(state.core?.ranks.reactors ?? 0)
  return rate
}

export function shieldRepairRatePerSecond(state: GameState): number {
  return repairRatePerSecond(state) * 0.8
}

/** Continuous Advance always re-engages (death warps with full hull). */
export function canReengage(_state: GameState): boolean {
  return true
}

export const REENGAGE_HULL_FRACTION = 0

function laneDistance(a: CombatUnit, b: CombatUnit): number {
  return Math.abs(a.x - b.x)
}

/** Furthest legal park. Loadout does not move this — Knife Fight is the only compress. */
export function minimumPlayerWeaponRangeForSector(_sector?: number, state?: GameState): number {
  if (state?.prestige.activeChallengeId === 'short-range') return SHORT_RANGE_MAX
  return ENEMY_PARK_MAX
}

export function enemyApproachTarget(
  unit: Pick<CombatUnit, 'engageRange'>,
  _fightElapsed = 0,
  _sector = 2,
  state?: GameState,
): number {
  const cap = minimumPlayerWeaponRangeForSector(_sector, state)
  const floor = Math.min(HIVE_STANDOFF_MIN, cap)
  const preferred = Math.max(0, unit.engageRange)
  return Math.max(floor, Math.min(preferred, cap))
}

function moveUnits(state: GameState, dt: number): void {
  for (const unit of state.combat.playerUnits) {
    if (unit.isFlagship) {
      unit.x = 0
      unit.y = 0
      continue
    }
    if (!unit.isCore || !unit.coreModuleId) continue
    const kind = coreVisualKind(unit.coreModuleId)
    unit.x = coreOrbitRadius(kind)
    unit.y = 0
    unit.heading = (unit.heading ?? 0) + coreOrbitSpeed(kind) * dt
  }

  const elapsed = Math.max(0, state.combat.fightElapsed ?? 0)
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const target = enemyApproachTarget(unit, elapsed, state.combat.sector, state)
    if (unit.x > target) {
      unit.x = Math.max(target, unit.x - unit.speed * dt)
    } else if (unit.x < target) {
      unit.x = Math.min(target, unit.x + unit.speed * dt * (unit.kite ? 0.85 : 1))
    }
    // Slight heading drift so packs don't sit on identical rays
    unit.heading = (unit.heading ?? 0) + Math.sin(unit.x * 0.04 + (unit.heading ?? 0)) * 0.008
  }
}

function pickTarget(
  attacker: CombatUnit,
  foes: CombatUnit[],
  weapon: WeaponInstance,
  focusFire: boolean,
): CombatUnit | null {
  const living = foes.filter(
    (u) =>
      u.hull > 0 &&
      !u.untargetable &&
      !u.isCore &&
      (attacker.side !== 'enemy' || u.isFlagship) &&
      laneDistance(attacker, u) <= weapon.range + 0.5,
  )
  if (living.length === 0) return null
  if (attacker.side === 'player' && focusFire) {
    living.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
      return a.hull / a.hullMax - b.hull / b.hullMax
    })
    return living[0] ?? null
  }
  // Prefer nearest in lane
  living.sort((a, b) => laneDistance(attacker, a) - laneDistance(attacker, b))
  return living[0] ?? null
}

function matchupMultiplier(
  tags: WeaponTag[],
  target: CombatUnit,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
  bossProtocol: boolean,
): number {
  let mult = 1
  const family = target.family
  if (family === 'armored' && (tags.includes('pierce') || tags.includes('kinetic'))) {
    mult *= 1 + 0.12 * Math.max(1, roles.weapon) * matchupScale
  }
  if (
    (family === 'ethereal' || family === 'divine') &&
    (tags.includes('energy') || tags.includes('antiShield'))
  ) {
    mult *= 1 + 0.14 * Math.max(1, roles.utility) * matchupScale
  }
  if (family === 'swarm' && tags.includes('splash')) {
    mult *= 1.25
  }
  if (target.isBoss) {
    if (tags.includes('pierce')) mult *= 1.1
    if (bossProtocol) mult *= 1.25
  }
  return mult
}

export interface PartDropResult {
  partId: string
  moduleId: string
  partType: PartType
  discovered: boolean
}

/**
 * Roll blueprint part drops for a slain enemy.
 * Parts stay offline until Alloy Foundry is unlocked (alloy-smelting + Research).
 * Mutates parts inventory + discoveredModules; appends combat log on discovery.
 * Pure-ish helper for tests (inject rng).
 */
export function rollEnemyPartDrop(
  state: GameState,
  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name' | 'rewardWeight'>,
  rng: () => number = Math.random,
  rewardWeight = unit.rewardWeight ?? 1,
): PartDropResult[] {
  // Keep early scrap sinks meaningful — no Core prints until the Foundry door.
  if (!isSystemUnlocked(state, 'foundry')) return []

  const table = getEnemyDropTable(unit.family)
  if (!table) return []

  const trackedId = state.foundry?.trackedPrintId ?? null
  const trackedEligible = Boolean(
    trackedId &&
      canDropModulePart(state, trackedId) &&
      familyCanDropPrint(unit.family, trackedId, state.combat.sector),
  )
  const holding =
    normalizePushMode(state.combat.pushMode, state.combat.campaign) !== 'advance'
  const holdMult = holding && trackedEligible ? HOLD_TRACKED_FRAGMENT_MULT : 1

  const earlyMult = earlyCareerFragmentMult(careerHighestSector(state))
  let chance =
    table.chance *
    Math.max(0, Math.min(1, rewardWeight)) *
    earlyMult *
    holdMult *
    logisticsDropMult(state) *
    foundryPartDropMult(state) *
    fragmentChanceMult(state) *
    (1 + computeSignalCoreBonuses(state).drop) *
    (1 +
      matterShopDropBonus(state.prestige.matterShop) +
      challengeShopDropBonus(state.prestige.shop))
  let rolls = 1
  if (unit.isBoss) {
    chance = Math.min(1, chance * (table.bossChanceMult ?? 2))
    rolls = table.bossRolls ?? 2
  } else {
    if (earlyMult >= 2.15) rolls += 1
    chance = Math.min(1, chance)
  }

  const results: PartDropResult[] = []
  for (let i = 0; i < rolls; i++) {
    if (rng() > chance) continue
    const focusId = trackedEligible
      ? null
      : discoveryFocusPrint(state, unit.family, state.combat.sector)
    const progressId = trackedEligible ? trackedId : focusId
    const dropProgress = progressId ? blueprintProgress(state, progressId) : null
    const entry = pickWeightedDropEntry(unit.family, state.combat.sector, rng, {
      trackedModuleId: trackedEligible ? trackedId : null,
      focusModuleId: focusId,
      owned: dropProgress?.owned,
      need: dropProgress?.need,
    })
    if (!entry) continue
    const id = partId(entry.moduleId, entry.partType)
    state.parts = {
      ...state.parts,
      [id]: (state.parts[id] ?? 0) + 1,
    }
    let discovered = false
    if (!state.meta.discoveredModules.includes(entry.moduleId)) {
      state.meta.discoveredModules = [
        ...state.meta.discoveredModules,
        entry.moduleId,
      ]
      discovered = true
    }
    const progress = blueprintProgress(state, entry.moduleId)
    const totals = blueprintFragmentTotals(progress?.owned, progress?.need)
    const partHave = progress?.owned[entry.partType] ?? 1
    const partNeed = progress?.need[entry.partType] ?? 1
    const modName = getModule(entry.moduleId)?.name ?? entry.moduleId
    const partLabel =
      entry.partType.charAt(0).toUpperCase() + entry.partType.slice(1)
    state.combat.log = [
      `${modName} · ${partLabel} ${Math.min(partHave, partNeed)}/${partNeed}`,
      ...state.combat.log,
    ].slice(0, 40)
    state.combat.fragmentNotice = {
      moduleId: entry.moduleId,
      partType: entry.partType,
      name: modName,
      partHave,
      partNeed,
      totalHave: totals.have,
      totalNeed: totals.need,
      seq: (state.combat.fragmentNotice?.seq ?? 0) + 1,
    }
    results.push({
      partId: id,
      moduleId: entry.moduleId,
      partType: entry.partType,
      discovered,
    })
  }
  return results
}

export function sectorCanDropPrint(
  sector: number,
  moduleId: string,
  route: SectorRoute | string = 'A',
): boolean {
  for (let wave = 1; wave <= wavesForSector(sector); wave++) {
    const encounter = enemyForSector(sector, wave, route)
    if (familyCanDropPrint(encounter.family, moduleId, sector)) return true
    if (encounter.units.some((unit) => familyCanDropPrint(unit.family, moduleId, sector))) {
      return true
    }
  }
  return false
}

function fittedSalvageKillMult(state: GameState): number {
  let add = 0
  for (const id of state.shipyard.modules) {
    add += getModule(id)?.salvageKillBonus ?? 0
    add += combinedCoreMods(state, id).salvageKillAdd
  }
  return 1 + add
}

export function grantEnemyKillRewards(state: GameState, unit: CombatUnit): void {
  if (unit.side !== 'enemy') return
  noteSortieKill(state)
  recordPlaytest(state, 'first_kill', { firstKey: 'kill' })
  const rewardWeight = Math.max(0, Math.min(1, unit.rewardWeight ?? 1))
  const salvageMult =
    reliquarySalvageMult(state) *
    hiveResearchSalvageMult(state) *
    foundrySalvageMult(state) *
    furnaceSalvageMult(state) *
    yardSalvageMult(state) *
    echoSalvageMult(state) *
    specialistSalvageMult(state) *
    capitalSalvageMult(state) *
    fittedSalvageKillMult(state) *
    processSalvageMult(state) *
    salvageKillMult(state) *
    frameSalvageMult(state)
  state.resources.salvage +=
    salvageFromKill(state.combat.sector, unit.isBoss, state.combat.route, state) * salvageMult * rewardWeight
  const scrap = scrapKillBonus(state, unit.isBoss) * rewardWeight
  if (scrap > 0) state.resources.scrap += scrap
  rollEnemyPartDrop(state, unit, Math.random, rewardWeight)
  // Wing enemies exist to make formations richer, not to multiply the economy.
  // Continuous XP scales directly; discrete loot uses the same expected-value weight.
  const discreteLoot = rewardWeight >= 1 || Math.random() < rewardWeight
  if (discreteLoot) {
    grantSignalCoreDrop(state, 'kill', { family: unit.family })
    grantReliquaryKillLoot(
      state,
      unit.isBoss,
      Math.random,
      hiveResearchShardDropBonus(state) + foundryShardDropBonus(state),
    )
    grantFurnaceKillLoot(state, unit.isBoss)
  }
  grantHiveResearchKillXp(
    state,
    unit.isBoss,
    furnaceResearchXpMult(state) * reliquaryResearchXpMult(state) * rewardWeight,
  )
}

function tryLootEnemyKill(
  state: GameState,
  unit: CombatUnit,
  prevHull: number,
): void {
  if (unit.side !== 'enemy') return
  if (prevHull > 0 && unit.hull <= 0) {
    grantEnemyKillRewards(state, unit)
  }
}

function applyDamageToUnit(
  target: CombatUnit,
  rawDamage: number,
  tags: WeaponTag[],
  profile?: WeaponDamageProfile,
): number {
  if (target.untargetable || target.isCore) return 0
  const vs = profile ?? weaponDamageProfile(tags)
  let remaining = rawDamage * target.damageTakenMult

  if (tags.includes('antiShield') && target.shield > 0) {
    remaining *= 1.5
  }

  let dealt = 0
  if (target.shield > 0 && remaining > 0) {
    const shieldHit = remaining * vs.shieldDamage
    const toShield = Math.min(target.shield, Math.max(0, shieldHit))
    target.shield -= toShield
    dealt += toShield
    target.regenDelay = Math.max(target.regenDelay ?? 0, SHIELD_REGEN_DELAY)
    // Shield layer absorbs the whole hit. Leftover does not spill into hull
    // until a later projectile finds the shield already empty.
    return dealt
  }

  if (remaining > 0 && target.hull > 0) {
    const armored = target.family === 'armored'
    let hullHit = remaining * (armored ? vs.armorDamage : vs.hullDamage)
    let armor = target.armor
    if (tags.includes('pierce')) armor *= 0.5
    // USI armour HP already uses the 0.25× multiplier; don't also subtract.
    if (armored && vs.armorDamage < 1) armor = 0
    hullHit = Math.max(1, hullHit - armor)
    const toHull = Math.min(target.hull, hullHit)
    target.hull -= toHull
    dealt += toHull
    target.regenDelay = Math.max(target.regenDelay ?? 0, SHIELD_REGEN_DELAY)
  }
  return dealt
}

function noteCombatHit(
  state: GameState,
  side: 'player' | 'enemy',
  target: CombatUnit,
  dealt: number,
  shieldBefore: number,
  role?: CombatUnit['role'],
): void {
  if (dealt <= 0) return
  if (side === 'player' && target.side === 'enemy') {
    noteSortieOutgoing(state, dealt)
    return
  }
  if (side === 'enemy' && target.side === 'player' && target.isFlagship) {
    noteSortieIncoming(state, dealt, {
      shieldBefore,
      shieldAfter: target.shield,
      role,
    })
  }
}

/** Test helper — same rules as live projectile impact. */
export function dealCombatDamage(
  target: CombatUnit,
  rawDamage: number,
  tags: WeaponTag[] = ['energy'],
  profile?: WeaponDamageProfile,
): number {
  return applyDamageToUnit(target, rawDamage, tags, profile)
}

function incomingDefenseMult(
  target: CombatUnit,
  attackerFamily: string,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
): number {
  if (target.side !== 'player') return 1
  let mult = 1
  if (attackerFamily === 'swarm' && roles.defense > 0) {
    mult *= Math.pow(0.88, roles.defense * matchupScale)
  }
  if ((attackerFamily === 'titan' || attackerFamily === 'armored') && target.isFlagship) {
    if (roles.defense === 0) mult *= 1.15
    else mult *= Math.pow(0.94, roles.defense)
  }
  return mult
}

function hitLayer(shieldBefore: number, hullBefore: number, target: CombatUnit): 'hull' | 'shield' {
  if (shieldBefore > 0 && target.shield < shieldBefore - 1e-6 && target.hull >= hullBefore - 1e-6) {
    return 'shield'
  }
  return 'hull'
}

function pushHitFx(
  hits: CombatFx[],
  fromId: string,
  toId: string,
  tag: string,
  opts: { amount?: number; hit?: CombatFx['hit']; ttl: number },
): void {
  fxGlobalSeq += 1
  hits.push({
    id: `fx-${fxGlobalSeq}`,
    fromId,
    toId,
    tag,
    ttl: opts.ttl,
    amount: opts.amount,
    hit: opts.hit,
  })
}

function findUnit(state: GameState, id: string): CombatUnit | undefined {
  return (
    state.combat.playerUnits.find((u) => u.id === id) ??
    state.combat.enemyUnits.find((u) => u.id === id)
  )
}

function tunePlayerShot(
  state: GameState,
  from: CombatUnit,
  damage: number,
  profile: { hullDamage: number; shieldDamage: number; armorDamage: number },
): { damage: number; profile: { hullDamage: number; shieldDamage: number; armorDamage: number } } {
  if (from.side !== 'player') return { damage, profile }
  const crit = Math.random() < critChance(state)
  return {
    damage: crit ? damage * 1.5 : damage,
    profile: { ...profile, armorDamage: profile.armorDamage + armorPenAdd(state) },
  }
}

function spawnProjectile(
  state: GameState,
  from: CombatUnit,
  to: CombatUnit,
  damage: number,
  weapon: WeaponInstance,
): void {
  const tag = weapon.tags[0] ?? 'kinetic'
  const tuned = tunePlayerShot(state, from, damage, weaponDamageProfile(weapon.tags, weapon))
  projGlobalSeq += 1
  state.combat.projectiles.push({
    id: `proj-${projGlobalSeq}`,
    fromId: from.id,
    toId: to.id,
    side: from.side,
    tag,
    x: from.x,
    y: from.y,
    damage: tuned.damage,
    tags: [...weapon.tags],
    dotDuration: weapon.dotDuration,
    dotDamage: weapon.dotDamage,
    speed: projectileSpeedForDelivery(weapon.delivery),
    attackerFamily: from.family,
    delivery: weapon.delivery,
    originX: from.x,
    originY: from.y,
    attackerRole: from.role,
    heading: from.side === 'player' ? (to.heading ?? 0) : (from.heading ?? 0),
    weaponId: weapon.id,
    ...tuned.profile,
  })
}

function spawnBeam(
  state: GameState,
  from: CombatUnit,
  to: CombatUnit,
  damage: number,
  weapon: WeaponInstance,
): void {
  const tuned = tunePlayerShot(state, from, damage, weaponDamageProfile(weapon.tags, weapon))
  beamGlobalSeq += 1
  if (!state.combat.beams) state.combat.beams = []
  state.combat.beams.push({
    id: `beam-${beamGlobalSeq}`,
    fromId: from.id,
    toId: to.id,
    side: from.side,
    tag: weapon.tags[0] ?? 'energy',
    tags: [...weapon.tags],
    remaining: BEAM_DURATION,
    duration: BEAM_DURATION,
    damage: tuned.damage,
    attackerFamily: from.family,
    attackerRole: from.role,
    heading: from.side === 'player' ? (to.heading ?? 0) : (from.heading ?? 0),
    weaponId: weapon.id,
    ...tuned.profile,
  })
}

function tickBeams(
  state: GameState,
  dt: number,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
): CombatFx[] {
  const hits: CombatFx[] = []
  if (!state.combat.beams?.length) return hits
  const kept: CombatBeam[] = []
  for (const beam of state.combat.beams) {
    const from = findUnit(state, beam.fromId)
    const target = findUnit(state, beam.toId)
    if (!from || (from.hull <= 0 && !from.isCore) || !target || target.hull <= 0) continue
    const slice = Math.min(dt, beam.remaining)
    if (slice <= 0) continue
    let dmg = beam.damage * (slice / beam.duration)
    if (beam.side !== 'player') {
      dmg *= incomingDefenseMult(target, beam.attackerFamily, roles, matchupScale)
    }
    const prevHull = target.hull
    const shieldBefore = target.shield
    const dealt = applyDamageToUnit(target, dmg, beam.tags, {
      hullDamage: beam.hullDamage ?? 1,
      shieldDamage: beam.shieldDamage ?? 1,
      armorDamage: beam.armorDamage ?? 0.25,
    })
    noteCombatHit(state, beam.side, target, dealt, shieldBefore, from.role ?? beam.attackerRole)
    tryLootEnemyKill(state, target, prevHull)
    beam.popupAcc = (beam.popupAcc ?? 0) + dealt
    beam.popupT = (beam.popupT ?? 0) + slice
    const beamDone = beam.remaining - slice <= 1e-4 || target.hull <= 0
    if ((beam.popupT >= 0.16 || beamDone) && (beam.popupAcc ?? 0) >= 0.4) {
      pushHitFx(hits, beam.fromId, beam.toId, beam.tag, {
        amount: beam.popupAcc,
        hit: hitLayer(shieldBefore, prevHull, target),
        ttl: 0.35,
      })
      beam.popupAcc = 0
      beam.popupT = 0
    }
    beam.remaining -= slice
    if (beam.remaining > 1e-4 && target.hull > 0) kept.push(beam)
  }
  state.combat.beams = kept.slice(-24)
  return hits
}

/** Advance in-flight shots; damage applies only on impact. */
function updateProjectiles(
  state: GameState,
  dt: number,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
): CombatFx[] {
  const hits: CombatFx[] = []
  const kept: CombatProjectile[] = []

  for (const shot of state.combat.projectiles) {
    const target = findUnit(state, shot.toId)
    if (!target || target.hull <= 0) {
      // Target gone — dissipate
      continue
    }

    const dx = target.x - shot.x
    const dy = target.y - shot.y
    const dist = Math.hypot(dx, dy)
    const step = shot.speed * dt

    if (dist <= Math.max(3, step)) {
      // Impact
      if (target.evasion > 0 && Math.random() < target.evasion) {
        pushHitFx(hits, shot.fromId, shot.toId, 'miss', { hit: 'miss', ttl: 0.35 })
        continue
      }

      let dmg = shot.damage
      if (shot.side !== 'player') {
        dmg *= incomingDefenseMult(target, shot.attackerFamily, roles, matchupScale)
      }
      const prevHull = target.hull
      const shieldBefore = target.shield
      const dealt = applyDamageToUnit(target, dmg, shot.tags, {
        hullDamage: shot.hullDamage ?? 1,
        shieldDamage: shot.shieldDamage ?? 1,
        armorDamage: shot.armorDamage ?? 0.25,
      })
      noteCombatHit(state, shot.side, target, dealt, shieldBefore, shot.attackerRole)
      tryLootEnemyKill(state, target, prevHull)
      if (shot.dotDuration > 0 && shot.dotDamage > 0) {
        target.dots.push({ dps: shot.dotDamage, remaining: shot.dotDuration })
      }
      pushHitFx(hits, shot.fromId, shot.toId, shot.tag, {
        amount: dealt,
        hit: hitLayer(shieldBefore, prevHull, target),
        ttl: 0.55,
      })
      continue
    }

    shot.x += (dx / dist) * step
    shot.y += (dy / dist) * step
    kept.push(shot)
  }

  state.combat.projectiles = kept.slice(-80)
  return hits
}

/**
 * Continuous combat step (real seconds, not ticks).
 * Weapons only fire when a living target is inside weapon.range.
 * Damage is deferred until projectiles impact.
 */
export function simulateCombat(
  state: GameState,
  dt: number,
  pushLog: (state: GameState, line: string) => void,
): void {
  if (dt <= 0) return
  maybeSampleSortieEnemies(state)
  const roles = fittedRoles(state)
  const matchupScale =
    1 +
    challengeShopMatchupBonus(state.prestige.shop) +
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup
  const focusFire = aiDoctrinesActive(state, 'focus-fire') || hiveResearchFocusFire(state)
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')

  moveUnits(state, dt)
  tickBossSupportAura(state, dt)

  const masteryRegen = state.shipyard.modules.reduce(
    (n, id) => n + combinedCoreMods(state, id).regenAdd,
    0,
  )
  const regenFrac =
    (fittedShieldRegenFraction(state.shipyard.modules) +
      fittedRegenBonus(state) +
      masteryRegen +
      shopShieldRegen(state)) *
    directiveShieldRegenMult(state)
  for (const unit of state.combat.playerUnits) {
    if ((unit.regenDelay ?? 0) > 0) {
      unit.regenDelay = Math.max(0, (unit.regenDelay ?? 0) - dt)
    }
    if (regenFrac <= 0 || (unit.regenDelay ?? 0) > 0) continue
    if (unit.hull <= 0 || unit.shieldMax <= 0) continue
    unit.shield = Math.min(unit.shieldMax, unit.shield + unit.shieldMax * regenFrac * dt)
  }

  // Resolve in-flight impacts first so hull updates before new targeting
  const hitFx = [
    ...updateProjectiles(state, dt, roles, matchupScale),
    ...tickBeams(state, dt, roles, matchupScale),
  ]

  const sides: Array<'player' | 'enemy'> = ['player', 'enemy']
  for (const side of sides) {
    const allies = side === 'player' ? state.combat.playerUnits : state.combat.enemyUnits
    const foes = side === 'player' ? state.combat.enemyUnits : state.combat.playerUnits

    for (const unit of allies) {
      if (unit.hull <= 0 && !unit.isCore) continue

      const prevHull = unit.hull
      for (const dot of unit.dots) {
        if (dot.remaining <= 0) continue
        const tick = dot.dps * dt
        const shieldBefore = unit.shield
        const hullBefore = unit.hull
        if (unit.shield > 0) {
          unit.shield = Math.max(0, unit.shield - tick)
          unit.regenDelay = Math.max(unit.regenDelay ?? 0, SHIELD_REGEN_DELAY)
        } else {
          unit.hull = Math.max(0, unit.hull - tick)
        }
        const dealt =
          shieldBefore > 0 ? shieldBefore - unit.shield : hullBefore - unit.hull
        if (unit.side === 'player' && unit.isFlagship) {
          noteSortieIncoming(state, dealt, {
            shieldBefore,
            shieldAfter: unit.shield,
          })
        } else if (unit.side === 'enemy') {
          noteSortieOutgoing(state, dealt)
        }
        dot.remaining -= dt
      }
      unit.dots = unit.dots.filter((d) => d.remaining > 0)
      tryLootEnemyKill(state, unit, prevHull)
      if (unit.hull <= 0 && !unit.isCore) continue

      if (unit.phaseWarnLeft > 0) {
        unit.phaseWarnLeft = Math.max(0, unit.phaseWarnLeft - dt)
      }

      for (const weapon of unit.weapons) {
        weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt)

        // Finish an active telegraph → fire.
        if (weapon.telegraphLeft > 0) {
          weapon.telegraphLeft = Math.max(0, weapon.telegraphLeft - dt)
          if (weapon.telegraphToId) {
            const locked = findUnit(state, weapon.telegraphToId)
            if (!locked || locked.hull <= 0) {
              const next = pickTarget(unit, foes, weapon, focusFire && side === 'player')
              weapon.telegraphToId = next?.id
            }
          }
          if (weapon.telegraphLeft > 0) continue
        } else if (weapon.cooldownLeft > 0) {
          continue
        } else if (weapon.telegraphDuration > 0) {
          // Begin wind-up instead of firing immediately.
          const windupTarget = pickTarget(unit, foes, weapon, focusFire && side === 'player')
          if (!windupTarget) continue
          weapon.telegraphLeft = weapon.telegraphDuration
          weapon.telegraphToId = windupTarget.id
          continue
        }

        const locked =
          weapon.telegraphToId ? findUnit(state, weapon.telegraphToId) : undefined
        weapon.telegraphToId = undefined
        const primary =
          locked && locked.hull > 0 && laneDistance(unit, locked) <= weapon.range + 0.5
            ? locked
            : pickTarget(unit, foes, weapon, focusFire && side === 'player')
        if (!primary) continue

        const targets: CombatUnit[] = [primary]
        if (weapon.splash > 0 || weapon.tags.includes('splash')) {
          const extras = foes
            .filter(
              (u) =>
                u.hull > 0 &&
                u.id !== primary.id &&
                laneDistance(unit, u) <= weapon.range + 0.5,
            )
            .sort((a, b) => laneDistance(unit, a) - laneDistance(unit, b))
            .slice(0, weapon.splash || 1)
          targets.push(...extras)
        }

        let fired = false
        for (const target of targets) {
          if (target.hull <= 0) continue

          let dmg = weapon.damage
          if (side === 'player') {
            dmg *= matchupMultiplier(
              weapon.tags,
              target,
              roles,
              matchupScale,
              bossProtocol,
            )
          }
          // Enemy defense mult applied on impact (uses current roles)

          if (weapon.delivery === 'beam') {
            spawnBeam(state, unit, target, dmg, weapon)
          } else {
            spawnProjectile(state, unit, target, dmg, weapon)
          }
          fired = true
        }

        if (fired) weapon.cooldownLeft = weapon.cooldown
      }
    }
  }

  state.combat.fx = [...hitFx, ...state.combat.fx.map((f) => ({ ...f, ttl: f.ttl - dt }))]
    .filter((f) => f.ttl > 0)
    .slice(0, 96)

  maybeAdvanceBossPhase(state, pushLog)
  syncHullAggregates(state)
}

/** @deprecated use simulateCombat — kept for tests that step one second. */
export function resolveCombatTick(
  state: GameState,
  pushLog: (state: GameState, line: string) => void,
): void {
  simulateCombat(state, 1, pushLog)
}

export function totalEnemyHull(encounter: SectorEncounter): number {
  return encounter.units.reduce((s, u) => s + u.hullMax, 0)
}

/** Estimated Hold-farm payout for one full sector clear (all waves + drips). */
export function estimateHoldClearRewards(state: GameState): {
  scrap: number
  data: number
  salvage: number
} {
  const sector = state.combat.sector
  const clear = enemyForSector(sector, wavesForSector(sector))
  let scrap = clear.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrap *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrap *= 1.25
  scrap *= 1 + matterShopScrapBonus(state.prestige.matterShop)

  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  const siphon =
    essenceBonusDataPerClear(state.essence.purchased) +
    matterShopDataPerClear(state.prestige.matterShop)
  const data =
    dataBlocked || !isSystemUnlocked(state, 'research') ? 0 : clear.dataReward + siphon
  let salvage = 0
  for (let w = 1; w <= wavesForSector(sector); w += 1) {
    const wave = enemyForSector(sector, w)
    for (const unit of wave.units) {
      salvage += salvageFromKill(sector, unit.isBoss, state.combat.route, state)
    }
  }

  // Mid-wave scrap drips for waves 1..(n-1)
  for (let w = 1; w < wavesForSector(sector); w += 1) {
    scrap += 1 + Math.floor(sector / 4)
  }

  return { scrap, data, salvage }
}

/**
 * Hold Accountant rates: clear rewards ÷ estimated clear time from fleet DPS vs wave hull.
 */
export function estimateHoldFarmRates(state: GameState): {
  scrapPerSec: number
  dataPerSec: number
  salvagePerSec: number
  scrapPerClear: number
  clearSeconds: number
} {
  const rewards = estimateHoldClearRewards(state)
  const dps = Math.max(1, computeShipStats(state).damage)
  let hullTotal = 0
  for (let w = 1; w <= wavesForSector(state.combat.sector); w += 1) {
    hullTotal += totalEnemyHull(enemyForSector(state.combat.sector, w))
  }
  // Floor keeps early sectors from reporting absurd r/s when packs die instantly.
  const clearSeconds = Math.max(8, hullTotal / dps)
  return {
    scrapPerSec: rewards.scrap / clearSeconds,
    dataPerSec: rewards.data / clearSeconds,
    salvagePerSec: rewards.salvage / clearSeconds,
    scrapPerClear: rewards.scrap,
    clearSeconds,
  }
}
