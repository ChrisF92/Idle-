/**
 * Persistent Core targeting: Doctrine → current target → hysteresis →
 * acquisition → orbital traverse → legal firing solution.
 *
 * Fitted player Cores remain radially outward-facing. Slew Rate is orbital
 * angular traverse around the Hive, not turret rotation. Presentation must
 * use the same orbit angle / world position as the simulation.
 */

import { coreInstanceAtSlot, coreInstanceCopyNumber, resolveCoreInstance } from './coreInstances'
import { hasMasteryEffect } from './coreMastery'
import { frameTargetingSlewMult, getModule, SHORT_RANGE_MAX } from './catalog'
import { phaseRampEstablished, sensorTargetingModifier } from './coreCombat'
import {
  applyPlayerCoreOrbit,
  bearingBetween,
  degToRad,
  distanceBetween,
  distanceToHive,
  hiveBearingOf,
  isWithinArc,
  playerCoreOutwardFacing,
  shortestAngleDelta,
  slewHeading,
} from './geometry'
import {
  isTargetingCapableCoreModule,
  targetingProfileFor,
  type CoreTargetingProfile,
} from './targetingProfiles'
import type {
  CombatUnit,
  CoreInstance,
  CoreTargetingTelemetry,
  GameState,
  TargetingDoctrineId,
} from './types'
import { targetingServosSlewMult } from './workshop'
import { matterTraverseSlewMult } from './matter'

/** Canonical Research node. PR9 authors the tree; PR2 only checks completion. */
export const FIRE_CONTROL_DOCTRINE_RESEARCH_ID = 'd1-fire-control-doctrine'

export const TARGET_EVAL_INTERVAL = 0.1
export const CLUSTER_NEIGHBOUR_RADIUS = 60
export const ACQUISITION_RETENTION = 1.05
/** Authored Acquisition must stay at least this far above effective Fire Range. */
export const ACQUISITION_FIRE_GAP = 1.05
export const DEFAULT_SWITCH_ADVANTAGE = 0.25
/** Prevents near-zero Doctrine scores from chattering between candidates. */
export const HYSTERESIS_ABSOLUTE_FLOOR = 4
/** Heavy M10 Predictive Traverse lead along the target's current motion. */
export const HEAVY_PREDICT_LEAD_SEC = 0.55
/** Flak M10 Pack Prediction lead for cluster geometry. */
export const FLAK_PACK_LEAD_SEC = 0.45
/** Pulse M75 Adaptive Lock — extra hysteresis against orbital reversals. */
export const PULSE_ADAPTIVE_LOCK_ADVANTAGE = 0.42

export interface TargetingCoreSpec {
  moduleId: string
  coreInstanceId?: string
}

export interface TargetingStatModifier {
  fireRangeMult?: number
  fireRangeAdd?: number
  /** Applied after multiplicative/additive fire-range effects. */
  fireRangeCap?: number
  acquisitionRangeMult?: number
  acquisitionRangeAdd?: number
  slewRateMult?: number
  slewRateAdd?: number
  firingArcAddDeg?: number
}

export interface FiringSolution {
  target: CombatUnit
  distance: number
  bearing: number
  delta: number
  inAcquisition: boolean
  inFireRange: boolean
  inArc: boolean
  stabilised: boolean
  canFire: boolean
  canStartCharge: boolean
  canReleaseCharge: boolean
  canConnectBeam: boolean
}

export interface SharedTargetMetrics {
  ehp: number
  hullFrac: number
  shieldFrac: number
  armor: number
  danger: number
  urgency: number
  proximity: number
  clusterCount: number
  clusterWeight: number
  clusterMass: number
  remainingFrac: number
  focusWeight: number
  shieldPresent: number
  heavyWeight: number
  finishable: number
}

export interface FocusCommitmentSnapshot {
  coreVotes: Array<{ coreId: string; enemyId: string }>
  fire: Array<{ sourceId: string; enemyId: string; weight: number }>
}

export interface EvalBundle {
  enemies: CombatUnit[]
  metrics: Map<string, SharedTargetMetrics>
  focus: FocusCommitmentSnapshot
}

export function emptyTargetingTelemetry(): CoreTargetingTelemetry {
  return {
    initialAcquisitions: 0,
    targetSwitches: 0,
    timeNoTargetWhileEnemies: 0,
    timeAcquiredOutsideFire: 0,
    timeSlewLimited: 0,
    timeActivelyFiring: 0,
    shotsHeldIllegalSolution: 0,
    acquisitionDelayAccum: 0,
    shotsFired: 0,
  }
}

export function ensureTargetingTelemetry(unit: CombatUnit): CoreTargetingTelemetry {
  if (!unit.targetingTelemetry) unit.targetingTelemetry = emptyTargetingTelemetry()
  const tel = unit.targetingTelemetry
  if (tel.initialAcquisitions == null) tel.initialAcquisitions = 0
  if (tel.shotsFired == null) tel.shotsFired = 0
  if (tel.targetSwitches == null) tel.targetSwitches = 0
  return tel
}

