/** Local playtest event log — device-only, compact, manually exportable. */

import type { GameState, PlaytestEvent, PlaytestEventKind, PlaytestState } from './types'
import { WORKER_JOB_IDS } from './workers'
import {
  hydrateInterventions,
  hydrateSectorAttempts,
  hydrateSteamroll,
  summarizeInterventions,
} from './frontier'

export const PLAYTEST_VERSION = 1 as const
export const PLAYTEST_MAX_EVENTS = 400

const DRONE_LABELS: Record<string, string> = {
  'scrap-field': 'Scrap Field',
  'power-grid': 'Power Grid',
  'sensor-net': 'Sensor Net',
  'alloy-foundry': 'Alloy Foundry',
  'repair-bay': 'Repair Bay',
  'drone-fab': 'Drone Fabricator',
  'fab-bay': 'Fabrication Bay',
  construction: 'Construction',
  strike: 'Strike',
  ward: 'Ward',
  yield: 'Yield',
  loom: 'Loom',
  archive: 'Archive',
}

export function createEmptyPlaytest(now = Date.now()): PlaytestState {
  return {
    v: PLAYTEST_VERSION,
    startedAt: now,
    playtimeMs: 0,
    sessionAt: now,
    sessionPlaytimeMs: 0,
    firsts: {},
    sectorAt: 0,
    sectorAtPlaytime: 0,
    events: [],
    cores: [],
    protocols: {},
    echos: {},
    drones: {},
    activeCombatMs: 0,
    frontierCombatMs: 0,
    retreatFarmMs: 0,
    offlineCombatMs: 0,
    offlineRetreatFarmMs: 0,
    consecutiveFrontierOneShots: 0,
    bestConsecutiveFrontierOneShots: 0,
    steamrollFrom: 0,
    lastSteamroll: null,
    sectorAttempts: {},
    pendingInterventions: [],
  }
}

export function hydratePlaytest(raw: unknown, now = Date.now()): PlaytestState {
  const empty = createEmptyPlaytest(now)
  if (!raw || typeof raw !== 'object') return empty
  const src = raw as Partial<PlaytestState>
  const firsts: Record<string, number> = {}
  if (src.firsts && typeof src.firsts === 'object' && !Array.isArray(src.firsts)) {
    for (const [key, value] of Object.entries(src.firsts)) {
      const n = Math.floor(Number(value))
      if (key && Number.isFinite(n) && n >= 0) firsts[key] = n
    }
  }
  const events: PlaytestEvent[] = []
  if (Array.isArray(src.events)) {
    for (const event of src.events) {
      const parsed = parseEvent(event)
      if (parsed) events.push(parsed)
    }
  }
  return {
    v: PLAYTEST_VERSION,
    startedAt: Math.max(0, Math.floor(Number(src.startedAt ?? now)) || now),
    playtimeMs: Math.max(0, Math.floor(Number(src.playtimeMs ?? 0)) || 0),
    sessionAt: Math.max(0, Math.floor(Number(src.sessionAt ?? now)) || now),
    sessionPlaytimeMs: Math.max(0, Math.floor(Number(src.sessionPlaytimeMs ?? 0)) || 0),
    firsts,
    sectorAt: Math.max(0, Math.floor(Number(src.sectorAt ?? 0)) || 0),
    sectorAtPlaytime: Math.max(0, Math.floor(Number(src.sectorAtPlaytime ?? 0)) || 0),
    events: events.slice(-PLAYTEST_MAX_EVENTS),
    cores: Array.isArray(src.cores)
      ? src.cores.filter((n): n is string => typeof n === 'string' && n.length > 0).slice(0, 40)
      : [],
    protocols: hydrateAttemptMap(src.protocols),
    echos: hydrateAttemptMap(src.echos),
    drones: hydrateNumberMap(src.drones),
    activeCombatMs: Math.max(0, Math.floor(Number(src.activeCombatMs ?? 0) || 0)),
    frontierCombatMs: Math.max(0, Math.floor(Number(src.frontierCombatMs ?? 0) || 0)),
    retreatFarmMs: Math.max(0, Math.floor(Number(src.retreatFarmMs ?? 0) || 0)),
    offlineCombatMs: Math.max(0, Math.floor(Number(src.offlineCombatMs ?? 0) || 0)),
    offlineRetreatFarmMs: Math.max(0, Math.floor(Number(src.offlineRetreatFarmMs ?? 0) || 0)),
    consecutiveFrontierOneShots: Math.max(
      0,
      Math.floor(Number(src.consecutiveFrontierOneShots ?? 0) || 0),
    ),
    bestConsecutiveFrontierOneShots: Math.max(
      0,
      Math.floor(Number(src.bestConsecutiveFrontierOneShots ?? 0) || 0),
    ),
    steamrollFrom: Math.max(0, Math.floor(Number(src.steamrollFrom ?? 0) || 0)),
    lastSteamroll: hydrateSteamroll(src.lastSteamroll),
    sectorAttempts: hydrateSectorAttempts(src.sectorAttempts),
    pendingInterventions: hydrateInterventions(src.pendingInterventions),
  }
}

