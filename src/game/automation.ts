/** Passive-loop helpers for expensive AI / Process automation nodes (mutate in place). */

import type { FoundryRecipeId, GameState } from './types'
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
  assembleBlueprint,
  autoBalanceWorkers,
  buyMaxYardArms,
  canAssembleBlueprint,
  convertAshToHeat,
  depositFabPart,
  enterEcho,
  enterProtocol,
  launchFabProject,
  optimiseNetwork,
  pickFoundryUpgradeId,
  pickProcessCoreUpgrade,
  upgradeBestValueModule,
  upgradeCheapestModule,
} from './actions'
import {
  SIGNAL_CORE_DEFS,
  SIGNAL_CORE_MAX_RANK,
  SIGNAL_CORE_MERGE_COUNT,
  countMergeable,
  mergeSignalCores,
} from './signalCores'
import { hasProcess, processConfig } from './process'
import {
  FOUNDRY_RECIPES,
  buyFoundryUpgrade,
  foundryMaterialCount,
  foundryRecipeLevel,
  foundrySlotCount,
  foundrySalvageReserve,
  isFoundryInfinite,
  isFoundryRecipeUnlocked,
  setFoundrySlot,
} from './foundry'
import {
  RELIQUARY_SLOTS,
  SHARDS,
  fittedShardId,
  getShard,
  insertShard,
  isReliquarySlotUnlocked,
  shardAutoScore,
  shardOwned,
} from './reliquary'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  hiveResearchCompleted,
  hiveResearchHeatFromAshMult,
  hiveResearchQueueCap,
  setResearchFocus,
} from './hiveResearch'
import { runFurnaceManager } from './furnace'
import { foundryAshHeatMult, foundryQueueCap } from './foundryBonuses'
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
  state.foundry = next.foundry
  state.reliquary = next.reliquary
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

/** Spend salvage on Core upgrades while affordable. */
export function autoSalvageUpgrades(state: GameState): void {
  const cfg = processConfig(state)
  const processSalvage = hasProcess(state, 'auto-salvage') && cfg.core.enabled
  if (!aiDoctrinesActive(state, 'auto-salvage-loop') && !processSalvage) return
  if (processSalvage && state.combat.docked) {
    if (!aiDoctrinesActive(state, 'auto-salvage-loop')) return
  }
  let guard = 0
  while (guard++ < 20) {
    const next = processSalvage
      ? pickProcessCoreUpgrade(state, { force: true })
      : hasProcess(state, 'smart-core')
        ? upgradeBestValueModule(state, { force: true })
        : upgradeCheapestModule(state, { force: true })
    if (next === state) break
    if (next.resources.salvage >= state.resources.salvage) break
    adopt(state, next)
  }
}

function autoNetworkBalance(state: GameState): void {
  if (!hasProcess(state, 'network-balance') && !hasProcess(state, 'network-tune')) return
  if (!processConfig(state).network.enabled) return
  if (idleWorkers(state) <= 0) return
  const next = optimiseNetwork(state)
  if (next !== state) adopt(state, next)
}

function autoBankAsh(state: GameState): void {
  if (!hasProcess(state, 'auto-bank')) return
  if (!processConfig(state).furnace.autoFeed) return
  adopt(state, convertAshToHeat(state))
}

function pickSmartSmeltRecipe(state: GameState, busy: Set<string>): FoundryRecipeId | null {
  const salvage = state.resources.salvage
  const reserve = foundrySalvageReserve(state)
  let best: FoundryRecipeId | null = null
  let bestScore = -1
  for (const def of FOUNDRY_RECIPES) {
    if (!isFoundryRecipeUnlocked(state, def.id)) continue
    if (isFoundryInfinite(state, def.id)) continue
    if (busy.has(def.id) && foundrySlotCount(state) < 3) continue
    if ((def.costs.salvage ?? 0) > 0 && salvage < Math.max(def.costs.salvage ?? 0, reserve)) continue
    const level = foundryRecipeLevel(state, def.id)
    let score = 20 - Math.min(12, level)
    if (def.costs.materials) score += 4
    if (def.unlocksRecipe && level + 1 >= def.unlocksRecipe.atLevel) score += 8
    if (score > bestScore) {
      bestScore = score
      best = def.id
    }
  }
  if (!best && isFoundryRecipeUnlocked(state, 'slag-ingot') && !isFoundryInfinite(state, 'slag-ingot')) {
    best = 'slag-ingot'
  }
  if (!best && isFoundryRecipeUnlocked(state, 'filament') && !isFoundryInfinite(state, 'filament')) {
    best = 'filament'
  }
  return best
}

