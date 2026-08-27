/** Catalogue-based ordinary and Commander encounter generation. */

import type { CombatUnit, GameState } from './types'
import {
  buildHostileUnit,
  firstContactHostile,
  getHostileDef,
  introducedHostiles,
  type HostileDef,
} from './hostileCatalogue'
import {
  DISRUPTOR_CAP_PER_PACKAGE,
  FORMATION_DISPERSION_WEIGHT,
  FORMATION_DISPERSION_WEIGHT_MAX,
  ORDINARY_COUNT_MAX,
  ORDINARY_COUNT_MIN,
  SUPPORT_CAP_PER_PACKAGE,
} from './hostileSeeds'
import { FORMATION_IDS, formationRngFor, formationSlots, pickFormation, type FormationId } from './formations'
import { createSimRng, hashSeed, rngInt, type SimRngState } from './simRng'
import { isBossWave } from './waves'
import { measureThreatRoll, packThreat, threatBudgetForWave } from './threatBudget'
import {
  buildCommanderPackage,
  isCommanderWave,
  recordCommanderHistory,
} from './commanders'

export interface WaveEncounter {
  id: string
  name: string
  family: string
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
  formation?: FormationId
  commanderReserved?: CombatUnit
}

const ENCOUNTER_CHANNEL = 0xe11c07

function encounterRng(seed: number, wave: number, ordinal: number): SimRngState {
  return createSimRng(hashSeed(seed >>> 0, wave, ordinal, ENCOUNTER_CHANNEL))
}

function respectCaps(picks: HostileDef[]): HostileDef[] {
  let support = 0
  let disruptor = 0
  const out: HostileDef[] = []
  for (const def of picks) {
    if (def.category === 'support' && support >= SUPPORT_CAP_PER_PACKAGE) continue
    if (def.category === 'disruptor' && disruptor >= DISRUPTOR_CAP_PER_PACKAGE) continue
    if (def.category === 'support') support += 1
    if (def.category === 'disruptor') disruptor += 1
    out.push(def)
  }
  return out
}

export function supportDisruptorCounts(units: CombatUnit[]): { support: number; disruptor: number } {
  let support = 0
  let disruptor = 0
  for (const unit of units) {
    const def = getHostileDef(unit.hostileId)
    if (def?.category === 'support') support += 1
    if (def?.category === 'disruptor') disruptor += 1
  }
  return { support, disruptor }
}

export function formationDispersionWeight(id: FormationId): number {
  return Math.min(FORMATION_DISPERSION_WEIGHT_MAX, FORMATION_DISPERSION_WEIGHT[id] ?? 0)
}

function pickMix(wave: number, rng: SimRngState, count: number): HostileDef[] {
  const intro = firstContactHostile(wave)
  const pool = introducedHostiles(wave).sort((a, b) => a.id.localeCompare(b.id))
  const picks: HostileDef[] = []
  if (intro) picks.push(intro)
  while (picks.length < count && pool.length > 0) {
    picks.push(pool[rngInt(rng, 0, pool.length - 1)]!)
  }
  const capped = respectCaps(picks)
  if (intro && !capped.some((d) => d.id === intro.id)) capped.unshift(intro)
  return capped.slice(0, Math.max(count, intro ? 1 : 0))
}

function applyFormation(units: CombatUnit[], wave: number, seed: number, ordinal: number): FormationId {
  const rng = formationRngFor(seed, wave, ordinal)
  const ctx = { rng, wave, packageId: `w${wave}-p${ordinal}` }
  const formation = pickFormation(ctx)
  const slots = formationSlots(formation, units.length, ctx)
  units.forEach((unit, i) => {
    const slot = slots[i] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })
  return formation
}

