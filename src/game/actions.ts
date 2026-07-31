import type { GameState, PartType, Resources } from './types'
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
  trimModulesToFrame,
  type ResourceCost,
} from './catalog'
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
  const def = getStation(stationId)
  if (!def || !isStationUnlocked(state, stationId)) return state
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

/** Evenly spread all workers across unlocked stations (Labor Router). */
export function autoBalanceWorkers(state: GameState): GameState {
  if (!state.ai.purchased.includes('auto-assign-workers')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
  const stations = STATIONS.filter(
    (s) => s.kind !== 'training' && isStationUnlocked(state, s.id),
  )
  if (stations.length === 0 || state.base.workerDrones <= 0) return state

  const next = structuredClone(state)
  const assignments: Record<string, number> = {}
  const n = stations.length
  const base = Math.floor(next.base.workerDrones / n)
  let rem = next.base.workerDrones % n
  for (const station of stations) {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem -= 1
    const count = base + extra
    if (count > 0) assignments[station.id] = count
  }
  next.base.assignments = assignments
  return next
}

export function unequipAllModules(state: GameState): GameState {
  if (!state.ai.purchased.includes('batch-refit')) return state
  if (state.combat.inFight) return state
  const next = structuredClone(state)
  next.shipyard.modules = []
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function upgradeCheapestModule(state: GameState): GameState {
  if (!state.ai.purchased.includes('salvage-optimizer')) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state

  let bestId: string | null = null
  let bestLevel = Infinity
  let bestCost = Infinity
  for (const id of state.shipyard.unlockedModules) {
    const level = moduleLevel(state.shipyard.moduleLevels, id)
    if (level >= MAX_MODULE_LEVEL) continue
    const cost = moduleUpgradeCost(level)
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
  tryCompleteAchievements(next)
  return next
}

export function buyAiNode(state: GameState, nodeId: string): GameState {
  const def = AI_NODES.find((n) => n.id === nodeId)
  if (!def) return state
  if (state.ai.purchased.includes(nodeId)) return state
  if (state.resources.aiPoints < def.costAiPoints) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state
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
  if (def.bonusWorkerDrones) {
    next.base.workerDrones += def.bonusWorkerDrones
  }
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
  if (def.bonusWorkerDrones) {
    next.base.workerDrones += def.bonusWorkerDrones
  }
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
  // +1 softens the 5-wave re-push so first S8 prestige yields 5 PM (was 4).
  const base = Math.max(
    1,
    Math.floor(state.combat.sector / 2) + state.prestige.prestigeCount + 1,
  )
  const ascensions = state.meta.ascensionCount ?? 0
  return Math.max(1, Math.floor(base * (1 + 0.35 * ascensions)))
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
    frameLocked: false,
  }
}

export function upgradeModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (!getModule(moduleId)) return state
  const level = moduleLevel(state.shipyard.moduleLevels, moduleId)
  if (level >= MAX_MODULE_LEVEL) return state
  const cost = moduleUpgradeCost(level)
  if (state.resources.salvage < cost) return state

  const next = structuredClone(state)
  next.resources.salvage -= cost
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
    meta: {
      ...state.meta,
      ascensionCount: state.meta.ascensionCount ?? 0,
      achievementCompletions: { ...(state.meta.achievementCompletions ?? {}) },
      lifetimeSectorClears: state.meta.lifetimeSectorClears ?? 0,
      lifetimeFabCrafts: state.meta.lifetimeFabCrafts ?? 0,
      lifetimeCoreMerges: state.meta.lifetimeCoreMerges ?? 0,
      lifetimeWaveClears: state.meta.lifetimeWaveClears ?? 0,
      discoveredModules: [...(state.meta.discoveredModules ?? [])],
      moduleMastery: { ...(state.meta.moduleMastery ?? {}) },
      signalCoresCarryOver: state.meta.signalCoresCarryOver ?? false,
    },
    parts: { ...(state.parts ?? {}) },
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
  /** Soften first re-pushes after 5-wave Act 1 pacing. */
  const returning = kept.prestigeCount > 0
  const returnScrap = returning ? 10 : 0
  const returnData = returning ? 5 : 0
  const returnSalvage = returning ? 6 : 0

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
      `Run reset. Prestige matter: ${kept.prestigeMatter}. Choose your frame, then Launch.`,
    ],
  }
  state.base = {
    workerDrones: kept.workerDrones,
    assignments: {},
    manufactureProgress: kept.manufactureProgress,
    fabProject: null,
  }
  state.research = fresh.research
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
  state.signalCores = kept.signalCores
  state.parts = kept.parts

  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerShield = stats.shieldMax
}

export function performPrestige(state: GameState, now = Date.now()): GameState {
  if (!canPrestige(state)) return state
  const next = structuredClone(state)
  const gain = prestigeGainFor(next)
  next.resources.prestigeMatter += gain
  next.prestige.prestigeCount += 1
  next.prestige.activeChallengeId = null
  applyRunReset(next, now)
  tryCompleteAchievements(next)
  next.combat.log = [
    `Prestiged for +${gain} Prestige Matter.`,
    ...next.combat.log,
  ]
  return next
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
      0.35 *
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
  const gain = prestigeGainFor(next)
  next.resources.prestigeMatter += gain
  next.prestige.prestigeCount += 1
  next.prestige.activeChallengeId = challengeId
  applyRunReset(next, now)
  if (challengeId === 'null-signal') {
    unequipAllSignalCores(next)
  }
  tryCompleteAchievements(next)
  next.combat.log = [
    `Entered challenge: ${challenge.name} (+${gain} Prestige Matter). Goal: sector ${challenge.goalSector}.`,
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
    `Challenge complete: ${challenge.name} (${nextClears}/${maxClears}). +${challenge.rewardChallengePoints} Challenge Points.`,
    ...state.combat.log,
  ]
}

/** @deprecated buildings replaced by worker stations */
export function upgradeBuilding(state: GameState, _buildingId: string): GameState {
  return state
}

export function isBuildingUnlocked(_state: GameState, _buildingId: string): boolean {
  return false
}
