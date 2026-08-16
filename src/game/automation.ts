/** Passive-loop helpers for expensive AI / Process automation nodes (mutate in place). */

import type { FoundryRecipeId, GameState, NetworkBarId } from './types'
import {
  BLUEPRINTS,
  PART_TYPES,
  STATIONS,
  aiDoctrinesActive,
  blueprintProgress,
  challengeBlocksAi,
  idleWorkers,
  isStationUnlocked,
  moduleLevel,
  moduleUpgradeCost,
} from './catalog'
import {
  assembleBlueprint,
  autoBalanceWorkers,
  canAssembleBlueprint,
  convertAshToHeat,
  depositFabPart,
  launchFabProject,
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
import { hasProcess } from './process'
import { NETWORK_BARS, isNetworkBarUnlocked } from './network'
import { normalizePushMode } from './sectors'
import {
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  buyFoundryUpgrade,
  canBuyFoundryUpgrade,
  foundryRecipeLevel,
  foundrySlotCount,
  foundryUpgradeCost,
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
  hiveResearchNodeCost,
  hiveResearchXp,
  setResearchFocus,
} from './hiveResearch'
import {
  FURNACE_TRACKS,
  buyFurnaceRank,
  canBuyFurnaceRank,
  furnaceRank,
  furnaceRankCost,
} from './furnace'
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
  const processSalvage = hasProcess(state, 'auto-salvage') || hasProcess(state, 'smart-core')
  if (!aiDoctrinesActive(state, 'auto-salvage-loop') && !processSalvage) return
  if (processSalvage && state.combat.docked) {
    if (!aiDoctrinesActive(state, 'auto-salvage-loop')) return
  }
  const smart = hasProcess(state, 'smart-core')
  let guard = 0
  while (guard++ < 20) {
    const next = smart
      ? upgradeBestValueModule(state, { force: true })
      : upgradeCheapestModule(state, { force: processSalvage })
    if (next === state) break
    if (next.resources.salvage >= state.resources.salvage) break
    adopt(state, next)
  }
}

function barPriority(state: GameState): NetworkBarId[] {
  if (!hasProcess(state, 'network-tune')) {
    return NETWORK_BARS.filter((b) => isNetworkBarUnlocked(state, b.id)).map((b) => b.id)
  }
  const live = !state.combat.docked
  const push = normalizePushMode(state.combat.pushMode, state.combat.campaign)
  const order: NetworkBarId[] =
    live && push === 'hold-wave'
      ? ['yield', 'strike', 'ward', 'loom', 'archive']
      : live && push === 'hold-sector'
        ? ['yield', 'ward', 'strike', 'loom', 'archive']
        : live
          ? ['strike', 'ward', 'yield', 'loom', 'archive']
          : ['loom', 'yield', 'strike', 'ward', 'archive']
  return order.filter((id) => isNetworkBarUnlocked(state, id))
}

function autoNetworkBalance(state: GameState): void {
  if (!hasProcess(state, 'network-balance') && !hasProcess(state, 'network-tune')) return
  let idle = idleWorkers(state)
  if (idle <= 0) return
  const bars = barPriority(state)
  if (bars.length === 0) return
  const assignments = { ...state.base.assignments }
  while (idle > 0) {
    let best = bars[0]!
    let bestScore = Infinity
    for (const id of bars) {
      const n = assignments[id] ?? 0
      const rank = bars.indexOf(id)
      const score = n * 100 + rank
      if (score < bestScore) {
        bestScore = score
        best = id
      }
    }
    assignments[best] = (assignments[best] ?? 0) + 1
    idle -= 1
  }
  state.base.assignments = assignments
}

function autoBankAsh(state: GameState): void {
  if (!hasProcess(state, 'auto-bank')) return
  adopt(state, convertAshToHeat(state))
}

