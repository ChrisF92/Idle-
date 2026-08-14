/** Player-facing help for each live screen. Keep this free of USI / designer jargon. */

import type { TabId } from './types'

export interface ScreenHelpDef {
  title: string
  body: string[]
}

/** Tabs the app actually renders. */
export const LIVE_SCREENS: TabId[] = [
  'dock',
  'combat',
  'network',
  'foundry',
  'reliquary',
  'furnace',
  'research',
  'yard',
  'slag',
  'protocols',
  'echo',
  'process',
  'specialists',
  'tasks',
  'capital',
  'reinforce',
  'logs',
  'codex',
  'stats',
]

export const SCREEN_HELP: Record<string, ScreenHelpDef> = {
  dock: {
    title: 'Dock',
    body: [
      'Home. Launch a sortie from here. Combat keeps running if you stay on Dock after Launch.',
      'Extract returns you without wiping Cores. Rebuild swaps the hull and wipes Salvage and Core levels for Rebuild Matter.',
    ],
  },
  combat: {
    title: 'Sortie',
    body: [
      'The ship sits at the bottom. Waves come down the lane. Spend Salvage on Cores under the field.',
      'Drones belong on the Network tab — they never appear here and they never shoot.',
    ],
  },
  network: {
    title: 'Network',
    body: [
      'Assign drones to bars. Strike raises damage. Ward raises shields. Later bars unlock as you push sectors.',
      'Drones fill over time. They are not ships. They never fly on Sortie.',
    ],
  },
  foundry: {
    title: 'Foundry',
    body: [
      'Smelt salvage into materials, then into bits you can fit. Recipe levels persist when you Rebuild.',
      'Opens after you clear sector 2.',
    ],
  },
  reliquary: {
    title: 'Reliquary',
    body: [
      'Fit one shard per colour. Extra copies charge the same slot.',
      'Red and orange open at sector 3. Pink waits until 6. Green opens later.',
    ],
  },
  furnace: {
    title: 'Furnace',
    body: [
      'Kills drop Choir-ash on their own. Bank ash into Heat, then buy always-on ranks.',
      'Opens at sector 5. Flares collect themselves — do not tap looking for scraps.',
    ],
  },
  research: {
    title: 'Research',
    body: [
      'Kills feed Material, Energy, and Observation. Focus one; the others still crawl.',
      'Nodes persist across Rebuild. Opens at sector 7.',
    ],
  },
  yard: {
    title: 'Yard Grid',
    body: [
      'Place buildings that run even while you are docked. They make Ore, Flux, and Ingots.',
      'Spend Ingots on arms. Arms apply on the next Rebuild, not this hull.',
    ],
  },
  slag: {
    title: 'Slag Bank',
    body: [
      'Spend Rebuild Matter on hangar ranks — damage, production, hull, drones, and more.',
      'Unspent Rebuild Matter still banks a small bonus in the header. Ranks beat banking.',
    ],
  },
  protocols: {
    title: 'Protocols',
    body: [
      'Restricted sorties. One system is muted. Clear the goal sector to rank what you starved.',
      'Cores and Salvage wipe when a Protocol starts. Optional until the Task List.',
    ],
  },
  echo: {
    title: 'Echo Runs',
    body: [
      'Short gauntlets. The ship keeps its Cores. Echo points buy a tree that persists.',
      'Opens at sector 22. Launch the run from Dock.',
    ],
  },
  process: {
    title: 'Process',
    body: [
      'Achievements grant Process points. Spend them on automation and quality-of-life.',
      'Opens after First Blood (clear sector 1). Points persist across Rebuild.',
    ],
  },
  specialists: {
    title: 'Specialists',
    body: [
      'Print Gunner, Warden, and Scavenger. Rank them. They persist when the hull does not.',
      'They are not on the battlefield. Opens at sector 51.',
    ],
  },
  tasks: {
    title: 'Task List',
    body: [
      'A checklist. Capital does not open for a sector number alone.',
      'Opens at sector 72. Finish the list, then Capital can light.',
    ],
  },
  capital: {
    title: 'Capital',
    body: [
      'Second combat scale on this ship: Broadside, Bulkhead, Hold.',
      'No fighters. No towers. Needs sector 75 and a finished Task List.',
    ],
  },
  reinforce: {
    title: 'Reinforce',
    body: [
      'Second prestige. Rebuild swaps guns. Reinforce keeps the foundry and starts the lane again, meaner.',
      'Opens at sector 80.',
    ],
  },
  logs: {
    title: 'Foundry Logs',
    body: [
      'Short industrial notes as doors and bosses open.',
      'Flavour, not a system you have to spend in.',
    ],
  },
  codex: {
    title: 'Codex',
    body: [
      'Enemy families and hull roles. Soft counters for the loadout you are flying.',
      'Opens at sector 6. It remembers what you have seen.',
    ],
  },
  stats: {
    title: 'More',
    body: [
      'Extra systems live here so the bottom bar stays five tabs: Dock, Sortie, Network, Foundry, More.',
      'Open stations are ready. Coming up is the next door. Save and settings sit at the bottom.',
    ],
  },
}

export function screenHelpFor(tab: TabId): ScreenHelpDef {
  return SCREEN_HELP[tab] ?? SCREEN_HELP.stats
}
