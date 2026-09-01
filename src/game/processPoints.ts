/** Canonical one-time, achievement-only Process Point sources (160 PP in Act 1). */

import { getHiveResearchNode } from './hiveResearchTree'
import type { GameState } from './types'

export type ProcessPointGroup = 'wave' | 'rebuild' | 'research' | 'challenge' | 'foundry' | 'mastery'

export const PROCESS_POINT_GROUP_LABELS: Record<ProcessPointGroup, string> = {
  wave: 'Career frontier',
  rebuild: 'Rebuild mastery',
  research: 'Research',
  challenge: 'Challenges',
  foundry: 'Foundry / buildcraft',
  mastery: 'Core Mastery',
}

export interface ProcessPointSource {
  id: string
  name: string
  description: string
  group: ProcessPointGroup
  points: number
  earned: boolean
  completions: number
}

interface SourceDef extends Omit<ProcessPointSource, 'earned' | 'completions'> {
  test: (state: GameState) => boolean
}

const wave = (at: number, points: number): SourceDef => ({
  id: `wave-${at}`,
  name: at === 1000 ? 'Defeat Choir Crown' : `Reach Wave ${at}`,
  description: at === 1000 ? 'Defeat the Act 1 Choir Crown.' : `Reach career Wave ${at}.`,
  group: 'wave', points,
  test: (s) => Math.max(s.meta.bestWave ?? 0, s.combat.bestWave ?? 0) >= at,
})

const rebuild = (count: number, points: number, label: string): SourceDef => ({
  id: `rebuild-${count}`, name: label, description: `Complete ${count} lifetime Rebuild${count === 1 ? '' : 's'}.`,
  group: 'rebuild', points, test: (s) => (s.prestige.prestigeCount ?? 0) >= count,
})

function researchCount(state: GameState): number {
  return new Set((state.hiveResearch?.completedIds ?? []).filter((id) => Boolean(getHiveResearchNode(id)))).size
}
function challengeMedals(state: GameState): { preFinalePoints: number; hollow: boolean } {
  let preFinalePoints = 0
  let hollow = false
  for (const [id, raw] of Object.entries(state.challenges?.medals ?? {})) {
    const rank = Math.max(0, Math.min(3, Math.floor(Number(raw) || 0)))
    if (id === 'hollow-choir') hollow = rank > 0
    else if (rank > 0) preFinalePoints += 2 + Math.max(0, rank - 1)
  }
  return { preFinalePoints: Math.min(36, preFinalePoints), hollow }
}

function distinctCores(state: GameState): number {
  return new Set((state.shipyard.coreInstances ?? []).map((row) => row.moduleId)).size
}

