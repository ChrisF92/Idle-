from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace(path, old, new, count=1):
    text = read(path)
    if old not in text:
        raise RuntimeError(f'missing replacement in {path}: {old[:100]!r}')
    text = text.replace(old, new, count)
    write(path, text)

# Canonical PR8 cadence.
replace('src/game/cadence.ts', '  directives: 50,', '  directives: 125,')
replace('src/game/cadence.ts', '  furnace: 140,', '  furnace: 450,')

DIRECTIVES = r'''/** Act 1 Directives — deterministic, run-defining Sortie choices. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { eligibleFragmentBlueprints } from './blueprints'
import { getModule } from './catalog'

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
  precisionCritFactorAdd: 0.10,
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
  return (state.combat.directives ?? []).includes(id)
}

export function hasDirectiveOffer(state: GameState): boolean {
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

export function directiveCritFactorAdd(state: GameState): number {
  return hasDirective(state, 'precision-protocol') ? DIRECTIVE_SEEDS.precisionCritFactorAdd : 0
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
    (u) => u.hull > 0 && u.isCore && getModule(u.coreModuleId ?? '')?.role === 'weapon' && u.currentTargetId === targetId,
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
'''
write('src/game/directives.ts', DIRECTIVES)

FURNACE = r'''/** Act 1 Furnace — Ash → Heat, then Configure → Prime → Ignite → Lock. */

import type { FurnaceChannelId, FurnaceChannelLevel, FurnaceState, GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './progression'
import { frameAshMult, frameFurnaceOutputMult, frameHeatMult } from './catalog'
import { ashYieldMult } from './workshop'
import { echoAshMult } from './echo'
import { choirTapAshToHeatMult } from './coreCombat'
import { directiveFurnaceEffectMult } from './directives'

export const FURNACE_UNLOCK_WAVE = ACT1_CADENCE.furnace
export const ASH_PER_HEAT = 10
export const FURNACE_CHANNEL_IDS: FurnaceChannelId[] = ['overdrive', 'bulwark', 'guidance', 'harvest']
export const FURNACE_INITIAL_CHANNEL_LIMIT = 2
export const FURNACE_ACT1_CHANNEL_LIMIT = 3
export const FURNACE_ASH_PER_KILL_SEED = 0.5
export const FURNACE_BOSS_ASH_MULT_SEED = 4

export const FURNACE_LEVEL_COST: Record<Exclude<FurnaceChannelLevel, 0>, number> = {
  1: 10,
  2: 25,
  3: 60,
}

export interface FurnaceChannelDef {
  id: FurnaceChannelId
  name: string
  blurb: string
  levels: Array<{
    level: Exclude<FurnaceChannelLevel, 0>
    effect: number
    acquisition?: number
    arcDegrees?: number
    fragmentFind?: number
  }>
}

export const FURNACE_CHANNELS: FurnaceChannelDef[] = [
  {
    id: 'overdrive',
    name: 'Overdrive',
    blurb: 'Weapon output for the rest of this Sortie.',
    levels: [
      { level: 1, effect: 0.20 },
      { level: 2, effect: 0.45 },
      { level: 3, effect: 0.80 },
    ],
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    blurb: 'Maximum Hull and Shield for the rest of this Sortie.',
    levels: [
      { level: 1, effect: 0.20 },
      { level: 2, effect: 0.40 },
      { level: 3, effect: 0.65 },
    ],
  },
  {
    id: 'guidance',
    name: 'Guidance',
    blurb: 'Mechanical targeting support: slew, acquisition and late firing arc.',
    levels: [
      { level: 1, effect: 0.20 },
      { level: 2, effect: 0.35, acquisition: 0.10 },
      { level: 3, effect: 0.55, acquisition: 0.15, arcDegrees: 12 },
    ],
  },
  {
    id: 'harvest',
    name: 'Harvest',
    blurb: 'Salvage and Scrap; level III also modestly improves Fragment Find. Never Ash.',
    levels: [
      { level: 1, effect: 0.20 },
      { level: 2, effect: 0.45 },
      { level: 3, effect: 0.80, fragmentFind: 0.15 },
    ],
  },
]

function emptyChannels(): Record<FurnaceChannelId, FurnaceChannelLevel> {
  return { overdrive: 0, bulwark: 0, guidance: 0, harvest: 0 }
}

export function createEmptyFurnaceState(): FurnaceState {
  return { ignited: false, channels: emptyChannels(), effectStrengthMult: 1 }
}

function level(value: unknown): FurnaceChannelLevel {
  const n = Math.floor(Number(value) || 0)
  return (n >= 0 && n <= 3 ? n : 0) as FurnaceChannelLevel
}

export function sanitizeFurnaceState(raw: unknown): FurnaceState {
  if (!raw || typeof raw !== 'object') return createEmptyFurnaceState()
  const row = raw as Partial<FurnaceState>
  const channels = row.channels && typeof row.channels === 'object' ? row.channels : emptyChannels()
  const strength = Number(row.effectStrengthMult)
  return {
    ignited: row.ignited === true,
    channels: {
      overdrive: level(channels.overdrive),
      bulwark: level(channels.bulwark),
      guidance: level(channels.guidance),
      harvest: level(channels.harvest),
    },
    effectStrengthMult: Number.isFinite(strength) && strength > 0 ? strength : 1,
  }
}

export function furnaceUnlocked(state: GameState): boolean {
  return careerBestWave(state) >= FURNACE_UNLOCK_WAVE
}

/** PR9 Engineering may populate this extension point; PR8 production limit is 2. */
let channelLimitProvider: (state: GameState) => number = () => FURNACE_INITIAL_CHANNEL_LIMIT

export function setFurnaceChannelLimitProvider(provider: ((state: GameState) => number) | null): void {
  channelLimitProvider = provider ?? (() => FURNACE_INITIAL_CHANNEL_LIMIT)
}

export function furnaceChannelLimit(state: GameState): number {
  return Math.max(FURNACE_INITIAL_CHANNEL_LIMIT, Math.min(FURNACE_ACT1_CHANNEL_LIMIT, Math.floor(channelLimitProvider(state))))
}

export function furnaceChannel(id: FurnaceChannelId): FurnaceChannelDef {
  return FURNACE_CHANNELS.find((row) => row.id === id)!
}

export function furnaceLevelDef(id: FurnaceChannelId, lv: FurnaceChannelLevel) {
  if (lv <= 0) return null
  return furnaceChannel(id).levels[lv - 1] ?? null
}

export function furnaceChannelCost(lv: FurnaceChannelLevel): number {
  return lv <= 0 ? 0 : FURNACE_LEVEL_COST[lv]
}

export function furnaceConfigurationCost(channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>): number {
  return FURNACE_CHANNEL_IDS.reduce((sum, id) => sum + furnaceChannelCost(level(channels[id])), 0)
}

export function furnaceSelectedCount(channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>): number {
  return FURNACE_CHANNEL_IDS.reduce((sum, id) => sum + (level(channels[id]) > 0 ? 1 : 0), 0)
}

export function canIgniteFurnace(
  state: GameState,
  channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>,
): { ok: boolean; reason?: string; cost: number } {
  const cost = furnaceConfigurationCost(channels)
  if (!furnaceUnlocked(state)) return { ok: false, reason: `Reach Wave ${FURNACE_UNLOCK_WAVE}`, cost }
  if (state.combat.docked || !state.combat.inFight) return { ok: false, reason: 'Launch a Sortie first', cost }
  if (state.furnace.ignited) return { ok: false, reason: 'Furnace is locked for this Sortie', cost }
  const selected = furnaceSelectedCount(channels)
  if (selected <= 0) return { ok: false, reason: 'Select at least one channel', cost }
  if (selected > furnaceChannelLimit(state)) return { ok: false, reason: `Select at most ${furnaceChannelLimit(state)} channels`, cost }
  if ((state.resources.heat ?? 0) + 1e-9 < cost) return { ok: false, reason: `Need ${cost} Heat`, cost }
  return { ok: true, cost }
}

export function igniteFurnace(
  state: GameState,
  channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>,
): GameState {
  const check = canIgniteFurnace(state, channels)
  if (!check.ok) return state
  const next = structuredClone(state)
  next.resources.heat = Math.max(0, (next.resources.heat ?? 0) - check.cost)
  next.furnace = {
    ignited: true,
    channels: {
      overdrive: level(channels.overdrive),
      bulwark: level(channels.bulwark),
      guidance: level(channels.guidance),
      harvest: level(channels.harvest),
    },
    // Burn Hot only affects a configuration Ignited after it was chosen.
    effectStrengthMult: frameFurnaceOutputMult(state) * directiveFurnaceEffectMult(state),
  }
  return next
}

export function endFurnaceSortie(state: GameState): void {
  state.resources.heat = 0
  state.furnace = createEmptyFurnaceState()
}

export function furnaceConversionLine(): string {
  return `${ASH_PER_HEAT} Ash → 1 Heat`
}

export function furnaceConversionPreview(state: GameState): { ok: boolean; reason?: string; ashUsed: number; heatGain: number } {
  if (!furnaceUnlocked(state)) return { ok: false, reason: `Reach Wave ${FURNACE_UNLOCK_WAVE}`, ashUsed: 0, heatGain: 0 }
  if (state.combat.docked || !state.combat.inFight) return { ok: false, reason: 'Launch a Sortie first', ashUsed: 0, heatGain: 0 }
  if (state.furnace.ignited) return { ok: false, reason: 'Furnace is locked; save Ash for the next Sortie', ashUsed: 0, heatGain: 0 }
  const batches = Math.floor((state.resources.choirAsh ?? 0) / ASH_PER_HEAT)
  if (batches <= 0) return { ok: false, reason: `Need ${ASH_PER_HEAT} Ash`, ashUsed: 0, heatGain: 0 }
  const conversionMult = frameHeatMult(state) * choirTapAshToHeatMult(state)
  return { ok: true, ashUsed: batches * ASH_PER_HEAT, heatGain: batches * conversionMult }
}

export function convertAshToHeat(state: GameState): GameState {
  const preview = furnaceConversionPreview(state)
  if (!preview.ok) return state
  const next = structuredClone(state)
  next.resources.choirAsh = Math.max(0, (next.resources.choirAsh ?? 0) - preview.ashUsed)
  next.resources.heat = (next.resources.heat ?? 0) + preview.heatGain
  return next
}

function activeLevel(state: GameState, id: FurnaceChannelId): FurnaceChannelLevel {
  return state.furnace.ignited ? level(state.furnace.channels[id]) : 0
}

function effectStrength(state: GameState): number {
  return state.furnace.ignited ? Math.max(0.1, state.furnace.effectStrengthMult || 1) : 1
}

function scaledBonus(state: GameState, id: FurnaceChannelId): number {
  const def = furnaceLevelDef(id, activeLevel(state, id))
  return def ? def.effect * effectStrength(state) : 0
}

export function furnaceDamageMult(state: GameState): number {
  return 1 + scaledBonus(state, 'overdrive')
}

export function furnaceHullMult(state: GameState): number {
  return 1 + scaledBonus(state, 'bulwark')
}

export function furnaceShieldMult(state: GameState): number {
  return 1 + scaledBonus(state, 'bulwark')
}

export function furnaceSalvageMult(state: GameState): number {
  return 1 + scaledBonus(state, 'harvest')
}

export function furnaceScrapMult(state: GameState): number {
  return 1 + scaledBonus(state, 'harvest')
}

export function furnaceFragmentFindMult(state: GameState): number {
  const def = furnaceLevelDef('harvest', activeLevel(state, 'harvest'))
  return 1 + (def?.fragmentFind ?? 0) * effectStrength(state)
}

export function furnaceGuidanceModifier(state: GameState): { acquisitionRangeMult: number; slewRateMult: number; firingArcAdd: number } {
  const def = furnaceLevelDef('guidance', activeLevel(state, 'guidance'))
  if (!def) return { acquisitionRangeMult: 1, slewRateMult: 1, firingArcAdd: 0 }
  const strength = effectStrength(state)
  return {
    slewRateMult: 1 + def.effect * strength,
    acquisitionRangeMult: 1 + (def.acquisition ?? 0) * strength,
    firingArcAdd: (def.arcDegrees ?? 0) * strength,
  }
}

export function furnaceLitLine(state: GameState): string {
  if (!state.furnace.ignited) return 'Not Ignited'
  const bits = FURNACE_CHANNEL_IDS
    .map((id) => {
      const lv = activeLevel(state, id)
      if (lv <= 0) return null
      return `${furnaceChannel(id).name} ${lv === 1 ? 'I' : lv === 2 ? 'II' : 'III'}`
    })
    .filter((row): row is string => Boolean(row))
  return bits.join(' · ') || 'Locked dark'
}

export function furnaceActiveEffectLine(state: GameState): string {
  if (!state.furnace.ignited) return 'Configure → Prime → Ignite'
  const bits: string[] = []
  if (activeLevel(state, 'overdrive')) bits.push(`Weapon ×${furnaceDamageMult(state).toFixed(2)}`)
  if (activeLevel(state, 'bulwark')) bits.push(`Hull/Shield ×${furnaceHullMult(state).toFixed(2)}`)
  if (activeLevel(state, 'guidance')) bits.push(`Slew ×${furnaceGuidanceModifier(state).slewRateMult.toFixed(2)}`)
  if (activeLevel(state, 'harvest')) bits.push(`Salvage/Scrap ×${furnaceSalvageMult(state).toFixed(2)}`)
  return bits.join(' · ') || 'Locked dark'
}

export function furnaceCombatFx(state: GameState): { overdrive: boolean; bulwark: boolean; guidance: boolean; harvest: boolean } {
  return {
    overdrive: activeLevel(state, 'overdrive') > 0,
    bulwark: activeLevel(state, 'bulwark') > 0,
    guidance: activeLevel(state, 'guidance') > 0,
    harvest: activeLevel(state, 'harvest') > 0,
  }
}

export function furnaceAshFromKill(state: GameState, isBoss: boolean): number {
  if (!furnaceUnlocked(state)) return 0
  const base = FURNACE_ASH_PER_KILL_SEED * (isBoss ? FURNACE_BOSS_ASH_MULT_SEED : 1)
  return base * echoAshMult(state) * frameAshMult(state) * ashYieldMult(state)
}

export function grantFurnaceKillLoot(state: GameState, isBoss: boolean): number {
  const ash = furnaceAshFromKill(state, isBoss)
  if (ash <= 0) return 0
  state.resources.choirAsh = (state.resources.choirAsh ?? 0) + ash
  return ash
}
'''
write('src/game/furnace.ts', FURNACE)

