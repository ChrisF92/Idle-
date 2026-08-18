/** Hive Research — USI Research analogue. Three kill-fed branches, one focus. */

import type { GameState, HiveResearchBranch, HiveResearchState } from './types'
import { careerHighestSector } from './progression'
import { reliquaryResearchXpMult } from './reliquary'
import { furnaceResearchXpMult } from './furnace'
import { normalizeRoute, routeResearchMult } from './sectors'
import { echoResearchXpMult } from './echo'
import { processResearchSpeedMult } from './process'
import { protocolModifiers } from './protocols'
import { foundryResearchXpMult } from './foundryBonuses'

export const HIVE_RESEARCH_UNLOCK_SECTOR = 7
/** USI default is 9×; 4× keeps early numbers retunable. */
export const HIVE_RESEARCH_FOCUS_MULT = 4
export const HIVE_RESEARCH_NODES_PER_BRANCH = 8

export interface HiveResearchNodeDef {
  name: string
  blurb: string
  salvage?: number
  foundrySpeed?: number
  damage?: number
  shield?: number
  heatFromAsh?: number
  networkFill?: number
  data?: number
  shardDrop?: number
  researchXp?: number
}

export const HIVE_RESEARCH_BRANCHES: {
  id: HiveResearchBranch
  name: string
  blurb: string
}[] = [
  { id: 'material', name: 'Material', blurb: 'Salvage and Foundry.' },
  { id: 'energy', name: 'Energy', blurb: 'Damage, shield, Heat.' },
  { id: 'observation', name: 'Observation', blurb: 'Network, shards, notes.' },
]

export const HIVE_RESEARCH_NODES: Record<HiveResearchBranch, HiveResearchNodeDef[]> = {
  material: [
    { name: 'Slag Assay', blurb: 'More salvage from wrecks.', salvage: 0.08 },
    { name: 'Loom Timing', blurb: 'Foundry crafts run faster.', foundrySpeed: 0.06 },
    { name: 'Ingot Yield', blurb: 'Still more salvage.', salvage: 0.08 },
    { name: 'Filament Draw', blurb: 'Foundry again.', foundrySpeed: 0.06 },
    { name: 'Stockpile', blurb: 'Salvage ceiling for the sitting.', salvage: 0.12 },
    { name: 'Keel Stock', blurb: 'Late salvage from wrecks.', salvage: 0.1 },
    { name: 'Slag Temper', blurb: 'Foundry crafts run faster.', foundrySpeed: 0.08 },
    { name: 'Hold Assay', blurb: 'Salvage from every wreck.', salvage: 0.1 },
  ],
  energy: [
    { name: 'Charge Lattice', blurb: 'Sortie damage.', damage: 0.06 },
    { name: 'Pulse Coupling', blurb: 'More damage.', damage: 0.06 },
    { name: 'Ash Kindling', blurb: 'More Heat from Choir-ash.', heatFromAsh: 0.2 },
    { name: 'Ward Current', blurb: 'Max shield.', shield: 0.06 },
    { name: 'Overdraw', blurb: 'Peak damage.', damage: 0.1 },
    { name: 'Plate Current', blurb: 'Late max shield.', shield: 0.08 },
    { name: 'Heat Channel', blurb: 'Ash banks hotter.', heatFromAsh: 0.15 },
    { name: 'Brace Current', blurb: 'Late max shield.', shield: 0.08 },
  ],
  observation: [
    { name: 'Corps Sync', blurb: 'Network bars fill faster.', networkFill: 0.08 },
    { name: 'Archive Gain', blurb: 'Archive data rate.', data: 0.1 },
    { name: 'Shard Sight', blurb: 'Reliquary drop chance.', shardDrop: 0.04 },
    { name: 'Field Notes', blurb: 'All research XP.', researchXp: 0.08 },
    { name: 'Deep Watch', blurb: 'Network fill again.', networkFill: 0.1 },
    { name: 'Log Keep', blurb: 'All research XP.', researchXp: 0.1 },
    { name: 'Chip Sweep', blurb: 'Reliquary drop chance.', shardDrop: 0.05 },
    { name: 'Bar Sync', blurb: 'Network bars fill faster.', networkFill: 0.08 },
  ],
}

export function createEmptyHiveResearchState(): HiveResearchState {
  return {
    focus: 'material',
    xp: { material: 0, energy: 0, observation: 0 },
    completed: { material: 0, energy: 0, observation: 0 },
  }
}

export function hiveResearchNodeCost(index: number, state?: GameState): number {
  const mult = state ? protocolModifiers(state).researchCostMult : 1
  return Math.max(1, Math.floor(50 * Math.pow(2, Math.max(0, index)) * mult))
}

export function hiveResearchCompleted(state: GameState, branch: HiveResearchBranch): number {
  const n = state.hiveResearch?.completed[branch] ?? 0
  return Math.max(0, Math.min(HIVE_RESEARCH_NODES_PER_BRANCH, Math.floor(n)))
}

