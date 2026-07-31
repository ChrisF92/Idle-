import type { GameState, Resources } from './types'
import {
  AI_NODES,
  MAX_MODULE_LEVEL,
  RESEARCH,
  buildingUpgradeCost,
  challengeClearCount,
  challengeShopStartingAi,
  challengeShopStartingSalvage,
  challengeShopStartingScrap,
  getBuilding,
  getChallenge,
  getChallengeShopItem,
  getEssenceUpgrade,
  getFrame,
  getMatterShopItem,
  getModule,
  isChallengeUnlocked,
  canFitModuleOnFrame,
  moduleLevel,
  moduleUpgradeCost,
  prestigeMinSectorFor,
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

export function isBuildingUnlocked(state: GameState, buildingId: string): boolean {
  const def = getBuilding(buildingId)
  if (!def) return false
  if (!def.requiresResearch) return true
  return state.research.unlocked.includes(def.requiresResearch)
}

export function upgradeBuilding(state: GameState, buildingId: string): GameState {
  const def = getBuilding(buildingId)
  if (!def || !isBuildingUnlocked(state, buildingId)) return state

  const level = state.base.buildings[buildingId] ?? 0
  const cost = buildingUpgradeCost(def, level)
  if (!canAfford(state.resources, cost)) return state

  const next = structuredClone(state)
  pay(next.resources, cost)
  next.base.buildings[buildingId] = level + 1
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
  return next
}

export function buyAiNode(state: GameState, nodeId: string): GameState {
  const def = AI_NODES.find((n) => n.id === nodeId)
  if (!def) return state
  if (state.ai.purchased.includes(nodeId)) return state
  if (state.resources.aiPoints < def.costAiPoints) return state
  if (state.prestige.activeChallengeId === 'no-ai') return state

  const next = structuredClone(state)
  next.resources.aiPoints -= def.costAiPoints
  next.ai.purchased = [...next.ai.purchased, nodeId]
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
  if (state.prestige.shop.includes(itemId)) return state
  if (state.resources.challengePoints < def.costCp) return state

  const next = structuredClone(state)
  next.resources.challengePoints -= def.costCp
  next.prestige.shop = [...next.prestige.shop, itemId]
  return next
}

export function buyMatterShop(state: GameState, itemId: string): GameState {
  const def = getMatterShopItem(itemId)
  if (!def) return state
  if (state.prestige.matterShop.includes(itemId)) return state
  if (state.resources.prestigeMatter < def.costPm) return state

  const next = structuredClone(state)
  next.resources.prestigeMatter -= def.costPm
  next.prestige.matterShop = [...next.prestige.matterShop, itemId]
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unlockFrame(state: GameState, frameId: string): GameState {
  const def = getFrame(frameId)
  if (!def) return state
  if (state.shipyard.unlockedFrames.includes(frameId)) return state
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
  next.shipyard.modules = trimModulesToFrame(next.shipyard.modules, frame)
  if (!next.combat.inFight) syncPersistedHullCaps(next)
  return next
}

export function unlockModule(state: GameState, moduleId: string): GameState {
  const def = getModule(moduleId)
  if (!def) return state
  if (state.shipyard.unlockedModules.includes(moduleId)) return state
  if (!canAfford(state.resources, def.unlockCost)) return state

  const next = structuredClone(state)
  pay(next.resources, def.unlockCost)
  next.shipyard.unlockedModules = [...next.shipyard.unlockedModules, moduleId]
  return next
}

export function fitModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.unlockedModules.includes(moduleId)) return state
  if (state.shipyard.modules.includes(moduleId)) return state
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
  return Math.max(1, Math.floor(state.combat.sector / 2) + state.prestige.prestigeCount)
}

export function canPrestige(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  return state.combat.sector >= prestigeMinSectorFor(state.prestige.shop)
}

export function canEnterChallenge(state: GameState, challengeId: string): boolean {
  if (state.prestige.activeChallengeId) return false
  const challenge = getChallenge(challengeId)
  if (!challenge) return false
  if (!isChallengeUnlocked(state, challengeId)) return false
  const clears = challengeClearCount(state.prestige.challengeClears, challengeId)
  if (clears >= challenge.maxClears) return false
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
  let fitted = trimModulesToFrame(
    modules.filter((id) => unlockedModules.includes(id)),
    frameDef,
  )

  // Challenge-specific loadout conflicts (extend as challenges grow).
  if (activeChallengeId === 'no-ai') {
    // No module strip for Silent Bridge — AI is blocked separately.
  }

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
  // Preserve weapon cooldown progress on the flagship where ids match
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
  const kept = {
    prestigeMatter: state.resources.prestigeMatter,
    challengePoints: state.resources.challengePoints,
    essence: state.resources.essence,
    essencePurchased: [...state.essence.purchased],
    unlockedFrames: [...state.shipyard.unlockedFrames],
    unlockedModules: [...state.shipyard.unlockedModules],
    frameId: state.shipyard.frameId,
    modules: [...state.shipyard.modules],
    prestigeCount: state.prestige.prestigeCount,
    challengeClears: { ...state.prestige.challengeClears },
    activeChallengeId: state.prestige.activeChallengeId,
    shop: [...state.prestige.shop],
    matterShop: [...state.prestige.matterShop],
    seenFamilies: [...(state.codex?.seenFamilies ?? [])],
  }

  const fresh = createInitialState(now)
  const bonusScrap = challengeShopStartingScrap(kept.shop)
  const bonusAi = challengeShopStartingAi(kept.shop)
  const bonusSalvage = challengeShopStartingSalvage(kept.shop)

  state.version = fresh.version
  state.lastTickAt = now
  state.resources = {
    ...fresh.resources,
    prestigeMatter: kept.prestigeMatter,
    challengePoints: kept.challengePoints,
    essence: kept.essence,
    scrap: fresh.resources.scrap + bonusScrap,
    aiPoints: fresh.resources.aiPoints + bonusAi,
    salvage: bonusSalvage,
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
    log: [
      `Run reset. Prestige matter: ${kept.prestigeMatter}. Docked — choose your frame before Launch.`,
    ],
  }
  state.base = fresh.base
  state.research = fresh.research
  state.ai = fresh.ai
  state.essence = { purchased: kept.essencePurchased }
  state.prestige = {
    prestigeCount: kept.prestigeCount,
    activeChallengeId: kept.activeChallengeId,
    challengeClears: kept.challengeClears,
    shop: kept.shop,
    matterShop: kept.matterShop,
  }
  state.codex = { seenFamilies: kept.seenFamilies }

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
  next.combat.log = [
    `Prestiged for +${gain} Prestige Matter.`,
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
  // highestSector tracks the max sector cleared this prestige (Advance or Hold).
  const cleared = state.combat.highestSector
  if (cleared < challenge.goalSector) return

  const prev = challengeClearCount(state.prestige.challengeClears, id)
  if (prev >= challenge.maxClears) {
    state.prestige.activeChallengeId = null
    state.combat.log = [
      `Challenge ${challenge.name} already at max clears (${challenge.maxClears}).`,
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
  state.combat.log = [
    `Challenge complete: ${challenge.name} (${nextClears}/${challenge.maxClears}). +${challenge.rewardChallengePoints} Challenge Points.`,
    ...state.combat.log,
  ]
}
