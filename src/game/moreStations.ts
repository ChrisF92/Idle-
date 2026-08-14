/** More-tab station list and which doors to show now vs later. */

import type { GameState, TabId } from './types'
import { careerHighestSector, isSystemUnlocked, SYSTEM_UNLOCKS } from './progression'

export interface MoreStationDef {
  id: TabId
  name: string
  blurb: string
}

export const MORE_STATIONS: MoreStationDef[] = [
  { id: 'reliquary', name: 'Reliquary', blurb: 'Shards in colour slots.' },
  { id: 'furnace', name: 'Furnace', blurb: 'Choir-ash → Heat → ranks.' },
  { id: 'research', name: 'Research', blurb: 'Material / Energy / Observation.' },
  { id: 'codex', name: 'Codex', blurb: 'Families and hull roles.' },
  { id: 'yard', name: 'Yard Grid', blurb: 'Buildings. Arms apply on the next Rebuild.' },
  { id: 'slag', name: 'Slag Bank', blurb: 'Spend Rebuild Matter on hangar ranks.' },
  { id: 'process', name: 'Process', blurb: 'Achievements → automation.' },
  { id: 'protocols', name: 'Protocols', blurb: 'Restricted sorties.' },
  { id: 'echo', name: 'Echo Runs', blurb: 'Short gauntlets → Echo tree.' },
  { id: 'specialists', name: 'Specialists', blurb: 'Gunner / Warden / Scavenger.' },
  { id: 'tasks', name: 'Task List', blurb: 'Checklist into Capital.' },
  { id: 'capital', name: 'Capital', blurb: 'Second combat scale on the ship.' },
  { id: 'reinforce', name: 'Reinforce', blurb: 'Second prestige. Keeps the foundry.' },
]

/** Locked doors this many sectors ahead still show as Coming up. */
export const MORE_NEXT_WINDOW = 15

export function stationDoorSector(id: TabId): number {
  if (id === 'logs') return 0
  if (id === 'process') return 1
  if (id === 'yard' || id === 'slag') return 4
  if (id === 'capital') return 75
  if (id === 'reinforce') return 80
  const def = SYSTEM_UNLOCKS.find((s) => s.id === id)
  return def?.requiresSectorEver ?? 99
}

export function moreStationBuckets(state: GameState): {
  open: MoreStationDef[]
  next: MoreStationDef[]
  later: MoreStationDef[]
} {
  const career = careerHighestSector(state)
  const open: MoreStationDef[] = []
  const locked: MoreStationDef[] = []
  for (const station of MORE_STATIONS) {
    if (isSystemUnlocked(state, station.id)) open.push(station)
    else locked.push(station)
  }
  locked.sort((a, b) => stationDoorSector(a.id) - stationDoorSector(b.id))
  const cutoff = career + MORE_NEXT_WINDOW
  const next = locked.filter((s) => stationDoorSector(s.id) <= cutoff)
  const later = locked.filter((s) => stationDoorSector(s.id) > cutoff)
  return { open, next, later }
}
