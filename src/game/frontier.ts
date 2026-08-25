/** Challenge-sortie helpers and leftover playtest hydration. Hold/Retreat combat is removed. */

import type {
  FrontierIntervention,
  GameState,
  PressureClass,
  SectorAttemptRecord,
  SectorRoute,
  SteamrollStreak,
} from './types'
import { classifyPressure } from './sortieTelemetry'

export { classifyPressure }

function normalizeRoute(_route?: string | null): SectorRoute {
  return 'A'
}

export function emptySectorAttempt(sector: number, route: SectorRoute): SectorAttemptRecord {
  return {
    sector: Math.max(1, Math.floor(sector)),
    route: normalizeRoute(route),
    attempts: 0,
    failures: 0,
    clears: 0,
    frontierCombatMs: 0,
    retreatFarmMs: 0,
    lastPressure: '',
    lastEnemyHpPct: 0,
    lastFightMs: 0,
    successFightMs: 0,
    interventions: [],
  }
}

export function attemptKey(route: SectorRoute | string, sector: number): string {
  return `${normalizeRoute(route)}:${Math.max(1, Math.floor(sector))}`
}

export function isChallengeSortie(state: GameState): boolean {
  return Boolean(state.protocols?.activeId || state.echo?.activeId)
}

export function isFrontierHold(_state: GameState): boolean {
  return false
}

export function isFrontierCombat(_state: GameState): boolean {
  return false
}

export function canRetryFrontier(_state: GameState): boolean {
  return false
}

export function playerHoldActive(_state: GameState): boolean {
  return false
}

export function combatStanceLabel(_state: GameState): 'advancing' | 'holding' | 'frontier' {
  return 'advancing'
}

export function noteFrontierIntervention(
  _state: GameState,
  _kind: string,
  _opts?: { n?: string; v?: number },
): void {}

export function addCombatClockMs(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  const ms = Math.floor(dtSeconds * 1000)
  if (ms <= 0) return
  state.playtest.activeCombatMs = (state.playtest.activeCombatMs ?? 0) + ms
}

export function addOfflineCombatMs(state: GameState, ms: number): void {
  if (ms <= 0) return
  if (state.combat.docked) return
  state.playtest.offlineCombatMs = (state.playtest.offlineCombatMs ?? 0) + ms
}

export function dismissFrontierNotice(state: GameState): GameState {
  return state
}

function isPressure(value: unknown): value is PressureClass {
  return value === 'SURVIVABILITY' || value === 'DAMAGE' || value === 'MIXED' || value === 'HEALTHY'
}

export function hydrateSectorAttempts(raw: unknown): Record<string, SectorAttemptRecord> {
  const out: Record<string, SectorAttemptRecord> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, Partial<SectorAttemptRecord>>)) {
    if (!key || !value || typeof value !== 'object') continue
    const sector = Math.max(1, Math.floor(Number(value.sector ?? key.split(':')[1] ?? 1) || 1))
    const route = normalizeRoute(value.route ?? key.split(':')[0])
    out[key] = {
      sector,
      route,
      attempts: Math.max(0, Math.floor(Number(value.attempts ?? 0) || 0)),
      failures: Math.max(0, Math.floor(Number(value.failures ?? 0) || 0)),
      clears: Math.max(0, Math.floor(Number(value.clears ?? 0) || 0)),
      frontierCombatMs: Math.max(0, Math.floor(Number(value.frontierCombatMs ?? 0) || 0)),
      retreatFarmMs: Math.max(0, Math.floor(Number(value.retreatFarmMs ?? 0) || 0)),
      lastPressure: isPressure(value.lastPressure) ? value.lastPressure : '',
      lastEnemyHpPct: Math.max(0, Math.floor(Number(value.lastEnemyHpPct ?? 0) || 0)),
      lastFightMs: Math.max(0, Math.floor(Number(value.lastFightMs ?? 0) || 0)),
      successFightMs: Math.max(0, Math.floor(Number(value.successFightMs ?? 0) || 0)),
      interventions: Array.isArray(value.interventions)
        ? value.interventions.filter((s): s is string => typeof s === 'string').slice(0, 12)
        : [],
    }
  }
  return out
}

export function hydrateSteamroll(raw: unknown): SteamrollStreak | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<SteamrollStreak>
  const n = Math.max(0, Math.floor(Number(src.n ?? 0) || 0))
  if (n < 2) return null
  return {
    from: Math.max(1, Math.floor(Number(src.from ?? 1) || 1)),
    to: Math.max(1, Math.floor(Number(src.to ?? 1) || 1)),
    n,
    route: normalizeRoute(src.route),
  }
}

export function hydrateInterventions(raw: unknown): FrontierIntervention[] {
  if (!Array.isArray(raw)) return []
  const out: FrontierIntervention[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const src = item as FrontierIntervention
    if (typeof src.k !== 'string' || !src.k) continue
    const row: FrontierIntervention = { k: src.k.slice(0, 40) }
    if (typeof src.n === 'string' && src.n) row.n = src.n.slice(0, 40)
    if (typeof src.v === 'number' && Number.isFinite(src.v)) row.v = src.v
    out.push(row)
  }
  return out.slice(-80)
}
