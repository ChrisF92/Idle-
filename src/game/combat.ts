/** Fleet combat: ranged approach, cooldowns, bosses, salvage drops. */

import type {
  CombatBeam,
  CombatFx,
  CombatProjectile,
  CombatUnit,
  EnemyRole,
  GameState,
  UnitShape,
  WeaponDelivery,
  WeaponInstance,
  WeaponTag,
} from './types'
import {
  aiDoctrinesActive,
  challengeShopDropBonus,
  challengeShopMatchupBonus,
  challengeStackRepairBonus,
  getModule,
  fittedShieldRegenFraction,
  stationRepairBonus,
  ENEMY_PARK_MAX,
  SHORT_RANGE_MAX,
  frameSalvageMult,
} from './catalog'
import {
  blueprintFragmentCount,
  canDropBlueprintFragment,
  canTrackBlueprint,
  eligibleFragmentBlueprints,
  getBlueprint,
  grantBlueprintFragment,
  isBlueprintDiscovered,
} from './blueprints'
import { rollDirectMaterialRecovery } from './foundryRecovery'
import { FRAGMENT_DROP_BOSS_MULT, FRAGMENT_DROP_CHANCE } from './foundrySeeds'
import { isSystemUnlocked } from './progression'
import { buildCoreWeapon, buildFlagshipWeapons, computeShipStats } from './state'
import {
  applyHeavyArmorFracture,
  applyPhaseExposure,
  choirTapOnHighValueKill,
  effectiveEnemyArmor,
  flakSplashCount,
  FLAK_DETONATION_RADIUS,
  HEAVY_PEN_MOMENTUM,
  HEAVY_SHIELD_BYPASS,
  interceptEnemyProjectile,
  mitigateIncomingToHive,
  nextEnemyAlongHeading,
  PHASE_REFRACTION_FRACTION,
  phaseExposureTakenMult,
  phaseRampAtMax,
  phaseRampBypassFrac,
  phaseRampMultiplier,
  pulseChainHops,
  pulseChainTarget,
  pulseOverkillHop,
  salvageMarkBonus,
  spawnMoltenPool,
  tickSupportCores,
  tryBarrierIntercept,
  updatePhaseRamp,
} from './coreCombat'
import { hasMasteryEffect } from './coreMastery'
import {
  gddEnemyBandForWave,
  isCommanderCandidateWave,
  type GddEnemyBandId,
} from './waves'
import { coreInstanceAtSlot } from './coreInstances'
import {
  coreIsBeaming,
  densestLegalFlakCluster,
  effectiveChargeDurationSec,
  effectiveCoreFireRange,
  emptyTargetingTelemetry,
  firingSolution,
  isTargetableEnemy,
  noteCoreFiring,
  noteCoreShotFired,
  noteShotHeld,
  playerCoreTarget,
  profileForCore,
  tickPlayerCoreTargeting,
} from './coreTargeting'
import { applyPlayerCoreOrbit, TYPICAL_SPAWN_RADIUS, bearingBetween, coreWorldPosition, distanceBetween, distanceToHive, moveRadially } from './geometry'
import { formationRngFor, formationSlots, pickFormation, type FormationContext } from './formations'
import { createSimRng, rngNext, type SimRngState } from './simRng'
import {
  measureThreatRoll,
  threatSpecForWave,
  varyPackToBudget,
} from './threatBudget'
import { nextCombatId } from './waveRuntime'
import {
  armorPenAdd,
  critChance,
  critFactor,
  fragmentChanceMult,
  salvageKillMult,
  scrapKillBonus,
  shopHullRepair,
  shopShieldRegen,
} from './workshop'
import { combatScrapMatterMult } from './matter'
import { grantGeneratedScrap } from './rebuild'
import {
  logisticsDropMult,
  reactorsRepairMult,
  sensorsMatchupBonus,
} from './core'
import { computeSignalCoreBonuses, grantSignalCoreDrop } from './signalCores'
import { combinedCoreMods } from './coreProgression'
import { grantFurnaceKillLoot, furnaceResearchXpMult, furnaceSalvageMult } from './furnace'
import {
  grantHiveResearchKillXp,
  hiveResearchSalvageMult,
} from './hiveResearch'
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