function hydrateAttemptMap(raw: unknown): Record<string, { a: number; c: number }> {
  const out: Record<string, { a: number; c: number }> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, value] of Object.entries(raw as Record<string, { a?: unknown; c?: unknown }>)) {
    if (!id || !value || typeof value !== 'object') continue
    out[id] = {
      a: Math.max(0, Math.floor(Number(value.a ?? 0)) || 0),
      c: Math.max(0, Math.floor(Number(value.c ?? 0)) || 0),
    }
  }
  return out
}

function hydrateNumberMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (!id || !Number.isFinite(n) || n <= 0) continue
    out[id] = n
  }
  return out
}

function parseEvent(raw: unknown): PlaytestEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<PlaytestEvent>
  if (typeof src.k !== 'string' || !src.k) return null
  const t = Math.max(0, Math.floor(Number(src.t ?? 0)) || 0)
  const event: PlaytestEvent = { t, k: src.k as PlaytestEventKind }
  if (typeof src.n === 'string' && src.n) event.n = src.n.slice(0, 80)
  if (typeof src.v === 'string') event.v = src.v.slice(0, 40)
  else if (typeof src.v === 'number' && Number.isFinite(src.v)) event.v = src.v
  else if (typeof src.v === 'boolean') event.v = src.v
  return event
}

export function ensurePlaytest(state: GameState, now = Date.now()): PlaytestState {
  if (!state.playtest) state.playtest = createEmptyPlaytest(now)
  return state.playtest
}

export function hasFirst(state: GameState, key: string): boolean {
  return ensurePlaytest(state).firsts[key] != null
}

export function stampFirst(state: GameState, key: string): boolean {
  const log = ensurePlaytest(state)
  if (log.firsts[key] != null) return false
  log.firsts[key] = log.playtimeMs
  return true
}

export function recordPlaytest(
  state: GameState,
  kind: PlaytestEventKind,
  opts?: { n?: string; v?: string | number | boolean; firstKey?: string },
): boolean {
  const log = ensurePlaytest(state)
  const firstKey = opts?.firstKey
  if (firstKey && log.firsts[firstKey] != null) return false
  const t = log.playtimeMs
  if (firstKey) log.firsts[firstKey] = t
  const event: PlaytestEvent = { t, k: kind }
  if (opts?.n) event.n = opts.n.slice(0, 80)
  if (opts?.v !== undefined) event.v = opts.v
  log.events.push(event)
  if (log.events.length > PLAYTEST_MAX_EVENTS) {
    log.events.splice(0, log.events.length - PLAYTEST_MAX_EVENTS)
  }
  if (
    INTERVENTION_KINDS.has(kind) &&
    state.combat &&
    (state.combat.frontierHold ||
      ((state.combat.frontierSector ?? 0) > 0 && !state.combat.frontierAttemptOpen))
  ) {
    if (!log.pendingInterventions) log.pendingInterventions = []
    log.pendingInterventions.push({
      k: kind,
      n: opts?.n,
      v: typeof opts?.v === 'number' ? opts.v : undefined,
    })
    if (log.pendingInterventions.length > 80) {
      log.pendingInterventions.splice(0, log.pendingInterventions.length - 80)
    }
  }
  return true
}

