/** Scrap-funded physical Core Levels and usage-driven shared Core Mastery. */

import type { GameState, RelicSocketClass, RunUpgradeCategory } from './types'
import {
  MAX_MODULE_LEVEL,
  getModule,
  masteryBonus,
  moduleLeveledBonus,
  moduleMasteryRank,
  moduleUpgradeCost,
  moduleWeaponDamage,
} from './catalog'
import { isChallengeSortie } from './frontier'
import { protocolCoreScalingAdd } from './protocols'
import { recordPlaytest, noteSystemAction } from './playtest'
import { resolvedResearchIds, sumResearchNumber } from './hiveResearchTree'
import { milestoneModsFor } from './milestones'
import {
  addCoreInstance,
  coreInstanceAtSlot,
  resolveCoreInstance,
} from './coreInstances'
import { workshopCost } from './workshop'

export const CORE_RUN_LEVEL_CAP = MAX_MODULE_LEVEL
/** Scrap-funded starting levels leave room for temporary Salvage growth. */
export const CORE_START_LEVEL_CAP = 80
export const CORE_MASTERY_CAP = 100

/** Migration: leftover Scrap Dock ranks convert to at most this much Mastery. */
export const LEGACY_RANK_MASTERY_CAP = 18

export interface CoreSlot {
  slot: number
  moduleId: string
  coreInstanceId: string
}

export interface CorePrimaryOutput {
  label: string
  current: number
  next: number
}

export interface CoreMasteryGrant {
  moduleId: string
  xp: number
  from: number
  to: number
  xpIntoLevel: number
  xpToNext: number
  milestones: number[]
}

export interface CoreSortieRecord {
  moduleId: string
  slot: number
  runLevel: number
  masteryStart: number
  masteryEnd: number
  masteryXp: number
  salvageSpent: number
  contribution: number
  bossClears: number
  newBestBonus: boolean
  milestones: number[]
}

export function equippedCoreSlots(state: Pick<GameState, 'shipyard'>): CoreSlot[] {
  return (state.shipyard.modules ?? []).map((moduleId, slot) => ({
    slot,
    moduleId,
    coreInstanceId: coreInstanceAtSlot(state, slot)?.id ?? `${moduleId}:${slot + 1}`,
  }))
}

export function moduleCopyCount(state: Pick<GameState, 'shipyard'>, moduleId: string): number {
  const instances = state.shipyard.coreInstances?.filter(
    (instance) => instance.moduleId === moduleId,
  ).length ?? 0
  const copies = Math.max(0, Math.floor(state.shipyard.moduleCopies?.[moduleId] ?? 0))
  return Math.max(instances, copies, state.shipyard.unlockedModules.includes(moduleId) ? 1 : 0)
}

export function grantModuleCopy(state: GameState, moduleId: string): void {
  addCoreInstance(state.shipyard, moduleId)
}

export function coreRunLevel(state: Pick<GameState, 'combat'>, slot: number): number {
  return Math.max(0, Math.floor(state.combat.coreRunLevels?.[String(slot)] ?? 0))
}

export function coreStartingLevel(
  state: Pick<GameState, 'shipyard' | 'workshop'> & { hiveResearch?: GameState['hiveResearch'] },
  coreInstanceId: string,
): number {
  const instance = resolveCoreInstance(state, coreInstanceId)
  const key = instance?.id ?? coreInstanceId
  const direct = state.workshop?.coreStarts?.[key]
  const purchased = direct != null
    ? Math.max(0, Math.floor(direct))
    : Math.max(0, Math.floor(
        instance?.moduleId ? state.workshop?.coreStarts?.[instance.moduleId] ?? 0 : 0,
      ))
  const research = sumResearchNumber(resolvedResearchIds(state.hiveResearch), 'coreStartLevel')
  return Math.max(0, Math.min(CORE_START_LEVEL_CAP, purchased + research))
}

export function coreStartingLevelAtSlot(
  state: Pick<GameState, 'shipyard' | 'workshop'>,
  slot: number,
): number {
  const instance = coreInstanceAtSlot(state, slot)
  return instance ? coreStartingLevel(state, instance.id) : 0
}

export function coreStartingUpgradeCost(
  state: Pick<GameState, 'shipyard' | 'workshop'>,
  coreInstanceId: string,
): number {
  return workshopCost(coreStartingLevel(state, coreInstanceId))
}