function ordinaryEncounter(wave: number, seed: number, ordinal: number, extraDanger: number): WaveEncounter {
  const rng = encounterRng(seed, wave, ordinal)
  const want =
    ORDINARY_COUNT_MIN + rngInt(rng, 0, Math.max(0, ORDINARY_COUNT_MAX - ORDINARY_COUNT_MIN))
  const defs = pickMix(wave, rng, want)
  const units = defs.map((def, i) => {
    const unit = buildHostileUnit({ def, wave })
    unit.id = `draft-${def.id}-${i}`
    if (extraDanger !== 1) {
      unit.hullMax *= extraDanger
      unit.hull = unit.hullMax
      unit.shieldMax *= extraDanger
      unit.shield = unit.shieldMax
      for (const wpn of unit.weapons) wpn.damage *= extraDanger
    }
    return unit
  })
  const formation = applyFormation(units, wave, seed, ordinal)
  const budget = threatBudgetForWave(wave)
  const spent = packThreat(units) * (1 + formationDispersionWeight(formation))
  const lead = units[0]
  return {
    id: `w${wave}-${lead?.hostileId ?? 'pack'}`,
    name: lead ? `${lead.name} pack (W${wave})` : `Wave ${wave}`,
    family: lead?.family ?? '',
    tags: [formation, ...(lead?.hostileId ? [lead.hostileId] : [])],
    isBoss: false,
    scrapReward: 5 + Math.floor(wave / 5),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: firstContactHostile(wave)
      ? `First contact: ${firstContactHostile(wave)!.name}.`
      : 'Ordinary reinforcement from introduced hostiles.',
    units,
    formation,
    threat: { ...measureThreatRoll(units, seed, budget, false), spent },
  }
}

function commanderEncounter(wave: number, seed: number, state?: GameState): WaveEncounter {
  const built = buildCommanderPackage(wave, seed, state)
  if (state) recordCommanderHistory(state, built.plan, wave)
  const units = [built.commander, ...built.escorts]
  const spent = packThreat(units) * (1 + formationDispersionWeight(built.plan.formation))
  return {
    id: `w${wave}-commander`,
    name: `COMMANDER · ${built.commander.name}`,
    family: built.commander.family ?? '',
    tags: ['commander', built.plan.traitId, built.plan.formation],
    isBoss: false,
    scrapReward: 5 + Math.floor(wave / 5),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: wave === 10
      ? 'COMMANDER CONTACT. Promoted hostiles carry one enhanced trait and improved rewards.'
      : `Commander · ${built.plan.traitId}`,
    units,
    formation: built.plan.formation,
    threat: { seed, budget: built.ordinaryThreat, spent },
  }
}

/**
 * Ordinary / Commander encounters. Proper Bosses use the Boss provider.
 * `extraDanger` remains a test multiplier only.
 */
export function encounterForWave(wave: number, extraDanger = 1, state?: GameState): WaveEncounter {
  const w = Math.max(1, Math.floor(wave))
  if (isBossWave(w)) {
    return {
      id: `w${w}-boss-placeholder`,
      name: `Boss Wave ${w}`,
      family: '',
      tags: ['boss'],
      isBoss: false,
      scrapReward: 0,
      dataReward: 0,
      aiReward: 0,
      essenceReward: 0,
      salvageReward: 0,
      blurb: 'Proper Boss encounters resolve through the Boss provider.',
      units: [],
    }
  }
  const seed = state?.combat.sortieSeed ?? 0
  const ordinal = (state?.combat.packages.length ?? 0) + 1
  if (isCommanderWave(w)) return commanderEncounter(w, seed, state)
  return ordinaryEncounter(w, seed, ordinal, extraDanger)
}

export function firstContactCanAppear(wave: number): boolean {
  return Boolean(firstContactHostile(wave))
}

export function firstContactForbiddenBefore(id: string, wave: number): boolean {
  const def = getHostileDef(id)
  if (!def) return true
  return wave < def.firstContactWave
}

/** Isolated from combat/loot RNG. */
export function formationPositionsFor(
  seed: number,
  wave: number,
  ordinal: number,
  count: number,
  formation?: FormationId,
): { formation: FormationId; xs: number[]; ys: number[] } {
  const rng = formationRngFor(seed, wave, ordinal)
  const id = formation ?? pickFormation({ rng, wave, packageId: `w${wave}-p${ordinal}` })
  const slots = formationSlots(id, count, { rng, wave, packageId: `w${wave}-p${ordinal}` })
  return { formation: id, xs: slots.map((s) => s.x), ys: slots.map((s) => s.y) }
}

export { FORMATION_IDS }
