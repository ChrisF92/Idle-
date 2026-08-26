/** Dock run summary — snapshot at Launch, close on Extract / Defeat. */

import type {
  GameState,
  HiveResearchBranch,
  RunUpgradeCategory,
  SortieMark,
  SortieSpendByCategory,
  SortieSummary,
} from './types'
import { retireLiveSortieGuides } from './progression'
import { emptySortieRunStats, snapshotSortieEncounter } from './sortieTelemetry'
import { recordPlaytest } from './playtest'
import { fragmentCount } from './uiReadout'
import { coreSortieRecords } from './coreProgression'

const RESEARCH_BRANCHES: HiveResearchBranch[] = ['material', 'energy', 'observation']

export function emptySpendByCategory(): SortieSpendByCategory {
  return { attack: 0, defense: 0, economy: 0 }
}

export function emptyLastSortie(sector = 1, wave = 1): SortieSummary {
  return {
    outcome: null,
    sector,
    wave,
    note: '',
    sectorsCleared: 0,
    salvageGained: 0,
    salvageSpent: 0,
    scrapEarned: 0,
    extractionBonusScrap: 0,
    grossScrapGenerated: 0,
    newBest: false,
    previousBest: 0,
    milestones: 0,
    researchXp: 0,
    networkLevels: 0,
    stats: emptySortieRunStats(),
    spendByCategory: emptySpendByCategory(),
    ashEarned: 0,
    dataEarned: 0,
    fragmentsEarned: 0,
    cores: [],
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
    scrap: state.resources.scrap ?? 0,
    grossScrapGenerated: 0,
    provisioningGranted: false,
    challengeSortie: false,
    sectorsCleared: 0,
    corePicks: countCorePicks(state),
    researchXp: researchBanked(state),
    networkLevels: networkLevelsSum(state),
    stats: emptySortieRunStats(),
    spendByCategory: emptySpendByCategory(),
    ash: state.resources.choirAsh ?? 0,
    data: state.resources.data ?? 0,
    fragments: fragmentCount(state),
    sortieSeed: state.combat.sortieSeed ?? 0,
  }
}

export function noteSalvageSpend(
  state: GameState,
  amount: number,
  category?: RunUpgradeCategory,
): void {
  if (!state.combat.sortieMark || amount <= 0) return
  state.combat.sortieMark.salvageSpent += amount
  if (!state.combat.sortieMark.spendByCategory) {
    state.combat.sortieMark.spendByCategory = emptySpendByCategory()
  }
  if (category) state.combat.sortieMark.spendByCategory[category] += amount
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
  opts?: { keepMark?: boolean; scrapEarned?: number; extractionBonusScrap?: number; newBest?: boolean; previousBest?: number },
): void {
  const mark = state.combat.sortieMark
  const spent = mark?.salvageSpent ?? 0
  const wave = at?.wave ?? state.combat.wave
  if (outcome === 'defeat') {
    state.meta.hullLostOnce = true
    retireLiveSortieGuides(state)
    recordPlaytest(state, 'first_defeat', { firstKey: 'defeat' })
  }
  if (outcome === 'extract') state.meta.extractedOnce = true
  snapshotSortieEncounter(state)
  const salvageNow = state.resources.salvage ?? 0
  const gained = mark ? Math.max(0, salvageNow + spent - mark.salvage) : 0
  const scrapEarned =
    opts?.scrapEarned ??
    Math.max(0, (state.resources.scrap ?? 0) - (mark?.scrap ?? state.resources.scrap ?? 0))
  state.combat.lastSortie = {
    outcome,
    sector: at?.sector ?? 0,
    wave,
    note,
    sectorsCleared: mark?.sectorsCleared ?? 0,
    salvageGained: Math.floor(gained),
    salvageSpent: Math.floor(spent),
    scrapEarned: Math.floor(scrapEarned),
    extractionBonusScrap: Math.max(0, Math.floor(opts?.extractionBonusScrap ?? 0)),
    grossScrapGenerated: Math.max(0, mark?.grossScrapGenerated ?? 0),
    newBest: Boolean(opts?.newBest),
    previousBest: Math.max(0, Math.floor(opts?.previousBest ?? 0)),
    milestones: Math.max(0, countCorePicks(state) - (mark?.corePicks ?? 0)),
    researchXp: Math.max(0, Math.floor(researchBanked(state) - (mark?.researchXp ?? 0))),
    networkLevels: Math.max(0, networkLevelsSum(state) - (mark?.networkLevels ?? 0)),
    stats: mark?.stats ?? emptySortieRunStats(),
    spendByCategory: mark?.spendByCategory ?? emptySpendByCategory(),
    ashEarned: Math.max(0, Math.floor((state.resources.choirAsh ?? 0) - (mark?.ash ?? 0))),
    dataEarned: Math.max(0, Math.floor((state.resources.data ?? 0) - (mark?.data ?? 0))),
    fragmentsEarned: Math.max(0, fragmentCount(state) - (mark?.fragments ?? 0)),
    cores: coreSortieRecords(state),
  }
  if (state.combat.lastSortie.stats) {
    state.combat.lastSortie.stats.sortieSeed = mark?.sortieSeed ?? state.combat.sortieSeed ?? 0
  }
  if (opts?.keepMark && state.combat.sortieMark) {
    state.combat.sortieMark.stats = emptySortieRunStats()
    return
  }
  state.combat.sortieMark = null
  state.combat.sortieSeed = 0
}
