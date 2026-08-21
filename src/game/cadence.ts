/** PR76: one authoritative Act 1 unlock cadence. */
export const ACT1_CADENCE = {
  foundry: 6,
  codex: 10,
  rebuild: 12,
  reliquary: 16,
  yard: 20,
  routeB: 24,
  furnace: 28,
  research: 34,
  process: 42,
  protocols: 52,
  echo: 62,
  specialists: 68,
  tasks: 72,
  capital: 75,
  reinforce: 80,
} as const

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

/** Original first print was S2; preserve print spacing after Foundry moves. */
export const FOUNDRY_PRINT_SHIFT = ACT1_CADENCE.foundry - 2
