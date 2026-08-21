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
  aiFabBonus,
  aiProductionBonus,
  challengeShopOfflineMs,
  droneCap,
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
import { repairRatePerSecond, shieldRepairRatePerSecond } from './combat'
import { networkManufactureMult, tickNetwork } from './network'
import { tickFoundry } from './foundry'
import { foundryAshHeatMult } from './foundryBonuses'
import { tickYard } from './yard'
import { tickFurnace } from './furnace'
import { hiveResearchHeatFromAshMult, tickResearch } from './hiveResearch'
import { processIndustrySpeedMult, processOfflineBonusMs } from './process'

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
  wave: number
  /** Docked vs frozen Sortie label for the welcome modal. */
  modeLabel: string
  sortieFrozen: boolean
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

  tickNetwork(state, seconds)
  tickFoundry(state, seconds)
  tickYard(state, seconds)
  tickFurnace(state, seconds, hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state))
  tickResearch(state, seconds)

  const cap = droneCap(state)
  if (state.base.workerDrones < cap) {
    const speed =
      workerManufactureSpeed(state) * networkManufactureMult(state) * processIndustrySpeedMult(state)
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

  advanceFabProject(
    state,
    seconds,
    (line) => {
      state.combat.log = [line, ...state.combat.log].slice(0, 40)
    },
    logisticsFabMult(state) *
      (1 + computeSignalCoreBonuses(state).fab) *
      (1 + aiFabBonus(state)) *
      networkManufactureMult(state),
  )
  tickCoreTraining(state, seconds)
}

/** Hangar repair while Docked. A live Sortie is frozen, so hull does not move. */
function applyHangarRepair(state: GameState, seconds: number): void {
  if (!state.combat.docked) return
  if (state.prestige.activeChallengeId === 'attrition') return
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerHull = Math.min(
    stats.hullMax,
    state.combat.playerHull + repairRatePerSecond(state) * seconds,
  )
  state.combat.playerShield = Math.min(
    stats.shieldMax,
    state.combat.playerShield + shieldRepairRatePerSecond(state) * seconds,
  )
}

/**
 * Apply offline progress for time since lastTickAt.
 * GDD §107: Hive industry continues. A live Sortie freezes and resumes as-is.
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

  const maxMs = challengeShopOfflineMs(state.prestige.shop ?? []) + processOfflineBonusMs(state)
  const appliedMs = Math.min(elapsedMs, maxMs)
  const seconds = appliedMs / 1000
  const capped = elapsedMs > maxMs

  const next = structuredClone(state)
  const beforeResources = snapshotResources(next.resources)
  const sectorsBefore = next.combat.sector
  const waveBefore = next.combat.wave
  const sortieFrozen = !next.combat.docked

  applyIndustryOnly(next, seconds)
  applyHangarRepair(next, seconds)
  next.lastTickAt = now

  const gains = resourceDelta(beforeResources, next.resources)
  const sectorsAfter = next.combat.sector
  const sectorsCleared = Math.max(0, sectorsAfter - sectorsBefore)

  if (elapsedMs < OFFLINE_REPORT_THRESHOLD_MS) {
    return { state: next, report: null }
  }

  const modeLabel = sortieFrozen ? 'Sortie frozen' : 'Docked'
  const mode = sortieFrozen
    ? `Sortie frozen at Wave ${waveBefore}. Combat did not advance.`
    : 'Docked. Foundry, fabrication, Research jobs, and Worker Drones kept working.'

  const summary = [
    `Welcome back. Away ${formatDuration(elapsedMs)}` +
      (capped ? ` (applied ${formatDuration(appliedMs)} max)` : '') +
      '.',
    mode,
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
      wave: next.combat.wave,
      modeLabel,
      sortieFrozen,
      gains,
      summary,
    },
  }
}
