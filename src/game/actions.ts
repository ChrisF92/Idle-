import type { GameState, LaborProfile, PartType, Resources } from './types'
import {
  AI_NODES,
  MASTERY_PARTS_COST,
  MAX_MODULE_LEVEL,
  MAX_MODULE_MASTERY,
  PART_TYPES,
  RESEARCH,
  STATIONS,
  canBuyChallengeShop,
  canBuyMatterShop,
  canDepositPart,
  challengeClearCount,
  challengeShopStartingAi,
  challengeShopStartingSalvage,
  challengeShopStartingScrap,
  countModuleParts,
  effectiveMaxClears,
  getAiNode,
  getBlueprint,
  getChallenge,
  getChallengeShopItem,
  getEssenceUpgrade,
  getFrame,
  getMatterShopItem,
  getModule,
  getStation,
  isAiNodePermanent,
  isChallengeUnlocked,
  isFarmableModule,
  isStationUnlocked,
  canFitModuleOnFrame,
  filterModulesForChallenge,
  idleWorkers,
  isBlueprintComplete,
  isModuleBlockedByChallenge,
  moduleLevel,
  moduleMasteryRank,
  moduleUpgradeCost,
  parsePartId,
  partId,
  partSellScrap,
  prestigeMinSectorFor,
  shopRank,
  stationBlackBarNeed,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  trimModulesToFrame,
  type ResourceCost,
} from './catalog'
import { milestonesFor, pendingMilestone } from './milestones'
import { createEmptyNetworkState, isNetworkBarId, isNetworkBarUnlocked } from './network'
import {
  buyFoundryUpgrade,
  equipFoundryModule,
  persistFoundryOnRebuild,
  setFoundrySlot,
  unequipFoundryModule,
} from './foundry'
import { insertShard, removeShard } from './reliquary'
import { buyFurnaceRank, convertAshToHeat as convertAshToHeatRaw } from './furnace'
import { hiveResearchHeatFromAshMult, setResearchFocus } from './hiveResearch'
import {
  armYardOnRebuild,
  buyYardArm,
  clearYardBuilding,
  createEmptyYardState,
  placeYardBuilding,
} from './yard'
import {
  canEnterProtocol,
  createEmptyProtocolState,
  getProtocol,
  wipeProtocolLoadout,
} from './protocols'
import {
  canBuyEchoNode,
  canEnterEcho,
  createEmptyEchoState,
  failEcho,
  getEchoNode,
  getEchoRun,
} from './echo'
import { canBuyProcessNode, createEmptyProcessState, getProcessNode } from './process'
import { createEmptySpecialistState, rankSpecialist } from './specialists'
import { createEmptyCapitalState, rankCapital } from './capital'
import { canReinforce, REINFORCE_UNLOCK_SECTOR } from './reinforce'
import { noteSalvageSpend } from './sortieSummary'
import {
  isRouteBUnlocked,
  maxLaunchSector,
  normalizeRoute,
} from './sectors'
import type { SectorRoute } from './types'
import {
  buildFlagshipWeapons,
  computeShipStats,
  createInitialState,
  syncPersistedHullCaps,
} from './state'
import { buildPlayerFleet } from './combat'
import {
  ACT1_FINAL_SECTOR,
  careerHighestSector,
  retirePostResetOnboarding,
  tryCompleteAchievements,
} from './progression'
import {
  createEmptySignalCoresState,
  unequipAllSignalCores,
} from './signalCores'

export {
  equipSignalCore,
  unequipSignalCore,
  mergeSignalCores,
  canEquipSignalCore,
} from './signalCores'

export {
  buyFoundryUpgrade,
  equipFoundryModule,
  setFoundrySlot,
  unequipFoundryModule,
}

export { insertShard, removeShard, buyFurnaceRank, setResearchFocus }

export {
  placeYardBuilding,
  clearYardBuilding,
  buyYardArm,
}

export function convertAshToHeat(state: GameState): GameState {
  return convertAshToHeatRaw(state, hiveResearchHeatFromAshMult(state))
}

export function setNumberNotation(
  state: GameState,
  mode: 'engineering' | 'scientific',
): GameState {
  if (mode !== 'engineering' && mode !== 'scientific') return state
  if (state.meta.numberNotation === mode) return state
  const next = structuredClone(state)
  next.meta.numberNotation = mode
  return next
}

export function setLaunchSector(state: GameState, sector: number): GameState {
  if (!state.combat.docked) return state
  if (state.protocols?.activeId || state.echo?.activeId) return state
  const max = maxLaunchSector(careerHighestSector(state))
  const nextSector = Math.max(1, Math.min(max, Math.floor(sector)))
  if (nextSector === state.combat.sector && state.combat.wave === 1) return state
  const next = structuredClone(state)
  next.combat.sector = nextSector
  next.combat.wave = 1
  return next
}

export function setSectorRoute(state: GameState, route: SectorRoute): GameState {
  if (!state.combat.docked) return state
  const normalized = normalizeRoute(route)
  if (normalized === 'B' && !isRouteBUnlocked(careerHighestSector(state))) return state
  if (state.combat.route === normalized) return state
  const next = structuredClone(state)
  next.combat.route = normalized
  return next
}

function canAfford(resources: Resources, cost: ResourceCost): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    const need = amount ?? 0
    if (resources[key as keyof Resources] < need) return false
  }
  return true
}

function pay(resources: Resources, cost: ResourceCost): void {
  for (const [key, amount] of Object.entries(cost)) {
    resources[key as keyof Resources] -= amount ?? 0
  }
}

export function assignWorker(
  state: GameState,
  stationId: string,
  delta: number,
): GameState {
  const networkBar = isNetworkBarId(stationId)
  if (networkBar) {
    if (!isNetworkBarUnlocked(state, stationId)) return state
  } else {
    const def = getStation(stationId)
    if (!def || !isStationUnlocked(state, stationId)) return state
  }
  if (delta === 0) return state

  const current = state.base.assignments[stationId] ?? 0
  if (delta > 0) {
    if (idleWorkers(state) < delta) return state
    const next = structuredClone(state)
    next.base.assignments = {
      ...next.base.assignments,
      [stationId]: current + delta,
    }
    return next
  }

  const remove = Math.min(current, -delta)
  if (remove <= 0) return state
  const next = structuredClone(state)
  const left = current - remove
  const assignments = { ...next.base.assignments }
  if (left <= 0) delete assignments[stationId]
  else assignments[stationId] = left
  next.base.assignments = assignments
  return next
}