# Replace Furnace types cleanly.
types = read('src/game/types.ts')
pattern = re.compile(r"/\*\* Legacy rank tracks — kept so old saves can migrate into Furnace 2\.0\. \*/.*?export interface FurnaceState \{.*?\n\}\n", re.S)
replacement = '''export type FurnaceChannelId = 'overdrive' | 'bulwark' | 'guidance' | 'harvest'\nexport type FurnaceChannelLevel = 0 | 1 | 2 | 3\n\n/** Ignited Furnace state only. Configure/Prime is UI-local draft state and is never persisted. */\nexport interface FurnaceState {\n  ignited: boolean\n  channels: Record<FurnaceChannelId, FurnaceChannelLevel>\n  /** Snapshot at Ignite so later Directive choices cannot rewrite a locked configuration. */\n  effectStrengthMult: number\n}\n'''
types2, n = pattern.subn(replacement, types, count=1)
if n != 1:
    raise RuntimeError('failed to replace Furnace types')
write('src/game/types.ts', types2)

# State: canonical Directive/Furnace capacity and weapon hooks.
state = read('src/game/state.ts')
state = state.replace("import { furnaceDamageMult, furnaceShieldMult } from './furnace'", "import { furnaceDamageMult, furnaceHullMult, furnaceShieldMult } from './furnace'")
state = state.replace("  directiveShieldRegenMult,\n  directiveShieldMult,\n  directiveWeaponMult,", "  directiveArmorMult,\n  directiveHullMult,\n  directiveShieldRegenMult,\n  directiveShieldMult,\n  directiveWeaponCoreMult,\n  directiveWeaponCycleRateMult,\n  directiveWeaponMult,")
state = state.replace('export const SAVE_VERSION = 48', 'export const SAVE_VERSION = 49')
# Weapon Core output/cycle semantics.
needle = "  const damage = base.damage * levelMult * mastery.damageMult\n  const cooldown = base.cooldown * mastery.cooldownMult"
if needle not in state:
    raise RuntimeError('state weapon needle missing')
