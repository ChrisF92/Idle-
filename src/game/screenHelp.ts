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
      'Launch a sortie from here. Combat keeps running if you stay on Dock after Launch.',
      'Ordinary hull loss no longer docks you. Rebuild swaps the hull and wipes Salvage and Core levels for Rebuild Matter.',
    ],
  },
  combat: {
    title: 'Sortie',
    body: [
      'Weapons fire automatically. Waves come down the lane. The header shows sector, hull, and shield.',
      'After hull loss the ship retreats and keeps farming the last sector you could hold. Salvage ranks Pulse and Plate. Advance pushes sectors. Hold repeats the current fight — use it to farm a tracked Core. Retry Frontier attempts the sector that stopped you.',
      'Drones are assigned on the Network tab. They never appear here.',
    ],
  },
  network: {
    title: 'Network',
    body: [
      'Assign idle drones to bars. Strike raises damage. Ward raises shields. Yield, Loom, and Archive unlock later.',
      'Bars fill while you fight and crawl while docked. Bar levels reset on Rebuild. Drones and Links stay.',
      'Tap a bar name for live numbers, fill caps, and Relays.',
    ],
  },
  foundry: {
    title: 'Foundry',
    body: [
      'Smelt Salvage and scrap into stock. Recipe level makes the same craft faster and more productive.',
      'Prints: track one Core. Advance finds fragments as you push. Hold that Core’s family to farm it.',
      'Foundry Points buy extra smelters. Recipe progress persists on Rebuild. Fitted bits unequip.',
    ],
  },
  reliquary: {
    title: 'Reliquary',
    body: [
      'Fit one shard per colour slot for a permanent bonus. Extra copies raise resonance on the fitted shard.',
      'Red and orange open at sector 3. Later colours unlock with sector or Observation. Shards persist on Rebuild.',
    ],
  },
  furnace: {
    title: 'Furnace',
    body: [
      'Kills drop Choir-ash. Ash becomes Heat. Light channels to spend Heat on temporary boosts.',
      'Net Heat is generation minus channel drain. If Net stays negative, a channel goes dark. Upgrades persist on Rebuild.',
    ],
  },
  research: {
    title: 'Research',
    body: [
      'Kills feed Material, Energy, and Observation. Focus one branch to speed it up; the others still run.',
      'Small nodes are numbers. Breakthroughs unlock mechanics. Progress persists across Rebuild.',
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
      'Unspent Rebuild Matter still banks a small bonus. Ranks beat banking.',
    ],
  },
  protocols: {
    title: 'Protocols',
    body: [
      'Start a restricted sortie. One system is muted. Clear the goal sector for a permanent scaling bonus.',
      'Starting a Protocol resets Salvage, Core levels, and the current run. Ranks persist. Repeat clears raise the goal.',
    ],
  },
  echo: {
    title: 'Echo Runs',
    body: [
      'Short challenge runs. The ship keeps its Cores. Echo points buy a tree that persists.',
      'Opens at sector 22. Launch the run from Dock.',
    ],
  },
  process: {
    title: 'Process',
    body: [
      'Process Available is spendable. Process Earned is lifetime and does not drop when you buy.',
      'Buy automation for repeated Core, Network, and Foundry tasks. Quality-of-life nodes ease idle time. Opens after clearing sector 1.',
    ],
  },
  specialists: {
    title: 'Specialists',
    body: [
      'Rank Gunner, Warden, and Scavenger for permanent ship bonuses.',
      'They are not on the battlefield. Opens at sector 51.',
    ],
  },
  tasks: {
    title: 'Task List',
    body: [
      'A checklist of late-game objectives. Capital does not open from a sector number alone.',
      'Opens at sector 72. Finish the list, then Capital can light.',
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
      'Opens at sector 6. Optional reference.',
    ],
  },
  stats: {
    title: 'More',
    body: [
      'Extra systems live here so the bottom bar stays five tabs: Dock, Sortie, Network, Foundry, More.',
      'Open stations are ready. Coming up is the next door. Save and settings live on the Settings pane.',
    ],
  },
}

export function screenHelpFor(tab: TabId): ScreenHelpDef {
  return SCREEN_HELP[tab] ?? SCREEN_HELP.stats
}
