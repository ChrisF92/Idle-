/** More-tab secondary systems and the single next major door (GDD §109, §121). */

import type { GameState, TabId } from './types'
import { isSystemUnlocked, SYSTEM_UNLOCKS } from './progression'
import { ACT1_CADENCE } from './cadence'

export type DoorHome = 'more' | 'systems'

export interface MoreStationDef {
  id: TabId
  name: string
  blurb: string
}

export interface MajorDoorDef extends MoreStationDef {
  wave: number
  home: DoorHome
}

/** Secondary systems only. Industrial doors live under Systems. */
export const MORE_STATIONS: MoreStationDef[] = [
  { id: 'codex', name: 'Codex', blurb: 'Optional enemy-family and hull-role reference.' },
  { id: 'protocols', name: 'Challenges', blurb: 'Restricted sorties that test a modified ruleset.' },
  { id: 'reinforce', name: 'Reinforce', blurb: 'Higher-order reset after the Rebuild layer is mature.' },
]

/**
 * Act 1 doors advertised one at a time. Workshop, Directives, Rebuild, Relics,
 * and Construction expand screens the player already has — they are not listed here.
 */
export const MAJOR_DOORS: MajorDoorDef[] = [
  {
    id: 'codex',
    name: 'Codex',
    blurb: 'Optional enemy-family and hull-role reference.',
    wave: ACT1_CADENCE.codex,
    home: 'more',
  },
  {
    id: 'foundry',
    name: 'Foundry',
    blurb: 'Turn Salvage into crafted stock, prints, and fitted bits.',
    wave: ACT1_CADENCE.foundry,
    home: 'systems',
  },
  {
    id: 'network',
    name: 'Worker Drones',
    blurb: 'Assign a limited corps to processing, fabrication, and construction.',
    wave: ACT1_CADENCE.workers,
    home: 'systems',
  },
  {
    id: 'furnace',
    name: 'Furnace',
    blurb: 'Convert Ash into Heat and spend it to make this Sortie significantly stronger.',
    wave: ACT1_CADENCE.furnace,
    home: 'systems',
  },
  {
    id: 'research',
    name: 'Research',
    blurb: 'Permanent branching technology. Decision: which underlying Hive rule improves next?',
    wave: ACT1_CADENCE.research,
    home: 'systems',
  },
  {
    id: 'process',
    name: 'Process',
    blurb: 'Automation as relief: automate loops only after you have learned them manually.',
    wave: ACT1_CADENCE.process,
    home: 'systems',
  },
  {
    id: 'protocols',
    name: 'Challenges',
    blurb: 'Restricted sorties that test a modified ruleset.',
    wave: ACT1_CADENCE.protocols,
    home: 'more',
  },
  {
    id: 'reinforce',
    name: 'Reinforce',
    blurb: 'Higher-order reset after the Rebuild layer is mature.',
    wave: ACT1_CADENCE.reinforce,
    home: 'more',
  },
]

export function stationDoorSector(id: TabId): number {
  if (id === 'logs') return 0
  if (id === 'network') return ACT1_CADENCE.workers
  if (id === 'process') return ACT1_CADENCE.process
  if (id === 'yard') return ACT1_CADENCE.yard
  if (id === 'slag') return ACT1_CADENCE.rebuild
  if (id === 'capital') return ACT1_CADENCE.capital
  if (id === 'reinforce') return ACT1_CADENCE.reinforce
  const def = SYSTEM_UNLOCKS.find((s) => s.id === id)
  return def?.requiresSectorEver ?? 99
}

export function nextMajorDoor(state: GameState): MajorDoorDef | null {
  return MAJOR_DOORS.find((door) => !isSystemUnlocked(state, door.id)) ?? null
}

export function moreStationBuckets(state: GameState): {
  open: MoreStationDef[]
  next: MajorDoorDef[]
  later: MajorDoorDef[]
} {
  const open = MORE_STATIONS.filter((station) => isSystemUnlocked(state, station.id))
  const nextDoor = nextMajorDoor(state)
  const next = nextDoor ? [nextDoor] : []
  return { open, next, later: [] }
}

export function isSystemsNavTab(tab: TabId): boolean {
  return tab === 'foundry' || tab === 'network' || tab === 'yard' || tab === 'furnace' || tab === 'research'
}

export function isMoreNavTab(tab: TabId): boolean {
  return (
    tab === 'stats' ||
    tab === 'reliquary' ||
    tab === 'slag' ||
    tab === 'protocols' ||
    tab === 'echo' ||
    tab === 'process' ||
    tab === 'specialists' ||
    tab === 'tasks' ||
    tab === 'capital' ||
    tab === 'reinforce' ||
    tab === 'logs' ||
    tab === 'codex'
  )
}
