import type { GameState, LaborProfile, NetworkLinkId, PartType, ProcessNetworkPreset, Resources } from './types'
import {
  AI_NODES,
  MASTERY_PARTS_COST,
  MAX_MODULE_LEVEL,
  moduleMasteryCap,
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
  blueprintProgress,
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
  isCorePrintUnlocked,
  isModuleBlockedByChallenge,
  masteryBonus,
  moduleLevel,
  moduleLeveledBonus,
  moduleMasteryRank,
  moduleWeaponDamage,
  modulePrintWave,
  parsePartId,
  partId,
  partSellScrap,
  prestigeMinSectorFor,
  shopRank,
  stationBlackBarNeed,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  trimModulesToFrame,
  STARTER_CORE_IDS,
  type ResourceCost,
} from './catalog'
import { milestonesFor } from './milestones'
import {
  canBuyNetworkLink,
  createEmptyNetworkState,
  isNetworkBarId,
  networkLinkRank,
  wipeNetworkBars,
} from './network'
import {
  buyFoundryUpgrade,
  canBuyFoundryUpgrade,
  equipFoundryModule,
  FOUNDRY_UPGRADES,
  foundryMaterialCount,
  foundryRecipeLevel,
  foundryUpgradeCost,
  persistFoundryOnRebuild,
  setFoundrySlot,
  unequipFoundryModule,
  isFoundryInfinite,
} from './foundry'
import { insertShard, removeShard, equipRelicOnCore, removeRelicFromCore, upgradeRelic } from './reliquary'
import {
  applyFurnacePreset,
  buyFurnaceUpgrade,
  convertAshToHeat as convertAshToHeatRaw,
  createEmptyFurnaceState,
  endFurnaceSortie,
  furnaceRestartHeat,
  setFurnaceChannel,
  setFurnacePriority,
} from './furnace'
import { hiveResearchExtraUtilitySlots, hiveResearchHeatFromAshMult, setResearchFocus, createEmptyHiveResearchState } from './hiveResearch'
import { foundryAshHeatMult } from './foundryBonuses'
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
  noteProtocolProgress,
  protocolGoalWave,
  protocolModifiers,
  wipeProtocolLoadout,
} from './protocols'
import {
  createEmptyEchoState,
} from './echo'
import {
  canBuyProcessNode,
  createEmptyProcessState,
  getProcessNode,
  hasProcess,
  mergeProcessConfig,
  processConfig,
  yardLayoutCap,
  NETWORK_BAR_IDS,
} from './process'
import { createEmptySpecialistState, rankSpecialist } from './specialists'
import { createEmptyCapitalState, rankCapital } from './capital'
import { canReinforce } from './reinforce'
import { noteSalvageSpend } from './sortieSummary'
import { availableSortieSpeeds, chosenSortieSpeed } from './uiReadout'
import {
  noteAssembledCore,
  noteAttempt,
  noteSystemAction,
  recordPlaytest,
  stampFirst,
} from './playtest'
import { noteFrontierIntervention } from './frontier'
import type { SectorRoute } from './types'
import {
  buildFlagshipWeapons,
  computeShipStats,
  createInitialState,
  syncPersistedHullCaps,
} from './state'
import { buildPlayerFleet } from './combat'
import {
  createEmptyWorkshop,
  effectiveUpgradeLevel,
  maxAffordableRunPurchases,
  maxAffordableWorkshopPurchases,
  nextRunUpgradeCost,
  RUN_UPGRADE_CAP,
  RUN_UPGRADES,
  runPurchasedLevel,
  workshopCost,
  type RunUpgradeId,
} from './workshop'
import { ACT1_CADENCE } from './cadence'
import {
  buyCoreRunLevel,
  buyCoreRunLevelByModule,
  coreRunLevel,
  coreRunUpgradeCost,
  grantModuleCopy,
  moduleCopyCount,
  pickAutoCoreRunSlot,
} from './coreProgression'
import {
  ACT1_FINAL_SECTOR,
  ACT1_FINAL_WAVE,
  careerBestWave,
  careerHighestSector,
  isSystemUnlocked,
  retirePostResetOnboarding,
  tryCompleteAchievements,
} from './progression'
import {
  emptyRebuildCycle,
  prestigeGainFor as rebuildMatterGain,
  rebuildDoorMet,
} from './rebuild'
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

export { insertShard, removeShard, equipRelicOnCore, removeRelicFromCore, upgradeRelic, setResearchFocus }
export { buyFurnaceUpgrade, setFurnaceChannel, setFurnacePriority, applyFurnacePreset }

