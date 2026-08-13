/**
 * Phase 3 — Forward Base: temporary Expedition buildings + drone labour.
 * Timers use remaining-seconds and freeze while Paused.
 * Deployed drones do not reduce Home Base output.
 */

import type {
  ForwardBaseState,
  ForwardBuildingId,
  ForwardBuildingState,
  GameState,
} from './types'

export type { ForwardBuildingId, ForwardBuildingState, ForwardBaseState }

export interface ForwardBuildingDef {
  id: ForwardBuildingId
  name: string
  description: string
  /** Career highest wave to unlock the build option. */
  unlockWave: number
  /** Salvage to construct (level 0 → 1). */
  constructCost: number
  constructSeconds: number
  /** Salvage cost at level L → L+1: base × growth^(L-1). */
  upgradeBaseCost: number
  upgradeGrowth: number
  upgradeSeconds: number
  maxLevel: number
  /** Max drones that can be assigned. */
  droneCapacity: number
  /** Drones needed for full efficiency breakpoint display. */
  droneSoftCap: number
}

export const FORWARD_BUILDINGS: readonly ForwardBuildingDef[] = [
  {
    id: 'gunnery-matrix',
    name: 'Gunnery Matrix',
    description:
      'Scales purchased offence upgrades and adds baseline weapon power.',
    unlockWave: 10,
    constructCost: 40,
    constructSeconds: 8,
    upgradeBaseCost: 35,
    upgradeGrowth: 1.22,
    upgradeSeconds: 10,
    maxLevel: 20,
    droneCapacity: 6,
    droneSoftCap: 4,
  },
  {
    id: 'salvage-relay',
    name: 'Salvage Relay',
    description: 'Boosts Salvage from kills and wave clears.',
    unlockWave: 10,
    constructCost: 35,
    constructSeconds: 8,
    upgradeBaseCost: 30,
    upgradeGrowth: 1.2,
    upgradeSeconds: 10,
    maxLevel: 20,
    droneCapacity: 6,
    droneSoftCap: 4,
  },
  {
    id: 'shield-foundry',
    name: 'Shield Foundry',
    description: 'Improves shields, armour, and damage resistance.',
    unlockWave: 30,
    constructCost: 70,
    constructSeconds: 12,
    upgradeBaseCost: 55,
    upgradeGrowth: 1.24,
    upgradeSeconds: 12,
    maxLevel: 20,
    droneCapacity: 6,
    droneSoftCap: 4,
  },
  {
    id: 'repair-dock',
    name: 'Repair Dock',
    description: 'Between-wave hull and shield recovery.',
    unlockWave: 30,
    constructCost: 65,
    constructSeconds: 12,
    upgradeBaseCost: 50,
    upgradeGrowth: 1.23,
    upgradeSeconds: 12,
    maxLevel: 20,
    droneCapacity: 6,
    droneSoftCap: 4,
  },
] as const

export function getForwardBuilding(id: string): ForwardBuildingDef | undefined {
  return FORWARD_BUILDINGS.find((b) => b.id === id)
}

export function createEmptyForwardBaseState(): ForwardBaseState {
  const buildings = {} as Record<ForwardBuildingId, ForwardBuildingState>
  for (const def of FORWARD_BUILDINGS) {
    buildings[def.id] = { level: 0, assignedDrones: 0 }
  }
  return { buildings }
}

export function forwardBaseUnlocked(state: GameState): boolean {
  const career = Math.max(state.meta.highestWaveEver ?? 0, state.combat.bestWaveThisRun)
  return career >= 10
}

export function isBuildingUnlocked(state: GameState, def: ForwardBuildingDef): boolean {
  const career = Math.max(state.meta.highestWaveEver ?? 0, state.combat.bestWaveThisRun)
  return career >= def.unlockWave
}

/**
 * Expedition deployment capacity from permanent corps.
 * Deployed drones do NOT reduce Home Base output.
 */
export function expeditionDroneCapacity(state: GameState): number {
  if (!forwardBaseUnlocked(state)) return 0
  const corps = Math.max(0, state.base.workerDrones)
  // Remote allowance: starter remote team + portion of corps.
  return Math.min(20, 3 + Math.floor(corps * 0.35))
}

export function totalAssignedExpeditionDrones(state: GameState): number {
  const fb = state.combat.forwardBase
  if (!fb) return 0
  let sum = 0
  for (const b of Object.values(fb.buildings)) {
    sum += Math.max(0, b.assignedDrones)
  }
  return sum
}

