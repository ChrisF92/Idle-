/** Foundry logs — short industrial notes as GDD doors open. */

import type { GameState } from './types'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'

export interface FoundryLogDef {
  id: string
  title: string
  body: string
  unlock: (state: GameState) => boolean
}

function career(state: GameState): number {
  return careerBestWave(state)
}

export const FOUNDRY_LOGS: FoundryLogDef[] = [
  {
    id: 'dock',
    title: 'Dock 1',
    body: 'Hiveworks wakes. Clamps hold a hull that still answers. Launch when the Hive is ready.',
    unlock: () => true,
  },
  {
    id: 'boss-1',
    title: 'First wreck',
    body: 'Wave 10 boss came in singing. Pulse cut the song. Plate held. Salvage tastes like slag.',
    unlock: (s) => career(s) >= ACT1_CADENCE.codex,
  },
  {
    id: 'foundry',
    title: 'Processing',
    body: 'Wreck stock in, permanent material out. The Foundry does not care what you were before. Material Mastery stays when the hull does not.',
    unlock: (s) => career(s) >= ACT1_CADENCE.foundry,
  },
  {
    id: 'core-prints',
    title: 'Blueprints',
    body: 'Wrecks leave Core fragments. Track a Blueprint and push Waves that drop that family. Complete it, fabricate the project, then equip the Core at Dock.',
    unlock: (s) => career(s) >= ACT1_CADENCE.foundry,
  },
  {
    id: 'network',
    title: 'Workers',
    body: 'Drones do not shoot. They take jobs. Scrap Field, Drone Fab, Sensor Net — the Hive fights; the floor keeps time.',
    unlock: (s) => career(s) >= ACT1_CADENCE.workers,
  },
  {
    id: 'directives',
    title: 'Directives',
    body: 'Every fifty Waves the Sortie pauses. Three orders. One choice. The hull you pick here is the hull you keep until Dock.',
    unlock: (s) => career(s) >= ACT1_CADENCE.directives,
  },
  {
    id: 'frigate',
    title: 'Rebuild',
    body: 'Rebuild carries knowledge backward through this loop. Cores wipe. Foundry, Research, and Matter stay. The hangar is a swap, not a funeral.',
    unlock: (s) => career(s) >= ACT1_CADENCE.rebuild || (s.prestige.prestigeCount ?? 0) >= 1,
  },
  {
    id: 'slag',
    title: 'Matter shop',
    body: 'Rebuild Matter sits in the hangar. Spend it on Offensive, Defensive, Industrial, Foundation, or Temporal ranks. Ranks beat banking.',
    unlock: (s) => (s.prestige.prestigeCount ?? 0) >= 1,
  },
  {
    id: 'yard',
    title: 'Infrastructure',
    body: 'Foundry opens Infrastructure projects at Wave 90. New Processors, Fabricators, storage, and specialist facilities all consume Fabricator time.',
    unlock: (s) => career(s) >= ACT1_CADENCE.yard,
  },
  {
    id: 'reliquary',
    title: 'Relic sockets',
    body: 'Recovered Relics seat in matching Core sockets while Docked. Power, Optical, Ballistic, Shield, and Industrial until Mastery 5. Spare copies plus Recovered Stock raise I–III.',
    unlock: (s) => career(s) >= ACT1_CADENCE.reliquary,
  },
  {
    id: 'furnace',
    title: 'Ash bank',
    body: 'Kills leave Choir-ash. Bank it for Heat. Heat is this Sortie. Ash persists until Rebuild.',
    unlock: (s) => career(s) >= ACT1_CADENCE.furnace,
  },
  {
    id: 'research',
    title: 'Three branches',
    body: 'Material. Energy. Observation. Focus one project at a time. Nodes persist across Rebuild.',
    unlock: (s) => career(s) >= ACT1_CADENCE.research,
  },
  {
    id: 'process',
    title: 'The process',
    body: 'You have already done this work by hand. Process automates what you have learned — QoL first, then actions, then profiles.',
    unlock: (s) => career(s) >= ACT1_CADENCE.process || (s.process?.purchased?.length ?? 0) > 0,
  },
  {
    id: 'protocols',
    title: 'Restricted sortie',
    body: 'Mute a system. Clear the goal Wave. The reward expands that system — Relic, recipe, Process, or Frame. Not a global damage chip.',
    unlock: (s) => career(s) >= ACT1_CADENCE.protocols,
  },
  {
    id: 'act1',
    title: 'Wave 1000',
    body: 'The Act 1 wall is the Wave 1000 Choir Crown. Rebuild has reached the limit of this architecture. Reinforce opens after that defeat.',
    unlock: (s) => career(s) >= ACT1_CADENCE.reinforce || s.meta.act1Cleared,
  },
  {
    id: 'reinforce',
    title: 'The loop ceiling',
    body: 'Rebuild carries knowledge backward. Reinforce changes the starting architecture of the Hive and the loop itself. No Act 2 shop.',
    unlock: (s) => s.meta.act1Cleared || (s.meta.ascensionCount ?? 0) > 0,
  },
]

export function unlockedFoundryLogs(state: GameState): FoundryLogDef[] {
  return FOUNDRY_LOGS.filter((log) => log.unlock(state))
}