/** PR10 Silent Bridge: authored defaults remain; manual config is blocked. */
export function challengeBlocksDoctrineConfig(_state: GameState): boolean {
  return false
}

export function researchUnlocksDoctrineConfig(state: GameState): boolean {
  return (state.hiveResearch?.completedIds ?? []).includes(FIRE_CONTROL_DOCTRINE_RESEARCH_ID)
}

export function canConfigureTargetingDoctrine(state: GameState): boolean {
  if (challengeBlocksDoctrineConfig(state)) return false
  return researchUnlocksDoctrineConfig(state)
}

/**
 * Doctrine configuration is legal only while Docked, or during an active
 * Sortie that is explicitly PAUSED. Other non-running states are rejected.
 */
export function canEditTargetingNow(state: GameState): boolean {
  if (state.combat.docked) return true
  if (!state.combat.docked && Boolean(state.combat.inFight) && Boolean(state.combat.sortiePaused)) {
    return true
  }
  return false
}

export function enableFireControlDoctrineForTests(state: GameState): GameState {
  const next = structuredClone(state)
  const ids = new Set(next.hiveResearch?.completedIds ?? [])
  ids.add(FIRE_CONTROL_DOCTRINE_RESEARCH_ID)
  next.hiveResearch.completedIds = [...ids]
  return next
}

export function isSortieRunning(state: GameState): boolean {
  return !state.combat.docked && Boolean(state.combat.inFight) && !state.combat.sortiePaused
}

/** PR3 Targeting Servos — slew only. Never Doctrine / score / acquisition. */
export function targetingServosContribution(state: GameState): TargetingStatModifier {
  return { slewRateMult: targetingServosSlewMult(state) }
}

/** PR3 Matter Traverse Actuators — slew only. */
export function matterTraverseContribution(state: GameState): TargetingStatModifier {
  return { slewRateMult: matterTraverseSlewMult(state) }
}

/** PR4 Frames / Sensor Array. Composed here; never bypasses the targeting engine. */
export function frameSensorTargetingContribution(state: GameState): TargetingStatModifier {
  const sensor = sensorTargetingModifier(state)
  return {
    slewRateMult: frameTargetingSlewMult(state) * sensor.slewRateMult,
    acquisitionRangeMult: sensor.acquisitionRangeMult,
  }
}

/** PR6 Relics (Tracking Gimbal, Fixed Mount, Predictive Bus). */
export function relicTargetingContribution(_state: GameState, _spec: TargetingCoreSpec): TargetingStatModifier {
  return {}
}

/** PR8 Gyro Sync Directive. */
export function directiveTargetingContribution(_state: GameState): TargetingStatModifier {
  return {}
}

/** PR9 Gyroscopic Calibration / Predictive Acquisition. */
export function researchTargetingContribution(_state: GameState): TargetingStatModifier {
  return {}
}

/**
 * PR10 Challenges may cap fire range (Knife Fight) or reduce acquisition
 * (Dead Reckoning) independently. Do not alias the two ranges.
 * Temporary short-range / Knife Fight support lives here until PR10 owns
 * the final catalogue.
 */
export function challengeTargetingContribution(state: GameState): TargetingStatModifier {
  if (state.prestige?.activeChallengeId === 'short-range') {
    return { fireRangeCap: SHORT_RANGE_MAX }
  }
  return {}
}

export function collectTargetingModifiers(
  state: GameState,
  spec: TargetingCoreSpec,
): TargetingStatModifier[] {
  return [
    targetingServosContribution(state),
    matterTraverseContribution(state),
    frameSensorTargetingContribution(state),
    relicTargetingContribution(state, spec),
    directiveTargetingContribution(state),
    researchTargetingContribution(state),
    challengeTargetingContribution(state),
  ]
}

export function composeTargetingModifiers(mods: TargetingStatModifier[]): TargetingStatModifier {
  const out: TargetingStatModifier = {
    fireRangeMult: 1,
    fireRangeAdd: 0,
    acquisitionRangeMult: 1,
    acquisitionRangeAdd: 0,
    slewRateMult: 1,
    slewRateAdd: 0,
    firingArcAddDeg: 0,
  }
  let fireRangeCap: number | undefined
  for (const mod of mods) {
    out.fireRangeMult = (out.fireRangeMult ?? 1) * (mod.fireRangeMult ?? 1)
    out.fireRangeAdd = (out.fireRangeAdd ?? 0) + (mod.fireRangeAdd ?? 0)
    out.acquisitionRangeMult = (out.acquisitionRangeMult ?? 1) * (mod.acquisitionRangeMult ?? 1)
    out.acquisitionRangeAdd = (out.acquisitionRangeAdd ?? 0) + (mod.acquisitionRangeAdd ?? 0)
    out.slewRateMult = (out.slewRateMult ?? 1) * (mod.slewRateMult ?? 1)
    out.slewRateAdd = (out.slewRateAdd ?? 0) + (mod.slewRateAdd ?? 0)
    out.firingArcAddDeg = (out.firingArcAddDeg ?? 0) + (mod.firingArcAddDeg ?? 0)
    if (mod.fireRangeCap != null && Number.isFinite(mod.fireRangeCap)) {
      fireRangeCap = fireRangeCap == null ? mod.fireRangeCap : Math.min(fireRangeCap, mod.fireRangeCap)
    }
  }
  if (fireRangeCap != null) out.fireRangeCap = fireRangeCap
  return out
}

