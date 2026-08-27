/** Controlled threat budget and Sortie RNG seed. No procedural Elite rarity. */

import type { CombatUnit, GameState } from './types'
import { isAct1ClimaxWave, isBossWave } from './waves'
import { FORMATION_DISPERSION_WEIGHT_MAX } from './hostileSeeds'

export type ThreatDensity = 'sparse' | 'standard' | 'dense'

export interface WaveThreatSpec {
  wave: number
  budget: number
  density: ThreatDensity
  countMin: number
  countMax: number
}

export interface WaveThreatRoll {
  seed: number
  budget: number
  spent: number
  ehp: number
  dps: number
  count: number
  elite: boolean
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261
  for (const part of parts) {
    h ^= Math.floor(part) >>> 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function allocateSortieSeed(state: GameState): number {
  state.meta.sortieSerial = (state.meta.sortieSerial ?? 0) + 1
  const seed = hashSeed(
    0x51e3d7e,
    state.meta.sortieSerial,
    state.prestige.prestigeCount ?? 0,
    state.meta.ascensionCount ?? 0,
  )
  return seed || 1
}

export function threatBudgetForWave(wave: number): number {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1ClimaxWave(w)) return 240
  if (isBossWave(w)) return Math.round(36 + w * 1.05)
  return Math.round(18 + w * 0.94)
}

export function threatSpecForWave(wave: number): WaveThreatSpec {
  const w = Math.max(1, Math.floor(wave))
  const budget = threatBudgetForWave(w)
  if (w < 10) return { wave: w, budget, density: 'sparse', countMin: 2, countMax: 3 }
  if (w < 40) return { wave: w, budget, density: 'standard', countMin: 2, countMax: 5 }
  if (w < 120) return { wave: w, budget, density: 'standard', countMin: 3, countMax: 6 }
  return { wave: w, budget, density: 'dense', countMin: 3, countMax: 6 }
}

export function packEhp(units: CombatUnit[]): number {
  return units.reduce((n, u) => n + u.hullMax + u.shieldMax * 0.85 + u.armor * 6, 0)
}

export function packDps(units: CombatUnit[]): number {
  return units.reduce(
    (n, u) => n + u.weapons.reduce((wSum, w) => wSum + w.damage / Math.max(0.05, w.cooldown), 0),
    0,
  )
}

export function packThreat(units: CombatUnit[]): number {
  return packEhp(units) / 12 + packDps(units) * 2.4
}

export function measureThreatRoll(units: CombatUnit[], seed: number, budget: number, elite = false): WaveThreatRoll {
  return {
    seed,
    budget,
    spent: Math.round(packThreat(units)),
    ehp: packEhp(units),
    dps: packDps(units),
    count: units.length,
    elite,
  }
}

export function rescalePack(units: CombatUnit[], targetEhp: number, targetDps: number): void {
  const ehp = packEhp(units)
  const dps = packDps(units)
  const ehpMult = ehp > 0 ? targetEhp / ehp : 1
  const dpsMult = dps > 0 ? targetDps / dps : 1
  for (const unit of units) {
    const hullRatio = unit.hullMax > 0 ? unit.hull / unit.hullMax : 1
    const shieldRatio = unit.shieldMax > 0 ? unit.shield / unit.shieldMax : 0
    unit.hullMax = Math.max(1, unit.hullMax * ehpMult)
    unit.hull = Math.max(0, unit.hullMax * hullRatio)
    unit.shieldMax = unit.shieldMax * ehpMult
    unit.shield = unit.shieldMax * shieldRatio
    for (const weapon of unit.weapons) weapon.damage *= dpsMult
  }
}

/**
 * Narrow count jitter only. No procedural Elite prefix or stat mutation.
 */
export function varyPackToBudget(
  canonical: CombatUnit[],
  spec: WaveThreatSpec,
  seed: number,
): { units: CombatUnit[]; elite: boolean } {
  if (seed === 0 || spec.wave < 11 || isBossWave(spec.wave) || isAct1ClimaxWave(spec.wave)) {
    return { units: canonical, elite: false }
  }
  const rng = mulberry32(hashSeed(seed, spec.wave, 17))
  const units = canonical.map((u) => structuredClone(u))
  const extras = units.filter((u) => !u.isBoss && !u.isCommander)
  const want = spec.countMin + Math.floor(rng() * (spec.countMax - spec.countMin + 1))
  if (extras.length > 0 && want > extras.length) {
    const missing = want - extras.length
    for (let i = 0; i < missing; i++) {
      const src = extras[i % extras.length]!
      const clone = structuredClone(src)
      clone.id = `${src.id}-v${i}`
      clone.rewardWeight = Math.min(0.4, (src.rewardWeight ?? 1) * 0.35)
      units.push(clone)
    }
  } else if (extras.length > spec.countMin && want < extras.length) {
    const drop = extras.length - Math.max(spec.countMin, want)
    let removed = 0
    for (let i = units.length - 1; i >= 0 && removed < drop; i--) {
      if (units[i]?.isBoss || units[i]?.isCommander) continue
      if (units.filter((u) => !u.isBoss && !u.isCommander).length <= spec.countMin) break
      units.splice(i, 1)
      removed += 1
    }
  }
  rescalePack(units, packEhp(canonical), packDps(canonical))
  return { units, elite: false }
}

export const DISPERSION_WEIGHT_CAP = FORMATION_DISPERSION_WEIGHT_MAX
