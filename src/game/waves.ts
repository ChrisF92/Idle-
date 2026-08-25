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

/** GDD §11–12 introduction bands. Bosses on every 10th Wave stay authored Titans. */
export type GddEnemyBandId =
  | 'basic'
  | 'swarm'
  | 'skirmisher'
  | 'armored'
  | 'shielded'
  | 'sniper'
  | 'support'
  | 'mixed'
  | 'elite'
  | 'complex'
  | 'climax'

export const GDD_ENEMY_BANDS: { min: number; max: number; id: GddEnemyBandId }[] = [
  { min: 1, max: 9, id: 'basic' },
  { min: 10, max: 19, id: 'swarm' },
  { min: 20, max: 39, id: 'skirmisher' },
  { min: 40, max: 69, id: 'armored' },
  { min: 70, max: 99, id: 'shielded' },
  { min: 100, max: 139, id: 'sniper' },
  { min: 140, max: 179, id: 'support' },
  { min: 180, max: 219, id: 'mixed' },
  { min: 220, max: 259, id: 'elite' },
  { min: 260, max: 299, id: 'complex' },
  { min: 300, max: 300, id: 'climax' },
]

export function gddEnemyBandForWave(wave: number): GddEnemyBandId {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1ClimaxWave(w) || w >= ACT1_FINAL_WAVE) return 'climax'
  for (let i = GDD_ENEMY_BANDS.length - 1; i >= 0; i--) {
    const band = GDD_ENEMY_BANDS[i]!
    if (w >= band.min) return band.id
  }
  return 'basic'
}

/** Highest 10-wave band fully cleared (W10 → 1, W20 → 2). */
export function bandsClearedForWave(wave: number): number {
  return Math.max(0, Math.floor(Math.max(0, wave) / BOSS_WAVE_INTERVAL))
}

/** Leftover band lock → career Best Wave. Band 4 (cleared W40) → 40. */
export function waveForClearedBands(bands: number): number {
  return Math.max(0, Math.floor(bands)) * BOSS_WAVE_INTERVAL
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

/**
 * Career best Wave — Dock / system doors and player Best Wave all read this.
 * Leftover `highestSector` fields store 10-wave bands, so a band of 7 is W70.
 */
export function reportedBestWave(state: {
  meta?: { bestWave?: number; highestSectorEver?: number }
  combat?: { bestWave?: number; highestSector?: number }
}): number {
  const explicit = Math.max(
    Math.floor(state.meta?.bestWave ?? 0),
    Math.floor(state.combat?.bestWave ?? 0),
  )
  const fromBands = waveForClearedBands(
    Math.max(state.meta?.highestSectorEver ?? 0, state.combat?.highestSector ?? 0),
  )
  return Math.max(0, explicit, fromBands)
}

/** Alias of `reportedBestWave`. Act 1 gates use career Best Wave, never live sector. */
export function careerBestWave(state: {
  meta?: { bestWave?: number; highestSectorEver?: number }
  combat?: { bestWave?: number; highestSector?: number }
}): number {
  return reportedBestWave(state)
}

export function meetsWave(
  state: {
    meta?: { bestWave?: number; highestSectorEver?: number }
    combat?: { bestWave?: number; highestSector?: number }
  },
  wave: number,
): boolean {
  return careerBestWave(state) >= wave
}
