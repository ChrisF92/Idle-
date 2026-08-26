/** Furnace — convert cycle Ash into Sortie Heat and spend it on a push. */

import type {
  FurnaceChannelId,
  FurnacePresetId,
  FurnaceState,
  FurnaceTrackId,
  FurnaceUpgradeId,
  GameState,
} from './types'
import { careerBestWave } from './progression'
import { reliquaryAshMult } from './reliquary'
import { protocolBonusMult, protocolModifiers, protocolMutes } from './protocols'
import { echoAshMult } from './echo'
import { mergeProcessConfig, processConfig, processFurnaceHooks } from './process'
import { noteSystemAction } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { directiveHeatMult } from './directives'
import { frameAshMult, frameFurnaceOutputMult, frameHeatMult } from './catalog'
import { choirTapAshToHeatMult } from './coreCombat'
import { ashYieldMult } from './workshop'

export const FURNACE_UNLOCK_SECTOR = ACT1_CADENCE.furnace
export const ASH_PER_HEAT = 10
export const FURNACE_CHANNEL_MAX = 3
export const FURNACE_SLOT_CAP = 5

/** @deprecated old rank cap; upgrades use their own maxRank. */
export const FURNACE_MAX_RANK = 8

export const FURNACE_CHANNEL_IDS: FurnaceChannelId[] = [
  'weapons',
  'shielding',
  'network',
  'foundry',
  'research',
  'recovery',
]

export const FURNACE_UPGRADE_IDS: FurnaceUpgradeId[] = [
  'hearth',
  'cistern',
  'flue',
  'bellows',
  'taps',
  'kindling',
  'ember',
]

export const LEGACY_TRACK_TO_CHANNEL: Record<FurnaceTrackId, FurnaceChannelId> = {
  attack: 'weapons',
  defense: 'shielding',
  lab: 'research',
  workshop: 'foundry',
  hold: 'recovery',
}

export interface FurnaceChannelLevelDef {
  mult: number
  heat: number
  ashMult?: number
}

export interface FurnaceChannelDef {
  id: FurnaceChannelId
  name: string
  blurb: string
  detail: string[]
  stat: string
  levels: [FurnaceChannelLevelDef, FurnaceChannelLevelDef, FurnaceChannelLevelDef]
}

/** Push channels the player can light (GDD §75). Other ids stay on the save for hydrate. */
export const GDD_FURNACE_CHANNEL_IDS: FurnaceChannelId[] = ['weapons', 'shielding', 'recovery']

export const FURNACE_CHANNELS: FurnaceChannelDef[] = [
  {
    id: 'weapons',
    name: 'Weapons',
    blurb: 'This Sortie’s weapon output. Spend Heat to break a wall.',
    stat: 'Weapon Output',
    levels: [
      { mult: 1.4, heat: 8 },
      { mult: 1.8, heat: 20 },
      { mult: 2.5, heat: 48 },
    ],
    detail: [
      'Spend Heat to raise Hive weapon output for this Sortie only.',
      'Heat not spent on Ward or Yield. III is a serious push.',
      'Lights dump when you Dock or lose the hull. Ash is untouched.',
    ],
  },
  {
    id: 'shielding',
    name: 'Ward',
    blurb: 'This Sortie’s shield field. Survive the wall long enough to kill it.',
    stat: 'Shield Field',
    levels: [
      { mult: 1.4, heat: 8 },
      { mult: 1.8, heat: 20 },
      { mult: 2.5, heat: 48 },
    ],
    detail: [
      'Spend Heat to thicken the Hive shield field for this Sortie only.',
      'Heat not spent on Weapons. Pair with Weapons when you mean to break a wall.',
      'Lights dump when you Dock or lose the hull. Ash is untouched.',
    ],
  },
  {
    id: 'recovery',
    name: 'Yield',
    blurb: 'This Sortie’s Salvage take. Farm Ash for a later push.',
    stat: 'Salvage Take',
    levels: [
      { mult: 1.4, heat: 8, ashMult: 1.2 },
      { mult: 1.8, heat: 20, ashMult: 1.45 },
      { mult: 2.5, heat: 48, ashMult: 1.8 },
    ],
    detail: [
      'Spend Heat to take more Salvage and Ash from wrecks this Sortie.',
      'Heat not spent on Weapons. Farm here, then convert for a later Weapons push.',
      'Lights dump when you Dock or lose the hull. Ash persists this Rebuild cycle.',
    ],
  },
]

