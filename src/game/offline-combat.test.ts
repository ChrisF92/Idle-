import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import {
  applyOfflineCatchUp,
  OFFLINE_COMBAT_EFFICIENCY,
  OFFLINE_ESSENCE_FACTOR,
  OFFLINE_MAX_CLEARS_PER_HOUR,
  OFFLINE_MIN_CLEAR_SECONDS,
} from './offline'
import { estimateHoldClearRewards, estimateHoldFarmRates } from './combat'
import { combatSpeedMultiplier } from './catalog'
import { equipPostTutorialLoadout } from './testHelpers'

describe('offline combat rewards', () => {
  it('matches Hold clear payout × efficiency / offline clear time', () => {
    const state = equipPostTutorialLoadout(createInitialState(0))
    state.combat.sector = 8
    state.combat.campaign = false
    state.combat.docked = false
    state.meta.highestSectorEver = 8

    const hours = 2
    const { state: next, report } = applyOfflineCatchUp(
      state,
      hours * 60 * 60 * 1000,
    )

    const rewards = estimateHoldClearRewards(state)
    const { clearSeconds } = estimateHoldFarmRates(state)
    const chrono = combatSpeedMultiplier(state)
    const offlineClear = Math.max(
      OFFLINE_MIN_CLEAR_SECONDS,
      clearSeconds / Math.max(1, chrono),
    )
    const expectedClears =
      hours *
      Math.min(
        (3600 / offlineClear) * OFFLINE_COMBAT_EFFICIENCY,
        OFFLINE_MAX_CLEARS_PER_HOUR,
      )

    expect(report?.combatClears).toBeCloseTo(expectedClears, 5)
    expect(next.resources.scrap - state.resources.scrap).toBeCloseTo(
      rewards.scrap * expectedClears,
      5,
    )
    expect(next.resources.salvage - state.resources.salvage).toBeCloseTo(
      rewards.salvage * expectedClears,
      5,
    )
    expect(next.resources.data - state.resources.data).toBeCloseTo(
      rewards.data * expectedClears,
      5,
    )
  })

  it('grants boss essence while Holding a boss sector offline', () => {
    const state = equipPostTutorialLoadout(createInitialState(0))
    state.combat.sector = 10
    state.combat.campaign = false
    state.combat.docked = false
    state.meta.highestSectorEver = 10

    const rewards = estimateHoldClearRewards(state)
    expect(rewards.essence).toBeGreaterThan(0)

    const { state: next, report } = applyOfflineCatchUp(state, 60 * 60 * 1000)
    const essenceGain = next.resources.essence - state.resources.essence
    expect(essenceGain).toBeGreaterThan(0)
    expect(essenceGain).toBeCloseTo(
      rewards.essence * (report?.combatClears ?? 0) * OFFLINE_ESSENCE_FACTOR,
      5,
    )
  })

  it('applies Combat Chrono to offline clear pace on slow sectors', () => {
    // Weak loadout on a high sector → live clear time well above the offline floor.
    const wall = equipPostTutorialLoadout(createInitialState(0))
    wall.combat.sector = 28
    wall.combat.highestSector = 28
    wall.meta.highestSectorEver = 28
    wall.combat.docked = false

    const slow = structuredClone(wall)
    const fast = structuredClone(wall)
    fast.ai.purchased = ['combat-chrono-1', 'combat-chrono-2']

    const liveSlow = estimateHoldFarmRates(slow).clearSeconds
    expect(liveSlow / 2).toBeGreaterThan(OFFLINE_MIN_CLEAR_SECONDS)
    // Stay under the hourly clear cap so Chrono can move the needle.
    expect(
      (3600 / (liveSlow / 2)) * OFFLINE_COMBAT_EFFICIENCY,
    ).toBeLessThan(OFFLINE_MAX_CLEARS_PER_HOUR)

    const { report: wallSlow } = applyOfflineCatchUp(slow, 60 * 60 * 1000)
    const { report: wallFast } = applyOfflineCatchUp(fast, 60 * 60 * 1000)
    expect(wallFast?.combatClears ?? 0).toBeGreaterThan(wallSlow?.combatClears ?? 0)
  })

  it('keeps offline combat below full live Hold rates', () => {
    const state = equipPostTutorialLoadout(createInitialState(0))
    state.combat.sector = 12
    state.combat.docked = false
    const rates = estimateHoldFarmRates(state)
    const { report } = applyOfflineCatchUp(state, 3600 * 1000)
    const liveClearsPerHour = 3600 / rates.clearSeconds
    expect(report?.combatClears ?? 0).toBeLessThan(liveClearsPerHour)
    expect(report?.combatClears ?? 0).toBeLessThanOrEqual(
      OFFLINE_MAX_CLEARS_PER_HOUR + 1e-9,
    )
    expect(OFFLINE_COMBAT_EFFICIENCY).toBeLessThan(1)
  })
})
