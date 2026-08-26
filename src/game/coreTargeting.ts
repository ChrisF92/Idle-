/**
 * Persistent Core targeting: Doctrine → current target → hysteresis →
 * acquisition → mechanical slew → legal firing solution.
 *
 * Presentation must derive heading from this simulation state. Do not aim
 * independently in the battlefield renderer.
 */

import { coreInstanceAtSlot, coreInstanceCopyNumber, resolveCoreInstance } from './coreInstances'
import { getModule } from './catalog'
import {
  bearingBetween,
  degToRad,
  distanceBetween,
  distanceToHive,
  isWithinArc,
  shortestAngleDelta,
  slewHeading,
} from './geometry'
import {
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

/** Canonical Research node. PR9 authors the tree; PR2 only checks completion. */
export const FIRE_CONTROL_DOCTRINE_RESEARCH_ID = 'd1-fire-control-doctrine'

export const TARGET_EVAL_INTERVAL = 0.1
export const CLUSTER_NEIGHBOUR_RADIUS = 60
export const ACQUISITION_RETENTION = 1.05
export const DEFAULT_SWITCH_ADVANTAGE = 0.25

export interface TargetingCoreSpec {
  moduleId: string
  coreInstanceId?: string
}

export interface TargetingStatModifier {
  fireRangeMult?: number
  fireRangeAdd?: number
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
  focusWeight: number
  shieldPresent: number
  heavyWeight: number
  finishable: number
}

interface EvalBundle {
  enemies: CombatUnit[]
  metrics: Map<string, SharedTargetMetrics>
}

export function emptyTargetingTelemetry(): CoreTargetingTelemetry {
  return {
    targetSwitches: 0,
    timeNoTargetWhileEnemies: 0,
    timeAcquiredOutsideFire: 0,
    timeSlewLimited: 0,
    timeActivelyFiring: 0,
    shotsHeldIllegalSolution: 0,
    acquisitionDelayAccum: 0,
  }
}

export function ensureTargetingTelemetry(unit: CombatUnit): CoreTargetingTelemetry {
  if (!unit.targetingTelemetry) unit.targetingTelemetry = emptyTargetingTelemetry()
  return unit.targetingTelemetry
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
export function targetingServosContribution(_state: GameState): TargetingStatModifier {
  return {}
}

/** PR4 Frames / Sensor Array. */
export function frameSensorTargetingContribution(_state: GameState): TargetingStatModifier {
  return {}
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
 */
export function challengeTargetingContribution(_state: GameState): TargetingStatModifier {
  return {}
}

export function collectTargetingModifiers(
  state: GameState,
  spec: TargetingCoreSpec,
): TargetingStatModifier[] {
  return [
    targetingServosContribution(state),
    frameSensorTargetingContribution(state),
    relicTargetingContribution(state, spec),
    directiveTargetingContribution(state),
    researchTargetingContribution(state),
    challengeTargetingContribution(state),
  ]
}

export function composeTargetingModifiers(mods: TargetingStatModifier[]): TargetingStatModifier {
  const out: Required<TargetingStatModifier> = {
    fireRangeMult: 1,
    fireRangeAdd: 0,
    acquisitionRangeMult: 1,
    acquisitionRangeAdd: 0,
    slewRateMult: 1,
    slewRateAdd: 0,
    firingArcAddDeg: 0,
  }
  for (const mod of mods) {
    out.fireRangeMult *= mod.fireRangeMult ?? 1
    out.fireRangeAdd += mod.fireRangeAdd ?? 0
    out.acquisitionRangeMult *= mod.acquisitionRangeMult ?? 1
    out.acquisitionRangeAdd += mod.acquisitionRangeAdd ?? 0
    out.slewRateMult *= mod.slewRateMult ?? 1
    out.slewRateAdd += mod.slewRateAdd ?? 0
    out.firingArcAddDeg += mod.firingArcAddDeg ?? 0
  }
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

function appliedStats(state: GameState, core: CombatUnit | TargetingCoreSpec) {
  const profile = profileForCore(core)
  const mods = composeTargetingModifiers(collectTargetingModifiers(state, specOf(core)))
  const fire = Math.max(1, profile.fireRange * (mods.fireRangeMult ?? 1) + (mods.fireRangeAdd ?? 0))
  const acquire = Math.max(
    fire + 1,
    profile.acquisitionRange * (mods.acquisitionRangeMult ?? 1) + (mods.acquisitionRangeAdd ?? 0),
  )
  const slew = Math.max(1, profile.slewRateDegPerSec * (mods.slewRateMult ?? 1) + (mods.slewRateAdd ?? 0))
  const arc = Math.max(8, profile.firingArcDeg + (mods.firingArcAddDeg ?? 0))
  return { profile, fire, acquire, slew, arc }
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
  if (coreIsStronglyCommitted(state, core) && profile.committedSwitchAdvantage != null) {
    return profile.committedSwitchAdvantage
  }
  return profile.switchAdvantage
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

function focusCommitments(state: GameState): Map<string, number> {
  const weights = new Map<string, number>()
  const add = (id: string | undefined, w: number) => {
    if (!id) return
    weights.set(id, (weights.get(id) ?? 0) + w)
  }
  for (const core of state.combat.playerUnits) {
    if (!core.isCore) continue
    add(core.currentTargetId, 1)
  }
  for (const shot of state.combat.projectiles) {
    if (shot.side === 'player') add(shot.toId, 0.35)
  }
  for (const beam of state.combat.beams ?? []) {
    if (beam.side === 'player') add(beam.toId, 0.6)
  }
  return weights
}

export function buildSharedTargetMetrics(state: GameState, enemies: CombatUnit[]): Map<string, SharedTargetMetrics> {
  const focus = focusCommitments(state)
  const metrics = new Map<string, SharedTargetMetrics>()
  for (const unit of enemies) {
    const ehp = effectiveHp(unit)
    const hullFrac = unit.hullMax > 0 ? unit.hull / unit.hullMax : 0
    const shieldFrac = unit.shieldMax > 0 ? unit.shield / unit.shieldMax : 0
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
    for (const other of enemies) {
      if (other.id === unit.id) continue
      if (distanceBetween(unit, other) <= CLUSTER_NEIGHBOUR_RADIUS) {
        clusterCount += 1
        clusterWeight += 1 + outgoingDps(other) * 0.05
      }
    }
    const shieldPresent = unit.shield > 1 ? unit.shield * (0.45 + shieldFrac) : 0
    const heavyWeight =
      ehp * (1 + Math.max(0, unit.armor) / 20) * (unit.role === 'juggernaut' ? 1.35 : 1) * statusBoost
    const finishable = 1 / (8 + ehp) + (1 - hullFrac)
    metrics.set(unit.id, {
      ehp,
      hullFrac,
      shieldFrac,
      armor: unit.armor,
      danger,
      urgency,
      proximity,
      clusterCount,
      clusterWeight,
      focusWeight: focus.get(unit.id) ?? 0,
      shieldPresent,
      heavyWeight,
      finishable,
    })
  }
  return metrics
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
      return metrics.finishable * 80 + (1 - metrics.hullFrac) * 40 - metrics.ehp * 0.02
    case 'heavy':
      return metrics.heavyWeight * 0.12 + metrics.armor * 1.4 + bossNudge * 0.6
    case 'shield':
      return metrics.shieldPresent * 0.45 + metrics.shieldFrac * 30
    case 'cluster':
      return metrics.clusterCount * 18 + metrics.clusterWeight * 8 + metrics.proximity * 2
  }
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
  let best: CombatUnit | null = null
  let bestScore = -Infinity
  for (const enemy of bundle.enemies) {
    if (!isAcquirableTarget(state, core, enemy, false)) continue
    const metrics = bundle.metrics.get(enemy.id)
    if (!metrics) continue
    const score = scoreDoctrine(doctrine, enemy, metrics)
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
): number {
  const metrics = bundle.metrics.get(target.id)
  if (!metrics) return -Infinity
  return scoreDoctrine(doctrine, target, metrics)
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
  if (!currentValid) {
    if (core.currentTargetId) {
      core.currentTargetId = undefined
      for (const weapon of core.weapons) {
        weapon.telegraphLeft = 0
        weapon.telegraphToId = undefined
        weapon.chargeReady = false
      }
    }
  }

  const best = pickBestTarget(state, core, bundle, doctrine)
  if (!best) {
    if (!currentValid) core.currentTargetId = undefined
    return
  }

  if (!currentValid || !current) {
    setCoreTarget(core, best.target.id)
    return
  }

  if (best.target.id === current.id) return
  if (suppressDiscretionarySwitch(state, core)) return

  const currentScore = currentTargetScore(core, current, bundle, doctrine)
  const need = currentScore * (1 + switchAdvantageFor(state, core))
  if (best.score + 1e-9 >= need && best.score > currentScore + 1e-9) {
    setCoreTarget(core, best.target.id)
  }
}

function setCoreTarget(core: CombatUnit, id: string): void {
  if (core.currentTargetId === id) return
  ensureTargetingTelemetry(core).targetSwitches += 1
  core.currentTargetId = id
}

export function firingSolution(state: GameState, core: CombatUnit, target: CombatUnit): FiringSolution {
  const profile = profileForCore(core)
  const fire = effectiveCoreFireRange(state, core)
  const acquire = effectiveCoreAcquisitionRange(state, core)
  const arc = degToRad(effectiveCoreFiringArc(state, core))
  const distance = distanceBetween(core, target)
  const bearing = bearingBetween(core, target)
  const heading = core.heading ?? 0
  const delta = shortestAngleDelta(heading, bearing)
  const inAcquisition = distance <= acquire + 1e-6
  const inFireRange = distance <= fire + 1e-6
  const inArc = isWithinArc(heading, bearing, arc)
  const stabilised = Math.abs(delta) <= degToRad(profile.aimToleranceDeg) + 1e-6
  const canTraverseFire = profile.firesWhileTraversing && inFireRange && inArc
  const canStabilisedFire = profile.requiresStabilisedAim && inFireRange && inArc && stabilised
  const canFire = canTraverseFire || canStabilisedFire || (!profile.requiresStabilisedAim && inFireRange && inArc)
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
  const target = findEnemy(state, core.currentTargetId)
  if (!target || !isTargetableEnemy(state, target)) return { slewLimited: false }
  const bearing = bearingBetween(core, target)
  const rateDeg = effectiveCoreSlewRate(state, core)
  const maxDelta = degToRad(rateDeg) * Math.max(0, dt)
  const before = core.heading ?? 0
  const remaining = Math.abs(shortestAngleDelta(before, bearing))
  core.heading = slewHeading(before, bearing, maxDelta)
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
    if (!valid && core.currentTargetId) {
      core.currentTargetId = undefined
      for (const weapon of core.weapons) {
        weapon.telegraphLeft = 0
        weapon.telegraphToId = undefined
        weapon.chargeReady = false
      }
    }
  }

  const needEval = cores.some((core) => {
    const current = findEnemy(state, core.currentTargetId)
    if (!current) return true
    return sim >= (core.nextTargetEvalAt ?? 0)
  })
  const bundle: EvalBundle | null = needEval
    ? { enemies, metrics: buildSharedTargetMetrics(state, enemies) }
    : null

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
    if (!acquired && enemiesExist) {
      tel.timeNoTargetWhileEnemies += dt
      tel.acquisitionDelayAccum += dt
    } else if (acquired) {
      const sol = firingSolution(state, core, acquired)
      if (!sol.inFireRange) tel.timeAcquiredOutsideFire += dt
      if (coreIsBeaming(state, core)) tel.timeActivelyFiring += dt
    }
  }
}

export function noteShotHeld(core: CombatUnit): void {
  ensureTargetingTelemetry(core).shotsHeldIllegalSolution += 1
}

export function noteCoreFiring(core: CombatUnit, dt: number): void {
  ensureTargetingTelemetry(core).timeActivelyFiring += dt
}

export function playerCoreTarget(state: GameState, core: CombatUnit): CombatUnit | null {
  const target = findEnemy(state, core.currentTargetId)
  if (!target || !isTargetableEnemy(state, target)) {
    if (core.currentTargetId) {
      core.currentTargetId = undefined
    }
    return null
  }
  if (!isAcquirableTarget(state, core, target, true)) {
    core.currentTargetId = undefined
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
    const mod = getModule(moduleId)
    if (!mod?.weapon || mod.role !== 'weapon') continue
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
      heading: core.heading ?? core.orbitAngle ?? 0,
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

export { wrapTau, radToDeg, degToRad, headingToScreenFacing } from './geometry'
