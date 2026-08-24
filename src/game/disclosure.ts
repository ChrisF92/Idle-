/** Progressive disclosure — GDD §122. Advanced controls wait for Process or Research. */

import type { GameState } from './types'

function processOwns(state: GameState, id: string): boolean {
  return (state.process?.purchased ?? []).includes(id)
}

/** ×10 on Salvage / Workshop shops. */
export function shopBulkTenUnlocked(state: GameState): boolean {
  return (
    processOwns(state, 'buy-ten') ||
    processOwns(state, 'shop-buy-max') ||
    processOwns(state, 'foundry-buy-max')
  )
}

/** MAX on Salvage / Workshop shops. */
export function shopBuyMaxUnlocked(state: GameState): boolean {
  return (
    processOwns(state, 'shop-buy-max') ||
    processOwns(state, 'foundry-buy-max') ||
    processOwns(state, 'yard-buy-max')
  )
}

/** DPS share, ROI-style breakdowns, and other expert readouts. */
export function advancedReadoutsUnlocked(state: GameState): boolean {
  if ((state.process?.purchased?.length ?? 0) > 0) return true
  if (Object.values(state.hiveResearch?.completed ?? {}).some((n) => n > 0)) return true
  if ((state.research?.unlocked?.length ?? 0) > 0) return true
  return false
}

/** Time-to-afford and Economy ROI on shop tiles. */
export function shopReadoutUnlocked(state: GameState): boolean {
  return processOwns(state, 'shop-readout')
}