export interface FurnaceUpgradeDef {
  id: FurnaceUpgradeId
  name: string
  blurb: string
  maxRank: number
  baseCost: number
  growth: number
}

export const FURNACE_UPGRADES: FurnaceUpgradeDef[] = [
  { id: 'hearth', name: 'Hearth', blurb: 'Idle Heat/sec and ash feed rate.', maxRank: 6, baseCost: 8, growth: 1.55 },
  { id: 'cistern', name: 'Cistern', blurb: 'Heat capacity.', maxRank: 6, baseCost: 10, growth: 1.5 },
  { id: 'flue', name: 'Flue', blurb: 'Channels spend less Heat.', maxRank: 5, baseCost: 14, growth: 1.6 },
  { id: 'bellows', name: 'Bellows', blurb: 'All channel bonuses hit harder.', maxRank: 4, baseCost: 16, growth: 1.65 },
  { id: 'taps', name: 'Extra Tap', blurb: '+1 channel you may light at once.', maxRank: 2, baseCost: 28, growth: 2.1 },
  { id: 'kindling', name: 'Kindling', blurb: 'More Heat from each Choir-ash.', maxRank: 4, baseCost: 12, growth: 1.55 },
  { id: 'ember', name: 'Ember Lock', blurb: 'Keep a fraction of Heat when you Rebuild.', maxRank: 3, baseCost: 22, growth: 1.7 },
]

export const FURNACE_PRESETS: Record<
  FurnacePresetId,
  { name: string; blurb: string; wanted: Partial<Record<FurnaceChannelId, number>> }
> = {
  push: { name: 'Push', blurb: 'Weapons + Ward.', wanted: { weapons: 1, shielding: 1 } },
  farm: { name: 'Farm', blurb: 'Weapons + Yield.', wanted: { weapons: 1, recovery: 1 } },
  industry: { name: 'Industry', blurb: 'Foundry + Worker Drone Fabrication.', wanted: { foundry: 1, network: 1 } },
  research: { name: 'Research', blurb: 'Research + Worker Drone Fabrication.', wanted: { research: 1, network: 1 } },
}

export const FURNACE_BASE_IDLE_GEN = 0
export const FURNACE_HEARTH_IDLE = 0
export const FURNACE_BASE_ASH_FEED = 0
export const FURNACE_HEARTH_FEED = 0
export const FURNACE_BASE_CAPACITY = 24
export const FURNACE_CISTERN_GROWTH = 1.38
export const FURNACE_FLUE_PER = 0.1
export const FURNACE_BELLOWS_PER = 0.1
export const FURNACE_KINDLE_PER = 0.18
export const FURNACE_EMBER_PER = 0.22

const BASE_CAPACITY = FURNACE_BASE_CAPACITY
const CISTERN_GROWTH = FURNACE_CISTERN_GROWTH
const FLUE_PER = FURNACE_FLUE_PER
const BELLOWS_PER = FURNACE_BELLOWS_PER
const KINDLE_PER = FURNACE_KINDLE_PER

function emptyLevels(): Record<FurnaceChannelId, number> {
  return { weapons: 0, shielding: 0, network: 0, foundry: 0, research: 0, recovery: 0 }
}

function emptyUpgrades(): Record<FurnaceUpgradeId, number> {
  return { hearth: 0, cistern: 0, flue: 0, bellows: 0, taps: 0, kindling: 0, ember: 0 }
}

export function createEmptyFurnaceState(): FurnaceState {
  return {
    v2: true,
    ranks: { attack: 0, defense: 0, lab: 0, workshop: 0, hold: 0 },
    wanted: emptyLevels(),
    active: emptyLevels(),
    priority: [...FURNACE_CHANNEL_IDS],
    upgrades: emptyUpgrades(),
    starveNote: '',
  }
}

