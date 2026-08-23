/** GDD §111–119 live HUD and comparison helpers. */

import {
  getAiNode,
  getMatterShopItem,
  getModule,
  matterShopCombatSpeed,
  matterShopHullBonus,
  matterShopRankMultiplier,
  matterShopShieldBonus,
  metaDamageMultiplier,
  metaProductionMultiplier,
  moduleMasteryRank,
  moduleWeaponDamage,
} from './catalog'
import { formatCompact } from './format'
import { corePrimaryOutput } from './coreProgression'
import { hiveResearchCombatSpeed } from './hiveResearch'
import { processCombatSpeedMult } from './process'
import { advancedReadoutsUnlocked } from './disclosure'
import { computeShipStats } from './state'
import { ensureSortieStats, primaryThreat } from './sortieTelemetry'
import type { GameState } from './types'

export type DamageNumbersMode = 'minimal' | 'standard' | 'detailed'

export function availableSortieSpeeds(state: GameState): number[] {
  const speeds = new Set<number>([1])
  for (const id of state.ai.purchased ?? []) {
    const m = getAiNode(id)?.combatSpeedMult
    if (m != null && m > 1) speeds.add(m)
  }
  const proc = processCombatSpeedMult(state)
  if (proc > 1) speeds.add(proc)
  const research = hiveResearchCombatSpeed(state)
  if (research > 1) speeds.add(research)
  const matter = matterShopCombatSpeed(state.prestige.matterShop)
  if (matter > 1) speeds.add(matter)
  return [...speeds].sort((a, b) => a - b)
}

export function chosenSortieSpeed(state: GameState): number {
  const avail = availableSortieSpeeds(state)
  const pref = state.meta.sortieSpeed
  if (pref != null && avail.includes(pref)) return pref
  return avail[avail.length - 1] ?? 1
}

export function sortieSpeed(state: GameState): number {
  return chosenSortieSpeed(state)
}

export function runScrapEarned(state: GameState): number {
  if (state.combat.docked || !state.combat.sortieMark) {
    return Math.max(0, state.combat.lastSortie?.scrapEarned ?? 0)
  }
  return Math.max(0, (state.resources.scrap ?? 0) - (state.combat.sortieMark.scrap ?? 0))
}

export function runSalvageEarned(state: GameState): number {
  const mark = state.combat.sortieMark
  if (state.combat.docked || !mark) {
    return Math.max(0, state.combat.lastSortie?.salvageGained ?? 0)
  }
  return Math.max(0, (state.resources.salvage ?? 0) - (mark.salvage ?? 0) + (mark.salvageSpent ?? 0))
}

export function runResourceRates(state: GameState): { salvagePerSec: number; scrapPerSec: number } {
  const elapsed = Math.max(1, state.combat.fightElapsed ?? 0)
  return {
    salvagePerSec: runSalvageEarned(state) / elapsed,
    scrapPerSec: runScrapEarned(state) / elapsed,
  }
}

export function fragmentCount(state: GameState): number {
  return Object.values(state.parts ?? {}).reduce((n, v) => n + Math.max(0, Math.floor(Number(v) || 0)), 0)
}

export function permanentMultipliers(state: GameState): {
  damage: number
  defense: number
  industry: number
} {
  const matter = state.resources.prestigeMatter ?? 0
  const damage = metaDamageMultiplier(
    matter,
    state.resources.challengePoints ?? 0,
    state.prestige.shop,
    state.prestige.matterShop,
    state.prestige.challengeClears,
  )
  const hullBonus = matterShopHullBonus(state.prestige.matterShop ?? {})
  const shieldBonus = matterShopShieldBonus(state.prestige.matterShop ?? {})
  return {
    damage,
    defense: 1 + hullBonus * 0.01 + shieldBonus * 0.01,
    industry: metaProductionMultiplier(matter, state.prestige.matterShop, state.prestige.challengeClears),
  }
}

