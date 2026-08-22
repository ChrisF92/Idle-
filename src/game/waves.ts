/** GDD wave helpers — Waves are the only combat progression coordinate. */

import { ACT1_FINAL_WAVE } from './cadence'

export const BOSS_WAVE_INTERVAL = 10

export function isAct1ClimaxWave(wave: number): boolean {
  return Math.max(1, Math.floor(wave)) === ACT1_FINAL_WAVE
}

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

/** Career best Wave — Dock / system doors read this, not the live fight sector. */
export function careerBestWave(state: {
  meta?: { bestWave?: number; highestSectorEver?: number }
  combat?: { bestWave?: number; highestSector?: number }
}): number {
  return Math.max(
    0,
    Math.floor(state.meta?.bestWave ?? 0),
    Math.floor(state.combat?.bestWave ?? 0),
    Math.floor(state.meta?.highestSectorEver ?? 0),
    Math.floor(state.combat?.highestSector ?? 0),
  )
}

export function meetsWave(
  state: {
    meta?: { bestWave?: number }
    combat?: { bestWave?: number }
  },
  wave: number,
): boolean {
  return careerBestWave(state) >= wave
}
