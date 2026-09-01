/** Fleet combat: ranged approach, cooldowns, bosses, salvage drops. */

import type {
  CombatBeam,
  CombatFx,
  CombatProjectile,
  CombatUnit,
  GameState,
  UnitShape,
  WeaponDelivery,
  WeaponInstance,
  WeaponTag,
} from './types'
import {
  aiDoctrinesActive,
  getModule,
  fittedShieldRegenFraction,
  stationRepairBonus,
  ENEMY_PARK_MAX,
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
  encounterForWave,
  type WaveEncounter,
} from './encounterGenerator'
import {
  enemyDamageScale as seededDamageScale,
  enemyWaveScale as seededHullScale,
  salvageWaveBase as seededSalvageBase,
  COMMANDER_REWARD,
  BOSS_KILL_SALVAGE_MULT,
} from './hostileSeeds'
import { tickCommanderTraits, onHostileDeathHazards, movementSpeed, fireCooldown, ensureDeathHazards } from './commanderTraits'
import { tickChoirCrown, isCoreJammed } from './choirCrown'
import { tryReleaseReservedCommanders } from './commanders'
import { recordCommanderDefeat } from './codex'
import { noteCommanderDeath, noteOrdinaryKillSalvage } from './encounterTelemetry'
import { ENEMY_FAMILY_IDS, type EnemyFamilyId } from './hostileCatalogue'
import './bossRegistry'
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
import { createSimRng, rngNext } from './simRng'
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
import { grantFurnaceKillLoot, furnaceFragmentFindMult, furnaceSalvageMult, furnaceScrapMult } from './furnace'
import {
  grantHiveResearchKillXp,
  hiveResearchSalvageMult,
} from './hiveResearch'
import { echoSalvageMult } from './echo'
import { specialistSalvageMult } from './specialists'
import { capitalSalvageMult } from './capital'
import { processSalvageMult } from './process'
import { directiveCritChanceAdd, directiveCritFactorMult, directiveFocusedFireMult, directiveFragmentFindMult, directiveHullRepairMult, directiveIncomingMult, directiveProtectedTargetDamageMult, directiveSalvageMult, directiveScrapMult, directiveSecondaryDamageMult } from './directives'
import { challengeBlocksHullRepair, challengeFireRangeCap } from './challenges'
import { directiveShieldRegenMult } from './directives'
import { recordPlaytest } from './playtest'
import {
  maybeSampleSortieEnemies,
  noteSortieIncoming,
  noteSortieKill,
  noteSortieOutgoing,
} from './sortieTelemetry'

export type EnemyFamily = EnemyFamilyId
export type { WaveEncounter }
export { encounterForWave }
export const FINAL_ENEMY_FAMILIES = ENEMY_FAMILY_IDS

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
  return seededSalvageBase(wave)
}

