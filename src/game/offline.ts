import type { GameState, Resources } from './types'
import { RESOURCE_LABELS, computeShipStats } from './state'
import {
  resourceDelta,
  snapshotResources,
  TICK_MS,
} from './tick'
import {
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  advanceFabProject,
  aiDoctrinesActive,
  aiFabBonus,
  aiProductionBonus,
  challengeShopOfflineMs,
  combatSpeedMultiplier,
  droneCap,
  essenceOfflineEssenceMultiplier,
  essenceProductionMultiplier,
  isStationUnlocked,
  metaProductionMultiplier,
  prestigeMomentumProductionBonus,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  workerManufactureSpeed,
} from './catalog'
import {
  logisticsFabMult,
  logisticsProdMult,
  tickCoreTraining,
} from './core'
import { computeSignalCoreBonuses } from './signalCores'
import {
  estimateHoldClearRewards,
  estimateHoldFarmRates,
  repairRatePerSecond,
  shieldRepairRatePerSecond,
} from './combat'

/** Default hard cap; Deep Cache shop extends this. */
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000

/** Only show a welcome-back report if away at least this long. */
export const OFFLINE_REPORT_THRESHOLD_MS = 30 * 1000

/**
 * Offline combat pays this fraction of theoretical Hold-farm rates.
 * Below 1 so AFK farming stays valuable without matching live Chrono sessions.
 */
export const OFFLINE_COMBAT_EFFICIENCY = 0.3

/**
 * Soft floor on estimated clear time for offline combat payouts.
 * Stops early-sector melt (live 8s floor) from printing absurd AFK scrap/salvage.
 */
export const OFFLINE_MIN_CLEAR_SECONDS = 150

/**
 * Hard cap on offline combat clears per hour after efficiency.
 * Keeps early Hold farms from outpacing intentional Act 1 pacing.
 */
export const OFFLINE_MAX_CLEARS_PER_HOUR = 2

/**
 * Extra multiplier on boss essence from offline combat clears.
 * Essence upgrades are cheap (2–3); full clear-rate essence would trivialise them.
 */
export const OFFLINE_ESSENCE_FACTOR = 0.35

export interface OfflineReport {
  elapsedMs: number
  appliedMs: number
  capped: boolean
  sectorsBefore: number
  sectorsAfter: number
  sectorsCleared: number
  /** Fractional sector clears granted from offline combat farming. */
  combatClears: number
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
    ) *
    (1 +
      prestigeMomentumProductionBonus(
        state.prestige.prestigeCount,
        state.meta.ascensionCount ?? 0,
      )) *
    essenceProductionMultiplier(state.essence.purchased) *
    logisticsProdMult(state.core?.ranks.logistics ?? 0) *
    (1 + aiProductionBonus(state)) *
    (1 + computeSignalCoreBonuses(state).production)

  for (const station of STATIONS) {
    if (!isStationUnlocked(state, station.id)) continue
    const assigned = state.base.assignments[station.id] ?? 0
    if (assigned <= 0) continue
    const effective = stationEffectiveDrones(state, station.id)

    const upkeepPer = stationUpkeepScrapPerDrone(state, station)
    if (upkeepPer > 0) {
      const upkeep = upkeepPer * assigned * seconds
      const paid = Math.min(state.resources.scrap, upkeep)
      state.resources.scrap -= paid
      const efficiency = upkeep > 0 ? paid / upkeep : 1
      for (const [resource, perDrone] of Object.entries(station.rates)) {
        const key = resource as keyof Resources
        state.resources[key] +=
          (perDrone ?? 0) * effective * seconds * efficiency * meta
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof Resources
      state.resources[key] += (perDrone ?? 0) * effective * seconds * meta
    }
  }

  // Match live Base unlock (sector 4); stop at corps capacity.
  if (state.meta.highestSectorEver >= 4 || state.combat.highestSector >= 4) {
    const cap = droneCap(state)
    if (state.base.workerDrones < cap) {
      const speed = workerManufactureSpeed(state)
      state.base.manufactureProgress +=
        (seconds * speed) / WORKER_MANUFACTURE_SECONDS
      while (
        state.base.manufactureProgress >= 1 &&
        state.base.workerDrones < cap
      ) {
        state.base.manufactureProgress -= 1
        state.base.workerDrones += 1
        state.meta.lifetimeDronesBuilt =
          (state.meta.lifetimeDronesBuilt ?? 0) + 1
      }
      if (state.base.workerDrones >= cap) {
        state.base.manufactureProgress = Math.min(
          state.base.manufactureProgress,
          0.999,
        )
      }
    }
  }

  advanceFabProject(
    state,
    seconds,
    (line) => {
      state.combat.log = [line, ...state.combat.log].slice(0, 40)
    },
    logisticsFabMult(state) *
      (1 + computeSignalCoreBonuses(state).fab) *
      (1 + aiFabBonus(state)),
  )
  tickCoreTraining(state, seconds)
}

/**
 * Award combat clear rewards while offline (no tick-by-tick fight sim).
 * Uses Hold-farm clear payouts × estimated clears from fleet DPS.
 * Paused (docked) earns no combat payout — hangar time is industry + repair only.
 * Sector / wave progress stays frozen; part drops and Signal Cores stay live-only.
 */
function applyCombatOfflineRewards(state: GameState, seconds: number): number {
  if (state.combat.docked || seconds <= 0) return 0

  const rewards = estimateHoldClearRewards(state)
  const { clearSeconds: liveClearSeconds } = estimateHoldFarmRates(state)
  const chrono = combatSpeedMultiplier(state)
  const clearSeconds = Math.max(
    OFFLINE_MIN_CLEAR_SECONDS,
    liveClearSeconds / Math.max(1, chrono),
  )
  const rawClearsPerHour =
    (3600 / clearSeconds) * OFFLINE_COMBAT_EFFICIENCY
  const clearsPerHour = Math.min(rawClearsPerHour, OFFLINE_MAX_CLEARS_PER_HOUR)
  const clears = (seconds / 3600) * clearsPerHour
  if (clears <= 0) return 0

  const essenceMult =
    essenceOfflineEssenceMultiplier(state.essence.purchased) *
    OFFLINE_ESSENCE_FACTOR

  state.resources.scrap += rewards.scrap * clears
  state.resources.data += rewards.data * clears
  state.resources.salvage += rewards.salvage * clears
  state.resources.essence += rewards.essence * clears * essenceMult

  return clears
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
  if (state.prestige.activeChallengeId === 'attrition') return

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
 * Industry + combat clear rewards (rate-based; combat is NOT simulated tick-by-tick).
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
  const combatClears = applyCombatOfflineRewards(next, seconds)
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
    ? 'Offline payout while Paused (industry + hangar repair).'
    : next.combat.campaign
      ? `Offline combat rewards from your Advance sector (~${combatClears.toFixed(1)} clears, no fight sim).`
      : `Offline combat rewards while Holding / farming this sector (~${combatClears.toFixed(1)} clears, no fight sim).`

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
      combatClears,
      modeLabel,
      gains,
      summary,
    },
  }
}
