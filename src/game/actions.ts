import type { GameState, Resources } from './types'
import {
  AI_NODES,
  PRESTIGE_MIN_SECTOR,
  RESEARCH,
  buildingUpgradeCost,
  getBuilding,
  getChallenge,
  getFrame,
  getModule,
  type ResourceCost,
} from './catalog'
import { computeShipStats, createInitialState } from './state'

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

  const next = structuredClone(state)
  next.resources.data -= def.costData
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
  const frame = getFrame(frameId)
  if (!frame) return state

  const next = structuredClone(state)
  next.shipyard.frameId = frameId
  // Trim modules if new frame has fewer slots
  next.shipyard.modules = next.shipyard.modules.slice(0, frame.slots)
  if (!next.combat.inFight) {
    const stats = computeShipStats(next)
    next.combat.playerHullMax = stats.hullMax
    next.combat.playerHull = stats.hullMax
  }
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
  if (state.shipyard.modules.length >= frame.slots) return state

  const next = structuredClone(state)
  next.shipyard.modules = [...next.shipyard.modules, moduleId]
  if (!next.combat.inFight) {
    const stats = computeShipStats(next)
    next.combat.playerHullMax = stats.hullMax
    next.combat.playerHull = stats.hullMax
  }
  return next
}

export function unfitModule(state: GameState, moduleId: string): GameState {
  if (!state.shipyard.modules.includes(moduleId)) return state
  const next = structuredClone(state)
  next.shipyard.modules = next.shipyard.modules.filter((id) => id !== moduleId)
  if (!next.combat.inFight) {
    const stats = computeShipStats(next)
    next.combat.playerHullMax = stats.hullMax
    next.combat.playerHull = stats.hullMax
  }
  return next
}

export function prestigeGainFor(state: GameState): number {
  return Math.max(1, Math.floor(state.combat.sector / 2) + state.prestige.prestigeCount)
}

export function canPrestige(state: GameState): boolean {
  if (state.prestige.activeChallengeId) return false
  return state.combat.sector >= PRESTIGE_MIN_SECTOR
}

export function canEnterChallenge(state: GameState, challengeId: string): boolean {
  if (state.prestige.activeChallengeId) return false
  if (state.prestige.completedChallenges.includes(challengeId)) return false
  if (!getChallenge(challengeId)) return false
  return state.combat.sector >= PRESTIGE_MIN_SECTOR
}

function applyRunReset(state: GameState, now = Date.now()): void {
  const kept = {
    prestigeMatter: state.resources.prestigeMatter,
    challengePoints: state.resources.challengePoints,
    unlockedFrames: [...state.shipyard.unlockedFrames],
    unlockedModules: [...state.shipyard.unlockedModules],
    frameId: state.shipyard.unlockedFrames.includes(state.shipyard.frameId)
      ? state.shipyard.frameId
      : 'scout-frame',
    prestigeCount: state.prestige.prestigeCount,
    completedChallenges: [...state.prestige.completedChallenges],
    activeChallengeId: state.prestige.activeChallengeId,
  }

  const fresh = createInitialState(now)
  state.version = fresh.version
  state.lastTickAt = now
  state.resources = {
    ...fresh.resources,
    prestigeMatter: kept.prestigeMatter,
    challengePoints: kept.challengePoints,
  }
  state.shipyard = {
    frameId: kept.frameId,
    modules: fresh.shipyard.modules.filter((id) => kept.unlockedModules.includes(id)),
    unlockedFrames: kept.unlockedFrames,
    unlockedModules: kept.unlockedModules,
  }
  // Prefer pulse-cannon fitted if available
  if (
    state.shipyard.modules.length === 0 &&
    kept.unlockedModules.includes('pulse-cannon')
  ) {
    state.shipyard.modules = ['pulse-cannon']
  }
  state.combat = {
    ...fresh.combat,
    log: [`Run reset. Prestige matter: ${kept.prestigeMatter}.`],
  }
  state.base = fresh.base
  state.research = fresh.research
  state.ai = fresh.ai
  state.prestige = {
    prestigeCount: kept.prestigeCount,
    activeChallengeId: kept.activeChallengeId,
    completedChallenges: kept.completedChallenges,
  }

  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerHull = stats.hullMax
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
  // After clearing sector N, sector becomes N+1. Cleared count = sector - 1.
  const cleared = state.combat.sector - 1
  if (cleared < challenge.goalSector) return

  state.prestige.completedChallenges = [...state.prestige.completedChallenges, id]
  state.prestige.activeChallengeId = null
  state.resources.challengePoints += challenge.rewardChallengePoints
  state.combat.log = [
    `Challenge complete: ${challenge.name}. +${challenge.rewardChallengePoints} Challenge Points.`,
    ...state.combat.log,
  ]
}