function specOf(core: CombatUnit | TargetingCoreSpec): TargetingCoreSpec {
  if ('moduleId' in core && core.moduleId) return core
  return {
    moduleId: (core as CombatUnit).coreModuleId ?? '',
    coreInstanceId: (core as CombatUnit).coreInstanceId,
  }
}

export function profileForCore(core: CombatUnit | TargetingCoreSpec): CoreTargetingProfile {
  return targetingProfileFor(specOf(core).moduleId)
}

export function applyTargetingStats(
  profile: CoreTargetingProfile,
  mods: TargetingStatModifier,
): { fire: number; acquire: number; slew: number; arc: number } {
  let fire = profile.fireRange * (mods.fireRangeMult ?? 1) + (mods.fireRangeAdd ?? 0)
  if (mods.fireRangeCap != null && Number.isFinite(mods.fireRangeCap)) {
    fire = Math.min(fire, mods.fireRangeCap)
  }
  fire = Math.max(1, fire)
  const authoredAcquire =
    profile.acquisitionRange * (mods.acquisitionRangeMult ?? 1) + (mods.acquisitionRangeAdd ?? 0)
  const acquire = Math.max(fire * ACQUISITION_FIRE_GAP, authoredAcquire)
  const slew = Math.max(1, profile.slewRateDegPerSec * (mods.slewRateMult ?? 1) + (mods.slewRateAdd ?? 0))
  const arc = Math.max(8, profile.firingArcDeg + (mods.firingArcAddDeg ?? 0))
  return { fire, acquire, slew, arc }
}

function appliedStats(state: GameState, core: CombatUnit | TargetingCoreSpec) {
  const profile = profileForCore(core)
  const mods = composeTargetingModifiers(collectTargetingModifiers(state, specOf(core)))
  return { profile, ...applyTargetingStats(profile, mods) }
}

export function effectiveCoreFireRange(state: GameState, core: CombatUnit | TargetingCoreSpec): number {
  return appliedStats(state, core).fire
}

export function effectiveCoreAcquisitionRange(state: GameState, core: CombatUnit | TargetingCoreSpec): number {
  return appliedStats(state, core).acquire
}

export function effectiveCoreSlewRate(state: GameState, core: CombatUnit | TargetingCoreSpec): number {
  return appliedStats(state, core).slew
}

export function effectiveCoreFiringArc(state: GameState, core: CombatUnit | TargetingCoreSpec): number {
  return appliedStats(state, core).arc
}

export function storedCoreDoctrine(
  state: Pick<GameState, 'shipyard'>,
  coreInstanceId: string | undefined,
): TargetingDoctrineId | null {
  if (!coreInstanceId) return null
  const instance = resolveCoreInstance(state, coreInstanceId)
  const value = instance?.targetingDoctrine
  if (value === 'threat' || value === 'focus' || value === 'execution' || value === 'heavy' || value === 'shield' || value === 'cluster') {
    return value
  }
  return null
}

export function effectiveCoreTargetingDoctrine(
  state: GameState,
  core: CombatUnit | TargetingCoreSpec,
): TargetingDoctrineId {
  const profile = profileForCore(core)
  const stored = storedCoreDoctrine(state, specOf(core).coreInstanceId)
  if (!canConfigureTargetingDoctrine(state)) return profile.defaultDoctrine
  if (stored && (profile.allowedDoctrines as readonly string[]).includes(stored)) return stored
  return profile.defaultDoctrine
}

export function switchAdvantageFor(
  state: GameState,
  core: CombatUnit,
): number {
  const profile = profileForCore(core)
  let advantage = profile.switchAdvantage
  if (coreIsStronglyCommitted(state, core) && profile.committedSwitchAdvantage != null) {
    advantage = profile.committedSwitchAdvantage
  }
  if (
    (core.coreModuleId ?? specOf(core).moduleId) === 'pulse-cannon' &&
    hasMasteryEffect(state, 'pulse-cannon', 'pulse-adaptive-lock')
  ) {
    advantage = Math.max(advantage, PULSE_ADAPTIVE_LOCK_ADVANTAGE)
  }
  return advantage
}

export function switchRequiredGain(currentScore: number, switchAdvantage: number): number {
  return Math.max(HYSTERESIS_ABSOLUTE_FLOOR, Math.abs(currentScore) * switchAdvantage)
}

export function beatsHysteresis(
  bestScore: number,
  currentScore: number,
  switchAdvantage: number,
): boolean {
  return bestScore > currentScore + switchRequiredGain(currentScore, switchAdvantage) + 1e-9
}

/**
 * Heavy Lance's 2.8s seed is the BASE charge/cycle. Scale it by the same
 * effective-cooldown ratio the built weapon already uses versus the module
 * catalogue base. Charge is the cycle — do not also apply a full cooldown.
 */
