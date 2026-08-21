/** GDD §102 Act 1 doors — career best Wave, not live sector. */
export const ACT1_CADENCE = {
  codex: 10,
  foundry: 20,
  workers: 30,
  economy: 40,
  directives: 50,
  rebuild: 70,
  foundryAdvanced: 90,
  yard: 90,
  reliquary: 110,
  furnace: 140,
  research: 170,
  process: 210,
  protocols: 250,
  echo: 275,
  specialists: 275,
  tasks: 275,
  capital: 300,
  reinforce: 300,
  /** Leftover Route B gate, kept in Wave space so it cannot fire in early Act 1. */
  routeB: 240,
} as const

export const ACT1_FINAL_WAVE = 300

export const NETWORK_CADENCE = {
  yield: 4,
  loom: 9,
  strikeRelay: 12,
  wardRelay: 15,
  yieldRelay: 20,
  loomRelay: 24,
  archive: 34,
  archiveRelay: 38,
  strikeLattice: 44,
  wardLattice: 48,
} as const

export const YARD_MIN_REBUILDS = 2
export const PROCESS_MIN_REBUILDS = 2
export const PROCESS_MIN_RESEARCH = 1
export const ECHO_MIN_PROTOCOL_RANKS = 1

/**
 * Core-print sector floor from the old S2→S6 Foundry move.
 * Prints still live in 10-wave bands; do not tie this to the Wave door number.
 */
export const FOUNDRY_PRINT_SHIFT = 4