function pickSmartSmeltRecipe(state: GameState, busy: Set<string>): FoundryRecipeId | null {
  const salvage = state.resources.salvage
  const pulseCost = moduleUpgradeCost(
    moduleLevel(state.shipyard.moduleLevels, 'pulse-cannon'),
    'pulse-cannon',
  )
  const starve = salvage < pulseCost * 2.5
  let best: FoundryRecipeId | null = null
  let bestScore = -1
  for (const def of FOUNDRY_RECIPES) {
    if (!isFoundryRecipeUnlocked(state, def.id)) continue
    if (isFoundryInfinite(state, def.id)) continue
    if (busy.has(def.id) && foundrySlotCount(state) < 3) continue
    if (starve && (def.costs.salvage ?? 0) > 0) continue
    const level = foundryRecipeLevel(state, def.id)
    let score = 20 - Math.min(12, level)
    if (def.costs.materials) score += 4
    if (def.unlocksRecipe && level + 1 >= def.unlocksRecipe.atLevel) score += 8
    if (score > bestScore) {
      bestScore = score
      best = def.id
    }
  }
  if (!best && !starve && isFoundryRecipeUnlocked(state, 'slag-ingot') && !isFoundryInfinite(state, 'slag-ingot')) {
    best = 'slag-ingot'
  }
  if (!best && isFoundryRecipeUnlocked(state, 'filament') && !isFoundryInfinite(state, 'filament')) {
    best = 'filament'
  }
  return best
}

function autoSmartSmelt(state: GameState): void {
  if (!hasProcess(state, 'smart-smelt')) return
  const slots = foundrySlotCount(state)
  const busy = new Set(
    (state.foundry?.slots ?? []).map((s) => s.recipeId).filter((id): id is FoundryRecipeId => Boolean(id)),
  )
  for (let i = 0; i < slots; i++) {
    const current = state.foundry?.slots[i]?.recipeId ?? null
    if (current) continue
    const recipe = pickSmartSmeltRecipe(state, busy)
    if (!recipe) break
    const next = setFoundrySlot(state, i, recipe)
    if (next === state) continue
    adopt(state, next)
    busy.add(recipe)
  }
}

function autoFoundryUpgrades(state: GameState): void {
  if (!hasProcess(state, 'foundry-auto')) return
  let guard = 0
  while (guard++ < 8) {
    let bestId: string | null = null
    let bestCost = Infinity
    for (const up of FOUNDRY_UPGRADES) {
      if (!canBuyFoundryUpgrade(state, up.id).ok) continue
      const cost = foundryUpgradeCost(state, up.id)
      if (cost < bestCost) {
        bestCost = cost
        bestId = up.id
      }
    }
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
  for (const slot of RELIQUARY_SLOTS) {
    if (!isReliquarySlotUnlocked(state, slot.color)) continue
    const fitted = fittedShardId(state, slot.color)
    const fittedDef = fitted ? getShard(fitted) : undefined
    const fittedScore = fittedDef ? shardAutoScore(fittedDef) : 0
    let bestId: string | null = null
    let bestScore = fitted ? fittedScore * 1.05 : 0
    for (const def of SHARDS) {
      if (def.color !== slot.color) continue
      if (shardOwned(state, def.id) < 1) continue
      const score = shardAutoScore(def) + Math.min(0.04, shardOwned(state, def.id) * 0.002)
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
  if (!hasProcess(state, 'research-focus')) return
  if (!state.hiveResearch) return
  let best = state.hiveResearch.focus
  let bestScore = Infinity
  let any = false
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const nodes = HIVE_RESEARCH_NODES[branch.id]
    const done = hiveResearchCompleted(state, branch.id)
    if (done >= nodes.length) continue
    any = true
    const need = hiveResearchNodeCost(done)
    const fill = hiveResearchXp(state, branch.id) / Math.max(1, need)
    const score = done * 10 - fill
    if (score < bestScore) {
      bestScore = score
      best = branch.id
    }
  }
  if (!any || best === state.hiveResearch.focus) return
  adopt(state, setResearchFocus(state, best))
}

function autoFurnaceRanks(state: GameState): void {
  if (!hasProcess(state, 'furnace-auto')) return
  let guard = 0
  while (guard++ < 8) {
    let bestId: (typeof FURNACE_TRACKS)[number]['id'] | null = null
    let bestCost = Infinity
    for (const track of FURNACE_TRACKS) {
      if (!canBuyFurnaceRank(state, track.id).ok) continue
      const cost = furnaceRankCost(furnaceRank(state, track.id))
      if (cost < bestCost) {
        bestCost = cost
        bestId = track.id
      }
    }
    if (!bestId) break
    const next = buyFurnaceRank(state, bestId)
    if (next === state) break
    adopt(state, next)
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
  autoFurnaceRanks(state)
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