state = state.replace(needle, "  const role = getModule(moduleId)?.role\n  const directiveWeapon = role === 'weapon' ? directiveWeaponCoreMult(state) : 1\n  const directiveCycle = role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1\n  const damage = base.damage * levelMult * mastery.damageMult * directiveWeapon\n  const cooldown = (base.cooldown * mastery.cooldownMult) / Math.max(0.1, directiveCycle)")
# Replace splash old helper if still used later by compile; new secondary strength is damage-based, not count.
state = state.replace(' * directiveSplashMult(state)', '')
# Armor/Hull/Shield end multipliers. Use surgical common lines.
state = state.replace('  armor *= frameArmorMult(state)', '  armor *= frameArmorMult(state) * directiveArmorMult(state)')
state = state.replace('  hullMax *= frameHullMult(state)', '  hullMax *= frameHullMult(state) * directiveHullMult(state) * furnaceHullMult(state)')
state = state.replace('  shieldMax *= frameShieldMult(state)', '  shieldMax *= frameShieldMult(state)')
# Existing final shield application already has directive+furnace; leave it.
write('src/game/state.ts', state)

# Encounter generator: PR8 intentionally populates PR7 neutral modifier hook with Directive pressure.
enc = read('src/game/encounterGenerator.ts')
enc = enc.replace("import { formationThreatMultiplier } from './formations'", "import { formationThreatMultiplier } from './formations'\nimport { directiveEncounterThreatMult } from './directives'")
old = "  const raw = encounterModifierProvider(state, wave, kind) ?? {}\n  return {\n    threatMultiplier: clamp(Number(raw.threatMultiplier ?? 1) || 1, 0.5, 2),"
if old not in enc:
    raise RuntimeError('encounter modifier needle missing')
enc = enc.replace(old, "  const raw = encounterModifierProvider(state, wave, kind) ?? {}\n  const directiveThreat = directiveEncounterThreatMult(state)\n  return {\n    threatMultiplier: clamp((Number(raw.threatMultiplier ?? 1) || 1) * directiveThreat, 0.5, 2),")
write('src/game/encounterGenerator.ts', enc)

# Wave scheduler: High Tempo only normal interval; all secure rewards respect Scavenger/Harvest.
ws = read('src/game/waveScheduler.ts')
ws = ws.replace("import { waveKind } from './waves'", "import { waveKind } from './waves'\nimport { directiveNormalReinforcementIntervalMult, directiveSalvageMult, directiveScrapMult } from './directives'\nimport { furnaceSalvageMult, furnaceScrapMult } from './furnace'")
ws = ws.replace('state.combat.nextReinforcementAt = now + NORMAL_REINFORCEMENT_INTERVAL', 'state.combat.nextReinforcementAt = now + NORMAL_REINFORCEMENT_INTERVAL * directiveNormalReinforcementIntervalMult(state)')
ws = ws.replace('const salvage = salvageWaveBonus(state)', 'const salvage = salvageWaveBonus(state) * directiveSalvageMult(state) * furnaceSalvageMult(state)')
ws = ws.replace('const scrap = scrapWaveBonus(state)', 'const scrap = scrapWaveBonus(state) * directiveScrapMult(state) * furnaceScrapMult(state)')
write('src/game/waveScheduler.ts', ws)

# Targeting: replace Directive stub and add Guidance.
ct = read('src/game/coreTargeting.ts')
ct = ct.replace("import type {", "import { directiveTargetingModifier } from './directives'\nimport { furnaceGuidanceModifier } from './furnace'\nimport type {", 1)
# Find exact stub via regex.
ct, n = re.subn(r"function directiveTargetingContribution\(_state: GameState\): TargetingModifierContribution \{.*?\n\}", "function directiveTargetingContribution(state: GameState): TargetingModifierContribution {\n  const d = directiveTargetingModifier(state)\n  return { source: 'directive', ...d }\n}\n\nfunction furnaceTargetingContribution(state: GameState): TargetingModifierContribution {\n  const f = furnaceGuidanceModifier(state)\n  return { source: 'furnace', ...f }\n}", ct, count=1, flags=re.S)
if n != 1:
    raise RuntimeError('targeting directive stub missing')
# Add furnace contribution after directive in provider list.
ct = ct.replace('directiveTargetingContribution(state),', 'directiveTargetingContribution(state),\n    furnaceTargetingContribution(state),', 1)
write('src/game/coreTargeting.ts', ct)

# Core utility effects: Auxiliary Overclock scales authored utility behaviours only.
cc = read('src/game/coreCombat.ts')
cc = cc.replace("import { getModule } from './catalog'", "import { getModule } from './catalog'\nimport { directiveUtilityCoreEffectMult } from './directives'")
cc = cc.replace('  return CHOIR_FURNACE_FEED_MULT', "  return 1 + (CHOIR_FURNACE_FEED_MULT - 1) * directiveUtilityCoreEffectMult(state)")
# Sensor helper rewrite multipliers after base result by introducing utility scalar.
old_sensor = "export function sensorTargetingModifier(state: GameState): {\n  acquisitionRangeMult: number\n  slewRateMult: number\n} {\n  if (!fitted(state, 'sensor-array')) {\n    return { acquisitionRangeMult: 1, slewRateMult: 1 }\n  }\n  if (hasMasteryEffect(state, 'sensor-array', 'sensor-fire-control')) {\n    return {\n      acquisitionRangeMult: SENSOR_FCN_ACQUIRE_MULT,\n      slewRateMult: SENSOR_FCN_SLEW_MULT,\n    }\n  }\n  return {\n    acquisitionRangeMult: SENSOR_ACQUIRE_MULT,\n    slewRateMult: SENSOR_SLEW_MULT,\n  }\n}"
new_sensor = "export function sensorTargetingModifier(state: GameState): {\n  acquisitionRangeMult: number\n  slewRateMult: number\n} {\n  if (!fitted(state, 'sensor-array')) return { acquisitionRangeMult: 1, slewRateMult: 1 }\n  const utility = directiveUtilityCoreEffectMult(state)\n  const acquire = hasMasteryEffect(state, 'sensor-array', 'sensor-fire-control') ? SENSOR_FCN_ACQUIRE_MULT : SENSOR_ACQUIRE_MULT\n  const slew = hasMasteryEffect(state, 'sensor-array', 'sensor-fire-control') ? SENSOR_FCN_SLEW_MULT : SENSOR_SLEW_MULT\n  return {\n    acquisitionRangeMult: 1 + (acquire - 1) * utility,\n    slewRateMult: 1 + (slew - 1) * utility,\n  }\n}"
if old_sensor not in cc:
    raise RuntimeError('sensor helper mismatch')
