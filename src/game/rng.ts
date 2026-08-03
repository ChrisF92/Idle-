/** Deterministic 32-bit mulberry32 PRNG. */

export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261 >>> 0
  const str = parts.join(':')
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRng(sectorId: string, wave: number): () => number {
  return mulberry32(hashSeed(sectorId, wave))
}