export function effectiveChargeDurationSec(_state: GameState, core: CombatUnit): number {
  const profile = profileForCore(core)
  if (!profile.requiresCharge || profile.chargeDurationSec <= 0) return 0
  const weapon = core.weapons[0]
  const module = getModule(core.coreModuleId ?? specOf(core).moduleId)
  const baseCd = module?.weapon?.cooldown
  if (!weapon || !baseCd || baseCd <= 0) return profile.chargeDurationSec
  return Math.max(0.05, profile.chargeDurationSec * (weapon.cooldown / baseCd))
}

export function isTargetableEnemy(_state: GameState, unit: CombatUnit | undefined | null): boolean {
  if (!unit) return false
  if (unit.side !== 'enemy') return false
  if (unit.hull <= 0) return false
  if (unit.untargetable) return false
  if (unit.isCore) return false
  if (unit.targetable === false) return false
  return true
}

export function findEnemy(state: GameState, id: string | undefined): CombatUnit | undefined {
  if (!id) return undefined
  return state.combat.enemyUnits.find((u) => u.id === id)
}

export function coreIsBeaming(state: GameState, core: CombatUnit): boolean {
  return (state.combat.beams ?? []).some((beam) => beam.fromId === core.id && beam.side === 'player')
}

export function coreIsCharging(core: CombatUnit): boolean {
  return core.weapons.some((w) => w.telegraphLeft > 0 || w.chargeReady)
}

export function coreIsStronglyCommitted(state: GameState, core: CombatUnit): boolean {
  const profile = profileForCore(core)
  if (profile.requiresCharge && coreIsCharging(core)) return true
  if (profile.requiresStabilisedAim && profile.profileId === 'phase-beam' && coreIsBeaming(state, core)) {
    return true
  }
  if (profile.profileId === 'phase-beam' && phaseRampEstablished(state, core)) return true
  return false
}

export function orbitSpeedFactor(state: GameState, core: CombatUnit): number {
  const profile = profileForCore(core)
  if (!coreIsStronglyCommitted(state, core)) return 1
  return profile.committedOrbitFactor
}

function effectiveHp(unit: CombatUnit): number {
  const armor = Math.max(0, unit.armor)
  return Math.max(0, unit.hull) * (1 + armor / (armor + 40)) + Math.max(0, unit.shield)
}

function outgoingDps(unit: CombatUnit): number {
  return unit.weapons.reduce((sum, w) => sum + w.damage / Math.max(0.2, w.cooldown), 0)
}

function timeUntilAttack(unit: CombatUnit): number {
  const dist = distanceToHive(unit.x, unit.y)
  const park = Math.max(0, unit.engageRange)
  const remaining = Math.max(0, dist - park)
  return remaining / Math.max(8, unit.speed)
}