export interface WaveEncounter {
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

/** Typical spawn radius ahead of the Hive. Canonical seed ~300. */
export const SPAWN_DISTANCE = TYPICAL_SPAWN_RADIUS

/**
 * Closest legal park. Must sit outside the Hive body (~22) plus the heaviest
 * Core orbit (44) so closers do not stack on the drones. When the equipped
 * weapon cap is shorter than this (Flak / Knife Fight), the cap wins.
 */
export const HIVE_STANDOFF_MIN = 72

/**
 * USI Laser Cannon: range 600, projectile speed 700.
 * Map USI space-units onto the radial spawn radius (~300).
 */
export const USI_SPACE_TO_LANE = SPAWN_DISTANCE / 600

/** Simulation-units / second for all normal projectiles (player + enemy). */
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

function combatRng(state: GameState): number {
  if (!state.combat.rng) state.combat.rng = createSimRng(state.combat.sortieSeed || 1)
  return rngNext(state.combat.rng)
}

function liveWave(state: GameState): number {
  return Math.max(1, state.combat.waveReached || state.combat.wave || 1)
}

/** Kill economics/drop eligibility Wave. Malformed/dev units fall back to Wave 1. */
export function rewardWaveOf(unit: { sourceWave?: number }): number {
  const w = Number(unit.sourceWave)
  if (Number.isFinite(w) && w >= 1) return Math.floor(w)
  return 1
}

/**
 * Salvage per kill. W1 trash = 1 so the first Pulse rank (cost 3) lands
 * after the opening pack. Canonical reward scale seed 1.0065^(Wave-1).
 */
export function salvageWaveBase(wave: number): number {
  const w = Math.max(1, wave)
  return Math.pow(1.0065, w - 1)
}

export function salvageFromKill(
  wave: number,
  isBoss: boolean,
  _route?: string,
  state?: GameState,
): number {
  if (state && protocolMutes(state, 'salvage')) return 0
  const exp = 1 + (state ? protocolModifiers(state).salvageSectorExpAdd : 0)
  const raw = (isBoss ? 5 : 1) * Math.pow(salvageWaveBase(wave), exp)
  return Math.max(1, Math.floor(raw))
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
    id: `draft-e-${family}`,
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
        `draft-ew-${family}`,
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
    x: opts.x ?? 0,
    y: opts.y ?? TYPICAL_SPAWN_RADIUS,
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
  if (s <= 18) return 5
  return 6
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
  if (sector <= 18) return 0.22
  return 0.28
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
      id: `draft-e-${source.family}-wing-${wing}`,
      name: `${source.name} Wing ${wing}`,
      hull: hullMax,
      hullMax,
      shield: shieldMax,
      shieldMax,
      armor: source.armor * 0.55,
      weapons: source.weapons.map((weapon) => ({
        ...weapon,
        id: `draft-ew-wing-${wing}`,
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
  if (boss) return 'titan'
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
  }
}

function packPatternForBand(band: GddEnemyBandId, wave: number): 0 | 1 | 2 | 3 | 4 {
  const local = ((Math.max(1, Math.floor(wave)) - 1) % 10) + 1
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
    case 'support':
      return 0
    case 'sniper':
      return 1
  }
}

function applyWaveFormation(
  units: CombatUnit[],
  wave: number,
  rng: SimRngState,
  packageId: string,
): void {
  if (units.length === 0) return
  const ctx: FormationContext = { rng, wave, packageId }
  const formation = pickFormation(ctx)
  const slots = formationSlots(formation, units.length, ctx)
  units.forEach((unit, i) => {
    const slot = slots[i] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })
}

/** Procedural encounter for a global Sortie Wave. Proper Bosses use the Boss provider. */
export function encounterForWave(wave: number, extraDanger = 1, state?: GameState): WaveEncounter {
  const w = Math.max(1, Math.floor(wave))
  const family = primaryFamilyForWave(w, false)
  const names = NAMES[family]
  const name = names[(w - 1) % names.length] ?? 'Unknown Entity'
  const waveScale = extraDanger
  const pattern = packPatternForBand(gddEnemyBandForWave(w), w)
  let units = buildWavePack(w, family, name, waveScale, pattern)
  units = densifyEncounter(units, w, false)
  const seed = state?.combat.sortieSeed ?? 0
  const spec = threatSpecForWave(w)
  const varied = varyPackToBudget(units, spec, seed)
  units = varied.units
  const density = state ? directiveDensityMult(state) * protocolEnemyDensityMult(state) : 1
  if (density > 1 && units.length > 0) {
    const extra = Math.max(1, Math.round(units.length * (density - 1)))
    for (let i = 0; i < extra; i++) {
      const src = units[i % units.length]!
      units.push({ ...structuredClone(src), id: `${src.id}-pack${i}` })
    }
  }
  const packageOrdinal = (state?.combat.packages.length ?? 0) + 1
  const rng = formationRngFor(seed, w, packageOrdinal)
  applyWaveFormation(units, w, rng, `w${w}`)
  const commander = isCommanderCandidateWave(w)
  return {
    id: `w${w}-${family}`,
    name: commander ? `${name} (Commander contact)` : `${name} pack (W${w})`,
    family,
    tags: commander ? [family, 'commander'] : [family],
    isBoss: false,
    scrapReward: 5 + Math.floor(w / 5),
    dataReward: 1 + Math.floor(w / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: salvageFromKill(w, false, undefined, state),
    blurb: familyBlurb(family, false),
    units,
    threat: measureThreatRoll(units, seed, spec.budget, varied.elite),
  }
}

/**
 * Piecewise enemy scaling aligned with Act 1 doors.
 *
 * S1 stays on tutorial hull (2-shot mites). S2–S3 grow slower so early
 * Best Δ can land at +2–4. S4–S8 steepen so W40–W80 is the wall that
 * teaches Plate. S9–S18 grow slower so later bands are bumps, not cliffs.
 * S19+ steepens again toward Challenges.
 */
export const ENEMY_EARLY_SECTOR = 8
export const ENEMY_MID_SECTOR = 18
/** S1–S3 opening. S1 uses base only; S2–S3 grow slower so early Best Δ can land. */
export const ENEMY_OPENING_SECTOR = 3

export const ENEMY_HULL_BASE = 1.55
/** Per-band hull growth for S2–S3. S1 mites stay 2-shot (base × mite HP). */
export const ENEMY_HULL_OPENING = 1.2
/** Per-band hull growth for S4–S8. Steeper than the opening so W40–W80 is the wall. */
export const ENEMY_HULL_EARLY = 1.3
export const ENEMY_HULL_MID = 1.2
export const ENEMY_HULL_LATE = 1.215

export const ENEMY_DMG_BASE = 0.9
export const ENEMY_DMG_OPENING = 1.22
export const ENEMY_DMG_EARLY = 1.28
export const ENEMY_DMG_MID = 1.16
export const ENEMY_DMG_LATE = 1.225

/** Extra hull/damage per Wave inside a 10-wave band. */
export const ENEMY_WAVE_HULL_RAMP = 0.06

/** Mid-band Salvage income exponent after band 4. S1–S4 stay linear. */
export const SALVAGE_MID_EXPONENT = 0.5

export function enemyWaveScale(wave: number): number {
  return Math.pow(1.011, Math.max(1, wave) - 1)
}

export function enemyDamageScale(wave: number): number {
  return Math.pow(1.0085, Math.max(1, wave) - 1)
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
  const hullScale = enemyWaveScale(sector) * waveScale
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

function familyBlurb(family: EnemyFamily, boss: boolean): string {
  if (boss) {
    return 'Authored Boss encounter. Mechanics come from the Boss provider.'
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
      return 'Authored Boss. The provider supplies the encounter.'
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
      return 'Soft counter: Defense + Ablative Mesh; pierce helps against heavy hull.'
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

export interface WaveRosterEntry {
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
  WaveRosterEntry,
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

/** Unique enemy types for a Wave (Codex/intel). */
export function waveRoster(wave: number): WaveRosterEntry[] {
  const groups = new Map<string, WaveRosterEntry>()
  const encounter = encounterForWave(wave)
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
  return [...groups.values()]
}

function preserveWeaponCooldowns(prev: CombatUnit[], next: CombatUnit[]): void {
  for (const unit of next) {
    const old =
      prev.find((u) => u.id === unit.id) ??
      (unit.coreInstanceId ? prev.find((u) => u.coreInstanceId === unit.coreInstanceId) : undefined) ??
      (unit.coreSlot != null ? prev.find((u) => u.coreSlot === unit.coreSlot) : undefined)
    if (!old) continue
    unit.weapons = unit.weapons.map((weapon) => {
      const prior = old.weapons.find((pw) => pw.id === weapon.id)
      return prior
        ? {
            ...weapon,
            cooldownLeft: prior.cooldownLeft,
            telegraphLeft: prior.telegraphLeft,
            telegraphToId: prior.telegraphToId,
            telegraphDuration: prior.telegraphDuration,
            chargeReady: prior.chargeReady,
          }
        : weapon
    })
    if (unit.isCore) {
      unit.orbitAngle = old.orbitAngle ?? unit.orbitAngle
      applyPlayerCoreOrbit(unit)
      unit.currentTargetId = old.currentTargetId
      unit.targetLockTime = old.targetLockTime
      unit.nextTargetEvalAt = old.nextTargetEvalAt
      unit.heldShotNoted = old.heldShotNoted
      unit.targetingTelemetry = old.targetingTelemetry
        ? { ...old.targetingTelemetry }
        : unit.targetingTelemetry
      syncCoreWorldPosition(unit)
    }
  }
}

export function buildCoreSatellite(state: GameState, slot: number, index: number, count: number): CombatUnit | null {
  const moduleId = state.shipyard.modules[slot]
  const mod = getModule(moduleId)
  if (!mod) return null
  const weapon = buildCoreWeapon(state, slot)
  const instance = coreInstanceAtSlot(state, slot)
  const orbit = mod.orbitRadius
  const orbitAngle = count > 0 ? (index / count) * Math.PI * 2 : 0
  const pos = coreWorldPosition(orbit, orbitAngle)
  return {
    id: instance?.id ?? `core-${slot}`,
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
    weapons: weapon ? [weapon] : [],
    isBoss: false,
    isFlagship: false,
    isCore: true,
    coreModuleId: moduleId,
    coreSlot: slot,
    coreInstanceId: instance?.id,
    untargetable: true,
    dots: [],
    x: pos.x,
    y: pos.y,
    orbitAngle,
    heading: orbitAngle,
    orbitRadius: orbit,
    currentTargetId: undefined,
    targetLockTime: 0,
    nextTargetEvalAt: 0,
    targetingTelemetry: emptyTargetingTelemetry(),
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

  const slots = state.shipyard.modules.map((_, slot) => slot)
  const cores = slots
    .map((slot, index) => buildCoreSatellite(state, slot, index, slots.length))
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
      : encounterForWave(liveWave(state)).units
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

export function matchupHintForWave(wave: number, fittedModuleIds: string[]): string {
  const enemy = encounterForWave(wave)
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

/** Hull points restored per second while Paused (full) or between fights (field rate). */
export function repairRatePerSecond(state: GameState): number {
  let rate = 5
  if (aiDoctrinesActive(state, 'auto-engage')) rate *= 2
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

function combatDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return distanceBetween(a, b)
}

/** Furthest legal park. Loadout does not move this — Knife Fight is the only compress. */
export function hiveParkRangeCap(state?: GameState): number {
  if (state?.prestige.activeChallengeId === 'short-range') return SHORT_RANGE_MAX
  return ENEMY_PARK_MAX
}

export function enemyApproachTarget(
  unit: Pick<CombatUnit, 'engageRange'>,
  _fightElapsed = 0,
  _wave = 2,
  state?: GameState,
): number {
  const cap = hiveParkRangeCap(state)
  const floor = Math.min(HIVE_STANDOFF_MIN, cap)
  const preferred = Math.max(0, unit.engageRange)
  return Math.max(floor, Math.min(preferred, cap))
}

function syncCoreWorldPosition(unit: CombatUnit): void {
  if (!unit.isCore || !unit.coreModuleId) return
  applyPlayerCoreOrbit(unit)
}

function moveUnits(state: GameState, dt: number): void {
  for (const unit of state.combat.playerUnits) {
    if (unit.isFlagship) {
      unit.x = 0
      unit.y = 0
      continue
    }
    if (!unit.isCore || !unit.coreModuleId) continue
    applyPlayerCoreOrbit(unit)
  }

  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const target = enemyApproachTarget(unit, state.combat.fightElapsed ?? 0, 0, state)
    const dist = distanceToHive(unit.x, unit.y)
    const slow = unit.controlSlowMult ?? 1
    if (dist > target) {
      const next = moveRadially(unit.x, unit.y, -unit.speed * slow * dt)
      unit.x = next.x
      unit.y = next.y
    } else if (dist < target && unit.kite) {
      const next = moveRadially(unit.x, unit.y, unit.speed * slow * dt * 0.85)
      unit.x = next.x
      unit.y = next.y
    }
  }
}

function pickEnemyTarget(
  attacker: CombatUnit,
  foes: CombatUnit[],
  weapon: WeaponInstance,
): CombatUnit | null {
  const living = foes.filter(
    (u) =>
      u.hull > 0 &&
      !u.untargetable &&
      !u.isCore &&
      (attacker.side !== 'enemy' || u.isFlagship) &&
      combatDistance(attacker, u) <= weapon.range + 0.5,
  )
  if (living.length === 0) return null
  living.sort((a, b) => combatDistance(attacker, a) - combatDistance(attacker, b))
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
  blueprintId: string
  have: number
  need: number
  discovered: boolean
}

/**
 * Roll Blueprint-specific schematic fragments for a slain enemy.
 * RNG accelerates acquisition. It never replaces guaranteed sources and
 * never drops fragments for completed Blueprints.
 */
export function rollEnemyPartDrop(
  state: GameState,
  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name' | 'rewardWeight' | 'sourceWave'>,
  rng: () => number = Math.random,
  rewardWeight = unit.rewardWeight ?? 1,
): PartDropResult[] {
  if (!isSystemUnlocked(state, 'foundry')) return []
  const rewardWave = rewardWaveOf(unit)
  const pool = eligibleFragmentBlueprints(state, rewardWave)
  if (pool.length === 0) return []

  const trackedId = state.foundry?.trackedPrintId ?? null
  const tracked =
    trackedId && canTrackBlueprint(state, trackedId) && pool.some((row) => row.id === trackedId)
      ? trackedId
      : null

  let chance =
    FRAGMENT_DROP_CHANCE *
    Math.max(0, Math.min(1, rewardWeight)) *
    fragmentChanceMult(state) *
    logisticsDropMult(state) *
    (1 + computeSignalCoreBonuses(state).drop) *
    (1 + challengeShopDropBonus(state.prestige.shop))
  let rolls = 1
  if (unit.isBoss) {
    chance = Math.min(1, chance * FRAGMENT_DROP_BOSS_MULT)
    rolls = 2
  } else {
    chance = Math.min(1, chance)
  }

  const results: PartDropResult[] = []
  for (let i = 0; i < rolls; i++) {
    if (rng() > chance) continue
    const pick =
      tracked && pool.some((row) => row.id === tracked)
        ? pool.find((row) => row.id === tracked)!
        : pool[Math.floor(rng() * pool.length)]!
    if (!pick || !canDropBlueprintFragment(state, pick.id, rewardWave)) continue
    const before = isBlueprintDiscovered(state, pick.id)
    grantBlueprintFragment(state, pick.id, 1)
    const after = isBlueprintDiscovered(state, pick.id)
    const have = blueprintFragmentCount(state, pick.id)
    const need = pick.fragmentsRequired
    state.combat.log = [`${pick.schematicName} ${Math.min(have, need)}/${need}`, ...state.combat.log].slice(0, 40)
    state.combat.fragmentNotice = {
      moduleId: pick.id,
      name: pick.name,
      have: Math.min(have, need),
      need,
      seq: (state.combat.fragmentNotice?.seq ?? 0) + 1,
    }
    results.push({
      blueprintId: pick.id,
      have,
      need,
      discovered: !before && after,
    })
  }
  return results
}

export function waveCanDropPrint(wave: number, moduleId: string): boolean {
  const def = getBlueprint(moduleId)
  if (!def) return false
  return Number.isFinite(def.fragmentEligibleFromWave) && wave >= def.fragmentEligibleFromWave
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
  if (unit.killRewarded) return
  unit.killRewarded = true
  noteSortieKill(state)
  recordPlaytest(state, 'first_kill', { firstKey: 'kill' })
  const rewardWeight = Math.max(0, Math.min(1, unit.rewardWeight ?? 1))
  const salvageMult =
    hiveResearchSalvageMult(state) *
    furnaceSalvageMult(state) *
    echoSalvageMult(state) *
    specialistSalvageMult(state) *
    capitalSalvageMult(state) *
    fittedSalvageKillMult(state) *
    processSalvageMult(state) *
    salvageKillMult(state) *
    frameSalvageMult(state) *
    (1 + salvageMarkBonus(state, unit))
  state.resources.salvage +=
    salvageFromKill(rewardWaveOf(unit), unit.isBoss, undefined, state) * salvageMult * rewardWeight
  const scrap = scrapKillBonus(state, unit.isBoss) * rewardWeight * combatScrapMatterMult(state)
  if (scrap > 0) grantGeneratedScrap(state, scrap, 'combat-kill')
  const rng = () => combatRng(state)
  rollEnemyPartDrop(state, unit, rng, rewardWeight)
  rollDirectMaterialRecovery(state, unit, rng)
  const discreteLoot = rewardWeight >= 1 || rng() < rewardWeight
  if (discreteLoot) {
    grantSignalCoreDrop(state, 'kill', { family: unit.family })
    grantFurnaceKillLoot(state, unit.isBoss)
  }
  choirTapOnHighValueKill(state, unit)
  grantHiveResearchKillXp(
    state,
    unit.isBoss,
    furnaceResearchXpMult(state) * rewardWeight,
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

/**
 * After kill rewards and package accounting are safe, drop the full CombatUnit.
 * Death VFX uses a lightweight FX payload (position + serialised id).
 */
export function pruneDeadEnemyUnits(state: GameState): void {
  const kept: CombatUnit[] = []
  let removed = false
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull > 0) {
      kept.push(unit)
      continue
    }
    removed = true
    state.combat.fx.push({
      id: nextCombatId(state, 'fx', 'fx'),
      fromId: unit.id,
      toId: unit.id,
      tag: 'death',
      ttl: 0.4,
      hit: 'hull',
      x: unit.x,
      y: unit.y,
    })
  }
  if (removed) state.combat.enemyUnits = kept
}

interface AppliedHit {
  dealt: number
  hullOverkill: number
}

function applyDamageToUnit(
  target: CombatUnit,
  rawDamage: number,
  tags: WeaponTag[],
  profile?: WeaponDamageProfile,
  state?: GameState,
  opts?: { shieldBypassFrac?: number },
): AppliedHit {
  if (target.untargetable || target.isCore || target.targetable === false) {
    return { dealt: 0, hullOverkill: 0 }
  }
  const vs = profile ?? weaponDamageProfile(tags)
  let remaining = rawDamage * target.damageTakenMult
  if (state && target.side === 'enemy') {
    remaining *= phaseExposureTakenMult(state, target)
  }

  if (state && target.isFlagship && target.side === 'player') {
    remaining = mitigateIncomingToHive(state, target, remaining, tags)
    if (remaining <= 0) return { dealt: 0, hullOverkill: 0 }
    if (tryBarrierIntercept(state, target, remaining)) return { dealt: 0, hullOverkill: 0 }
  }

  if (tags.includes('antiShield') && target.shield > 0) {
    remaining *= 1.5
  }
  let dealt = 0
  let hullOverkill = 0
  const hullBefore = target.hull
  const bypassFrac =
    opts?.shieldBypassFrac ?? (tags.includes('bypass') ? HEAVY_SHIELD_BYPASS : 0)
  if (state && bypassFrac > 0 && target.shield > 0 && target.hull > 0) {
    const bypass = remaining * bypassFrac
    remaining -= bypass
    const hullHit = Math.min(target.hull, bypass)
    target.hull -= hullHit
    dealt += hullHit
    if (hullBefore > 0 && target.hull <= 0) hullOverkill = Math.max(0, bypass - hullBefore)
  }

  if (target.shield > 0 && remaining > 0) {
    const shieldHit = remaining * vs.shieldDamage
    const toShield = Math.min(target.shield, Math.max(0, shieldHit))
    target.shield -= toShield
    dealt += toShield
    target.regenDelay = Math.max(target.regenDelay ?? 0, SHIELD_REGEN_DELAY)
    return { dealt, hullOverkill }
  }

  if (remaining > 0 && target.hull > 0) {
    const armored = target.family === 'armored'
    let hullHit = remaining * (armored ? vs.armorDamage : vs.hullDamage)
    let armor = state ? effectiveEnemyArmor(state, target) : target.armor
    if (tags.includes('pierce')) armor *= 0.5
    if (armored && vs.armorDamage < 1) armor = 0
    hullHit = Math.max(1, hullHit - armor)
    const toHull = Math.min(target.hull, hullHit)
    target.hull -= toHull
    dealt += toHull
    if (hullBefore > 0 && target.hull <= 0) {
      hullOverkill = Math.max(hullOverkill, hullHit - hullBefore)
    }
    target.regenDelay = Math.max(target.regenDelay ?? 0, SHIELD_REGEN_DELAY)
  }
  return { dealt, hullOverkill }
}

export interface PlayerCombatHit {
  dealt: number
  hullOverkill: number
  prevHull: number
  prevShield: number
  killed: boolean
}

/** Player → enemy hit through the normal Shield/Hull/reward pipeline. Secondary hits do not cascade. */
export function applyPlayerCombatHit(
  state: GameState,
  target: CombatUnit,
  rawDamage: number,
  tags: WeaponTag[],
  profile?: WeaponDamageProfile,
  opts?: { shieldBypassFrac?: number; role?: CombatUnit['role'] },
): PlayerCombatHit {
  const prevHull = target.hull
  const prevShield = target.shield
  const hit = applyDamageToUnit(target, rawDamage, tags, profile, state, opts)
  noteCombatHit(state, 'player', target, hit.dealt, prevShield, opts?.role)
  tryLootEnemyKill(state, target, prevHull)
  return {
    dealt: hit.dealt,
    hullOverkill: hit.hullOverkill,
    prevHull,
    prevShield,
    killed: prevHull > 0 && target.hull <= 0,
  }
}

export function applyFlakDeathDetonation(
  state: GameState,
  dead: CombatUnit,
  damage: number,
  sourceModuleId: string | undefined,
  fromId?: string,
): void {
  if (sourceModuleId !== 'flak-array') return
  if (!hasMasteryEffect(state, 'flak-array', 'flak-death-detonation')) return
  const core = state.combat.playerUnits.find(
    (unit) => unit.isCore && unit.coreModuleId === 'flak-array' && (!fromId || unit.id === fromId),
  )
  let origin: { x: number; y: number } = dead
  if (core && hasMasteryEffect(state, 'flak-array', 'flak-kill-box')) {
    origin = densestLegalFlakCluster(state, core) ?? dead
  }
  for (const enemy of state.combat.enemyUnits) {
    if (enemy.id === dead.id) continue
    if (!isTargetableEnemy(state, enemy)) continue
    if (distanceBetween(origin, enemy) > FLAK_DETONATION_RADIUS) continue
    applyPlayerCombatHit(state, enemy, damage * 0.45, ['kinetic', 'splash'])
  }
}

function applyMoltenPoolDamage(state: GameState, dt: number): void {
  const runtime = state.combat.coreRuntime
  if (!runtime) return
  for (const pool of runtime.moltenPools) {
    for (const enemy of state.combat.enemyUnits) {
      if (!isTargetableEnemy(state, enemy)) continue
      if (distanceBetween(enemy, pool) > pool.radius) continue
      applyPlayerCombatHit(state, enemy, pool.dps * dt, ['kinetic', 'dot'])
    }
  }
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
  state?: GameState,
): number {
  return applyDamageToUnit(target, rawDamage, tags, profile, state).dealt
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
  state: GameState,
  hits: CombatFx[],
  fromId: string,
  toId: string,
  tag: string,
  opts: { amount?: number; hit?: CombatFx['hit']; ttl: number; x?: number; y?: number },
): void {
  hits.push({
    id: nextCombatId(state, 'fx', 'fx'),
    fromId,
    toId,
    tag,
    ttl: opts.ttl,
    amount: opts.amount,
    hit: opts.hit,
    x: opts.x,
    y: opts.y,
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
  const crit = combatRng(state) < critChance(state)
  return {
    damage: crit ? damage * critFactor(state) : damage,
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
  state.combat.projectiles.push({
    id: nextCombatId(state, 'proj', 'proj'),
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
    heading: bearingBetween(from, to),
    weaponId: weapon.id,
    sourceModuleId: from.side === 'player' ? from.coreModuleId : undefined,
    shieldBypassFrac:
      from.coreModuleId === 'phase-beam' ? phaseRampBypassFrac(state, from) : undefined,
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
  if (!state.combat.beams) state.combat.beams = []
  state.combat.beams.push({
    id: nextCombatId(state, 'beam', 'beam'),
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
    heading: bearingBetween(from, to),
    weaponId: weapon.id,
    sourceModuleId: from.side === 'player' ? from.coreModuleId : undefined,
    shieldBypassFrac:
      from.coreModuleId === 'phase-beam' ? phaseRampBypassFrac(state, from) : undefined,
    ...tuned.profile,
  })
}

function nearestLegalPhaseGlance(
  state: GameState,
  core: CombatUnit,
  primary: CombatUnit,
  _damage: number,
): CombatUnit | null {
  let best: CombatUnit | null = null
  let bestD = 72
  for (const enemy of state.combat.enemyUnits) {
    if (enemy.id === primary.id || !isTargetableEnemy(state, enemy)) continue
    const d = distanceBetween(primary, enemy)
    if (d > bestD) continue
    const sol = firingSolution(state, core, enemy)
    if (!sol.inFireRange || !sol.inArc) continue
    best = enemy
    bestD = d
  }
  return best
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
    if (from.isCore && from.side === 'player') {
      const sol = firingSolution(state, from, target)
      if (!sol.canConnectBeam) continue
    }
    const slice = Math.min(dt, beam.remaining)
    if (slice <= 0) continue
    let dmg = beam.damage * (slice / beam.duration)
    if (beam.side !== 'player') {
      dmg *= incomingDefenseMult(target, beam.attackerFamily, roles, matchupScale)
    }
    const prevHull = target.hull
    const shieldBefore = target.shield
    const hit = applyDamageToUnit(target, dmg, beam.tags, {
      hullDamage: beam.hullDamage ?? 1,
      shieldDamage: beam.shieldDamage ?? 1,
      armorDamage: beam.armorDamage ?? 0.25,
    }, state, { shieldBypassFrac: beam.shieldBypassFrac })
    const dealt = hit.dealt
    noteCombatHit(state, beam.side, target, dealt, shieldBefore, from.role ?? beam.attackerRole)
    tryLootEnemyKill(state, target, prevHull)
    if (
      beam.side === 'player' &&
      from.coreModuleId === 'phase-beam' &&
      hasMasteryEffect(state, 'phase-beam', 'phase-refraction')
    ) {
      const glance = nearestLegalPhaseGlance(state, from, target, dmg * PHASE_REFRACTION_FRACTION)
      if (glance) {
        applyPlayerCombatHit(state, glance, dmg * PHASE_REFRACTION_FRACTION, beam.tags, {
          hullDamage: beam.hullDamage ?? 1,
          shieldDamage: beam.shieldDamage ?? 1,
          armorDamage: beam.armorDamage ?? 0.25,
        }, { shieldBypassFrac: beam.shieldBypassFrac, role: from.role ?? beam.attackerRole })
      }
    }
    if (
      beam.side === 'player' &&
      from.coreModuleId === 'phase-beam' &&
      phaseRampAtMax(state, from) &&
      hasMasteryEffect(state, 'phase-beam', 'phase-exposure')
    ) {
      applyPhaseExposure(state, target.id)
    }
    beam.popupAcc = (beam.popupAcc ?? 0) + dealt
    beam.popupT = (beam.popupT ?? 0) + slice
    const beamDone = beam.remaining - slice <= 1e-4 || target.hull <= 0
    if ((beam.popupT >= 0.16 || beamDone) && (beam.popupAcc ?? 0) >= 0.4) {
      pushHitFx(state, hits, beam.fromId, beam.toId, beam.tag, {
        amount: beam.popupAcc,
        hit: hitLayer(shieldBefore, prevHull, target),
        ttl: 0.35,
        x: target.x,
        y: target.y,
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
      if (target.evasion > 0 && combatRng(state) < target.evasion) {
        pushHitFx(state, hits, shot.fromId, shot.toId, 'miss', {
          hit: 'miss',
          ttl: 0.35,
          x: target.x,
          y: target.y,
        })
        continue
      }

      if (shot.side !== 'player' && interceptEnemyProjectile(state, shot)) {
        continue
      }
      let dmg = shot.damage
      if (shot.side !== 'player') {
        dmg *= incomingDefenseMult(target, shot.attackerFamily, roles, matchupScale)
      }
      const prevHull = target.hull
      const shieldBefore = target.shield
      const hit = applyDamageToUnit(target, dmg, shot.tags, {
        hullDamage: shot.hullDamage ?? 1,
        shieldDamage: shot.shieldDamage ?? 1,
        armorDamage: shot.armorDamage ?? 0.25,
      }, state, { shieldBypassFrac: shot.shieldBypassFrac })
      const dealt = hit.dealt
      noteCombatHit(state, shot.side, target, dealt, shieldBefore, shot.attackerRole)
      tryLootEnemyKill(state, target, prevHull)
      if (shot.side === 'player' && dealt > 0 && shot.sourceModuleId === 'heavy-lance') {
        if (hasMasteryEffect(state, 'heavy-lance', 'heavy-armor-fracture')) {
          applyHeavyArmorFracture(state)
        }
        if (
          hasMasteryEffect(state, 'heavy-lance', 'heavy-pen-momentum') &&
          shot.tags.includes('pierce')
        ) {
          const behind = nextEnemyAlongHeading(state, target, shot.heading ?? 0, target.id)
          if (behind) {
            applyPlayerCombatHit(state, behind, shot.damage * HEAVY_PEN_MOMENTUM, ['kinetic'], undefined, {
              role: shot.attackerRole,
            })
          }
        }
      }
      if (shot.side === 'player' && prevHull > 0 && target.hull <= 0) {
        applyFlakDeathDetonation(state, target, shot.damage, shot.sourceModuleId, shot.fromId)
        if (shot.sourceModuleId === 'pulse-cannon') {
          const leftover = hit.hullOverkill
          const hop = pulseOverkillHop(state, target, leftover, target.id)
          if (hop) {
            applyPlayerCombatHit(state, hop, leftover * 0.45, shot.tags, {
              hullDamage: shot.hullDamage ?? 1,
              shieldDamage: shot.shieldDamage ?? 1,
              armorDamage: shot.armorDamage ?? 0.25,
            }, { role: shot.attackerRole })
          }
        }
      }
      if (shot.side === 'player' && shot.sourceModuleId === 'slag-spitter' && shot.tags.includes('dot')) {
        spawnMoltenPool(state, target.x, target.y, shot.sourceModuleId)
      }
      if (shot.dotDuration > 0 && shot.dotDamage > 0) {
        target.dots.push({ dps: shot.dotDamage, remaining: shot.dotDuration })
      }
      pushHitFx(state, hits, shot.fromId, shot.toId, shot.tag, {
        amount: dealt,
        hit: hitLayer(shieldBefore, prevHull, target),
        ttl: 0.55,
        x: target.x,
        y: target.y,
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

function cancelCoreCharge(weapon: WeaponInstance): void {
  weapon.telegraphLeft = 0
  weapon.telegraphToId = undefined
  weapon.chargeReady = false
}

function deliverPlayerShot(
  state: GameState,
  unit: CombatUnit,
  weapon: WeaponInstance,
  target: CombatUnit,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
  bossProtocol: boolean,
): boolean {
  if (target.hull <= 0) return false
  let dmg = weapon.damage * phaseRampMultiplier(state, unit)
  if (unit.coreModuleId === 'heavy-lance' && hasMasteryEffect(state, 'heavy-lance', 'heavy-shield-bypass')) {
    if (!weapon.tags.includes('bypass')) weapon.tags = [...weapon.tags, 'bypass']
  }
  if (unit.coreModuleId === 'heavy-lance' && hasMasteryEffect(state, 'heavy-lance', 'heavy-pierce')) {
    if (!weapon.tags.includes('pierce')) weapon.tags = [...weapon.tags, 'pierce']
  }
  dmg *= matchupMultiplier(weapon.tags, target, roles, matchupScale, bossProtocol)
  if (unit.coreModuleId === 'phase-beam') {
    const bypass = phaseRampBypassFrac(state, unit)
    if (bypass > 0 && !weapon.tags.includes('bypass')) weapon.tags = [...weapon.tags, 'bypass']
  }
  if (weapon.delivery === 'beam') {
    spawnBeam(state, unit, target, dmg, weapon)
  } else {
    spawnProjectile(state, unit, target, dmg, weapon)
  }
  if (unit.coreModuleId === 'pulse-cannon') {
    const hops = pulseChainHops(state, unit.coreInstanceId ?? unit.id)
    let from = target
    const used = new Set([target.id])
    for (let i = 0; i < hops; i += 1) {
      const next = pulseChainTarget(state, from, from.id)
      if (!next || used.has(next.id)) break
      used.add(next.id)
      spawnProjectile(state, unit, next, dmg * 0.45, weapon)
      from = next
    }
  }
  return true
}

function splashTargets(
  state: GameState,
  unit: CombatUnit,
  primary: CombatUnit,
  foes: CombatUnit[],
  weapon: WeaponInstance,
  fireRange: number,
): CombatUnit[] {
  const splashCap =
    unit.coreModuleId === 'flak-array' ? flakSplashCount(state, weapon.splash || 1) : weapon.splash || 1
  if (!(weapon.splash > 0 || weapon.tags.includes('splash') || unit.coreModuleId === 'flak-array')) {
    return [primary]
  }
  const extras = foes
    .filter(
      (u) =>
        isTargetableEnemy(state, u) &&
        u.id !== primary.id &&
        combatDistance(unit, u) <= fireRange + 0.5,
    )
    .sort((a, b) => combatDistance(unit, a) - combatDistance(unit, b))
    .slice(0, splashCap)
  return [primary, ...extras]
}

function firePlayerCore(
  state: GameState,
  unit: CombatUnit,
  dt: number,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
  bossProtocol: boolean,
): void {
  const profile = profileForCore(unit)
  const target = playerCoreTarget(state, unit)
  const fireRange = effectiveCoreFireRange(state, unit)

  for (const weapon of unit.weapons) {
    if (weapon.cooldownLeft > 0 && !weapon.chargeReady && weapon.telegraphLeft <= 0) {
      unit.heldShotNoted = false
    }
    weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt)

    if (profile.requiresCharge) {
      if (!target) {
        cancelCoreCharge(weapon)
        continue
      }
      const sol = firingSolution(state, unit, target)
      if (weapon.telegraphLeft > 0) {
        weapon.telegraphLeft = Math.max(0, weapon.telegraphLeft - dt)
        weapon.telegraphToId = target.id
        if (weapon.telegraphLeft > 0) continue
        weapon.chargeReady = true
      }
      if (weapon.chargeReady) {
        if (!sol.canReleaseCharge) {
          noteShotHeld(unit)
          continue
        }
        if (weapon.cooldownLeft > 0) continue
        const fired = deliverPlayerShot(state, unit, weapon, target, roles, matchupScale, bossProtocol)
        if (fired) {
          cancelCoreCharge(weapon)
          weapon.cooldownLeft = 0
          noteCoreFiring(unit, dt)
          noteCoreShotFired(unit)
        }
        continue
      }
      if (weapon.cooldownLeft > 0) continue
      if (sol.canStartCharge) {
        const charge = effectiveChargeDurationSec(state, unit)
        weapon.telegraphDuration = charge
        weapon.telegraphLeft = charge
        weapon.telegraphToId = target.id
        weapon.chargeReady = false
      }
      continue
    }

    if (weapon.cooldownLeft > 0) continue
    if (!target) continue
    const sol = firingSolution(state, unit, target)
    const legal = profile.requiresStabilisedAim ? sol.canConnectBeam : sol.canFire
    if (!legal) {
      noteShotHeld(unit)
      continue
    }

    const targets = splashTargets(state, unit, target, state.combat.enemyUnits, weapon, fireRange)
    let fired = false
    for (const shotAt of targets) {
      if (deliverPlayerShot(state, unit, weapon, shotAt, roles, matchupScale, bossProtocol)) fired = true
    }
    if (fired) {
      weapon.cooldownLeft = weapon.cooldown
      noteCoreFiring(unit, dt)
      noteCoreShotFired(unit)
    }
  }
}

/**
 * Continuous combat step (real seconds, not ticks).
 * Player Cores fire only with a persistent target and a legal firing solution.
 */
export function simulateCombat(
  state: GameState,
  dt: number,
  _pushLog: (state: GameState, line: string) => void,
): void {
  if (dt <= 0) return
  maybeSampleSortieEnemies(state)
  const roles = fittedRoles(state)
  const matchupScale =
    1 +
    challengeShopMatchupBonus(state.prestige.shop) +
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')

  moveUnits(state, dt)
  tickPlayerCoreTargeting(state, dt)
  for (const core of state.combat.playerUnits) {
    if (!core.isCore || core.coreModuleId !== 'phase-beam') continue
    const acquired = core.currentTargetId
      ? state.combat.enemyUnits.find((u) => u.id === core.currentTargetId)
      : undefined
    const legal =
      acquired && isTargetableEnemy(state, acquired) ? firingSolution(state, core, acquired) : null
    const contacting = Boolean(legal?.canConnectBeam && coreIsBeaming(state, core))
    updatePhaseRamp(state, core, dt, contacting)
    if (contacting && phaseRampAtMax(state, core)) applyPhaseExposure(state, acquired!.id)
  }
  tickSupportCores(state, dt)
  applyMoltenPoolDamage(state, dt)

  const masteryRegen = state.shipyard.modules.reduce(
    (n, id) => n + combinedCoreMods(state, id).regenAdd,
    0,
  )
  const regenFrac =
    (fittedShieldRegenFraction(state.shipyard.modules) +
      masteryRegen +
      shopShieldRegen(state)) *
    directiveShieldRegenMult(state)
  const hullRepairFrac = shopHullRepair(state)
  for (const unit of state.combat.playerUnits) {
    if ((unit.regenDelay ?? 0) > 0) {
      unit.regenDelay = Math.max(0, (unit.regenDelay ?? 0) - dt)
    }
    if (unit.hull <= 0) continue
    if (hullRepairFrac > 0 && unit.hullMax > 0) {
      unit.hull = Math.min(unit.hullMax, unit.hull + unit.hullMax * hullRepairFrac * dt)
    }
    if (regenFrac <= 0 || (unit.regenDelay ?? 0) > 0) continue
    if (unit.shieldMax <= 0) continue
    unit.shield = Math.min(unit.shieldMax, unit.shield + unit.shieldMax * regenFrac * dt)
  }

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

      if (side === 'player' && unit.isCore) {
        firePlayerCore(state, unit, dt, roles, matchupScale, bossProtocol)
        continue
      }

      for (const weapon of unit.weapons) {
        weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt)

        if (weapon.telegraphLeft > 0) {
          weapon.telegraphLeft = Math.max(0, weapon.telegraphLeft - dt)
          if (weapon.telegraphToId) {
            const locked = findUnit(state, weapon.telegraphToId)
            if (!locked || locked.hull <= 0) {
              const next = pickEnemyTarget(unit, foes, weapon)
              weapon.telegraphToId = next?.id
            }
          }
          if (weapon.telegraphLeft > 0) continue
        } else if (weapon.cooldownLeft > 0) {
          continue
        } else if (weapon.telegraphDuration > 0) {
          const windupTarget = pickEnemyTarget(unit, foes, weapon)
          if (!windupTarget) continue
          weapon.telegraphLeft = weapon.telegraphDuration
          weapon.telegraphToId = windupTarget.id
          continue
        }

        const locked =
          weapon.telegraphToId ? findUnit(state, weapon.telegraphToId) : undefined
        weapon.telegraphToId = undefined
        const primary =
          locked && locked.hull > 0 && combatDistance(unit, locked) <= weapon.range + 0.5
            ? locked
            : pickEnemyTarget(unit, foes, weapon)
        if (!primary) continue

        const targets: CombatUnit[] = [primary]
        if (weapon.splash > 0 || weapon.tags.includes('splash')) {
          const extras = foes
            .filter(
              (u) =>
                u.hull > 0 &&
                u.id !== primary.id &&
                combatDistance(unit, u) <= weapon.range + 0.5,
            )
            .sort((a, b) => combatDistance(unit, a) - combatDistance(unit, b))
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

  pruneDeadEnemyUnits(state)
  syncHullAggregates(state)
}
export function totalEnemyHull(encounter: WaveEncounter): number {
  return encounter.units.reduce((s, u) => s + u.hullMax, 0)
}
