/** Commander Trait runtime + authored ordinary hostile hazards. */

import type { CombatUnit, DeathHazardState, GameState } from './types'
import {
  BREACHER_SEEDS,
  DISPLACER_SEEDS,
  RALLYING_SEEDS,
  RESONANCE_VESSEL_HAZARD,
  SUPPRESSOR_SEEDS,
  VANGUARD_SEEDS,
  VOLATILE_SEEDS,
  WARDBEARER_SEEDS,
  enemyDamageScale,
} from './hostileSeeds'
import type { CommanderTraitId } from './hostileCatalogue'
import { bearingOf, distanceBetween, distanceToHive, pointFromBearing, wrapTau } from './geometry'
import { noteAuraUptime } from './encounterTelemetry'
import type { TargetingStatModifier } from './coreTargeting'

export function livingCommanders(state: GameState): CombatUnit[] {
  return state.combat.enemyUnits.filter((u) => u.hull > 0 && u.isCommander)
}

function strongest(state: GameState, trait: CommanderTraitId): CombatUnit | null {
  const all = livingCommanders(state).filter((u) => u.commanderTraitId === trait)
  if (all.length === 0) return null
  all.sort((a, b) => b.hullMax - a.hullMax || a.id.localeCompare(b.id))
  return all[0] ?? null
}

function inRadius(a: CombatUnit, b: CombatUnit, radius: number): boolean {
  return distanceBetween(a, b) <= radius
}

export function applyCommanderDerivedStats(state: GameState): void {
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    unit.commanderSpeedMult = 1
    unit.commanderCycleMult = 1
    unit.supportShieldMax = 0
  }
  const vanguard = strongest(state, 'vanguard')
  if (vanguard) {
    vanguard.commanderSpeedMult = VANGUARD_SEEDS.selfSpeedMult
    vanguard.commanderCycleMult = VANGUARD_SEEDS.selfCycleMult
    for (const ally of state.combat.enemyUnits) {
      if (ally.hull <= 0 || ally.id === vanguard.id) continue
      if (!inRadius(vanguard, ally, VANGUARD_SEEDS.auraRadius)) continue
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, VANGUARD_SEEDS.auraSpeedMult)
    }
    noteAuraUptime(state, 'vanguard', 0)
  }
  const rallying = strongest(state, 'rallying')
  if (rallying) {
    for (const ally of state.combat.enemyUnits) {
      if (ally.hull <= 0 || ally.id === rallying.id) continue
      if (!inRadius(rallying, ally, RALLYING_SEEDS.auraRadius)) continue
      ally.commanderCycleMult = Math.max(ally.commanderCycleMult ?? 1, RALLYING_SEEDS.allyCycleMult)
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, RALLYING_SEEDS.allySpeedMult)
    }
  }
  const ward = strongest(state, 'wardbearer')
  if (ward) {
    for (const ally of state.combat.enemyUnits) {
      if (ally.hull <= 0 || ally.id === ward.id) continue
      if (!inRadius(ward, ally, WARDBEARER_SEEDS.auraRadius)) continue
      ally.supportShieldMax = WARDBEARER_SEEDS.allySupportShield
      ally.supportShield = Math.min(
        ally.supportShieldMax,
        Math.max(ally.supportShield ?? 0, ally.supportShieldMax * 0.35),
      )
    }
  } else {
    for (const ally of state.combat.enemyUnits) {
      ally.supportShield = 0
      ally.supportShieldMax = 0
    }
  }
}

export function suppressorModifier(state: GameState): TargetingStatModifier {
  const suppressor = strongest(state, 'suppressor')
  if (!suppressor) return {}
  return {
    slewRateMult: SUPPRESSOR_SEEDS.slewMult,
    acquisitionRangeMult: SUPPRESSOR_SEEDS.acquireMult,
  }
}

export const SUPPRESSOR_FLOOR_MULT = SUPPRESSOR_SEEDS.floorMult

