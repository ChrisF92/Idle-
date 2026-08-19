/** Lightweight sortie counters and post-run pressure classification. */

import type { EnemyRole, GameState, PressureClass, SortieRunStats, SortieSummary } from './types'
import { isSystemUnlocked } from './progression'
import { specialistsUnlocked } from './specialists'
import { capitalUnlocked } from './capital'
import { STARTER_CORE_IDS } from './catalog'

export type { PressureClass }

export interface SortieDiagnostic {
  title: string
  pressure: PressureClass
  lines: string[]
  threat: string | null
  improvements: string[]
}

const ROLE_THREATS: Partial<Record<EnemyRole, string>> = {
  sniper: 'Sniper volleys',
  juggernaut: 'Juggernaut sustained damage',
  fighter: 'Fighter packs',
  skirmisher: 'Skirmisher pressure',
  shield: 'Shield escorts',
  boss: 'Boss pressure',
}

export function emptySortieRunStats(): SortieRunStats {
  return {
    damageDealt: 0,
    damageTaken: 0,
    shieldAbsorbed: 0,
    shieldBreaks: 0,
    enemyCountMax: 0,
    enemyCountSum: 0,
    enemyCountSamples: 0,
    finalFightTime: 0,
    finalEnemyHp: 0,
    finalEnemyHpMax: 0,
    playerHp: 0,
    playerHpMax: 0,
    takenByRole: {},
    lastEnemyName: '',
    lastEnemyFamily: '',
    lastEnemyRole: '',
    lastIsBoss: false,
    kills: 0,
  }
}

export function hydrateSortieRunStats(raw: unknown): SortieRunStats {
  const empty = emptySortieRunStats()
  if (!raw || typeof raw !== 'object') return empty
  const src = raw as Partial<SortieRunStats>
  const takenByRole: Partial<Record<EnemyRole, number>> = {}
  if (src.takenByRole && typeof src.takenByRole === 'object') {
    for (const [role, value] of Object.entries(src.takenByRole)) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) continue
      takenByRole[role as EnemyRole] = n
    }
  }
  return {
    damageDealt: num(src.damageDealt),
    damageTaken: num(src.damageTaken),
    shieldAbsorbed: num(src.shieldAbsorbed),
    shieldBreaks: Math.max(0, Math.floor(num(src.shieldBreaks))),
    enemyCountMax: Math.max(0, Math.floor(num(src.enemyCountMax))),
    enemyCountSum: num(src.enemyCountSum),
    enemyCountSamples: Math.max(0, Math.floor(num(src.enemyCountSamples))),
    finalFightTime: num(src.finalFightTime),
    finalEnemyHp: num(src.finalEnemyHp),
    finalEnemyHpMax: num(src.finalEnemyHpMax),
    playerHp: num(src.playerHp),
    playerHpMax: num(src.playerHpMax),
    takenByRole,
    lastEnemyName: typeof src.lastEnemyName === 'string' ? src.lastEnemyName : '',
    lastEnemyFamily: typeof src.lastEnemyFamily === 'string' ? src.lastEnemyFamily : '',
    lastEnemyRole: typeof src.lastEnemyRole === 'string' ? src.lastEnemyRole : '',
    lastIsBoss: src.lastIsBoss === true,
    kills: Math.max(0, Math.floor(num(src.kills))),
  }
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function ensureSortieStats(state: GameState): SortieRunStats {
  if (!state.combat.sortieMark) return emptySortieRunStats()
  if (!state.combat.sortieMark.stats) state.combat.sortieMark.stats = emptySortieRunStats()
  return state.combat.sortieMark.stats
}

export function noteSortieOutgoing(state: GameState, dealt: number): void {
  if (dealt <= 0) return
  const stats = ensureSortieStats(state)
  stats.damageDealt += dealt
}

