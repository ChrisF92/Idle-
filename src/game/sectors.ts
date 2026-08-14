/** Sector length as a short wave gauntlet + boss. Replaces USI’s distance bar. */

import type { SectorRoute } from './types'

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

/** B-side opens when sector 8 is cleared (entering 9). */
export const ROUTE_B_UNLOCK_CLEARED = 8

export function normalizeRoute(route: string | undefined | null): SectorRoute {
  return route === 'B' ? 'B' : 'A'
}

export function isRouteBUnlocked(clearedSector: number): boolean {
  return clearedSector >= ROUTE_B_UNLOCK_CLEARED
}

export function routeDangerMult(route: SectorRoute): number {
  return route === 'B' ? 1.28 : 1
}

export function routeSalvageMult(route: SectorRoute): number {
  return route === 'B' ? 1.2 : 1
}

export function routeResearchMult(route: SectorRoute): number {
  return route === 'B' ? 1.15 : 1
}

/** Highest sector you can Launch into (cleared, or the next one). */
export function maxLaunchSector(clearedSector: number): number {
  const cleared = Math.max(0, Math.floor(clearedSector))
  if (cleared <= 0) return 1
  return cleared + 1
}