function pickFoundryPrereqRecipe(state: GameState, target: FoundryRecipeId): FoundryRecipeId | null {
  const def = FOUNDRY_RECIPES.find((r) => r.id === target)
  if (!def) return null
  if (def.requiresRecipeLevel) {
    const have = foundryRecipeLevel(state, def.requiresRecipeLevel.recipeId)
    if (have < def.requiresRecipeLevel.level) {
      return pickFoundryPrereqRecipe(state, def.requiresRecipeLevel.recipeId) ?? def.requiresRecipeLevel.recipeId
    }
  }
  if (def.costs.materials) {
    for (const [mat, need] of Object.entries(def.costs.materials)) {
      if (foundryMaterialCount(state, mat) < (need ?? 0)) {
        return pickFoundryPrereqRecipe(state, mat as FoundryRecipeId) ?? (mat as FoundryRecipeId)
      }
    }
  }
  if (!isFoundryRecipeUnlocked(state, target) || isFoundryInfinite(state, target)) return null
  return target
}

function nextFoundryRecipe(state: GameState, busy: Set<string>): FoundryRecipeId | null {
  const cfg = processConfig(state)
  if (hasProcess(state, 'foundry-queue')) {
    for (const id of cfg.foundry.queue.slice(0, foundryQueueCap(state))) {
      if (busy.has(id) && foundrySlotCount(state) < 3) continue
      if (!isFoundryRecipeUnlocked(state, id) || isFoundryInfinite(state, id)) continue
      return id
    }
  }
  if (hasProcess(state, 'foundry-repeat') && cfg.foundry.repeatRecipe) {
    const id = cfg.foundry.repeatRecipe
    if (isFoundryRecipeUnlocked(state, id) && !isFoundryInfinite(state, id)) return id
  }
  if (hasProcess(state, 'foundry-prereqs') && cfg.foundry.targetRecipe) {
    const id = pickFoundryPrereqRecipe(state, cfg.foundry.targetRecipe)
    if (id) return id
  }
  if (hasProcess(state, 'smart-smelt')) return pickSmartSmeltRecipe(state, busy)
  return null
}

function autoSmartSmelt(state: GameState): void {
  if (
    !hasProcess(state, 'smart-smelt') &&
    !hasProcess(state, 'foundry-repeat') &&
    !hasProcess(state, 'foundry-queue') &&
    !hasProcess(state, 'foundry-prereqs')
  ) {
    return
  }
  const slots = foundrySlotCount(state)
  const busy = new Set(
    (state.foundry?.slots ?? []).map((s) => s.recipeId).filter((id): id is FoundryRecipeId => Boolean(id)),
  )
  for (let i = 0; i < slots; i++) {
    const current = state.foundry?.slots[i]?.recipeId ?? null
    if (current) continue
    const recipe = nextFoundryRecipe(state, busy)
    if (!recipe) break
    const next = setFoundrySlot(state, i, recipe)
    if (next === state) continue
    adopt(state, next)
    busy.add(recipe)
  }
}

function autoFoundryUpgrades(state: GameState): void {
  if (!hasProcess(state, 'foundry-auto')) return
  if (!processConfig(state).foundry.autoBuy) return
  let guard = 0
  while (guard++ < 8) {
    const bestId = pickFoundryUpgradeId(state)
    if (!bestId) break
    const next = buyFoundryUpgrade(state, bestId)
    if (next === state) break
    adopt(state, next)
  }
}

function autoPrintAssemble(state: GameState): void {
  if (!hasProcess(state, 'print-assemble')) return
  for (const bp of BLUEPRINTS) {
    if (!canAssembleBlueprint(state, bp.moduleId).ok) continue
    const next = assembleBlueprint(state, bp.moduleId)
    if (next === state) continue
    adopt(state, next)
  }
}

