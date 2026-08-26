/** Scrap-funded physical Core Levels and usage-driven shared Core Mastery. */

import type { GameState, RunUpgradeCategory } from './types'
import {
  getModule,
  masteryBonus,
  moduleLeveledBonus,
  moduleMasteryRank,
  moduleWeaponDamage,
} from './catalog'
import { isChallengeSortie } from './frontier'
import { recordPlaytest, noteSystemAction } from './playtest'
import { resolvedResearchIds, sumResearchNumber } from './hiveResearchTree'
import { milestoneModsFor } from './milestones'
import {
  addCoreInstance,
  coreInstanceAtSlot,
  resolveCoreInstance,
} from './coreInstances'
import { workshopCost } from './workshop'
import {
  CORE_MASTERY_MILESTONES,
  isMasteryMilestone,
  masteryMilestoneEffect,
  masteryMilestonesFor,
  nextMasteryMilestone,
  type MasteryMilestoneDef,
} from './coreMastery'

export { CORE_MASTERY_MILESTONES, isMasteryMilestone, masteryMilestoneEffect, masteryMilestonesFor, nextMasteryMilestone }
export type { MasteryMilestoneDef }

export const CORE_START_LEVEL_CAP = 80
export const CORE_MASTERY_CAP = 100

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

export function coreRunLevel(_state?: Pick<GameState, 'combat'>, _slot?: number): number {
  return 0
}

export function coreRunLevelForModule(
  _state: Pick<GameState, 'combat' | 'shipyard'>,
  _moduleId: string,
  _slotHint?: number,
): number {
  return 0
}

export function setCoreRunLevel(_state: GameState, _slot: number, _level: number): void {}

export function clearCoreRunLevels(_state: GameState): void {}

export function coreStartingLevel(
  state: Pick<GameState, 'shipyard' | 'workshop'> & { hiveResearch?: GameState['hiveResearch'] },
  coreInstanceId: string,
): number {
  const instance = resolveCoreInstance(state, coreInstanceId)
  const key = instance?.id ?? coreInstanceId
  const purchased = Math.max(0, Math.floor(state.workshop?.coreStarts?.[key] ?? 0))
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

export function coreRunCategory(moduleId: string): RunUpgradeCategory {
  const def = getModule(moduleId)
  if (!def) return 'attack'
  if (def.role === 'weapon') return 'attack'
  if (def.role === 'defense') return 'defense'
  if ((def.salvageKillBonus ?? 0) > 0 || moduleId === 'salvage-beacon' || moduleId === 'choir-tap') {
    return 'economy'
  }
  if (moduleId === 'nano-lathe') return 'defense'
  if (moduleId === 'grav-tether' || moduleId === 'sensor-array') return 'attack'
  return 'economy'
}

export function coreRunUpgradeCost(_level: number, _moduleId?: string): number {
  return 0
}

export function coreRunBulkCost(_state: GameState, _slot: number, _count: number): number {
  return 0
}

export function maxAffordableCoreRunPurchases(_state: GameState, _slot: number): number {
  return 0
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

export function pickAutoCoreRunSlot(_state: GameState): number | null {
  return null
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
      salvageSpent: 0,
      contribution: 0,
      bossClears: state.combat.coreBossClears?.[row.moduleId] ?? 0,
      newBestBonus: Boolean(state.combat.coreNewBest?.[row.moduleId]),
      milestones: state.combat.coreMilestones?.[row.moduleId] ?? [],
    }
  })
}

export function totalMasteryLevels(state: Pick<GameState, 'meta'>): number {
  return Object.values(state.meta.moduleMastery ?? {}).reduce((a, b) => a + Math.max(0, b), 0)
}

export function anyCoreRunLevel(_state: Pick<GameState, 'combat'>): number {
  return 0
}

export { practicedCoreWork } from './corePractice'

export function protocolScaledCoreCost(_state: GameState, _moduleId: string, _level: number): number {
  return 0
}