export function salvageFromKill(
  wave: number,
  isBoss: boolean,
  _route?: string,
  _state?: GameState,
): number {
  const exp = 1
  const raw = (isBoss ? BOSS_KILL_SALVAGE_MULT : 1) * Math.pow(salvageWaveBase(wave), exp)
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


export function enemyWaveScale(wave: number): number {
  return seededHullScale(wave)
}

export function enemyDamageScale(wave: number): number {
  return seededDamageScale(wave)
}

export const SHIELD_REGEN_DELAY = 2


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
        summary: u.isBoss ? 'Proper Boss encounter.' : 'Recorded hostile contact.',
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
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup

  let playerDps = stats.damage
  let incomingMult = stats.damageTakenMult

  if (family === 'armored' && roles.weapon > 0) {
    const bonus = 1 + 0.18 * roles.weapon * matchupScale
    playerDps *= bonus
    notes.push(`Weapons vs Armored ×${bonus.toFixed(2)}`)
  }
  if (family === 'veil' && roles.utility > 0) {
    const bonus = 1 + 0.12 * Math.min(roles.utility, 2) * matchupScale
    playerDps *= bonus
    notes.push(`Utility vs Veil ×${bonus.toFixed(2)}`)
  }
  if (family === 'swarm' && roles.defense > 0) {
    const reduce = Math.pow(0.88, roles.defense * matchupScale)
    incomingMult *= reduce
    notes.push(`Defense vs Swarm ×${reduce.toFixed(2)} incoming`)
  }
  if (state.combat.isBoss) {
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
  if (enemy.family === 'veil' && roles.utility === 0 && !fittedModuleIds.includes('phase-beam')) {
    return 'Hint: Energy weapons or Utility vs Veil, once that family is authored.'
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
  rate += stationRepairBonus(state)
  rate *= reactorsRepairMult(state.core?.ranks.reactors ?? 0)
  return rate * directiveHullRepairMult(state)
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
  if (state) return challengeFireRangeCap(state) ?? ENEMY_PARK_MAX
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
    const speed = movementSpeed(unit) * slow
    if (dist > target) {
      const next = moveRadially(unit.x, unit.y, -speed * dt)
      unit.x = next.x
      unit.y = next.y
    } else if (dist < target && unit.kite) {
      const next = moveRadially(unit.x, unit.y, speed * dt * 0.85)
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
  if (family === 'veil' && (tags.includes('energy') || tags.includes('antiShield'))) {
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
    directiveFragmentFindMult(state) *
    furnaceFragmentFindMult(state) *
    logisticsDropMult(state) *
    (1 + computeSignalCoreBonuses(state).drop) *
    1
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
    directiveSalvageMult(state) *
    echoSalvageMult(state) *
    specialistSalvageMult(state) *
    capitalSalvageMult(state) *
    fittedSalvageKillMult(state) *
    processSalvageMult(state) *
    salvageKillMult(state) *
    frameSalvageMult(state) *
    (1 + salvageMarkBonus(state, unit))
  const commanderSalvage = unit.isCommander ? COMMANDER_REWARD.salvageMult : 1
  const commanderScrap = unit.isCommander ? COMMANDER_REWARD.scrapMult : 1
  const commanderFrag = unit.isCommander ? COMMANDER_REWARD.fragmentChanceMult : 1
  const commanderMat = unit.isCommander ? COMMANDER_REWARD.materialChanceMult : 1
  const salvageGain =
    salvageFromKill(rewardWaveOf(unit), unit.isBoss, undefined, state) *
    salvageMult *
    rewardWeight *
    commanderSalvage
  state.resources.salvage += salvageGain
  if (unit.isCommander) noteCommanderDeath(state, unit.commanderSpawnedAt, salvageGain)
  else noteOrdinaryKillSalvage(state, salvageGain)
  const scrap =
    scrapKillBonus(state, unit.isBoss) * rewardWeight * commanderScrap * combatScrapMatterMult(state) * directiveScrapMult(state) * furnaceScrapMult(state)
  if (scrap > 0) grantGeneratedScrap(state, scrap, 'combat-kill')
  const rng = () => combatRng(state)
  rollEnemyPartDrop(state, unit, rng, Math.min(1, rewardWeight * commanderFrag))
  const matUnit = {
    ...unit,
    rewardWeight: Math.min(1, (unit.rewardWeight ?? 1) * commanderMat),
  }
  rollDirectMaterialRecovery(state, matUnit, rng)
  const discreteLoot = rewardWeight >= 1 || rng() < rewardWeight
  if (discreteLoot) {
    grantSignalCoreDrop(state, 'kill', { family: unit.family })
    grantFurnaceKillLoot(state, unit.isBoss)
    if (unit.family === 'choir' && unit.familyStatus === 'authored') {
      state.resources.choirAsh =
        (state.resources.choirAsh ?? 0) +
        (unit.isCommander ? COMMANDER_REWARD.choirAshMult : 1) * 0.25
    }
  }
  choirTapOnHighValueKill(state, unit)
  grantHiveResearchKillXp(
    state,
    unit.isBoss,
     rewardWeight * (unit.isCommander ? COMMANDER_REWARD.masteryMult : 1),
  )
  if (unit.isCommander) recordCommanderDefeat(state, unit)
  onHostileDeathHazards(state, unit)
  tryReleaseReservedCommanders(state)
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
    remaining *= directiveIncomingMult(state)
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
    remaining = 0
  }

  if ((target.supportShield ?? 0) > 0 && remaining > 0) {
    const toSupport = Math.min(target.supportShield ?? 0, remaining)
    target.supportShield = (target.supportShield ?? 0) - toSupport
    remaining -= toSupport
    dealt += toSupport
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
  opts?: { shieldBypassFrac?: number; role?: CombatUnit['role']; secondary?: boolean },
): PlayerCombatHit {
  const prevHull = target.hull
  const prevShield = target.shield
  const scaledDamage = opts?.secondary || tags.includes('splash') ? rawDamage * directiveSecondaryDamageMult(state) : rawDamage
  const hit = applyDamageToUnit(target, scaledDamage, tags, profile, state, opts)
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
    applyPlayerCombatHit(state, enemy, damage * 0.45, ['kinetic', 'splash'], undefined, { secondary: true })
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
  if ((attackerFamily === 'apex' || attackerFamily === 'armored') && target.isFlagship) {
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
  to: CombatUnit,
  damage: number,
  profile: { hullDamage: number; shieldDamage: number; armorDamage: number },
): { damage: number; profile: { hullDamage: number; shieldDamage: number; armorDamage: number } } {
  if (from.side !== 'player') return { damage, profile }
  const chance = Math.min(0.4, critChance(state) + directiveCritChanceAdd(state))
  const crit = combatRng(state) < chance
  const protectedTarget = to.shield > 0 || effectiveEnemyArmor(state, to) > 0
  const directMult = directiveProtectedTargetDamageMult(state, protectedTarget) * directiveFocusedFireMult(state, from, to.id)
  return {
    damage: damage * directMult * (crit ? critFactor(state) * directiveCritFactorMult(state) : 1),
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
  const tuned = tunePlayerShot(state, from, to, damage, weaponDamageProfile(weapon.tags, weapon))
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
      weapon.shieldBypassFrac ??
      (from.coreModuleId === 'phase-beam' ? phaseRampBypassFrac(state, from) : undefined),
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
  const tuned = tunePlayerShot(state, from, to, damage, weaponDamageProfile(weapon.tags, weapon))
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
      weapon.shieldBypassFrac ??
      (from.coreModuleId === 'phase-beam' ? phaseRampBypassFrac(state, from) : undefined),
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
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')

  moveUnits(state, dt)
  tickCommanderTraits(state, dt)
  tickChoirCrown(state, dt)
  if (
    state.combat.commanderNotice &&
    (state.combat.simTime ?? 0) >= state.combat.commanderNotice.untilSim
  ) {
    state.combat.commanderNotice = null
  }
  tickDeathHazards(state, dt)
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
  const hullRepairFrac = challengeBlocksHullRepair(state)
    ? 0
    : shopHullRepair(state) * directiveHullRepairMult(state)
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
        if (!isCoreJammed(state, unit)) {
          firePlayerCore(state, unit, dt, roles, matchupScale, bossProtocol)
        }
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

        if (fired) weapon.cooldownLeft = fireCooldown(unit, weapon.cooldown)
      }
    }
  }

  state.combat.fx = [...hitFx, ...state.combat.fx.map((f) => ({ ...f, ttl: f.ttl - dt }))]
    .filter((f) => f.ttl > 0)
    .slice(0, 96)

  pruneDeadEnemyUnits(state)
  syncHullAggregates(state)
}

function tickDeathHazards(state: GameState, dt: number): void {
  const hazards = ensureDeathHazards(state)
  const hive = state.combat.playerUnits.find((u) => u.isFlagship)
  const kept: typeof hazards = []
  for (const hazard of hazards) {
    hazard.delayLeft -= dt
    if (hazard.delayLeft > 0) {
      kept.push(hazard)
      continue
    }
    for (const unit of state.combat.enemyUnits) {
      if (unit.hull <= 0) continue
      if (distanceBetween(unit, hazard) > hazard.radius) continue
      unit.deathHazardImmune = true
    }
    if (hive && hive.hull > 0 && distanceBetween(hive, hazard) <= hazard.radius) {
      applyDamageToUnit(hive, hazard.damage, ['kinetic', 'splash'], undefined, state)
    }
    for (const unit of state.combat.enemyUnits) {
      if (unit.hull <= 0) continue
      if (distanceBetween(unit, hazard) > hazard.radius) continue
      const prev = unit.hull
      applyDamageToUnit(unit, hazard.damage * 0.35, ['kinetic', 'splash'], undefined, state)
      tryLootEnemyKill(state, unit, prev)
    }
  }
  state.combat.deathHazards = kept
}

export function totalEnemyHull(encounter: WaveEncounter): number {
  return encounter.units.reduce((s, u) => s + u.hullMax, 0)
}