const INTERVENTION_KINDS = new Set<PlaytestEventKind>([
  'core_buy',
  'core_assembled',
  'core_fitted',
  'print_changed',
  'foundry_craft',
  'foundry_fitted',
  'research_break',
  'process_buy',
  'rebuild',
  'reinforce',
  'specialist',
  'capital',
  'system_action',
])

export function noteSystemAction(state: GameState, system: string, label?: string): boolean {
  return recordPlaytest(state, 'system_action', {
    n: label ?? system,
    firstKey: `act:${system}`,
  })
}

export function noteSystemOpen(state: GameState, system: string): boolean {
  return recordPlaytest(state, 'system_open', {
    n: system,
    firstKey: `open:${system}`,
  })
}

export function noteSessionStart(state: GameState, now = Date.now()): void {
  const log = ensurePlaytest(state, now)
  log.sessionAt = now
  log.sessionPlaytimeMs = log.playtimeMs
  recordPlaytest(state, 'session_start', {
    n: `S${Math.max(state.combat?.highestSector ?? 0, state.meta?.highestSectorEver ?? 0)}`,
    v: log.playtimeMs,
  })
}

export function noteSessionEnd(state: GameState): void {
  const log = ensurePlaytest(state)
  const last = log.events[log.events.length - 1]
  if (last?.k === 'session_end') return
  recordPlaytest(state, 'session_end', {
    n: `S${Math.max(state.combat?.highestSector ?? 0, state.meta?.highestSectorEver ?? 0)}`,
    v: log.playtimeMs,
  })
}

export function addPlaytime(state: GameState, ms: number): void {
  if (ms <= 0) return
  ensurePlaytest(state).playtimeMs += Math.floor(ms)
}

export function sampleDroneAllocation(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  const log = ensurePlaytest(state)
  const assignments = state.base?.assignments
  if (!assignments) return
  for (const id of WORKER_JOB_IDS) {
    const n = assignments[id] ?? 0
    if (n <= 0) continue
    log.drones[id] = (log.drones[id] ?? 0) + n * dtSeconds
  }
}

export function noteHighestSector(state: GameState, sector: number): void {
  const log = ensurePlaytest(state)
  const next = Math.max(0, Math.floor(sector))
  if (next <= log.sectorAt) return
  log.sectorAt = next
  log.sectorAtPlaytime = log.playtimeMs
  recordPlaytest(state, 'highest_sector', { n: `S${next}`, v: next, firstKey: `sector:${next}` })
}

export function noteAttempt(
  state: GameState,
  kind: 'protocol' | 'echo',
  id: string,
  result: 'start' | 'end' | 'clear',
  name?: string,
): void {
  const log = ensurePlaytest(state)
  const bag = kind === 'protocol' ? log.protocols : log.echos
  if (!bag[id]) bag[id] = { a: 0, c: 0 }
  if (result === 'start') bag[id].a += 1
  if (result === 'clear') bag[id].c += 1
  const eventKind =
    kind === 'protocol'
      ? result === 'start'
        ? 'protocol_start'
        : result === 'clear'
          ? 'protocol_clear'
          : 'protocol_end'
      : result === 'start'
        ? 'echo_start'
        : result === 'clear'
          ? 'echo_clear'
          : 'echo_end'
  recordPlaytest(state, eventKind, { n: name ?? id })
}

export function noteAssembledCore(state: GameState, name: string): void {
  const log = ensurePlaytest(state)
  if (!log.cores.includes(name)) log.cores.push(name)
  recordPlaytest(state, 'core_assembled', { n: name, firstKey: `core_assembled:${name}` })
}

