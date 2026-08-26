/** GDD §10 — controlled threat budget and Sortie RNG seed. */

import type { CombatUnit, GameState } from './types'
import {
  gddEnemyBandForWave,
  isAct1ClimaxWave,
  isBossWave,
  type GddEnemyBandId,
} from './waves'

export type ThreatDensity = 'sparse' | 'standard' | 'dense'

export interface WaveThreatSpec {
  wave: number
  budget: number
  band: GddEnemyBandId
  primary: GddEnemyBandId
  secondary: GddEnemyBandId[]
  density: ThreatDensity
  eliteChance: number
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

/**
 * Mint a new stable Sortie seed from the account's persistent Sortie serial.
 * Tests may inject `combat.sortieSeed` before launch; live Sorties always call this.
 */
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

/** GDD Wave 87 example is budget 100. Linear from a small W1 floor. */
export function threatBudgetForWave(wave: number): number {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1ClimaxWave(w)) return 240
  if (isBossWave(w)) return Math.round(36 + w * 1.05)
  return Math.round(18 + w * 0.94)
}

export function threatSpecForWave(wave: number): WaveThreatSpec {
  const w = Math.max(1, Math.floor(wave))
  const band = gddEnemyBandForWave(w)
  const budget = threatBudgetForWave(w)
  switch (band) {
    case 'basic':
      return spec(w, budget, band, [], 'sparse', 0, 2, 3)
    case 'swarm':
      return spec(w, budget, band, ['basic'], 'dense', 0.08, 4, 8)
    case 'skirmisher':
      return spec(w, budget, band, ['swarm'], 'standard', 0.1, 3, 6)
    case 'armored':
      return spec(w, budget, band, ['skirmisher'], 'standard', 0.12, 3, 6)
    case 'shielded':
      return spec(w, budget, band, ['armored'], 'standard', 0.12, 3, 5)
    case 'sniper':
      return spec(w, budget, band, ['skirmisher'], 'sparse', 0.14, 2, 5)
    case 'support':
      return spec(w, budget, band, ['shielded', 'swarm'], 'standard', 0.14, 3, 6)
    case 'mixed':
      return spec(w, budget, band, ['armored', 'swarm', 'skirmisher'], 'dense', 0.18, 4, 8)
    case 'elite':
      return spec(w, budget, band, ['mixed', 'armored'], 'standard', 0.35, 3, 6)
    case 'complex':
      return spec(w, budget, band, ['elite', 'support', 'sniper'], 'dense', 0.28, 5, 8)
  }
}

function spec(
  wave: number,
  budget: number,
  band: GddEnemyBandId,
  secondary: GddEnemyBandId[],
  density: ThreatDensity,
  eliteChance: number,
  countMin: number,
  countMax: number,
): WaveThreatSpec {
  return { wave, budget, band, primary: band, secondary, density, eliteChance, countMin, countMax }
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

export function measureThreatRoll(units: CombatUnit[], seed: number, budget: number, elite: boolean): WaveThreatRoll {
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
 * Controlled variation: jitter count and maybe mark an elite, then lock EHP/DPS
 * back to the canonical pack so two seeds stay comparable.
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
  const extras = units.filter((u) => !u.isBoss)
  const want = spec.countMin + Math.floor(rng() * (spec.countMax - spec.countMin + 1))
  if (extras.length > 0 && want > extras.length) {
    const missing = want - extras.length
    for (let i = 0; i < missing; i++) {
      const src = extras[i % extras.length]!
      const clone = structuredClone(src)
      clone.id = `${src.id}-v${i}`
      clone.name = `${src.name} ${i + 2}`
      clone.rewardWeight = Math.min(0.4, (src.rewardWeight ?? 1) * 0.35)
      units.push(clone)
    }
  } else if (extras.length > spec.countMin && want < extras.length) {
    const drop = extras.length - Math.max(spec.countMin, want)
    let removed = 0
    for (let i = units.length - 1; i >= 0 && removed < drop; i--) {
      if (units[i]?.isBoss) continue
      if (units.filter((u) => !u.isBoss).length <= spec.countMin) break
      units.splice(i, 1)
      removed += 1
    }
  }

  let elite = false
  if (rng() < spec.eliteChance) {
    const fodder = units.filter((u) => !u.isBoss)
    const pick = fodder[Math.floor(rng() * fodder.length)]
    if (pick) {
      elite = true
      pick.name = pick.name.startsWith('Elite ') ? pick.name : `Elite ${pick.name}`
      pick.hullMax *= 1.35
      pick.hull = pick.hullMax
      pick.shieldMax *= 1.15
      pick.shield = pick.shieldMax
      pick.armor += 1
    }
  }

  rescalePack(units, packEhp(canonical), packDps(canonical))
  return { units, elite }
}
