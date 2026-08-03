/**
 * Expedition lifecycle helpers — Extract, Defeat, run summary (Phase 1).
 */

import type { ExpeditionRunSummary, GameState } from './types'
import { fullHealPlayer } from './state'
import {
  applyExtractionBonus,
  canExtractOrPrestige,
  formatPrestigeMatter,
  prestigeMatterForRun,
  roundPrestigeMatter,
} from './prestigeMatter'

export type { ExpeditionRunSummary }

function pushLog(state: GameState, line: string, max = 40): void {
  state.combat.log = [line, ...state.combat.log].slice(0, max)
}

function clearFight(state: GameState): void {
  state.combat.inFight = false
  state.combat.enemyName = 'None'
  state.combat.enemyFamily = ''
  state.combat.enemyTags = []
  state.combat.isBoss = false
  state.combat.bossPhase = 0
  state.combat.enemyUnits = []
  state.combat.playerUnits = []
  state.combat.enemyHull = 0
  state.combat.enemyHullMax = 0
  state.combat.projectiles = []
  state.combat.fx = []
}

/** Sync estimated PM readout on the combat HUD. */
export function refreshEstimatedPrestigeMatter(state: GameState): void {
  const best = Math.max(state.combat.bestWaveThisRun, state.combat.wave)
  const base = prestigeMatterForRun({
    bestWave: best,
    checkpointWave: state.combat.checkpointWave,
  })
  state.combat.estimatedPrestigeMatter = roundPrestigeMatter(
    applyExtractionBonus(base, true),
  )
}

export function buildRunSummary(
  state: GameState,
  opts: { extracted: boolean; defeated: boolean },
): ExpeditionRunSummary {
  const best = Math.max(state.combat.bestWaveThisRun, 0)
  const base = prestigeMatterForRun({
    bestWave: best,
    checkpointWave: state.combat.checkpointWave,
  })
  const awarded = roundPrestigeMatter(applyExtractionBonus(base, opts.extracted))
  const startedAt = state.combat.expeditionStartedAt || state.lastTickAt
  return {
    bestWave: best,
    waveReached: state.combat.wave,
    basePm: roundPrestigeMatter(base),
    awardedPm: awarded,
    extracted: opts.extracted,
    salvageEarned: state.combat.runSalvageEarned,
    scrapEarned: state.combat.runScrapEarned,
    durationSec: Math.max(0, (Date.now() - startedAt) / 1000),
    defeated: opts.defeated,
  }
}

function resetExpeditionProgress(state: GameState): void {
  state.combat.sector = 1
  state.combat.wave = 1
  state.combat.bestWaveThisRun = 0
  state.combat.checkpointWave = 1
  state.combat.mode = 'push'
  state.combat.docked = true
  state.combat.campaign = true
  state.combat.inFight = false
  state.combat.fightElapsed = 0
  state.combat.consecutiveLosses = 0
  state.combat.runSalvageEarned = 0
  state.combat.runScrapEarned = 0
  state.combat.expeditionStartedAt = 0
  state.combat.estimatedPrestigeMatter = 0
  state.combat.upgrades = {}
  state.resources.salvage = 0
  state.shipyard.moduleLevels = {}
  state.shipyard.frameLocked = false
  clearFight(state)
  fullHealPlayer(state)
}

/**
 * Award PM and end the Expedition (Extract or Defeat).
 * Prestige unlock gate: career best must reach PRESTIGE_UNLOCK_WAVE to earn PM.
 */
export function endExpedition(
  state: GameState,
  opts: { extracted: boolean; defeated: boolean },
): GameState {
  const next = structuredClone(state)
  const careerBest = Math.max(
    next.meta.highestWaveEver ?? 0,
    next.combat.bestWaveThisRun,
  )

  // Always record career best wave from this run.
  next.meta.highestWaveEver = Math.max(
    next.meta.highestWaveEver ?? 0,
    next.combat.bestWaveThisRun,
  )
  // Bridge legacy sector unlocks: ~wave 100 ≈ old sector 30.
  const sectorBridge = Math.max(
    1,
    Math.ceil((next.meta.highestWaveEver || 1) * 0.3),
  )
  next.meta.highestSectorEver = Math.max(next.meta.highestSectorEver, sectorBridge)
  next.combat.highestSector = Math.max(next.combat.highestSector, sectorBridge)
  if (next.meta.highestWaveEver >= 100) {
    next.meta.act1Cleared = true
  }

  let awardedPm = 0
  if (canExtractOrPrestige(careerBest) && next.combat.bestWaveThisRun > 0) {
    const summary = buildRunSummary(next, opts)
    awardedPm = summary.awardedPm
    next.resources.prestigeMatter += awardedPm
    next.combat.lastRunSummary = summary
    next.prestige.prestigeCount += 1
    pushLog(
      next,
      opts.extracted
        ? `Extracted at wave ${summary.bestWave}. +${formatPrestigeMatter(awardedPm)} Prestige Matter.`
        : `Expedition defeated at wave ${summary.bestWave}. +${formatPrestigeMatter(awardedPm)} Prestige Matter.`,
    )
  } else {
    next.combat.lastRunSummary = buildRunSummary(next, opts)
    next.combat.lastRunSummary.awardedPm = 0
    next.combat.lastRunSummary.basePm = 0
    pushLog(
      next,
      opts.extracted
        ? `Extracted at wave ${next.combat.bestWaveThisRun}. Prestige unlocks at career wave 20.`
        : `Defeated at wave ${next.combat.bestWaveThisRun}. Prestige unlocks at career wave 20.`,
    )
  }

  resetExpeditionProgress(next)
  return next
}

export function extractExpedition(state: GameState): GameState {
  if (state.combat.docked && !state.combat.inFight && state.combat.bestWaveThisRun <= 0) {
    return state
  }
  if (!canExtractOrPrestige(Math.max(state.meta.highestWaveEver, state.combat.bestWaveThisRun))) {
    const next = structuredClone(state)
    pushLog(next, 'Extraction unlocks after career wave 20.')
    return next
  }
  // Cannot extract during directive/boss transition later — Phase 1: block only if no progress.
  if (state.combat.bestWaveThisRun <= 0 && state.combat.wave <= 1 && !state.combat.inFight) {
    return state
  }
  // Capture best wave including current in-progress wave only if partially cleared — use bestWaveThisRun.
  const next = structuredClone(state)
  if (next.combat.inFight) {
    // Extract mid-fight: keep bestWaveThisRun (waves fully cleared).
    clearFight(next)
  }
  next.combat.docked = true
  return endExpedition(next, { extracted: true, defeated: false })
}

export function defeatExpedition(state: GameState): GameState {
  return endExpedition(state, { extracted: false, defeated: true })
}
