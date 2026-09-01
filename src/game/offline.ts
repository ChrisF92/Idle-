import type { GameState, Resources } from './types'
import { RESOURCE_LABELS, computeShipStats } from './state'
import {
  resourceDelta,
  snapshotResources,
  tickGame,
  LIVE_TICK_CAP,
  TICK_MS,
} from './tick'
import {
  STATIONS,
  aiProductionBonus,
  essenceProductionMultiplier,
  isStationUnlocked,
  metaProductionMultiplier,
  prestigeMomentumProductionBonus,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  visibleWorkerJobIds,
} from './catalog'
import { logisticsProdMult, tickCoreTraining } from './core'
import { computeSignalCoreBonuses } from './signalCores'
import { repairRatePerSecond, shieldRepairRatePerSecond } from './combat'
import { tickNetwork } from './network'
import { tickFoundry, foundrySalvageOpsMult } from './foundry'
import { tickResearch } from './hiveResearch'
import { processOfflineBonusMs } from './process'
import { WORKER_JOB_IDS } from './workers'
import { grantGeneratedScrap } from './rebuild'

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

function creditIndustryScrap(state: GameState, amount: number): void {
  if (amount > 0) grantGeneratedScrap(state, amount, 'industry')
}

function applyIndustryOnly(state: GameState, seconds: number): void {
  const meta =
    metaProductionMultiplier(
      state.resources.prestigeMatter,
      state.prestige.matterShop,
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
        const add = (perDrone ?? 0) * effective * seconds * efficiency * meta
        if (key === 'scrap') {
          const salvageOps = station.id === 'scrap-field' ? foundrySalvageOpsMult(state) : 1
          creditIndustryScrap(state, add * salvageOps)
        } else state.resources[key] += add
      }
      continue
    }

    for (const [resource, perDrone] of Object.entries(station.rates)) {
      const key = resource as keyof Resources
      const add = (perDrone ?? 0) * effective * seconds * meta
      if (key === 'scrap') {
        const salvageOps = station.id === 'scrap-field' ? foundrySalvageOpsMult(state) : 1
        creditIndustryScrap(state, add * salvageOps)
      } else state.resources[key] += add
    }
  }

  tickNetwork(state, seconds)
  tickFoundry(state, seconds)
  tickResearch(state, seconds)

  tickCoreTraining(state, seconds)
  const activeJobs = new Set(visibleWorkerJobIds(state))
  for (const jobId of WORKER_JOB_IDS) {
    if (!activeJobs.has(jobId)) delete state.base.assignments[jobId]
  }
}

/** Hangar repair while Docked. A live Sortie is frozen, so hull does not move. */
function applyHangarRepair(state: GameState, seconds: number): void {
  if (!state.combat.docked) return
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

  const maxMs = 8 * 60 * 60 * 1000 + processOfflineBonusMs(state)
  const appliedMs = Math.min(elapsedMs, maxMs)
  const seconds = appliedMs / 1000
  const capped = elapsedMs > maxMs

  const next = structuredClone(state)
  const beforeResources = snapshotResources(next.resources)
  const sectorsBefore = next.combat.wave
  const waveBefore = next.combat.wave
  const sortieFrozen = !next.combat.docked

  if (sortieFrozen) next.combat.sortiePaused = true
  applyIndustryOnly(next, seconds)
  applyHangarRepair(next, seconds)
  next.lastTickAt = now

  const gains = resourceDelta(beforeResources, next.resources)
  const sectorsAfter = next.combat.wave
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

/**
 * Hidden → visible (or a live timer firing after JS was suspended).
 * Small gaps stay on the live clock; larger gaps reuse industry-only offline catch-up.
 */
export function applyWallClock(
  state: GameState,
  now = Date.now(),
  paused = false,
): { state: GameState; report: OfflineReport | null } {
  if (paused) {
    return { state: tickGame(state, now, true), report: null }
  }
  const elapsedMs = Math.max(0, now - state.lastTickAt)
  if (elapsedMs > LIVE_TICK_CAP * TICK_MS) {
    return applyOfflineCatchUp(state, now)
  }
  return { state: tickGame(state, now, false), report: null }
}

/** Visibility `visible` without a page reload. Combat stays PAUSED; industry catches up. */
export function handleAppVisible(
  state: GameState,
  now = Date.now(),
): { state: GameState; report: OfflineReport | null } {
  return applyOfflineCatchUp(state, now)
}