cc = cc.replace(old_sensor, new_sensor)
cc = cc.replace('  return SALVAGE_MARK_BONUS\n}', '  return SALVAGE_MARK_BONUS * directiveUtilityCoreEffectMult(state)\n}', 1)
# Choir heat packet utility scale.
cc = cc.replace('  const packet = Math.min(CHOIR_HOT_RECOVERY_HEAT, CHOIR_HOT_RECOVERY_CAP - runtime.choirTapHeatGranted)', '  const boostedPacket = CHOIR_HOT_RECOVERY_HEAT * directiveUtilityCoreEffectMult(state)\n  const packet = Math.min(boostedPacket, CHOIR_HOT_RECOVERY_CAP - runtime.choirTapHeatGranted)')
# Grav: scale slow depth and pull.
cc = cc.replace('function applyGravToEnemy(enemy: CombatUnit, dt: number, slow: number): void {', 'function applyGravToEnemy(enemy: CombatUnit, dt: number, slow: number, strength = 1): void {')
cc = cc.replace('  const pull = Math.min(GRAV_DRAG_PER_SEC * dt, Math.max(0, dist - 10))', '  const pull = Math.min(GRAV_DRAG_PER_SEC * strength * dt, Math.max(0, dist - 10))')
cc = cc.replace('  enemy.controlSlowMult = Math.min(enemy.controlSlowMult ?? 1, slow)', '  const scaledSlow = Math.max(0.1, 1 - (1 - slow) * strength)\n  enemy.controlSlowMult = Math.min(enemy.controlSlowMult ?? 1, scaledSlow)')
cc = cc.replace("  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId === 'grav-tether')", "  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId === 'grav-tether')\n  const utility = directiveUtilityCoreEffectMult(state)")
cc = cc.replace('applyGravToEnemy(enemy, dt, GRAV_SLOW_FACTOR)', 'applyGravToEnemy(enemy, dt, GRAV_SLOW_FACTOR, utility)')
cc = cc.replace('applyGravToEnemy(enemy, dt, GRAV_WELL_SLOW)', 'applyGravToEnemy(enemy, dt, GRAV_WELL_SLOW, utility)')
cc = cc.replace('  let rate = NANO_LATHE_REPAIR_PER_SEC', '  let rate = NANO_LATHE_REPAIR_PER_SEC * directiveUtilityCoreEffectMult(state)')
write('src/game/coreCombat.ts', cc)

# Combat effects/rewards/crit/direct target mechanics.
combat = read('src/game/combat.ts')
combat = combat.replace("import { grantFurnaceKillLoot, furnaceResearchXpMult, furnaceSalvageMult } from './furnace'", "import { grantFurnaceKillLoot, furnaceFragmentFindMult, furnaceSalvageMult, furnaceScrapMult } from './furnace'")
# Replace/extend directives import block by finding current import.
combat = combat.replace("import {\n  directiveIncomingMult,\n  directiveScrapMult,\n} from './directives'", "import {\n  directiveCritChanceAdd,\n  directiveCritFactorAdd,\n  directiveFocusedFireMult,\n  directiveFragmentFindMult,\n  directiveHullRepairMult,\n  directiveIncomingMult,\n  directiveProtectedTargetDamageMult,\n  directiveSalvageMult,\n  directiveScrapMult,\n  directiveSecondaryDamageMult,\n} from './directives'")
# If import layout differs, inject after process import later.
if 'directiveCritChanceAdd' not in combat:
    combat = combat.replace("import { processSalvageMult } from './process'", "import { processSalvageMult } from './process'\nimport { directiveCritChanceAdd, directiveCritFactorAdd, directiveFocusedFireMult, directiveFragmentFindMult, directiveHullRepairMult, directiveIncomingMult, directiveProtectedTargetDamageMult, directiveSalvageMult, directiveScrapMult, directiveSecondaryDamageMult } from './directives'")
# Reward multipliers.
combat = combat.replace('furnaceSalvageMult(state) *', 'furnaceSalvageMult(state) *\n    directiveSalvageMult(state) *', 1)
# Find scrap kill line usages by exact common form via regex.
combat = re.sub(r'(const scrap =\s*scrapKillBonus\(state\)[^;\n]*)', r'\1 * directiveScrapMult(state) * furnaceScrapMult(state)', combat, count=1)
# Fragment chance after workshop helper.
combat = combat.replace('fragmentChanceMult(state) *', 'fragmentChanceMult(state) *\n    directiveFragmentFindMult(state) *\n    furnaceFragmentFindMult(state) *', 1)
# Remove Furnace research XP multiplier.
combat = combat.replace(' * furnaceResearchXpMult(state)', '')
combat = combat.replace('furnaceResearchXpMult(state) *', '')
# Repair multiplier both field repair base and combat hull repair.
combat = combat.replace('  return rate\n}\n\nexport function shieldRepairRatePerSecond', '  return rate * directiveHullRepairMult(state)\n}\n\nexport function shieldRepairRatePerSecond', 1)
combat = combat.replace('  const hullRepairFrac = shopHullRepair(state)', '  const hullRepairFrac = shopHullRepair(state) * directiveHullRepairMult(state)')
# tunePlayerShot signature/body.
old_tune = "function tunePlayerShot(\n  state: GameState,\n  from: CombatUnit,\n  damage: number,\n  profile: { hullDamage: number; shieldDamage: number; armorDamage: number },\n): { damage: number; profile: { hullDamage: number; shieldDamage: number; armorDamage: number } } {\n  if (from.side !== 'player') return { damage, profile }\n  const crit = combatRng(state) < critChance(state)\n  return {\n    damage: crit ? damage * critFactor(state) : damage,\n    profile: { ...profile, armorDamage: profile.armorDamage + armorPenAdd(state) },\n  }\n}"
new_tune = "function tunePlayerShot(\n  state: GameState,\n  from: CombatUnit,\n  to: CombatUnit,\n  damage: number,\n  profile: { hullDamage: number; shieldDamage: number; armorDamage: number },\n): { damage: number; profile: { hullDamage: number; shieldDamage: number; armorDamage: number } } {\n  if (from.side !== 'player') return { damage, profile }\n  const chance = Math.min(0.4, critChance(state) + directiveCritChanceAdd(state))\n  const crit = combatRng(state) < chance\n  const protectedTarget = to.shield > 0 || effectiveEnemyArmor(state, to) > 0\n  const directMult = directiveProtectedTargetDamageMult(state, protectedTarget) * directiveFocusedFireMult(state, from, to.id)\n  return {\n    damage: damage * directMult * (crit ? critFactor(state) + directiveCritFactorAdd(state) : 1),\n    profile: { ...profile, armorDamage: profile.armorDamage + armorPenAdd(state) },\n  }\n}"
if old_tune not in combat:
    raise RuntimeError('tunePlayerShot mismatch')
combat = combat.replace(old_tune, new_tune)
combat = combat.replace('tunePlayerShot(state, from, damage, weaponDamageProfile', 'tunePlayerShot(state, from, to, damage, weaponDamageProfile')
# Secondary damage option in applyPlayerCombatHit.
# First inspect signature and add secondary field to opts object if exact.
combat = combat.replace("opts?: { sourceId?: string; hit?: CombatFx['hit'] },", "opts?: { sourceId?: string; hit?: CombatFx['hit']; secondary?: boolean },")
# raw damage call in applyPlayerCombatHit.
combat = combat.replace('  const hit = applyDamageToUnit(target, rawDamage, tags, profile, state, opts)', "  const scaledDamage = opts?.secondary || tags.includes('splash') ? rawDamage * directiveSecondaryDamageMult(state) : rawDamage\n  const hit = applyDamageToUnit(target, scaledDamage, tags, profile, state, opts)", 1)
# Mark known secondary calls by source snippets.
combat = combat.replace("applyPlayerCombatHit(state, enemy, damage * 0.45, ['kinetic', 'splash'])", "applyPlayerCombatHit(state, enemy, damage * 0.45, ['kinetic', 'splash'], undefined, { secondary: true })")
combat = combat.replace('applyPlayerCombatHit(state, glance, dmg * PHASE_REFRACTION_FRACTION, beam.tags, {', 'applyPlayerCombatHit(state, glance, dmg * PHASE_REFRACTION_FRACTION, beam.tags, {')
# Existing fourth arg in phase is profile, fifth opts likely; add secondary later if easy by targeted sourceId blocks via broad replacement.
combat = combat.replace("{ sourceId: beam.fromId })", "{ sourceId: beam.fromId, secondary: true })")
combat = combat.replace("{ sourceId: shot.fromId })", "{ sourceId: shot.fromId, secondary: true })")
# Pulse hop calls have profile as fourth then opts fifth; above replacement covers common sourceId.
write('src/game/combat.ts', combat)