export function compareTargetTie(a: CombatUnit, b: CombatUnit): number {
  const wa = a.sourceWave ?? 0
  const wb = b.sourceWave ?? 0
  if (wa !== wb) return wa - wb
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

function maxDurability(unit: CombatUnit): number {
  const armor = Math.max(0, unit.armor)
  return Math.max(1, unit.hullMax * (1 + armor / (armor + 40)) + Math.max(0, unit.shieldMax))
}

function snapshotFocusCommitments(state: GameState): FocusCommitmentSnapshot {
  const coreVotes: FocusCommitmentSnapshot['coreVotes'] = []
  const fire: FocusCommitmentSnapshot['fire'] = []
  for (const core of state.combat.playerUnits) {
    if (!core.isCore) continue
    if (core.currentTargetId) coreVotes.push({ coreId: core.id, enemyId: core.currentTargetId })
  }
  for (const shot of state.combat.projectiles) {
    if (shot.side === 'player' && shot.toId) {
      fire.push({ sourceId: shot.fromId, enemyId: shot.toId, weight: 0.35 })
    }
  }
  for (const beam of state.combat.beams ?? []) {
    if (beam.side === 'player' && beam.toId) {
      fire.push({ sourceId: beam.fromId, enemyId: beam.toId, weight: 0.6 })
    }
  }
  return { coreVotes, fire }
}

export function focusWeightExcluding(
  snapshot: FocusCommitmentSnapshot,
  enemyId: string,
  excludeCoreId: string | undefined,
): number {
  let weight = 0
  for (const vote of snapshot.coreVotes) {
    if (vote.coreId === excludeCoreId) continue
    if (vote.enemyId === enemyId) weight += 1.4
  }
  for (const row of snapshot.fire) {
    if (row.sourceId === excludeCoreId) continue
    if (row.enemyId === enemyId) weight += row.weight
  }
  return weight
}

export function buildSharedTargetMetrics(state: GameState, enemies: CombatUnit[]): Map<string, SharedTargetMetrics> {
  return buildEvalBundle(state, enemies).metrics
}

export function buildEvalBundle(state: GameState, enemies: CombatUnit[]): EvalBundle {
  const focus = snapshotFocusCommitments(state)
  const metrics = new Map<string, SharedTargetMetrics>()
  for (const unit of enemies) {
    const ehp = effectiveHp(unit)
    const hullFrac = unit.hullMax > 0 ? unit.hull / unit.hullMax : 0
    const shieldFrac = unit.shieldMax > 0 ? unit.shield / unit.shieldMax : 0
    const remainingFrac = ehp / maxDurability(unit)
    const dps = outgoingDps(unit)
    const eta = timeUntilAttack(unit)
    const urgency = 1 / (0.35 + eta)
    const proximity = 1 / (1 + distanceToHive(unit.x, unit.y) / 80)
    const roleBoost =
      unit.role === 'sniper' || unit.role === 'shield' ? 1.35 : unit.role === 'juggernaut' ? 1.1 : 1
    const statusBoost = unit.isBoss || unit.role === 'boss' ? 1.25 : 1
    const danger = dps * urgency * roleBoost * statusBoost
    let clusterCount = 0
    let clusterWeight = 0
    let clusterMass = ehp
    const packLead = hasMasteryEffect(state, 'flak-array', 'flak-pack-prediction') ? 0.45 : 0
    for (const other of enemies) {
      if (other.id === unit.id) continue
      const ox = other.x + Math.sin(other.heading ?? 0) * other.speed * packLead
      const oy = other.y + Math.cos(other.heading ?? 0) * other.speed * packLead
      const ux = unit.x + Math.sin(unit.heading ?? 0) * unit.speed * packLead
      const uy = unit.y + Math.cos(unit.heading ?? 0) * unit.speed * packLead
      if (distanceBetween({ x: ux, y: uy }, { x: ox, y: oy }) <= CLUSTER_NEIGHBOUR_RADIUS) {
        clusterCount += 1
        const otherHp = effectiveHp(other)
        clusterMass += otherHp
        clusterWeight += 1 + outgoingDps(other) * 0.05 + otherHp * 0.02
      }
    }
    const shieldPresent = unit.shield > 1 ? unit.shield * (0.45 + shieldFrac) : 0
    const heavyWeight =
      ehp * (1 + Math.max(0, unit.armor) / 20) * (unit.role === 'juggernaut' ? 1.35 : 1) * statusBoost
    const finishable =
      1 / (8 + ehp) + (1 - remainingFrac) * 0.7 + (1 - hullFrac) * 0.15
    metrics.set(unit.id, {
      ehp,
      hullFrac,
      shieldFrac,
      remainingFrac,
      armor: unit.armor,
      danger,
      urgency,
      proximity,
      clusterCount,
      clusterWeight,
      clusterMass,
      focusWeight: 0,
      shieldPresent,
      heavyWeight,
      finishable,
    })
  }
  return { enemies, metrics, focus }
}

export function scoreDoctrine(
  doctrine: TargetingDoctrineId,
  unit: CombatUnit,
  metrics: SharedTargetMetrics,
): number {
  const bossNudge = unit.isBoss || unit.role === 'boss' ? 8 : 0
  switch (doctrine) {
    case 'threat':
      return metrics.danger * 12 + metrics.urgency * 18 + metrics.proximity * 10 + bossNudge
    case 'focus':
      if (metrics.focusWeight >= 1) {
        return 1_000 + metrics.focusWeight * 40 + metrics.danger * 4 + bossNudge * 0.4
      }
      return scoreDoctrine('threat', unit, metrics)
    case 'execution':
      return (
        metrics.finishable * 80 +
        (1 - metrics.hullFrac) * 12 +
        metrics.danger * 0.08 -
        metrics.ehp * 0.03
      )
    case 'heavy':
      return metrics.heavyWeight * 0.12 + metrics.armor * 1.4 + bossNudge * 0.6
    case 'shield':
      return metrics.shieldPresent * 0.45 + metrics.shieldFrac * 30
    case 'cluster':
      return (
        metrics.clusterCount * 18 +
        metrics.clusterWeight * 8 +
        metrics.clusterMass * 0.05 +
        metrics.danger * 0.08 +
        metrics.proximity * 2
      )
  }
}

function metricsForCore(
  bundle: EvalBundle,
  core: CombatUnit,
  enemy: CombatUnit,
): SharedTargetMetrics | undefined {
  const base = bundle.metrics.get(enemy.id)
  if (!base) return undefined
  return {
    ...base,
    focusWeight: focusWeightExcluding(bundle.focus, enemy.id, core.id),
  }
}

function legalCandidates(state: GameState, core: CombatUnit, bundle: EvalBundle): CombatUnit[] {
  return bundle.enemies.filter((enemy) => isAcquirableTarget(state, core, enemy, false))
}

function scoringDoctrineFor(
  _state: GameState,
  core: CombatUnit,
  bundle: EvalBundle,
  doctrine: TargetingDoctrineId,
  candidates: CombatUnit[],
): TargetingDoctrineId {
  if (doctrine === 'focus') {
    const otherCommit = candidates.some(
      (enemy) => focusWeightExcluding(bundle.focus, enemy.id, core.id) >= 1,
    )
    if (!otherCommit) return 'threat'
  }
  if (doctrine === 'shield') {
    const shielded = candidates.some((enemy) => {
      const metrics = bundle.metrics.get(enemy.id)
      return Boolean(metrics && metrics.shieldPresent > 0)
    })
    if (!shielded) return 'threat'
  }
  return doctrine
}

export function acquisitionLimit(state: GameState, core: CombatUnit, retaining: boolean): number {
  const acquire = effectiveCoreAcquisitionRange(state, core)
  return retaining ? acquire * ACQUISITION_RETENTION : acquire
}

export function isAcquirableTarget(
  state: GameState,
  core: CombatUnit,
  target: CombatUnit,
  retaining: boolean,
): boolean {
  if (!isTargetableEnemy(state, target)) return false
  return distanceBetween(core, target) <= acquisitionLimit(state, core, retaining) + 1e-6
}

export function pickBestTarget(
  state: GameState,
  core: CombatUnit,
  bundle: EvalBundle,
  doctrine: TargetingDoctrineId,
): { target: CombatUnit; score: number } | null {
  const candidates = legalCandidates(state, core, bundle)
  const used = scoringDoctrineFor(state, core, bundle, doctrine, candidates)
  let best: CombatUnit | null = null
  let bestScore = -Infinity
  for (const enemy of candidates) {
    const metrics = metricsForCore(bundle, core, enemy)
    if (!metrics) continue
    const score = scoreDoctrine(used, enemy, metrics)
    if (!best) {
      best = enemy
      bestScore = score
      continue
    }
    if (score > bestScore + 1e-9) {
      best = enemy
      bestScore = score
    } else if (Math.abs(score - bestScore) <= 1e-9 && compareTargetTie(enemy, best) < 0) {
      best = enemy
      bestScore = score
    }
  }
  return best ? { target: best, score: bestScore } : null
}

export function currentTargetScore(
  core: CombatUnit,
  target: CombatUnit,
  bundle: EvalBundle,
  doctrine: TargetingDoctrineId,
  usedDoctrine?: TargetingDoctrineId,
): number {
  const metrics = metricsForCore(bundle, core, target)
  if (!metrics) return -Infinity
  return scoreDoctrine(usedDoctrine ?? doctrine, target, metrics)
}

function suppressDiscretionarySwitch(state: GameState, core: CombatUnit): boolean {
  return coreIsStronglyCommitted(state, core)
}

export function evaluateCoreTarget(
  state: GameState,
  core: CombatUnit,
  bundle: EvalBundle,
): void {
  const doctrine = effectiveCoreTargetingDoctrine(state, core)
  const current = findEnemy(state, core.currentTargetId)
  const currentValid = current ? isAcquirableTarget(state, core, current, true) : false
  if (!currentValid && core.currentTargetId) {
    clearCoreTarget(core)
  }

  const candidates = legalCandidates(state, core, bundle)
  const used = scoringDoctrineFor(state, core, bundle, doctrine, candidates)
  const best = pickBestTarget(state, core, bundle, doctrine)
  if (!best) {
    if (!currentValid) clearCoreTarget(core)
    return
  }

  if (!currentValid || !current) {
    setCoreTarget(core, best.target.id)
    return
  }

  if (best.target.id === current.id) return
  if (suppressDiscretionarySwitch(state, core)) return

  const currentScore = currentTargetScore(core, current, bundle, doctrine, used)
  if (beatsHysteresis(best.score, currentScore, switchAdvantageFor(state, core))) {
    setCoreTarget(core, best.target.id)
  }
}

export function clearCoreTarget(core: CombatUnit): void {
  core.currentTargetId = undefined
  core.targetLockTime = 0
  core.heldShotNoted = false
  for (const weapon of core.weapons) {
    weapon.telegraphLeft = 0
    weapon.telegraphToId = undefined
    weapon.chargeReady = false
  }
}

export function setCoreTarget(core: CombatUnit, id: string): void {
  if (core.currentTargetId === id) return
  core.heldShotNoted = false
  const tel = ensureTargetingTelemetry(core)
  if (core.currentTargetId) tel.targetSwitches += 1
  else tel.initialAcquisitions += 1
  core.currentTargetId = id
  core.targetLockTime = 0
  for (const weapon of core.weapons) {
    weapon.telegraphLeft = 0
    weapon.telegraphToId = undefined
    weapon.chargeReady = false
  }
}

function predictedWorldPoint(unit: CombatUnit, leadSec: number): { x: number; y: number } {
  return {
    x: unit.x + Math.sin(unit.heading ?? 0) * unit.speed * leadSec,
    y: unit.y + Math.cos(unit.heading ?? 0) * unit.speed * leadSec,
  }
}

/** Hive-relative orbital angle that centres the outward firing arc on the target. */
export function desiredOrbitAngle(state: GameState, core: CombatUnit, target: CombatUnit): number {
  const moduleId = core.coreModuleId ?? specOf(core).moduleId
  if (moduleId === 'heavy-lance' && hasMasteryEffect(state, 'heavy-lance', 'heavy-predictive-traverse')) {
    return hiveBearingOf(predictedWorldPoint(target, HEAVY_PREDICT_LEAD_SEC))
  }
  if (moduleId === 'flak-array' && hasMasteryEffect(state, 'flak-array', 'flak-pack-prediction')) {
    const pack = state.combat.enemyUnits.filter(
      (unit) => isTargetableEnemy(state, unit) && distanceBetween(target, unit) <= CLUSTER_NEIGHBOUR_RADIUS,
    )
    if (pack.length > 0) {
      let x = 0
      let y = 0
      for (const unit of pack) {
        const predicted = predictedWorldPoint(unit, FLAK_PACK_LEAD_SEC)
        x += predicted.x
        y += predicted.y
      }
      return hiveBearingOf({ x: x / pack.length, y: y / pack.length })
    }
    return hiveBearingOf(predictedWorldPoint(target, FLAK_PACK_LEAD_SEC))
  }
  return hiveBearingOf(target)
}

export function firingSolution(state: GameState, core: CombatUnit, target: CombatUnit): FiringSolution {
  applyPlayerCoreOrbit(core)
  const profile = profileForCore(core)
  const fire = effectiveCoreFireRange(state, core)
  const acquire = effectiveCoreAcquisitionRange(state, core)
  const arc = degToRad(effectiveCoreFiringArc(state, core))
  const distance = distanceBetween(core, target)
  const facing = playerCoreOutwardFacing(core)
  const bearing = bearingBetween(core, target)
  const desired = hiveBearingOf(target)
  const delta = shortestAngleDelta(core.orbitAngle ?? facing, desired)
  const inAcquisition = distance <= acquire + 1e-6
  const inFireRange = distance <= fire + 1e-6
  const inArc = isWithinArc(facing, bearing, arc)
  const orbitSettled = Math.abs(delta) <= degToRad(profile.aimToleranceDeg) + 1e-6
  const stabilised = inArc && orbitSettled
  const canTraverseFire = profile.firesWhileTraversing && inFireRange && inArc
  const canStabilisedFire =
    inFireRange && inArc && (profile.requiresStabilisedAim ? stabilised : true)
  const canFire = canTraverseFire || canStabilisedFire
  return {
    target,
    distance,
    bearing,
    delta,
    inAcquisition,
    inFireRange,
    inArc,
    stabilised,
    canFire,
    canStartCharge: profile.requiresCharge && inFireRange && inArc && stabilised,
    canReleaseCharge: profile.requiresCharge && inFireRange && inArc && stabilised,
    canConnectBeam: profile.requiresStabilisedAim && !profile.requiresCharge && inFireRange && inArc && stabilised,
  }
}

export function slewCoreToward(state: GameState, core: CombatUnit, dt: number): { slewLimited: boolean } {
  applyPlayerCoreOrbit(core)
  const target = findEnemy(state, core.currentTargetId)
  if (!target || !isTargetableEnemy(state, target)) return { slewLimited: false }
  const desired = desiredOrbitAngle(state, core, target)
  const rateDeg = effectiveCoreSlewRate(state, core) * orbitSpeedFactor(state, core)
  const maxDelta = degToRad(rateDeg) * Math.max(0, dt)
  const before = core.orbitAngle ?? playerCoreOutwardFacing(core)
  const remaining = Math.abs(shortestAngleDelta(before, desired))
  core.orbitAngle = slewHeading(before, desired, maxDelta)
  applyPlayerCoreOrbit(core)
  return { slewLimited: remaining > maxDelta + 1e-6 }
}

export function tickPlayerCoreTargeting(state: GameState, dt: number): void {
  if (dt < 0) return
  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId)
  const enemies = state.combat.enemyUnits.filter((u) => isTargetableEnemy(state, u))
  const enemiesExist = enemies.length > 0
  const sim = state.combat.simTime

  for (const core of cores) {
    const current = findEnemy(state, core.currentTargetId)
    const valid = current ? isAcquirableTarget(state, core, current, true) : false
    if (!valid && core.currentTargetId) clearCoreTarget(core)
  }

  const needEval = cores.some((core) => {
    const current = findEnemy(state, core.currentTargetId)
    if (!current) return true
    return sim >= (core.nextTargetEvalAt ?? 0)
  })
  const bundle: EvalBundle | null = needEval ? buildEvalBundle(state, enemies) : null

  for (const core of cores) {
    const tel = ensureTargetingTelemetry(core)
    const valid = Boolean(findEnemy(state, core.currentTargetId))
    const due = sim >= (core.nextTargetEvalAt ?? 0)
    if (bundle && (due || !valid)) {
      evaluateCoreTarget(state, core, bundle)
      if (due) core.nextTargetEvalAt = sim + TARGET_EVAL_INTERVAL
    }

    const slew = slewCoreToward(state, core, dt)
    if (slew.slewLimited) tel.timeSlewLimited += dt

    const acquired = findEnemy(state, core.currentTargetId)
    if (acquired && isTargetableEnemy(state, acquired)) {
      if (dt > 0) core.targetLockTime = (core.targetLockTime ?? 0) + dt
      const sol = firingSolution(state, core, acquired)
      if (!sol.inFireRange) tel.timeAcquiredOutsideFire += dt
      if (coreIsBeaming(state, core)) tel.timeActivelyFiring += dt
    } else if (enemiesExist) {
      tel.timeNoTargetWhileEnemies += dt
      tel.acquisitionDelayAccum += dt
    }
  }
}

