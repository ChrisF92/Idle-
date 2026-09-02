import type {
  GameState,
  LaborProfile,
  NetworkLinkId,
  ProcessNetworkPreset,
  Resources,
  RunUpgradeCategory,
  TargetingDoctrineId,
} from './types'
import {
  AI_NODES,
  RESEARCH,
  STATIONS,
  canBuyMatterShop,
  getAiNode,
  getEssenceUpgrade,
  getFrame,
  STARTER_FRAME_ID,
  getMatterShopItem,
  getModule,
  getStation,
  isAiNodePermanent,
  isStationUnlocked,
  canFitModuleOnFrame,
  idleWorkers,
  stationBlackBarNeed,
  stationEffectiveDrones,
  stationUpkeepScrapPerDrone,
  trimModulesToFrame,
  visibleWorkerJobIds,
  type ResourceCost,
} from './catalog'
import {
  canBuyNetworkLink,
  createEmptyNetworkState,
  isNetworkBarId,
  networkLinkRank,
  wipeNetworkBars,
} from './network'
import {
  canStartFabrication,
  persistFoundryOnRebuild,
  setFoundrySlot,
  setTrackedPrint,
  startFabrication,
} from './foundry'
import { equipRelicOnCore, removeRelicFromCore, canStartRelicUpgrade } from './relics'
import { relicUpgradeJobId } from './relicSeeds'
import {
  convertAshToHeat as convertAshToHeatRaw,
  createEmptyFurnaceState,
  endFurnaceSortie,
  igniteFurnace as igniteFurnaceRaw,
} from './furnace'
import { usableCoreSlots, trimModulesToUsableSlots } from './coreSlots'
import { setResearchFocus, startResearch, createEmptyHiveResearchState } from './hiveResearch'
import {
  canConfigureTargetingDoctrine,
  canEditTargetingNow,
} from './coreTargeting'
import { isTargetingCapableCoreModule, targetingProfileFor } from './targetingProfiles'
import { isWorkerJob, workerJobCap } from './workers'
import {
  canEnterChallenge,
  challengeGoalWave,
  getChallenge,
  isCoreBlockedByChallenge,
  noteChallengeProgress,
} from './challenges'
import {
  createEmptyEchoState,
} from './echo'
import {
  canBuyProcessNode,
  createEmptyProcessState,
  getProcessNode,
  processAvailable,
  reconstructProcessEarned,
  hasProcess,
  mergeProcessConfig,
  networkAllocationWeights,
  processConfig,
  NETWORK_BAR_IDS,
} from './process'
import { createEmptySpecialistState } from './specialists'
import { createEmptyCapitalState } from './capital'
import { noteSalvageSpend } from './sortieSummary'
import { availableSortieSpeeds, chosenSortieSpeed } from './uiReadout'
import {
  noteAttempt,
  noteSystemAction,
  recordPlaytest,
  stampFirst,
} from './playtest'
import type { CoreInstance } from './types'
import {
  computeShipStats,
  createInitialState,
  syncPersistedHullCaps,
} from './state'
import { syncPlayerFleetWeapons } from './combat'
import {
  canUnlockNextGeneric,
  createEmptyWorkshop,
  ensureGenericUnlocks,
  isUpgradePermanentlyKnown,
  maxAffordableRunPurchases,
  maxAffordableWorkshopPurchases,
  nextRunUpgradeCost,
  RUN_UPGRADES,
  runPurchasedLevel,
  sortieCap,
  tutorialSortieShopActive,
  TUTORIAL_SORTIE_UPGRADE_IDS,
  workshopCap,
  workshopCost,
  type RunUpgradeId,
} from './workshop'
import { sanitizeCodexState } from './codex'
import { buyCoreStartingLevel as buyCoreStartingLevelInternal } from './coreProgression'
import { careerBestWave, retirePostResetOnboarding, tryCompleteAchievements } from './progression'
import {
  applyReconstitutionCache,
  canRebuild,
  emptyRebuildCycle,
  matterGainFor,
  preserveGenericUnlocks,
  resetPhysicalCoreLevels,
  resetWorkshopCycleLevels,
} from './rebuild'
import {
  createEmptySignalCoresState,
} from './signalCores'
import { emptyWaveRuntime } from './waveRuntime'
import { clearDirectives } from './directives'
import {
  addCoreInstance,
  availableCoreInstances,
  normalizeCoreInstances,
  reconcileEquippedCoreIds,
} from './coreInstances'

