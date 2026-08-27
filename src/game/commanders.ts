/** Commander cadence, generation, overlap reservation, and promotion. */

import type { CombatUnit, GameState, ReservedCommanderState, WavePackageState } from './types'
import {
  COMMANDER_TRAIT_IDS,
  buildHostileUnit,
  firstContactHostile,
  getHostileDef,
  introducedHostiles,
  type CommanderTraitId,
  type HostileDef,
  type HostileId,
} from './hostileCatalogue'
import {
  COMMANDER_PROMOTION,
  COMMANDER_SELF_THREAT_SHARE,
  COMMANDER_WAVE_THREAT_MULT,
  DENSITY_COUNT_MAX,
  DISRUPTOR_CAP_PER_PACKAGE,
  IRONCLAD_SEEDS,
  MAX_ACTIVE_COMMANDERS,
  SUPPORT_CAP_PER_PACKAGE,
  TRAIT_UNLOCK_WAVE,
  VANGUARD_SEEDS,
  WARDBEARER_SEEDS,
  W10_COMMANDER_SEED,
} from './hostileSeeds'
import { formationRngFor, formationSlots, pickFormation, type FormationId } from './formations'
import { createSimRng, hashSeed, rngInt, rngNext, type SimRngState } from './simRng'
import { isCommanderCandidateWave } from './waves'
import { packThreat } from './threatBudget'
import { admitUnitToPackage } from './waveRuntime'
import { noteCommanderEvent, noteCommanderOverlap } from './encounterTelemetry'

export const COMMANDER_CHANNEL = 0xc0a11d

export function isCommanderWave(wave: number): boolean {
  return isCommanderCandidateWave(wave)
}

export function commanderEventOrdinal(wave: number): number {
  const w = Math.max(0, Math.floor(wave))
  if (w < 10) return 0
  return Math.floor(w / 10) - Math.floor(w / 50)
}

export function traitUnlockedAt(trait: CommanderTraitId, wave: number): boolean {
  if (wave < TRAIT_UNLOCK_WAVE[trait]) return false
  if (trait === 'volatile') {
    const vessel = getHostileDef('resonance-vessel')
    return Boolean(vessel && vessel.firstContactWave <= wave)
  }
  if (trait === 'breacher') {
    const engine = getHostileDef('breach-engine')
    return Boolean(engine && engine.firstContactWave <= wave)
  }
  return true
}

export function unlockedTraits(wave: number): CommanderTraitId[] {
  return COMMANDER_TRAIT_IDS.filter((id) => traitUnlockedAt(id, wave))
}

function commanderRng(seed: number, wave: number): SimRngState {
  return createSimRng(hashSeed(seed >>> 0, wave, commanderEventOrdinal(wave), COMMANDER_CHANNEL))
}

function recentTraits(state: GameState | undefined, count: number): CommanderTraitId[] {
  const log = state?.combat.commanderEventLog ?? []
  return log.slice(-count).map((row) => row.traitId as CommanderTraitId)
}

function recentBases(state: GameState | undefined, count: number): string[] {
  const log = state?.combat.commanderEventLog ?? []
  return log.slice(-count).map((row) => row.hostileId)
}

function pickSorted<T>(rng: SimRngState, items: readonly T[]): T {
  return items[rngInt(rng, 0, items.length - 1)]!
}

/**
 * Runtime trait eligibility when family compatibility is pending.
 * Does not claim canonical family mapping. Blocks only authored prerequisites.
 */
export function traitEligibleForHostile(trait: CommanderTraitId, def: HostileDef, wave: number): boolean {
  if (!traitUnlockedAt(trait, wave)) return false
  if (def.traitCompatibilityStatus === 'authored' && def.traitCompatibility) {
    return def.traitCompatibility.includes(trait)
  }
  return true
}

function selectHostile(
  rng: SimRngState,
  wave: number,
  state: GameState | undefined,
): HostileDef {
  const intro = firstContactHostile(wave)
  if (intro?.commanderEligible) return intro
  const pool = introducedHostiles(wave).filter((d) => d.commanderEligible)
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id))
  const recent = recentBases(state, 2)
  const avoided = sorted.filter((d) => !recent.includes(d.id))
  const use = avoided.length > 0 ? avoided : sorted
  return pickSorted(rng, use)
}

