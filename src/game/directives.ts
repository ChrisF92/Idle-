/** Act 1 Directives — deterministic, run-defining Sortie choices. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { eligibleFragmentBlueprints } from './blueprints'
import { getModule } from './catalog'
import { challengeBlocksDirectives } from './challenges'

export const DIRECTIVE_WAVES = [125, 275, 425, 575, 725, 875] as const
export const DIRECTIVE_OFFER_SIZE = 3
export const CONTINUE_UNCHANGED = 'continue-unchanged' as const

export type DirectiveId =
  | 'overcharge'
  | 'precision-protocol'
  | 'siege-calibration'
  | 'focused-fire'
  | 'pack-hunter'
  | 'gyro-sync'
  | 'reactive-array'
  | 'reinforced-bulkheads'
  | 'regenerative-loop'
  | 'scavenger-sweep'
  | 'high-tempo'
  | 'blueprint-hunt'
  | 'burn-hot'
  | 'auxiliary-overclock'

export interface DirectiveDef {
  id: DirectiveId
  name: string
  blurb: string
}

/** PR11-tunable magnitudes. Mechanics/identities are fixed by the approved PR8 addendum. */
export const DIRECTIVE_SEEDS = {
  overchargeWeapon: 1.25,
  overchargeIncoming: 1.12,
  precisionCritChanceAdd: 0.10,
  precisionCritFactorMult: 1.10,
  precisionSecondary: 0.85,
  siegeProtectedDamage: 1.20,
  siegeCycleRate: 0.90,
  focusPerAdditionalCore: 0.10,
  focusMax: 1.30,
  focusSecondary: 0.80,
  packSecondary: 1.20,
  packThreat: 1.15,
  gyroSlew: 1.25,
  gyroAcquisition: 1.10,
  gyroArcDegrees: 8,
  reactiveShield: 1.35,
  reactiveShieldRegen: 0.75,
  bulkheadHull: 1.35,
  bulkheadArmor: 1.10,
  bulkheadSlew: 0.88,
  regenerativeRecovery: 1.35,
  regenerativeCapacity: 0.80,
  scavengerSalvage: 1.30,
  scavengerScrap: 1.30,
  scavengerWeapon: 0.88,
  highTempoInterval: 0.85,
  blueprintFragmentFind: 1.50,
  blueprintScrap: 0.85,
  burnHotFurnace: 1.20,
  burnHotIncoming: 1.15,
  auxiliaryUtility: 1.20,
  auxiliaryWeapon: 0.90,
} as const

export const DIRECTIVES: DirectiveDef[] = [
  { id: 'overcharge', name: 'Overcharge', blurb: 'Weapon output +25%. Incoming damage +12%.' },
  { id: 'precision-protocol', name: 'Precision Protocol', blurb: 'Crit Chance +10 points and Crit Factor +10%; secondary blast/chain damage -15%.' },
  { id: 'siege-calibration', name: 'Siege Calibration', blurb: '+20% direct damage into Armor or Shield. Weapon cycle rate -10%.' },
  { id: 'focused-fire', name: 'Focused Fire', blurb: 'Weapon Cores concentrating a target gain up to +30% direct damage. Secondary damage -20%.' },
  { id: 'pack-hunter', name: 'Pack Hunter', blurb: 'Secondary blast/chain damage +20%. Ordinary and Commander-escort threat +15%.' },
  { id: 'gyro-sync', name: 'Gyro Sync', blurb: 'Core slew +25%, Acquisition +10%, firing arc +8°.' },
  { id: 'reactive-array', name: 'Reactive Array', blurb: 'Max Shield +35%. Shield Regen -25%.' },
  { id: 'reinforced-bulkheads', name: 'Reinforced Bulkheads', blurb: 'Max Hull +35%, Armor effectiveness +10%. Core slew -12%.' },
  { id: 'regenerative-loop', name: 'Regenerative Loop', blurb: 'Shield Regen and Hull Repair +35%. Max Hull and Shield -20%.' },
  { id: 'scavenger-sweep', name: 'Scavenger Sweep', blurb: 'Salvage and Scrap +30%. Weapon output -12%.' },
  { id: 'high-tempo', name: 'High Tempo', blurb: 'Normal reinforcement interval is 15% shorter.' },
  { id: 'blueprint-hunt', name: 'Blueprint Hunt', blurb: 'Blueprint Fragment Find +50%. Scrap yield -15%.' },
  { id: 'burn-hot', name: 'Burn Hot', blurb: 'Furnace channel strength +20% when Ignited after selection. Incoming damage +15%.' },
  { id: 'auxiliary-overclock', name: 'Auxiliary Overclock', blurb: 'Utility Core effects +20%. Weapon Core output -10%.' },
]

const IDS = new Set<DirectiveId>(DIRECTIVES.map((d) => d.id))

export function isDirectiveId(id: unknown): id is DirectiveId {
  return typeof id === 'string' && IDS.has(id as DirectiveId)
}

