/**
 * Authored Core combat/support behaviours for the final 14-Core catalogue.
 *
 * Numeric magnitudes here are implementation seeds, not a PR11 balance pass.
 * Unspecified Mastery slots stay pending in coreMastery.ts and are not invented here.
 */

import { getModule } from './catalog'
import { directiveUtilityCoreEffectMult } from './directives'
import { hasMasteryEffect } from './coreMastery'
import type {
  CombatProjectile,
  CombatUnit,
  GameState,
  SortieCoreRuntime,
  WeaponTag,
} from './types'
import { distanceBetween, distanceToHive, moveRadially } from './geometry'

function enemyById(state: GameState, id: string | undefined): CombatUnit | undefined {
  if (!id) return undefined
  return state.combat.enemyUnits.find((u) => u.id === id && u.hull > 0)
}

/** Pulse leftover hop search radius. */
export const PULSE_CHAIN_RADIUS = 72
/** Phase Ramp reaches this multiplier after PHASE_RAMP_SECONDS of contact. */
export const PHASE_RAMP_MAX = 1.6
export const PHASE_RAMP_SECONDS = 6
/** Slag M30 Molten Pool radius seed. */
export const SLAG_POOL_RADIUS = 35
export const SLAG_POOL_DURATION = 5
export const SLAG_POOL_DPS = 2
export const SLAG_POOL_MERGE_CAP = 3
/** Grav control radius around the locked target. */
export const GRAV_CONTROL_RADIUS = 85
export const GRAV_SLOW_FACTOR = 0.62
export const GRAV_DRAG_PER_SEC = 22
export const GRAV_WELL_RADIUS = 70
export const GRAV_WELL_SLOW = 0.5
/** Ablative layer. Bounded; never immunity. */
export const ABLATIVE_LAYER_HP = 14
export const ABLATIVE_LAYER_PERIOD = 8
/** Later Mesh spike absorb. Dormant until the canonical threshold is authored. */
export const ABLATIVE_SPIKE_ABSORB = 0.35
export const ABLATIVE_DEFERRAL_FRACTION = 0.22
export const ABLATIVE_DEFERRAL_CAP = 36
export const ABLATIVE_DEFERRAL_SECONDS = 1.8
/** Barrier intercept. Deterministic cooldown, not chance. */
export const BARRIER_INTERCEPT_COOLDOWN = 32
export const BARRIER_REARM_COOLDOWN = 18
export const BARRIER_EMERGENCY_HULL_FRAC = 0.28
export const BARRIER_EMERGENCY_SHIELD = 18
export const BARRIER_EMERGENCY_SECONDS = 3
export const BARRIER_EMERGENCY_COOLDOWN = 22
/** Nano Lathe in-combat repair seed. */
export const NANO_LATHE_REPAIR_PER_SEC = 2.4
export const NANO_LATHE_TRIAGE_FRAC = 0.4
export const NANO_LATHE_TRIAGE_MULT = 1.7
export const NANO_LATHE_TEMP_ARMOR_CAP = 20
/** Salvage Beacon marked-kill bonus. */
export const SALVAGE_MARK_BONUS = 0.35
export const SALVAGE_MARK_DURATION = 8
/** Choir Tap M30 bounded Heat packet. */
export const CHOIR_HOT_RECOVERY_HEAT = 4
export const CHOIR_HOT_RECOVERY_CAP = 8
/** Choir Tap M50 Ash→Heat while fitted. Does not rewrite an Ignited Furnace. */
export const CHOIR_FURNACE_FEED_MULT = 1.18
/** Sensor Array targeting support. Helpful, not mandatory. */
export const SENSOR_ACQUIRE_MULT = 1.08
export const SENSOR_SLEW_MULT = 1.07
export const SENSOR_FCN_ACQUIRE_MULT = 1.14
export const SENSOR_FCN_SLEW_MULT = 1.12
/** Plate M100 Citadel Skin: bounded incoming reduction while Shield remains. */
export const CITADEL_SKIN_REDUCTION = 0.12
/** Rapid Aegis overflow buffer seed. */
export const AEGIS_OVERFLOW_CAP = 8
/** Later Aegis small-hit resilience. Dormant until the canonical threshold is authored. */
export const AEGIS_SMALL_HIT = 6
export const HEAVY_SHIELD_BYPASS = 0.35
export const HEAVY_PEN_MOMENTUM = 0.35
export const FLAK_DETONATION_RADIUS = 40
export const PULSE_CONVERGENCE_FORKS = 2
export const PHASE_REFRACTION_FRACTION = 0.28
export const PHASE_EXPOSURE_SECONDS = 3
export const PHASE_EXPOSURE_TAKEN_MULT = 1.18
export const PHASE_RAMP_BYPASS_MIN = 0.08
export const PHASE_RAMP_BYPASS_SPAN = 0.32