function autoSeatShards(state: GameState): void {
  if (!hasProcess(state, 'auto-relic')) return
  const cfg = processConfig(state)
  if (!cfg.reliquary.autoEquip) return
  const keep = hasProcess(state, 'reliquary-keep') ? cfg.reliquary.keepMode : 'keep-all'
  const minScore = hasProcess(state, 'reliquary-quality') ? cfg.reliquary.minScore : 0
  for (const slot of RELIQUARY_SLOTS) {
    if (!isReliquarySlotUnlocked(state, slot.color)) continue
    const fitted = fittedShardId(state, slot.color)
    const fittedDef = fitted ? getShard(fitted) : undefined
    const fittedScore = fittedDef ? shardAutoScore(fittedDef) : 0
    if (fitted && keep === 'keep-all') continue
    let bestId: string | null = null
    let bestScore = fitted ? fittedScore * (keep === 'upgrade-only' ? 1.15 : 1.05) : 0
    for (const def of SHARDS) {
      if (def.color !== slot.color) continue
      if (shardOwned(state, def.id) < 1) continue
      const score = shardAutoScore(def) + Math.min(0.04, shardOwned(state, def.id) * 0.002)
      if (score < minScore) continue
      if (score > bestScore) {
        bestScore = score
        bestId = def.id
      }
    }
    if (!bestId || bestId === fitted) continue
    const next = insertShard(state, bestId)
    if (next === state) continue
    adopt(state, next)
  }
}

function autoResearchFocus(state: GameState): void {
  if (!hasProcess(state, 'research-focus') && !hasProcess(state, 'research-queue')) return
  if (!state.hiveResearch) return
  const cfg = processConfig(state)
  if (hasProcess(state, 'research-focus') && !cfg.research.autoResearch) return
  const incomplete = (id: (typeof HIVE_RESEARCH_BRANCHES)[number]['id']) =>
    hiveResearchCompleted(state, id) < HIVE_RESEARCH_NODES[id].length
  let nextFocus = state.hiveResearch.focus
  if (hasProcess(state, 'research-queue') && cfg.research.queue.length > 0) {
    const queued = cfg.research.queue.slice(0, hiveResearchQueueCap(state)).find(incomplete)
    if (queued) nextFocus = queued
  } else if (hasProcess(state, 'research-priorities') && cfg.research.branchPriority.length > 0) {
    const ranked = cfg.research.branchPriority.find(incomplete)
    if (ranked) nextFocus = ranked
  } else if (hasProcess(state, 'research-focus')) {
    const ranked = cfg.research.branchPriority.find(incomplete)
    if (ranked) nextFocus = ranked
  }
  if (nextFocus === state.hiveResearch.focus) return
  adopt(state, setResearchFocus(state, nextFocus))
}

function autoFurnaceManager(state: GameState): void {
  const next = runFurnaceManager(state, hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state))
  if (next !== state) adopt(state, next)
}

function autoYardArms(state: GameState): void {
  if (!hasProcess(state, 'yard-auto')) return
  if (!processConfig(state).yard.autoUpgrade) return
  const next = buyMaxYardArms(state)
  if (next !== state) adopt(state, next)
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
      return
    }
  }
  if (
    hasProcess(state, 'echo-repeat') &&
    cfg.sortie.echoRepeat &&
    state.combat.docked &&
    !state.echo?.activeId &&
    cfg.sortie.lastEchoId
  ) {
    const next = enterEcho(state, cfg.sortie.lastEchoId)
    if (next !== state) adopt(state, next)
  }
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
  autoBankAsh(state)
  autoSmartSmelt(state)
  autoFoundryUpgrades(state)
  autoPrintAssemble(state)
  autoSeatShards(state)
  autoResearchFocus(state)
  autoFurnaceManager(state)
  autoYardArms(state)
  autoProtocolEchoRepeat(state)
}

/** Re-apply Labor Router when drones sit idle (Labor Loop). */
export function autoLaborLoop(state: GameState): void {
  if (!aiDoctrinesActive(state, 'labor-loop')) return
  if (!state.ai.purchased.includes('auto-assign-workers')) return
  const idle = idleWorkers(state)
  if (idle <= 0) return
  if (idle < Math.max(1, Math.floor(state.base.workerDrones * 0.15))) return
  const next = autoBalanceWorkers(state)
  if (next === state) return
  adopt(state, next)
}
