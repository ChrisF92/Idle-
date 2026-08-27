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

function traitSources(state: GameState, trait: CommanderTraitId): CombatUnit[] {
  return livingCommanders(state)
    .filter((unit) => unit.commanderTraitId === trait)
    .sort((a, b) => b.hullMax - a.hullMax || a.id.localeCompare(b.id))
}

function inRadius(a: CombatUnit, b: CombatUnit, radius: number): boolean {
  return distanceBetween(a, b) <= radius
}

export function applyCommanderDerivedStats(state: GameState): void {
  const priorSupport = new Map(
    state.combat.enemyUnits.map((unit) => [unit.id, unit.supportShield ?? 0] as const),
  )
  for (const unit of state.combat.enemyUnits) {
    unit.commanderSpeedMult = 1
    unit.commanderCycleMult = 1
    unit.supportShield = 0
    unit.supportShieldMax = 0
  }

  const vanguards = traitSources(state, 'vanguard')
  for (const source of vanguards) {
    source.commanderSpeedMult = Math.max(source.commanderSpeedMult ?? 1, VANGUARD_SEEDS.selfSpeedMult)
    source.commanderCycleMult = Math.max(source.commanderCycleMult ?? 1, VANGUARD_SEEDS.selfCycleMult)
  }
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    for (const source of vanguards) {
      if (ally.id === source.id || !inRadius(source, ally, VANGUARD_SEEDS.auraRadius)) continue
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, VANGUARD_SEEDS.auraSpeedMult)
    }
  }

  const rallying = traitSources(state, 'rallying')
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    for (const source of rallying) {
      if (ally.id === source.id || !inRadius(source, ally, RALLYING_SEEDS.auraRadius)) continue
      ally.commanderCycleMult = Math.max(ally.commanderCycleMult ?? 1, RALLYING_SEEDS.allyCycleMult)
      ally.commanderSpeedMult = Math.max(ally.commanderSpeedMult ?? 1, RALLYING_SEEDS.allySpeedMult)
    }
  }

  const wards = traitSources(state, 'wardbearer')
  for (const ally of state.combat.enemyUnits) {
    if (ally.hull <= 0) continue
    const applicable = wards.filter(
      (source) => source.id !== ally.id && inRadius(source, ally, WARDBEARER_SEEDS.auraRadius),
    )
    if (applicable.length === 0) continue
    const maxShield = Math.max(...applicable.map(() => WARDBEARER_SEEDS.allySupportShield))
    ally.supportShieldMax = maxShield
    ally.supportShield = Math.min(
      maxShield,
      Math.max(priorSupport.get(ally.id) ?? 0, maxShield * 0.35),
    )
  }
}

export function suppressorModifier(state: GameState): TargetingStatModifier {
  if (traitSources(state, 'suppressor').length === 0) return {}
  return {
    slewRateMult: SUPPRESSOR_SEEDS.slewMult,
    acquisitionRangeMult: SUPPRESSOR_SEEDS.acquireMult,
  }
}

export const SUPPRESSOR_FLOOR_MULT = SUPPRESSOR_SEEDS.floorMult

function tickDisplacer(unit: CombatUnit, dt: number): void {
  if (unit.commanderTraitId !== 'displacer' || unit.hull <= 0) return
  let remain = dt
  while (remain > 1e-6) {
    if ((unit.displacerMoveLeft ?? 0) > 0) {
      const left = unit.displacerMoveLeft ?? 0
      const step = Math.min(remain, left)
      const destX = unit.displacerDestX ?? unit.x
      const destY = unit.displacerDestY ?? unit.y
      const t = step / Math.max(1e-4, left)
      unit.x += (destX - unit.x) * t
      unit.y += (destY - unit.y) * t
      unit.heading = bearingOf(unit.x, unit.y)
      unit.displacerMoveLeft = left - step
      unit.phaseWarnLeft = Math.max(unit.phaseWarnLeft, 0.05)
      remain -= step
      continue
    }
    if ((unit.displacerTelegraphLeft ?? 0) > 0) {
      const tel = unit.displacerTelegraphLeft ?? 0
      const step = Math.min(remain, tel)
      unit.displacerTelegraphLeft = tel - step
      unit.phaseWarnLeft = Math.max(unit.phaseWarnLeft, unit.displacerTelegraphLeft)
      remain -= step
      if ((unit.displacerTelegraphLeft ?? 0) <= 0) {
        unit.displacerMoveLeft = DISPLACER_SEEDS.moveDuration
      }
      continue
    }
    const cool = unit.displacerCooldownLeft ?? 0
    if (cool > remain) {
      unit.displacerCooldownLeft = cool - remain
      remain = 0
      break
    }
    remain -= Math.max(0, cool)
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
  if (traitSources(state, 'vanguard').length > 0) noteAuraUptime(state, 'vanguard', dt)
  if (traitSources(state, 'wardbearer').length > 0) noteAuraUptime(state, 'wardbearer', dt)
  if (traitSources(state, 'rallying').length > 0) noteAuraUptime(state, 'rallying', dt)
  if (traitSources(state, 'suppressor').length > 0) noteAuraUptime(state, 'suppressor', dt)
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