function tickDisplacer(unit: CombatUnit, dt: number): void {
  if (unit.commanderTraitId !== 'displacer' || unit.hull <= 0) return
  if ((unit.displacerMoveLeft ?? 0) > 0) {
    const left = unit.displacerMoveLeft ?? 0
    const step = Math.min(dt, left)
    const destX = unit.displacerDestX ?? unit.x
    const destY = unit.displacerDestY ?? unit.y
    const t = step / Math.max(1e-4, left)
    unit.x += (destX - unit.x) * t
    unit.y += (destY - unit.y) * t
    unit.heading = bearingOf(unit.x, unit.y)
    unit.displacerMoveLeft = left - step
    unit.phaseWarnLeft = Math.max(unit.phaseWarnLeft, 0.05)
    return
  }
  if ((unit.displacerTelegraphLeft ?? 0) > 0) {
    unit.displacerTelegraphLeft = Math.max(0, (unit.displacerTelegraphLeft ?? 0) - dt)
    unit.phaseWarnLeft = Math.max(unit.phaseWarnLeft, unit.displacerTelegraphLeft)
    if ((unit.displacerTelegraphLeft ?? 0) <= 0) {
      unit.displacerMoveLeft = DISPLACER_SEEDS.moveDuration
    }
    return
  }
  unit.displacerCooldownLeft = (unit.displacerCooldownLeft ?? 0) - dt
  if ((unit.displacerCooldownLeft ?? 0) <= 0) {
    unit.displacerTelegraphLeft = DISPLACER_SEEDS.telegraph
    unit.phaseWarnLeft = DISPLACER_SEEDS.telegraph
    const b = wrapTau(bearingOf(unit.x, unit.y) + DISPLACER_SEEDS.bearingDelta)
    const r = Math.max(80, distanceToHive(unit.x, unit.y) + DISPLACER_SEEDS.radiusDelta)
    const dest = pointFromBearing(b, r)
    unit.displacerDestX = dest.x
    unit.displacerDestY = dest.y
    unit.displacerCooldownLeft = DISPLACER_SEEDS.cooldown
  }
}

function tickBreacher(unit: CombatUnit, dt: number): void {
  if (unit.commanderTraitId !== 'breacher' || unit.hull <= 0) return
  const wpn = unit.weapons[0]
  if (!wpn) return
  wpn.telegraphDuration = BREACHER_SEEDS.charge
  wpn.cooldown = BREACHER_SEEDS.cooldown
  wpn.shieldBypassFrac = BREACHER_SEEDS.bypassFrac
  wpn.tags = wpn.tags.includes('bypass') ? wpn.tags : [...wpn.tags, 'bypass']
  unit.breacherCooldownLeft = wpn.cooldownLeft
  void dt
}

export function tickCommanderTraits(state: GameState, dt: number): void {
  applyCommanderDerivedStats(state)
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    tickDisplacer(unit, dt)
    tickBreacher(unit, dt)
  }
  const vanguard = strongest(state, 'vanguard')
  if (vanguard) noteAuraUptime(state, 'vanguard', dt)
  if (strongest(state, 'wardbearer')) noteAuraUptime(state, 'wardbearer', dt)
  if (strongest(state, 'rallying')) noteAuraUptime(state, 'rallying', dt)
  if (strongest(state, 'suppressor')) noteAuraUptime(state, 'suppressor', dt)
}

export function ensureDeathHazards(state: GameState): DeathHazardState[] {
  if (!state.combat.deathHazards) state.combat.deathHazards = []
  return state.combat.deathHazards
}

export function queueDeathHazard(
  state: GameState,
  unit: CombatUnit,
  kind: 'resonance' | 'volatile',
): void {
  if (unit.deathHazardImmune) return
  const seeds = kind === 'volatile' ? VOLATILE_SEEDS : RESONANCE_VESSEL_HAZARD
  const scale = enemyDamageScale(unit.sourceWave ?? state.combat.waveReached ?? 1)
  ensureDeathHazards(state).push({
    x: unit.x,
    y: unit.y,
    radius: seeds.radius,
    damage: seeds.damage * scale,
    delayLeft: seeds.delay,
    sourceId: unit.id,
    kind,
  })
}

export function onHostileDeathHazards(state: GameState, unit: CombatUnit): void {
  if (unit.commanderTraitId === 'volatile' || (unit.volatileArmed && unit.isCommander)) {
    queueDeathHazard(state, unit, 'volatile')
    return
  }
  if (unit.resonanceArmed || unit.hostileId === 'resonance-vessel') {
    queueDeathHazard(state, unit, 'resonance')
  }
}

export function movementSpeed(unit: CombatUnit): number {
  return unit.speed * (unit.commanderSpeedMult ?? 1)
}

export function fireCooldown(unit: CombatUnit, base: number): number {
  return base / Math.max(1, unit.commanderCycleMult ?? 1)
}