export function maxAffordableCoreStartingPurchases(
  state: Pick<GameState, 'resources' | 'shipyard' | 'workshop'>,
  coreInstanceId: string,
): number {
  let scrap = Math.max(0, state.resources.scrap ?? 0)
  let level = coreStartingLevel(state, coreInstanceId)
  let count = 0
  while (level < CORE_START_LEVEL_CAP) {
    const cost = workshopCost(level)
    if (scrap < cost) break
    scrap -= cost
    level += 1
    count += 1
  }
  return count
}

export function buyCoreStartingLevel(
  state: GameState,
  coreInstanceId: string,
  count = 1,
): GameState {
  if (!state.combat.docked) return state
  const instance = resolveCoreInstance(state, coreInstanceId)
  if (!instance) return state
  const want =
    count === Number.POSITIVE_INFINITY
      ? maxAffordableCoreStartingPurchases(state, instance.id)
      : Math.max(1, Math.floor(count))
  if (want <= 0) return state
  const next = structuredClone(state)
  if (!next.workshop.coreStarts) next.workshop.coreStarts = {}
  let bought = 0
  for (let i = 0; i < want; i += 1) {
    const level = coreStartingLevel(next, instance.id)
    if (level >= CORE_START_LEVEL_CAP) break
    const cost = workshopCost(level)
    if (cost <= 0 || (next.resources.scrap ?? 0) < cost) break
    next.resources.scrap -= cost
    next.workshop.coreStarts[instance.id] = level + 1
    next.meta.lifetimeCoreRunBuys = (next.meta.lifetimeCoreRunBuys ?? 0) + 1
    bought += 1
  }
  if (bought <= 0) return state
  recordPlaytest(next, 'core_buy', {
    n: getModule(instance.moduleId)?.name ?? instance.moduleId,
    v: coreStartingLevel(next, instance.id),
    firstKey: `core_start:${instance.id}`,
  })
  noteSystemAction(next, 'cores')
  return next
}

export function coreRunLevelForModule(
  state: Pick<GameState, 'combat' | 'shipyard'>,
  moduleId: string,
  slotHint?: number,
): number {
  if (slotHint != null && state.shipyard.modules[slotHint] === moduleId) {
    return coreRunLevel(state, slotHint)
  }
  const slots = equippedCoreSlots(state).filter((row) => row.moduleId === moduleId)
  if (slots.length === 0) return 0
  return Math.max(...slots.map((row) => coreRunLevel(state, row.slot)))
}

export function setCoreRunLevel(state: GameState, slot: number, level: number): void {
  if (!state.combat.coreRunLevels) state.combat.coreRunLevels = {}
  const next = Math.max(0, Math.min(CORE_RUN_LEVEL_CAP, Math.floor(level)))
  if (next <= 0) delete state.combat.coreRunLevels[String(slot)]
  else state.combat.coreRunLevels[String(slot)] = next
}

export function clearCoreRunLevels(state: GameState): void {
  state.combat.coreRunLevels = {}
  state.combat.coreSalvageSpent = {}
}

export function coreRunCategory(moduleId: string): RunUpgradeCategory {
  const def = getModule(moduleId)
  if (!def) return 'attack'
  if (def.role === 'weapon') return 'attack'
  if (def.role === 'defense') return 'defense'
  if ((def.salvageKillBonus ?? 0) > 0) return 'economy'
  if (moduleId === 'salvage-rig' || moduleId === 'drone-bay' || moduleId === 'choir-tap') {
    return 'economy'
  }
  if (moduleId === 'nano-lathe') return 'defense'
  if (moduleId === 'surge-capacitor') return 'defense'
  if (
    moduleId === 'vector-thruster' ||
    moduleId === 'grav-tether' ||
    moduleId === 'sensor-whisker'
  ) {
    return 'attack'
  }
  return 'economy'
}

export function coreRunUpgradeCost(level: number, moduleId?: string): number {
  return moduleUpgradeCost(level, moduleId)
}

export function coreRunBulkCost(state: GameState, slot: number, count: number): number {
  const moduleId = state.shipyard.modules[slot]
  const start = coreRunLevel(state, slot)
  const room = Math.max(0, CORE_RUN_LEVEL_CAP - coreStartingLevelAtSlot(state, slot) - start)
  const n = Math.min(Math.max(0, Math.floor(count)), room)
  let total = 0
  for (let i = 0; i < n; i += 1) total += coreRunUpgradeCost(start + i, moduleId)
  return total
}

export function maxAffordableCoreRunPurchases(state: GameState, slot: number): number {
  const moduleId = state.shipyard.modules[slot]
  if (!moduleId) return 0
  let salvage = state.resources.salvage ?? 0
  let level = coreRunLevel(state, slot)
  const starting = coreStartingLevelAtSlot(state, slot)
  let bought = 0
  while (starting + level < CORE_RUN_LEVEL_CAP && bought < 200) {
    const cost = coreRunUpgradeCost(level, moduleId)
    if (cost <= 0 || salvage < cost) break
    salvage -= cost
    level += 1
    bought += 1
  }
  return bought
}