function selectTrait(
  rng: SimRngState,
  wave: number,
  def: HostileDef,
  state: GameState | undefined,
): CommanderTraitId {
  const unlocked = unlockedTraits(wave).filter((t) => traitEligibleForHostile(t, def, wave))
  const sorted = [...unlocked].sort()
  const recent = recentTraits(state, 2)
  const blocked =
    recent.length >= 2 && recent[0] === recent[1]
      ? sorted.filter((t) => t !== recent[0])
      : sorted
  const use = blocked.length > 0 ? blocked : sorted
  return pickSorted(rng, use.length > 0 ? use : (['vanguard'] as CommanderTraitId[]))
}

export interface CommanderPlan {
  hostileId: HostileId
  traitId: CommanderTraitId
  pairingStatus: 'pending-pairing' | 'generated'
  formation: FormationId
}

export function planCommanderEvent(wave: number, seed: number, state?: GameState): CommanderPlan {
  if (wave === 10) {
    return {
      hostileId: W10_COMMANDER_SEED.hostileId,
      traitId: W10_COMMANDER_SEED.traitId,
      pairingStatus: W10_COMMANDER_SEED.status,
      formation: 'spear',
    }
  }
  const rng = commanderRng(seed, wave)
  const def = selectHostile(rng, wave, state)
  const trait = selectTrait(rng, wave, def, state)
  const formation = pickFormation({ rng, wave, packageId: `cmdr-w${wave}` })
  return {
    hostileId: def.id,
    traitId: trait,
    pairingStatus: 'generated',
    formation,
  }
}

function promotionFor(def: HostileDef) {
  return def.role === 'elite' ? COMMANDER_PROMOTION.elite : COMMANDER_PROMOTION.pending
}

export function promoteToCommander(unit: CombatUnit, trait: CommanderTraitId, def: HostileDef): CombatUnit {
  const promo = promotionFor(def)
  const hull = unit.hullMax * promo.hull
  const shield = unit.shieldMax * promo.shield
  unit.hullMax = hull
  unit.hull = hull
  unit.shieldMax = shield
  unit.shield = shield
  unit.armor = unit.armor + promo.armorAdd
  unit.speed = unit.speed * promo.speed
  unit.authoredSpeed = unit.speed
  unit.authoredHullMax = hull
  unit.authoredShieldMax = shield
  unit.authoredArmor = unit.armor
  for (const wpn of unit.weapons) wpn.damage *= promo.damage
  unit.isCommander = true
  unit.commanderTraitId = trait
  unit.commanderSpawnedAt = 0
  unit.volatileArmed = trait === 'volatile' || unit.resonanceArmed
  if (trait === 'vanguard') {
    unit.speed *= VANGUARD_SEEDS.selfSpeedMult
    unit.authoredSpeed = unit.speed
  }
  if (trait === 'ironclad') {
    const iron = def.role === 'elite' ? IRONCLAD_SEEDS.elite : IRONCLAD_SEEDS.pending
    unit.hullMax *= iron.hullMult
    unit.hull = unit.hullMax
    unit.armor += iron.armorAdd
    unit.speed *= iron.speedMult
    unit.authoredSpeed = unit.speed
    unit.authoredHullMax = unit.hullMax
    unit.authoredArmor = unit.armor
  }
  if (trait === 'wardbearer') {
    const add = unit.hullMax * WARDBEARER_SEEDS.personalShieldFracOfHull
    unit.shieldMax = Math.max(unit.shieldMax, add)
    unit.shield = unit.shieldMax
    unit.authoredShieldMax = unit.shieldMax
  }
  if (trait === 'displacer') {
    unit.displacerCooldownLeft = 2
    unit.displacerTelegraphLeft = 0
  }
  if (trait === 'breacher') {
    unit.breacherCooldownLeft = 3
  }
  return unit
}

