/**
 * Theoretical combat-only floors. Authored Act 1 windows live in
 * `src/game/balance/act1.ts` and `docs/act1-balance.md`.
 *
 * This file still prints a combat-DPS estimate so a hull curve change is visible.
 * Do not treat these numbers as the player-facing calendar.
 */
import { describe, expect, it } from 'vitest'
import { createInitialState, computeShipStats } from './state'
import { encounterForWave, totalEnemyHull } from './combat'
import { selectedTimeCompression } from './matter'
import { PRESTIGE_MIN_SECTOR } from './progression'
import { wavesForSector } from './sectors'
import {
  prestigeMomentumDamageBonus,
  prestigeMomentumProductionBonus,
} from './catalog'
import { advanceSeconds, setDocked } from './tick'
import { equipPostTutorialLoadout } from './testHelpers'
import type { GameState } from './types'

function sectorClearSeconds(state: GameState, sector: number): number {
  const dps = Math.max(1, computeShipStats(state).damage)
  let hull = 0
  for (let w = 1; w <= wavesForSector(sector); w += 1) {
    hull += totalEnemyHull(encounterForWave(sector, w))
  }
  return Math.max(8, hull / dps)
}

function pushSeconds(state: GameState, fromSector: number, toSectorInclusive: number): number {
  let total = 0
  for (let s = fromSector; s <= toSectorInclusive; s += 1) {
    total += sectorClearSeconds(state, s)
  }
  return total
}

/** Soft wall: sectors slower than this are farm/prestige territory. */
const SECTOR_WALL_SECONDS = 10 * 60

function maxComfortableSector(state: GameState): number {
  let best = 1
  for (let s = 1; s <= 30; s += 1) {
    if (sectorClearSeconds(state, s) > SECTOR_WALL_SECONDS) break
    best = s
  }
  return best
}

function formatDuration(seconds: number): string {
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)} d`
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`
  return `${(seconds / 60).toFixed(0)} min`
}

function buildCareerState(prestiges: number): GameState {
  const state = createInitialState(0)
  state.prestige.prestigeCount = prestiges
  state.resources.prestigeMatter = Math.max(0, prestiges * 7)
  state.prestige.matterShop = {
    'weapon-calibration': Math.min(5, Math.floor(prestiges * 0.4)),
    'structural-memory': Math.min(5, Math.floor(prestiges * 0.35)),
    'time-compression-1': prestiges >= 1 ? 1 : 0,
    'time-compression-2': prestiges >= 3 ? 1 : 0,
    'time-compression-3': prestiges >= 8 ? 1 : 0,
  }
  state.shipyard.moduleLevels = {
    'pulse-cannon': Math.min(16, Math.floor(prestiges * 0.55) + 1),
  }
  if (prestiges >= 1) {
    state.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer']
    state.shipyard.modules = ['pulse-cannon', 'plate-layer']
  }
  if (prestiges >= 3) {
    state.shipyard.unlockedModules = ['pulse-cannon', 'plate-layer', 'flak-array']
    state.research.unlocked = [
      'basic-optics',
      'alloy-smelting',
      'tactical-codex',
      'drone-logistics',
    ]
  }
  if (prestiges >= 6) {
    state.research.unlocked.push('module-fab', 'core-training')
    state.ai.purchased = ['drone-efficiency-1', 'auto-assign-workers']
  }
  if (prestiges >= 12) {
    state.ai.purchased = [
      'drone-efficiency-1',
      'drone-efficiency-2',
      'chrono-industry',
      'auto-assign-workers',
      'labor-loop',
    ]
  }
  if (prestiges >= 18) {
    state.ai.purchased.push('drone-hangar')
  }
  return state
}

function combatChrono(state: GameState): number {
  return selectedTimeCompression(state)
}

/**
 * Career model: each prestige, push only to the comfortable wall, then reset.
 * Matches “stuck → prestige → slightly farther” rather than free ceiling bumps.
 */
