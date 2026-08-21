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
      'Launch a Sortie from here. Every run starts at Wave 1. Death or Extract returns you to Dock.',
      'Header shows Best Wave, Rebuild cycle, Scrap, and Matter. Close here and the Hive keeps processing; close mid-Sortie and that run freezes.',
      'Rebuild at Wave 70 trades this cycle’s Workshop and Scrap for permanent Matter. The hangar lists RESET, KEEP, and GAIN. Do not confirm until you mean it.',
    ],
  },
  combat: {
    title: 'Sortie',
    body: [
      'Weapons fire automatically. Waves come from all directions. The header shows Wave, hull, and shield.',
      'Death or Extract ends the Sortie and returns you to Dock. Every Launch starts at Wave 1. Salvage ranks Pulse and Plate for this run only.',
      'If you close mid-Sortie, combat freezes. Foundry, fabrication, and Worker jobs keep running.',
      'Worker Drones unlock at Wave 30 under Systems. Directives pause the Sortie at Wave 50, 100, 150, 200, and 250.',
    ],
  },
  network: {
    title: 'Worker Drones',
    body: [
      'Purpose: put a limited workforce on real industrial jobs. Main decision: processing now versus fabricating, researching, or growing more drones.',
      'Jobs have a hard cap. Extra drones on a full job do nothing — split the corps.',
      'Worker Drones live under Systems after Wave 30. They do not fire weapons or raise shields. Combat power comes from Cores, Workshop, and Foundry.',
    ],
  },
  foundry: {
    title: 'Foundry',
    body: [
      'Purpose: turn combat income into crafted progression and new Cores. Main decision: what you are making next.',
      'Prints: track one Core. Fragments drop from matching enemy families as you push Waves.',
      'After Wave 30, Foundry and Worker Drones share Systems. Construction opens at Wave 90 inside Foundry → Build. Recipe progress persists on Rebuild.',
    ],
  },
  reliquary: {
    title: 'Relics',
    body: [
      'Purpose: deepen Core loadouts. Main decision: which Relic sits in each fitted Core.',
      'Relic sockets open at Wave 110. Matching types only — Power, Shield, Industrial — until Core Mastery 5 adds Universal. Install and remove freely while Docked. Relics persist on Rebuild. Spare copies plus Slag Ingots raise authored I–III tiers; hoarded extras do not resonate.',
    ],
  },
  furnace: {
    title: 'Furnace',
    body: [
      'Purpose: spend stored cycle Ash to make this Sortie significantly stronger. Main decision: is this the run worth converting?',
      'Ash persists across Sorties this Rebuild cycle. Convert Ash to Heat, then light Weapons, Ward, or Yield. Heat dumps when you Dock.',
    ],
  },
  research: {
    title: 'Research',
    body: [
      'Purpose: choose which underlying Hive rule improves next. Main decision: which discipline gets the single research project.',
      'One project at a time. It runs during Sorties, at Dock, and offline. Sensor Net drones speed it up. Breakthroughs unlock mechanics; small nodes are numbers. Progress persists across Rebuild.',
    ],
  },
  yard: {
    title: 'Construction',
    body: [
      'Purpose: expand Foundry with processing gear and Rebuild arms. Main decision: what to build for the next cycle.',
      'Construction lives inside Foundry → Build. There is no separate Yard screen.',
    ],
  },
  slag: {
    title: 'Matter',
    body: [
      'Purpose: spend Rebuild Matter on permanent ranks that make the next cycle stronger.',
      'The Matter shop lives inside the Rebuild hangar. There is no separate Slag screen.',
    ],
  },
  protocols: {
    title: 'Protocols',
    body: [
      'Purpose: prove you understand a system by temporarily losing it. Pick a restriction, solve the run, and earn specialised permanent scaling.',
      'Starting a Protocol resets Salvage, Core levels, and the current run. Ranks persist. Repeat clears raise the goal.',
    ],
  },
  echo: {
    title: 'Echo Runs',
    body: [
      'Echo is retired. Challenges cover alternate combat tests.',
      'There is no Echo gauntlet or Echo tree in Act 1.',
    ],
  },
  process: {
    title: 'Process',
    body: [
      'Purpose: automate behaviours you have already learned, not skip systems before you understand them. Main decision: which solved loop becomes a Process purchase.',
      'Opens at Wave 210 after two Rebuilds and a completed Research project. Process Available is spendable; Process Earned is lifetime. Quality of life comes first; deeper priorities unlock after you buy something.',
    ],
  },
  specialists: {
    title: 'Specialists',
    body: [
      'Rank Gunner, Warden, and Scavenger for permanent ship bonuses.',
      'They are not on the battlefield. Opens around sector 68.',
    ],
  },
  tasks: {
    title: 'Task List',
    body: [
      'A checklist of late-game objectives. Capital does not open from a sector number alone.',
      'Opens around sector 72. Finish the list, then Capital can light.',
    ],
  },
  capital: {
    title: 'Capital',
    body: [
      'Upgrade Broadside, Bulkhead, and Hold with Salvage and Heat.',
      'Needs sector 75 and a finished Task List. Ranks persist across Rebuild.',
    ],
  },
  reinforce: {
    title: 'Reinforce',
    body: [
      'Second prestige. Keeps the Foundry and starts the lane again.',
      'Opens at sector 80. Confirm shows what you keep, reset, and gain.',
    ],
  },
  logs: {
    title: 'Foundry Logs',
    body: [
      'Short industrial notes as doors and bosses open.',
      'Optional flavour. Not a system you have to spend in.',
    ],
  },
  codex: {
    title: 'Codex',
    body: [
      'Enemy families and hull roles. Soft counters for the loadout you are flying.',
      'Opens around sector 10, once enemy families are worth comparing. Optional reference.',
    ],
  },
  stats: {
    title: 'More',
    body: [
      'Secondary systems live here so the bottom bar stays SORTIE, DOCK, SYSTEMS, MORE.',
      'Open stations are ready. Coming up is the next major door — Foundry, Workers, Furnace, and the rest — not a grey list of everything later.',
      'Save and settings live on the Settings pane.',
    ],
  },
}

export function screenHelpFor(tab: TabId): ScreenHelpDef {
  return SCREEN_HELP[tab] ?? SCREEN_HELP.stats
}
