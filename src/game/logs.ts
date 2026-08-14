/** Foundry logs — short industrial notes. Written last, thin on purpose. */

import type { GameState } from './types'

export interface FoundryLogDef {
  id: string
  title: string
  body: string
  unlock: (state: GameState) => boolean
}

function career(state: GameState): number {
  return Math.max(state.meta.highestSectorEver ?? 0, state.combat.highestSector ?? 0)
}

export const FOUNDRY_LOGS: FoundryLogDef[] = [
  {
    id: 'dock',
    title: 'Dock 1',
    body: 'Hiveworks wakes. The lane is empty. Launch when the clamps let go.',
    unlock: () => true,
  },
  {
    id: 'foundry',
    title: 'Smelter',
    body: 'Slag in, plate out. The Foundry does not care what you were before.',
    unlock: (s) => career(s) >= 2,
  },
  {
    id: 'reliquary',
    title: 'Colour slots',
    body: 'Shards remember the Choir. Fit one per colour. Extra copies hum.',
    unlock: (s) => career(s) >= 3,
  },
  {
    id: 'furnace',
    title: 'Ash bank',
    body: 'Kills leave Choir-ash. Bank it. Heat is the only language the ranks speak.',
    unlock: (s) => career(s) >= 5,
  },
  {
    id: 'research',
    title: 'Three branches',
    body: 'Material. Energy. Observation. Focus one. The others still crawl.',
    unlock: (s) => career(s) >= 7,
  },
  {
    id: 'cruiser',
    title: 'Second hull',
    body: 'Cruiser frame on the rack. Rebuild is a hangar, not a funeral.',
    unlock: (s) => career(s) >= 8,
  },
  {
    id: 'act1',
    title: 'Sector 30',
    body: 'The first long wall. Protocols and Echo wait further up the lane.',
    unlock: (s) => career(s) >= 30 || s.meta.act1Cleared,
  },
  {
    id: 'echo',
    title: 'Rift',
    body: 'Short gauntlets. The ship keeps its Cores. The Choir does not.',
    unlock: (s) => career(s) >= 22,
  },
  {
    id: 'crew',
    title: 'Print shop',
    body: 'Gunner, Warden, Scavenger. They persist when the hull does not.',
    unlock: (s) => career(s) >= 51,
  },
  {
    id: 'tasks',
    title: 'The list',
    body: 'Capital does not open for a sector number. It opens when the work is done.',
    unlock: (s) => career(s) >= 72,
  },
  {
    id: 'capital',
    title: 'Second scale',
    body: 'No fighters. No towers. The ship itself gets heavier.',
    unlock: (s) => career(s) >= 75,
  },
  {
    id: 'reinforce',
    title: 'Second prestige',
    body: 'Rebuild swaps guns. Reinforce keeps the foundry and starts the lane again, meaner.',
    unlock: (s) => career(s) >= 80 || (s.meta.ascensionCount ?? 0) > 0,
  },
]

export function unlockedFoundryLogs(state: GameState): FoundryLogDef[] {
  return FOUNDRY_LOGS.filter((log) => log.unlock(state))
}
