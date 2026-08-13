/** Sector length as a short wave gauntlet + boss. Replaces USI’s distance bar. */

/** Trash/mixed waves before the sector boss. */
export function trashWavesForSector(sector: number): number {
  const n = Math.max(1, Math.floor(sector))
  if (n <= 1) return 2
  if (n <= 8) return 3
  return 4
}

/** Total waves to clear a sector (trash + boss). */
export function wavesForSector(sector: number): number {
  return trashWavesForSector(sector) + 1
}

export function isSectorBossWave(sector: number, wave: number): boolean {
  return wave >= wavesForSector(sector)
}

/**
 * Legacy alias used by older tests / loops.
 * Prefer `wavesForSector(sector)` — length is not uniform.
 */
export const WAVES_PER_SECTOR = 5