export function getFurnaceChannel(id: string): FurnaceChannelDef | undefined {
  return FURNACE_CHANNELS.find((c) => c.id === id)
}

export function getFurnaceUpgrade(id: string): FurnaceUpgradeDef | undefined {
  return FURNACE_UPGRADES.find((u) => u.id === id)
}

export function furnaceUpgradeRank(state: GameState, id: FurnaceUpgradeId): number {
  return Math.max(0, Math.floor(state.furnace?.upgrades?.[id] ?? 0))
}

export function furnaceWantedLevel(state: GameState, id: FurnaceChannelId): number {
  return clampLevel(state.furnace?.wanted?.[id] ?? 0)
}

export function furnaceActiveLevel(state: GameState, id: FurnaceChannelId): number {
  return clampLevel(state.furnace?.active?.[id] ?? 0)
}

function clampLevel(n: number): number {
  return Math.max(0, Math.min(FURNACE_CHANNEL_MAX, Math.floor(n)))
}

export function furnacePriority(state: GameState): FurnaceChannelId[] {
  const fromProcess = processConfig(state).furnace.priority
  const raw = fromProcess?.length ? fromProcess : (state.furnace?.priority ?? [])
  const seen = new Set<FurnaceChannelId>()
  const out: FurnaceChannelId[] = []
  for (const id of raw) {
    if (!FURNACE_CHANNEL_IDS.includes(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of FURNACE_CHANNEL_IDS) {
    if (seen.has(id)) continue
    out.push(id)
  }
  return out
}

export function furnaceCapacity(state: GameState): number {
  const rank = furnaceUpgradeRank(state, 'cistern')
  return Math.round(BASE_CAPACITY * Math.pow(CISTERN_GROWTH, rank))
}

export function furnaceKindleMult(state: GameState): number {
  return 1 + KINDLE_PER * furnaceUpgradeRank(state, 'kindling')
}

export function furnaceAshHeatMult(state: GameState, extra = 1): number {
  return Math.max(0.1, extra) * furnaceKindleMult(state) * frameHeatMult(state) * choirTapAshToHeatMult(state)
}

export function furnaceIdleGenPerSec(_state: GameState): number {
  return 0
}

export function furnaceAshFeedPerSec(_state: GameState): number {
  return 0
}

export function furnaceFlueMult(state: GameState): number {
  return Math.max(0.45, 1 - FLUE_PER * furnaceUpgradeRank(state, 'flue'))
}

export function furnaceBellowsMult(state: GameState): number {
  return 1 + BELLOWS_PER * furnaceUpgradeRank(state, 'bellows')
}

export function furnaceChannelSlots(_state: GameState): number {
  return GDD_FURNACE_CHANNEL_IDS.length
}

export function furnaceChannelUnlocked(state: GameState, id: FurnaceChannelId): boolean {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return false
  return GDD_FURNACE_CHANNEL_IDS.includes(id)
}

export function furnaceRoman(level: number): string {
  if (level <= 0) return 'Off'
  if (level === 1) return 'I'
  if (level === 2) return 'II'
  return 'III'
}

export function furnacePushChannels(): FurnaceChannelDef[] {
  return FURNACE_CHANNELS.filter((ch) => GDD_FURNACE_CHANNEL_IDS.includes(ch.id))
}

export function furnaceConversionLine(): string {
  return `${ASH_PER_HEAT} Ash → 1 Heat`
}

export function furnaceLitLine(state: GameState): string {
  const bits = furnacePushChannels()
    .map((ch) => {
      const lv = furnaceActiveLevel(state, ch.id)
      return lv > 0 ? `${ch.name} ${furnaceRoman(lv)}` : null
    })
    .filter((line): line is string => Boolean(line))
  return bits.join(' · ') || 'Channels dark'
}

export function furnaceActiveEffectLine(state: GameState): string {
  const bits = furnacePushChannels()
    .map((ch) => {
      const lv = furnaceActiveLevel(state, ch.id)
      const def = furnaceLevelDef(ch.id, lv)
      return def ? `${ch.stat} ×${def.mult.toFixed(2)}` : null
    })
    .filter((line): line is string => Boolean(line))
  return bits.join(' · ') || 'No push'
}

export function furnaceSpendableHeat(state: GameState): number {
  return Math.max(0, (state.resources.heat ?? 0) - processFurnaceHooks(state).reserveHeat)
}

export type FurnaceCombatFx = {
  weapons: boolean
  ward: boolean
  yield: boolean
}

/** Combat VFX flags so Sortie can show the push without opening Furnace. */
export function furnaceCombatFx(state: GameState): FurnaceCombatFx {
  return {
    weapons: furnaceActiveLevel(state, 'weapons') > 0,
    ward: furnaceActiveLevel(state, 'shielding') > 0,
    yield: furnaceActiveLevel(state, 'recovery') > 0,
  }
}

export function furnaceChannelEffectLine(def: FurnaceChannelDef): string {
  const ranks = def.levels.map((lv) => `×${lv.mult.toFixed(2)}`).join(' / ')
  const ash = def.levels.some((lv) => lv.ashMult)
    ? ` · Ash ${def.levels.map((lv) => `×${(lv.ashMult ?? 1).toFixed(2)}`).join(' / ')}`
    : ''
  return `${def.stat} ${ranks}${ash}`
}

export function furnaceLevelDef(id: FurnaceChannelId, level: number): FurnaceChannelLevelDef | null {
  if (level <= 0) return null
  return getFurnaceChannel(id)?.levels[level - 1] ?? null
}

export function furnaceChannelHeatCost(
  state: GameState,
  id: FurnaceChannelId,
  level = furnaceActiveLevel(state, id),
): number {
  const def = furnaceLevelDef(id, level)
  if (!def) return 0
  return def.heat
}

export function furnaceLightCost(id: FurnaceChannelId, level: number): number {
  const def = furnaceLevelDef(id, clampLevel(level))
  return def?.heat ?? 0
}

export function furnaceConsumptionFor(
  _state: GameState,
  _levels: Partial<Record<FurnaceChannelId, number>>,
): number {
  return 0
}

export function furnaceConsumptionPerSec(state: GameState): number {
  return furnaceConsumptionFor(state, state.furnace?.active ?? emptyLevels())
}

export function furnaceAshToHeatRate(state: GameState, ashHeatMult = 1): number {
  return furnaceAshFeedPerSec(state) * furnaceKindleMult(state) * Math.max(0.1, ashHeatMult)
}

export function furnaceGenerationPerSec(state: GameState, ashHeatMult = 1): number {
  const idle = furnaceIdleGenPerSec(state)
  const ash = state.resources.choirAsh ?? 0
  if (ash <= 0) return idle
  if ((state.resources.heat ?? 0) >= furnaceCapacity(state) - 1e-6) return idle
  return idle + furnaceAshToHeatRate(state, ashHeatMult)
}

export function furnaceAshBurnPerSec(state: GameState, ashHeatMult = 1): number {
  if ((state.resources.choirAsh ?? 0) <= 0) return 0
  if ((state.resources.heat ?? 0) >= furnaceCapacity(state) - 1e-6) return 0
  const heatFromAsh = furnaceAshToHeatRate(state, ashHeatMult)
  const heatPerAsh = furnaceAshHeatMult(state, ashHeatMult) / ASH_PER_HEAT
  return heatFromAsh / Math.max(1e-6, heatPerAsh)
}

export function furnaceNetPerSec(state: GameState, ashHeatMult = 1): number {
  return furnaceGenerationPerSec(state, ashHeatMult) - furnaceConsumptionPerSec(state)
}

export function furnaceActiveCount(state: GameState, levels?: Partial<Record<FurnaceChannelId, number>>): number {
  const src = levels ?? state.furnace?.active ?? emptyLevels()
  return FURNACE_CHANNEL_IDS.reduce((n, id) => n + ((src[id] ?? 0) > 0 ? 1 : 0), 0)
}

function channelBonusMult(state: GameState, id: FurnaceChannelId): number {
  if (protocolMutes(state, 'furnace')) return 1
  const level = furnaceActiveLevel(state, id)
  const def = furnaceLevelDef(id, level)
  if (!def) return 1
  return (
    def.mult *
    (1 + protocolModifiers(state).furnaceEfficiencyAdd) *
    protocolBonusMult(state, 'furnace') *
    frameFurnaceOutputMult(state)
  )
}

export function furnaceDamageMult(state: GameState): number {
  return channelBonusMult(state, 'weapons') * directiveHeatMult(state)
}

export function furnaceShieldMult(state: GameState): number {
  return channelBonusMult(state, 'shielding')
}

export function furnaceNetworkMult(state: GameState): number {
  return channelBonusMult(state, 'network')
}

export function furnaceFoundrySpeedMult(state: GameState): number {
  return channelBonusMult(state, 'foundry')
}

export function furnaceResearchXpMult(state: GameState): number {
  return channelBonusMult(state, 'research')
}

export function furnaceSalvageMult(state: GameState): number {
  return channelBonusMult(state, 'recovery')
}

export function furnaceAshChannelMult(state: GameState): number {
  if (protocolMutes(state, 'furnace')) return 1
  const def = furnaceLevelDef('recovery', furnaceActiveLevel(state, 'recovery'))
  return def?.ashMult ?? 1
}

export function furnaceAshFromKill(state: GameState, isBoss: boolean): number {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return 0
  const sector = Math.max(1, state.combat.waveReached || state.combat.wave || 1)
  const base = (0.5 + 0.1 * sector) * (isBoss ? 4 : 1)
  return (
    base *
    reliquaryAshMult(state) *
    echoAshMult(state) *
    furnaceAshChannelMult(state) *
    frameAshMult(state) *
    ashYieldMult(state)
  )
}

export function grantFurnaceKillLoot(state: GameState, isBoss: boolean): number {
  const ash = furnaceAshFromKill(state, isBoss)
  if (ash <= 0) return 0
  state.resources.choirAsh = (state.resources.choirAsh ?? 0) + ash
  return ash
}

export function convertAshToHeat(state: GameState, _heatMult = 1): GameState {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return state
  const ash = state.resources.choirAsh ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)
  if (batches <= 0) return state
  const used = batches * ASH_PER_HEAT
  const next = structuredClone(state)
  next.resources.choirAsh = ash - used
  next.resources.heat = (next.resources.heat ?? 0) + batches
  return next
}

export function furnaceUpgradeCost(state: GameState, id: FurnaceUpgradeId): number {
  const def = getFurnaceUpgrade(id)
  if (!def) return 0
  const rank = furnaceUpgradeRank(state, id)
  return Math.ceil(def.baseCost * Math.pow(def.growth, Math.max(0, rank)))
}

export function canBuyFurnaceUpgrade(
  _state: GameState,
  _id: FurnaceUpgradeId,
): { ok: boolean; reason?: string } {
  return { ok: false, reason: 'Heat is spent on this Sortie' }
}

export function buyFurnaceUpgrade(state: GameState, id: FurnaceUpgradeId): GameState {
  if (!canBuyFurnaceUpgrade(state, id).ok) return state
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  const cost = furnaceUpgradeCost(next, id)
  next.resources.heat = Math.max(0, (next.resources.heat ?? 0) - cost)
  next.furnace.upgrades[id] = furnaceUpgradeRank(next, id) + 1
  return next
}

export function furnaceChannelPreview(
  state: GameState,
  id: FurnaceChannelId,
  level: number,
  _ashHeatMult = 1,
): { ok: boolean; reason?: string; net: number; lastsSec: number | null; slots: number } {
  const lv = clampLevel(level)
  const current = furnaceActiveLevel(state, id)
  const extra = Math.max(0, furnaceLightCost(id, lv) - furnaceLightCost(id, current))
  const spend = Math.max(0, Math.floor(extra * protocolModifiers(state).furnaceDrainMult + 1e-9))
  const heat = state.resources.heat ?? 0
  const slots = furnaceActiveCount(state, { ...(state.furnace?.active ?? emptyLevels()), [id]: lv })
  if (lv > 0 && !furnaceChannelUnlocked(state, id)) {
    return { ok: false, reason: 'Locked', net: 0, lastsSec: null, slots }
  }
  if (spend > heat + 1e-9) {
    return { ok: false, reason: `Need ${spend} Heat`, net: 0, lastsSec: null, slots }
  }
  return { ok: true, net: 0, lastsSec: null, slots }
}

export function canSetFurnaceChannel(
  state: GameState,
  id: FurnaceChannelId,
  level: number,
): { ok: boolean; reason?: string } {
  const preview = furnaceChannelPreview(state, id, level)
  if (!preview.ok) return { ok: false, reason: preview.reason }
  return { ok: true }
}

export function setFurnaceChannel(state: GameState, id: FurnaceChannelId, level: number): GameState {
  const lv = clampLevel(level)
  const check = canSetFurnaceChannel(state, id, lv)
  if (!check.ok && lv > 0) return state
  const current = furnaceActiveLevel(state, id)
  const extra = Math.max(0, furnaceLightCost(id, lv) - furnaceLightCost(id, current))
  const spend = Math.max(0, Math.floor(extra * protocolModifiers(state).furnaceDrainMult + 1e-9))
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  next.resources.heat = Math.max(0, (next.resources.heat ?? 0) - spend)
  next.furnace.wanted[id] = lv
  next.furnace.active[id] = lv
  next.furnace.starveNote = ''
  if (lv > 0) noteSystemAction(next, 'furnace')
  return next
}

export function setFurnacePriority(state: GameState, priority: FurnaceChannelId[]): GameState {
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  const ordered = sanitizePriority(priority)
  next.furnace.priority = ordered
  if (!next.process) return next
  next.process.config = mergeProcessConfig({
    ...next.process.config,
    furnace: { ...(next.process.config?.furnace ?? {}), priority: ordered },
  })
  return next
}

function sanitizePriority(priority: FurnaceChannelId[]): FurnaceChannelId[] {
  const seen = new Set<FurnaceChannelId>()
  const out: FurnaceChannelId[] = []
  for (const id of priority) {
    if (!FURNACE_CHANNEL_IDS.includes(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of FURNACE_CHANNEL_IDS) {
    if (!seen.has(id)) out.push(id)
  }
  return out
}

export function applyFurnacePreset(state: GameState, preset: FurnacePresetId): GameState {
  const def = FURNACE_PRESETS[preset]
  if (!def) return state
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  next.furnace.wanted = emptyLevels()
  next.furnace.active = emptyLevels()
  const slots = furnaceChannelSlots(next)
  let used = 0
  for (const id of Object.keys(def.wanted) as FurnaceChannelId[]) {
    const lv = clampLevel(def.wanted[id] ?? 0)
    if (lv <= 0) continue
    if (!furnaceChannelUnlocked(next, id)) continue
    if (used >= slots) break
    next.furnace.wanted[id] = lv
    next.furnace.active[id] = lv
    used += 1
  }
  if (next.process?.config) next.process.config.furnace.preset = preset
  return next
}

export function furnaceRestartHeat(_state: GameState, _currentHeat: number): number {
  return 0
}

/** Heat and channel lights last only for the current Sortie. */
export function endFurnaceSortie(state: GameState): void {
  state.resources.heat = 0
  if (!state.furnace) return
  state.furnace.active = emptyLevels()
  state.furnace.wanted = emptyLevels()
  state.furnace.starveNote = ''
}

export function tickFurnace(_state: GameState, _dtSeconds: number, _ashHeatMult = 1): void {
  /* GDD: Heat is a Sortie spend, not a live tank. Industry does not burn Ash at Dock. */
}

/** Process lights the configured preset while Heat stays above the reserve. */
export function runFurnaceManager(state: GameState, _ashHeatMult = 1): GameState {
  const hooks = processFurnaceHooks(state)
  if (!hooks.managerUnlocked && !hooks.autoChannel) return state
  const presetId = hooks.preset as FurnacePresetId | null
  if (!hooks.presetsUnlocked || !presetId) return state
  const def = FURNACE_PRESETS[presetId]
  if (!def) return state
  let next = state
  for (const id of Object.keys(def.wanted) as FurnaceChannelId[]) {
    const lv = clampLevel(def.wanted[id] ?? 0)
    if (lv <= 0) continue
    if (!furnaceChannelUnlocked(next, id)) continue
    if (furnaceActiveLevel(next, id) >= lv) continue
    const extra = Math.max(0, furnaceLightCost(id, lv) - furnaceLightCost(id, furnaceActiveLevel(next, id)))
    if (furnaceSpendableHeat(next) + 1e-9 < extra) continue
    const lit = setFurnaceChannel(next, id, lv)
    if (lit !== next) next = lit
  }
  return next
}

export function hydrateFurnaceState(raw: FurnaceState | undefined): FurnaceState {
  const empty = createEmptyFurnaceState()
  if (!raw || typeof raw !== 'object') return empty
  const ranks = { ...empty.ranks }
  for (const id of Object.keys(ranks) as FurnaceTrackId[]) {
    ranks[id] = Math.max(0, Math.floor(Number(raw.ranks?.[id] ?? 0) || 0))
  }
  const wanted = emptyLevels()
  const active = emptyLevels()
  const upgrades = emptyUpgrades()
  if (raw.wanted && typeof raw.wanted === 'object') {
    for (const id of FURNACE_CHANNEL_IDS) {
      wanted[id] = clampLevel(Number(raw.wanted[id] ?? 0) || 0)
    }
  }
  if (raw.active && typeof raw.active === 'object') {
    for (const id of FURNACE_CHANNEL_IDS) {
      active[id] = clampLevel(Number(raw.active[id] ?? 0) || 0)
    }
  }
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const id of FURNACE_UPGRADE_IDS) {
      upgrades[id] = Math.max(0, Math.floor(Number(raw.upgrades[id] ?? 0) || 0))
    }
  }
  return {
    v2: raw.v2 === true,
    ranks,
    wanted,
    active,
    priority: sanitizePriority(Array.isArray(raw.priority) ? raw.priority : empty.priority),
    upgrades,
    starveNote: typeof raw.starveNote === 'string' ? raw.starveNote : '',
  }
}

export function finalizeFurnaceMigration(state: GameState): void {
  if (!state.furnace) state.furnace = createEmptyFurnaceState()
  const furnace = hydrateFurnaceState(state.furnace)
  if (furnace.v2) {
    state.furnace = furnace
    return
  }
  const totalRanks = Object.values(furnace.ranks).reduce((a, b) => a + b, 0)
  furnace.upgrades.hearth = Math.min(6, Math.floor(totalRanks / 4))
  furnace.upgrades.cistern = Math.min(6, Math.floor(totalRanks / 5))
  furnace.upgrades.bellows = Math.min(4, Math.floor(totalRanks / 8))
  furnace.upgrades.kindling = Math.min(4, Math.floor(totalRanks / 10))
  furnace.ranks = { attack: 0, defense: 0, lab: 0, workshop: 0, hold: 0 }
  furnace.v2 = true
  state.furnace = furnace
}

/** Legacy inspect/simulation helpers — old Attack track is now Weapons. */
export function furnaceRank(state: GameState, id: FurnaceTrackId): number {
  return furnaceActiveLevel(state, LEGACY_TRACK_TO_CHANNEL[id])
}

export function furnaceRankCost(rank: number): number {
  return Math.ceil(8 * Math.pow(1.55, Math.max(0, rank)))
}

export function getFurnaceTrack(id: string) {
  const channel = LEGACY_TRACK_TO_CHANNEL[id as FurnaceTrackId]
  return channel ? getFurnaceChannel(channel) : undefined
}

export const FURNACE_TRACKS = FURNACE_CHANNELS.map((c) => ({
  id: (Object.entries(LEGACY_TRACK_TO_CHANNEL).find(([, ch]) => ch === c.id)?.[0] ?? c.id) as FurnaceTrackId,
  name: c.name,
  blurb: c.blurb,
  detail: c.detail,
}))

export function canBuyFurnaceRank(state: GameState, _id: FurnaceTrackId): { ok: boolean; reason?: string } {
  return canBuyFurnaceUpgrade(state, 'hearth')
}

export function buyFurnaceRank(state: GameState, _id: FurnaceTrackId): GameState {
  return buyFurnaceUpgrade(state, 'hearth')
}