export {
  equipSignalCore,
  unequipSignalCore,
  mergeSignalCores,
  canEquipSignalCore,
} from './signalCores'

export {
  setFoundrySlot,
  setTrackedPrint,
  startFabrication,
}

export { equipRelicOnCore, removeRelicFromCore, setResearchFocus, startResearch }

export function upgradeRelic(state: GameState, relicId: string): GameState {
  const check = canStartRelicUpgrade(state, relicId)
  if (!check.ok || !check.toTier) return state
  return startFabrication(state, 'relic', relicUpgradeJobId(relicId, check.toTier))
}
export function convertAshToHeat(state: GameState): GameState {
  return convertAshToHeatRaw(state)
}

export function igniteFurnace(
  state: GameState,
  channels: Partial<Record<import('./types').FurnaceChannelId, import('./types').FurnaceChannelLevel>>,
): GameState {
  const next = igniteFurnaceRaw(state, channels)
  if (next === state) return state
  const stats = computeShipStats(next)
  const flag = next.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) {
    flag.hullMax = stats.hullMax
    flag.shieldMax = stats.shieldMax
    flag.hull = Math.min(flag.hull, flag.hullMax)
    flag.shield = Math.min(flag.shield, flag.shieldMax)
  }
  syncPersistedHullCaps(next)
  syncPlayerFleetWeapons(next)
  return next
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
    if (delta > 0 && isWorkerJob(stationId) && !visibleWorkerJobIds(state).includes(stationId)) {
      return state
    }
  }
  if (delta === 0) return state

  const current = state.base.assignments[stationId] ?? 0
  if (delta > 0) {
    if (idleWorkers(state) < delta) return state
    if (!networkBar && current + delta > workerJobCap(stationId).hard) return state
    const next = structuredClone(state)
    next.base.assignments = {
      ...next.base.assignments,
      [stationId]: current + delta,
    }
    if (networkBar) {
      noteSystemAction(next, 'network')
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
  const active = new Set(visibleWorkerJobIds(state))
  return STATIONS.filter(
    (s) => s.kind !== 'training' && active.has(s.id),
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

/** Fill each industry station to black-bar; dump overflow to Salvage ops. */
function assignBalanced(state: GameState): Record<string, number> {
  const stations = laborStations(state)
  const assignments: Record<string, number> = {}
  if (stations.length === 0 || state.base.workerDrones <= 0) return assignments

  let remaining = state.base.workerDrones
  const needs = stations
    .map((s) => ({
      id: s.id,
      cap: Math.min(stationBlackBarNeed(state, s.id), workerJobCap(s.id).hard),
    }))
    .filter((r) => Number.isFinite(r.cap) && r.cap > 0)
    .sort((a, b) => a.cap - b.cap || a.id.localeCompare(b.id))

  for (const row of needs) {
    if (remaining <= 0) break
    const n = Math.min(remaining, row.cap)
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

/** Extra drones sit on Salvage ops. Training ranges are leftover and unused. */
function dumpOverflowDrones(
  state: GameState,
  assignments: Record<string, number>,
  count: number,
): void {
  const dump = isStationUnlocked(state, 'scrap-field')
    ? 'scrap-field'
    : laborStations(state)[0]?.id
  if (!dump || count <= 0) return
  const cap = workerJobCap(dump).hard
  const current = assignments[dump] ?? 0
  const room = Math.max(0, cap - current)
  if (room <= 0) return
  assignments[dump] = current + Math.min(count, room)
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
      cap: Math.min(stationBlackBarNeed(state, s.id), workerJobCap(s.id).hard),
    }))
    .filter((r) => Number.isFinite(r.cap) && r.cap > 0)
    .sort((a, b) => b.w - a.w || a.id.localeCompare(b.id))

  let remaining = state.base.workerDrones
  for (const row of wants) {
    if (remaining <= 0) break
    const n = Math.min(remaining, row.cap)
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
    scrapDrones = Math.min(scrapDrones, workerJobCap('scrap-field').hard)
    foundryDrones = Math.min(foundryDrones, workerJobCap('alloy-foundry').hard)
    if (scrapDrones > 0) assignments['scrap-field'] = scrapDrones
    else delete assignments['scrap-field']
    if (foundryDrones > 0) assignments['alloy-foundry'] = foundryDrones
    else delete assignments['alloy-foundry']
  }

  return assignments
}

function assignByNetworkWeights(
  state: GameState,
  weights: Record<string, number>,
): Record<string, number> {
  const stations = laborStations(state)
  const assignments: Record<string, number> = {}
  if (stations.length === 0 || state.base.workerDrones <= 0) return assignments

  const rows = stations
    .map((s) => ({
      id: s.id,
      w: Math.max(0, weights[s.id] ?? 0),
      cap: workerJobCap(s.id).hard,
    }))
    .filter((r) => r.w > 0)

  if (rows.length === 0) return assignBalanced(state)

  const totalW = rows.reduce((sum, row) => sum + row.w, 0)
  let remaining = state.base.workerDrones
  const ranked = [...rows].sort((a, b) => b.w - a.w || a.id.localeCompare(b.id))
  for (const row of ranked) {
    if (remaining <= 0) break
    const want = Math.floor((state.base.workerDrones * row.w) / totalW)
    const n = Math.min(remaining, want, row.cap)
    if (n > 0) {
      assignments[row.id] = n
      remaining -= n
    }
  }
  while (remaining > 0) {
    let placed = false
    for (const row of ranked) {
      if ((assignments[row.id] ?? 0) >= row.cap) continue
      assignments[row.id] = (assignments[row.id] ?? 0) + 1
      remaining -= 1
      placed = true
      if (remaining <= 0) break
    }
    if (!placed) break
  }
  return assignments
}

/** Apply Labor Router with the saved (or provided) profile. */
export function autoBalanceWorkers(
  state: GameState,
  profile?: LaborProfile,
): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
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
 * Fill toward black-bar, then stop at the job hard cap. Extra drones stay idle.
 */
export function fillStationWorkers(state: GameState, stationId: string): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  if (!isStationUnlocked(state, stationId)) return state
  const idle = idleWorkers(state)
  if (idle <= 0) return state
  const assigned = state.base.assignments[stationId] ?? 0
  const hard = workerJobCap(stationId).hard
  const bb = stationBlackBarNeed(state, stationId)
  const target = Math.min(hard, Number.isFinite(bb) ? bb : hard)
  if (assigned >= target) return state
  return assignWorker(state, stationId, Math.min(idle, target - assigned))
}

export function unequipAllModules(state: GameState): GameState {
  if (!state.ai.purchased.includes('batch-refit')) return state
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  next.shipyard.modules = []
  next.shipyard.equippedCoreIds = []
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
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

export function unlockFrame(_state: GameState, _frameId: string): GameState {
  return _state
}

export function selectFrame(state: GameState, frameId: string): GameState {
  if (!state.shipyard.unlockedFrames.includes(frameId)) return state
  // Docked is the source of truth. A stuck frameLocked flag must not block Loadout.
  if (!state.combat.docked) return state
  const frame = getFrame(frameId)
  if (!frame) return state

  const next = structuredClone(state)
  const previousModules = [...next.shipyard.modules]
  const previousCoreIds = [...(next.shipyard.equippedCoreIds ?? [])]
  next.shipyard.frameLocked = false
  next.shipyard.frameId = frameId
  next.shipyard.modules = trimModulesToUsableSlots(next, next.shipyard.modules, frameId)
  reconcileEquippedCoreIds(next.shipyard, previousModules, previousCoreIds)
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unlockModule(state: GameState, moduleId: string): GameState {
  const def = getModule(moduleId)
  if (!def) return state
  if (state.shipyard.unlockedModules.includes(moduleId)) return state
  if (def.unlockSource !== 'start') return state
  if (!canAfford(state.resources, def.unlockCost)) return state

  const next = structuredClone(state)
  pay(next.resources, def.unlockCost)
  next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
  addCoreInstance(next.shipyard, moduleId)
  return next
}

export function canAssembleBlueprint(
  state: GameState,
  moduleId: string,
): { ok: boolean; reason?: string } {
  return canStartFabrication(state, 'core', moduleId)
}

/** Queue a timed Fabrication job. Combat discovers fragments; Foundry constructs. */
export function assembleBlueprint(state: GameState, moduleId: string): GameState {
  const check = canAssembleBlueprint(state, moduleId)
  if (!check.ok) return state
  return startFabrication(state, 'core', moduleId)
}

export function fitModule(state: GameState, moduleId: string, coreInstanceId?: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (isCoreBlockedByChallenge(state, moduleId)) return state
  if (state.challenges.activeId === 'single-pattern' && getModule(moduleId)?.role === 'weapon') {
    const fittedWeapons = state.shipyard.modules.filter((id) => getModule(id)?.role === 'weapon')
    if (fittedWeapons.some((id) => id !== moduleId)) return state
  }
  const frame = getFrame(state.shipyard.frameId)
  if (!frame) return state
  if (!canFitModuleOnFrame(state.shipyard.modules, moduleId, usableCoreSlots(state))) {
    return state
  }

  const next = structuredClone(state)
  normalizeCoreInstances(next.shipyard)
  const available = availableCoreInstances(next, moduleId)
  const instance = coreInstanceId
    ? available.find((candidate) => candidate.id === coreInstanceId)
    : available[0]
  if (!instance) return state
  next.shipyard.modules = [...next.shipyard.modules, moduleId]
  next.shipyard.equippedCoreIds = [...next.shipyard.equippedCoreIds, instance.id]
  recordPlaytest(next, 'core_fitted', {
    n: getModule(moduleId)?.name ?? moduleId,
    firstKey: `core_fitted:${moduleId}`,
  })
  noteSystemAction(next, 'cores')
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unfitModule(state: GameState, moduleId: string, coreInstanceId?: string): GameState {
  const idx = coreInstanceId
    ? (state.shipyard.equippedCoreIds?.findIndex(
        (id, slot) => id === coreInstanceId && state.shipyard.modules[slot] === moduleId,
      ) ?? -1)
    : state.shipyard.modules.lastIndexOf(moduleId)
  if (idx < 0) return state
  const next = structuredClone(state)
  next.shipyard.modules = next.shipyard.modules.filter((_, i) => i !== idx)
  next.shipyard.equippedCoreIds = next.shipyard.equippedCoreIds.filter((_, i) => i !== idx)
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

/**
 * Per-physical-Core Doctrine. Allowed only while Docked or Sortie PAUSED,
 * and only after Fire-Control Doctrine is unlocked (PR9). Changing Doctrine
 * preserves Current Target, aim, and a valid charge/beam; it does not Resume.
 * The next discretionary evaluation runs promptly after Resume.
 */
export function setCoreTargetingDoctrine(
  state: GameState,
  coreInstanceId: string,
  doctrine: TargetingDoctrineId,
): GameState {
  if (!canConfigureTargetingDoctrine(state)) return state
  if (!canEditTargetingNow(state)) return state
  const instance = state.shipyard.coreInstances?.find((row) => row.id === coreInstanceId)
  if (!instance) return state
  if (!isTargetingCapableCoreModule(instance.moduleId)) return state
  const profile = targetingProfileFor(instance.moduleId)
  if (!(profile.allowedDoctrines as readonly string[]).includes(doctrine)) return state
  if (instance.targetingDoctrine === doctrine) return state
  const next = structuredClone(state)
  const row = next.shipyard.coreInstances.find((item) => item.id === coreInstanceId)
  if (!row) return state
  row.targetingDoctrine = doctrine
  const deployed = next.combat.playerUnits.find(
    (unit) => unit.isCore && (unit.coreInstanceId === coreInstanceId || unit.id === coreInstanceId),
  )
  if (deployed) {
    deployed.nextTargetEvalAt = 0
  }
  return next
}

/** Persist fitted loadout across Rebuild. */
function persistLoadout(
  unlockedFrames: string[],
  unlockedModules: string[],
  frameId: string,
  modules: string[],
  usableSlots = 2,
  coreInstances: CoreInstance[] = [],
  equippedCoreIds: string[] = [],
): GameState['shipyard'] {
  const frame = unlockedFrames.includes(frameId) ? frameId : STARTER_FRAME_ID
  let fitted = trimModulesToFrame(
    modules.filter((id) => unlockedModules.includes(id)),
    usableSlots,
  )

  if (fitted.length === 0 && unlockedModules.includes('pulse-cannon')) {
    fitted = ['pulse-cannon']
  }

  const loadout: GameState['shipyard'] = {
    frameId: frame,
    modules: fitted,
    coreInstances: structuredClone(coreInstances),
    equippedCoreIds: [],
    unlockedFrames,
    unlockedModules,
    frameLocked: false,
  }
  reconcileEquippedCoreIds(loadout, modules, equippedCoreIds)
  return loadout
}

export function buyCoreStartingLevel(
  state: GameState,
  coreInstanceId: string,
  count = 1,
): GameState {
  const next = buyCoreStartingLevelInternal(state, coreInstanceId, count)
  if (next === state) return state
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

function applyRunUpgradePurchase(next: GameState, id: RunUpgradeId): boolean {
  const def = RUN_UPGRADES.find((row) => row.id === id)
  if (!def) return false
  if (!isUpgradePermanentlyKnown(next, id)) return false
  if (tutorialSortieShopActive(next) && !TUTORIAL_SORTIE_UPGRADE_IDS.includes(id)) return false
  if (runPurchasedLevel(next, id) >= sortieCap(id)) return false
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
    syncPlayerFleetWeapons(next)
    const stats = computeShipStats(next)
    next.combat.playerHullMax = stats.hullMax
    next.combat.playerShieldMax = stats.shieldMax
    const nextFlag = next.combat.playerUnits.find((u) => u.isFlagship)
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
  if (!isUpgradePermanentlyKnown(state, id)) return state
  const want = count === Number.POSITIVE_INFINITY ? maxAffordableWorkshopPurchases(state, id) : Math.max(1, Math.floor(count))
  if (want <= 0) return state
  const next = structuredClone(state)
  if (!next.workshop) next.workshop = createEmptyWorkshop()
  let bought = 0
  for (let i = 0; i < want; i += 1) {
    const current = Math.max(0, Math.floor(next.workshop.levels?.[id] ?? 0))
    if (current >= workshopCap(id)) break
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

export function buyGenericUnlock(state: GameState, category: RunUpgradeCategory): GameState {
  const check = canUnlockNextGeneric(state, category)
  if (!check.ok) return state
  const next = structuredClone(state)
  const unlocks = ensureGenericUnlocks(next)
  next.resources.scrap -= check.cost
  unlocks[category] = unlocks[category] + 1
  next.meta.genericUpgradeUnlocks = unlocks
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
    data: state.resources.data,
    /** Achievement AI Points persist; doctrine spend is refunded; shop bonus stacks. */
    aiPoints: state.resources.aiPoints + doctrineRefund,
    essence: state.resources.essence,
    essencePurchased: [...state.essence.purchased],
    unlockedFrames: [...state.shipyard.unlockedFrames],
    unlockedModules: [...state.shipyard.unlockedModules],
    frameId: state.shipyard.frameId,
    modules: [...state.shipyard.modules],
    coreInstances: structuredClone(state.shipyard.coreInstances ?? []),
    equippedCoreIds: [...(state.shipyard.equippedCoreIds ?? [])],
    prestigeCount: state.prestige.prestigeCount,
    matterShop: { ...state.prestige.matterShop },
    codex: sanitizeCodexState(state.codex),
    workerDrones: state.base.workerDrones,
    permanentAi,
    /** Research is permanent — rebuying the tree every prestige was redundant. */
    researchUnlocked: [...state.research.unlocked],
    meta: {
      ...state.meta,
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
      lifetimeCoreRunBuys: state.meta.lifetimeCoreRunBuys ?? 0,
      signalCoresCarryOver: state.meta.signalCoresCarryOver ?? false,
      seenOnboarding: [...(state.meta.seenOnboarding ?? [])],
    },
    relics: structuredClone(state.relics ?? { instances: [], nextSerial: {}, coreFits: {} }),
    hiveResearch: structuredClone(state.hiveResearch ?? createEmptyHiveResearchState()),
    challenges: {
      activeId: null,
      medals: { ...(state.challenges?.medals ?? {}) },
      bestWave: { ...(state.challenges?.bestWave ?? {}) },
      uniqueRewards: [...(state.challenges?.uniqueRewards ?? [])],
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

  state.version = fresh.version
  state.lastTickAt = now
  state.resources = {
    ...fresh.resources,
    prestigeMatter: kept.prestigeMatter,
    challengePoints: kept.challengePoints,
    essence: kept.essence,
    scrap: 0,
    data: kept.data ?? state.resources.data,
    aiPoints: kept.aiPoints,
    salvage: 0,
    choirAsh: 0,
    heat: 0,
  }
  state.shipyard = persistLoadout(
    kept.unlockedFrames,
    kept.unlockedModules,
    kept.frameId,
    kept.modules,
    usableCoreSlots(state),
    kept.coreInstances,
    kept.equippedCoreIds,
  )
  state.workshop = createEmptyWorkshop()
  resetPhysicalCoreLevels(state)
  resetWorkshopCycleLevels(state)
  preserveGenericUnlocks(state)
  state.combat = {
    ...fresh.combat,
    bestWave: Math.max(kept.meta.bestWave ?? 0, 0),
    docked: true,
    wave: 1,
    log: [
      `Run reset. Rebuild Matter: ${kept.prestigeMatter}. Choose your frame, then Launch.`,
    ],
  }
  state.base = {
    workerDrones: kept.workerDrones,
    assignments: {},
  }
  state.research = { unlocked: kept.researchUnlocked }
  state.ai = { purchased: kept.permanentAi }
  state.essence = { purchased: kept.essencePurchased }
  state.prestige = {
    prestigeCount: kept.prestigeCount,
    matterShop: kept.matterShop,
    cycle: emptyRebuildCycle(),
  }
  state.codex = kept.codex
  state.meta = kept.meta
  state.core = fresh.core
  state.network = wipeNetworkBars(state.network)
  state.foundry = persistFoundryOnRebuild(state.foundry)
  state.relics = kept.relics
  state.furnace = createEmptyFurnaceState()
  endFurnaceSortie(state)
  state.hiveResearch = kept.hiveResearch
  state.challenges = kept.challenges
  state.echo = kept.echo
  state.process = kept.process
  state.specialists = kept.specialists
  state.capital = kept.capital
  state.signalCores = kept.signalCores

  retirePostResetOnboarding(state)
  applyReconstitutionCache(state)

  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerShield = stats.shieldMax
}

/** Challenge Sortie reset — does not Rebuild, award Matter, or clear the normal cycle. */
function applyChallengeSortieReset(state: GameState, now = Date.now()): void {
  state.lastTickAt = now
  state.combat.inFight = false
  state.combat.sortiePaused = false
  state.combat.docked = true
  state.combat.defeatLeft = 0
  state.combat.defeatTactical = false
  state.combat.runUpgrades = {}
  Object.assign(state.combat, emptyWaveRuntime())
  state.combat.wave = 1
  state.combat.waveReached = 0
  state.combat.packages = []
  state.combat.pendingReinforcements = []
  state.combat.playerUnits = []
  state.combat.enemyUnits = []
  state.combat.sortieMark = null
  state.shipyard.frameLocked = false
  clearDirectives(state)
  endFurnaceSortie(state)
  state.resources.salvage = 0
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerShield = stats.shieldMax
}

export function performRebuild(
  state: GameState,
  hangar: { frameId: string; modules: string[] },
  now = Date.now(),
): GameState {
  if (!canRebuild(state)) return state
  const frame = getFrame(hangar.frameId)
  if (!frame) return state
  if (!state.shipyard.unlockedFrames.includes(hangar.frameId)) return state
  const next = structuredClone(state)
  const previousModules = [...next.shipyard.modules]
  const previousCoreIds = [...(next.shipyard.equippedCoreIds ?? [])]
  next.shipyard.frameId = hangar.frameId
  next.shipyard.modules = trimModulesToFrame(
    hangar.modules.filter((id) => next.shipyard.unlockedModules.includes(id)),
    usableCoreSlots(next, hangar.frameId),
  )
  reconcileEquippedCoreIds(next.shipyard, previousModules, previousCoreIds)
  const gain = matterGainFor(next)
  next.resources.prestigeMatter += gain
  next.prestige.prestigeCount += 1
  next.challenges.activeId = null
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

export function enterChallenge(state: GameState, challengeId: string, opts?: { automated?: boolean }, now = Date.now()): GameState {
  if (!canEnterChallenge(state, challengeId, opts).ok) return state
  const def = getChallenge(challengeId)
  if (!def) return state
  const next = structuredClone(state)
  next.challenges.activeId = challengeId
  applyChallengeSortieReset(next, now)
  if (!next.process) next.process = createEmptyProcessState()
  const kept: string[] = []
  const keptCoreIds: string[] = []
  let weaponPattern: string | null = null
  next.shipyard.modules.forEach((moduleId, index) => {
    const module = getModule(moduleId)
    if (!module) return
    if (def.restrictions.includes('no-utility') && module.role === 'utility') return
    if (def.restrictions.includes('single-pattern') && module.role === 'weapon') {
      weaponPattern ??= moduleId
      if (moduleId !== weaponPattern) return
    }
    kept.push(moduleId)
    const coreId = next.shipyard.equippedCoreIds[index]
    if (coreId) keptCoreIds.push(coreId)
  })
  next.shipyard.modules = kept
  next.shipyard.equippedCoreIds = keptCoreIds
  const stats = computeShipStats(next)
  next.combat.playerHullMax = stats.hullMax
  next.combat.playerHull = stats.hullMax
  next.combat.playerShieldMax = stats.shieldMax
  next.combat.playerShield = stats.shieldMax
  const goal = challengeGoalWave(next, challengeId)
  next.combat.log = [
    `Challenge ${def.name}. Goal: reach Wave ${goal}. Salvage and run upgrades reset. ${def.restriction}`,
    ...next.combat.log,
  ]
  noteAttempt(next, 'challenge', challengeId, 'start', def.name)
  return next
}

export function abandonChallenge(state: GameState, now = Date.now()): GameState {
  const def = getChallenge(state.challenges.activeId ?? '')
  if (!state.challenges.activeId) return state
  const next = structuredClone(state)
  noteChallengeProgress(next)
  next.challenges.activeId = null
  if (!next.process) next.process = createEmptyProcessState()
  applyChallengeSortieReset(next, now)
  next.combat.log = [`Abandoned ${def?.name ?? 'Challenge'}.`, ...next.combat.log]
  noteAttempt(next, 'challenge', def?.id ?? 'challenge', 'end', def?.name)
  return next
}

export function buyProcessNode(state: GameState, nodeId: string): GameState {
  if (!canBuyProcessNode(state, nodeId).ok) return state
  const def = getProcessNode(nodeId)
  if (!def) return state
  const next = structuredClone(state)
  if (!next.process) next.process = createEmptyProcessState()
  next.process.earned = Math.max(next.process.earned ?? 0, reconstructProcessEarned(next))
  next.process.purchased = [...next.process.purchased, nodeId]
  if (nodeId === 'rule-builder' && !next.process.config.activeProfileId) {
    next.process.config.activeProfileId = 'custom'
  }
  if (nodeId === 'furnace-presets' && !next.process.config.furnace.preset) {
    next.process.config.furnace.preset = 'push'
  }
  next.resources.aiPoints = processAvailable(next)
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

export function optimiseNetwork(state: GameState): GameState {
  if (!hasProcess(state, 'worker-auto-fill')) return state
  const next = structuredClone(state)
  for (const id of NETWORK_BAR_IDS) {
    delete next.base.assignments[id]
  }
  return setLaborAssignments(next, assignByNetworkWeights(next, networkAllocationWeights(next)))
}

export function applyNetworkPreset(state: GameState, preset: ProcessNetworkPreset): GameState {
  if (!hasProcess(state, 'worker-presets')) return state
  const next = setProcessConfig(state, {
    ...processConfig(state),
    network: { ...processConfig(state).network, preset },
  })
  return optimiseNetwork(next)
}
