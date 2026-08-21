/** More-tab station list and which doors to show now vs later. */

import type { GameState, TabId } from './types'
import { isSystemUnlocked, SYSTEM_UNLOCKS } from './progression'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export interface MoreStationDef {
  id: TabId
  name: string
  blurb: string
}

export const MORE_STATIONS: MoreStationDef[] = [
  { id: 'network', name: 'Workers', blurb: 'Assign Worker Drones to processing, fabrication, construction, Research, and production.' },
  { id: 'furnace', name: 'Furnace', blurb: 'Turn Choir-ash into Heat. Decision: which temporary channels stay lit?' },
  { id: 'research', name: 'Research', blurb: 'Long-term branches. Decision: which field gets the focus bonus?' },
  { id: 'codex', name: 'Codex', blurb: 'Optional enemy-family and hull-role reference.' },
  { id: 'process', name: 'Process', blurb: 'Automation as relief: automate loops only after you have learned them manually.' },
  { id: 'protocols', name: 'Challenges', blurb: 'Restricted sorties that test a modified ruleset.' },
  { id: 'reinforce', name: 'Reinforce', blurb: 'Higher-order reset after the Rebuild layer is mature.' },
]

/** Locked doors this many Waves ahead still show as Coming up. */
export const MORE_NEXT_WINDOW = 40

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

export function moreStationBuckets(state: GameState): {
  open: MoreStationDef[]
  next: MoreStationDef[]
  later: MoreStationDef[]
} {
  const career = careerBestWave(state)
  const open: MoreStationDef[] = []
  const locked: MoreStationDef[] = []
  for (const station of MORE_STATIONS) {
    if (isSystemUnlocked(state, station.id)) open.push(station)
    else locked.push(station)
  }
  locked.sort((a, b) => stationDoorSector(a.id) - stationDoorSector(b.id))
  const cutoff = career + MORE_NEXT_WINDOW
  const candidates = locked.filter((s) => stationDoorSector(s.id) <= cutoff)
  const next = candidates.slice(0, 1)
  const nextIds = new Set(next.map((s) => s.id))
  const later = locked.filter((s) => !nextIds.has(s.id))
  return { open, next, later }
}
