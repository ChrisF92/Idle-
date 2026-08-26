/** Wave cadence helpers — Waves are the only combat progression coordinate. */

import { ACT1_FINAL_WAVE } from './cadence'

export { ACT1_FINAL_WAVE }

export const BOSS_WAVE_INTERVAL = 50
export const COMMANDER_CANDIDATE_INTERVAL = 10
export const SIGNATURE_BOSS_INTERVAL = 100
export const NORMAL_REINFORCEMENT_INTERVAL = 7
export const ACTIVE_ENEMY_SOFT_CAP = 55
export const BOSS_WARNING_DURATION = 2

export type WaveEncounterKind = 'normal' | 'commander' | 'boss' | 'signature' | 'finale'

export function isCommanderCandidateWave(wave: number): boolean {
  const w = Math.max(0, Math.floor(wave))
  return w > 0 && w % COMMANDER_CANDIDATE_INTERVAL === 0 && w % BOSS_WAVE_INTERVAL !== 0
}

export function isBossWave(wave: number): boolean {
  const w = Math.max(0, Math.floor(wave))
  return w > 0 && w % BOSS_WAVE_INTERVAL === 0
}

export function isSignatureBossWave(wave: number): boolean {
  const w = Math.max(0, Math.floor(wave))
  return w > 0 && w % SIGNATURE_BOSS_INTERVAL === 0
}

export function isAct1FinaleWave(wave: number): boolean {
  return Math.max(1, Math.floor(wave)) === ACT1_FINAL_WAVE
}

export function isAct1ClimaxWave(wave: number): boolean {
  return isAct1FinaleWave(wave)
}

export function waveEncounterKind(wave: number): WaveEncounterKind {
  const w = Math.max(1, Math.floor(wave))
  if (isAct1FinaleWave(w)) return 'finale'
  if (isSignatureBossWave(w)) return 'signature'
  if (isBossWave(w)) return 'boss'
  if (isCommanderCandidateWave(w)) return 'commander'
  return 'normal'
}

/** GDD §11–12 introduction bands. Used for current procedural packs until PR7. */
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
  { min: 260, max: 999, id: 'complex' },
]

export function gddEnemyBandForWave(wave: number): GddEnemyBandId {
  const w = Math.max(1, Math.floor(wave))
  for (let i = GDD_ENEMY_BANDS.length - 1; i >= 0; i--) {
    const band = GDD_ENEMY_BANDS[i]!
    if (w >= band.min) return band.id
  }
  return 'basic'
}

export function reportedBestWave(state: {
  meta?: { bestWave?: number }
  combat?: { bestWave?: number; waveReached?: number }
}): number {
  return Math.max(
    0,
    Math.floor(state.meta?.bestWave ?? 0),
    Math.floor(state.combat?.bestWave ?? 0),
  )
}

export function careerBestWave(state: {
  meta?: { bestWave?: number }
  combat?: { bestWave?: number; waveReached?: number }
}): number {
  return reportedBestWave(state)
}

export function meetsWave(
  state: {
    meta?: { bestWave?: number }
    combat?: { bestWave?: number; waveReached?: number }
  },
  wave: number,
): boolean {
  return careerBestWave(state) >= wave
}
