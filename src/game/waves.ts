/** GDD wave helpers — Waves are the only combat progression coordinate. */

export const BOSS_WAVE_INTERVAL = 10

/** Each 10-wave band maps onto one legacy sector of authored encounters / scaling. */
export function powerSectorForWave(wave: number): number {
  return Math.max(1, Math.ceil(Math.max(1, Math.floor(wave)) / BOSS_WAVE_INTERVAL))
}

/** 1..10 position inside the current band. */
export function waveInBand(wave: number): number {
  const w = Math.max(1, Math.floor(wave))
  const n = w % BOSS_WAVE_INTERVAL
  return n === 0 ? BOSS_WAVE_INTERVAL : n
}

export function isBossWave(wave: number): boolean {
  const w = Math.max(1, Math.floor(wave))
  return w % BOSS_WAVE_INTERVAL === 0
}

/** Highest 10-wave band fully cleared (W10 → 1, W20 → 2). */
export function bandsClearedForWave(wave: number): number {
  return Math.max(0, Math.floor(Math.max(0, wave) / BOSS_WAVE_INTERVAL))
}

/** Global Wave for a legacy power-sector band (localWave 1–10). */
export function waveForBand(sector: number, localWave = 1): number {
  const s = Math.max(1, Math.floor(sector))
  const local = Math.min(BOSS_WAVE_INTERVAL, Math.max(1, Math.floor(localWave)))
  return (s - 1) * BOSS_WAVE_INTERVAL + local
}

export function bossWaveForBand(sector: number): number {
  return waveForBand(sector, BOSS_WAVE_INTERVAL)
}
