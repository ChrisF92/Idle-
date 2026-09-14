/** Deterministic ordinary-Wave spawn checks and eligible-hostile weighting. */

import type { GameState } from './types'
import type { HostileDef } from './hostileCatalogue'
import { firstContactHostile, introducedHostiles } from './hostileCatalogue'
import { DISRUPTOR_CAP_PER_PACKAGE, SUPPORT_CAP_PER_PACKAGE } from './hostileSeeds'
import { createSimRng, hashSeed, rngNext, type SimRngState } from './simRng'

export const SPAWN_CHECK_INTERVAL = 0.5
export const ORDINARY_SPAWN_WINDOW = 6.5
export const SPAWN_DIRECTOR_CHANNEL = 0x5a11ce
export const ORDINARY_SPAWN_MAX = 10

export interface WeightedHostile {
  def: HostileDef
  weight: number
}

export interface OrdinarySpawnPlan {
  /** Expected successful checks during one ordinary Wave interval. */
  spawnRate: number
  checkCount: number
  offsets: number[]
  defs: HostileDef[]
  weights: Array<{ hostileId: string; weight: number }>
}

export function allocateSortieSeed(state: GameState): number {
  state.meta.sortieSerial = (state.meta.sortieSerial ?? 0) + 1
  const seed = hashSeed(0x51e3d7e, state.meta.sortieSerial, state.prestige.prestigeCount ?? 0)
  return seed || 1
}

/**
 * Expected ordinary spawns per seven-second Wave. Count pressure rises smoothly
 * from roughly 3 at W1 to 6 at W1000; unit stats keep their authored curves.
 */
export function ordinarySpawnRate(wave: number): number {
  const w = Math.max(1, Math.min(1000, Math.floor(wave)))
  const progress = (w - 1) / 999
  return 3 + 3 * Math.pow(progress, 0.35)
}

/** New contacts are common, established contacts taper, and authored elites stay rare. */
export function hostileSpawnWeight(def: HostileDef, wave: number): number {
  const age = Math.max(0, Math.floor(wave) - def.firstContactWave)
  let weight = age < 60 ? 12 : age < 150 ? 8 : age < 300 ? 4 : 2
  if (def.role === 'elite') weight *= 0.2
  return weight
}

export function eligibleSpawnWeights(wave: number): WeightedHostile[] {
  return introducedHostiles(wave)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((def) => ({ def, weight: hostileSpawnWeight(def, wave) }))
    .filter((row) => row.weight > 0)
}

function weightedPick(rng: SimRngState, rows: readonly WeightedHostile[]): HostileDef {
  const total = rows.reduce((sum, row) => sum + row.weight, 0)
  let roll = rngNext(rng) * total
  for (const row of rows) {
    roll -= row.weight
    if (roll <= 0) return row.def
  }
  return rows[rows.length - 1]!.def
}

function withinCategoryCaps(picks: readonly HostileDef[], candidate: HostileDef): boolean {
  if (candidate.category === 'support') {
    return picks.filter((def) => def.category === 'support').length < SUPPORT_CAP_PER_PACKAGE
  }
  if (candidate.category === 'disruptor') {
    return picks.filter((def) => def.category === 'disruptor').length < DISRUPTOR_CAP_PER_PACKAGE
  }
  return true
}

function fillWeightedPicks(
  rng: SimRngState,
  rows: readonly WeightedHostile[],
  count: number,
  guaranteed?: HostileDef,
): HostileDef[] {
  const picks: HostileDef[] = guaranteed ? [guaranteed] : []
  let guard = 0
  while (picks.length < count && rows.length > 0 && guard < count * 20) {
    guard += 1
    const candidate = weightedPick(rng, rows)
    if (withinCategoryCaps(picks, candidate)) picks.push(candidate)
  }
  while (picks.length < count && rows.length > 0) {
    const fallback = rows.find((row) => withinCategoryCaps(picks, row.def))
    if (!fallback) break
    picks.push(fallback.def)
  }
  return picks
}

function successfulCheckOffsets(rng: SimRngState, spawnRate: number): number[] {
  const checkCount = Math.floor(ORDINARY_SPAWN_WINDOW / SPAWN_CHECK_INTERVAL) + 1
  const chance = Math.min(0.9, Math.max(0, spawnRate / checkCount))
  const offsets: number[] = []
  for (let i = 0; i < checkCount; i += 1) {
    if (rngNext(rng) < chance) offsets.push(i * SPAWN_CHECK_INTERVAL)
  }
  // Every Wave makes immediate contact and the early game retains a readable pair.
  if (!offsets.includes(0)) offsets.unshift(0)
  if (offsets.length < 2) offsets.push(SPAWN_CHECK_INTERVAL)
  return [...new Set(offsets)].sort((a, b) => a - b).slice(0, ORDINARY_SPAWN_MAX)
}

function deploymentWindowForWave(wave: number): number {
  if (wave <= 1) return 1
  if (wave < 10) return 1 + ((wave - 1) / 9) * 2
  if (wave < 30) return 3 + ((wave - 10) / 20) * 3.5
  return ORDINARY_SPAWN_WINDOW
}

export function ordinarySpawnPlan(opts: {
  wave: number
  sortieSeed: number
  packageOrdinal: number
  spawnRateMultiplier?: number
  countDelta?: number
}): OrdinarySpawnPlan {
  const wave = Math.max(1, Math.floor(opts.wave))
  const rng = createSimRng(
    hashSeed(opts.sortieSeed >>> 0, wave, Math.max(1, opts.packageOrdinal), SPAWN_DIRECTOR_CHANNEL),
  )
  const spawnRate = ordinarySpawnRate(wave) * Math.max(0.1, opts.spawnRateMultiplier ?? 1)
  let offsets = successfulCheckOffsets(rng, spawnRate)
  // W1 is a single immediate tutorial contact; repeated checks begin at W2.
  if (wave === 1) offsets = [0]
  const countDelta = Math.trunc(opts.countDelta ?? 0)
  if (countDelta > 0) {
    for (let i = 0; i < countDelta && offsets.length < ORDINARY_SPAWN_MAX; i += 1) {
      const offset = Math.min(ORDINARY_SPAWN_WINDOW, (offsets.length + 1) * SPAWN_CHECK_INTERVAL)
      offsets.push(offset)
    }
  } else if (countDelta < 0) {
    offsets = offsets.slice(0, Math.max(1, offsets.length + countDelta))
  }
  const deploymentWindow = deploymentWindowForWave(wave)
  offsets = [...new Set(offsets)]
    .sort((a, b) => a - b)
    .map((offset) => offset * (deploymentWindow / ORDINARY_SPAWN_WINDOW))
  const weighted = eligibleSpawnWeights(wave)
  const guaranteed = firstContactHostile(wave)
  const defs = fillWeightedPicks(rng, weighted, offsets.length, guaranteed)
  offsets = offsets.slice(0, defs.length)
  return {
    spawnRate,
    checkCount: Math.floor(ORDINARY_SPAWN_WINDOW / SPAWN_CHECK_INTERVAL) + 1,
    offsets,
    defs,
    weights: weighted.map((row) => ({ hostileId: row.def.id, weight: row.weight })),
  }
}