export function noteShotHeld(core: CombatUnit): void {
  const ready = core.weapons.some(
    (weapon) => weapon.cooldownLeft <= 0 || weapon.chargeReady || weapon.telegraphLeft > 0,
  )
  if (!ready) {
    core.heldShotNoted = false
    return
  }
  if (core.heldShotNoted) return
  core.heldShotNoted = true
  ensureTargetingTelemetry(core).shotsHeldIllegalSolution += 1
}

export function noteCoreFiring(core: CombatUnit, dt: number): void {
  ensureTargetingTelemetry(core).timeActivelyFiring += dt
}

export function noteCoreShotFired(core: CombatUnit): void {
  ensureTargetingTelemetry(core).shotsFired += 1
  core.heldShotNoted = false
}

export function playerCoreTarget(state: GameState, core: CombatUnit): CombatUnit | null {
  const target = findEnemy(state, core.currentTargetId)
  if (!target || !isTargetableEnemy(state, target)) {
    if (core.currentTargetId) clearCoreTarget(core)
    return null
  }
  if (!isAcquirableTarget(state, core, target, true)) {
    clearCoreTarget(core)
    return null
  }
  return target
}

export function physicalCoreLabel(state: Pick<GameState, 'shipyard'>, instance: CoreInstance): string {
  const name = getModule(instance.moduleId)?.name ?? instance.moduleId
  const copies = (state.shipyard.coreInstances ?? []).filter((row) => row.moduleId === instance.moduleId).length
  if (copies <= 1) return name
  return `${name} #${coreInstanceCopyNumber(state, instance.id)}`
}