export function moduleMasteryXp(
  state: Pick<GameState, 'meta'>,
  moduleId: string,
): number {
  return Math.max(0, Math.floor(state.meta.moduleMasteryXp?.[moduleId] ?? 0))
}

/** Soft curve so late Mastery stays long-term, not a few-hour M100. */
export function masteryXpToNext(level: number): number {
  const n = Math.max(0, Math.floor(level))
  if (n < 10) return Math.round(48 * Math.pow(1.15, n))
  if (n < 25) return Math.round(190 * Math.pow(1.145, n - 10))
  if (n < 50) return Math.round(1500 * Math.pow(1.12, n - 25))
  return Math.round(24000 * Math.pow(1.095, n - 50))
}

export function waveThreatValue(wave: number): number {
  const w = Math.max(1, Math.floor(wave))
  return 10 + w * 3 + Math.pow(w, 1.15) * 0.75
}

export function masteryFrontierMult(wave: number, careerBestBefore: number): number {
  const w = Math.max(1, wave)
  const best = Math.max(0, careerBestBefore)
  if (best <= 1) return 1
  const ratio = w / best
  if (w > best) return 1.12
  if (ratio >= 0.9) return 1
  if (ratio >= 0.6) return 0.62
  return 0.26 + 0.34 * ratio
}

export function masteryWaveXp(opts: {
  wave: number
  careerBestBefore: number
  boss?: boolean
  newBest?: boolean
  challenge?: boolean
}): number {
  const threat = waveThreatValue(opts.wave)
  const frontier = masteryFrontierMult(opts.wave, opts.careerBestBefore)
  const boss = opts.boss ? 1.55 : 1
  const best = opts.newBest ? 1.22 : 1
  const challenge = opts.challenge ? 1.2 : 1
  return Math.max(1, Math.round(threat * frontier * boss * best * challenge))
}

/** Capped secondary bonus. Same cap for every role so weapons cannot snowball. */
export function masteryContributionBonus(baseXp: number, acted: boolean): number {
  if (!acted || baseXp <= 0) return 0
  return Math.min(Math.round(baseXp * 0.15), Math.max(1, Math.round(baseXp * 0.08)))
}

export function applyMasteryXp(state: GameState, moduleId: string, amount: number): CoreMasteryGrant {
  const xp = Math.max(0, Math.floor(amount))
  const from = moduleMasteryRank(state, moduleId)
  if (!state.meta.moduleMastery) state.meta.moduleMastery = {}
  if (!state.meta.moduleMasteryXp) state.meta.moduleMasteryXp = {}
  let level = from
  let into = moduleMasteryXp(state, moduleId) + xp
  const reached: number[] = []
  while (level < CORE_MASTERY_CAP) {
    const need = masteryXpToNext(level)
    if (into < need) break
    into -= need
    level += 1
    if (isMasteryMilestone(moduleId, level)) reached.push(level)
  }
  if (level >= CORE_MASTERY_CAP) {
    level = CORE_MASTERY_CAP
    into = 0
  }
  state.meta.moduleMastery[moduleId] = level
  state.meta.moduleMasteryXp[moduleId] = into
  return {
    moduleId,
    xp,
    from,
    to: level,
    xpIntoLevel: into,
    xpToNext: level >= CORE_MASTERY_CAP ? 0 : masteryXpToNext(level),
    milestones: reached,
  }
}

export interface MasteryMilestoneDef {
  level: number
  name: string
  blurb: string
  damageMult?: number
  cooldownMult?: number
  rangeAdd?: number
  shieldMult?: number
  regenAdd?: number
  splashAdd?: number
  salvageKillAdd?: number
  runScaleMult?: number
  socket?: RelicSocketClass
}

const SHARED_LATE: MasteryMilestoneDef[] = [
  { level: 75, name: 'Deep Pattern', blurb: 'Synergy with the Hive’s permanent systems.', damageMult: 1.06, shieldMult: 1.06 },
  { level: 100, name: 'True Mastery', blurb: 'The Core is fully understood.', damageMult: 1.1, shieldMult: 1.08, runScaleMult: 1.08 },
]