export function unassignedExpeditionDrones(state: GameState): number {
  return Math.max(0, expeditionDroneCapacity(state) - totalAssignedExpeditionDrones(state))
}

/** Effective drone power for a building (soft-caps past softCap). */
export function effectiveBuildingDrones(
  assigned: number,
  softCap: number,
): number {
  if (assigned <= softCap) return assigned
  const over = assigned - softCap
  return softCap + over * 0.45
}

export function buildingUpgradeCost(def: ForwardBuildingDef, fromLevel: number): number {
  if (fromLevel <= 0) return def.constructCost
  return Math.ceil(def.upgradeBaseCost * Math.pow(def.upgradeGrowth, fromLevel - 1))
}

export function buildingTimerSeconds(def: ForwardBuildingDef, fromLevel: number): number {
  return fromLevel <= 0 ? def.constructSeconds : def.upgradeSeconds
}

/** Aggregated Forward Base combat/economy bonuses. */
export interface ForwardBaseBonuses {
  /** Multiplies the *bonus portion* of store offence ranks. */
  offenceRankScale: number
  /** Flat additive damage multiplier from Gunnery baseline. */
  gunneryDamageMult: number
  gunneryFireRateMult: number
  salvageKillFlat: number
  salvageWaveMult: number
  shieldMult: number
  armorFlat: number
  damageTakenMult: number
  betweenWaveHullFrac: number
  betweenWaveShieldFrac: number
}

export function emptyForwardBaseBonuses(): ForwardBaseBonuses {
  return {
    offenceRankScale: 1,
    gunneryDamageMult: 1,
    gunneryFireRateMult: 1,
    salvageKillFlat: 0,
    salvageWaveMult: 1,
    shieldMult: 1,
    armorFlat: 0,
    damageTakenMult: 1,
    // Phase 1 interim baseline when Repair Dock absent
    betweenWaveHullFrac: 0.06,
    betweenWaveShieldFrac: 0.15,
  }
}

function buildingPower(
  state: GameState,
  id: ForwardBuildingId,
): { level: number; drones: number } {
  const def = getForwardBuilding(id)!
  const b = state.combat.forwardBase?.buildings[id]
  if (!b || b.level <= 0) return { level: 0, drones: 0 }
  return {
    level: b.level,
    drones: effectiveBuildingDrones(b.assignedDrones, def.droneSoftCap),
  }
}

export function computeForwardBaseBonuses(state: GameState): ForwardBaseBonuses {
  const b = emptyForwardBaseBonuses()
  const gunnery = buildingPower(state, 'gunnery-matrix')
  if (gunnery.level > 0) {
    b.offenceRankScale = 1 + 0.08 * gunnery.level + 0.03 * gunnery.drones
    b.gunneryDamageMult = 1 + 0.025 * gunnery.level + 0.012 * gunnery.drones
    b.gunneryFireRateMult = 1 + 0.02 * gunnery.level + 0.01 * gunnery.drones
  }

  const relay = buildingPower(state, 'salvage-relay')
  if (relay.level > 0) {
    b.salvageWaveMult = 1 + 0.06 * relay.level + 0.03 * relay.drones
    b.salvageKillFlat = 0.08 * relay.level + 0.04 * relay.drones
  }

  const foundry = buildingPower(state, 'shield-foundry')
  if (foundry.level > 0) {
    b.shieldMult = 1 + 0.05 * foundry.level + 0.02 * foundry.drones
    b.armorFlat = 0.35 * foundry.level + 0.15 * foundry.drones
    b.damageTakenMult = Math.max(0.7, 1 - 0.012 * foundry.level - 0.005 * foundry.drones)
  }

  const dock = buildingPower(state, 'repair-dock')
  if (dock.level > 0) {
    b.betweenWaveHullFrac = 0.08 + 0.025 * dock.level + 0.012 * dock.drones
    b.betweenWaveShieldFrac = 0.2 + 0.035 * dock.level + 0.015 * dock.drones
  }

  return b
}