export function hiveResearchXp(state: GameState, branch: HiveResearchBranch): number {
  return Math.max(0, state.hiveResearch?.xp[branch] ?? 0)
}

/** XP on hand plus the cost of already-bought nodes — for run summaries. */
export function hiveResearchBanked(state: GameState): number {
  let total = 0
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    total += hiveResearchXp(state, branch.id)
    const done = hiveResearchCompleted(state, branch.id)
    for (let i = 0; i < done; i++) total += hiveResearchNodeCost(i, state)
  }
  return total
}

interface HiveBonuses {
  salvage: number
  foundrySpeed: number
  damage: number
  shield: number
  heatFromAsh: number
  networkFill: number
  data: number
  shardDrop: number
  researchXp: number
}

function emptyHiveBonuses(): HiveBonuses {
  return {
    salvage: 0,
    foundrySpeed: 0,
    damage: 0,
    shield: 0,
    heatFromAsh: 0,
    networkFill: 0,
    data: 0,
    shardDrop: 0,
    researchXp: 0,
  }
}

function addNode(out: HiveBonuses, node: HiveResearchNodeDef): void {
  out.salvage += node.salvage ?? 0
  out.foundrySpeed += node.foundrySpeed ?? 0
  out.damage += node.damage ?? 0
  out.shield += node.shield ?? 0
  out.heatFromAsh += node.heatFromAsh ?? 0
  out.networkFill += node.networkFill ?? 0
  out.data += node.data ?? 0
  out.shardDrop += node.shardDrop ?? 0
  out.researchXp += node.researchXp ?? 0
}

export function hiveResearchBonuses(state: GameState): HiveBonuses {
  const out = emptyHiveBonuses()
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const done = hiveResearchCompleted(state, branch.id)
    const nodes = HIVE_RESEARCH_NODES[branch.id]
    for (let i = 0; i < done; i++) {
      const node = nodes[i]
      if (node) addNode(out, node)
    }
  }
  return out
}

export function hiveResearchDamageMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).damage
}

export function hiveResearchShieldMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).shield
}

export function hiveResearchSalvageMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).salvage
}

export function hiveResearchFoundrySpeedMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).foundrySpeed
}

export function hiveResearchNetworkMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).networkFill
}

export function hiveResearchDataMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).data
}

export function hiveResearchShardDropBonus(state: GameState): number {
  return hiveResearchBonuses(state).shardDrop
}

export function hiveResearchXpMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).researchXp
}

export function hiveResearchHeatFromAshMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).heatFromAsh
}

export function killResearchXp(state: GameState, isBoss: boolean): number {
  if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return 0
  const sector = Math.max(1, state.combat.sector)
  const route = routeResearchMult(normalizeRoute(state.combat.route))
  return (1 + 0.12 * (sector - 1)) * (isBoss ? 2.5 : 1) * route
}

function tryCompleteNodes(state: GameState, branch: HiveResearchBranch): void {
  if (!state.hiveResearch) state.hiveResearch = createEmptyHiveResearchState()
  const nodes = HIVE_RESEARCH_NODES[branch]
  while (hiveResearchCompleted(state, branch) < nodes.length) {
    const idx = hiveResearchCompleted(state, branch)
    const need = hiveResearchNodeCost(idx, state)
    if ((state.hiveResearch.xp[branch] ?? 0) < need) break
    state.hiveResearch.xp[branch] = (state.hiveResearch.xp[branch] ?? 0) - need
    state.hiveResearch.completed[branch] = idx + 1
  }
}

export function grantHiveResearchKillXp(state: GameState, isBoss: boolean): number {
  const base = killResearchXp(state, isBoss)
  if (base <= 0) return 0
  if (!state.hiveResearch) state.hiveResearch = createEmptyHiveResearchState()
  const focus = state.hiveResearch.focus
  const lab =
    furnaceResearchXpMult(state) *
    reliquaryResearchXpMult(state) *
    hiveResearchXpMult(state) *
    echoResearchXpMult(state) *
    processResearchSpeedMult(state) *
    foundryResearchXpMult(state)
  let granted = 0
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const focusMult = branch.id === focus ? HIVE_RESEARCH_FOCUS_MULT : 1
    const gain = base * focusMult * lab
    state.hiveResearch.xp[branch.id] = (state.hiveResearch.xp[branch.id] ?? 0) + gain
    granted += gain
    tryCompleteNodes(state, branch.id)
  }
  return granted
}

export function setResearchFocus(state: GameState, branch: HiveResearchBranch): GameState {
  if (!HIVE_RESEARCH_BRANCHES.some((b) => b.id === branch)) return state
  if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return state
  if (state.hiveResearch?.focus === branch) return state
  const next = structuredClone(state)
  if (!next.hiveResearch) next.hiveResearch = createEmptyHiveResearchState()
  next.hiveResearch.focus = branch
  return next
}
