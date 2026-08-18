/** Dock run summary — snapshot at Launch, close on Extract / Defeat. */

import type { GameState, HiveResearchBranch, SortieMark, SortieSummary } from './types'
import { ensureStarterCoresTourSalvage } from './catalog'
import { retireLiveSortieGuides } from './progression'
import { emptySortieRunStats, snapshotSortieEncounter } from './sortieTelemetry'
import { recordPlaytest } from './playtest'

const RESEARCH_BRANCHES: HiveResearchBranch[] = ['material', 'energy', 'observation']

export function emptyLastSortie(sector = 1, wave = 1): SortieSummary {
  return {
    outcome: null,
    sector,
    wave,
    note: '',
    sectorsCleared: 0,
    salvageGained: 0,
    salvageSpent: 0,
    milestones: 0,
    researchXp: 0,
    networkLevels: 0,
    stats: emptySortieRunStats(),
  }
}

export function countCorePicks(state: GameState): number {
  let n = 0
  for (const picks of Object.values(state.shipyard.corePicks ?? {})) {
    n += Object.keys(picks ?? {}).length
  }
  return n
}

function researchBanked(state: GameState): number {
  const hive = state.hiveResearch
  if (!hive) return 0
  let total = 0
  for (const branch of RESEARCH_BRANCHES) {
    total += Math.max(0, hive.xp[branch] ?? 0)
    const done = Math.max(0, Math.floor(hive.completed[branch] ?? 0))
    for (let i = 0; i < done; i++) total += Math.floor(50 * Math.pow(2, i))
  }
  return total
}

function networkLevelsSum(state: GameState): number {
  const bars = state.network?.bars
  if (!bars) return 0
  return Object.values(bars).reduce((n, bar) => n + Math.max(0, bar?.levels ?? 0), 0)
}

export function captureSortieMark(state: GameState): SortieMark {
  return {
    salvage: state.resources.salvage ?? 0,
    salvageSpent: 0,
    sectorsCleared: 0,
    corePicks: countCorePicks(state),
    researchXp: researchBanked(state),
    networkLevels: networkLevelsSum(state),
    stats: emptySortieRunStats(),
  }
}

export function noteSalvageSpend(state: GameState, amount: number): void {
  if (!state.combat.sortieMark || amount <= 0) return
  state.combat.sortieMark.salvageSpent += amount
}

export function noteSectorClear(state: GameState): void {
  if (!state.combat.sortieMark) return
  state.combat.sortieMark.sectorsCleared += 1
}

export function closeSortie(
  state: GameState,
  outcome: 'extract' | 'defeat',
  note: string,
  at?: { sector: number; wave: number },
): void {
  const mark = state.combat.sortieMark
  const spent = mark?.salvageSpent ?? 0
  if (outcome === 'defeat') {
    state.meta.hullLostOnce = true
    retireLiveSortieGuides(state)
    const topped = ensureStarterCoresTourSalvage(state)
    state.resources.salvage = topped.resources.salvage
    recordPlaytest(state, 'first_defeat', { firstKey: 'defeat' })
  }
  snapshotSortieEncounter(state)
  const salvageNow = state.resources.salvage ?? 0
  const gained = mark ? Math.max(0, salvageNow + spent - mark.salvage) : 0
  state.combat.lastSortie = {
    outcome,
    sector: at?.sector ?? state.combat.sector,
    wave: at?.wave ?? state.combat.wave,
    note,
    sectorsCleared: mark?.sectorsCleared ?? 0,
    salvageGained: Math.floor(gained),
    salvageSpent: Math.floor(spent),
    milestones: Math.max(0, countCorePicks(state) - (mark?.corePicks ?? 0)),
    researchXp: Math.max(0, Math.floor(researchBanked(state) - (mark?.researchXp ?? 0))),
    networkLevels: Math.max(0, networkLevelsSum(state) - (mark?.networkLevels ?? 0)),
    stats: mark?.stats ?? emptySortieRunStats(),
  }
  state.combat.sortieMark = null
}
