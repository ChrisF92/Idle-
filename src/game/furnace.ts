/** Furnace 2.0 — Choir-ash feeds a live Heat tank that powers active channels. */

import type {
  FurnaceChannelId,
  FurnacePresetId,
  FurnaceState,
  FurnaceTrackId,
  FurnaceUpgradeId,
  GameState,
} from './types'
import { careerBestWave, isSystemUnlocked } from './progression'
import { reliquaryAshMult } from './reliquary'
import { hiveResearchFurnaceSlots } from './hiveResearch'
import { protocolBonusMult, protocolModifiers, protocolMutes } from './protocols'
import { echoAshMult } from './echo'
import { mergeProcessConfig, processConfig, processFurnaceHooks } from './process'
import { noteSystemAction } from './playtest'
import { noteFrontierIntervention } from './frontier'
import { ACT1_CADENCE } from './cadence'
import { directiveHeatDrainMult, directiveHeatMult } from './directives'

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

export const FURNACE_CHANNELS: FurnaceChannelDef[] = [
  {
    id: 'weapons',
    name: 'Weapons',
    blurb: 'Sortie damage',
    stat: 'Damage',
    levels: [
      { mult: 1.18, heat: 0.05 },
      { mult: 1.34, heat: 0.16 },
      { mult: 1.52, heat: 0.48 },
    ],
    detail: [
      'Weapons burns Heat to raise Core damage for this lighting.',
      'Level II and III cost far more Heat. You cannot leave this on at III forever early on.',
    ],
  },
  {
    id: 'shielding',
    name: 'Shielding',
    blurb: 'Max shield',
    stat: 'Shield',
    levels: [
      { mult: 1.16, heat: 0.045 },
      { mult: 1.3, heat: 0.14 },
      { mult: 1.46, heat: 0.42 },
    ],
    detail: [
      'Shielding raises the flagship’s shield ceiling while the channel is lit.',
      'Pair it with Weapons for a push. It still spends Heat every second.',
    ],
  },
  {
    id: 'network',
    name: 'Network',
    blurb: 'Network fill speed',
    stat: 'Network fill',
    levels: [
      { mult: 1.16, heat: 0.05 },
      { mult: 1.32, heat: 0.16 },
      { mult: 1.52, heat: 0.48 },
    ],
    detail: [
      'Network speeds every drone bar while the channel is lit.',
      'Industry and Research presets lean on this. It does not pick a hidden best mix.',
    ],
  },
  {
    id: 'foundry',
    name: 'Foundry',
    blurb: 'Smelt speed',
    stat: 'Foundry speed',
    levels: [
      { mult: 1.16, heat: 0.05 },
      { mult: 1.32, heat: 0.16 },
      { mult: 1.55, heat: 0.5 },
    ],
    detail: [
      'Foundry speeds every smelter while the channel is lit.',
      'Recipe levels still persist on their own. This is extra fire under the kiln.',
    ],
  },
  {
    id: 'research',
    name: 'Research',
    blurb: 'Research XP from kills',
    stat: 'Research XP',
    levels: [
      { mult: 1.2, heat: 0.055 },
      { mult: 1.42, heat: 0.18 },
      { mult: 1.7, heat: 0.55 },
    ],
    detail: [
      'Research writes kill notes faster while the channel is lit. Focus still matters.',
      'Opens with Research at sector 7. Hungrier than Weapons at the same level.',
    ],
  },
  {
    id: 'recovery',
    name: 'Recovery',
    blurb: 'Salvage and Choir-ash',
    stat: 'Salvage / Ash',
    levels: [
      { mult: 1.12, heat: 0.04, ashMult: 1.1 },
      { mult: 1.24, heat: 0.12, ashMult: 1.22 },
      { mult: 1.4, heat: 0.36, ashMult: 1.35 },
    ],
    detail: [
      'Recovery marks wrecks for more Salvage and more Choir-ash while lit.',
      'Cheaper than Weapons. Farm presets run this beside a modest Weapons level.',
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
  push: { name: 'Push', blurb: 'Weapons + Shielding.', wanted: { weapons: 1, shielding: 1 } },
  farm: { name: 'Farm', blurb: 'Weapons + Recovery.', wanted: { weapons: 1, recovery: 1 } },
  industry: { name: 'Industry', blurb: 'Foundry + Network.', wanted: { foundry: 1, network: 1 } },
  research: { name: 'Research', blurb: 'Research + Network.', wanted: { research: 1, network: 1 } },
}

export const FURNACE_BASE_IDLE_GEN = 0.02
export const FURNACE_HEARTH_IDLE = 0.035
export const FURNACE_BASE_ASH_FEED = 0.055
export const FURNACE_HEARTH_FEED = 0.03
export const FURNACE_BASE_CAPACITY = 24
export const FURNACE_CISTERN_GROWTH = 1.38
export const FURNACE_FLUE_PER = 0.1
export const FURNACE_BELLOWS_PER = 0.1
export const FURNACE_KINDLE_PER = 0.18
export const FURNACE_EMBER_PER = 0.22

const BASE_IDLE_GEN = FURNACE_BASE_IDLE_GEN
const HEARTH_IDLE = FURNACE_HEARTH_IDLE
const BASE_ASH_FEED = FURNACE_BASE_ASH_FEED
const HEARTH_FEED = FURNACE_HEARTH_FEED
const BASE_CAPACITY = FURNACE_BASE_CAPACITY
const CISTERN_GROWTH = FURNACE_CISTERN_GROWTH
const FLUE_PER = FURNACE_FLUE_PER
const BELLOWS_PER = FURNACE_BELLOWS_PER
const KINDLE_PER = FURNACE_KINDLE_PER
const EMBER_PER = FURNACE_EMBER_PER

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
  return Math.max(0.1, extra) * furnaceKindleMult(state) * processFurnaceHooks(state).outputMult
}

export function furnaceIdleGenPerSec(state: GameState): number {
  return (BASE_IDLE_GEN + HEARTH_IDLE * furnaceUpgradeRank(state, 'hearth')) * processFurnaceHooks(state).outputMult
}

export function furnaceAshFeedPerSec(state: GameState): number {
  return (BASE_ASH_FEED + HEARTH_FEED * furnaceUpgradeRank(state, 'hearth')) * processFurnaceHooks(state).outputMult
}

export function furnaceFlueMult(state: GameState): number {
  return Math.max(0.45, 1 - FLUE_PER * furnaceUpgradeRank(state, 'flue'))
}

export function furnaceBellowsMult(state: GameState): number {
  return 1 + BELLOWS_PER * furnaceUpgradeRank(state, 'bellows')
}

export function furnaceChannelSlots(state: GameState): number {
  let slots = 1 + furnaceUpgradeRank(state, 'taps')
  if ((state.prestige?.prestigeCount ?? 0) >= 1) slots += 1
  if ((state.process?.earned ?? 0) >= 150) slots += 1
  slots += hiveResearchFurnaceSlots(state)
  return Math.min(FURNACE_SLOT_CAP, slots)
}

export function furnaceChannelUnlocked(state: GameState, id: FurnaceChannelId): boolean {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return false
  if (id === 'research') return isSystemUnlocked(state, 'research')
  if (id === 'foundry') return isSystemUnlocked(state, 'foundry')
  return true
}

export function furnaceLevelDef(id: FurnaceChannelId, level: number): FurnaceChannelLevelDef | null {
  if (level <= 0) return null
  return getFurnaceChannel(id)?.levels[level - 1] ?? null
}

export function furnaceChannelHeatCost(state: GameState, id: FurnaceChannelId, level = furnaceActiveLevel(state, id)): number {
  const def = furnaceLevelDef(id, level)
  if (!def) return 0
  return def.heat * furnaceFlueMult(state) * protocolModifiers(state).furnaceDrainMult * directiveHeatDrainMult(state)
}

export function furnaceConsumptionFor(
  state: GameState,
  levels: Partial<Record<FurnaceChannelId, number>>,
): number {
  let sum = 0
  for (const id of FURNACE_CHANNEL_IDS) {
    sum += furnaceChannelHeatCost(state, id, clampLevel(levels[id] ?? 0))
  }
  return sum
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
  const extra = def.mult - 1
  return (1 + extra * furnaceBellowsMult(state) * (1 + protocolModifiers(state).furnaceEfficiencyAdd)) * protocolBonusMult(state, 'furnace')
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
  if (!def?.ashMult) return 1
  const extra = def.ashMult - 1
  return 1 + extra * furnaceBellowsMult(state)
}

export function furnaceAshFromKill(state: GameState, isBoss: boolean): number {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return 0
  const sector = Math.max(1, state.combat.sector)
  const base = (0.5 + 0.1 * sector) * (isBoss ? 4 : 1)
  return base * reliquaryAshMult(state) * echoAshMult(state) * furnaceAshChannelMult(state)
}

export function grantFurnaceKillLoot(state: GameState, isBoss: boolean): number {
  const ash = furnaceAshFromKill(state, isBoss)
  if (ash <= 0) return 0
  state.resources.choirAsh = (state.resources.choirAsh ?? 0) + ash
  return ash
}

export function convertAshToHeat(state: GameState, heatMult = 1): GameState {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return state
  const ash = state.resources.choirAsh ?? 0
  const cap = furnaceCapacity(state)
  const room = Math.max(0, cap - (state.resources.heat ?? 0))
  if (room <= 1e-6) return state
  const heatPerAsh = furnaceAshHeatMult(state, heatMult) / ASH_PER_HEAT
  const maxAsh = room / Math.max(1e-6, heatPerAsh)
  const used = Math.min(ash, maxAsh)
  if (used <= 1e-6) return state
  const next = structuredClone(state)
  next.resources.choirAsh = ash - used
  next.resources.heat = Math.min(cap, (next.resources.heat ?? 0) + used * heatPerAsh)
  return next
}

export function furnaceUpgradeCost(state: GameState, id: FurnaceUpgradeId): number {
  const def = getFurnaceUpgrade(id)
  if (!def) return 0
  const rank = furnaceUpgradeRank(state, id)
  return Math.ceil(def.baseCost * Math.pow(def.growth, Math.max(0, rank)))
}

export function canBuyFurnaceUpgrade(
  state: GameState,
  id: FurnaceUpgradeId,
): { ok: boolean; reason?: string } {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) {
    return { ok: false, reason: `Reach Wave ${FURNACE_UNLOCK_SECTOR}` }
  }
  const def = getFurnaceUpgrade(id)
  if (!def) return { ok: false, reason: 'Unknown upgrade' }
  const rank = furnaceUpgradeRank(state, id)
  if (rank >= def.maxRank) return { ok: false, reason: 'Maxed' }
  const cost = furnaceUpgradeCost(state, id)
  if ((state.resources.heat ?? 0) < cost) return { ok: false, reason: `Need ${cost} Heat` }
  return { ok: true }
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
  ashHeatMult = 1,
): { ok: boolean; reason?: string; net: number; lastsSec: number | null; slots: number } {
  const nextLevels = { ...(state.furnace?.active ?? emptyLevels()), [id]: clampLevel(level) }
  const slots = furnaceActiveCount(state, nextLevels)
  const capSlots = furnaceChannelSlots(state)
  const consume = furnaceConsumptionFor(state, nextLevels)
  const gen = furnaceGenerationPerSec(state, ashHeatMult)
  const net = gen - consume
  const heat = state.resources.heat ?? 0
  const lastsSec = net >= -1e-9 ? null : heat / Math.max(1e-6, -net)
  if (level > 0 && !furnaceChannelUnlocked(state, id)) {
    return { ok: false, reason: id === 'research' ? 'Research closed' : 'Locked', net, lastsSec, slots }
  }
  if (slots > capSlots) {
    return { ok: false, reason: `Only ${capSlots} channel${capSlots === 1 ? '' : 's'} at once`, net, lastsSec, slots }
  }
  return { ok: true, net, lastsSec, slots }
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
  const next = structuredClone(state)
  if (!next.furnace) next.furnace = createEmptyFurnaceState()
  next.furnace.wanted[id] = lv
  next.furnace.active[id] = lv
  next.furnace.starveNote = ''
  if (lv > 0) noteSystemAction(next, 'furnace')
  noteFrontierIntervention(next, 'furnace', { n: id, v: lv })
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

export function furnaceRestartHeat(state: GameState, currentHeat: number): number {
  const keep = EMBER_PER * furnaceUpgradeRank(state, 'ember')
  if (keep <= 0) return 0
  return Math.min(furnaceCapacity(state), Math.max(0, currentHeat) * keep)
}

function starveLowest(state: GameState): boolean {
  const order = [...furnacePriority(state)].reverse()
  for (const id of order) {
    const lv = furnaceActiveLevel(state, id)
    if (lv <= 0) continue
    state.furnace.active[id] = lv - 1
    const name = getFurnaceChannel(id)?.name ?? id
    const next = furnaceActiveLevel(state, id)
    state.furnace.starveNote =
      next <= 0 ? `${name} went dark — Heat could not hold it.` : `${name} dropped to ${roman(next)} — Heat was short.`
    return true
  }
  return false
}

function restoreWanted(state: GameState, reserve: number): boolean {
  const heat = state.resources.heat ?? 0
  if (heat <= reserve + furnaceCapacity(state) * 0.12) return false
  const order = furnacePriority(state)
  for (const id of order) {
    const want = furnaceWantedLevel(state, id)
    const have = furnaceActiveLevel(state, id)
    if (want <= have) continue
    const trial = { ...(state.furnace.active ?? emptyLevels()), [id]: have + 1 }
    if (furnaceActiveCount(state, trial) > furnaceChannelSlots(state)) continue
    const consume = furnaceConsumptionFor(state, trial)
    const gen = furnaceGenerationPerSec(state)
    if (gen - consume < -1e-6 && heat < reserve + 4) continue
    state.furnace.active[id] = have + 1
    if (state.furnace.starveNote) state.furnace.starveNote = ''
    return true
  }
  return false
}

function roman(n: number): string {
  return n === 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n)
}