export function noteSortieIncoming(
  state: GameState,
  dealt: number,
  opts: {
    shieldBefore: number
    shieldAfter: number
    role?: EnemyRole | string
  },
): void {
  if (dealt <= 0) return
  const stats = ensureSortieStats(state)
  stats.damageTaken += dealt
  if (opts.shieldBefore > 0) {
    const absorbed = Math.max(0, opts.shieldBefore - Math.max(0, opts.shieldAfter))
    if (absorbed > 0) stats.shieldAbsorbed += absorbed
    if (opts.shieldBefore > 0 && opts.shieldAfter <= 1e-6) stats.shieldBreaks += 1
  }
  const role = opts.role
  if (role === 'fighter' || role === 'skirmisher' || role === 'sniper' || role === 'juggernaut' || role === 'shield' || role === 'boss') {
    stats.takenByRole[role] = (stats.takenByRole[role] ?? 0) + dealt
  }
}

export function noteSortieKill(state: GameState): void {
  ensureSortieStats(state).kills += 1
}

export function sampleSortieEnemies(state: GameState): void {
  const stats = ensureSortieStats(state)
  const live = state.combat.enemyUnits.reduce((n, u) => n + (u.hull > 0 ? 1 : 0), 0)
  stats.enemyCountMax = Math.max(stats.enemyCountMax, live)
  stats.enemyCountSum += live
  stats.enemyCountSamples += 1
}

/** At most once per combat second — not every simulation step. */
export function maybeSampleSortieEnemies(state: GameState): void {
  const stats = ensureSortieStats(state)
  const elapsed = state.combat.fightElapsed ?? 0
  if (stats.enemyCountSamples > 0 && elapsed < stats.enemyCountSamples) return
  sampleSortieEnemies(state)
  snapshotSortieEncounter(state)
}

export function snapshotSortieEncounter(state: GameState): void {
  const stats = ensureSortieStats(state)
  stats.finalFightTime = Math.max(stats.finalFightTime, state.combat.fightElapsed ?? 0)
  const enemies = state.combat.enemyUnits
  const any = enemies.some((u) => u.hullMax > 0)
  if (any) {
    let hull = 0
    let hullMax = 0
    let role = ''
    let roleHull = 0
    for (const unit of enemies) {
      hull += Math.max(0, unit.hull)
      hullMax += Math.max(0, unit.hullMax)
      if (unit.hull > 0 && (unit.hull > roleHull || unit.isBoss)) {
        roleHull = unit.hull
        role = unit.role ?? (unit.isBoss ? 'boss' : '')
      }
    }
    stats.finalEnemyHp = hull
    stats.finalEnemyHpMax = hullMax
    stats.lastEnemyName = state.combat.enemyName ?? ''
    stats.lastEnemyFamily = state.combat.enemyFamily ?? ''
    stats.lastEnemyRole = role
    stats.lastIsBoss = Boolean(state.combat.isBoss)
  }
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  stats.playerHp = flag?.hull ?? state.combat.playerHull ?? 0
  stats.playerHpMax = flag?.hullMax ?? state.combat.playerHullMax ?? 0
}

export function classifyPressure(
  stats: SortieRunStats,
  outcome: SortieSummary['outcome'],
): PressureClass {
  if (outcome !== 'defeat') return 'HEALTHY'
  const remaining = stats.finalEnemyHpMax > 0 ? stats.finalEnemyHp / stats.finalEnemyHpMax : 1
  const fight = stats.finalFightTime
  const quickDeath = fight > 0 && fight < 10
  const longFight = fight >= 18
  const manyBreaks = stats.shieldBreaks >= 3
  const leftover = remaining >= 0.28
  const damageAdequate = remaining < 0.4 || stats.damageDealt >= stats.finalEnemyHpMax * 0.55
  const survivability = manyBreaks || quickDeath
  const damage = leftover && (longFight || (!manyBreaks && fight >= 14))
  if (survivability && damage) return 'MIXED'
  if (survivability && damageAdequate) return 'SURVIVABILITY'
  if (damage && !manyBreaks) return 'DAMAGE'
  if (survivability) return 'SURVIVABILITY'
  if (leftover) return 'DAMAGE'
  return 'MIXED'
}