export interface TargetingCoreReadout {
  coreInstanceId: string
  moduleId: string
  slot: number
  name: string
  label: string
  doctrine: TargetingDoctrineId
  fireRange: number
  acquisitionRange: number
  firingArcDeg: number
  slewRateDegPerSec: number
  allowedDoctrines: readonly TargetingDoctrineId[]
  currentTargetId?: string
}

export function targetCapableLoadoutCores(state: GameState): TargetingCoreReadout[] {
  const out: TargetingCoreReadout[] = []
  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const moduleId = state.shipyard.modules[slot]!
    if (!isTargetingCapableCoreModule(moduleId)) continue
    const mod = getModule(moduleId)
    if (!mod) continue
    const instance = coreInstanceAtSlot(state, slot)
    if (!instance) continue
    const spec = { moduleId, coreInstanceId: instance.id }
    const combat = state.combat.playerUnits.find((u) => u.coreInstanceId === instance.id || u.coreSlot === slot)
    out.push({
      coreInstanceId: instance.id,
      moduleId,
      slot,
      name: mod.name,
      label: physicalCoreLabel(state, instance),
      doctrine: effectiveCoreTargetingDoctrine(state, spec),
      fireRange: effectiveCoreFireRange(state, spec),
      acquisitionRange: effectiveCoreAcquisitionRange(state, spec),
      firingArcDeg: effectiveCoreFiringArc(state, spec),
      slewRateDegPerSec: effectiveCoreSlewRate(state, spec),
      allowedDoctrines: targetingProfileFor(moduleId).allowedDoctrines,
      currentTargetId: combat?.currentTargetId,
    })
  }
  return out
}