# Tick: no passive Furnace, directive opportunities on any secured canonical Wave, reset Furnace at launch.
tick = read('src/game/tick.ts')
tick = tick.replace("import { endFurnaceSortie, furnaceNetPerSec, tickFurnace } from './furnace'", "import { endFurnaceSortie } from './furnace'")
tick = tick.replace("import { hiveResearchHeatFromAshMult, hiveResearchSalvageOpsMult, tickResearch } from './hiveResearch'", "import { hiveResearchSalvageOpsMult, tickResearch } from './hiveResearch'")
tick = tick.replace("  add('heat', furnaceNetPerSec(state, hiveResearchHeatFromAshMult(state)))\n", '')
# queueDirectiveOffer outside boss-only block; remove existing inside and add at hook end.
tick = tick.replace('        queueDirectiveOffer(s, pkg.wave)\n', '')
needle = "        tryCompleteProtocol(s)\n      }\n    },"
if needle not in tick:
    raise RuntimeError('wave secured hook needle missing')
tick = tick.replace(needle, "        tryCompleteProtocol(s)\n      }\n      queueDirectiveOffer(s, pkg.wave)\n    },")
# Remove tickFurnace calls.
tick = re.sub(r'^\s*tickFurnace\([^\n]+\)\n', '', tick, flags=re.M)
# reset Furnace on fresh launch.
tick = tick.replace('  clearDirectives(state)\n  state.combat.docked = false', '  clearDirectives(state)\n  endFurnaceSortie(state)\n  state.combat.docked = false', 1)
write('src/game/tick.ts', tick)

# Actions: expose convert + one-time Ignite only, reset Furnace/Ash hierarchy correctly.
a = read('src/game/actions.ts')
a = re.sub(r"import \{\n  applyFurnacePreset,.*?\n\} from './furnace'", "import {\n  convertAshToHeat as convertAshToHeatRaw,\n  createEmptyFurnaceState,\n  endFurnaceSortie,\n  igniteFurnace as igniteFurnaceRaw,\n} from './furnace'", a, count=1, flags=re.S)
a = a.replace("import { hiveResearchHeatFromAshMult, setResearchFocus, startResearch, createEmptyHiveResearchState } from './hiveResearch'", "import { setResearchFocus, startResearch, createEmptyHiveResearchState } from './hiveResearch'")
a = re.sub(r"export \{ buyFurnaceUpgrade, setFurnaceChannel, setFurnacePriority, applyFurnacePreset \}\n\nexport function convertAshToHeat\(state: GameState\): GameState \{\n  return convertAshToHeatRaw\(state, hiveResearchHeatFromAshMult\(state\)\)\n\}", "export function convertAshToHeat(state: GameState): GameState {\n  return convertAshToHeatRaw(state)\n}\n\nexport function igniteFurnace(\n  state: GameState,\n  channels: Partial<Record<import('./types').FurnaceChannelId, import('./types').FurnaceChannelLevel>>,\n): GameState {\n  const next = igniteFurnaceRaw(state, channels)\n  if (next === state) return state\n  const stats = computeShipStats(next)\n  const flag = next.combat.playerUnits.find((u) => u.isFlagship)\n  if (flag) {\n    flag.hullMax = stats.hullMax\n    flag.shieldMax = stats.shieldMax\n    flag.hull = Math.min(flag.hull, flag.hullMax)\n    flag.shield = Math.min(flag.shield, flag.shieldMax)\n  }\n  syncPersistedHullCaps(next)\n  syncPlayerFleetWeapons(next)\n  return next\n}", a, count=1, flags=re.S)
# Rebuild kept fields remove legacy heat carry/furnace persistence.
a = a.replace('    heat: state.resources.heat ?? 0,\n', '')
a = a.replace('    furnace: structuredClone(state.furnace ?? createEmptyFurnaceState()),\n', '')
a = re.sub(r"heat: furnaceRestartHeat\([^\n]+\),", 'heat: 0,', a)
a = a.replace('  state.furnace = kept.furnace\n  endFurnaceSortie(state)', '  state.furnace = createEmptyFurnaceState()\n  endFurnaceSortie(state)')
write('src/game/actions.ts', a)

# Save: schema 49 has no Furnace migration compatibility.
save = read('src/game/save.ts')
save = save.replace("import { finalizeFurnaceMigration, hydrateFurnaceState } from './furnace'", "import { sanitizeFurnaceState } from './furnace'\nimport { sanitizeDirectiveIds } from './directives'")
save = save.replace('  return hydrateFurnaceState(raw)', '  return sanitizeFurnaceState(raw)')
save = save.replace('    directives: Array.isArray(combat.directives)\n      ? combat.directives.filter((id): id is string => typeof id === \'string\')\n      : [],\n    directiveOffer: Array.isArray(combat.directiveOffer)\n      ? combat.directiveOffer.filter((id): id is string => typeof id === \'string\')\n      : null,', '    directives: sanitizeDirectiveIds(combat.directives),\n    directiveOffer: combat.directiveOffer == null ? null : sanitizeDirectiveIds(combat.directiveOffer),')
save = save.replace('    finalizeFurnaceMigration(hydrated)\n', '')
write('src/game/save.ts', save)

# Process is PR9: keep dormant config only, but make stored channel vocabulary canonical and do not consume it in Furnace.
p = read('src/game/process.ts')
p = p.replace("priority: ['weapons', 'shielding', 'recovery', 'foundry', 'network', 'research'],", "priority: ['overdrive', 'bulwark', 'guidance', 'harvest'],")
# Old Furnace presets are not a PR8 runtime surface; Process PR9 will replace them. Canonical ids keep hydration harmless.
write('src/game/process.ts', p)