export function primaryThreat(stats: SortieRunStats): string | null {
  const entries = Object.entries(stats.takenByRole).filter(([, n]) => (n ?? 0) > 0) as Array<
    [EnemyRole, number]
  >
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  const total = entries.reduce((n, [, v]) => n + v, 0)
  if (total < 4) return null
  const [role, dmg] = entries[0]!
  const second = entries[1]?.[1] ?? 0
  if (dmg / total < 0.45) return null
  if (second > 0 && dmg < second * 1.35) return null
  if (role === 'boss' && stats.lastEnemyName) return stats.lastEnemyName
  return ROLE_THREATS[role] ?? null
}

export function possibleImprovements(
  state: GameState,
  pressure: PressureClass,
): string[] {
  if (pressure === 'HEALTHY') return []
  const wantDefense = pressure === 'SURVIVABILITY' || pressure === 'MIXED'
  const wantOffense = pressure === 'DAMAGE' || pressure === 'MIXED'
  const out: string[] = []
  const push = (label: string, ok: boolean) => {
    if (ok && !out.includes(label)) out.push(label)
  }
  if (wantDefense) {
    push('Plate', STARTER_CORE_IDS.includes('plate-layer'))
    push('Ward', isSystemUnlocked(state, 'network'))
    push('Furnace Shielding', isSystemUnlocked(state, 'furnace'))
    push('Warden', specialistsUnlocked(state))
    push('Bulkhead', capitalUnlocked(state))
  }
  if (wantOffense) {
    push('Pulse', STARTER_CORE_IDS.includes('pulse-cannon'))
    push('Strike', isSystemUnlocked(state, 'network'))
    push('Furnace Weapons', isSystemUnlocked(state, 'furnace'))
    push('Gunner', specialistsUnlocked(state))
    push('Broadside', capitalUnlocked(state))
  }
  return out.slice(0, 3)
}

export function buildSortieDiagnostic(
  summary: SortieSummary,
  state: GameState,
): SortieDiagnostic {
  const stats = summary.stats ?? emptySortieRunStats()
  const pressure = classifyPressure(stats, summary.outcome)
  const threat = summary.outcome === 'defeat' ? primaryThreat(stats) : null
  const improvements = possibleImprovements(state, pressure)
  const remainingPct =
    stats.finalEnemyHpMax > 0 ? Math.round((100 * stats.finalEnemyHp) / stats.finalEnemyHpMax) : 0
  const avgEnemies =
    stats.enemyCountSamples > 0 ? stats.enemyCountSum / stats.enemyCountSamples : 0
  const title =
    summary.outcome === 'defeat'
      ? stats.lastIsBoss
        ? `REPELLED — SECTOR ${summary.sector} BOSS`
        : `REPELLED — SECTOR ${summary.sector}`
      : `CLEARED — SECTOR ${summary.sector}`
  const lines: string[] = []
  if (summary.outcome === 'defeat' && stats.lastIsBoss) {
    lines.push(`Boss HP remaining: ${remainingPct}%`)
  } else if (summary.outcome === 'defeat' && stats.finalEnemyHpMax > 0) {
    lines.push(`Enemy HP remaining: ${remainingPct}%`)
  }
  if (stats.finalFightTime > 0) {
    lines.push(`Fight time: ${Math.round(stats.finalFightTime)}s`)
  }
  if (stats.shieldBreaks > 0 || stats.shieldAbsorbed > 0) {
    lines.push(`Shield breaks: ${stats.shieldBreaks}`)
  }
  if (summary.outcome !== 'defeat' && stats.playerHpMax > 0) {
    lines.push(
      `Hull remaining: ${Math.round((100 * stats.playerHp) / stats.playerHpMax)}%`,
    )
  }
  if (stats.damageDealt > 0 || stats.damageTaken > 0) {
    lines.push(
      `Damage dealt / taken: ${Math.round(stats.damageDealt)} / ${Math.round(stats.damageTaken)}`,
    )
  }
  if (stats.enemyCountSamples > 0) {
    lines.push(
      `Enemy count: max ${stats.enemyCountMax} · avg ${avgEnemies.toFixed(1)}`,
    )
  }
  return { title, pressure, lines, threat, improvements }
}