export function sanitizeDirectiveIds(ids: unknown): DirectiveId[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<DirectiveId>()
  const out: DirectiveId[] = []
  for (const id of ids) {
    if (!isDirectiveId(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function getDirective(id: string): DirectiveDef | undefined {
  return DIRECTIVES.find((d) => d.id === id)
}

export function isDirectiveWave(wave: number): boolean {
  const w = Math.max(0, Math.floor(wave))
  return (DIRECTIVE_WAVES as readonly number[]).includes(w)
}

export function hasDirective(state: GameState, id: DirectiveId): boolean {
  if (challengeBlocksDirectives(state)) return false
  return (state.combat.directives ?? []).includes(id)
}

export function hasDirectiveOffer(state: GameState): boolean {
  if (challengeBlocksDirectives(state)) return false
  return (state.combat.directiveOffer?.length ?? 0) > 0
}

export function directivesUnlocked(state: GameState): boolean {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  return best >= ACT1_CADENCE.directives || (state.combat.directives?.length ?? 0) > 0 || hasDirectiveOffer(state)
}

function blueprintHuntRelevant(state: GameState, wave: number): boolean {
  return eligibleFragmentBlueprints(state, Math.max(1, wave)).length > 0
}

export function directiveEligible(state: GameState, id: DirectiveId, wave: number): boolean {
  if (hasDirective(state, id)) return false
  if (id === 'burn-hot') {
    const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, wave)
    return best >= ACT1_CADENCE.furnace
  }
  if (id === 'blueprint-hunt') return blueprintHuntRelevant(state, wave)
  return true
}

function hash32(seed: number, wave: number): number {
  let x = ((Math.floor(seed) >>> 0) ^ Math.imul(Math.floor(wave) >>> 0, 0x9e3779b1)) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

function nextHash(x: number): number {
  x = (x + 0x6d2b79f5) >>> 0
  let t = x
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}

/** Deterministic from Sortie seed + milestone + eligible set. Does not consume combat RNG. */
export function makeDirectiveOffer(state: GameState, wave: number): DirectiveId[] {
  const pool = DIRECTIVES.map((d) => d.id).filter((id) => directiveEligible(state, id, wave))
  let h = hash32(state.combat.sortieSeed || 1, wave)
  for (let i = pool.length - 1; i > 0; i--) {
    h = nextHash(h)
    const j = h % (i + 1)
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, DIRECTIVE_OFFER_SIZE)
}

export function queueDirectiveOffer(state: GameState, clearedWave: number): boolean {
  if (challengeBlocksDirectives(state)) return false
  if (!isDirectiveWave(clearedWave) || hasDirectiveOffer(state)) return false
  const offer = makeDirectiveOffer(state, clearedWave)
  if (offer.length === 0) return false
  state.combat.directiveOffer = offer
  return true
}

export function chooseDirective(state: GameState, id: string): GameState {
  const offer = sanitizeDirectiveIds(state.combat.directiveOffer)
  if (id === CONTINUE_UNCHANGED) {
    if (offer.length === 0) return state
    const next = structuredClone(state)
    next.combat.directiveOffer = null
    next.combat.log = ['Directive opportunity: Continue Unchanged.', ...next.combat.log]
    return next
  }
  if (!isDirectiveId(id) || !offer.includes(id)) return state
  const def = getDirective(id)!
  const next = structuredClone(state)
  next.combat.directives = [...sanitizeDirectiveIds(next.combat.directives), id]
  next.combat.directiveOffer = null
  next.combat.log = [`Directive: ${def.name}. ${def.blurb}`, ...next.combat.log]
  return next
}

export function clearDirectives(state: GameState): void {
  state.combat.directives = []
  state.combat.directiveOffer = null
}

function product(state: GameState, rows: Array<[DirectiveId, number]>): number {
  let out = 1
  for (const [id, mult] of rows) if (hasDirective(state, id)) out *= mult
  return out
}

export function directiveWeaponMult(state: GameState): number {
  return product(state, [
    ['overcharge', DIRECTIVE_SEEDS.overchargeWeapon],
    ['scavenger-sweep', DIRECTIVE_SEEDS.scavengerWeapon],
  ])
}

export function directiveWeaponCoreMult(state: GameState): number {
  return hasDirective(state, 'auxiliary-overclock') ? DIRECTIVE_SEEDS.auxiliaryWeapon : 1
}

export function directiveIncomingMult(state: GameState): number {
  return product(state, [
    ['overcharge', DIRECTIVE_SEEDS.overchargeIncoming],
    ['burn-hot', DIRECTIVE_SEEDS.burnHotIncoming],
  ])
}

export function directiveSalvageMult(state: GameState): number {
  return hasDirective(state, 'scavenger-sweep') ? DIRECTIVE_SEEDS.scavengerSalvage : 1
}

export function directiveScrapMult(state: GameState): number {
  return product(state, [
    ['scavenger-sweep', DIRECTIVE_SEEDS.scavengerScrap],
    ['blueprint-hunt', DIRECTIVE_SEEDS.blueprintScrap],
  ])
}

export function directiveShieldMult(state: GameState): number {
  return product(state, [
    ['reactive-array', DIRECTIVE_SEEDS.reactiveShield],
    ['regenerative-loop', DIRECTIVE_SEEDS.regenerativeCapacity],
  ])
}

export function directiveHullMult(state: GameState): number {
  return product(state, [
    ['reinforced-bulkheads', DIRECTIVE_SEEDS.bulkheadHull],
    ['regenerative-loop', DIRECTIVE_SEEDS.regenerativeCapacity],
  ])
}

export function directiveArmorMult(state: GameState): number {
  return hasDirective(state, 'reinforced-bulkheads') ? DIRECTIVE_SEEDS.bulkheadArmor : 1
}

export function directiveShieldRegenMult(state: GameState): number {
  return product(state, [
    ['reactive-array', DIRECTIVE_SEEDS.reactiveShieldRegen],
    ['regenerative-loop', DIRECTIVE_SEEDS.regenerativeRecovery],
  ])
}

export function directiveHullRepairMult(state: GameState): number {
  return hasDirective(state, 'regenerative-loop') ? DIRECTIVE_SEEDS.regenerativeRecovery : 1
}

export function directiveSecondaryDamageMult(state: GameState): number {
  return product(state, [
    ['precision-protocol', DIRECTIVE_SEEDS.precisionSecondary],
    ['focused-fire', DIRECTIVE_SEEDS.focusSecondary],
    ['pack-hunter', DIRECTIVE_SEEDS.packSecondary],
  ])
}

export function directiveCritChanceAdd(state: GameState): number {
  return hasDirective(state, 'precision-protocol') ? DIRECTIVE_SEEDS.precisionCritChanceAdd : 0
}

export function directiveCritFactorMult(state: GameState): number {
  return hasDirective(state, 'precision-protocol') ? DIRECTIVE_SEEDS.precisionCritFactorMult : 1
}

export function directiveWeaponCycleRateMult(state: GameState): number {
  return hasDirective(state, 'siege-calibration') ? DIRECTIVE_SEEDS.siegeCycleRate : 1
}

export function directiveProtectedTargetDamageMult(state: GameState, protectedTarget: boolean): number {
  return protectedTarget && hasDirective(state, 'siege-calibration') ? DIRECTIVE_SEEDS.siegeProtectedDamage : 1
}

export function directiveFocusedFireMult(state: GameState, source: { id: string; isCore?: boolean; coreModuleId?: string }, targetId: string): number {
  if (!hasDirective(state, 'focused-fire') || !source.isCore) return 1
  if (getModule(source.coreModuleId ?? '')?.role !== 'weapon') return 1
  const focused = state.combat.playerUnits.filter(
    (u) => u.isCore && getModule(u.coreModuleId ?? '')?.role === 'weapon' && u.currentTargetId === targetId,
  ).length
  const extra = Math.max(0, focused - 1)
  return Math.min(DIRECTIVE_SEEDS.focusMax, 1 + extra * DIRECTIVE_SEEDS.focusPerAdditionalCore)
}

export function directiveTargetingModifier(state: GameState): { acquisitionRangeMult: number; slewRateMult: number; firingArcAdd: number } {
  let acquisitionRangeMult = 1
  let slewRateMult = 1
  let firingArcAdd = 0
  if (hasDirective(state, 'gyro-sync')) {
    acquisitionRangeMult *= DIRECTIVE_SEEDS.gyroAcquisition
    slewRateMult *= DIRECTIVE_SEEDS.gyroSlew
    firingArcAdd += DIRECTIVE_SEEDS.gyroArcDegrees
  }
  if (hasDirective(state, 'reinforced-bulkheads')) slewRateMult *= DIRECTIVE_SEEDS.bulkheadSlew
  return { acquisitionRangeMult, slewRateMult, firingArcAdd }
}

export function directiveEncounterThreatMult(state: GameState): number {
  return hasDirective(state, 'pack-hunter') ? DIRECTIVE_SEEDS.packThreat : 1
}

export function directiveNormalReinforcementIntervalMult(state: GameState): number {
  return hasDirective(state, 'high-tempo') ? DIRECTIVE_SEEDS.highTempoInterval : 1
}

export function directiveFragmentFindMult(state: GameState): number {
  return hasDirective(state, 'blueprint-hunt') ? DIRECTIVE_SEEDS.blueprintFragmentFind : 1
}

export function directiveFurnaceEffectMult(state: GameState): number {
  return hasDirective(state, 'burn-hot') ? DIRECTIVE_SEEDS.burnHotFurnace : 1
}

export function directiveUtilityCoreEffectMult(state: GameState): number {
  return hasDirective(state, 'auxiliary-overclock') ? DIRECTIVE_SEEDS.auxiliaryUtility : 1
}