# Rewrite Furnace UI around local Configure/Prime draft and one persisted Ignite.
FURNACE_TAB = r'''import { useEffect, useMemo, useState } from 'react'
import type { FurnaceChannelId, FurnaceChannelLevel, GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  FURNACE_CHANNEL_IDS,
  FURNACE_CHANNELS,
  canIgniteFurnace,
  furnaceActiveEffectLine,
  furnaceChannelCost,
  furnaceChannelLimit,
  furnaceConversionLine,
  furnaceConversionPreview,
  furnaceLitLine,
} from '../../game/furnace'
import { formatCompact } from '../../game/format'
import { ContextBar, Screen, ScreenHeader, Section, StatPair } from '../../ui/primitives'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onIgnite: (channels: Partial<Record<FurnaceChannelId, FurnaceChannelLevel>>) => void
}

function emptyDraft(): Record<FurnaceChannelId, FurnaceChannelLevel> {
  return { overdrive: 0, bulwark: 0, guidance: 0, harvest: 0 }
}

function roman(level: FurnaceChannelLevel): string {
  return level === 0 ? 'OFF' : level === 1 ? 'I' : level === 2 ? 'II' : 'III'
}

export function FurnaceTab({ state, onBack, onConvert, onIgnite }: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const [draft, setDraft] = useState<Record<FurnaceChannelId, FurnaceChannelLevel>>(emptyDraft)
  const [primed, setPrimed] = useState(false)
  const locked = state.furnace.ignited
  const conversion = furnaceConversionPreview(state)
  const ignite = canIgniteFurnace(state, draft)
  const limit = furnaceChannelLimit(state)

  useEffect(() => {
    if (locked) {
      setDraft({ ...state.furnace.channels })
      setPrimed(false)
    }
  }, [locked, state.furnace.channels])

  const selected = FURNACE_CHANNEL_IDS.filter((id) => draft[id] > 0).length
  const cost = useMemo(
    () => FURNACE_CHANNEL_IDS.reduce((sum, id) => sum + furnaceChannelCost(draft[id]), 0),
    [draft],
  )

  function setLevel(id: FurnaceChannelId, level: FurnaceChannelLevel) {
    if (locked) return
    const next = { ...draft, [id]: level }
    const count = FURNACE_CHANNEL_IDS.filter((key) => next[key] > 0).length
    if (count > limit) return
    setDraft(next)
    setPrimed(false)
  }

  return (
    <Screen className="panel screen-panel furnace-screen" label="Furnace" sticky={false}>
      <ScreenHeader title="Furnace" action={<button type="button" onClick={onBack}>Systems</button>} />
      <ContextBar>
        <StatPair label="Ash" value={formatCompact(state.resources.choirAsh ?? 0, 1)} />
        <StatPair label="Heat" value={formatCompact(state.resources.heat ?? 0, 1)} />
        <StatPair label="Convert" value={furnaceConversionLine()} />
        <StatPair label="State" value={locked ? 'LOCK' : primed ? 'PRIME' : 'CONFIGURE'} />
      </ContextBar>
      {!open ? (
        <p className="muted">Reach Wave {ACT1_CADENCE.furnace} to unlock Furnace.</p>
      ) : (
        <div className="panel-scroll furnace-scroll">
          <Section>
            <p className="ui-meta">
              Ash lasts through the Rebuild cycle. Heat and the Ignited Furnace last only this Sortie.
              Configure locally, Prime to review, then Ignite once. Closing this sheet discards an un-Ignited draft.
            </p>
            {locked ? <p><strong>LOCKED THIS SORTIE</strong> · {furnaceLitLine(state)}</p> : null}
            {locked ? <p className="ui-meta">{furnaceActiveEffectLine(state)}</p> : null}
            <div className="furnace-channel-list" data-guide="furnace-channels">
              {FURNACE_CHANNELS.map((ch) => {
                const active = locked ? state.furnace.channels[ch.id] : draft[ch.id]
                return (
                  <article key={ch.id} className={`furnace-channel-card${active > 0 ? ' is-lit' : ''}`}>
                    <header className="furnace-channel-head">
                      <strong className="furnace-channel-name">{ch.name.toUpperCase()} — {roman(active)}</strong>
                    </header>
                    <p>{ch.blurb}</p>
                    <div className="furnace-tier-row">
                      {([0, 1, 2, 3] as FurnaceChannelLevel[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          className={active === lv ? 'primary' : undefined}
                          disabled={locked}
                          onClick={() => setLevel(ch.id, lv)}
                        >
                          {roman(lv)}{lv > 0 ? ` · ${furnaceChannelCost(lv)}` : ''}
                        </button>
                      ))}
                    </div>
                    {active > 0 ? (
                      <p className="ui-meta">
                        {ch.levels[active - 1]?.effect != null ? `Primary effect +${Math.round(ch.levels[active - 1]!.effect * 100)}% seed` : ''}
                      </p>
                    ) : null}
                  </article>
                )
              })}
            </div>
            {!locked ? <p className="ui-meta">Selected {selected}/{limit} · Ignite cost {cost} Heat</p> : null}
            {!locked ? (
              <div className="furnace-ignite-actions">
                {!primed ? (
                  <button type="button" className="primary" disabled={!ignite.ok} title={ignite.reason} onClick={() => setPrimed(true)}>
                    Prime configuration
                  </button>
                ) : (
                  <>
                    <p><strong>PRIMED</strong> · {selected} channel{selected === 1 ? '' : 's'} · {cost} Heat</p>
                    <button type="button" onClick={() => setPrimed(false)}>Back to Configure</button>
                    <button type="button" className="primary" disabled={!ignite.ok} title={ignite.reason} onClick={() => { onIgnite(draft); setPrimed(false) }}>
                      Ignite and Lock
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </Section>
          <Section>
            <p className="ui-meta">Ash → Heat is manual. There is no passive Heat generation, drain, or capacity.</p>
            <button type="button" disabled={!conversion.ok} title={conversion.reason} onClick={onConvert}>
              {conversion.ok ? `Convert ${formatCompact(conversion.ashUsed)} Ash → ${formatCompact(conversion.heatGain, 1)} Heat` : conversion.reason ?? 'Convert Ash'}
            </button>
          </Section>
        </div>
      )}
    </Screen>
  )
}
'''
write('src/components/tabs/FurnaceTab.tsx', FURNACE_TAB)

# Combat UI: canonical cadence text + explicit Continue Unchanged.
ui = read('src/components/tabs/CombatTab.tsx')
ui = ui.replace("import { DIRECTIVES, directivesUnlocked, getDirective, hasDirectiveOffer } from '../../game/directives'", "import { CONTINUE_UNCHANGED, DIRECTIVES, DIRECTIVE_WAVES, directivesUnlocked, getDirective, hasDirectiveOffer } from '../../game/directives'")
ui = ui.replace('Directives pause the Sortie at Waves 50, 100, 150, 200, and 250.', "Directives pause the Sortie at Waves ${DIRECTIVE_WAVES.join(', ')}.")
# If JSX literal replacement created interpolation in text incorrectly, replace full paragraph.
ui = ui.replace('<p className="muted">Directives pause the Sortie at Waves ${DIRECTIVE_WAVES.join(\', \')}.</p>', '<p className="muted">Directives pause the Sortie at Waves {DIRECTIVE_WAVES.join(\', \')}.</p>')
needle = "              {directiveOffer.map((id) => {\n                const def = getDirective(id) ?? DIRECTIVES.find((d) => d.id === id)"
if needle not in ui:
    raise RuntimeError('directive UI offer needle missing')
# Add Continue button after mapped buttons block by targeting closing map pattern.
map_end = "              })}\n            </div>"
continue_block = "              })}\n              <button\n                type=\"button\"\n                className=\"directive-pick is-continue\"\n                disabled={!onChooseDirective}\n                onClick={() => onChooseDirective?.(CONTINUE_UNCHANGED)}\n              >\n                <strong>Continue Unchanged</strong>\n                <span>Consume this opportunity without adding a Directive.</span>\n              </button>\n            </div>"
if map_end not in ui:
    raise RuntimeError('directive UI map end missing')
ui = ui.replace(map_end, continue_block, 1)
write('src/components/tabs/CombatTab.tsx', ui)

# useGame: remove legacy Furnace actions and expose Ignite.
ug = read('src/hooks/useGame.ts')
ug = ug.replace('  buyFurnaceUpgrade,\n  setFurnaceChannel,\n  setFurnacePriority,\n  applyFurnacePreset,\n', '  igniteFurnace,\n')
ug = re.sub(r"\n  \| \{ type: 'furnace-upgrade'.*?\n  \| \{ type: 'furnace-preset'.*?\n", "\n  | { type: 'furnace-ignite'; channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>> }\n", ug, count=1)
ug = re.sub(r"    case 'furnace-upgrade':.*?    case 'research-focus':", "    case 'furnace-ignite':\n      return igniteFurnace(state, action.channels)\n    case 'research-focus':", ug, count=1, flags=re.S)
ug = re.sub(r"    buyFurnaceUpgrade:.*?    setResearchFocus:", "    igniteFurnace: (channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>>) =>\n      dispatch({ type: 'furnace-ignite', channels }),\n    setResearchFocus:", ug, count=1, flags=re.S)
write('src/hooks/useGame.ts', ug)

# App Furnace prop.
app = read('src/App.tsx')
app = app.replace('            onSetChannel={game.setFurnaceChannel}', '            onIgnite={game.igniteFurnace}')
write('src/App.tsx', app)

# Battlefield VFX vocabulary canonical. Patch type and uses if present.
bf = read('src/components/Battlefield.tsx')
bf = bf.replace("{ weapons: boolean; ward: boolean; yield: boolean }", "{ overdrive: boolean; bulwark: boolean; guidance: boolean; harvest: boolean }")
bf = bf.replace('furnacePush.weapons', 'furnacePush.overdrive')
bf = bf.replace('furnacePush.ward', 'furnacePush.bulwark')
bf = bf.replace('furnacePush.yield', 'furnacePush.harvest')
write('src/components/Battlefield.tsx', bf)