export interface CombatOverlayCoreGeom {
  coreInstanceId: string
  moduleId: string
  x: number
  y: number
  heading: number
  fireRange: number
  acquisitionRange: number
  firingArcDeg: number
  currentTargetId?: string
  targetX?: number
  targetY?: number
  fireable: boolean
}

export function combatOverlayGeometry(state: GameState): CombatOverlayCoreGeom[] {
  const out: CombatOverlayCoreGeom[] = []
  for (const core of state.combat.playerUnits) {
    if (!core.isCore || !core.coreModuleId) continue
    const target = findEnemy(state, core.currentTargetId)
    const sol = target && isTargetableEnemy(state, target) ? firingSolution(state, core, target) : null
    out.push({
      coreInstanceId: core.coreInstanceId ?? core.id,
      moduleId: core.coreModuleId,
      x: core.x,
      y: core.y,
      heading: playerCoreOutwardFacing(core),
      fireRange: effectiveCoreFireRange(state, core),
      acquisitionRange: effectiveCoreAcquisitionRange(state, core),
      firingArcDeg: effectiveCoreFiringArc(state, core),
      currentTargetId: core.currentTargetId,
      targetX: target?.x,
      targetY: target?.y,
      fireable: Boolean(sol?.canFire || sol?.canConnectBeam || sol?.canReleaseCharge),
    })
  }
  return out
}

export { wrapTau, radToDeg, degToRad, headingToScreenFacing, playerCoreOutwardFacing, applyPlayerCoreOrbit } from './geometry'
export { isTargetingCapableCoreModule } from './targetingProfiles'