export function formatPlaytimeMs(ms: number, style: 'long' | 'clock' = 'long'): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (style === 'clock') {
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  if (h > 0) return s > 0 ? `${h}h ${m}m ${String(s).padStart(2, '0')}s` : `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function saveAgeMs(state: GameState, now = Date.now()): number {
  const started = ensurePlaytest(state).startedAt
  return Math.max(0, now - started)
}

export function sessionPlaytimeMs(state: GameState): number {
  const log = ensurePlaytest(state)
  return Math.max(0, log.playtimeMs - log.sessionPlaytimeMs)
}

export interface PlaytestProgressRow {
  label: string
  atMs: number
}

export interface PlaytestStall {
  from: number
  to: number
  ms: number
}

export function playtestProgressRows(state: GameState): PlaytestProgressRow[] {
  const log = ensurePlaytest(state)
  const rows: PlaytestProgressRow[] = []
  const labels: Array<[string, string]> = [
    ['launch', 'First launch'],
    ['kill', 'First kill'],
    ['defeat', 'First defeat'],
    ['core_assembled', 'First new Core'],
    ['foundry_fitted', 'First module'],
    ['rebuild', 'Rebuild'],
  ]
  for (const [key, label] of labels) {
    const at = log.firsts[key]
    if (at != null) rows.push({ label, atMs: at })
  }
  for (const [key, at] of Object.entries(log.firsts)) {
    const match = /^sector:(\d+)$/.exec(key)
    if (!match) continue
    rows.push({ label: `S${match[1]}`, atMs: at })
  }
  rows.sort((a, b) => a.atMs - b.atMs || a.label.localeCompare(b.label))
  return rows
}

export function longestProgressionStall(state: GameState, nowPlaytime?: number): PlaytestStall | null {
  const log = ensurePlaytest(state)
  const marks: Array<{ sector: number; at: number }> = []
  for (const [key, at] of Object.entries(log.firsts)) {
    const match = /^sector:(\d+)$/.exec(key)
    if (!match) continue
    marks.push({ sector: Number(match[1]), at })
  }
  marks.sort((a, b) => a.sector - b.sector || a.at - b.at)
  let best: PlaytestStall | null = null
  for (let i = 1; i < marks.length; i++) {
    const ms = marks[i]!.at - marks[i - 1]!.at
    if (!best || ms > best.ms) {
      best = { from: marks[i - 1]!.sector, to: marks[i]!.sector, ms }
    }
  }
  const playtime = nowPlaytime ?? log.playtimeMs
  if (log.sectorAt > 0) {
    const current = playtime - log.sectorAtPlaytime
    if (current > 0 && (!best || current > best.ms)) {
      best = { from: log.sectorAt, to: log.sectorAt + 1, ms: current }
    }
  }
  return best
}

function mostUsedDrones(state: GameState): string {
  const drones = ensurePlaytest(state).drones
  const entries = Object.entries(drones).filter(([, n]) => n > 0)
  if (entries.length === 0) return 'none recorded'
  entries.sort((a, b) => b[1] - a[1])
  return entries
    .slice(0, 4)
    .map(([id, n]) => `${DRONE_LABELS[id] ?? id} ${formatPlaytimeMs(n * 1000)}`)
    .join(', ')
}

function formatAttempts(map: Record<string, { a: number; c: number }>): string {
  const entries = Object.entries(map).filter(([, v]) => v.a > 0 || v.c > 0)
  if (entries.length === 0) return 'none'
  return entries
    .sort((a, b) => b[1].a - a[1].a)
    .map(([id, v]) => `${id} ${v.c}/${v.a}`)
    .join(', ')
}

/** Human-readable local report for developers. */
export function buildPlaytestReport(state: GameState, now = Date.now()): string {
  const log = ensurePlaytest(state)
  const lines: string[] = ['PLAYTEST REPORT', '']
  lines.push(`Session: ${formatPlaytimeMs(sessionPlaytimeMs(state))}`)
  lines.push(`Career playtime: ${formatPlaytimeMs(log.playtimeMs)}`)
  lines.push(`Save age: ${formatPlaytimeMs(saveAgeMs(state, now))}`)
  lines.push(
    `Highest sector: S${Math.max(state.combat?.highestSector ?? 0, state.meta?.highestSectorEver ?? 0, log.sectorAt)}`,
  )
  lines.push('')
  lines.push('Progression')
  const rows = playtestProgressRows(state)
  if (rows.length === 0) {
    lines.push('(no milestones yet)')
  } else {
    const width = Math.max(...rows.map((r) => r.label.length))
    for (const row of rows) {
      lines.push(`${row.label.padEnd(width)}  ${formatPlaytimeMs(row.atMs, 'clock')}`)
    }
  }
  const stall = longestProgressionStall(state)
  lines.push('')
  if (stall) {
    lines.push(
      `Longest progression stall:`,
      `S${stall.from} → S${stall.to}: ${formatPlaytimeMs(stall.ms)}`,
    )
  } else {
    lines.push('Longest progression stall: none yet')
  }
  lines.push('')
  lines.push('Cores assembled:')
  lines.push(log.cores.length > 0 ? log.cores.join('\n') : '(starter only)')
  lines.push('')
  lines.push(`Most-used Drone allocation:`)
  lines.push(mostUsedDrones(state))
  lines.push('')
  lines.push(`Protocol attempts:`)
  lines.push(formatAttempts(log.protocols))
  lines.push('')
  lines.push(`Echo attempts:`)
  lines.push(formatAttempts(log.echos))
  lines.push('')
  lines.push('Combat clocks')
  lines.push(`Active combat: ${formatPlaytimeMs(log.activeCombatMs ?? 0)}`)
  lines.push(`Frontier combat: ${formatPlaytimeMs(log.frontierCombatMs ?? 0)}`)
  lines.push(`Retreat farming: ${formatPlaytimeMs(log.retreatFarmMs ?? 0)}`)
  lines.push(`Offline combat: ${formatPlaytimeMs(log.offlineCombatMs ?? 0)}`)
  lines.push(`Offline retreat farm: ${formatPlaytimeMs(log.offlineRetreatFarmMs ?? 0)}`)
  lines.push(
    `Consecutive first-attempt clears: ${log.consecutiveFrontierOneShots ?? 0}` +
      (log.bestConsecutiveFrontierOneShots
        ? ` (best ${log.bestConsecutiveFrontierOneShots})`
        : ''),
  )
  if (log.lastSteamroll && log.lastSteamroll.n >= 2) {
    lines.push(
      `Steamroll: S${log.lastSteamroll.from} → S${log.lastSteamroll.to}: ${log.lastSteamroll.n} consecutive first-attempt clears`,
    )
  }
  lines.push('')
  lines.push('FRONTIER HISTORY')
  const history = Object.values(log.sectorAttempts ?? {}).filter(
    (row) => row.attempts > 0 || row.clears > 0 || row.failures > 0,
  )
  history.sort((a, b) => a.sector - b.sector || a.route.localeCompare(b.route))
  if (history.length === 0) {
    lines.push('(no frontier attempts yet)')
  } else {
    for (const row of history) {
      const route = row.route === 'B' ? 'B' : ''
      const result = row.clears > 0 ? 'Clear' : row.failures > 0 ? 'Repelled' : 'Open'
      lines.push(`S${row.sector}${route}`)
      lines.push(`Attempts: ${row.attempts}  Failures: ${row.failures}  ${result}`)
      lines.push(`Frontier combat: ${formatPlaytimeMs(row.frontierCombatMs)}`)
      if (row.retreatFarmMs > 0) {
        lines.push(`Retreat farming: ${formatPlaytimeMs(row.retreatFarmMs)}`)
      }
      if (row.lastPressure && row.failures > 0) {
        lines.push(`Pressure: ${row.lastPressure}`)
      }
      if (row.lastEnemyHpPct > 0 && row.clears === 0) {
        lines.push(`Last failed attempt: enemy HP remaining ${row.lastEnemyHpPct}%`)
      }
      if (row.clears > 0 && row.successFightMs > 0) {
        lines.push(`Successful attempt: ${formatPlaytimeMs(row.successFightMs)}`)
      }
      const pending =
        state.combat?.frontierSector === row.sector
          ? summarizeInterventions(log.pendingInterventions ?? [])
          : []
      const interventions = [...row.interventions, ...pending]
      if (interventions.length > 0) {
        lines.push('Interventions:')
        for (const line of interventions) lines.push(`  ${line}`)
      }
      lines.push('')
    }
  }
  lines.push(`Events logged: ${log.events.length}`)
  return lines.join('\n')
}

export function exportPlaytestJson(state: GameState): string {
  return JSON.stringify(ensurePlaytest(state), null, 2)
}

/** True when this module never performs I/O besides in-memory state (tests spy on fetch). */
export function playtestUsesNetwork(): boolean {
  return false
}