export function emptySortieCoreRuntime(): SortieCoreRuntime {
  return {
    salvageMarks: {},
    moltenPools: [],
    barrierInterceptCooldown: 0,
    barrierEmergencyUntil: 0,
    barrierRearmWeak: false,
    ablativeLayerHp: 0,
    ablativeRegenAt: 0,
    tempArmor: 0,
    tempArmorUntil: 0,
    deferredDamage: 0,
    deferredUntil: 0,
    choirTapHeatGranted: 0,
    choirTapFurnaceFeed: false,
    pulseChainAt: {},
    phaseRamp: {},
    phaseLockMemory: {},
    phaseExposureUntil: {},
    heavyFractureUntil: 0,
    gravWellUntil: 0,
    aegisOverflow: 0,
    aegisBreakUntil: 0,
    plateBreakArmorUntil: 0,
    nanoLatheBurstAt: 0,
  }
}

export function ensureSortieCoreRuntime(state: GameState): SortieCoreRuntime {
  if (!state.combat.coreRuntime) state.combat.coreRuntime = emptySortieCoreRuntime()
  return state.combat.coreRuntime
}

export function resetSortieCoreRuntime(state: GameState): void {
  state.combat.coreRuntime = emptySortieCoreRuntime()
}

function hive(state: GameState): CombatUnit | undefined {
  return state.combat.playerUnits.find((u) => u.isFlagship)
}

function fitted(state: GameState, moduleId: string): boolean {
  return (state.shipyard.modules ?? []).includes(moduleId)
}

/** Boss identity only until PR7 supplies a real Commander flag. */
export function isHighValueHostile(unit: CombatUnit): boolean {
  return Boolean(unit.isBoss || unit.role === 'boss' || unit.role === 'elite' || unit.isCommander)
}

export function choirTapAshToHeatMult(state: GameState): number {
  if (!fitted(state, 'choir-tap')) return 1
  if (!hasMasteryEffect(state, 'choir-tap', 'choir-furnace-feed')) return 1
  const runtime = state.combat.coreRuntime
  if (!runtime?.choirTapFurnaceFeed) return 1
  return 1 + (CHOIR_FURNACE_FEED_MULT - 1) * directiveUtilityCoreEffectMult(state)
}

export function sensorTargetingModifier(state: GameState): {
  acquisitionRangeMult: number
  slewRateMult: number
} {
  if (!fitted(state, 'sensor-array')) return { acquisitionRangeMult: 1, slewRateMult: 1 }
  const utility = directiveUtilityCoreEffectMult(state)
  const acquire = hasMasteryEffect(state, 'sensor-array', 'sensor-fire-control') ? SENSOR_FCN_ACQUIRE_MULT : SENSOR_ACQUIRE_MULT
  const slew = hasMasteryEffect(state, 'sensor-array', 'sensor-fire-control') ? SENSOR_FCN_SLEW_MULT : SENSOR_SLEW_MULT
  return {
    acquisitionRangeMult: 1 + (acquire - 1) * utility,
    slewRateMult: 1 + (slew - 1) * utility,
  }
}

export function phaseRampMultiplier(state: GameState, core: CombatUnit): number {
  if ((core.coreModuleId ?? '') !== 'phase-beam') return 1
  if (!hasMasteryEffect(state, 'phase-beam', 'phase-ramp')) return 1
  const runtime = ensureSortieCoreRuntime(state)
  const key = core.coreInstanceId ?? core.id
  const stored = runtime.phaseRamp[key] ?? 0
  return 1 + (PHASE_RAMP_MAX - 1) * Math.min(1, stored / PHASE_RAMP_SECONDS)
}