export {
  placeYardBuilding,
  clearYardBuilding,
  buyYardArm,
}

export function convertAshToHeat(state: GameState): GameState {
  return convertAshToHeatRaw(state, hiveResearchHeatFromAshMult(state) * foundryAshHeatMult(state))
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

export function setDamageNumbers(
  state: GameState,
  mode: 'minimal' | 'standard' | 'detailed',
): GameState {
  if (mode !== 'minimal' && mode !== 'standard' && mode !== 'detailed') return state
  if (state.meta.damageNumbers === mode) return state
  const next = structuredClone(state)
  next.meta.damageNumbers = mode
  return next
}

export function setLaunchSector(state: GameState, _sector: number): GameState {
  if (!state.combat.docked) return state
  if (state.combat.wave === 1 && state.combat.sector === 1) return state
  const next = structuredClone(state)
  next.combat.sector = 1
  next.combat.wave = 1
  return next
}

export function setSectorRoute(state: GameState, _route: SectorRoute): GameState {
  if (state.combat.route === 'A') return state
  const next = structuredClone(state)
  next.combat.route = 'A'
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
    if (delta > 0) return state
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
    if (networkBar) {
      noteSystemAction(next, 'network')
      noteFrontierIntervention(next, 'drone', { n: stationId, v: delta })
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
  if (networkBar) noteFrontierIntervention(next, 'drone', { n: stationId, v: -remove })
  return next
}

export function buyNetworkLink(state: GameState, id: NetworkLinkId): GameState {
  const check = canBuyNetworkLink(state, id)
  if (!check.ok) return state
  const next = structuredClone(state)
  if (!next.network) next.network = createEmptyNetworkState()
  if (!next.network.links) next.network.links = { racks: 0, acuity: 0, cycle: 0 }
  if (check.cost.resource === 'heat') {
    next.resources.heat = (next.resources.heat ?? 0) - check.cost.amount
  } else {
    next.resources.scrap -= check.cost.amount
  }
  next.network.links[id] = networkLinkRank(next, id) + 1
  noteSystemAction(next, 'network')
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
  if (state.combat.docked) return state
  const slot = pickAutoCoreRunSlot(state)
  if (slot == null) return state
  return buyCoreRunSlot(state, slot, 1)
}

function moduleUpgradeGain(state: GameState, moduleId: string, level: number): number {
  const def = getModule(moduleId)
  if (!def) return 0
  const mastery = masteryBonus(moduleMasteryRank(state, moduleId))
  let gain = 0
  if (def.weapon) {
    gain +=
      (moduleWeaponDamage(def, level + 1, mastery) - moduleWeaponDamage(def, level, mastery)) * 1.2
  }
  if (def.hullBonus || def.hullBonusPerLevel) {
    gain +=
      moduleLeveledBonus(def.hullBonus ?? 0, def.hullBonusPerLevel, level + 1, mastery) -
      moduleLeveledBonus(def.hullBonus ?? 0, def.hullBonusPerLevel, level, mastery)
  }
  if (def.shieldBonus || def.shieldBonusPerLevel) {
    gain +=
      (moduleLeveledBonus(def.shieldBonus ?? 0, def.shieldBonusPerLevel, level + 1, mastery) -
        moduleLeveledBonus(def.shieldBonus ?? 0, def.shieldBonusPerLevel, level, mastery)) *
      0.9
  }
  if (gain <= 0) {
    if (def.role === 'weapon') return 3
    if (def.role === 'defense') return 2.4
    return 1.4
  }
  return gain
}

/** Spend Salvage on the fitted Core with the best stat-gain per Salvage. Sortie only. */
export function upgradeBestValueModule(state: GameState, opts?: { force?: boolean }): GameState {
  if (
    !opts?.force &&
    !(state.process?.purchased ?? []).includes('smart-core')
  ) {
    return state
  }
  if (state.prestige.activeChallengeId === 'no-ai') return state
  if (state.combat.docked) return state

  let bestSlot: number | null = null
  let bestScore = 0
  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const id = state.shipyard.modules[slot]!
    const level = coreRunLevel(state, slot)
    if (level >= MAX_MODULE_LEVEL) continue
    const cost = coreRunUpgradeCost(level, id)
    if (cost <= 0 || cost > (state.resources.salvage ?? 0)) continue
    const score = moduleUpgradeGain(state, id, level) / cost
    if (score > bestScore) {
      bestSlot = slot
      bestScore = score
    }
  }
  if (bestSlot == null) return upgradeCheapestModule(state, { force: true })
  return buyCoreRunSlot(state, bestSlot, 1)
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
  if ((def.requiresBestWave ?? 0) > careerBestWave(state)) return state
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
  if ((def.requiresBestWave ?? 0) > careerBestWave(state)) return state
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
    trimModulesToFrame(next.shipyard.modules, frame, { utility: hiveResearchExtraUtilitySlots(next) }),
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
  if ((def.requiresBestWave ?? 0) > careerBestWave(state)) return state
  if (!canAfford(state.resources, def.unlockCost)) return state

  const next = structuredClone(state)
  pay(next.resources, def.unlockCost)
  next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
  return next
}

export function canAssembleBlueprint(
  state: GameState,
  moduleId: string,
): { ok: boolean; reason?: string } {
  if (!isFarmableModule(moduleId)) return { ok: false, reason: 'Not a Core print' }
  if (!isSystemUnlocked(state, 'foundry')) return { ok: false, reason: 'Foundry closed' }
  if (state.shipyard.unlockedModules.includes(moduleId) && moduleCopyCount(state, moduleId) >= 8) {
    return { ok: false, reason: 'Copy limit' }
  }
  if (!isCorePrintUnlocked(state, moduleId)) {
    return { ok: false, reason: `Reach Wave ${modulePrintWave(moduleId)}` }
  }
  const recipe = getBlueprint(moduleId)
  if (!recipe) return { ok: false, reason: 'Unknown print' }
  const progress = blueprintProgress(state, moduleId)
  if (!progress?.complete) return { ok: false, reason: 'Need more fragments' }
  if (recipe.requiresRecipeLevel) {
    const have = foundryRecipeLevel(state, recipe.requiresRecipeLevel.recipeId)
    if (have < recipe.requiresRecipeLevel.level) {
      return { ok: false, reason: 'Need more Foundry mastery' }
    }
  }
  for (const [id, n] of Object.entries(recipe.foundry ?? {})) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) {
      return { ok: false, reason: 'Need Foundry stock' }
    }
  }
  return { ok: true }
}

