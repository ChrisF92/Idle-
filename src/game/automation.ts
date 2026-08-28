/** Passive-loop helpers for expensive AI / Process automation nodes (mutate in place). */

import type { GameState } from './types'
import {
  STATIONS,
  aiDoctrinesActive,
  challengeBlocksAi,
  idleWorkers,
  isStationUnlocked,
} from './catalog'
import {
  buyRunUpgrade,
  enterProtocol,
  optimiseNetwork,
} from './actions'
import {
  SIGNAL_CORE_DEFS,
  SIGNAL_CORE_MAX_RANK,
  SIGNAL_CORE_MERGE_COUNT,
  countMergeable,
  mergeSignalCores,
} from './signalCores'
import { hasProcess, noteProcessLastAction, processConfig } from './process'
import { activeProcessProfile, evaluateProcessIntent, pickShopCategory } from './processProfiles'
import { nextRunUpgradeCost, visibleRunUpgrades, type RunUpgradeId } from './workshop'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  hiveResearchBranchUnlocked,
  hiveResearchCompleted,
  hiveResearchQueueCap,
  setResearchFocus,
} from './hiveResearch'
function adopt(state: GameState, next: GameState): void {
  if (next === state) return
  state.resources = next.resources
  state.shipyard = next.shipyard
  state.base = next.base
  state.signalCores = next.signalCores
  state.meta = next.meta
  state.combat = next.combat
  state.core = next.core
  state.ai = next.ai
  state.research = next.research
  state.essence = next.essence
  state.prestige = next.prestige
  state.codex = next.codex
  state.foundry = next.foundry
  state.relics = next.relics
  state.hiveResearch = next.hiveResearch
  state.furnace = next.furnace
  state.process = next.process
  state.network = next.network
  state.protocols = next.protocols
  state.echo = next.echo
}

/** Auto-merge unequipped Signal Cores while triples remain. */
export function autoMergeSignalCores(state: GameState): void {
  const processMerge = hasProcess(state, 'reliquary-merge') && processConfig(state).reliquary.autoMerge
  if (!aiDoctrinesActive(state, 'auto-merge-signal') && !processMerge) return
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

function autoShopUpgrades(state: GameState): void {
  if (state.combat.docked) return
  const intent = evaluateProcessIntent(state)
  if (!intent.autoShop) return
  const salvage = state.resources.salvage ?? 0
  if (salvage <= intent.salvageReserve) return
  let guard = 0
  while (guard++ < 8) {
    const bank = state.resources.salvage ?? 0
    if (bank <= intent.salvageReserve) break
    const cat = pickShopCategory(state, intent.spend)
    if (!cat) break
    let pick: RunUpgradeId | null = null
    let pickCost = Number.POSITIVE_INFINITY
    for (const def of visibleRunUpgrades(state, cat)) {
      const cost = nextRunUpgradeCost(state, def.id)
      if (cost <= 0) continue
      if (bank - cost < intent.salvageReserve) continue
      if (cost < pickCost) {
        pick = def.id
        pickCost = cost
      }
    }
    if (!pick) break
    const next = buyRunUpgrade(state, pick, 1)
    if (next === state) break
    if ((next.resources.salvage ?? 0) >= bank) break
    adopt(state, next)
  }
  if (guard > 1) noteProcessLastAction(state, 'auto-shop', `Bought ${guard - 1} shop ranks`)
}


function autoNetworkBalance(state: GameState): void {
  if (!hasProcess(state, 'network-balance') && !hasProcess(state, 'network-tune')) return
  if (!processConfig(state).network.enabled) return
  if (idleWorkers(state) <= 0) return
  const profile = activeProcessProfile(state)
  if (intentWorkerOrProfile(state, profile)) {
    const preset = evaluateProcessIntent(state).workerPreset ?? profile?.workerPreset
    if (preset && hasProcess(state, 'network-presets')) {
      state.process.config.network.preset = preset
    }
  }
  const next = optimiseNetwork(state)
  if (next !== state) {
    adopt(state, next)
    noteProcessLastAction(state, 'network-balance', 'Filled idle Workers')
  }
}

function intentWorkerOrProfile(
  state: GameState,
  profile: ReturnType<typeof activeProcessProfile>,
): boolean {
  const intent = evaluateProcessIntent(state)
  if (intent.workerPreset && hasProcess(state, 'worker-conditional')) {
    state.process.config.network.preset = intent.workerPreset
    return true
  }
  return Boolean(profile?.workerPreset && hasProcess(state, 'network-presets'))
}

function autoBankAsh(_state: GameState): void {
  /* GDD Furnace: converting Ash is a Sortie decision, not a live tank. */
}

function autoResearchFocus(state: GameState): void {
  if (!hasProcess(state, 'research-focus') && !hasProcess(state, 'research-queue')) return
  if (!state.hiveResearch) return
  const cfg = processConfig(state)
  const intent = evaluateProcessIntent(state)
  if (hasProcess(state, 'research-focus') && !cfg.research.autoResearch && !intent.researchNext) return
  const incomplete = (id: (typeof HIVE_RESEARCH_BRANCHES)[number]['id']) =>
    hiveResearchBranchUnlocked(state, id) && hiveResearchCompleted(state, id) < HIVE_RESEARCH_NODES[id].length
  let nextFocus = state.hiveResearch.focus
  if (hasProcess(state, 'research-queue') && cfg.research.queue.length > 0) {
    const queued = cfg.research.queue.slice(0, hiveResearchQueueCap(state)).find(incomplete)
    if (queued) nextFocus = queued
  } else if (hasProcess(state, 'research-priorities') && cfg.research.branchPriority.length > 0) {
    const ranked = cfg.research.branchPriority.find(incomplete)
    if (ranked) nextFocus = ranked
  } else if (hasProcess(state, 'research-focus') || intent.researchNext) {
    const ranked = cfg.research.branchPriority.find(incomplete)
    if (ranked) nextFocus = ranked
  }
  if (nextFocus === state.hiveResearch.focus && state.hiveResearch.active) return
  adopt(state, setResearchFocus(state, nextFocus))
  noteProcessLastAction(state, hasProcess(state, 'research-queue') ? 'research-queue' : 'research-focus', 'Started next project')
}


function autoProtocolEchoRepeat(state: GameState): void {
  const cfg = processConfig(state)
  const protocolId = cfg.sortie.protocolId || cfg.sortie.lastProtocolId
  if (
    hasProcess(state, 'protocol-repeat') &&
    cfg.sortie.protocolRepeat &&
    state.combat.docked &&
    !state.protocols?.activeId &&
    protocolId
  ) {
    const next = enterProtocol(state, protocolId, { automated: true })
    if (next !== state) {
      adopt(state, next)
    }
  }
}

/** Run all owned automation passives once per sim batch. */
export function tickAutomation(state: GameState): void {
  if (challengeBlocksAi(state)) return
  autoMergeSignalCores(state)
  autoCoreTrain(state)
  autoShopUpgrades(state)
  autoNetworkBalance(state)
  autoBankAsh(state)
  autoResearchFocus(state)
  autoProtocolEchoRepeat(state)
}

/** @deprecated Automatic reassignment now belongs to Process progression. */
export function autoLaborLoop(state: GameState): void {
  void state
}
