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
  'furnace',
  'research',
  'protocols',
  'process',
  'reinforce',
  'logs',
  'codex',
  'stats',
]

export const SCREEN_HELP: Record<string, ScreenHelpDef> = {
  dock: {
    title: 'Dock',
    body: [
      'Dock is home after every Sortie. Best Wave, Loadout, and Launch / Resume are the first things on this screen.',
      'Loadout, Workshop, and Rebuild are their own screens. Inventory is inside Loadout. Relics are on a Core sheet or in Inventory.',
      'Workshop spends Scrap. Rebuild shows projected Matter and can spend Matter even when Preview Rebuild is still inactive. The Wallet icon lists every currency.',
    ],
  },
  combat: {
    title: 'Sortie',
    body: [
      'Weapons fire automatically. The HUD shows Wave, Salvage, Scrap this run, Hull, Shield, DPS, and time. Tap Salvage or Scrap to see their per-second rate. Bosses get hull and shield bars at the top.',
      'Death or Extract ends the Sortie and returns you to Dock after the report. Salvage buys temporary Attack, Defense, and Economy upgrades. Core Levels use Scrap at Dock. Extract lives in the top-right menu.',
      'If you close mid-Sortie, combat freezes. Foundry, fabrication, and Worker jobs keep running.',
      'Worker Drones unlock at Wave 50 under Systems. Directives pause the Sortie at Wave 50, 100, 150, 200, and 250.',
    ],
  },
  network: {
    title: 'Worker Drones',
    body: [
      'Purpose: put a limited workforce on real industrial jobs. Main decision: processing now versus fabricating, researching, or growing more drones.',
      'Each job has an efficient range and then diminishing returns. The card shows exactly what one more Worker changes.',
      'Worker Drones live under Systems after Wave 50. They perform real work and never provide abstract damage, shield, or combat-resource multipliers.',
    ],
  },
  foundry: {
    title: 'Foundry',
    body: [
      'Purpose: turn combat income into crafted progression and new Cores. Main decision: what you are making next.',
      'Blueprints: track one Core. Fragments drop from matching enemy families as you push Waves; completion unlocks a timed Fabrication project.',
      'After Wave 50, Foundry and Worker Drones share Systems. Infrastructure lives under Fabrication. Processing, Fabrication, stock, and Mastery persist through Rebuild and continue offline.',
    ],
  },
  reliquary: {
    title: 'Relics',
    body: [
      'Purpose: deepen Core loadouts. Main decision: which Relic sits in each fitted Core.',
      'Relics unlock around Wave 320. They are physical items. Core sockets use Power, Optical, Ballistic, Shield, Industrial, and Universal classes. Family socket assignment and socket activation milestones are pending design. Fitting is free while Docked when both are authored. A Core may hold at most one Behavioural Relic. Tier II/III require Relic Tempering / Masterwork Tempering (PR9). Relics persist on Rebuild.',
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
      'Purpose: choose which underlying Hive rule improves next. Main decision: which available project to start.',
      'One project at a time. It runs during Sorties, at Dock, and offline. Worker Drones speed it up. Breakthroughs unlock mechanics. Progress persists across Rebuild. Queueing and auto-start are Process unlocks.',
    ],
  },
  slag: {
    title: 'Matter',
    body: [
      'Purpose: spend Rebuild Matter on permanent ranks that make the next cycle stronger.',
      'The Matter shop lives inside the Rebuild hangar.',
    ],
  },
  protocols: {
    title: 'Challenges',
    body: [
      'Purpose: prove this account can solve a modified version of the normal rules. Main decision: which restriction you take into a Sortie.',
      'Opens at Wave 250 after Process is online. Landing cards show name, restriction, goal Wave, best, reward, and rank. Tap for the exact sheet, then Start Challenge. Every run uses the normal Sortie engine from Wave 1.',
    ],
  },
  process: {
    title: 'Process',
    body: [
      'Purpose: automate behaviours you have already learned. Manual → QoL → Automation → Priorities → Conditions → cross-system orchestration.',
      'Opens at Wave 210 after two Rebuilds and a completed Research project. Process Points come from account mastery, never from time passing. Spend them on a capability graph; Automations, Rules, and Profiles sit on their own panes.',
      'Late Act 1 automates repetitive within-run and industrial actions. Process does not fly Sorties while the app is closed.',
    ],
  },
  reinforce: {
    title: 'Reinforce',
    body: [
      'Higher-order reset after Rebuild. The current loop has gone as far as it can.',
      'Revealed after defeating the Wave 1000 Choir Crown. The screen prints YOU RESET, YOU KEEP, and WHAT CHANGES. Confirm reconstructs the Hive. No Act 2 shop opens here.',
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
      'HOSTILES | BOSSES. Encountered identities and discovered Commander Traits. Soft counters for the loadout you are flying.',
      'Opens around Wave 30. Discoveries are recorded from Wave 1 when units actually spawn.',
    ],
  },
  stats: {
    title: 'More',
    body: [
      'Secondary systems live here so the bottom bar stays SORTIE, DOCK, SYSTEMS, MORE.',
      'Open stations are ready. Next system is the one major door ahead — Foundry, Workers, Furnace, and the rest — not a grey list of everything later.',
      'Save and settings live on the Settings pane.',
    ],
  },
}

export function screenHelpFor(tab: TabId): ScreenHelpDef {
  return SCREEN_HELP[tab] ?? SCREEN_HELP.stats
}
