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

export function isCommanderWave(wave: number): boolean {
  return isCommanderCandidateWave(wave)
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