/** Advance building timers by dt seconds (no-op while paused — caller gates). */
export function tickForwardBaseTimers(state: GameState, dt: number): void {
  const fb = state.combat.forwardBase
  if (!fb || dt <= 0) return
  for (const def of FORWARD_BUILDINGS) {
    const b = fb.buildings[def.id]
    if (!b?.timerRemaining || b.timerRemaining <= 0) continue
    b.timerRemaining -= dt
    if (b.timerRemaining > 0) continue
    b.timerRemaining = undefined
    const kind = b.timerKind
    b.timerKind = undefined
    if (kind === 'construct' || kind === 'upgrade') {
      b.level = Math.min(def.maxLevel, b.level + 1)
    }
  }
}

export function canConstructOrUpgrade(
  state: GameState,
  buildingId: ForwardBuildingId,
): { ok: true; cost: number; seconds: number } | { ok: false; reason: string } {
  const def = getForwardBuilding(buildingId)
  if (!def) return { ok: false, reason: 'Unknown building' }
  if (!isBuildingUnlocked(state, def)) {
    return { ok: false, reason: `Unlocks at career wave ${def.unlockWave}` }
  }
  const b = state.combat.forwardBase?.buildings[buildingId]
  if (!b) return { ok: false, reason: 'No Forward Base' }
  if (b.timerRemaining && b.timerRemaining > 0) {
    return { ok: false, reason: 'Busy' }
  }
  if (b.level >= def.maxLevel) return { ok: false, reason: 'Max level' }
  const cost = buildingUpgradeCost(def, b.level)
  if (state.resources.salvage < cost) return { ok: false, reason: 'Need Salvage' }
  return { ok: true, cost, seconds: buildingTimerSeconds(def, b.level) }
}

export function startBuildingWork(
  state: GameState,
  buildingId: ForwardBuildingId,
): GameState {
  const check = canConstructOrUpgrade(state, buildingId)
  if (!check.ok) return state
  const def = getForwardBuilding(buildingId)!
  const next = structuredClone(state)
  const b = next.combat.forwardBase.buildings[buildingId]
  next.resources.salvage -= check.cost
  b.timerRemaining = check.seconds
  b.timerKind = b.level <= 0 ? 'construct' : 'upgrade'
  // Drones speed construction slightly
  const speed = 1 + 0.04 * effectiveBuildingDrones(b.assignedDrones, def.droneSoftCap)
  b.timerRemaining = Math.max(2, check.seconds / speed)
  return next
}

export function assignBuildingDrone(
  state: GameState,
  buildingId: ForwardBuildingId,
  delta: number,
): GameState {
  const def = getForwardBuilding(buildingId)
  if (!def || delta === 0) return state
  const b = state.combat.forwardBase?.buildings[buildingId]
  if (!b || b.level <= 0) return state

  const next = structuredClone(state)
  const building = next.combat.forwardBase.buildings[buildingId]
  if (delta > 0) {
    const free = unassignedExpeditionDrones(next)
    const room = def.droneCapacity - building.assignedDrones
    const add = Math.min(delta, free, room)
    if (add <= 0) return state
    building.assignedDrones += add
  } else {
    const remove = Math.min(building.assignedDrones, -delta)
    if (remove <= 0) return state
    building.assignedDrones -= remove
  }
  return next
}

export function buildingEffectSummary(
  state: GameState,
  id: ForwardBuildingId,
): string {
  const { level, drones } = buildingPower(state, id)
  if (level <= 0) return 'Not built'
  switch (id) {
    case 'gunnery-matrix': {
      const scale = 1 + 0.08 * level + 0.03 * drones
      const dmg = 1 + 0.025 * level + 0.012 * drones
      return `Offence ranks ×${scale.toFixed(2)} · Damage ×${dmg.toFixed(2)}`
    }
    case 'salvage-relay': {
      const wave = 1 + 0.06 * level + 0.03 * drones
      const kill = 0.08 * level + 0.04 * drones
      return `Wave Salvage ×${wave.toFixed(2)} · +${kill.toFixed(2)} / kill`
    }
    case 'shield-foundry': {
      const sh = 1 + 0.05 * level + 0.02 * drones
      const ar = 0.35 * level + 0.15 * drones
      return `Shields ×${sh.toFixed(2)} · +${ar.toFixed(1)} armour`
    }
    case 'repair-dock': {
      const hull = 0.08 + 0.025 * level + 0.012 * drones
      const sh = 0.2 + 0.035 * level + 0.015 * drones
      return `Repair ${(hull * 100).toFixed(0)}% hull / ${(sh * 100).toFixed(0)}% shields`
    }
  }
}