export function phaseRampEstablished(state: GameState, core: CombatUnit): boolean {
  if ((core.coreModuleId ?? '') !== 'phase-beam') return false
  if (!hasMasteryEffect(state, 'phase-beam', 'phase-ramp')) return false
  const runtime = state.combat.coreRuntime
  const key = core.coreInstanceId ?? core.id
  return (runtime?.phaseRamp[key] ?? 0) >= 1.5
}

export function updatePhaseRamp(state: GameState, core: CombatUnit, dt: number, contacting: boolean): void {
  if ((core.coreModuleId ?? '') !== 'phase-beam') return
  if (!hasMasteryEffect(state, 'phase-beam', 'phase-ramp')) return
  const runtime = ensureSortieCoreRuntime(state)
  const key = core.coreInstanceId ?? core.id
  const memory = runtime.phaseLockMemory[key]
  if (contacting) {
    let start = runtime.phaseRamp[key] ?? 0
    if (hasMasteryEffect(state, 'phase-beam', 'phase-lock-memory') && memory && memory.until > state.combat.simTime) {
      start = Math.max(start, memory.ramp * 0.6)
    }
    runtime.phaseRamp[key] = Math.min(PHASE_RAMP_SECONDS, start + dt)
    return
  }
  if (hasMasteryEffect(state, 'phase-beam', 'phase-lock-memory')) {
    runtime.phaseLockMemory[key] = {
      targetId: core.currentTargetId ?? '',
      ramp: runtime.phaseRamp[key] ?? 0,
      until: state.combat.simTime + 2.4,
    }
  }
  runtime.phaseRamp[key] = Math.max(0, (runtime.phaseRamp[key] ?? 0) - dt * 0.85)
}

export function heavyArmorFractureActive(state: GameState): boolean {
  const runtime = state.combat.coreRuntime
  return Boolean(runtime && runtime.heavyFractureUntil > state.combat.simTime)
}

export function applyHeavyArmorFracture(state: GameState, seconds = 4): void {
  const runtime = ensureSortieCoreRuntime(state)
  runtime.heavyFractureUntil = Math.max(runtime.heavyFractureUntil, state.combat.simTime + seconds)
}

export function effectiveEnemyArmor(state: GameState, unit: CombatUnit): number {
  let armor = Math.max(0, unit.armor)
  if (heavyArmorFractureActive(state)) armor *= 0.55
  const runtime = state.combat.coreRuntime
  if (runtime && hasMasteryEffect(state, 'slag-spitter', 'slag-corrosion')) {
    const inPool = runtime.moltenPools.some(
      (pool) => pool.until > state.combat.simTime && distanceBetween(unit, pool) <= pool.radius,
    )
    if (inPool) armor = Math.max(0, armor - 4)
  }
  return armor
}

export function salvageMarkBonus(state: GameState, unit: CombatUnit): number {
  if (!fitted(state, 'salvage-beacon')) return 0
  const runtime = state.combat.coreRuntime
  const mark = runtime?.salvageMarks[unit.id]
  if (!mark || mark.until < state.combat.simTime) return 0
  return SALVAGE_MARK_BONUS * directiveUtilityCoreEffectMult(state)
}

export function markSalvageTarget(state: GameState, unit: CombatUnit, elite = false): void {
  const runtime = ensureSortieCoreRuntime(state)
  runtime.salvageMarks[unit.id] = {
    until: state.combat.simTime + SALVAGE_MARK_DURATION,
    elite: elite || isHighValueHostile(unit),
  }
}

export function choirTapOnHighValueKill(state: GameState, unit: CombatUnit): void {
  if (!fitted(state, 'choir-tap')) return
  if (!isHighValueHostile(unit)) return
  if (!hasMasteryEffect(state, 'choir-tap', 'choir-hot-recovery')) return
  const runtime = ensureSortieCoreRuntime(state)
  if (runtime.choirTapHeatGranted >= CHOIR_HOT_RECOVERY_CAP) return
  const boostedPacket = CHOIR_HOT_RECOVERY_HEAT * directiveUtilityCoreEffectMult(state)
  const packet = Math.min(boostedPacket, CHOIR_HOT_RECOVERY_CAP - runtime.choirTapHeatGranted)
  runtime.choirTapHeatGranted += packet
  state.resources.heat = (state.resources.heat ?? 0) + packet
}

