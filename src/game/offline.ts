import type { GameState, Resources } from './types'
import { RESOURCE_LABELS, computeShipStats } from './state'
import {
  resourceDelta,
  snapshotResources,
  TICK_MS,
} from './tick'
import {
  COMBAT_DRONE_MANUFACTURE_SECONDS,
  COMBAT_DRONES_UNLOCK_GRANT,
  COMBAT_DRONES_UNLOCK_SECTOR,
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  aiDoctrinesActive,
  challengeShopOfflineMs,
  essenceProductionMultiplier,
  isStationUnlocked,
  matterShopScrapBonus,
  metaProductionMultiplier,
  researchEssenceMultiplier,
  workerManufactureSpeed,
} from './catalog'
import { isSystemUnlocked } from './progression'
import { repairRatePerSecond, shieldRepairRatePerSecond } from './combat'
/** Default hard cap; Deep Cache shop extends this. */
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000

/** Only show a welcome-back report if away at least this long. */
export const OFFLINE_REPORT_THRESHOLD_MS = 30 * 1000

export interface OfflineReport {
  elapsedMs: number
  appliedMs: number
  capped: boolean
  sectorsBefore: number
  sectorsAfter: number
  sectorsCleared: number
  /** Advance / Hold / Paused label for the welcome banner. */
  modeLabel: string
  gains: Partial<Resources>
  summary: string
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatGains(gains: Partial<Resources>): string {
  const parts = Object.entries(gains)
    .filter(([, v]) => (v ?? 0) > 0.05)
    .map(([k, v]) => `+${(v ?? 0).toFixed(1)} ${RESOURCE_LABELS[k as keyof Resources]}`)
  return parts.length ? parts.join(', ') : 'no net resource gains'
}

function applyIndustryOnly(state: GameState, seconds: number): void {
  const meta =
    metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
      state.prestige.challengeClears,
    ) * essenceProductionMultiplier(state.essence.purchased)

  for (const station of STATIONS) {
    if (!isStationUnlocked(state, station.id)) continue
    const drones = state.base.assignments[station.id] ?? 0
    if (drones <= 0) continue

    if (station.upkeepScrapPerDrone) {
      const upkeep = station.upkeepScrapPerDrone * drones * seconds
      const paid = Math.min(state.resources.scrap, upkeep)
      state.resources.scrap -= paid
      const efficiency = upkeep > 0 ? paid / upkeep : 1
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        const key = resource as keyof Resources
        state.resources[key] += (perDrone ?? 0) * drones * seconds * efficiency * meta
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof Resources
      state.resources[key] += (perDrone ?? 0) * drones * seconds * meta
    }
  }

  if (state.meta.highestSectorEver >= 3 || state.combat.highestSector >= 3) {
    const speed = workerManufactureSpeed(state)
    state.base.manufactureProgress += (seconds * speed) / WORKER_MANUFACTURE_SECONDS
    while (state.base.manufactureProgress >= 1) {
      state.base.manufactureProgress -= 1
      state.base.workerDrones += 1
    }
  }

  if (
    !state.meta.combatDronesUnlocked &&
    Math.max(state.meta.highestSectorEver, state.combat.highestSector) >=
      COMBAT_DRONES_UNLOCK_SECTOR
  ) {
    state.meta.combatDronesUnlocked = true
    state.base.combatDrones = Math.max(
      state.base.combatDrones,
      COMBAT_DRONES_UNLOCK_GRANT,
    )
  }

  if (state.meta.combatDronesUnlocked) {
    state.base.combatManufactureProgress += seconds / COMBAT_DRONE_MANUFACTURE_SECONDS
    while (state.base.combatManufactureProgress >= 1) {
      state.base.combatManufactureProgress -= 1
      state.base.combatDrones += 1
    }
  }
}

/**
 * Sector-based offline combat payout (no fight simulation).
 * Scales with the sector you left on and offline duration.
 */
