/** Catalogue-based ordinary and Commander encounter generation. */

import type { CombatUnit, GameState } from './types'
import {
  buildHostileUnit,
  firstContactHostile,
  getHostileDef,
} from './hostileCatalogue'
import {
  DENSITY_COUNT_MAX,
} from './hostileSeeds'
import { securedWaveScrapBase } from './enemyScaling'
import { FORMATION_IDS, formationRngFor, formationSlots, pickFormation, type FormationId } from './formations'
import { isBossWave } from './waves'
import { ordinarySpawnPlan } from './spawnDirector'
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
  spawn?: {
    rate: number
    checkCount: number
    weights: Array<{ hostileId: string; weight: number }>
    offsets: number[]
  }
  formation?: FormationId
  commanderReserved?: CombatUnit
}

/** Neutral extension point for later authored systems. PR7 installs no provider. */
export interface EncounterGenerationModifier {
  spawnRateMultiplier?: number
  countDelta?: number
}

export type EncounterModifierProvider = (
  state: GameState,
  wave: number,
  kind: 'ordinary' | 'commander',
) => EncounterGenerationModifier

let encounterModifierProvider: EncounterModifierProvider | null = null

export function setEncounterModifierProvider(provider: EncounterModifierProvider | null): void {
  encounterModifierProvider = provider
}

export function resetEncounterModifierProvider(): void {
  encounterModifierProvider = null
}

function modifierFor(
  state: GameState | undefined,
  wave: number,
  kind: 'ordinary' | 'commander',
): Required<EncounterGenerationModifier> {
  const raw = state && encounterModifierProvider ? encounterModifierProvider(state, wave, kind) : {}
  return {
    spawnRateMultiplier: Math.max(0.1, Number(raw.spawnRateMultiplier ?? 1) || 1),
    countDelta: Math.trunc(Number(raw.countDelta ?? 0) || 0),
  }
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

function ordinaryEncounter(
  wave: number,
  seed: number,
  ordinal: number,
  extraDanger: number,
  modifier: Required<EncounterGenerationModifier>,
): WaveEncounter {
  const plan = ordinarySpawnPlan({
    wave,
    sortieSeed: seed,
    packageOrdinal: ordinal,
    spawnRateMultiplier: Math.max(0.1, extraDanger) * modifier.spawnRateMultiplier,
    countDelta: modifier.countDelta,
  })
  const defs = plan.defs.slice(0, DENSITY_COUNT_MAX)
  const units = defs.map((def, i) => {
    const unit = buildHostileUnit({ def, wave })
    unit.id = `draft-${def.id}-${i}`
    return unit
  })
  const formation = applyFormation(units, wave, seed, ordinal)
  const lead = units[0]
  return {
    id: `w${wave}-${lead?.hostileId ?? 'pack'}`,
    name: lead ? `${lead.name} pack (W${wave})` : `Wave ${wave}`,
    family: lead?.family ?? '',
    tags: [formation, ...(lead?.hostileId ? [lead.hostileId] : [])],
    isBoss: false,
    scrapReward: securedWaveScrapBase(wave),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: firstContactHostile(wave)
      ? `First contact: ${firstContactHostile(wave)!.name}.`
      : 'Ordinary reinforcement from introduced hostiles.',
    units,
    formation,
    spawn: {
      rate: plan.spawnRate,
      checkCount: plan.checkCount,
      weights: plan.weights,
      offsets: plan.offsets.slice(0, units.length),
    },
  }
}

function commanderEncounter(
  wave: number,
  seed: number,
  state: GameState | undefined,
  modifier: Required<EncounterGenerationModifier>,
): WaveEncounter {
  const built = buildCommanderPackage(
    wave,
    seed,
    state,
    modifier.spawnRateMultiplier,
    modifier.countDelta,
  )
  if (state) recordCommanderHistory(state, built.plan, wave)
  const units = [built.commander, ...built.escorts]
  return {
    id: `w${wave}-commander`,
    name: `COMMANDER · ${built.commander.name}`,
    family: built.commander.family ?? '',
    tags: ['commander', built.plan.traitId, built.plan.formation],
    isBoss: false,
    scrapReward: securedWaveScrapBase(wave),
    dataReward: 1 + Math.floor(wave / 30),
    aiReward: 0,
    essenceReward: 0,
    salvageReward: 0,
    blurb: wave === 10
      ? 'COMMANDER CONTACT. Promoted hostiles carry one enhanced trait and improved rewards.'
      : `Commander · ${built.plan.traitId}`,
    units,
    formation: built.plan.formation,
  }
}

/** Ordinary / Commander encounters. Proper Bosses use the Boss provider. */
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
  if (isCommanderWave(w)) return commanderEncounter(w, seed, state, modifierFor(state, w, 'commander'))
  return ordinaryEncounter(w, seed, ordinal, extraDanger, modifierFor(state, w, 'ordinary'))
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
