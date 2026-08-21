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
      'Worker Drones unlock at Wave 30 and are assigned under More → Workers.',
    ],
  },
  network: {
    title: 'Worker Drones',
    body: [
      'Purpose: put a limited workforce on real industrial jobs. Main decision: processing now versus fabricating, researching, or growing more drones.',
      'Jobs have a hard cap. Extra drones on a full job do nothing — split the corps.',
      'Worker Drones do not fire weapons or raise shields. Combat power comes from Cores, Workshop, and Foundry.',
    ],
  },
  foundry: {
    title: 'Foundry',
    body: [
      'Purpose: turn combat income into crafted progression and new Cores. Main decision: what you are making next.',
      'Prints: track one Core. Advance finds fragments as you push. Hold that Core’s family to farm it.',
      'Foundry Points buy extra smelters. Recipe progress persists on Rebuild. Fitted bits unequip.',
    ],
  },
  reliquary: {
    title: 'Reliquary',
    body: [
      'Purpose: specialise permanent passive bonuses. Main decision: which shard earns each limited colour slot.',
      'Reliquary arrives after the first Rebuild layer is familiar. Later colours unlock with progression or Observation. Shards persist on Rebuild.',
    ],
  },
  furnace: {
    title: 'Furnace',
    body: [
      'Purpose: convert stored Choir-ash into a temporary push budget. Main decision: which channels deserve limited Heat right now.',
      'Net Heat is generation minus channel drain. If Net stays negative, a channel goes dark. Upgrades persist on Rebuild.',
    ],
  },
  research: {
    title: 'Research',
    body: [
      'Purpose: choose the account’s long-term development direction. Main decision: which branch gets the focus multiplier; the others still progress.',
      'Small nodes are numbers. Breakthroughs unlock mechanics. Progress persists across Rebuild.',
    ],
  },
  yard: {
    title: 'Yard Grid',
    body: [
      'Purpose: build an industrial engine between Rebuilds. Main decision: what the Yard should prepare for your next Rebuild.',
      'Spend Ingots on arms. Arms apply on the next Rebuild, not this hull.',
    ],
  },
  slag: {
    title: 'Slag Bank',
    body: [
      'Purpose: this is the first true exponential meta layer. Spend Rebuild Matter on permanent ranks that make the next push visibly stronger.',
      'Damage and production ranks compound multiplicatively; other permanent ranks accelerate in their own niche. Unspent Matter gives only a tiny fallback bonus.',
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
      'Purpose: compact combat/build tests rather than another normal progression lane. The ship keeps its Cores; Echo rewards persist.',
      'Opens around sector 62 after you have cleared at least one Protocol rank.',
    ],
  },
  process: {
    title: 'Process',
    body: [
      'Purpose: remove chores you have already learned, not skip systems before you understand them. Process Available is spendable; Process Earned is lifetime.',
      'Opens around sector 42 after at least two Rebuilds and some Research. Banked Process Points wait for you until then.',
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
      'Extra systems live here so the bottom bar stays five tabs: Dock, Sortie, Network, Foundry, More.',
      'Open stations are ready. Coming up is the next door. Save and settings live on the Settings pane.',
    ],
  },
}

export function screenHelpFor(tab: TabId): ScreenHelpDef {
  return SCREEN_HELP[tab] ?? SCREEN_HELP.stats
}
