/** Foundry logs — industrial notes as doors and bosses open. */

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
    body: 'Hiveworks wakes. Clamps hold a hull that still answers. The crew is gone. The process is not. Launch when the Hive is ready.',
    unlock: () => true,
  },
  {
    id: 'boss-1',
    title: 'First wreck',
    body: 'Wave 10 boss came in singing. Pulse cut the song. Plate held. Salvage tastes like slag and someone else’s shift.',
    unlock: (s) => career(s) >= 1,
  },
  {
    id: 'network',
    title: 'Corps',
    body: 'Drones do not shoot. They fill bars. Strike and Ward first — the ship fights; the corps keeps the lights on.',
    unlock: () => true,
  },
  {
    id: 'foundry',
    title: 'Smelter',
    body: 'Slag in, plate out. The Foundry does not care what you were before. Recipe XP stays when the hull does not.',
    unlock: (s) => career(s) >= 2,
  },
  {
    id: 'core-prints',
    title: 'Prints',
    body: 'Wrecks leave Core fragments. Track a print and push Waves that drop that family. Assemble in the Foundry, then fit it at Dock.',
    unlock: (s) => career(s) >= 2,
  },
  {
    id: 'reliquary',
    title: 'Relic sockets',
    body: 'Recovered Relics seat in matching Core sockets while Docked. Power, Optical, Ballistic, Shield, and Industrial until Mastery 5 or Wave 275 adds Universal. Spare copies plus Slag Ingots raise I–III; extras do not resonate.',
    unlock: (s) => career(s) >= 3,
  },
  {
    id: 'frigate',
    title: 'Frigate rack',
    body: 'A second frame on the rail. Rebuild is a hangar swap, not a funeral. Cores wipe. The foundry does not. Charge Prism prints wait in the smelter once you have the fragments.',
    unlock: (s) => career(s) >= 4,
  },
  {
    id: 'furnace',
    title: 'Ash bank',
    body: 'Kills leave Choir-ash. Bank it for Heat. Flares collect themselves — do not tap the dark looking for scraps.',
    unlock: (s) => career(s) >= 5,
  },
  {
    id: 'research',
    title: 'Three branches',
    body: 'Material. Energy. Observation. Focus one; the others still crawl. Kills write the notes. Nodes persist across Rebuild.',
    unlock: (s) => career(s) >= 7,
  },
  {
    id: 'cruiser',
    title: 'Second hull',
    body: 'Cruiser frame on the rack. More slots. Same lane. Rebuild if the Pulse has nothing left to say.',
    unlock: (s) => career(s) >= 8,
  },
  {
    id: 'directives',
    title: 'Directives',
    body: 'Every fifty Waves the Sortie pauses. Three orders. One choice. The hull you pick here is the hull you keep until Dock.',
    unlock: (s) => career(s) >= 5,
  },
  {
    id: 'yard',
    title: 'Construction',
    body: 'Foundry grows a construction floor at Wave 90. Buildings stay. Ingots arm the next Rebuild, not this hull.',
    unlock: (s) => Math.max(s.meta.bestWave ?? 0, s.combat.bestWave ?? 0) >= 90,
  },
  {
    id: 'slag',
    title: 'Slag Bank',
    body: 'Rebuild Matter sits in the header and banks a trickle. The Slag Bank spends it on hangar ranks — edge, forge, plate. Ranks beat banking.',
    unlock: (s) => (s.prestige.prestigeCount ?? 0) >= 1,
  },
  {
    id: 'boss-14',
    title: 'Four by four',
    body: 'Yard grows at 14. The press wants more floor. The Choir does not care about your floor plan.',
    unlock: (s) => career(s) >= 14,
  },
  {
    id: 'protocols',
    title: 'Restricted sortie',
    body: 'Mute a system. Clear the goal Wave. Rank what you starved. Challenges are optional. The list later is not.',
    unlock: (s) => career(s) >= 18,
  },
  {
    id: 'echo',
    title: 'Rift',
    body: 'Short gauntlets used to live here. Echo is retired; Challenges cover alternate combat tests.',
    unlock: () => false,
  },
  {
    id: 'heavy',
    title: 'Heavy rack',
    body: 'Heavy Cruiser at 24. Four weapons if you earned the hangar. The lane does not get shorter.',
    unlock: (s) => career(s) >= 24,
  },
  {
    id: 'act1',
    title: 'Wave 300',
    body: 'The first long wall. Not an ending. Challenges are already behind you if you took the door.',
    unlock: (s) => career(s) >= 30 || s.meta.act1Cleared,
  },
  {
    id: 'green-slot',
    title: 'Fifth colour',
    body: 'Green opens at 32. The Reliquary is almost a full chord. Extra shards still hum.',
    unlock: (s) => career(s) >= 32,
  },
  {
    id: 'battlecruiser',
    title: 'Battlecruiser',
    body: 'Forty-one. A heavier keel. Utility still waits on the Pathfinder if you want two sockets that do not shoot.',
    unlock: (s) => career(s) >= 41,
  },
  {
    id: 'crew',
    title: 'Print shop',
    body: 'Gunner, Warden, Scavenger. They persist when the hull does not. Print them. Rank them. They are not on the field.',
    unlock: (s) => career(s) >= 51,
  },
  {
    id: 'process',
    title: 'The process',
    body: 'Achievements fund automation. Auto-Salvage. Bar Balance. Safe Hold. Ghost Sortie. The crew would have named this the night shift.',
    unlock: (s) => (s.meta.completedAchievements?.length ?? 0) > 0 || s.meta.aiUnlocked,
  },
  {
    id: 'tasks',
    title: 'The list',
    body: 'Capital does not open for a Wave number. It opens when the work is done. Clear Wave 720. Rebuild. Light the Furnace. Rank a Protocol. Finish an Echo. Print a Specialist.',
    unlock: (s) => career(s) >= 72,
  },
  {
    id: 'capital',
    title: 'Second scale',
    body: 'No fighters. No towers. Broadside, Bulkhead, Hold — the ship itself gets heavier. Capital Hull is a keel, not a wing.',
    unlock: (s) => career(s) >= 75,
  },
  {
    id: 'reinforce',
    title: 'The loop ceiling',
    body: 'Rebuild has gone as far as this architecture allows. Reinforce is the next scale — the Hive starting rules begin to shift.',
    unlock: (s) => s.meta.act1Cleared || (s.meta.ascensionCount ?? 0) > 0,
  },
]

export function unlockedFoundryLogs(state: GameState): FoundryLogDef[] {
  return FOUNDRY_LOGS.filter((log) => log.unlock(state))
}