# Remove runtime use of old Furnace multipliers from later-system legacy modules.
for path, symbol in [
    ('src/game/network.ts', 'furnaceNetworkMult'),
    ('src/game/foundry.ts', 'furnaceFoundrySpeedMult'),
]:
    text = read(path)
    text = re.sub(rf"import \{{[^}}]*\b{symbol}\b[^}}]*\}} from './furnace'\n", '', text)
    text = text.replace(f' * {symbol}(state)', '')
    text = text.replace(f'{symbol}(state) * ', '')
    write(path, text)

# PR9 owns Furnace automation: remove active Furnace manager/feed imports and calls, not Process data itself.
auto = read('src/game/automation.ts')
auto = re.sub(r"import \{[^}]*?(?:runFurnaceManager|convertAshToHeat)[^}]*?\} from './furnace'\n", '', auto, flags=re.S)
auto = re.sub(r"\nfunction (?:autoFeedFurnace|maybeRunFurnaceManager)\([^)]*\).*?\n\}", '', auto, flags=re.S)
auto = re.sub(r'^\s*(?:autoFeedFurnace|maybeRunFurnaceManager|runFurnaceManager)\([^\n]*\)\n', '', auto, flags=re.M)
write('src/game/automation.ts', auto)

# Canonical focused tests. Rewrite obsolete Directive/Furnace legacy suites.
DIRECTIVE_TEST = r'''import { describe, expect, it } from 'vitest'
import {
  CONTINUE_UNCHANGED,
  DIRECTIVE_WAVES,
  chooseDirective,
  directiveEncounterThreatMult,
  directiveNormalReinforcementIntervalMult,
  directiveScrapMult,
  hasDirectiveOffer,
  isDirectiveWave,
  makeDirectiveOffer,
  queueDirectiveOffer,
} from './directives'
import { createInitialState } from './state'

describe('PR8 Directives', () => {
  it('uses exactly the six canonical opportunity Waves', () => {
    expect(DIRECTIVE_WAVES).toEqual([125, 275, 425, 575, 725, 875])
    for (const wave of DIRECTIVE_WAVES) expect(isDirectiveWave(wave)).toBe(true)
    expect(isDirectiveWave(50)).toBe(false)
    expect(isDirectiveWave(900)).toBe(false)
  })

  it('offers three deterministic eligible choices without consuming combat RNG', () => {
    const s = createInitialState(0)
    s.combat.sortieSeed = 123456
    s.meta.bestWave = 125
    const before = structuredClone(s.combat.rng)
    const a = makeDirectiveOffer(s, 125)
    const b = makeDirectiveOffer(s, 125)
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    expect(s.combat.rng).toEqual(before)
  })

  it('persists an offer and Continue Unchanged consumes it without a Directive', () => {
    const s = createInitialState(0)
    s.combat.sortieSeed = 9
    s.meta.bestWave = 125
    expect(queueDirectiveOffer(s, 125)).toBe(true)
    const saved = [...(s.combat.directiveOffer ?? [])]
    expect(queueDirectiveOffer(s, 125)).toBe(false)
    expect(s.combat.directiveOffer).toEqual(saved)
    const next = chooseDirective(s, CONTINUE_UNCHANGED)
    expect(next.combat.directiveOffer).toBeNull()
    expect(next.combat.directives).toEqual([])
  })

  it('removes picked Directives from later offers and applies Pack Hunter/High Tempo mechanics', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 875
    s.combat.directiveOffer = ['pack-hunter', 'high-tempo', 'scavenger-sweep']
    s = chooseDirective(s, 'pack-hunter')
    s.combat.directiveOffer = ['high-tempo', 'scavenger-sweep', 'overcharge']
    s = chooseDirective(s, 'high-tempo')
    expect(directiveEncounterThreatMult(s)).toBeCloseTo(1.15)
    expect(directiveNormalReinforcementIntervalMult(s)).toBeCloseTo(0.85)
    expect(makeDirectiveOffer(s, 875)).not.toContain('pack-hunter')
    expect(makeDirectiveOffer(s, 875)).not.toContain('high-tempo')
  })

  it('Blueprint Hunt modifies fragment economy rather than guaranteed sources', () => {
    let s = createInitialState(0)
    s.meta.bestWave = 875
    s.combat.directiveOffer = ['blueprint-hunt']
    s = chooseDirective(s, 'blueprint-hunt')
    expect(directiveScrapMult(s)).toBeCloseTo(0.85)
    expect(hasDirectiveOffer(s)).toBe(false)
  })
})
'''
write('src/game/gdd-directives.test.ts', DIRECTIVE_TEST)

FURNACE_TEST = r'''import { describe, expect, it } from 'vitest'
import { ACT1_CADENCE } from './cadence'
import {
  ASH_PER_HEAT,
  canIgniteFurnace,
  convertAshToHeat,
  createEmptyFurnaceState,
  endFurnaceSortie,
  furnaceDamageMult,
  furnaceFragmentFindMult,
  furnaceGuidanceModifier,
  furnaceHullMult,
  furnaceSalvageMult,
  igniteFurnace,
} from './furnace'
import { createInitialState } from './state'

function liveFurnace() {
  const s = createInitialState(0)
  s.meta.bestWave = ACT1_CADENCE.furnace
  s.combat.bestWave = ACT1_CADENCE.furnace
  s.combat.wave = ACT1_CADENCE.furnace
  s.combat.waveReached = ACT1_CADENCE.furnace
  s.combat.docked = false
  s.combat.inFight = true
  return s
}

describe('PR8 Furnace', () => {
  it('unlocks at W450 and converts 10 Ash to 1 Heat with no capacity', () => {
    expect(ACT1_CADENCE.furnace).toBe(450)
    const s = liveFurnace()
    s.resources.choirAsh = ASH_PER_HEAT * 100
    const next = convertAshToHeat(s)
    expect(next.resources.choirAsh).toBe(0)
    expect(next.resources.heat).toBeGreaterThanOrEqual(100)
  })

  it('enforces two selected channels and canonical total Heat costs', () => {
    const s = liveFurnace()
    s.resources.heat = 100
    expect(canIgniteFurnace(s, { overdrive: 1, bulwark: 2 }).cost).toBe(35)
    expect(canIgniteFurnace(s, { overdrive: 1, bulwark: 1, guidance: 1 }).ok).toBe(false)
  })

  it('Ignites once, consumes Heat, and locks the exact channel state', () => {
    const s = liveFurnace()
    s.resources.heat = 60
    const next = igniteFurnace(s, { overdrive: 1, guidance: 2 })
    expect(next.furnace.ignited).toBe(true)
    expect(next.furnace.channels).toEqual({ overdrive: 1, bulwark: 0, guidance: 2, harvest: 0 })
    expect(next.resources.heat).toBe(25)
    expect(igniteFurnace(next, { harvest: 1 })).toBe(next)
  })

  it('uses the canonical channel seeds', () => {
    let s = liveFurnace()
    s.resources.heat = 120
    s = igniteFurnace(s, { overdrive: 3, guidance: 3 })
    expect(furnaceDamageMult(s)).toBeCloseTo(1.8)
    expect(furnaceGuidanceModifier(s).slewRateMult).toBeCloseTo(1.55)
    expect(furnaceGuidanceModifier(s).acquisitionRangeMult).toBeCloseTo(1.15)
    expect(furnaceGuidanceModifier(s).firingArcAdd).toBeCloseTo(12)
  })

  it('Harvest never raises Ash but III raises Salvage/Scrap and modest Fragment Find', () => {
    let s = liveFurnace()
    s.resources.heat = 60
    s = igniteFurnace(s, { harvest: 3 })
    expect(furnaceSalvageMult(s)).toBeCloseTo(1.8)
    expect(furnaceFragmentFindMult(s)).toBeCloseTo(1.15)
  })

  it('Bulwark raises capacity and Sortie end dumps Heat and locked state', () => {
    let s = liveFurnace()
    s.resources.heat = 25
    s = igniteFurnace(s, { bulwark: 2 })
    expect(furnaceHullMult(s)).toBeCloseTo(1.4)
    endFurnaceSortie(s)
    expect(s.resources.heat).toBe(0)
    expect(s.furnace).toEqual(createEmptyFurnaceState())
  })

  it('Burn Hot is snapshotted only when Ignite occurs', async () => {
    const { chooseDirective } = await import('./directives')
    let s = liveFurnace()
    s.resources.heat = 20
    s = igniteFurnace(s, { overdrive: 1 })
    s.combat.directiveOffer = ['burn-hot']
    s = chooseDirective(s, 'burn-hot')
    expect(furnaceDamageMult(s)).toBeCloseTo(1.2)

    let t = liveFurnace()
    t.resources.heat = 20
    t.combat.directiveOffer = ['burn-hot']
    t = chooseDirective(t, 'burn-hot')
    t = igniteFurnace(t, { overdrive: 1 })
    expect(furnaceDamageMult(t)).toBeCloseTo(1.24)
  })
})
'''
write('src/game/gdd-furnace.test.ts', FURNACE_TEST)
# Replace the older dedicated Furnace suite with a narrow no-legacy-architecture assertion suite.
write('src/game/furnace.test.ts', r'''import { describe, expect, it } from 'vitest'
import { FURNACE_CHANNEL_IDS, FURNACE_LEVEL_COST, createEmptyFurnaceState } from './furnace'

describe('Furnace breaking redesign surface', () => {
  it('has exactly four canonical channels and no persistent upgrade-shop state', () => {
    expect(FURNACE_CHANNEL_IDS).toEqual(['overdrive', 'bulwark', 'guidance', 'harvest'])
    expect(FURNACE_LEVEL_COST).toEqual({ 1: 10, 2: 25, 3: 60 })
    expect(Object.keys(createEmptyFurnaceState()).sort()).toEqual(['channels', 'effectStrengthMult', 'ignited'])
  })
})
''')

