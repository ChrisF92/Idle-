/** Passive-loop helpers for expensive AI automation nodes (mutate in place). */

import type { GameState } from './types'
import {
  BLUEPRINTS,
  PART_TYPES,
  STATIONS,
  aiDoctrinesActive,
  blueprintProgress,
  challengeBlocksAi,
  idleWorkers,
  isStationUnlocked,
} from './catalog'
import {
  autoBalanceWorkers,
  depositFabPart,
  launchFabProject,
  upgradeCheapestModule,
} from './actions'
import {
  SIGNAL_CORE_DEFS,
  SIGNAL_CORE_MAX_RANK,
  SIGNAL_CORE_MERGE_COUNT,
  countMergeable,
  mergeSignalCores,
} from './signalCores'
import { hasProcess } from './process'
import { NETWORK_BARS, isNetworkBarUnlocked } from './network'

function adopt(state: GameState, next: GameState): void {
  if (next === state) return
  state.resources = next.resources
  state.shipyard = next.shipyard
  state.base = next.base
  state.parts = next.parts
  state.signalCores = next.signalCores
  state.meta = next.meta
  state.combat = next.combat
  state.core = next.core
  state.ai = next.ai
  state.research = next.research
  state.essence = next.essence
  state.prestige = next.prestige
  state.codex = next.codex
}

/** Auto-merge unequipped Signal Cores while triples remain. */
export function autoMergeSignalCores(state: GameState): void {
  if (!aiDoctrinesActive(state, 'auto-merge-signal')) return
  let guard = 0
  while (guard++ < 40) {
    let merged = false
    for (const def of SIGNAL_CORE_DEFS) {
      for (let rank = 1; rank < SIGNAL_CORE_MAX_RANK; rank++) {
        if (countMergeable(state, def.id, rank) < SIGNAL_CORE_MERGE_COUNT) continue
        const next = mergeSignalCores(state, def.id, rank)
        if (next === state) continue
        adopt(state, next)
        merged = true
        break
      }
      if (merged) break
    }
    if (!merged) break
  }
}

/** Start / top up Fabrication Bay projects when parts are available. */
export function autoFabBay(state: GameState): void {
  if (!aiDoctrinesActive(state, 'auto-fab-bay')) return
  if (!isStationUnlocked(state, 'fab-bay')) return

  if (state.base.fabProject) {
    let next = state
    for (const pt of PART_TYPES) {
      next = depositFabPart(next, pt, 9999)
    }
    adopt(state, next)
    return
  }

  let bestId: string | null = null
  let bestScore = 0
  for (const bp of BLUEPRINTS) {
    if (!state.meta.discoveredModules.includes(bp.moduleId)) continue
    if (state.shipyard.unlockedModules.includes(bp.moduleId)) continue
    const prog = blueprintProgress(state, bp.moduleId)
    if (!prog) continue
    let have = 0
    let need = 0
    for (const pt of PART_TYPES) {
      have += Math.min(prog.owned[pt], prog.need[pt])
      need += prog.need[pt]
    }
    if (have <= 0 || need <= 0) continue
    const score = (prog.complete ? 1000 : 0) + have / need
    if (score > bestScore) {
      bestScore = score
      bestId = bp.moduleId
    }
  }
  if (!bestId) return
  adopt(state, launchFabProject(state, bestId))
}

/** Park idle workers on the lowest Core training stations. */
export function autoCoreTrain(state: GameState): void {
  if (!aiDoctrinesActive(state, 'neural-router')) return
  let idle = idleWorkers(state)
  if (idle <= 0) return

  const stations = STATIONS.filter(
    (s) => s.kind === 'training' && s.trainsAttr && isStationUnlocked(state, s.id),
  )
  if (stations.length === 0) return

  const assignments = { ...state.base.assignments }
  while (idle > 0) {
    let best = stations[0]!
    let bestRank = Infinity
    for (const s of stations) {
      const attr = s.trainsAttr!
      const rank = state.core?.ranks[attr] ?? 0
      const assigned = assignments[s.id] ?? 0
      // Prefer lower rank; break ties toward fewer assigned.
      const score = rank * 1000 + assigned
      if (score < bestRank) {
        bestRank = score
        best = s
      }
    }
    assignments[best.id] = (assignments[best.id] ?? 0) + 1
    idle -= 1
  }
  state.base.assignments = assignments
}

/** Spend salvage on the cheapest module upgrades while affordable. */
export function autoSalvageUpgrades(state: GameState): void {
  if (!aiDoctrinesActive(state, 'auto-salvage-loop') && !hasProcess(state, 'auto-salvage')) return
  if (hasProcess(state, 'auto-salvage') && state.combat.docked) {
    if (!aiDoctrinesActive(state, 'auto-salvage-loop')) return
  }
  let guard = 0
  while (guard++ < 20) {
    const next = upgradeCheapestModule(state, { force: hasProcess(state, 'auto-salvage') })
    if (next === state) break
    if (next.resources.salvage >= state.resources.salvage) break
    adopt(state, next)
  }
}

function autoNetworkBalance(state: GameState): void {
  if (!hasProcess(state, 'network-balance')) return
  let idle = idleWorkers(state)
  if (idle <= 0) return
  const bars = NETWORK_BARS.filter((b) => isNetworkBarUnlocked(state, b.id))
  if (bars.length === 0) return
  const assignments = { ...state.base.assignments }
  while (idle > 0) {
    let best = bars[0]!
    let bestAssigned = Infinity
    for (const bar of bars) {
      const n = assignments[bar.id] ?? 0
      if (n < bestAssigned) {
        bestAssigned = n
        best = bar
      }
    }
    assignments[best.id] = (assignments[best.id] ?? 0) + 1
    idle -= 1
  }
  state.base.assignments = assignments
}

/** Run all owned automation passives once per sim batch. */
export function tickAutomation(state: GameState): void {
  if (challengeBlocksAi(state)) return
  autoLaborLoop(state)
  autoMergeSignalCores(state)
  autoFabBay(state)
  autoCoreTrain(state)
  autoSalvageUpgrades(state)
  autoNetworkBalance(state)
}

/** Re-apply Labor Router when drones sit idle (Labor Loop). */
export function autoLaborLoop(state: GameState): void {
  if (!aiDoctrinesActive(state, 'labor-loop')) return
  if (!state.ai.purchased.includes('auto-assign-workers')) return
  const idle = idleWorkers(state)
  if (idle <= 0) return
  // Only reshuffle when there is meaningful idle capacity (new drones / recall).
  if (idle < Math.max(1, Math.floor(state.base.workerDrones * 0.15))) return
  const next = autoBalanceWorkers(state)
  if (next === state) return
  adopt(state, next)
}
