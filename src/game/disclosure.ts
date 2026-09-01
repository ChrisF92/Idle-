/** Progressive disclosure — GDD §122. Advanced controls wait for Process or Research. */

import type { GameState } from './types'

function processOwns(state: GameState, id: string): boolean {
  return (state.process?.purchased ?? []).includes(id)
}

/** ×10 on Salvage / Workshop shops. */
export function shopBulkTenUnlocked(state: GameState): boolean {
  return (
    processOwns(state, 'bulk-purchase') ||
    processOwns(state, 'buy-max') ||
    processOwns(state, 'foundry-buy-max')
  )
}

/** MAX on Salvage / Workshop shops. */
export function shopBuyMaxUnlocked(state: GameState): boolean {
  return (
    processOwns(state, 'buy-max') ||
    processOwns(state, 'foundry-buy-max') ||
    processOwns(state, 'yard-buy-max')
  )
}

/** DPS share, ROI-style breakdowns, and other expert readouts. */
export function advancedReadoutsUnlocked(state: GameState): boolean {
  return processOwns(state, 'live-readouts') || (state.hiveResearch?.completedIds ?? []).includes('c2-combat-telemetry')
}

/** Time-to-afford and Economy ROI on shop tiles. */
export function shopReadoutUnlocked(state: GameState): boolean {
  return processOwns(state, 'live-readouts')
}
