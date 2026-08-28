/** Act 1 Furnace — Ash → Heat, then Configure → Prime → Ignite → Lock. */

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
  if (lv === 0) return 0
  return FURNACE_LEVEL_COST[lv]
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