/** Consume farmed fragments and unlock the Core permanently. Farming is the time sink. */
export function assembleBlueprint(state: GameState, moduleId: string): GameState {
  const check = canAssembleBlueprint(state, moduleId)
  if (!check.ok) return state
  const recipe = getBlueprint(moduleId)
  if (!recipe) return state
  const next = structuredClone(state)
  for (const pt of PART_TYPES) {
    const need = recipe[pt]
    const id = partId(moduleId, pt)
    const have = next.parts[id] ?? 0
    if (have < need) return state
    next.parts[id] = have - need
    if (next.parts[id] <= 0) delete next.parts[id]
  }
  for (const [id, n] of Object.entries(recipe.foundry ?? {})) {
    if (!n || isFoundryInfinite(next, id)) continue
    next.foundry.materials[id] = Math.max(0, (next.foundry.materials[id] ?? 0) - n)
  }
  if (!next.shipyard.unlockedModules.includes(moduleId)) {
    next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
    grantModuleCopy(next, moduleId)
  } else {
    grantModuleCopy(next, moduleId)
  }
  if (!next.meta.discoveredModules.includes(moduleId)) {
    next.meta.discoveredModules = [...next.meta.discoveredModules, moduleId]
  }
  next.meta.lifetimeFabCrafts = (next.meta.lifetimeFabCrafts ?? 0) + 1
  const name = getModule(moduleId)?.name ?? moduleId
  if (next.foundry.trackedPrintId === moduleId) {
    next.foundry.trackedPrintId = null
    next.combat.log = [
      `${name} assembled — choose another tracked print.`,
      `Core printed: ${name}. Fit it on the next Rebuild.`,
      ...next.combat.log,
    ].slice(0, 40)
  } else {
    next.combat.log = [`Core printed: ${name}. Fit it on the next Rebuild.`, ...next.combat.log].slice(
      0,
      40,
    )
  }
  if (!(STARTER_CORE_IDS as readonly string[]).includes(moduleId)) {
    noteAssembledCore(next, name)
  }
  noteSystemAction(next, 'foundry')
  tryCompleteAchievements(next)
  return next
}

