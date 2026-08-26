/** GDD §102 Act 1 doors — career best Wave, not live sector. */
export const ACT1_CADENCE = {
  codex: 10,
  foundry: 20,
  workers: 30,
  economy: 40,
  directives: 50,
  rebuild: 210,
  foundryAdvanced: 90,
  yard: 90,
  reliquary: 110,
  furnace: 140,
  research: 170,
  process: 210,
  protocols: 250,
  /** @deprecated Echo is retired. Key kept so old saves / tests still resolve. */
  echo: 275,
  mastery: 275,
  /** Deferred from Act 1. Frame / Core / Relic identity is enough. */
  specialists: 999,
  /** Deferred from Act 1. Not a live door. */
  tasks: 999,
  /** Deferred from Act 1. Not a live door. */
  capital: 999,
  reinforce: 1000,
  /** @deprecated Route B does not exist. Unused leftover. */
  routeB: 999,
} as const

export const ACT1_FINAL_WAVE = 1000

/**
 * @deprecated Leftover Network-bar wave table. Bars never fill and never
 * multiply combat. Worker jobs own industrial bonuses. Not an Act 1 gate.
 */
export const NETWORK_CADENCE = {
  yield: 40,
  loom: 90,
  strikeRelay: 120,
  wardRelay: 150,
  yieldRelay: 200,
  loomRelay: 240,
  archive: 340,
  archiveRelay: 380,
  strikeLattice: 440,
  wardLattice: 480,
} as const

export const YARD_MIN_REBUILDS = 2
export const PROCESS_MIN_REBUILDS = 2
export const PROCESS_MIN_RESEARCH = 1
export const CHALLENGE_MIN_REBUILDS = 2
export const ECHO_MIN_PROTOCOL_RANKS = 1

/**
 * Core-print sector floor from the old S2→S6 Foundry move.
 * Prints still live in 10-wave bands; do not tie this to the Wave door number.
 */
export const FOUNDRY_PRINT_SHIFT = 4