/** Industry stations Labor Router can assign (excludes Core training). */
function laborStations(state: GameState) {
  return STATIONS.filter(
    (s) => s.kind !== 'training' && isStationUnlocked(state, s.id),
  )
}

function setLaborAssignments(
  state: GameState,
  assignments: Record<string, number>,
): GameState {
  const next = structuredClone(state)
  next.base.assignments = assignments
  return next
}

/** Fill each industry station to black-bar; dump overflow to Core training. */
function assignBalanced(state: GameState): Record<string, number> {
  const stations = laborStations(state)
  const assignments: Record<string, number> = {}
  if (stations.length === 0 || state.base.workerDrones <= 0) return assignments

  let remaining = state.base.workerDrones
  const needs = stations
    .map((s) => ({ id: s.id, bb: stationBlackBarNeed(state, s.id) }))
    .filter((r) => Number.isFinite(r.bb))
    .sort((a, b) => a.bb - b.bb || a.id.localeCompare(b.id))

  for (const row of needs) {
    if (remaining <= 0) break
    const n = Math.min(remaining, row.bb)
    if (n > 0) {
      assignments[row.id] = n
      remaining -= n
    }
  }

  if (remaining > 0) {
    dumpOverflowDrones(state, assignments, remaining)
  }
  return assignments
}

/** Prefer uncapped Core training; otherwise overcap Scrap Field. */
function dumpOverflowDrones(
  state: GameState,
  assignments: Record<string, number>,
  count: number,
): void {
  let left = count
  const training = STATIONS.filter(
    (s) => s.kind === 'training' && isStationUnlocked(state, s.id),
  )
  if (training.length > 0) {
    const each = Math.floor(left / training.length)
    for (const s of training) {
      if (each > 0) {
        assignments[s.id] = (assignments[s.id] ?? 0) + each
        left -= each
      }
    }
    for (const s of training) {
      if (left <= 0) break
      assignments[s.id] = (assignments[s.id] ?? 0) + 1
      left -= 1
    }
  }
  if (left > 0) {
    const dump = isStationUnlocked(state, 'scrap-field')
      ? 'scrap-field'
      : laborStations(state)[0]?.id
    if (dump) assignments[dump] = (assignments[dump] ?? 0) + left
  }
}

/**
 * Weighted industry profiles (USI-style presets).
 * Weights are relative shares of the worker pool.
 */
function assignByProfile(
  state: GameState,
  profile: LaborProfile,
): Record<string, number> {
  if (profile === 'balanced') return assignBalanced(state)

  const stations = laborStations(state)
  const assignments: Record<string, number> = {}
  if (stations.length === 0 || state.base.workerDrones <= 0) return assignments

  const weightFor = (id: string): number => {
    if (profile === 'scrap') {
      if (id === 'scrap-field') return 5
      if (id === 'power-grid') return 2
      if (id === 'sensor-net') return 2
      if (id === 'drone-fab') return 2
      if (id === 'alloy-foundry') return 1
      if (id === 'repair-bay') return 1
      if (id === 'fab-bay') return 1
      return 1
    }
    if (profile === 'data') {
      if (id === 'sensor-net') return 5
      if (id === 'scrap-field') return 3
      if (id === 'power-grid') return 2
      if (id === 'drone-fab') return 2
      if (id === 'alloy-foundry') return 1
      if (id === 'fab-bay') return 1
      return 1
    }
    // foundry-safe: keep scrap drones covering alloy upkeep, then balance.
    if (id === 'scrap-field') return 4
    if (id === 'alloy-foundry') return 2
    if (id === 'power-grid') return 2
    if (id === 'sensor-net') return 2
    if (id === 'drone-fab') return 2
    if (id === 'fab-bay') return 1
    if (id === 'repair-bay') return 1
    return 1
  }

  // Black-bar aware: fill stations up to BB by weight priority, then overflow.
  const wants = stations
    .map((s) => ({
      id: s.id,
      w: weightFor(s.id),
      bb: stationBlackBarNeed(state, s.id),
    }))
    .filter((r) => Number.isFinite(r.bb))
    .sort((a, b) => b.w - a.w || a.id.localeCompare(b.id))

  let remaining = state.base.workerDrones
  for (const row of wants) {
    if (remaining <= 0) break
    const n = Math.min(remaining, row.bb)
    if (n > 0) {
      assignments[row.id] = n
      remaining -= n
    }
  }

  if (remaining > 0) {
    dumpOverflowDrones(state, assignments, remaining)
  }

  // Foundry-safe: pull from foundry into scrap until scrap income ≥ upkeep.
  if (profile === 'foundry-safe') {
    const scrapRate = getStation('scrap-field')?.rates.scrap ?? 0.4
    let scrapDrones = assignments['scrap-field'] ?? 0
    let foundryDrones = assignments['alloy-foundry'] ?? 0
    const foundryDef = getStation('alloy-foundry')
    const upkeepPer = foundryDef
      ? stationUpkeepScrapPerDrone(state, foundryDef)
      : 0.16
    // Compare saturated scrap income vs body-based foundry upkeep.
    const probe = {
      ...state,
      base: {
        ...state.base,
        assignments: {
          ...assignments,
          'scrap-field': scrapDrones,
          'alloy-foundry': foundryDrones,
        },
      },
    }
    while (foundryDrones > 0) {
      probe.base.assignments['scrap-field'] = scrapDrones
      probe.base.assignments['alloy-foundry'] = foundryDrones
      const scrapEff = stationEffectiveDrones(probe, 'scrap-field')
      if (scrapEff * scrapRate + 1e-9 >= foundryDrones * upkeepPer) break
      foundryDrones -= 1
      scrapDrones += 1
    }
    if (scrapDrones > 0) assignments['scrap-field'] = scrapDrones
    else delete assignments['scrap-field']
    if (foundryDrones > 0) assignments['alloy-foundry'] = foundryDrones
    else delete assignments['alloy-foundry']
  }

  return assignments
}