export function setTrackedPrint(state: GameState, moduleId: string | null): GameState {
  if (moduleId) {
    if (!isFarmableModule(moduleId) || !isCorePrintUnlocked(state, moduleId)) return state
  }
  const nextId = moduleId && state.foundry.trackedPrintId === moduleId ? null : moduleId
  if ((state.foundry.trackedPrintId ?? null) === (nextId ?? null)) return state
  const next = {
    ...state,
    foundry: { ...state.foundry, trackedPrintId: nextId },
  }
  recordPlaytest(next, 'print_changed', {
    n: nextId ? (getModule(nextId)?.name ?? nextId) : 'cleared',
  })
  noteSystemAction(next, 'foundry')
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
  recordPlaytest(next, 'print_changed', { n: getModule(moduleId)?.name ?? moduleId })
  noteSystemAction(next, 'foundry')
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
  if (rank >= moduleMasteryCap(state)) return state
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
  if (isModuleBlockedByChallenge(state.prestige.activeChallengeId, moduleId)) {
    return state
  }
  const frame = getFrame(state.shipyard.frameId)
  if (!frame) return state
  const copies = moduleCopyCount(state, moduleId)
  if (
    !canFitModuleOnFrame(
      frame,
      state.shipyard.modules,
      moduleId,
      { utility: hiveResearchExtraUtilitySlots(state) },
      copies,
    )
  ) {
    return state
  }

  const next = structuredClone(state)
  next.shipyard.modules = [...next.shipyard.modules, moduleId]
  recordPlaytest(next, 'core_fitted', {
    n: getModule(moduleId)?.name ?? moduleId,
    firstKey: `core_fitted:${moduleId}`,
  })
  noteSystemAction(next, 'cores')
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unfitModule(state: GameState, moduleId: string): GameState {
  const idx = state.shipyard.modules.lastIndexOf(moduleId)
  if (idx < 0) return state
  const next = structuredClone(state)
  next.shipyard.modules = next.shipyard.modules.filter((_, i) => i !== idx)
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function prestigeGainFor(state: GameState): number {
  return Math.max(
    1,
    Math.floor(rebuildMatterGain(state) * protocolModifiers(state).rebuildMatterMult),
  )
}

export function canPrestige(state: GameState): boolean {
  return Boolean(state.combat.docked) && rebuildDoorMet(state, prestigeMinSectorFor(state.prestige.shop))
}

/** Ascension unlocks after Act 1; soft-resets the run and boosts future PM gains. */
export function canAscend(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  if (!state.meta.act1Cleared) return false
  return careerBestWave(state) >= ACT1_FINAL_WAVE || careerHighestSector(state) >= ACT1_FINAL_SECTOR
}

export function canEnterChallenge(state: GameState, challengeId: string): boolean {
  if (state.prestige.activeChallengeId) return false
  if (!state.meta.act1Cleared && careerBestWave(state) < ACT1_CADENCE.protocols) {
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
  return careerBestWave(state) >= prestigeMinSectorFor(state.prestige.shop)
}

/** Persist fitted loadout; drop modules that conflict with an active challenge. */
function persistLoadout(
  unlockedFrames: string[],
  unlockedModules: string[],
  frameId: string,
  modules: string[],
  activeChallengeId: string | null,
  extra: Partial<Record<'weapon' | 'defense' | 'utility', number>> = {},
  copies: Record<string, number> = {},
  corePicks: Record<string, Record<string, string>> = {},
): GameState['shipyard'] {
  const frame = unlockedFrames.includes(frameId) ? frameId : 'scout-frame'
  const frameDef = getFrame(frame) ?? getFrame('scout-frame')!
  let fitted = filterModulesForChallenge(
    trimModulesToFrame(
      modules.filter((id) => unlockedModules.includes(id)),
      frameDef,
      extra,
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
    moduleCopies: {
      ...Object.fromEntries(unlockedModules.map((id) => [id, 1])),
      ...copies,
    },
    corePicks: { ...corePicks },
    frameLocked: false,
  }
}

/** Sortie-only: spend Salvage to raise a Core's temporary Run Level. Dock no-op. */
export function upgradeModule(state: GameState, moduleId: string): GameState {
  return buyCoreRunUpgrade(state, moduleId, 1)
}

export function buyCoreRunUpgrade(state: GameState, moduleId: string, count = 1): GameState {
  if (state.combat.docked) return state
  const after = buyCoreRunLevelByModule(state, moduleId, count)
  if (after === state) return state
  syncFleetAfterRunUpgrade(after)
  return after
}

export function buyCoreRunSlot(state: GameState, slot: number, count = 1): GameState {
  if (state.combat.docked) return state
  const after = buyCoreRunLevel(state, slot, count)
  if (after === state) return state
  syncFleetAfterRunUpgrade(after)
  return after
}

function applyRunUpgradePurchase(next: GameState, id: RunUpgradeId): boolean {
  const def = RUN_UPGRADES.find((row) => row.id === id)
  if (!def) return false
  const best = Math.max(next.meta.bestWave ?? 0, next.combat.bestWave ?? 0, next.combat.wave ?? 1)
  if (best < def.minBestWave) return false
  if (effectiveUpgradeLevel(next, id) >= RUN_UPGRADE_CAP) return false
  const cost = nextRunUpgradeCost(next, id)
  if (next.resources.salvage < cost) return false
  next.resources.salvage -= cost
  noteSalvageSpend(next, cost, def.category)
  next.combat.runUpgrades = {
    ...(next.combat.runUpgrades ?? {}),
    [id]: runPurchasedLevel(next, id) + 1,
  }
  return true
}

function syncFleetAfterRunUpgrade(next: GameState): void {
  if (next.combat.inFight) {
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
  } else {
    syncPersistedHullCaps(next)
  }
}

export function buyRunUpgrade(state: GameState, id: RunUpgradeId, count = 1): GameState {
  if (state.combat.docked) return state
  const want = count === Number.POSITIVE_INFINITY ? maxAffordableRunPurchases(state, id) : Math.max(1, Math.floor(count))
  if (want <= 0) return state
  const next = structuredClone(state)
  let bought = 0
  for (let i = 0; i < want; i += 1) {
    if (!applyRunUpgradePurchase(next, id)) break
    bought += 1
  }
  if (bought <= 0) return state
  syncFleetAfterRunUpgrade(next)
  return next
}

export function buyWorkshopUpgrade(state: GameState, id: RunUpgradeId, count = 1): GameState {
  if (!state.combat.docked) return state
  const def = RUN_UPGRADES.find((row) => row.id === id)
  if (!def) return state
  if (!state.meta.hullLostOnce) return state
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0)
  if (best < def.minBestWave) return state
  const want = count === Number.POSITIVE_INFINITY ? maxAffordableWorkshopPurchases(state, id) : Math.max(1, Math.floor(count))
  if (want <= 0) return state
  const next = structuredClone(state)
  if (!next.workshop) next.workshop = createEmptyWorkshop()
  let bought = 0
  for (let i = 0; i < want; i += 1) {
    const current = Math.max(0, Math.floor(next.workshop.levels?.[id] ?? 0))
    if (current >= RUN_UPGRADE_CAP) break
    const cost = workshopCost(current)
    if (next.resources.scrap < cost) break
    next.resources.scrap -= cost
    next.workshop.levels = { ...next.workshop.levels, [id]: current + 1 }
    bought += 1
  }
  if (bought <= 0) return state
  syncPersistedHullCaps(next)
  return next
}

export function cycleSortieSpeed(state: GameState): GameState {
  const avail = availableSortieSpeeds(state)
  if (avail.length <= 1) return state
  const cur = chosenSortieSpeed(state)
  const idx = Math.max(0, avail.indexOf(cur))
  const next = structuredClone(state)
  next.meta.sortieSpeed = avail[(idx + 1) % avail.length]
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
      moduleMasteryXp: { ...(state.meta.moduleMasteryXp ?? {}) },
      coreProgressionMigrated: true,
      lifetimeCoreRunBuys: state.meta.lifetimeCoreRunBuys ?? 0,
      signalCoresCarryOver: state.meta.signalCoresCarryOver ?? false,
      seenOnboarding: [...(state.meta.seenOnboarding ?? [])],
    },
    parts: { ...(state.parts ?? {}) },
    heat: state.resources.heat ?? 0,
    reliquary: structuredClone(state.reliquary ?? { owned: {}, slots: {}, coreFits: {} }),
    furnace: structuredClone(state.furnace ?? createEmptyFurnaceState()),
    hiveResearch: structuredClone(state.hiveResearch ?? createEmptyHiveResearchState()),
    yard: structuredClone(state.yard ?? createEmptyYardState()),
    protocols: {
      activeId: null,
      ranks: { ...(state.protocols?.ranks ?? {}) },
      bestSector: { ...(state.protocols?.bestSector ?? {}) },
      bestWave: { ...(state.protocols?.bestWave ?? {}) },
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
    process: structuredClone(state.process ?? createEmptyProcessState()),
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
   * Later Rebuilds start with a small kit so re-pushes aren't empty. First
   * Rebuild wipes Scrap and Salvage (GDD §68) — Matter is the payout, not a
   * leftover bank. Data kit is smaller now that research persists.
   */
  const returning = kept.prestigeCount > 1 || (kept.meta.ascensionCount ?? 0) > 0
  const pc = kept.prestigeCount
  const ac = kept.meta.ascensionCount ?? 0
  const returnScrap = returning ? 16 + Math.min(56, pc * 8 + ac * 10) : 0
  const returnData = returning ? Math.min(14, 3 + pc + ac * 2) : 0
  const returnSalvage = returning ? 14 + Math.min(40, pc * 5 + ac * 6) : 0

  state.version = fresh.version
  state.lastTickAt = now
  state.resources = {
    ...fresh.resources,
    prestigeMatter: kept.prestigeMatter,
    challengePoints: kept.challengePoints,
    essence: kept.essence,
    scrap: bonusScrap + returnScrap + (returning ? fresh.resources.scrap : 0),
    data: fresh.resources.data + returnData,
    aiPoints: kept.aiPoints + bonusAi,
    salvage: bonusSalvage + returnSalvage,
    choirAsh: 0,
    heat: furnaceRestartHeat({ ...state, furnace: kept.furnace } as GameState, kept.heat),
  }
  state.shipyard = persistLoadout(
    kept.unlockedFrames,
    kept.unlockedModules,
    kept.frameId,
    kept.modules,
    kept.activeChallengeId,
    { utility: hiveResearchExtraUtilitySlots(state) },
    state.shipyard.moduleCopies ?? {},
    state.shipyard.corePicks ?? {},
  )
  state.workshop = createEmptyWorkshop()
  state.combat = {
    ...fresh.combat,
    bestWave: Math.max(kept.meta.bestWave ?? 0, 0),
    campaign: true,
    pushMode: 'advance',
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
    cycle: emptyRebuildCycle(),
  }
  state.codex = { seenFamilies: kept.seenFamilies }
  state.meta = kept.meta
  state.core = fresh.core
  state.network = wipeNetworkBars(state.network)
  state.foundry = persistFoundryOnRebuild(state.foundry)
  state.reliquary = kept.reliquary
  state.furnace = kept.furnace
  endFurnaceSortie(state)
  state.hiveResearch = kept.hiveResearch
  state.yard = armYardOnRebuild(kept.yard)
  state.protocols = kept.protocols
  state.echo = kept.echo
  state.process = kept.process
  if (bonusAi > 0) {
    if (!state.process) state.process = createEmptyProcessState()
    state.process.earned = (state.process.earned ?? 0) + bonusAi
  }
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
  if (frame.requiresBestWave && careerBestWave(state) < frame.requiresBestWave) {
    return state
  }
  const next = structuredClone(state)
  next.shipyard.frameId = hangar.frameId
  next.shipyard.modules = trimModulesToFrame(
    hangar.modules.filter((id) => next.shipyard.unlockedModules.includes(id)),
    frame,
    { utility: hiveResearchExtraUtilitySlots(next) },
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
  recordPlaytest(next, 'rebuild', { v: next.prestige.prestigeCount })
  stampFirst(next, 'rebuild')
  next.playtest.pendingInterventions = []
  next.playtest.consecutiveFrontierOneShots = 0
  next.playtest.steamrollFrom = 0
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

export function enterProtocol(state: GameState, protocolId: string, opts?: { automated?: boolean }): GameState {
  if (!canEnterProtocol(state, protocolId, opts).ok) return state
  const def = getProtocol(protocolId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.protocols) next.protocols = createEmptyProtocolState()
  next.protocols.activeId = protocolId
  if (!next.process) next.process = createEmptyProcessState()
  next.process.config.sortie.lastProtocolId = protocolId
  wipeProtocolLoadout(next)
  next.network = wipeNetworkBars(next.network)
  next.combat.sector = 1
  next.combat.wave = 1
  next.combat.highestSector = 0
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.frontierHold = false
  next.combat.frontierSector = 0
  next.combat.frontierAttemptOpen = false
  next.combat.frontierNotice = null
  next.combat.playerUnits = []
  next.combat.enemyUnits = []
  const stats = computeShipStats(next)
  next.combat.playerHullMax = stats.hullMax
  next.combat.playerHull = stats.hullMax
  next.combat.playerShieldMax = stats.shieldMax
  next.combat.playerShield = stats.shieldMax
  const goal = protocolGoalWave(next, protocolId)
  next.combat.log = [
    `Challenge ${def.name}. Goal: reach Wave ${goal}. Cores and Salvage wiped. ${def.restriction}`,
    ...next.combat.log,
  ]
  noteAttempt(next, 'protocol', protocolId, 'start', def.name)
  return next
}

export function abandonProtocol(state: GameState): GameState {
  const def = getProtocol(state.protocols?.activeId ?? '')
  if (!state.protocols?.activeId) return state
  const next = structuredClone(state)
  noteProtocolProgress(next)
  next.protocols.activeId = null
  if (!next.process) next.process = createEmptyProcessState()
  next.process.config.sortie.lastProtocolId = null
  wipeProtocolLoadout(next)
  next.network = wipeNetworkBars(next.network)
  next.combat.docked = true
  next.combat.inFight = false
  next.combat.log = [`Abandoned ${def?.name ?? 'Challenge'}.`, ...next.combat.log]
  noteAttempt(next, 'protocol', def?.id ?? 'protocol', 'end', def?.name)
  return next
}

export function enterEcho(state: GameState, _echoId: string): GameState {
  return state
}

export function abandonEcho(state: GameState): GameState {
  if (!state.echo?.activeId) return state
  const next = structuredClone(state)
  if (!next.echo) next.echo = createEmptyEchoState()
  next.echo.activeId = null
  return next
}

export function buyEchoNode(state: GameState, _nodeId: string): GameState {
  return state
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
    `Reinforced (×${next.meta.ascensionCount}). The Hive's starting architecture shifts. Future Rebuild kits grow.`,
    ...next.combat.log,
  ]
  recordPlaytest(next, 'reinforce', { v: next.meta.ascensionCount })
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
  recordPlaytest(next, 'process_buy', { n: def.name })
  noteSystemAction(next, 'process')
  tryCompleteAchievements(next)
  return next
}

export function setProcessConfig(state: GameState, config: GameState['process']['config']): GameState {
  const next = structuredClone(state)
  if (!next.process) next.process = createEmptyProcessState()
  next.process.config = mergeProcessConfig(config)
  return next
}

export function pickProcessCoreUpgrade(
  state: GameState,
  opts?: { force?: boolean },
): GameState {
  if (state.combat.docked) return state
  const cfg = processConfig(state)
  const priority = hasProcess(state, 'core-priority')
    ? cfg.core.priority
    : hasProcess(state, 'smart-core')
      ? 'value'
      : 'cheapest'
  if (priority === 'value') return upgradeBestValueModule(state, { force: true })
  if (priority === 'cheapest') return upgradeCheapestModule(state, { force: true })

  const levels = { weapon: 0, shield: 0, utility: 0 }
  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const role = getModule(state.shipyard.modules[slot]!)?.role
    const lv = coreRunLevel(state, slot)
    if (role === 'weapon') levels.weapon += lv
    else if (role === 'defense') levels.shield += lv
    else if (role === 'utility') levels.utility += lv
  }
  const ratios = cfg.core.ratios
  const want =
    priority === 'weapon'
      ? 'weapon'
      : priority === 'shield'
        ? 'defense'
        : priority === 'utility'
          ? 'utility'
          : null

  let bestSlot: number | null = null
  let bestScore = -Infinity
  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const id = state.shipyard.modules[slot]!
    const def = getModule(id)
    if (!def) continue
    const level = coreRunLevel(state, slot)
    if (level >= MAX_MODULE_LEVEL) continue
    const cost = coreRunUpgradeCost(level, id)
    if (cost <= 0 || cost > (state.resources.salvage ?? 0)) continue
    let score = -cost
    if (want) {
      score += def.role === want ? 1000 : 0
    } else if (priority === 'balanced' || priority === 'custom') {
      const current =
        def.role === 'weapon' ? levels.weapon : def.role === 'defense' ? levels.shield : levels.utility
      const target =
        def.role === 'weapon'
          ? Math.max(0.01, ratios.weapon)
          : def.role === 'defense'
            ? Math.max(0.01, ratios.shield)
            : Math.max(0.01, ratios.utility)
      const total = Math.max(1, levels.weapon + levels.shield + levels.utility)
      const share = current / total
      const wantShare = target / Math.max(0.01, ratios.weapon + ratios.shield + ratios.utility)
      score = wantShare - share
    }
    if (score > bestScore) {
      bestScore = score
      bestSlot = slot
    }
  }
  if (bestSlot == null) return opts?.force ? upgradeCheapestModule(state, { force: true }) : state
  return buyCoreRunSlot(state, bestSlot, 1)
}

export function buyMaxCores(state: GameState): GameState {
  if (!hasProcess(state, 'core-buy-max')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
  if (state.combat.docked) return state
  let next = state
  let guard = 0
  while (guard++ < 80) {
    const after = pickProcessCoreUpgrade(next, { force: true })
    if (after === next) break
    if ((after.resources.salvage ?? 0) >= (next.resources.salvage ?? 0)) break
    next = after
  }
  return next
}

export function optimiseNetwork(state: GameState): GameState {
  if (!hasProcess(state, 'network-optimise') && !hasProcess(state, 'network-balance')) return state
  const next = structuredClone(state)
  for (const id of NETWORK_BAR_IDS) {
    delete next.base.assignments[id]
  }
  return setLaborAssignments(next, assignByProfile(next, next.meta.laborProfile ?? 'balanced'))
}

export function applyNetworkPreset(state: GameState, preset: ProcessNetworkPreset): GameState {
  if (!hasProcess(state, 'network-presets')) return state
  const next = setProcessConfig(state, {
    ...processConfig(state),
    network: { ...processConfig(state).network, preset },
  })
  return optimiseNetwork(next)
}

export function pickFoundryUpgradeId(state: GameState): string | null {
  const cfg = processConfig(state)
  const priority = hasProcess(state, 'foundry-priority') ? cfg.foundry.upgradePriority : 'cheapest'
  let bestId: string | null = null
  let bestScore = -Infinity
  for (const up of FOUNDRY_UPGRADES) {
    if (!canBuyFoundryUpgrade(state, up.id).ok) continue
    const cost = foundryUpgradeCost(state, up.id)
    let score = -cost
    if (priority === 'speed') score = (up.speedBonus ?? 0) * 1000 - cost
    else if (priority === 'slots') score = (up.extraSlots ?? 0) * 1000 - cost
    else if (priority === 'output') {
      score = ((up.outputAdd ?? 0) * 4 + (up.xpBonus ?? 0) + (up.salvageBonus ?? 0)) * 1000 - cost
    }
    if (score > bestScore) {
      bestScore = score
      bestId = up.id
    }
  }
  return bestId
}

export function buyMaxFoundryUpgrades(state: GameState): GameState {
  if (!hasProcess(state, 'foundry-buy-max') && !hasProcess(state, 'foundry-auto')) return state
  let next = state
  let guard = 0
  while (guard++ < 12) {
    const id = pickFoundryUpgradeId(next)
    if (!id) break
    const after = buyFoundryUpgrade(next, id)
    if (after === next) break
    next = after
  }
  return next
}

export function buyMaxYardArms(state: GameState): GameState {
  if (!hasProcess(state, 'yard-buy-max') && !hasProcess(state, 'yard-auto')) return state
  const selected = processConfig(state).yard.selectedArms
  const arms = selected.length > 0 ? selected : (['damage', 'shield', 'salvage', 'network'] as const)
  let next = state
  let guard = 0
  while (guard++ < 20) {
    let bought = false
    for (const id of arms) {
      const after = buyYardArm(next, id)
      if (after !== next) {
        next = after
        bought = true
        break
      }
    }
    if (!bought) break
  }
  return next
}

export function saveYardLayout(state: GameState, name = 'Layout'): GameState {
  if (!hasProcess(state, 'yard-layouts')) return state
  const next = structuredClone(state)
  if (!next.process) next.process = createEmptyProcessState()
  const layouts = [...next.process.config.yard.layouts]
  const cap = yardLayoutCap(next)
  const snapshot = {
    name,
    cells: (next.yard?.cells ?? []).map((c) => ({ buildingId: c.buildingId })),
  }
  if (layouts.length >= cap) layouts[layouts.length - 1] = snapshot
  else layouts.push(snapshot)
  next.process.config.yard.layouts = layouts
  next.process.config.yard.activeLayout = layouts.length - 1
  return next
}

export function loadYardLayout(state: GameState, index: number): GameState {
  if (!hasProcess(state, 'yard-layouts')) return state
  const layout = processConfig(state).yard.layouts[index]
  if (!layout) return state
  const next = structuredClone(state)
  if (!next.yard) next.yard = createEmptyYardState()
  next.yard.cells = layout.cells.map((c) => ({ buildingId: c.buildingId }))
  next.process.config.yard.activeLayout = index
  return next
}

/** @deprecated buildings replaced by worker stations */
export function upgradeBuilding(state: GameState, _buildingId: string): GameState {
  return state
}

export function isBuildingUnlocked(_state: GameState, _buildingId: string): boolean {
  return false
}