/** Honest Rebuild preview: banked Matter vs spending Edge, vs one Workshop rank. */
export function rebuildPowerPreview(state: GameState, gain: number): {
  now: ReturnType<typeof permanentMultipliers>
  afterBank: ReturnType<typeof permanentMultipliers>
  workshopRank1: number
  edgeRank1: number
  edgeBeatsWorkshop: boolean
} {
  const now = permanentMultipliers(state)
  const afterBank = permanentMultipliers({
    ...state,
    resources: { ...state.resources, prestigeMatter: (state.resources.prestigeMatter ?? 0) + Math.max(0, gain) },
  })
  const workshopRank1 = 1.08
  const edgeRank1 = matterShopRankMultiplier(getMatterShopItem('matter-blade')?.damageBonus ?? 0.15, 1)
  return { now, afterBank, workshopRank1, edgeRank1, edgeBeatsWorkshop: edgeRank1 > workshopRank1 }
}

export function formatRunTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

/** Internal telemetry label. Not shown in player-facing Sortie HUD. */
export function livePressureLabel(state: GameState): string {
  if (state.combat.docked) return 'Docked'
  const hullMax = Math.max(1, state.combat.playerHullMax || 1)
  const hullPct = state.combat.playerHull / hullMax
  if (hullPct <= 0.28) return 'Critical'
  if (state.combat.isBoss) return 'Boss'
  const threat = primaryThreat(ensureSortieStats(state))
  if (threat) return threat
  if (hullPct <= 0.55) return 'Pressure'
  return 'Steady'
}

export function liveBossHp(state: GameState): { hull: number; hullMax: number; shield: number; shieldMax: number } | null {
  if (!state.combat.isBoss) return null
  const bosses = state.combat.enemyUnits.filter((u) => u.isBoss && u.hullMax > 0)
  if (bosses.length === 0) return null
  return {
    hull: bosses.reduce((n, u) => n + Math.max(0, u.hull), 0),
    hullMax: bosses.reduce((n, u) => n + Math.max(0, u.hullMax), 0),
    shield: bosses.reduce((n, u) => n + Math.max(0, u.shield), 0),
    shieldMax: bosses.reduce((n, u) => n + Math.max(0, u.shieldMax), 0),
  }
}

export function coreDps(state: GameState, moduleId: string): number {
  const def = getModule(moduleId)
  if (!def?.weapon) return 0
  const slot = state.shipyard.modules.indexOf(moduleId)
  const out = slot >= 0 ? corePrimaryOutput(state, slot) : null
  if (out?.label === 'DPS') return out.current
  const mastery = moduleMasteryRank(state, moduleId)
  const cooldown = Math.max(0.05, def.weapon.cooldown)
  return moduleWeaponDamage(def, 0, mastery) / cooldown
}

export function coreShieldOutput(state: GameState, moduleId: string): number {
  const def = getModule(moduleId)
  if (!def) return 0
  const slot = state.shipyard.modules.indexOf(moduleId)
  const out = slot >= 0 ? corePrimaryOutput(state, slot) : null
  if (out?.label === 'Shield') return out.current
  const mastery = moduleMasteryRank(state, moduleId)
  const flat = def.shieldBonus ?? 0
  return flat * (1 + mastery * 0.02)
}

export function coreContributionPct(state: GameState, moduleId: string): number | null {
  if (!advancedReadoutsUnlocked(state)) return null
  const fleet = computeShipStats(state).damage
  if (fleet <= 0) return null
  if (!state.shipyard.modules.includes(moduleId)) return 0
  const probe = structuredClone(state)
  probe.shipyard.modules = state.shipyard.modules.filter((id) => id !== moduleId)
  const without = computeShipStats(probe).damage
  return Math.max(0, Math.round(((fleet - without) / fleet) * 100))
}

export function previewLoadoutStats(
  state: GameState,
  frameId: string,
  modules: string[],
) {
  const current = computeShipStats(state)
  const probe = structuredClone(state)
  probe.shipyard.frameId = frameId
  probe.shipyard.modules = modules
  return { current, next: computeShipStats(probe) }
}

export function formatStatShift(current: number, next: number): string {
  const delta = next - current
  const pct = current > 0 ? (100 * delta) / current : next > 0 ? 100 : 0
  const sign = pct >= 0 ? '+' : ''
  return `${formatCompact(current)} → ${formatCompact(next)} (${sign}${pct.toFixed(1)}%)`
}

export function normalizeDamageNumbers(value: unknown): DamageNumbersMode {
  if (value === 'minimal' || value === 'detailed') return value
  return 'standard'
}
