import type { GameState, Resources } from './types'
import {
  AI_NODES,
  RESEARCH,
  buildingUpgradeCost,
  getBuilding,
  type ResourceCost,
} from './catalog'

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

  // Challenge stub: Silent Bridge will block this later when active.
  if (state.prestige.activeChallengeId === 'no-ai') return state

  const next = structuredClone(state)
  next.resources.aiPoints -= def.costAiPoints
  next.ai.purchased = [...next.ai.purchased, nodeId]
  return next
}
