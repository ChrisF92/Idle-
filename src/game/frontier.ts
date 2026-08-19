/** Frontier Hold, retreat, retry, and combat-specific pacing telemetry. */

import type {
  FrontierIntervention,
  FrontierNotice,
  GameState,
  PressureClass,
  SectorAttemptRecord,
  SectorRoute,
  SteamrollStreak,
} from './types'
import { normalizePushMode, normalizeRoute } from './sectors'
import { classifyPressure, emptySortieRunStats } from './sortieTelemetry'

export { classifyPressure }

const INTERVENTION_LABELS: Partial<Record<string, string>> = {
  core_buy: 'Core levels',
  core_assembled: 'Core assembled',
  core_fitted: 'Core fitted',
  foundry_fitted: 'Foundry module fitted',
  foundry_craft: 'Foundry craft',
  research_break: 'Research breakthrough',
  process_buy: 'Process purchase',
  rebuild: 'Rebuild',
  reinforce: 'Reinforce',
  print_changed: 'Print changed',
  furnace: 'Furnace channel',
  drone: 'Drone allocation',
  reliquary: 'Reliquary',
  specialist: 'Specialist',
  capital: 'Capital',
}

export function emptySectorAttempt(sector: number, route: SectorRoute): SectorAttemptRecord {
  return {
    sector,
    route,
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

export function isFrontierHold(state: GameState): boolean {
  return Boolean(state.combat.frontierHold) && !isChallengeSortie(state)
}

/** Fighting a sector that has not yet been cleared this prestige. */
export function isFrontierCombat(state: GameState): boolean {
  if (isChallengeSortie(state)) return false
  if (state.combat.frontierHold) return false
  if (state.combat.docked) return false
  return state.combat.sector > (state.combat.highestSector ?? 0)
}

export function frontierFallbackSector(failedSector: number, highestSector: number): number {
  const failed = Math.max(1, Math.floor(failedSector))
  const highest = Math.max(0, Math.floor(highestSector))
  if (highest > 0) return Math.min(highest, Math.max(1, failed - 1))
  return 1
}

export function canRetryFrontier(state: GameState): boolean {
  if (isChallengeSortie(state)) return false
  if ((state.combat.defeatLeft ?? 0) > 0) return false
  const target = Math.floor(state.combat.frontierSector ?? 0)
  if (target < 1) return false
  if (!state.combat.frontierHold && state.combat.sector === target && state.combat.inFight) {
    return false
  }
  return true
}

export function ensureSectorAttempt(
  state: GameState,
  sector: number,
  route: SectorRoute = normalizeRoute(state.combat.route),
): SectorAttemptRecord {
  const log = state.playtest
  if (!log.sectorAttempts) log.sectorAttempts = {}
  const key = attemptKey(route, sector)
  const existing = log.sectorAttempts[key]
  if (existing) {
    existing.sector = Math.max(1, Math.floor(sector))
    existing.route = route
    return existing
  }
  const created = emptySectorAttempt(sector, route)
  log.sectorAttempts[key] = created
  return created
}

export function noteFrontierAttemptStart(state: GameState): void {
  if (isChallengeSortie(state)) return
  if (state.combat.frontierHold) return
  if (state.combat.wave !== 1) return
  if (!isFrontierCombat(state) && state.combat.sector <= (state.combat.highestSector ?? 0)) return
  if (state.combat.frontierAttemptOpen) return
  if (state.combat.sector <= (state.combat.highestSector ?? 0)) return
  state.combat.frontierAttemptOpen = true
  const rec = ensureSectorAttempt(state, state.combat.sector, normalizeRoute(state.combat.route))
  rec.attempts += 1
  flushPendingInterventions(state, rec)
}

export function noteFrontierAttemptFail(state: GameState, failedSector: number, route: SectorRoute): void {
  const rec = ensureSectorAttempt(state, failedSector, route)
  rec.failures += 1
  rec.attempts = Math.max(rec.attempts, rec.failures + rec.clears)
  state.combat.frontierAttemptOpen = false
  const stats = state.combat.sortieMark?.stats ?? state.combat.lastSortie?.stats ?? emptySortieRunStats()
  const pressure = classifyPressure(stats, 'defeat')
  rec.lastPressure = pressure
  rec.lastFightMs = Math.max(0, Math.round((stats.finalFightTime ?? 0) * 1000))
  rec.lastEnemyHpPct =
    stats.finalEnemyHpMax > 0 ? Math.round((100 * stats.finalEnemyHp) / stats.finalEnemyHpMax) : 0
  breakOneShotStreak(state)
}

export function isUnclearedFrontierTarget(state: GameState, sector: number): boolean {
  if (isChallengeSortie(state)) return false
  const target = Math.floor(state.combat.frontierSector ?? 0)
  return target > 0 && Math.floor(sector) === target && target > (state.combat.highestSector ?? 0)
}

export function noteFrontierAttemptClear(
  state: GameState,
  clearedSector: number,
  route: SectorRoute,
): { hadFailures: boolean; attempts: number } {
  const rec = ensureSectorAttempt(state, clearedSector, route)
  rec.clears += 1
  rec.attempts = Math.max(rec.attempts, rec.failures + rec.clears)
  const stats = state.combat.sortieMark?.stats ?? emptySortieRunStats()
  rec.successFightMs = Math.max(0, Math.round((stats.finalFightTime ?? 0) * 1000))
  rec.lastFightMs = rec.successFightMs
  rec.lastEnemyHpPct = 0
  rec.lastPressure = 'HEALTHY'
  const oneShot = rec.failures === 0 && rec.attempts <= 1
  const hadFailures = rec.failures > 0
  state.combat.frontierAttemptOpen = false
  if (oneShot) {
    bumpOneShotStreak(state, clearedSector, route)
  } else {
    breakOneShotStreak(state)
  }
  return { hadFailures, attempts: rec.attempts }
}

function bumpOneShotStreak(state: GameState, sector: number, route: SectorRoute): void {
  const log = state.playtest
  if (!log.consecutiveFrontierOneShots) {
    log.steamrollFrom = sector
  }
  log.consecutiveFrontierOneShots = (log.consecutiveFrontierOneShots ?? 0) + 1
  log.bestConsecutiveFrontierOneShots = Math.max(
    log.bestConsecutiveFrontierOneShots ?? 0,
    log.consecutiveFrontierOneShots,
  )
  if (log.consecutiveFrontierOneShots >= 2) {
    log.lastSteamroll = {
      from: log.steamrollFrom || sector,
      to: sector,
      n: log.consecutiveFrontierOneShots,
      route,
    }
  }
}

function breakOneShotStreak(state: GameState): void {
  const log = state.playtest
  log.consecutiveFrontierOneShots = 0
  log.steamrollFrom = 0
}

function flushPendingInterventions(state: GameState, rec: SectorAttemptRecord): void {
  const pending = state.playtest.pendingInterventions ?? []
  if (pending.length === 0) return
  rec.interventions = summarizeInterventions(pending)
  state.playtest.pendingInterventions = []
}

export function summarizeInterventions(items: FrontierIntervention[]): string[] {
  const coreLevels = items.filter((i) => i.k === 'core_buy').length
  const drones = new Map<string, number>()
  const other: string[] = []
  for (const item of items) {
    if (item.k === 'core_buy') continue
    if (item.k === 'drone') {
      const name = item.n ?? 'Drone'
      drones.set(name, (drones.get(name) ?? 0) + (typeof item.v === 'number' ? item.v : 1))
      continue
    }
    const label = INTERVENTION_LABELS[item.k] ?? item.k
    const extra = item.n ? ` ${item.n}` : ''
    const line = `${label}${extra}`.trim()
    if (!other.includes(line)) other.push(line)
  }
  const out: string[] = []
  if (coreLevels > 0) out.push(`Core levels +${coreLevels}`)
  for (const [name, n] of drones) {
    out.push(`${name} drones ${n > 0 ? '+' : ''}${n}`)
  }
  out.push(...other)
  return out.slice(0, 12)
}

export function noteFrontierIntervention(
  state: GameState,
  kind: string,
  opts?: { n?: string; v?: number },
): void {
  if (!isFrontierHold(state) && !(state.combat.frontierSector > 0 && !state.combat.frontierAttemptOpen)) {
    return
  }
  if (!state.playtest.pendingInterventions) state.playtest.pendingInterventions = []
  const bag = state.playtest.pendingInterventions
  bag.push({ k: kind, n: opts?.n, v: opts?.v })
  if (bag.length > 80) bag.splice(0, bag.length - 80)
}

export function addCombatClockMs(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  const ms = Math.floor(dtSeconds * 1000)
  if (ms <= 0) return
  const log = state.playtest
  log.activeCombatMs = (log.activeCombatMs ?? 0) + ms
  if (isChallengeSortie(state)) return
  if (isFrontierCombat(state) || state.combat.frontierAttemptOpen) {
    log.frontierCombatMs = (log.frontierCombatMs ?? 0) + ms
    const rec = ensureSectorAttempt(state, state.combat.sector, normalizeRoute(state.combat.route))
    rec.frontierCombatMs += ms
    return
  }
  if (isFrontierHold(state)) {
    log.retreatFarmMs = (log.retreatFarmMs ?? 0) + ms
    const target = state.combat.frontierSector || state.combat.sector + 1
    const rec = ensureSectorAttempt(state, target, normalizeRoute(state.combat.frontierRoute || state.combat.route))
    rec.retreatFarmMs += ms
  }
}

export function addOfflineCombatMs(state: GameState, ms: number): void {
  if (ms <= 0) return
  const log = state.playtest
  if (state.combat.docked) return
  if (isFrontierHold(state)) {
    log.offlineRetreatFarmMs = (log.offlineRetreatFarmMs ?? 0) + ms
  } else {
    log.offlineCombatMs = (log.offlineCombatMs ?? 0) + ms
  }
}

export function enterFrontierHold(
  state: GameState,
  failedSector: number,
  route: SectorRoute,
): { fallback: number } {
  const fallback = frontierFallbackSector(failedSector, state.combat.highestSector ?? 0)
  state.combat.frontierHold = true
  state.combat.frontierSector = Math.max(1, failedSector)
  state.combat.frontierRoute = route
  state.combat.frontierAttemptOpen = false
  applyPushModeForHold(state)
  return { fallback }
}

function applyPushModeForHold(state: GameState): void {
  // Keep farming the fallback. Do not auto-advance into the failed frontier.
  // Preserve player Hold if they already chose it; otherwise leave pushMode as advance
  // so Retry can resume Advance. Sector increment is gated by frontierHold.
  void state
}

export function clearFrontierHold(state: GameState): void {
  state.combat.frontierHold = false
  state.combat.frontierSector = 0
  state.combat.frontierAttemptOpen = false
  state.playtest.pendingInterventions = []
}

export function convertFrontierHoldToPlayerHold(state: GameState): void {
  state.combat.frontierHold = false
}

export function nextFrontierNotice(
  state: GameState,
  kind: FrontierNotice['kind'],
  sector: number,
  fallback: number,
  first: boolean,
): FrontierNotice {
  const seq = (state.combat.frontierNotice?.seq ?? 0) + 1
  const notice: FrontierNotice = { kind, sector, fallback, first, seq }
  state.combat.frontierNotice = notice
  return notice
}

export function dismissFrontierNotice(state: GameState): GameState {
  if (!state.combat.frontierNotice) return state
  const next = structuredClone(state)
  next.combat.frontierNotice = null
  return next
}

export function hydrateFrontierCombat(raw: GameState['combat']): Pick<
  GameState['combat'],
  'frontierHold' | 'frontierSector' | 'frontierRoute' | 'frontierAttemptOpen' | 'frontierNotice'
> {
  const sector = Math.max(0, Math.floor(Number(raw.frontierSector ?? 0) || 0))
  const notice = hydrateNotice(raw.frontierNotice)
  return {
    frontierHold: raw.frontierHold === true && sector > 0,
    frontierSector: sector,
    frontierRoute: normalizeRoute(raw.frontierRoute ?? raw.route),
    frontierAttemptOpen: raw.frontierAttemptOpen === true,
    frontierNotice: notice,
  }
}

function hydrateNotice(raw: unknown): FrontierNotice | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<FrontierNotice>
  if (src.kind !== 'repelled' && src.kind !== 'cleared') return null
  return {
    kind: src.kind,
    sector: Math.max(1, Math.floor(Number(src.sector ?? 1) || 1)),
    fallback: Math.max(1, Math.floor(Number(src.fallback ?? 1) || 1)),
    first: src.first === true,
    seq: Math.max(0, Math.floor(Number(src.seq ?? 0) || 0)),
  }
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

function isPressure(value: unknown): value is PressureClass {
  return value === 'SURVIVABILITY' || value === 'DAMAGE' || value === 'MIXED' || value === 'HEALTHY'
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

export function playerHoldActive(state: GameState): boolean {
  const mode = normalizePushMode(state.combat.pushMode, state.combat.campaign)
  return mode !== 'advance' && !state.combat.frontierHold
}

export function combatStanceLabel(state: GameState): 'advancing' | 'holding' | 'frontier' {
  if (isChallengeSortie(state)) return 'advancing'
  if (isFrontierHold(state)) return 'frontier'
  if (playerHoldActive(state)) return 'holding'
  return 'advancing'
}