export const PROCESS_POINT_SOURCES: SourceDef[] = [
  wave(100, 2), wave(200, 2), wave(300, 3), wave(400, 3), wave(500, 4),
  wave(600, 4), wave(700, 5), wave(800, 5), wave(900, 6), wave(1000, 8),
  rebuild(1, 3, 'First Rebuild'), rebuild(3, 3, 'Three Rebuilds'), rebuild(6, 4, 'Six Rebuilds'), rebuild(10, 5, 'Ten Rebuilds'),
  { id: 'research-first', name: 'First Research', description: 'Complete the first Research project.', group: 'research', points: 2, test: (s) => researchCount(s) >= 1 },
  ...(['energy', 'observation', 'material', 'computation'] as const).map((branch): SourceDef => ({
    id: `breakthrough-${branch}`,
    name: `First ${PROCESS_POINT_GROUP_LABELS.research} breakthrough: ${branch}`,
    description: 'Complete the first Breakthrough in this discipline.', group: 'research', points: 2,
    test: (s) => (s.hiveResearch?.completedIds ?? []).some((id) => { const n = getHiveResearchNode(id); return n?.branch === branch && n.kind === 'breakthrough' }),
  })),
  { id: 'process-kernel', name: 'Process Kernel', description: 'Complete Process Kernel.', group: 'research', points: 5, test: (s) => (s.hiveResearch?.completedIds ?? []).includes('c4-process-kernel') },
  { id: 'research-20', name: 'Twenty Research nodes', description: 'Complete 20 Act 1 Research nodes.', group: 'research', points: 4, test: (s) => researchCount(s) >= 20 },
  { id: 'research-30', name: 'Thirty Research nodes', description: 'Complete 30 Act 1 Research nodes.', group: 'research', points: 5, test: (s) => researchCount(s) >= 30 },
  { id: 'research-40', name: 'Research complete', description: 'Complete all 40 Act 1 Research nodes.', group: 'research', points: 6, test: (s) => researchCount(s) >= 40 },
  { id: 'challenge-medals', name: 'Nine Challenge medal sets', description: 'Earn Bronze, Silver, and Gold across the nine pre-finale Challenges.', group: 'challenge', points: 36, test: (s) => challengeMedals(s).preFinalePoints >= 36 },
  { id: 'hollow-choir', name: 'Hollow Choir', description: 'Clear Hollow Choir once.', group: 'challenge', points: 6, test: (s) => challengeMedals(s).hollow },
  { id: 'relic-tier-2', name: 'First Tier II Relic', description: 'Fabricate the first Tier II Relic.', group: 'foundry', points: 3, test: (s) => (s.relics.instances ?? []).some((r) => r.tier >= 2) },
  { id: 'relic-tier-3', name: 'First Tier III Relic', description: 'Fabricate the first Tier III Relic.', group: 'foundry', points: 4, test: (s) => (s.relics.instances ?? []).some((r) => r.tier >= 3) },
  { id: 'cores-8', name: 'Eight Core types', description: 'Own eight distinct Core types.', group: 'foundry', points: 3, test: (s) => distinctCores(s) >= 8 },
  { id: 'cores-14', name: 'All Core types', description: 'Own all fourteen Act 1 Core types.', group: 'foundry', points: 5, test: (s) => distinctCores(s) >= 14 },
  { id: 'frame-first', name: 'First non-Standard Frame', description: 'Fabricate a non-Standard Frame.', group: 'foundry', points: 2, test: (s) => (s.shipyard.unlockedFrames ?? []).some((id) => id !== 'starter-frame' && id !== 'standard-frame') },
  { id: 'frames-5', name: 'All Frames', description: 'Own all five Act 1 Frames.', group: 'foundry', points: 4, test: (s) => new Set(s.shipyard.unlockedFrames ?? []).size >= 5 },
  { id: 'mastery-50', name: 'First M50 Core', description: 'Reach Core Mastery 50.', group: 'mastery', points: 2, test: (s) => Object.values(s.meta.moduleMastery ?? {}).some((n) => n >= 50) },
  { id: 'mastery-75', name: 'First M75 Core', description: 'Reach Core Mastery 75.', group: 'mastery', points: 3, test: (s) => Object.values(s.meta.moduleMastery ?? {}).some((n) => n >= 75) },
  { id: 'mastery-100', name: 'First M100 Core', description: 'Reach Core Mastery 100.', group: 'mastery', points: 5, test: (s) => Object.values(s.meta.moduleMastery ?? {}).some((n) => n >= 100) },
]

/** Research source total uses four separate 2 PP Breakthrough rows. */
export const ACT1_PROCESS_POINT_TOTAL = PROCESS_POINT_SOURCES.reduce((sum, row) => sum + row.points, 0)

export function processPointSources(state: GameState): ProcessPointSource[] {
  return PROCESS_POINT_SOURCES.map(({ test, ...row }) => ({ ...row, earned: test(state), completions: test(state) ? 1 : 0 }))
}

export function processPointsEarned(state: GameState): number {
  const sources = processPointSources(state)
  const fixed = sources.filter((row) => row.id !== 'challenge-medals').reduce((sum, row) => sum + (row.earned ? row.points : 0), 0)
  return fixed + challengeMedals(state).preFinalePoints
}

export function processPointSourcesByGroup(state: GameState) {
  const sources = processPointSources(state)
  return (Object.keys(PROCESS_POINT_GROUP_LABELS) as ProcessPointGroup[]).map((group) => {
    const rows = sources.filter((row) => row.group === group)
    return { group, label: PROCESS_POINT_GROUP_LABELS[group], earned: rows.filter((row) => row.earned), upcoming: rows.filter((row) => !row.earned) }
  })
}