function applySectorOfflineRewards(state: GameState, seconds: number): void {
  const sector = Math.max(1, state.combat.sector)
  const hours = seconds / 3600
  const scrapPerHour = (8 + sector * 3) * (1 + matterShopScrapBonus(state.prestige.matterShop))
  const dataPerHour =
    state.prestige.activeChallengeId === 'data-drought' ||
    !isSystemUnlocked(state, 'research')
      ? 0
      : 1.5 + sector * 0.35
  const essencePerHour =
    sector >= 5
      ? (0.05 + Math.floor(sector / 5) * 0.04) *
        researchEssenceMultiplier(state.research.unlocked)
      : 0

  const scrapMult = state.combat.campaign ? 1 : 1.25
  const pushMult = state.combat.campaign ? 1.15 : 0.85

  state.resources.scrap += scrapPerHour * hours * scrapMult
  state.resources.data += dataPerHour * hours * pushMult
  state.resources.essence += essencePerHour * hours
}

/** Offline does not simulate combat — clear an in-progress fight; apply field / pause repair. */
function endOfflineFight(state: GameState, seconds: number): void {
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  if (state.combat.inFight) {
    state.combat.inFight = false
    state.combat.playerUnits = []
    state.combat.enemyUnits = []
    state.combat.enemyHull = 0
    state.combat.enemyHullMax = 0
    state.combat.projectiles = []
    state.combat.fx = []
    state.combat.enemyName = 'None'
  }
  let mult = state.combat.docked
    ? 1
    : aiDoctrinesActive(state, 'auto-launch-ready')
      ? 0.85
      : 0.4
  if (
    !state.combat.docked &&
    aiDoctrinesActive(state, 'auto-dock-critical') &&
    stats.hullMax > 0 &&
    state.combat.playerHull / stats.hullMax < 0.35
  ) {
    mult = Math.max(mult, 0.95)
  }
  state.combat.playerHull = Math.min(
    stats.hullMax,
    state.combat.playerHull + repairRatePerSecond(state) * mult * seconds,
  )
  state.combat.playerShield = Math.min(
    stats.shieldMax,
    state.combat.playerShield + shieldRepairRatePerSecond(state) * mult * seconds,
  )
}

/**
 * Apply offline progress for time since lastTickAt.
 * Industry + sector-scaled rewards; combat is NOT simulated tick-by-tick.
 */
export function applyOfflineCatchUp(
  state: GameState,
  now = Date.now(),
): { state: GameState; report: OfflineReport | null } {
  const elapsedMs = Math.max(0, now - state.lastTickAt)
  if (elapsedMs < TICK_MS) {
    const next = structuredClone(state)
    next.lastTickAt = now
    return { state: next, report: null }
  }

  const maxMs = challengeShopOfflineMs(state.prestige.shop ?? [])
  const appliedMs = Math.min(elapsedMs, maxMs)
  const seconds = appliedMs / 1000
  const capped = elapsedMs > maxMs

  const next = structuredClone(state)
  const beforeResources = snapshotResources(next.resources)
  const sectorsBefore = next.combat.sector

  applyIndustryOnly(next, seconds)
  applySectorOfflineRewards(next, seconds)
  endOfflineFight(next, seconds)
  next.lastTickAt = now

  const gains = resourceDelta(beforeResources, next.resources)
  const sectorsAfter = next.combat.sector
  const sectorsCleared = 0

  if (elapsedMs < OFFLINE_REPORT_THRESHOLD_MS) {
    return { state: next, report: null }
  }

  const modeLabel = next.combat.docked
    ? 'Paused'
    : next.combat.campaign
      ? 'Advance'
      : 'Hold'
  const mode = next.combat.docked
    ? 'Offline payout while Paused (industry + hangar repair, no fight sim).'
    : next.combat.campaign
      ? 'Offline payout from your Advance sector (no fight sim).'
      : 'Offline payout while Holding / farming this sector (no fight sim).'

  const summary = [
    `Welcome back. Away ${formatDuration(elapsedMs)}` +
      (capped ? ` (applied ${formatDuration(appliedMs)} max)` : '') +
      '.',
    mode,
    `Still at sector ${sectorsAfter}.`,
    formatGains(gains) + '.',
  ].join(' ')

  next.combat.log = [summary, ...next.combat.log].slice(0, 40)

  return {
    state: next,
    report: {
      elapsedMs,
      appliedMs,
      capped,
      sectorsBefore,
      sectorsAfter,
      sectorsCleared,
      modeLabel,
      gains,
      summary,
    },
  }
}