export function armChoirFurnaceFeed(state: GameState): void {
  const runtime = ensureSortieCoreRuntime(state)
  runtime.choirTapFurnaceFeed =
    fitted(state, 'choir-tap') && hasMasteryEffect(state, 'choir-tap', 'choir-furnace-feed')
}

function nearestEnemy(
  state: GameState,
  from: { x: number; y: number },
  exceptId: string,
  radius: number,
): CombatUnit | null {
  let best: CombatUnit | null = null
  let bestD = radius
  for (const enemy of state.combat.enemyUnits) {
    if (enemy.id === exceptId || enemy.hull <= 0 || enemy.untargetable || enemy.targetable === false) continue
    const d = distanceBetween(from, enemy)
    if (d <= bestD) {
      best = enemy
      bestD = d
    }
  }
  return best
}

/** Next living hull roughly behind `from` along `heading`. One extra target only. */
export function nextEnemyAlongHeading(
  state: GameState,
  from: { x: number; y: number },
  heading: number,
  exceptId: string,
  maxDist = 90,
): CombatUnit | null {
  let best: CombatUnit | null = null
  let bestD = maxDist
  for (const enemy of state.combat.enemyUnits) {
    if (enemy.id === exceptId || enemy.hull <= 0 || enemy.untargetable || enemy.targetable === false) continue
    const d = distanceBetween(from, enemy)
    if (d > maxDist || d < 8) continue
    const bearing = Math.atan2(enemy.x - from.x, enemy.y - from.y)
    const delta = Math.abs((((bearing - heading + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI)
    if (delta > 0.45) continue
    if (d < bestD) {
      best = enemy
      bestD = d
    }
  }
  return best
}

export function pulseOverkillHop(
  state: GameState,
  origin: { x: number; y: number },
  leftover: number,
  exceptId: string,
): CombatUnit | null {
  if (leftover <= 0.5) return null
  if (!hasMasteryEffect(state, 'pulse-cannon', 'pulse-overkill-retarget')) return null
  return nearestEnemy(state, origin, exceptId, PULSE_CHAIN_RADIUS)
}

export function pulseChainTarget(
  state: GameState,
  origin: { x: number; y: number },
  exceptId: string,
): CombatUnit | null {
  return nearestEnemy(state, origin, exceptId, PULSE_CHAIN_RADIUS)
}

/** Periodic M30+ chain hops. Independent of M10 overkill-on-kill. */
export function pulseChainHops(state: GameState, coreInstanceId: string): number {
  let hops = 0
  if (hasMasteryEffect(state, 'pulse-cannon', 'pulse-periodic-chain')) hops += 1
  if (hasMasteryEffect(state, 'pulse-cannon', 'pulse-chain-continue')) hops += 1
  if (hasMasteryEffect(state, 'pulse-cannon', 'pulse-convergence')) hops += PULSE_CONVERGENCE_FORKS
  if (hops <= 0) return 0
  const runtime = ensureSortieCoreRuntime(state)
  const last = runtime.pulseChainAt[coreInstanceId]
  if (last != null && state.combat.simTime - last < 1.6) return Math.min(1, hops)
  runtime.pulseChainAt[coreInstanceId] = state.combat.simTime
  return hops
}

export function spawnMoltenPool(state: GameState, x: number, y: number, sourceModuleId?: string): void {
  if (sourceModuleId !== 'slag-spitter') return
  if (!hasMasteryEffect(state, 'slag-spitter', 'slag-molten-pool')) return
  const runtime = ensureSortieCoreRuntime(state)
  const radius = hasMasteryEffect(state, 'slag-spitter', 'slag-spread')
    ? SLAG_POOL_RADIUS + 12
    : SLAG_POOL_RADIUS
  if (hasMasteryEffect(state, 'slag-spitter', 'slag-pool-merge')) {
    const near = runtime.moltenPools.find(
      (pool) => pool.until > state.combat.simTime && distanceBetween({ x, y }, pool) <= pool.radius + radius,
    )
    if (near && runtime.moltenPools.filter((p) => p.until > state.combat.simTime).length >= SLAG_POOL_MERGE_CAP) {
      near.radius = Math.min(SLAG_POOL_RADIUS * 1.6, near.radius + 8)
      near.until = Math.max(near.until, state.combat.simTime + SLAG_POOL_DURATION)
      near.x = (near.x + x) / 2
      near.y = (near.y + y) / 2
      return
    }
  }
  runtime.moltenPools.push({
    id: `pool-${runtime.moltenPools.length + 1}`,
    x,
    y,
    radius,
    until: state.combat.simTime + SLAG_POOL_DURATION,
    dps: SLAG_POOL_DPS,
    corrosion: hasMasteryEffect(state, 'slag-spitter', 'slag-corrosion') ? 4 : 0,
  })
}

export function flakSplashCount(state: GameState, base: number): number {
  let n = base
  if (hasMasteryEffect(state, 'flak-array', 'flak-fragmentation')) n += 1
  if (hasMasteryEffect(state, 'flak-array', 'flak-saturation')) n += 1
  return n
}

export function tickMoltenPools(state: GameState, dt: number): void {
  const runtime = state.combat.coreRuntime
  if (!runtime) return
  runtime.moltenPools = runtime.moltenPools.filter((pool) => pool.until > state.combat.simTime)
  void dt
}

function applyGravToEnemy(enemy: CombatUnit, dt: number, slow: number, strength = 1): void {
  const dist = distanceToHive(enemy.x, enemy.y)
  if (dist <= 8) return
  const pull = Math.min(GRAV_DRAG_PER_SEC * strength * dt, Math.max(0, dist - 10))
  const next = moveRadially(enemy.x, enemy.y, -pull)
  enemy.x = next.x
  enemy.y = next.y
  const scaledSlow = Math.max(0.1, 1 - (1 - slow) * strength)
  enemy.controlSlowMult = Math.min(enemy.controlSlowMult ?? 1, scaledSlow)
}

export function tickGravTether(state: GameState, dt: number): void {
  for (const enemy of state.combat.enemyUnits) {
    enemy.controlSlowMult = 1
  }
  if (!fitted(state, 'grav-tether')) return
  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId === 'grav-tether')
  const utility = directiveUtilityCoreEffectMult(state)
  const well = hasMasteryEffect(state, 'grav-tether', 'grav-gravity-well')
  for (const enemy of state.combat.enemyUnits) {
    if (enemy.hull <= 0) continue
    for (const core of cores) {
      const target = enemyById(state, core.currentTargetId)
      const anchor = target ?? core
      if (distanceBetween(enemy, anchor) <= GRAV_CONTROL_RADIUS) {
        applyGravToEnemy(enemy, dt, GRAV_SLOW_FACTOR, utility)
      }
    }
    if (well && distanceToHive(enemy.x, enemy.y) <= GRAV_WELL_RADIUS) {
      applyGravToEnemy(enemy, dt, GRAV_WELL_SLOW, utility)
    }
  }
}

export function tickNanoLathe(state: GameState, dt: number): void {
  if (!fitted(state, 'nano-lathe')) return
  const flag = hive(state)
  if (!flag || flag.hull <= 0) return
  const runtime = ensureSortieCoreRuntime(state)
  const frac = flag.hullMax > 0 ? flag.hull / flag.hullMax : 1
  let rate = NANO_LATHE_REPAIR_PER_SEC * directiveUtilityCoreEffectMult(state)
  if (frac < NANO_LATHE_TRIAGE_FRAC) rate *= NANO_LATHE_TRIAGE_MULT
  const before = flag.hull
  flag.hull = Math.min(flag.hullMax, flag.hull + rate * dt)
  const overflow = rate * dt - (flag.hull - before)
  if (overflow > 0.01) {
    runtime.tempArmor = Math.min(NANO_LATHE_TEMP_ARMOR_CAP, runtime.tempArmor + overflow)
    runtime.tempArmorUntil = state.combat.simTime + 6
  }
}

export function tickAblativeLayer(state: GameState, dt: number): void {
  if (!fitted(state, 'ablative-mesh')) return
  const runtime = ensureSortieCoreRuntime(state)
  if (runtime.ablativeLayerHp <= 0 && state.combat.simTime >= runtime.ablativeRegenAt) {
    runtime.ablativeLayerHp = ABLATIVE_LAYER_HP
  }
  if (runtime.deferredDamage > 0 && runtime.deferredUntil <= state.combat.simTime) {
    const flag = hive(state)
    if (flag) {
      const take = Math.min(runtime.deferredDamage, ABLATIVE_DEFERRAL_CAP)
      flag.hull = Math.max(1, flag.hull - take)
      runtime.deferredDamage = 0
    }
  }
  void dt
}

export function tickRapidAegis(state: GameState, dt: number): void {
  if (!fitted(state, 'rapid-aegis')) return
  const flag = hive(state)
  if (!flag) return
  const runtime = ensureSortieCoreRuntime(state)
  if (hasMasteryEffect(state, 'rapid-aegis', 'aegis-perpetual') && flag.shieldMax > 0) {
    if (flag.shield <= 0) {
      flag.regenDelay = 0
      runtime.aegisOverflow = Math.min(AEGIS_OVERFLOW_CAP, runtime.aegisOverflow + 2 * dt)
    } else if (runtime.aegisOverflow > 0 && flag.shield >= flag.shieldMax - 0.01) {
      /* overflow sits until the next break */
    }
  }
}

export function tickBarrierProjector(state: GameState, dt: number): void {
  if (!fitted(state, 'barrier-projector')) return
  const runtime = ensureSortieCoreRuntime(state)
  runtime.barrierInterceptCooldown = Math.max(0, runtime.barrierInterceptCooldown - dt)
  const flag = hive(state)
  if (!flag || flag.hullMax <= 0) return
  if (flag.hull / flag.hullMax <= BARRIER_EMERGENCY_HULL_FRAC && runtime.barrierEmergencyUntil < state.combat.simTime) {
    if (runtime.barrierInterceptCooldown <= BARRIER_EMERGENCY_COOLDOWN) {
      runtime.barrierEmergencyUntil = state.combat.simTime + BARRIER_EMERGENCY_SECONDS
      flag.shield = Math.max(flag.shield, BARRIER_EMERGENCY_SHIELD)
    }
  }
}

export function tickSalvageBeacon(state: GameState): void {
  if (!fitted(state, 'salvage-beacon')) return
  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId === 'salvage-beacon')
  for (const core of cores) {
    const target = enemyById(state, core.currentTargetId)
    if (target) markSalvageTarget(state, target, isHighValueHostile(target))
  }
}

/**
 * Incoming Hive mitigation. Bounded. Never an invulnerability loop.
 * Returns the remaining raw damage after layer/deferral/citadel.
 */
export function mitigateIncomingToHive(
  state: GameState,
  flag: CombatUnit,
  rawDamage: number,
  _tags: WeaponTag[],
): number {
  let remaining = Math.max(0, rawDamage)
  const runtime = ensureSortieCoreRuntime(state)

  if (fitted(state, 'plate-layer') && hasMasteryEffect(state, 'plate-layer', 'plate-citadel-skin') && flag.shield > 0) {
    remaining *= 1 - CITADEL_SKIN_REDUCTION
  }

  if (fitted(state, 'ablative-mesh') && remaining > 0) {
    if (runtime.ablativeLayerHp > 0) {
      const take = Math.min(runtime.ablativeLayerHp, remaining)
      runtime.ablativeLayerHp -= take
      remaining -= take
      if (runtime.ablativeLayerHp <= 0) {
        runtime.ablativeRegenAt = state.combat.simTime + ABLATIVE_LAYER_PERIOD
      }
    }
    if (hasMasteryEffect(state, 'ablative-mesh', 'ablative-deferral') && remaining > 0) {
      const defer = Math.min(ABLATIVE_DEFERRAL_CAP - runtime.deferredDamage, remaining * ABLATIVE_DEFERRAL_FRACTION)
      if (defer > 0) {
        runtime.deferredDamage += defer
        runtime.deferredUntil = state.combat.simTime + ABLATIVE_DEFERRAL_SECONDS
        remaining -= defer
      }
    }
  }

  if (runtime.tempArmor > 0 && runtime.tempArmorUntil > state.combat.simTime && remaining > 0) {
    const soak = Math.min(runtime.tempArmor, remaining)
    runtime.tempArmor -= soak
    remaining -= soak
  }

  return Math.max(0, remaining)
}

/** Deterministic lethal intercept. Long cooldown. Not chance-based. */
export function tryBarrierIntercept(
  state: GameState,
  flag: CombatUnit,
  incoming: number,
): boolean {
  if (!fitted(state, 'barrier-projector')) return false
  const runtime = ensureSortieCoreRuntime(state)
  if (runtime.barrierInterceptCooldown > 0) return false
  const lethal = incoming >= flag.hull && flag.hull > 0
  const low = flag.hullMax > 0 && flag.hull / flag.hullMax <= BARRIER_EMERGENCY_HULL_FRAC
  if (!lethal && !low) return false
  runtime.barrierInterceptCooldown = runtime.barrierRearmWeak && hasMasteryEffect(state, 'barrier-projector', 'barrier-rearm')
    ? BARRIER_REARM_COOLDOWN
    : BARRIER_INTERCEPT_COOLDOWN
  runtime.barrierRearmWeak = hasMasteryEffect(state, 'barrier-projector', 'barrier-rearm')
  return true
}

export function interceptEnemyProjectile(state: GameState, shot: CombatProjectile): boolean {
  if (shot.side === 'player') return false
  const flag = hive(state)
  if (!flag) return false
  return tryBarrierIntercept(state, flag, shot.damage)
}

export function tickSupportCores(state: GameState, dt: number): void {
  ensureSortieCoreRuntime(state)
  armChoirFurnaceFeed(state)
  tickSalvageBeacon(state)
  tickGravTether(state, dt)
  tickMoltenPools(state, dt)
  tickNanoLathe(state, dt)
  tickAblativeLayer(state, dt)
  tickRapidAegis(state, dt)
  tickBarrierProjector(state, dt)
}

export function phaseRampBypassFrac(state: GameState, core: CombatUnit): number {
  if ((core.coreModuleId ?? '') !== 'phase-beam') return 0
  if (!hasMasteryEffect(state, 'phase-beam', 'phase-ramp-bypass')) return 0
  const rampFrac = (phaseRampMultiplier(state, core) - 1) / Math.max(1e-6, PHASE_RAMP_MAX - 1)
  return PHASE_RAMP_BYPASS_MIN + PHASE_RAMP_BYPASS_SPAN * Math.max(0, Math.min(1, rampFrac))
}

export function applyPhaseExposure(state: GameState, enemyId: string): void {
  if (!hasMasteryEffect(state, 'phase-beam', 'phase-exposure')) return
  const runtime = ensureSortieCoreRuntime(state)
  if (!runtime.phaseExposureUntil) runtime.phaseExposureUntil = {}
  runtime.phaseExposureUntil[enemyId] = Math.max(
    runtime.phaseExposureUntil[enemyId] ?? 0,
    state.combat.simTime + PHASE_EXPOSURE_SECONDS,
  )
}

export function phaseExposureTakenMult(state: GameState, unit: CombatUnit): number {
  const until = state.combat.coreRuntime?.phaseExposureUntil?.[unit.id] ?? 0
  if (until > state.combat.simTime) return PHASE_EXPOSURE_TAKEN_MULT
  return 1
}

export function phaseRampAtMax(state: GameState, core: CombatUnit): boolean {
  if ((core.coreModuleId ?? '') !== 'phase-beam') return false
  const key = core.coreInstanceId ?? core.id
  return (state.combat.coreRuntime?.phaseRamp[key] ?? 0) >= PHASE_RAMP_SECONDS - 1e-6
}

export function authoredOrbitRadius(moduleId: string): number {
  return getModule(moduleId)?.orbitRadius ?? 44
}