/** Apply Labor Router with the saved (or provided) profile. */
export function autoBalanceWorkers(
  state: GameState,
  profile?: LaborProfile,
): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
  const stations = laborStations(state)
  if (stations.length === 0 || state.base.workerDrones <= 0) return state

  const chosen = profile ?? state.meta.laborProfile ?? 'balanced'
  const next = setLaborAssignments(state, assignByProfile(state, chosen))
  next.meta.laborProfile = chosen
  return next
}

export function setLaborProfile(state: GameState, profile: LaborProfile): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  const next = structuredClone(state)
  next.meta.laborProfile = profile
  return next
}

/** Recall all industry (+ optional training) workers to the idle pool. */
export function clearWorkerAssignments(
  state: GameState,
  opts?: { includeTraining?: boolean },
): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
  const next = structuredClone(state)
  if (opts?.includeTraining) {
    next.base.assignments = {}
    return next
  }
  const kept: Record<string, number> = {}
  for (const [id, n] of Object.entries(next.base.assignments)) {
    const station = getStation(id)
    if (station?.kind === 'training' && n > 0) kept[id] = n
  }
  next.base.assignments = kept
  return next
}

/**
 * Fill toward black-bar first; if already BB (or uncapped), dump remaining idle.
 */
export function fillStationWorkers(state: GameState, stationId: string): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
  if (!isStationUnlocked(state, stationId)) return state
  const idle = idleWorkers(state)
  if (idle <= 0) return state
  const assigned = state.base.assignments[stationId] ?? 0
  const bb = stationBlackBarNeed(state, stationId)
  if (Number.isFinite(bb) && assigned < bb) {
    return assignWorker(state, stationId, Math.min(idle, bb - assigned))
  }
  return assignWorker(state, stationId, idle)
}