function escortDefs(wave: number, commanderId: HostileId, rng: SimRngState, want: number): HostileDef[] {
  const pool = introducedHostiles(wave)
    .filter((d) => d.id !== commanderId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const use = pool.length > 0 ? pool : introducedHostiles(wave)
  const out: HostileDef[] = []
  let support = 0
  let disruptor = 0
  for (let i = 0; i < want; i++) {
    const pick = use[rngInt(rng, 0, use.length - 1)]!
    if (pick.category === 'support' && support >= SUPPORT_CAP_PER_PACKAGE) continue
    if (pick.category === 'disruptor' && disruptor >= DISRUPTOR_CAP_PER_PACKAGE) continue
    if (pick.category === 'support') support += 1
    if (pick.category === 'disruptor') disruptor += 1
    out.push(pick)
  }
  while (out.length < Math.max(1, want) && use.length > 0) {
    out.push(use[out.length % use.length]!)
    if (out.length > 8) break
  }
  return out
}

export function commanderEscortBase(wave: number): number {
  return 2 + Math.min(3, Math.floor(wave / 80))
}

export function buildCommanderPackage(
  wave: number,
  seed: number,
  state?: GameState,
  density = 1,
): { commander: CombatUnit; escorts: CombatUnit[]; plan: CommanderPlan; ordinaryThreat: number } {
  const plan = planCommanderEvent(wave, seed, state)
  const def = getHostileDef(plan.hostileId)!
  const commander = promoteToCommander(buildHostileUnit({ def, wave }), plan.traitId, def)
  const rng = commanderRng(seed, wave)
  rngNext(rng)
  const escortCount = Math.min(
    DENSITY_COUNT_MAX - 1,
    Math.max(1, Math.round(commanderEscortBase(wave) * Math.max(1, density))),
  )
  const escorts = escortDefs(wave, plan.hostileId, rng, escortCount).map((esc, i) => {
    const unit = buildHostileUnit({ def: esc, wave })
    unit.rewardWeight = 1
    unit.id = `draft-escort-${i}`
    return unit
  })
  const ctx = { rng: formationRngFor(seed, wave, commanderEventOrdinal(wave) + 3), wave, packageId: `cmdr-w${wave}` }
  const formation = plan.formation
  const slots = formationSlots(formation, 1 + escorts.length, ctx)
  commander.x = slots[0]?.x ?? commander.x
  commander.y = slots[0]?.y ?? commander.y
  commander.heading = slots[0]?.bearing ?? 0
  escorts.forEach((unit, i) => {
    const slot = slots[i + 1] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })
  const ordinary = packThreat([...escorts, buildHostileUnit({ def, wave })])
  return { commander, escorts, plan, ordinaryThreat: ordinary * COMMANDER_WAVE_THREAT_MULT }
}

export function livingCommanderCount(state: GameState): number {
  return state.combat.enemyUnits.filter((u) => u.hull > 0 && u.isCommander).length
}

export function reservedCommanderCount(state: GameState): number {
  return (state.combat.reservedCommanders ?? []).length
}

export function recordCommanderHistory(state: GameState, plan: CommanderPlan, wave: number): void {
  if (!state.combat.commanderEventLog) state.combat.commanderEventLog = []
  state.combat.commanderEventLog.push({
    wave,
    hostileId: plan.hostileId,
    traitId: plan.traitId,
  })
  noteCommanderEvent(state, plan.hostileId, plan.traitId)
}

export function reserveCommander(state: GameState, unit: CombatUnit, pkg: WavePackageState, threat: number): void {
  if (!state.combat.reservedCommanders) state.combat.reservedCommanders = []
  const reserved: ReservedCommanderState = {
    unit: structuredClone(unit),
    packageId: pkg.id,
    wave: pkg.wave,
    threat,
    traitId: unit.commanderTraitId ?? 'vanguard',
    hostileId: unit.hostileId ?? '',
  }
  state.combat.reservedCommanders.push(reserved)
  pkg.pendingCount += 1
  pkg.totalUnits = Math.max(pkg.totalUnits, pkg.spawnedUnitIds.length + pkg.pendingCount)
}

export function tryReleaseReservedCommanders(state: GameState): CombatUnit[] {
  const released: CombatUnit[] = []
  const queue = state.combat.reservedCommanders ?? []
  if (queue.length === 0) return released
  const leftover: ReservedCommanderState[] = []
  for (const row of queue) {
    if (livingCommanderCount(state) + released.length >= MAX_ACTIVE_COMMANDERS) {
      leftover.push(row)
      continue
    }
    const pkg = state.combat.packages.find((p) => p.id === row.packageId)
    if (!pkg) {
      leftover.push(row)
      continue
    }
    const admitted = admitUnitToPackage(state, pkg, row.unit)
    pkg.pendingCount = Math.max(0, pkg.pendingCount - 1)
    released.push(admitted)
  }
  state.combat.reservedCommanders = leftover
  noteCommanderOverlap(state, livingCommanderCount(state))
  return released
}

export function commanderThreatShare(_wave: number): number {
  return COMMANDER_SELF_THREAT_SHARE
}

export function shouldReserveCommander(state: GameState): boolean {
  return livingCommanderCount(state) + reservedCommanderCount(state) >= MAX_ACTIVE_COMMANDERS
}