# New focused PR8 audit tests.
write('src/game/pr8-directives-furnace.test.ts', r'''import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { chooseDirective, makeDirectiveOffer, queueDirectiveOffer } from './directives'
import { encounterForWave } from './encounterGenerator'
import { packThreat } from './threatBudget'
import { NORMAL_REINFORCEMENT_INTERVAL, tickWaveScheduler } from './waveScheduler'
import { canIgniteFurnace, convertAshToHeat, furnaceDamageMult, igniteFurnace } from './furnace'

function mature() {
  const s = createInitialState(0)
  s.meta.bestWave = 900
  s.combat.bestWave = 900
  s.combat.sortieSeed = 24680
  return s
}

describe('PR8 integrated Directives + Furnace', () => {
  it('saveable offers are deterministic and do not include a picked Directive', () => {
    const s = mature()
    expect(queueDirectiveOffer(s, 125)).toBe(true)
    const first = [...s.combat.directiveOffer!]
    expect(makeDirectiveOffer(s, 125)).toEqual(first)
    const picked = first[0]!
    const next = chooseDirective(s, picked)
    expect(makeDirectiveOffer(next, 275)).not.toContain(picked)
  })

  it('Pack Hunter increases controlled threat without changing Commander identity/count rules', () => {
    let base = mature()
    base.combat.directives = []
    const ordinary = encounterForWave(base, 421, 77)
    let packed = structuredClone(base)
    packed.combat.directives = ['pack-hunter']
    const pressured = encounterForWave(packed, 421, 77)
    expect(packThreat(pressured.units)).toBeGreaterThan(packThreat(ordinary.units) * 1.1)
    const commander = encounterForWave(packed, 420, 77)
    expect(commander.units.filter((u) => u.isCommander)).toHaveLength(1)
  })

  it('High Tempo changes only normal reinforcement scheduling seed', () => {
    const s = mature()
    s.combat.directives = ['high-tempo']
    s.combat.inFight = true
    s.combat.docked = false
    s.combat.nextWave = 1
    s.combat.nextReinforcementAt = 0
    tickWaveScheduler(s, 0, {})
    expect(s.combat.nextReinforcementAt).toBeCloseTo(NORMAL_REINFORCEMENT_INTERVAL * 0.85)
  })

  it('capacity Directives change computed Hull/Shield without generic healing logic', () => {
    let s = mature()
    const base = computeShipStats(s)
    s.combat.directives = ['reinforced-bulkheads', 'reactive-array']
    const next = computeShipStats(s)
    expect(next.hullMax).toBeGreaterThan(base.hullMax * 1.3)
    expect(next.shieldMax).toBeGreaterThan(base.shieldMax * 1.3)
  })

  it('Furnace requires a live Sortie, supports unbounded Heat, and locks after Ignite', () => {
    let s = mature()
    s.resources.choirAsh = 1000
    expect(convertAshToHeat(s)).toBe(s)
    s.combat.docked = false
    s.combat.inFight = true
    s = convertAshToHeat(s)
    expect(s.resources.heat).toBeGreaterThanOrEqual(100)
    expect(canIgniteFurnace(s, { overdrive: 3, bulwark: 3 }).ok).toBe(true)
    s = igniteFurnace(s, { overdrive: 3, bulwark: 3 })
    expect(furnaceDamageMult(s)).toBeGreaterThan(1.7)
    expect(canIgniteFurnace(s, { harvest: 1 }).ok).toBe(false)
  })
})
''')

# Implementation note; canonical remains untouched.
write('docs/directives-furnace.md', r'''# PR8 Directives and Furnace — implementation note

This note maps the PR8 implementation to `docs/act1-canonical-design.md`. It does not modify the canonical design.

## Directives

Opportunities are exactly W125 / W275 / W425 / W575 / W725 / W875. Each opportunity persists a deterministic three-card offer derived from Sortie seed + milestone + eligible pool, plus **Continue Unchanged**. Offers do not consume combat RNG and cannot reroll on reload. A picked Directive cannot repeat in the same Sortie. All Directives reset at Sortie end.

The 14 mechanical identities use the user-approved PR8 mechanics addendum. Numeric magnitudes are centralized in `DIRECTIVE_SEEDS` for PR11 tuning. High Tempo changes only normal reinforcement interval. Pack Hunter increases the controlled ordinary/Commander-escort threat budget and never creates extra Commanders. Blueprint Hunt accelerates fragment RNG only. Burn Hot snapshots Furnace effect strength at Ignite, so choosing it later cannot rewrite an already-locked Furnace.

## Furnace

Unlock W450. Ash is Rebuild-cycle currency; Heat is Sortie currency. Conversion seed is 10 Ash → 1 Heat. There is no passive Heat generation, drain, or Heat capacity.

Lifecycle is **CONFIGURE → PRIME → IGNITE → LOCK**. Configure/Prime exists only in Furnace UI-local draft state, so closing the sheet discards it without a save-side reservation/refund mechanic. Ignite consumes the total selected Heat cost once, writes the exact locked channel configuration to save state, and cannot be edited for the remainder of the Sortie.

Channels are exactly Overdrive / Bulwark / Guidance / Harvest at OFF/I/II/III. Initial selected-channel limit is two. A typed provider is left for PR9 Engineering to raise the Act 1 limit to three; PR8 production does not activate it. There is no Furnace upgrade shop.

Heat cost seeds are I=10, II=25, III=60. Channel effect seeds follow the canonical numeric package. Harvest never increases Ash. Reactor Frame and Choir Tap use their already-authored conversion/effect hooks; legacy Protocol/Process Furnace runtime multipliers are not part of PR8.

Ash-per-kill exact magnitude is not authored canonically. PR8 therefore centralizes a deliberately neutral PR11-tunable implementation seed (`0.5`, Boss ×4) rather than preserving the legacy Wave-as-Sector formula.

## Boundaries

PR9 owns Research and Process replacement, including Engineering channel-count progression, Furnace presets/auto-Ignite and Directive Preference. PR10 owns final Challenge restrictions. PR11 owns final numeric balance/simulation tuning. No PR9–PR11 feature is pulled forward here.
''')

print('PR8 transform applied')