export function unequipAllModules(state: GameState): GameState {
  if (!state.ai.purchased.includes('batch-refit')) return state
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  next.shipyard.modules = []
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function upgradeCheapestModule(state: GameState, opts?: { force?: boolean }): GameState {
  if (
    !opts?.force &&
    !state.ai.purchased.includes('salvage-optimizer') &&
    !(state.process?.purchased ?? []).includes('auto-salvage')
  ) {
    return state
  }
  if (state.prestige.activeChallengeId === 'no-ai') return state

  let bestId: string | null = null
  let bestLevel = Infinity
  let bestCost = Infinity
  for (const id of state.shipyard.unlockedModules) {
    const level = moduleLevel(state.shipyard.moduleLevels, id)
    if (level >= MAX_MODULE_LEVEL) continue
    if (pendingMilestone(id, level, state.shipyard.corePicks?.[id])) continue
    const cost = moduleUpgradeCost(level, id)
    if (cost > state.resources.salvage) continue
    if (level < bestLevel || (level === bestLevel && cost < bestCost)) {
      bestId = id
      bestLevel = level
      bestCost = cost
    }
  }
  if (!bestId) return state
  return upgradeModule(state, bestId)
}

export function buyResearch(state: GameState, researchId: string): GameState {
  const def = RESEARCH.find((r) => r.id === researchId)
  if (!def) return state
  if (state.research.unlocked.includes(researchId)) return state
  if (state.resources.data < def.costData) return state
  if ((def.costEssence ?? 0) > state.resources.essence) return state

  const next = structuredClone(state)
  next.resources.data -= def.costData
  next.resources.essence -= def.costEssence ?? 0
  next.research.unlocked = [...next.research.unlocked, researchId]
  if (researchId === 'tactical-codex') {
    next.meta.codexUnlocked = true
  }
  tryCompleteAchievements(next)
  return next
}

export function buyAiNode(state: GameState, nodeId: string): GameState {
  const def = AI_NODES.find((n) => n.id === nodeId)
  if (!def) return state
  if (state.ai.purchased.includes(nodeId)) return state
  if (state.resources.aiPoints < def.costAiPoints) return state
  if (
    state.prestige.activeChallengeId === 'no-ai' ||
    state.prestige.activeChallengeId === 'hollow-choir'
  ) {
    return state
  }
  if ((def.requiresSectorEver ?? 0) > careerHighestSector(state)) return state
  if (def.requiresAiNode && !state.ai.purchased.includes(def.requiresAiNode)) {
    return state
  }

  const next = structuredClone(state)
  next.resources.aiPoints -= def.costAiPoints
  next.ai.purchased = [...next.ai.purchased, nodeId]
  tryCompleteAchievements(next)
  return next
}

export function buyEssenceUpgrade(state: GameState, upgradeId: string): GameState {
  const def = getEssenceUpgrade(upgradeId)
  if (!def) return state
  if (state.essence.purchased.includes(upgradeId)) return state
  if (state.resources.essence < def.costEssence) return state

  const next = structuredClone(state)
  next.resources.essence -= def.costEssence
  next.essence.purchased = [...next.essence.purchased, upgradeId]
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function buyChallengeShop(state: GameState, itemId: string): GameState {
  const def = getChallengeShopItem(itemId)
  if (!def) return state
  const check = canBuyChallengeShop(state, itemId)
  if (!check.ok) return state

  const next = structuredClone(state)
  next.resources.challengePoints -= check.cost
  next.prestige.shop = {
    ...next.prestige.shop,
    [itemId]: check.nextRank,
  }
  // Cap / power shop ranks are derived — no instant drone grants.
  if (def.unlockModuleId && check.nextRank >= 1) {
    if (!next.shipyard.unlockedModules.includes(def.unlockModuleId)) {
      next.shipyard.unlockedModules = [
        ...next.shipyard.unlockedModules,
        def.unlockModuleId,
      ]
    }
  }
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function buyMatterShop(state: GameState, itemId: string): GameState {
  const def = getMatterShopItem(itemId)
  if (!def) return state
  const check = canBuyMatterShop(state, itemId)
  if (!check.ok) return state

  const next = structuredClone(state)
  next.resources.prestigeMatter -= check.cost
  next.prestige.matterShop = {
    ...next.prestige.matterShop,
    [itemId]: check.nextRank,
  }
  // Cap / power shop ranks are derived — no instant drone grants.
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unlockFrame(state: GameState, frameId: string): GameState {
  const def = getFrame(frameId)
  if (!def) return state
  if (state.shipyard.unlockedFrames.includes(frameId)) return state
  if ((def.requiresSectorEver ?? 0) > careerHighestSector(state)) return state
  if (!canAfford(state.resources, def.unlockCost)) return state

  const next = structuredClone(state)
  pay(next.resources, def.unlockCost)
  next.shipyard.unlockedFrames = [...next.shipyard.unlockedFrames, frameId]
  return next
}

export function selectFrame(state: GameState, frameId: string): GameState {
  if (!state.shipyard.unlockedFrames.includes(frameId)) return state
  if (state.shipyard.frameLocked) return state
  const frame = getFrame(frameId)
  if (!frame) return state

  const next = structuredClone(state)
  next.shipyard.frameId = frameId
  next.shipyard.modules = filterModulesForChallenge(
    trimModulesToFrame(next.shipyard.modules, frame),
    next.prestige.activeChallengeId,
  )
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unlockModule(state: GameState, moduleId: string): GameState {
  const def = getModule(moduleId)
  if (!def) return state
  if (state.shipyard.unlockedModules.includes(moduleId)) return state
  // Farmable modules unlock only via Fabrication Bay (or already unlocked).
  if (isFarmableModule(moduleId)) return state
  if (def.requiresChallengeShop) {
    if (shopRank(state.prestige.shop, def.requiresChallengeShop) < 1) return state
    const next = structuredClone(state)
    next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
    return next
  }
  if ((def.requiresSectorEver ?? 0) > careerHighestSector(state)) return state
  if (!canAfford(state.resources, def.unlockCost)) return state

  const next = structuredClone(state)
  pay(next.resources, def.unlockCost)
  next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
  return next
}

export function startFabProject(state: GameState, moduleId: string): GameState {
  if (!isFarmableModule(moduleId)) return state
  if (!getBlueprint(moduleId)) return state
  if (!state.meta.discoveredModules.includes(moduleId)) return state
  if (state.shipyard.unlockedModules.includes(moduleId)) return state
  if (!isStationUnlocked(state, 'fab-bay')) return state
  if (state.base.fabProject?.moduleId === moduleId) return state

  const next = structuredClone(state)
  // Cancel prior project — return contributed parts to inventory.
  if (next.base.fabProject) {
    refundFabContributed(next)
  }
  next.base.fabProject = {
    moduleId,
    contributed: {},
    progress: 0,
  }
  return next
}

/** Start a fab project and auto-deposit all available inventory parts. */
export function launchFabProject(state: GameState, moduleId: string): GameState {
  let next = startFabProject(state, moduleId)
  if (!next.base.fabProject || next.base.fabProject.moduleId !== moduleId) {
    // Already on this project — still top up deposits.
    if (state.base.fabProject?.moduleId === moduleId) {
      next = state
    } else {
      return next
    }
  }
  for (const pt of PART_TYPES) {
    next = depositFabPart(next, pt, 9999)
  }
  return next
}

export function clearFabProject(state: GameState): GameState {
  if (!state.base.fabProject) return state
  const next = structuredClone(state)
  refundFabContributed(next)
  next.base.fabProject = null
  return next
}

function refundFabContributed(state: GameState): void {
  const project = state.base.fabProject
  if (!project) return
  for (const pt of PART_TYPES) {
    const n = project.contributed[pt] ?? 0
    if (n <= 0) continue
    const id = partId(project.moduleId, pt)
    state.parts[id] = (state.parts[id] ?? 0) + n
  }
}

export function depositFabPart(
  state: GameState,
  partType: PartType,
  qty = 1,
): GameState {
  if (!canDepositPart(state, partType, qty)) return state
  const project = state.base.fabProject!
  const recipe = getBlueprint(project.moduleId)!
  const need = recipe[partType]
  const have = project.contributed[partType] ?? 0
  const room = need - have
  const invKey = partId(project.moduleId, partType)
  const inv = state.parts[invKey] ?? 0
  const move = Math.min(qty, room, inv)
  if (move <= 0) return state

  const next = structuredClone(state)
  next.parts[invKey] = inv - move
  if (next.parts[invKey] <= 0) delete next.parts[invKey]
  const proj = next.base.fabProject!
  proj.contributed = {
    ...proj.contributed,
    [partType]: have + move,
  }
  // Incomplete recipe cannot craft; clear any stale progress.
  if (!isBlueprintComplete(proj.contributed, recipe)) {
    proj.progress = 0
  }
  return next
}

export function withdrawFabPart(
  state: GameState,
  partType: PartType,
  qty = 1,
): GameState {
  const project = state.base.fabProject
  if (!project || qty <= 0) return state
  const have = project.contributed[partType] ?? 0
  const move = Math.min(qty, have)
  if (move <= 0) return state

  const next = structuredClone(state)
  const proj = next.base.fabProject!
  const left = have - move
  const contributed = { ...proj.contributed }
  if (left <= 0) delete contributed[partType]
  else contributed[partType] = left
  proj.contributed = contributed
  proj.progress = 0
  const invKey = partId(proj.moduleId, partType)
  next.parts[invKey] = (next.parts[invKey] ?? 0) + move
  return next
}

export function sellPart(state: GameState, partIdStr: string, qty = 1): GameState {
  if (qty <= 0) return state
  const parsed = parsePartId(partIdStr)
  if (!parsed) return state
  const have = state.parts[partIdStr] ?? 0
  const sell = Math.min(qty, have)
  if (sell <= 0) return state
  const scrapEach = partSellScrap(partIdStr)
  if (scrapEach <= 0) return state

  const next = structuredClone(state)
  const left = have - sell
  if (left <= 0) delete next.parts[partIdStr]
  else next.parts[partIdStr] = left
  next.resources.scrap += scrapEach * sell
  return next
}

export function investPartMastery(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (!getModule(moduleId)) return state
  const rank = moduleMasteryRank(state, moduleId)
  if (rank >= MAX_MODULE_MASTERY) return state
  if (countModuleParts(state, moduleId) < MASTERY_PARTS_COST) return state

  const next = structuredClone(state)
  let need = MASTERY_PARTS_COST
  // Consume any parts of this module (prefer casing → core → lens).
  for (const pt of PART_TYPES) {
    if (need <= 0) break
    const id = partId(moduleId, pt)
    const have = next.parts[id] ?? 0
    const take = Math.min(have, need)
    if (take <= 0) continue
    const left = have - take
    if (left <= 0) delete next.parts[id]
    else next.parts[id] = left
    need -= take
  }
  if (need > 0) return state
  next.meta.moduleMastery = {
    ...next.meta.moduleMastery,
    [moduleId]: rank + 1,
  }
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function fitModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (state.shipyard.modules.includes(moduleId)) return state
  if (isModuleBlockedByChallenge(state.prestige.activeChallengeId, moduleId)) {
    return state
  }
  const frame = getFrame(state.shipyard.frameId)
  if (!frame) return state
  if (!canFitModuleOnFrame(frame, state.shipyard.modules, moduleId)) return state

  const next = structuredClone(state)
  next.shipyard.modules = [...next.shipyard.modules, moduleId]
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unfitModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.modules.includes(moduleId)) return state
  const next = structuredClone(state)
  next.shipyard.modules = next.shipyard.modules.filter((id) => id !== moduleId)
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function prestigeGainFor(state: GameState): number {
  // +1 softens the re-push so first S10 prestige yields 6 PM.
  const base = Math.max(
    1,
    Math.floor(state.combat.sector / 2) + state.prestige.prestigeCount + 1,
  )
  const ascensions = state.meta.ascensionCount ?? 0
  // Ascension is the long-term PM accelerator (USI-style snowball).
  return Math.max(1, Math.floor(base * (1 + 0.4 * ascensions)))
}

export function canPrestige(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  return state.combat.sector >= prestigeMinSectorFor(state.prestige.shop)
}

/** Ascension unlocks after Act 1; soft-resets the run and boosts future PM gains. */
export function canAscend(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  if (!state.meta.act1Cleared) return false
  return state.combat.sector >= ACT1_FINAL_SECTOR
}

export function canEnterChallenge(state: GameState, challengeId: string): boolean {
  if (state.prestige.activeChallengeId) return false
  if (!state.meta.act1Cleared && careerHighestSector(state) < ACT1_FINAL_SECTOR) {
    return false
  }
  const challenge = getChallenge(challengeId)
  if (!challenge) return false
  if (!isChallengeUnlocked(state, challengeId)) return false
  const clears = challengeClearCount(state.prestige.challengeClears, challengeId)
  if (clears >= effectiveMaxClears(challenge, state.prestige.shop)) return false
  // Ascension-entry challenges (ITRTG double-rebirth style) start from S30+.
  if (challenge.entryCost === 'ascension') {
    return canAscend(state)
  }
  return state.combat.sector >= prestigeMinSectorFor(state.prestige.shop)
}

/** Persist fitted loadout; drop modules that conflict with an active challenge. */
function persistLoadout(
  unlockedFrames: string[],
  unlockedModules: string[],
  frameId: string,
  modules: string[],
  activeChallengeId: string | null,
): GameState['shipyard'] {
  const frame = unlockedFrames.includes(frameId) ? frameId : 'scout-frame'
  const frameDef = getFrame(frame) ?? getFrame('scout-frame')!
  let fitted = filterModulesForChallenge(
    trimModulesToFrame(
      modules.filter((id) => unlockedModules.includes(id)),
      frameDef,
    ),
    activeChallengeId,
  )

  if (fitted.length === 0 && unlockedModules.includes('pulse-cannon')) {
    fitted = ['pulse-cannon']
  }

  return {
    frameId: frame,
    modules: fitted,
    unlockedFrames,
    unlockedModules,
    moduleLevels: {},
    corePicks: {},
    frameLocked: false,
  }
}

export function upgradeModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (!getModule(moduleId)) return state
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  if (level >= MAX_MODULE_LEVEL) return state
  if (pendingMilestone(moduleId, level, state.shipyard.corePicks?.[moduleId])) return state
  const cost = moduleUpgradeCost(level, moduleId)
  if (state.resources.salvage < cost) return state

  const next = structuredClone(state)
  next.resources.salvage -= cost
  noteSalvageSpend(next, cost)
  next.shipyard.moduleLevels = {
    ...next.shipyard.moduleLevels,
    [moduleId]: level + 1,
  }
  if (!next.combat.inFight) {
    syncPersistedHullCaps(next)
    return next
  }

  const prevUnits = next.combat.playerUnits
  const rebuilt = buildPlayerFleet(next)
  for (const unit of rebuilt) {
    const prev = prevUnits.find((u) => u.id === unit.id)
    if (prev && prev.hullMax > 0) {
      unit.hull = Math.max(1, unit.hullMax * (prev.hull / prev.hullMax))
      unit.shield =
        unit.shieldMax > 0
          ? unit.shieldMax * (prev.shield / Math.max(1, prev.shieldMax))
          : 0
    }
  }
  const prevFlag = prevUnits.find((u) => u.isFlagship)
  const nextFlag = rebuilt.find((u) => u.isFlagship)
  if (prevFlag && nextFlag) {
    nextFlag.weapons = buildFlagshipWeapons(next).map((w) => {
      const old = prevFlag.weapons.find((pw) => pw.id === w.id)
      return old ? { ...w, cooldownLeft: old.cooldownLeft } : w
    })
  }
  next.combat.playerUnits = rebuilt
  const stats = computeShipStats(next)
  next.combat.playerHullMax = stats.hullMax
  next.combat.playerShieldMax = stats.shieldMax
  if (nextFlag) {
    next.combat.playerHull = nextFlag.hull
    next.combat.playerShield = nextFlag.shield
  }
  return next
}

function applyRunReset(state: GameState, now = Date.now()): void {
  const permanentAi = state.ai.purchased.filter((id) => {
    const def = getAiNode(id)
    return def ? isAiNodePermanent(def) : false
  })
  /** Doctrines wipe on reset — refund their AIP so rebuys aren't a permanent tax. */
  const doctrineRefund = state.ai.purchased.reduce((sum, id) => {
    const def = getAiNode(id)
    if (!def || isAiNodePermanent(def)) return sum
    return sum + def.costAiPoints
  }, 0)

  const kept = {
    prestigeMatter: state.resources.prestigeMatter,
    challengePoints: state.resources.challengePoints,
    /** Achievement AI Points persist; doctrine spend is refunded; shop bonus stacks. */
    aiPoints: state.resources.aiPoints + doctrineRefund,
    essence: state.resources.essence,
    essencePurchased: [...state.essence.purchased],
    unlockedFrames: [...state.shipyard.unlockedFrames],
    unlockedModules: [...state.shipyard.unlockedModules],
    frameId: state.shipyard.frameId,
    modules: [...state.shipyard.modules],
    prestigeCount: state.prestige.prestigeCount,
    challengeClears: { ...state.prestige.challengeClears },
    activeChallengeId: state.prestige.activeChallengeId,
    shop: { ...state.prestige.shop },
    matterShop: { ...state.prestige.matterShop },
    seenFamilies: [...(state.codex?.seenFamilies ?? [])],
    workerDrones: state.base.workerDrones,
    manufactureProgress: state.base.manufactureProgress,
    permanentAi,
    /** Research is permanent — rebuying the tree every prestige was redundant. */
    researchUnlocked: [...state.research.unlocked],
    meta: {
      ...state.meta,
      ascensionCount: state.meta.ascensionCount ?? 0,
      codexUnlocked: state.meta.codexUnlocked === true,
      laborProfile: state.meta.laborProfile ?? 'balanced',
      achievementCompletions: { ...(state.meta.achievementCompletions ?? {}) },
      lifetimeSectorClears: state.meta.lifetimeSectorClears ?? 0,
      lifetimeFabCrafts: state.meta.lifetimeFabCrafts ?? 0,
      lifetimeCoreMerges: state.meta.lifetimeCoreMerges ?? 0,
      lifetimeWaveClears: state.meta.lifetimeWaveClears ?? 0,
      discoveredModules: [...(state.meta.discoveredModules ?? [])],
      moduleMastery: { ...(state.meta.moduleMastery ?? {}) },
      signalCoresCarryOver: state.meta.signalCoresCarryOver ?? false,
      seenOnboarding: [...(state.meta.seenOnboarding ?? [])],
    },
    parts: { ...(state.parts ?? {}) },
    choirAsh: state.resources.choirAsh ?? 0,
    heat: state.resources.heat ?? 0,
    reliquary: structuredClone(state.reliquary ?? { owned: {}, slots: {} }),
    furnace: structuredClone(state.furnace ?? { ranks: { attack: 0, defense: 0, lab: 0, workshop: 0 } }),
    hiveResearch: structuredClone(
      state.hiveResearch ?? {
        focus: 'material',
        xp: { material: 0, energy: 0, observation: 0 },
        completed: { material: 0, energy: 0, observation: 0 },
      },
    ),
    yard: structuredClone(state.yard ?? createEmptyYardState()),
    protocols: {
      activeId: null,
      ranks: { ...(state.protocols?.ranks ?? {}) },
    },
    echo: {
      ...createEmptyEchoState(),
      ...(state.echo ?? {}),
      activeId: null,
      resumeSector: 1,
      resumeWave: 1,
      points: state.echo?.points ?? 0,
      tree: [...(state.echo?.tree ?? [])],
      clears: { ...(state.echo?.clears ?? {}) },
    },
    process: {
      purchased: [...(state.process?.purchased ?? [])],
    },
    specialists: structuredClone(state.specialists ?? createEmptySpecialistState()),
    capital: structuredClone(state.capital ?? createEmptyCapitalState()),
    signalCores:
      state.meta.signalCoresCarryOver
        ? {
            inventory: structuredClone(state.signalCores?.inventory ?? []),
            equipped: { ...(state.signalCores?.equipped ?? {}) },
          }
        : createEmptySignalCoresState(),
  }

  const fresh = createInitialState(now)
  const bonusScrap = challengeShopStartingScrap(kept.shop)
  const bonusAi = challengeShopStartingAi(kept.shop)
  const bonusSalvage = challengeShopStartingSalvage(kept.shop)
  /**
   * USI-style acceleration: returning kits grow with prestige count so each
   * re-push starts faster (salvage / industry kick sooner). Data kit is smaller
   * now that research persists.
   */
  const returning = kept.prestigeCount > 0 || (kept.meta.ascensionCount ?? 0) > 0
  const pc = kept.prestigeCount
  const ac = kept.meta.ascensionCount ?? 0
  const returnScrap = returning ? 10 + Math.min(50, pc * 6 + ac * 8) : 0
  const returnData = returning ? Math.min(12, 2 + pc + ac * 2) : 0
  const returnSalvage = returning ? 6 + Math.min(30, pc * 3 + ac * 4) : 0

  state.version = fresh.version
  state.lastTickAt = now
  state.resources = {
    ...fresh.resources,
    prestigeMatter: kept.prestigeMatter,
    challengePoints: kept.challengePoints,
    essence: kept.essence,
    scrap: fresh.resources.scrap + bonusScrap + returnScrap,
    data: fresh.resources.data + returnData,
    aiPoints: kept.aiPoints + bonusAi,
    salvage: bonusSalvage + returnSalvage,
    choirAsh: kept.choirAsh,
    heat: kept.heat,
  }
  state.shipyard = persistLoadout(
    kept.unlockedFrames,
    kept.unlockedModules,
    kept.frameId,
    kept.modules,
    kept.activeChallengeId,
  )
  state.combat = {
    ...fresh.combat,
    campaign: true,
    docked: true,
    wave: 1,
    log: [
      `Run reset. Rebuild Matter: ${kept.prestigeMatter}. Choose your frame, then Launch.`,
    ],
  }
  state.base = {
    workerDrones: kept.workerDrones,
    assignments: {},
    manufactureProgress: kept.manufactureProgress,
    fabProject: null,
  }
  state.research = { unlocked: kept.researchUnlocked }
  state.ai = { purchased: kept.permanentAi }
  state.essence = { purchased: kept.essencePurchased }
  state.prestige = {
    prestigeCount: kept.prestigeCount,
    activeChallengeId: kept.activeChallengeId,
    challengeClears: kept.challengeClears,
    shop: kept.shop,
    matterShop: kept.matterShop,
  }
  state.codex = { seenFamilies: kept.seenFamilies }
  state.meta = kept.meta
  state.core = fresh.core
  state.network = createEmptyNetworkState()
  state.foundry = persistFoundryOnRebuild(state.foundry)
  state.reliquary = kept.reliquary
  state.furnace = kept.furnace
  state.hiveResearch = kept.hiveResearch
  state.yard = armYardOnRebuild(kept.yard)
  state.protocols = kept.protocols
  state.echo = kept.echo
  state.process = kept.process
  state.specialists = kept.specialists
  state.capital = kept.capital
  state.signalCores = kept.signalCores
  state.parts = kept.parts

  retirePostResetOnboarding(state)

  // Re-apply Labor Loop immediately so returning runs aren't stuck idle.
  if (
    kept.permanentAi.includes('labor-loop') &&
    kept.permanentAi.includes('auto-assign-workers') &&
    state.prestige.activeChallengeId !== 'no-ai'
  ) {
    const assigned = autoBalanceWorkers(state)
    state.base.assignments = assigned.base.assignments
    state.meta.laborProfile = assigned.meta.laborProfile
  }

  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerShield = stats.shieldMax
}

export function pickCoreMilestone(
  state: GameState,
  moduleId: string,
  milestoneId: string,
  choiceId: string,
): GameState {
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  const ms = milestonesFor(moduleId).find((m) => m.id === milestoneId)
  if (!ms || level < ms.level) return state
  if (!ms.choices.some((c) => c.id === choiceId)) return state
  const next = structuredClone(state)
  next.shipyard.corePicks = {
    ...next.shipyard.corePicks,
    [moduleId]: {
      ...(next.shipyard.corePicks[moduleId] ?? {}),
      [milestoneId]: choiceId,
    },
  }
  if (!next.combat.inFight) {
    syncPersistedHullCaps(next)
    return next
  }
  const rebuilt = buildPlayerFleet(next)
  const prevUnits = next.combat.playerUnits
  for (const unit of rebuilt) {
    const prev = prevUnits.find((u) => u.id === unit.id)
    if (prev && prev.hullMax > 0) {
      unit.hull = Math.max(1, unit.hullMax * (prev.hull / prev.hullMax))
      unit.shield =
        unit.shieldMax > 0
          ? unit.shieldMax * (prev.shield / Math.max(1, prev.shieldMax))
          : 0
    }
  }
  next.combat.playerUnits = rebuilt
  const stats = computeShipStats(next)
  next.combat.playerHullMax = stats.hullMax
  next.combat.playerShieldMax = stats.shieldMax
  const flag = rebuilt.find((u) => u.isFlagship)
  if (flag) {
    next.combat.playerHull = flag.hull
    next.combat.playerShield = flag.shield
  }
  return next
}

export function performRebuild(
  state: GameState,
  hangar: { frameId: string; modules: string[] },
  now = Date.now(),
): GameState {
  if (!canPrestige(state)) return state
  const frame = getFrame(hangar.frameId)
  if (!frame) return state
  if (!state.shipyard.unlockedFrames.includes(hangar.frameId)) return state
  if (frame.requiresSectorEver && careerHighestSector(state) < frame.requiresSectorEver) {
    return state
  }
  const next = structuredClone(state)
  next.shipyard.frameId = hangar.frameId
  next.shipyard.modules = trimModulesToFrame(
    hangar.modules.filter((id) => next.shipyard.unlockedModules.includes(id)),
    frame,
  )
  const gain = prestigeGainFor(next)
  next.resources.prestigeMatter += gain
  next.prestige.prestigeCount += 1
  next.prestige.activeChallengeId = null
  applyRunReset(next, now)
  tryCompleteAchievements(next)
  next.combat.log = [
    `Rebuilt for +${gain} Rebuild Matter. Hull ${getFrame(next.shipyard.frameId)?.name ?? hangar.frameId}.`,
    ...next.combat.log,
  ]
  return next
}

/** Soft-reset keeping the current hull + fitted Cores (hangar uses performRebuild). */
export function performPrestige(state: GameState, now = Date.now()): GameState {
  return performRebuild(
    state,
    { frameId: state.shipyard.frameId, modules: state.shipyard.modules },
    now,
  )
}

export function performAscension(state: GameState, now = Date.now()): GameState {
  if (!canAscend(state)) return state
  const next = structuredClone(state)
  const gain = Math.max(1, Math.floor(prestigeGainFor(next) * 0.5))
  next.resources.prestigeMatter += gain
  next.meta.ascensionCount = (next.meta.ascensionCount ?? 0) + 1
  next.prestige.activeChallengeId = null
  applyRunReset(next, now)
  tryCompleteAchievements(next)
  next.combat.log = [
    `Ascended (×${next.meta.ascensionCount}). +${gain} PM. Future prestige gains +${(
      0.4 *
      next.meta.ascensionCount *
      100
    ).toFixed(0)}%.`,
    ...next.combat.log,
  ]
  return next
}

export function enterChallenge(
  state: GameState,
  challengeId: string,
  now = Date.now(),
): GameState {
  if (!canEnterChallenge(state, challengeId)) return state
  const challenge = getChallenge(challengeId)
  if (!challenge) return state

  const next = structuredClone(state)
  const ascendEntry = challenge.entryCost === 'ascension'
  let gain: number
  if (ascendEntry) {
    // ITRTG-style: starting the challenge IS the ascension.
    gain = Math.max(1, Math.floor(prestigeGainFor(next) * 0.5))
    next.resources.prestigeMatter += gain
    next.meta.ascensionCount = (next.meta.ascensionCount ?? 0) + 1
  } else {
    gain = prestigeGainFor(next)
    next.resources.prestigeMatter += gain
    next.prestige.prestigeCount += 1
  }
  next.prestige.activeChallengeId = challengeId
  applyRunReset(next, now)
  if (challengeId === 'null-signal') {
    unequipAllSignalCores(next)
  }
  tryCompleteAchievements(next)
  const entryLabel = ascendEntry
    ? `Ascension ×${next.meta.ascensionCount}`
    : 'Prestige'
  next.combat.log = [
    `Entered challenge: ${challenge.name} via ${entryLabel} (+${gain} Rebuild Matter). Goal: sector ${challenge.goalSector}.`,
    ...next.combat.log,
  ]
  return next
}

export function abandonChallenge(state: GameState, now = Date.now()): GameState {
  const activeId = state.prestige.activeChallengeId
  if (!activeId) return state
  const next = structuredClone(state)
  const name = getChallenge(activeId)?.name ?? 'Challenge'
  next.prestige.activeChallengeId = null
  applyRunReset(next, now)
  next.combat.log = [`Abandoned ${name}.`, ...next.combat.log]
  return next
}

export function tryCompleteChallenge(state: GameState): void {
  const id = state.prestige.activeChallengeId
  if (!id) return
  const challenge = getChallenge(id)
  if (!challenge) return
  const cleared = state.combat.highestSector
  if (cleared < challenge.goalSector) return

  const maxClears = effectiveMaxClears(challenge, state.prestige.shop)
  const prev = challengeClearCount(state.prestige.challengeClears, id)
  if (prev >= maxClears) {
    state.prestige.activeChallengeId = null
    state.combat.log = [
      `Challenge ${challenge.name} already at max clears (${maxClears}).`,
      ...state.combat.log,
    ]
    return
  }

  const nextClears = prev + 1
  state.prestige.challengeClears = {
    ...state.prestige.challengeClears,
    [id]: nextClears,
  }
  state.prestige.activeChallengeId = null
  state.resources.challengePoints += challenge.rewardChallengePoints
  if (id === 'null-signal' && prev === 0) {
    state.meta.signalCoresCarryOver = true
    state.combat.log = [
      'Signal bank stabilized — Signal Cores now persist across prestige.',
      ...state.combat.log,
    ]
  }
  tryCompleteAchievements(state)
  state.combat.log = [
    `Challenge complete: ${challenge.name} (${nextClears}/${maxClears}). +${challenge.rewardChallengePoints} Challenge Marks.`,
    ...state.combat.log,
  ]
}

export function enterProtocol(state: GameState, protocolId: string): GameState {
  if (!canEnterProtocol(state, protocolId).ok) return state
  const def = getProtocol(protocolId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.protocols) next.protocols = createEmptyProtocolState()
  next.protocols.activeId = protocolId
  wipeProtocolLoadout(next)
  next.network = createEmptyNetworkState()
  next.combat.sector = 1
  next.combat.wave = 1
  next.combat.highestSector = 0
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.playerUnits = []
  next.combat.enemyUnits = []
  const stats = computeShipStats(next)
  next.combat.playerHullMax = stats.hullMax
  next.combat.playerHull = stats.hullMax
  next.combat.playerShieldMax = stats.shieldMax
  next.combat.playerShield = stats.shieldMax
  next.combat.log = [
    `Protocol ${def.name}. Goal: clear sector ${def.goalSector}. Cores and Salvage wiped.`,
    ...next.combat.log,
  ]
  return next
}

export function abandonProtocol(state: GameState): GameState {
  const def = getProtocol(state.protocols?.activeId ?? '')
  if (!state.protocols?.activeId) return state
  const next = structuredClone(state)
  next.protocols.activeId = null
  wipeProtocolLoadout(next)
  next.network = createEmptyNetworkState()
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.log = [`Abandoned ${def?.name ?? 'Protocol'}.`, ...next.combat.log]
  return next
}

export function enterEcho(state: GameState, echoId: string): GameState {
  if (!canEnterEcho(state, echoId).ok) return state
  const def = getEchoRun(echoId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.echo) next.echo = createEmptyEchoState()
  next.echo.activeId = echoId
  next.echo.resumeSector = next.combat.sector
  next.echo.resumeWave = next.combat.wave
  next.echo.resumeRoute = next.combat.route
  next.combat.wave = 1
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.log = [`Echo queued: ${def.name}. Launch to enter the gauntlet.`, ...next.combat.log]
  return next
}

export function abandonEcho(state: GameState): GameState {
  if (!state.echo?.activeId) return state
  const next = structuredClone(state)
  failEcho(next, 'Abandoned.')
  return next
}

export function buyEchoNode(state: GameState, nodeId: string): GameState {
  if (!canBuyEchoNode(state, nodeId).ok) return state
  const def = getEchoNode(nodeId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.echo) next.echo = createEmptyEchoState()
  next.echo.points -= def.cost
  next.echo.tree = [...next.echo.tree, nodeId]
  return next
}

export { rankSpecialist, rankCapital }

export function performReinforce(state: GameState, now = Date.now()): GameState {
  if (!canReinforce(state).ok) return state
  const next = structuredClone(state)
  const gain = Math.max(1, Math.floor(prestigeGainFor(next) * 0.5))
  next.resources.prestigeMatter += gain
  next.meta.ascensionCount = (next.meta.ascensionCount ?? 0) + 1
  next.prestige.activeChallengeId = null
  applyRunReset(next, now)
  tryCompleteAchievements(next)
  next.combat.log = [
    `Reinforced (×${next.meta.ascensionCount}). +${gain} PM. Future Rebuild kits grow. Need sector ${REINFORCE_UNLOCK_SECTOR} career.`,
    ...next.combat.log,
  ]
  return next
}

export function buyProcessNode(state: GameState, nodeId: string): GameState {
  if (!canBuyProcessNode(state, nodeId).ok) return state
  const def = getProcessNode(nodeId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.process) next.process = createEmptyProcessState()
  next.resources.aiPoints -= def.cost
  next.process.purchased = [...next.process.purchased, nodeId]
  tryCompleteAchievements(next)
  return next
}

/** @deprecated buildings replaced by worker stations */
export function upgradeBuilding(state: GameState, _buildingId: string): GameState {
  return state
}

export function isBuildingUnlocked(_state: GameState, _buildingId: string): boolean {
  return false
}
