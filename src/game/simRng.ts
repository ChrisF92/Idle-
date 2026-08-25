/** Serializable deterministic RNG for Sortie combat. */

export interface SimRngState {
  s: number
}

export function createSimRng(seed: number): SimRngState {
  return { s: (Math.floor(seed) >>> 0) || 0x9e3779b9 }
}

export function cloneSimRng(rng: SimRngState): SimRngState {
  return { s: rng.s >>> 0 }
}

/** Uniform [0, 1). Mutates rng. */
export function rngNext(rng: SimRngState): number {
  let t = (rng.s + 0x6d2b79f5) >>> 0
  rng.s = t
  let r = Math.imul(t ^ (t >>> 15), t | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296
}

export function rngFloat(rng: SimRngState, min: number, max: number): number {
  return min + (max - min) * rngNext(rng)
}

export function rngInt(rng: SimRngState, min: number, maxInclusive: number): number {
  const lo = Math.ceil(min)
  const hi = Math.floor(maxInclusive)
  if (hi <= lo) return lo
  return lo + Math.floor(rngNext(rng) * (hi - lo + 1))
}

export function rngPick<T>(rng: SimRngState, items: readonly T[]): T {
  return items[rngInt(rng, 0, items.length - 1)]!
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261
  for (const part of parts) {
    h ^= Math.floor(part) >>> 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