export const CORE_MASTERY_MILESTONES: Record<string, MasteryMilestoneDef[]> = {
  'pulse-cannon': [
    { level: 5, name: 'Hardened Pulse', blurb: 'Base effectiveness +8%.', damageMult: 1.08 },
    { level: 10, name: 'Tight Cycle', blurb: 'Faster pulse cadence.', cooldownMult: 1 / 1.08 },
    { level: 20, name: 'Optical Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'optical' },
    { level: 30, name: 'Core Feed', blurb: 'Core Levels scale harder.', runScaleMult: 1.1 },
    { level: 50, name: 'Foundry Arc', blurb: 'Pulse behaviour evolves.', damageMult: 1.12, rangeAdd: 10 },
    ...SHARED_LATE,
  ],
  'heavy-lance': [
    { level: 5, name: 'Keel Weight', blurb: 'Heavier pierce.', damageMult: 1.1 },
    { level: 10, name: 'Slow Pierce', blurb: 'Armour-breaking focus.', damageMult: 1.06, rangeAdd: 8 },
    { level: 20, name: 'Ballistic Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'ballistic' },
    { level: 30, name: 'Core Feed', blurb: 'Core Levels scale harder.', runScaleMult: 1.1 },
    { level: 50, name: 'Breach Lance', blurb: 'Sustained pierce evolves.', damageMult: 1.14 },
    ...SHARED_LATE,
  ],
  'flak-array': [
    { level: 5, name: 'Wider Burst', blurb: 'Splash reaches one extra hull.', splashAdd: 1 },
    { level: 10, name: 'Retarget Mesh', blurb: 'Faster pack cycling.', cooldownMult: 1 / 1.1 },
    { level: 20, name: 'Ballistic Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'ballistic' },
    { level: 30, name: 'Overkill Transfer', blurb: 'Splash and Run scaling improve.', splashAdd: 1, runScaleMult: 1.08 },
    { level: 50, name: 'Cloud Flak', blurb: 'Pack shredding evolves.', damageMult: 1.1, splashAdd: 1 },
    ...SHARED_LATE,
  ],
  'phase-beam': [
    { level: 5, name: 'Held Contact', blurb: 'Beam damage +8%.', damageMult: 1.08 },
    { level: 10, name: 'Tracking Lock', blurb: 'Slightly longer reach.', rangeAdd: 12 },
    { level: 20, name: 'Optical Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'optical' },
    { level: 30, name: 'Ramp Feed', blurb: 'Core Levels scale the beam harder.', runScaleMult: 1.12 },
    { level: 50, name: 'Chain Phase', blurb: 'Sustained contact evolves.', damageMult: 1.12, splashAdd: 1 },
    ...SHARED_LATE,
  ],
  'plate-layer': [
    { level: 5, name: 'Bulk Aegis', blurb: 'Shield ceiling +12%.', shieldMult: 1.12 },
    { level: 10, name: 'Quick Regen', blurb: '+2%/s shield regen.', regenAdd: 0.02 },
    { level: 20, name: 'Shield Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'shield' },
    { level: 30, name: 'Core Bank', blurb: 'Core Levels thicken the bank more.', runScaleMult: 1.1 },
    { level: 50, name: 'Bastion Field', blurb: 'Break response evolves.', shieldMult: 1.15, regenAdd: 0.02 },
    ...SHARED_LATE,
  ],
  'lattice-ward': [
    { level: 5, name: 'Mesh Bank', blurb: 'Fast lattice ceiling.', shieldMult: 1.1 },
    { level: 10, name: 'Mesh Flow', blurb: '+3%/s regen.', regenAdd: 0.03 },
    { level: 20, name: 'Shield Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'shield' },
    { level: 30, name: 'Core Flow', blurb: 'Core Levels scale regen and bank.', runScaleMult: 1.1, regenAdd: 0.01 },
    { level: 50, name: 'Live Matrix', blurb: 'Chip endurance evolves.', shieldMult: 1.12, regenAdd: 0.03 },
    ...SHARED_LATE,
  ],
  'barrier-projector': [
    { level: 5, name: 'Second Skin', blurb: 'Projected shield +12%.', shieldMult: 1.12 },
    { level: 10, name: 'Hold Field', blurb: 'Break recovery.', regenAdd: 0.02 },
    { level: 20, name: 'Shield Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'shield' },
    { level: 30, name: 'Core Projection', blurb: 'Core Levels scale the envelope.', runScaleMult: 1.1 },
    { level: 50, name: 'Hard Barrier', blurb: 'Projection evolves.', shieldMult: 1.16 },
    ...SHARED_LATE,
  ],
  'nano-lathe': [
    { level: 5, name: 'Dockside Care', blurb: 'Repair identity +8% hull pad.', shieldMult: 1.04 },
    { level: 10, name: 'Live Lathe', blurb: 'Faster restoration.', regenAdd: 0.015 },
    { level: 20, name: 'Industrial Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'industrial' },
    { level: 30, name: 'Core Repair', blurb: 'Core Levels scale hull support.', runScaleMult: 1.12 },
    { level: 50, name: 'Field Lathe', blurb: 'Repair behaviour evolves.', regenAdd: 0.02 },
    ...SHARED_LATE,
  ],
  'salvage-rig': [
    { level: 5, name: 'Recovery Mesh', blurb: 'Better wreck conversion.', salvageKillAdd: 0.04 },
    { level: 10, name: 'Hold Scoop', blurb: 'Collection efficiency.', salvageKillAdd: 0.04 },
    { level: 20, name: 'Industrial Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'industrial' },
    { level: 30, name: 'Core Scoop', blurb: 'Core Levels scale economy output.', runScaleMult: 1.12, salvageKillAdd: 0.03 },
    { level: 50, name: 'Deep Claw', blurb: 'Economy identity evolves.', salvageKillAdd: 0.08 },
    ...SHARED_LATE,
  ],
  'drone-bay': [
    { level: 5, name: 'Mark Wrecks', blurb: 'Salvage / kill +4%.', salvageKillAdd: 0.04 },
    { level: 10, name: 'Collection Feed', blurb: 'Collection efficiency.', salvageKillAdd: 0.05 },
    { level: 20, name: 'Industrial Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'industrial' },
    { level: 30, name: 'Core Recovery', blurb: 'Core Levels scale Salvage.', runScaleMult: 1.1 },
    { level: 50, name: 'Bound Marks', blurb: 'Economy identity evolves.', salvageKillAdd: 0.08 },
    ...SHARED_LATE,
  ],
  'choir-tap': [
    { level: 5, name: 'Choir Ear', blurb: 'Wreck tap +5%.', salvageKillAdd: 0.05 },
    { level: 10, name: 'Ash Filter', blurb: 'Conversion improves.', salvageKillAdd: 0.05 },
    { level: 20, name: 'Industrial Socket', blurb: 'Unlocks an extra Relic socket.', socket: 'industrial' },
    { level: 30, name: 'Core Tap', blurb: 'Core Levels scale economy.', runScaleMult: 1.1 },
    { level: 50, name: 'Choir Flood', blurb: 'Tap evolves.', salvageKillAdd: 0.1 },
    ...SHARED_LATE,
  ],
}

function defaultMilestones(moduleId: string): MasteryMilestoneDef[] {
  const def = getModule(moduleId)
  if (def?.role === 'weapon') return CORE_MASTERY_MILESTONES['pulse-cannon'] ?? []
  if (def?.role === 'defense') return CORE_MASTERY_MILESTONES['plate-layer'] ?? []
  if ((def?.salvageKillBonus ?? 0) > 0) return CORE_MASTERY_MILESTONES['salvage-rig'] ?? []
  return CORE_MASTERY_MILESTONES['nano-lathe'] ?? []
}

export function masteryMilestonesFor(moduleId: string): MasteryMilestoneDef[] {
  return CORE_MASTERY_MILESTONES[moduleId] ?? defaultMilestones(moduleId)
}

export function isMasteryMilestone(moduleId: string, level: number): boolean {
  return masteryMilestonesFor(moduleId).some((ms) => ms.level === level)
}

export function nextMasteryMilestone(
  moduleId: string,
  mastery: number,
): MasteryMilestoneDef | null {
  return masteryMilestonesFor(moduleId).find((ms) => ms.level > mastery) ?? null
}

const SOCKET_EFFECT_LABEL: Record<RelicSocketClass, string> = {
  power: 'Power',
  optical: 'Optical',
  ballistic: 'Ballistic',
  shield: 'Shield',
  industrial: 'Industrial',
  universal: 'Universal',
}

function formatMult(n: number): string {
  return `×${n.toFixed(2)}`
}

function formatPct(n: number): string {
  const pct = n * 100
  const rounded = Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Number(pct.toFixed(1))
  return `${pct >= 0 ? '+' : ''}${rounded}%`
}

/** Player-facing stat line from the milestone numbers, not flavor copy. */
export function masteryMilestoneEffect(ms: MasteryMilestoneDef): string {
  const bits: string[] = []
  if (ms.damageMult) bits.push(`Damage ${formatMult(ms.damageMult)}`)
  if (ms.cooldownMult) bits.push(`RoF ${formatMult(1 / ms.cooldownMult)}`)
  if (ms.rangeAdd) bits.push(`Range +${ms.rangeAdd}`)
  if (ms.shieldMult) bits.push(`Shield ${formatMult(ms.shieldMult)}`)
  if (ms.regenAdd) bits.push(`Regen ${formatPct(ms.regenAdd)}/s`)
  if (ms.splashAdd) bits.push(`Splash +${ms.splashAdd}`)
  if (ms.salvageKillAdd) bits.push(`Salvage/kill ${formatPct(ms.salvageKillAdd)}`)
  if (ms.runScaleMult) bits.push(`Core Level scaling ${formatMult(ms.runScaleMult)}`)
  if (ms.socket) bits.push(`+1 ${SOCKET_EFFECT_LABEL[ms.socket]} Relic socket`)
  return bits.join(' · ') || ms.blurb
}

export interface MasteryMods {
  damageMult: number
  cooldownMult: number
  rangeAdd: number
  shieldMult: number
  regenAdd: number
  splashAdd: number
  salvageKillAdd: number
  runScaleMult: number
}

export function emptyMasteryMods(): MasteryMods {
  return {
    damageMult: 1,
    cooldownMult: 1,
    rangeAdd: 0,
    shieldMult: 1,
    regenAdd: 0,
    splashAdd: 0,
    salvageKillAdd: 0,
    runScaleMult: 1,
  }
}

export function masteryModsFor(moduleId: string, mastery: number): MasteryMods {
  const mods = emptyMasteryMods()
  for (const ms of masteryMilestonesFor(moduleId)) {
    if (mastery < ms.level) continue
    if (ms.damageMult) mods.damageMult *= ms.damageMult
    if (ms.cooldownMult) mods.cooldownMult *= ms.cooldownMult
    if (ms.rangeAdd) mods.rangeAdd += ms.rangeAdd
    if (ms.shieldMult) mods.shieldMult *= ms.shieldMult
    if (ms.regenAdd) mods.regenAdd += ms.regenAdd
    if (ms.splashAdd) mods.splashAdd += ms.splashAdd
    if (ms.salvageKillAdd) mods.salvageKillAdd += ms.salvageKillAdd
    if (ms.runScaleMult) mods.runScaleMult *= ms.runScaleMult
  }
  return mods
}

export function combinedCoreMods(state: GameState, moduleId: string): MasteryMods {
  const mastery = masteryModsFor(moduleId, moduleMasteryRank(state, moduleId))
  const legacy = milestoneModsFor(moduleId, state.shipyard.corePicks?.[moduleId])
  return {
    damageMult: mastery.damageMult * legacy.damageMult,
    cooldownMult: mastery.cooldownMult * legacy.cooldownMult,
    rangeAdd: mastery.rangeAdd + legacy.rangeAdd,
    shieldMult: mastery.shieldMult * legacy.shieldMult,
    regenAdd: mastery.regenAdd + legacy.regenAdd,
    splashAdd: mastery.splashAdd,
    salvageKillAdd: mastery.salvageKillAdd,
    runScaleMult: mastery.runScaleMult,
  }
}

export function effectiveRunLevel(state: GameState, slot: number): number {
  const moduleId = state.shipyard.modules[slot]
  if (!moduleId) return 0
  const raw = coreRunLevel(state, slot)
  const scale = combinedCoreMods(state, moduleId).runScaleMult
  if (scale <= 1) return raw
  return raw * scale
}

export function effectiveCoreLevel(state: GameState, slot: number): number {
  const moduleId = state.shipyard.modules[slot]
  if (!moduleId) return 0
  return coreStartingLevelAtSlot(state, slot) * combinedCoreMods(state, moduleId).runScaleMult
}

export function corePrimaryOutput(state: GameState, slot: number): CorePrimaryOutput | null {
  const moduleId = state.shipyard.modules[slot]
  const def = getModule(moduleId)
  if (!def) return null
  const masteryRank = moduleMasteryRank(state, moduleId)
  const mastery = masteryBonus(masteryRank)
  const mods = combinedCoreMods(state, moduleId)
  const level = Math.floor(effectiveCoreLevel(state, slot))
  if (def.weapon) {
    const dmg = moduleWeaponDamage(def, level, mastery) * mods.damageMult
    const dmgNext = moduleWeaponDamage(def, level + 1, mastery) * mods.damageMult
    const cd = Math.max(0.05, def.weapon.cooldown * mods.cooldownMult)
    return { label: 'DPS', current: dmg / cd, next: dmgNext / cd }
  }
  if ((def.shieldBonus ?? 0) > 0 || (def.shieldBonusPerLevel ?? 0) > 0) {
    const cur = moduleLeveledBonus(def.shieldBonus ?? 0, def.shieldBonusPerLevel, level, mastery) * mods.shieldMult
    const nxt = moduleLeveledBonus(def.shieldBonus ?? 0, def.shieldBonusPerLevel, level + 1, mastery) * mods.shieldMult
    return { label: 'Shield', current: cur, next: nxt }
  }
  if (moduleId === 'nano-lathe' || def.id === 'nano-lathe') {
    const cur = 2 + level * 0.35 * mastery
    return { label: 'Repair/s', current: cur, next: 2 + (level + 1) * 0.35 * mastery }
  }
  if ((def.salvageKillBonus ?? 0) > 0 || coreRunCategory(moduleId) === 'economy') {
    const base = (def.salvageKillBonus ?? 0.08) + mods.salvageKillAdd
    const cur = base * (1 + level * 0.06) * mastery
    const nxt = base * (1 + (level + 1) * 0.06) * mastery
    return { label: 'Salvage', current: cur, next: nxt }
  }
  if ((def.hullBonus ?? 0) > 0) {
    const cur = moduleLeveledBonus(def.hullBonus, def.hullBonusPerLevel, level, mastery)
    const nxt = moduleLeveledBonus(def.hullBonus, def.hullBonusPerLevel, level + 1, mastery)
    return { label: 'Hull', current: cur, next: nxt }
  }
  return { label: 'Run', current: level, next: level + 1 }
}

export function buyCoreRunLevel(state: GameState, slot: number, count = 1): GameState {
  void slot
  void count
  return state
}

export function buyCoreRunLevelByModule(state: GameState, moduleId: string, count = 1): GameState {
  const slot = state.shipyard.modules.findIndex((id) => id === moduleId)
  if (slot < 0) return state
  return buyCoreRunLevel(state, slot, count)
}

function slotRole(moduleId: string): 'weapon' | 'defense' | 'utility' {
  return getModule(moduleId)?.role ?? 'utility'
}

export function pickAutoCoreRunSlot(state: GameState): number | null {
  const cfg = state.process?.config?.core
  const priority = cfg?.priority ?? 'cheapest'
  const slots = equippedCoreSlots(state)
  if (slots.length === 0) return null
  const salvage = state.resources.salvage ?? 0
  const affordable = slots.filter((row) => {
    const level = coreRunLevel(state, row.slot)
    if (coreStartingLevelAtSlot(state, row.slot) + level >= CORE_RUN_LEVEL_CAP) return false
    return coreRunUpgradeCost(level, row.moduleId) <= salvage
  })
  if (affordable.length === 0) return null
  if (priority === 'cheapest') {
    return affordable.sort(
      (a, b) =>
        coreRunUpgradeCost(coreRunLevel(state, a.slot), a.moduleId) -
        coreRunUpgradeCost(coreRunLevel(state, b.slot), b.moduleId),
    )[0]!.slot
  }
  const wantRole =
    priority === 'weapon' ? 'weapon' : priority === 'shield' ? 'defense' : priority === 'utility' ? 'utility' : null
  if (wantRole) {
    const match = affordable.find((row) => slotRole(row.moduleId) === wantRole)
    if (match) return match.slot
  }
  return affordable.sort((a, b) => coreRunLevel(state, a.slot) - coreRunLevel(state, b.slot))[0]!.slot
}

export function awardEquippedMasteryXp(
  state: GameState,
  wave: number,
  opts: { boss: boolean; newBest: boolean; careerBestBefore: number },
): CoreMasteryGrant[] {
  const base = masteryWaveXp({
    wave,
    careerBestBefore: opts.careerBestBefore,
    boss: opts.boss,
    newBest: opts.newBest,
    challenge: isChallengeSortie(state),
  })
  const acted = (state.combat.sortieMark?.stats.damageDealt ?? 0) > 0 || opts.boss
  const bonus = masteryContributionBonus(base, acted)
  const grants: CoreMasteryGrant[] = []
  const seen = new Set<string>()
  if (!state.combat.coreMasteryXp) state.combat.coreMasteryXp = {}
  if (!state.combat.coreBossClears) state.combat.coreBossClears = {}
  if (!state.combat.coreNewBest) state.combat.coreNewBest = {}
  if (!state.combat.coreMilestones) state.combat.coreMilestones = {}
  for (const row of equippedCoreSlots(state)) {
    if (seen.has(row.moduleId)) continue
    seen.add(row.moduleId)
    const grant = applyMasteryXp(state, row.moduleId, base + bonus)
    grants.push(grant)
    state.combat.coreMasteryXp[row.moduleId] =
      (state.combat.coreMasteryXp[row.moduleId] ?? 0) + grant.xp
    if (opts.boss) {
      state.combat.coreBossClears[row.moduleId] =
        (state.combat.coreBossClears[row.moduleId] ?? 0) + 1
    }
    if (opts.newBest) state.combat.coreNewBest[row.moduleId] = true
    if (grant.milestones.length > 0) {
      state.combat.coreMilestones[row.moduleId] = [
        ...(state.combat.coreMilestones[row.moduleId] ?? []),
        ...grant.milestones,
      ]
    }
  }
  return grants
}

export function snapshotCoreMasteryStart(state: GameState): void {
  if (!state.combat.coreMasteryStart) state.combat.coreMasteryStart = {}
  for (const row of equippedCoreSlots(state)) {
    if (state.combat.coreMasteryStart[row.moduleId] == null) {
      state.combat.coreMasteryStart[row.moduleId] = moduleMasteryRank(state, row.moduleId)
    }
  }
}

export function coreSortieRecords(state: GameState): CoreSortieRecord[] {
  return equippedCoreSlots(state).map((row) => {
    const start = state.combat.coreMasteryStart?.[row.moduleId] ?? moduleMasteryRank(state, row.moduleId)
    const end = moduleMasteryRank(state, row.moduleId)
    return {
      moduleId: row.moduleId,
      slot: row.slot,
      runLevel: coreRunLevel(state, row.slot),
      masteryStart: start,
      masteryEnd: end,
      masteryXp: state.combat.coreMasteryXp?.[row.moduleId] ?? 0,
      salvageSpent: state.combat.coreSalvageSpent?.[String(row.slot)] ?? 0,
      contribution: 0,
      bossClears: state.combat.coreBossClears?.[row.moduleId] ?? 0,
      newBestBonus: Boolean(state.combat.coreNewBest?.[row.moduleId]),
      milestones: state.combat.coreMilestones?.[row.moduleId] ?? [],
    }
  })
}

export function legacyRankToMastery(rank: number): { level: number; xp: number } {
  const n = Math.max(0, Math.floor(rank))
  if (n <= 0) return { level: 0, xp: 0 }
  const level = Math.min(LEGACY_RANK_MASTERY_CAP, Math.max(1, Math.floor(n * 0.4) + (n >= 1 ? 1 : 0)))
  return { level, xp: Math.min(masteryXpToNext(level) - 1, n * 8) }
}

/**
 * Convert leftover Scrap Dock ranks into bounded Mastery.
 * Retired per-Sortie Core levels start at 0 and do not affect current Core power.
 */
export function migrateLegacyCoreProgression(state: GameState): void {
  if (state.meta.coreProgressionMigrated) return
  const ranks: Record<string, number> = {
    ...(state.workshop?.coreStarts ?? {}),
    ...(state.shipyard.moduleLevels ?? {}),
  }
  if (!state.meta.moduleMastery) state.meta.moduleMastery = {}
  if (!state.meta.moduleMasteryXp) state.meta.moduleMasteryXp = {}
  if (!state.shipyard.moduleCopies) state.shipyard.moduleCopies = {}
  for (const id of state.shipyard.unlockedModules) {
    if (state.shipyard.moduleCopies[id] == null) state.shipyard.moduleCopies[id] = 1
  }
  for (const [id, rank] of Object.entries(ranks)) {
    if (!rank) continue
    const mapped = legacyRankToMastery(rank)
    const have = state.meta.moduleMastery[id] ?? 0
    if (mapped.level > have) {
      state.meta.moduleMastery[id] = mapped.level
      state.meta.moduleMasteryXp[id] = mapped.xp
    } else if (mapped.level === have) {
      state.meta.moduleMasteryXp[id] = Math.max(state.meta.moduleMasteryXp[id] ?? 0, mapped.xp)
    }
  }
  state.shipyard.moduleLevels = {}
  if (state.workshop) state.workshop.coreStarts = {}
  state.combat.coreRunLevels = state.combat.coreRunLevels ?? {}
  if (state.combat.docked) state.combat.coreRunLevels = {}
  state.meta.coreProgressionMigrated = true
}

export function totalMasteryLevels(state: Pick<GameState, 'meta'>): number {
  return Object.values(state.meta.moduleMastery ?? {}).reduce((a, b) => a + Math.max(0, b), 0)
}

export function anyCoreRunLevel(state: Pick<GameState, 'combat'>): number {
  return Object.values(state.combat.coreRunLevels ?? {}).reduce((a, b) => a + Math.max(0, b), 0)
}

export { practicedCoreWork } from './corePractice'

export function protocolScaledCoreCost(state: GameState, moduleId: string, level: number): number {
  const add = protocolCoreScalingAdd(state, getModule(moduleId)?.role)
  return moduleUpgradeCost(level, moduleId, add)
}