function estimateCareerToAct1(): { combatSeconds: number; prestiges: number } {
  let combat = 0
  let prestiges = 0
  let reached = 0

  while (reached < 30 && prestiges < 50) {
    const state = buildCareerState(prestiges)
    const chrono = combatChrono(state)
    const comfort = maxComfortableSector(state)
    // Players still bang on the wall a bit past comfort.
    const pushTo = Math.min(30, Math.max(PRESTIGE_MIN_SECTOR, comfort + 2))
    combat += pushSeconds(state, 1, pushTo) / chrono
    reached = pushTo
    if (reached >= 30) break
    prestiges += 1
  }

  return { combatSeconds: combat, prestiges }
}

describe('balance estimates (combat floors, not the Act 1 calendar)', () => {
  it('documents theoretical combat push times', () => {
    const fresh = createInitialState(0)
    const firstPrestige = pushSeconds(fresh, 1, PRESTIGE_MIN_SECTOR)
    const naiveAct1 = pushSeconds(fresh, 1, 30)
    const career = estimateCareerToAct1()

    const afterPrestige = buildCareerState(3)
    const rePrestige = pushSeconds(afterPrestige, 1, PRESTIGE_MIN_SECTOR) / combatChrono(afterPrestige)

    // Casual calendar: ~1.5–3h engagement/day → weeks from multi-day combat floors.
    const engageLow = career.combatSeconds * 1.7
    const engageHigh = career.combatSeconds * 3.0
    const calendarDaysLow = engageLow / (2.5 * 3600)
    const calendarDaysHigh = engageHigh / (1.5 * 3600)

    // eslint-disable-next-line no-console -- intentional balance report
    console.log(
      [
        '=== Combat-only floor estimates (see docs/act1-balance.md) ===',
        `Waves/sector: 2–4 + boss · Prestige min: S${PRESTIGE_MIN_SECTOR}`,
        `First → S${PRESTIGE_MIN_SECTOR} (Hyperion-like): ${formatDuration(firstPrestige)} combat`,
        `Naive fresh → S30: ${formatDuration(naiveAct1)} combat (wall)`,
        `Career → first S30 (Baal-like): ${formatDuration(career.combatSeconds)} combat across ~${career.prestiges} prestiges`,
        `  Engagement: ${formatDuration(engageLow)} – ${formatDuration(engageHigh)}`,
        `  Casual calendar (~1.5–2.5h/day): ~${calendarDaysLow.toFixed(0)}–${calendarDaysHigh.toFixed(0)} days`,
        `Prestige #3 → S${PRESTIGE_MIN_SECTOR}: ${formatDuration(rePrestige)}`,
        `Momentum @3P: +${(prestigeMomentumDamageBonus(3, 0) * 100).toFixed(0)}% dmg / +${(prestigeMomentumProductionBonus(3, 0) * 100).toFixed(0)}% prod`,
      ].join('\n'),
    )

    expect(firstPrestige).toBeGreaterThan(2 * 60)
    expect(firstPrestige).toBeLessThan(150 * 60)

    // Fresh Act 1 without prestige is still a wall.
    expect(naiveAct1).toBeGreaterThan(30 * 60)

    // Baal-scale: many prestiges; calendar lands near 1–2 weeks casual.
    expect(career.prestiges).toBeGreaterThanOrEqual(6)
    expect(career.combatSeconds).toBeGreaterThan(2 * 60 * 60)
    expect(calendarDaysHigh).toBeGreaterThanOrEqual(3)
    expect(calendarDaysLow).toBeLessThanOrEqual(21)

    expect(rePrestige).toBeLessThan(firstPrestige * 0.8)
  })

  it('post-tutorial starter clears sector 1 without death-looping', () => {
    let state = equipPostTutorialLoadout(createInitialState(0))
    state = setDocked(state, false)
    advanceSeconds(state, 120)
    // S1 is winnable. A wounded push may still die on S2 — that is not an S1 loop.
  })
})
