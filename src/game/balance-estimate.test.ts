/**
 * Theoretical run-time estimates (combat DPS vs wave hull).
 * These are active-play floors assuming Advance with no deaths / refit downtime.
 * Real runs run longer (research, industry, deaths, Pause repairs).
 */
import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { enemyForSector, totalEnemyHull } from './combat'
import { WAVES_PER_SECTOR } from './progression'
import {
  prestigeMomentumDamageBonus,
  prestigeMomentumProductionBonus,
} from './catalog'

function sectorClearSeconds(state: ReturnType<typeof createInitialState>, sector: number): number {
  const dps = Math.max(1, computeShipStats(state).damage)
  let hull = 0
  for (let w = 1; w <= WAVES_PER_SECTOR; w += 1) {
    hull += totalEnemyHull(enemyForSector(sector, w))
  }
  // Floor matches Hold Accountant; Advance can be a bit faster with focus fire.
  return Math.max(8, hull / dps)
}

function pushSeconds(
  state: ReturnType<typeof createInitialState>,
  fromSector: number,
  toSectorInclusive: number,
): number {
  let total = 0
  for (let s = fromSector; s <= toSectorInclusive; s += 1) {
    total += sectorClearSeconds(state, s)
  }
  return total
}

function formatMinutes(seconds: number): string {
  return `${(seconds / 60).toFixed(1)} min`
}

describe('balance estimates (USI-style acceleration)', () => {
  it('documents theoretical combat push times', () => {
    const fresh = createInitialState(0)
    const firstPrestige = pushSeconds(fresh, 1, 8)
    const firstAct1Leg = pushSeconds(fresh, 1, 30)

    const afterPrestige = createInitialState(0)
    afterPrestige.prestige.prestigeCount = 3
    afterPrestige.resources.prestigeMatter = 20
    afterPrestige.prestige.matterShop = { 'matter-blade': 3, 'matter-forge': 2 }
    afterPrestige.shipyard.moduleLevels = { 'pulse-cannon': 4 }
    afterPrestige.shipyard.unlockedModules = [
      'pulse-cannon',
      'plate-layer',
      'flak-array',
    ]
    afterPrestige.shipyard.modules = ['pulse-cannon', 'plate-layer']
    const rePrestige = pushSeconds(afterPrestige, 1, 8)

    const afterAscension = createInitialState(0)
    afterAscension.prestige.prestigeCount = 8
    afterAscension.meta.ascensionCount = 1
    afterAscension.resources.prestigeMatter = 60
    afterAscension.prestige.matterShop = {
      'matter-blade': 8,
      'matter-forge': 6,
      'matter-plating': 4,
    }
    afterAscension.shipyard.moduleLevels = { 'pulse-cannon': 8, 'heavy-lance': 5 }
    afterAscension.shipyard.unlockedModules = [
      'pulse-cannon',
      'plate-layer',
      'flak-array',
      'heavy-lance',
    ]
    afterAscension.shipyard.modules = ['pulse-cannon', 'plate-layer']
    afterAscension.ai.purchased = ['combat-chrono-2']
    const chrono = 2
    const ascendedPrestige = pushSeconds(afterAscension, 1, 8) / chrono

    // eslint-disable-next-line no-console -- intentional balance report
    console.log(
      [
        '=== Cosmic Idle balance estimates (combat-only floor) ===',
        `First run → S8 prestige:     ${formatMinutes(firstPrestige)} (${firstPrestige.toFixed(0)}s)`,
        `First run → S30 Act 1:       ${formatMinutes(firstAct1Leg)} (${firstAct1Leg.toFixed(0)}s)`,
        `Prestige #3 → S8 re-push:    ${formatMinutes(rePrestige)} (${rePrestige.toFixed(0)}s)`,
        `Post-Ascension → S8 @2×:     ${formatMinutes(ascendedPrestige)} (${ascendedPrestige.toFixed(0)}s)`,
        `Momentum dmg @3P/0A:         +${(prestigeMomentumDamageBonus(3, 0) * 100).toFixed(1)}%`,
        `Momentum dmg @8P/1A:         +${(prestigeMomentumDamageBonus(8, 1) * 100).toFixed(1)}%`,
        `Momentum prod @3P/0A:        +${(prestigeMomentumProductionBonus(3, 0) * 100).toFixed(1)}%`,
        'Real play adds research/industry/death downtime (~1.5–3× these floors).',
      ].join('\n'),
    )

    // Combat-only floor is a few minutes; real play (industry/research/deaths) is longer.
    expect(firstPrestige).toBeGreaterThan(60)
    expect(firstPrestige).toBeLessThan(45 * 60)

    // Returning runs must be meaningfully faster (USI snowball).
    expect(rePrestige).toBeLessThan(firstPrestige * 0.75)
    expect(ascendedPrestige).toBeLessThan(rePrestige * 0.85)

    // Full Act 1 single-leg combat floor stays under ~3h theoretical;
    // real careers split across prestiges.
    expect(firstAct1Leg).toBeLessThan(4 * 60 * 60)
  })
})