export function tickFurnace(state: GameState, dtSeconds: number, ashHeatMult = 1): void {
  if (careerBestWave(state) < FURNACE_UNLOCK_SECTOR) return
  if (!state.furnace) state.furnace = createEmptyFurnaceState()
  if (dtSeconds <= 0) return

  const cap = furnaceCapacity(state)
  const reserve = processFurnaceHooks(state).reserveHeat
  let heat = state.resources.heat ?? 0
  let ash = state.resources.choirAsh ?? 0

  const idle = furnaceIdleGenPerSec(state)
  const heatPerAsh = furnaceAshHeatMult(state, ashHeatMult) / ASH_PER_HEAT

  let left = dtSeconds
  let guard = 0
  while (left > 1e-9 && guard++ < 64) {
    const consume = furnaceConsumptionPerSec(state)
    const room = Math.max(0, cap - heat)
    const canFeed = ash > 1e-9 && room > 1e-6
    const ashHeatRate = canFeed ? furnaceAshToHeatRate(state, ashHeatMult) : 0
    const net = idle + ashHeatRate - consume

    if (heat <= reserve + 1e-6 && net < -1e-6) {
      if (!starveLowest(state)) break
      continue
    }
    if (heat > reserve + cap * 0.12) {
      if (restoreWanted(state, reserve)) continue
    }

    let dt = left
    if (net > 1e-9 && room > 1e-9) dt = Math.min(dt, room / net)
    else if (net < -1e-9 && heat > reserve + 1e-9) dt = Math.min(dt, (heat - reserve) / -net)
    if (ashHeatRate > 1e-9) {
      const burn = ashHeatRate / Math.max(1e-6, heatPerAsh)
      dt = Math.min(dt, ash / Math.max(1e-9, burn))
    }
    dt = Math.max(0, Math.min(left, dt))
    if (dt <= 1e-9) break

    const startHeat = heat
    heat += idle * dt
    if (ashHeatRate > 0) {
      const heatGain = Math.min(Math.max(0, cap - startHeat), ashHeatRate * dt)
      const ashNeed = heatGain / Math.max(1e-6, heatPerAsh)
      const spend = Math.min(ash, ashNeed)
      ash -= spend
      heat += spend * heatPerAsh
    }
    heat -= consume * dt
    if (heat > cap) heat = cap
    if (heat < 0) heat = 0
    left -= dt
  }

  state.resources.heat = Math.min(cap, Math.max(0, heat))
  state.resources.choirAsh = Math.max(0, ash)
}

