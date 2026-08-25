/** Process Points come from account mastery, never from time passing. */

import { ACHIEVEMENTS, achievementCompletions, isAchievementUnlocked, type AchievementDef } from './progression'
import type { GameState } from './types'

export type ProcessPointGroup =
  | 'wave'
  | 'rebuild'
  | 'foundry'
  | 'research'
  | 'challenge'
  | 'mastery'

export const PROCESS_POINT_GROUP_LABELS: Record<ProcessPointGroup, string> = {
  wave: 'Best Wave',
  rebuild: 'Rebuilds',
  foundry: 'Foundry Mastery',
  research: 'Research breakthroughs',
  challenge: 'Challenge clears',
  mastery: 'Manual-use mastery',
}

const RETIRED_POINT_IDS = new Set(['echo-clear'])

export function processPointGroup(def: AchievementDef): ProcessPointGroup | null {
  if (RETIRED_POINT_IDS.has(def.id)) return null
  switch (def.condition.type) {
    case 'sector-ever':
    case 'act1-cleared':
    case 'lifetime-sectors':
    case 'lifetime-waves':
      return 'wave'
    case 'prestige-count':
      return 'rebuild'
    case 'foundry-recipe-level':
    case 'lifetime-fab-crafts':
    case 'yard-building-count':
      return 'foundry'
    case 'research-count':
    case 'hive-research-nodes':
      return 'research'
    case 'challenge-clears-total':
    case 'protocol-rank-sum':
      return 'challenge'
    default:
      return 'mastery'
  }
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

export function processPointSources(state: GameState): ProcessPointSource[] {
  const out: ProcessPointSource[] = []
  for (const def of ACHIEVEMENTS) {
    const group = processPointGroup(def)
    if (!group) continue
    const completions = def.repeatable
      ? achievementCompletions(state, def.id)
      : isAchievementUnlocked(state, def.id)
        ? 1
        : 0
    out.push({
      id: def.id,
      name: def.name,
      description: def.description,
      group,
      points: def.rewardAiPoints * Math.max(1, completions || 1),
      earned: completions > 0,
      completions,
    })
  }
  return out
}

export function processPointSourcesByGroup(state: GameState): {
  group: ProcessPointGroup
  label: string
  earned: ProcessPointSource[]
  upcoming: ProcessPointSource[]
}[] {
  const sources = processPointSources(state)
  return (Object.keys(PROCESS_POINT_GROUP_LABELS) as ProcessPointGroup[]).map((group) => {
    const rows = sources.filter((row) => row.group === group)
    return {
      group,
      label: PROCESS_POINT_GROUP_LABELS[group],
      earned: rows.filter((row) => row.earned),
      upcoming: rows.filter((row) => !row.earned),
    }
  })
}