export function runFurnaceManager(state: GameState, ashHeatMult = 1): GameState {
  const hooks = processFurnaceHooks(state)
  if (!hooks.managerUnlocked) return state
  let next = state
  if (hooks.autoFeed) {
    const fed = convertAshToHeat(next, ashHeatMult)
    if (fed !== next) next = fed
  }
  if (!hooks.autoChannel) return next

  const cloned = structuredClone(next)
  if (!cloned.furnace) cloned.furnace = createEmptyFurnaceState()
  const slots = furnaceChannelSlots(cloned)
  const reserve = hooks.reserveHeat
  const gen = furnaceGenerationPerSec(cloned, ashHeatMult)
  const budget = Math.max(0, gen - 0.002)
  const order = furnacePriority(cloned)
  const active = emptyLevels()
  let usedSlots = 0
  let usedHeat = 0

  for (const id of order) {
    if (usedSlots >= slots) break
    if (!furnaceChannelUnlocked(cloned, id)) continue
    const target = furnaceWantedLevel(cloned, id)
    if (target <= 0) continue
    let pick = 0
    for (let lv = Math.min(FURNACE_CHANNEL_MAX, target); lv >= 1; lv--) {
      const cost = furnaceChannelHeatCost(cloned, id, lv)
      if (usedHeat + cost <= budget || (cloned.resources.heat ?? 0) > reserve + cost * 8) {
        pick = lv
        usedHeat += cost
        break
      }
    }
    if (pick <= 0) continue
    active[id] = pick
    usedSlots += 1
  }

  cloned.furnace.active = active
  cloned.furnace.starveNote = ''
  return cloned
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
