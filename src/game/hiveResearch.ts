/** Hive Research — kill-fed branches with incremental nodes and breakthroughs. */

import type { GameState, HiveResearchBranch, HiveResearchState, NetworkBarId, ReliquaryColor } from './types'
import { careerHighestSector } from './progression'
import { normalizeRoute, routeResearchMult } from './sectors'
import { echoResearchXpMult } from './echo'
import { processResearchSpeedMult } from './process'
import { protocolModifiers } from './protocols'
import { foundryResearchXpMult } from './foundryBonuses'

export const HIVE_RESEARCH_UNLOCK_SECTOR = 7
export const HIVE_RESEARCH_FOCUS_MULT = 4
export const HIVE_RESEARCH_NODES_PER_BRANCH = 9
export const RESEARCH_QUEUE_BASE = 3
export const RESEARCH_PREVIEW = 3

export type HiveResearchNodeKind = 'incremental' | 'breakthrough'

export interface HiveResearchNodeDef {
  name: string
  blurb: string
  kind: HiveResearchNodeKind
  salvage?: number
  foundrySpeed?: number
  damage?: number
  shield?: number
  heatFromAsh?: number
  networkFill?: number
  data?: number
  shardDrop?: number
  researchXp?: number
  furnaceSlots?: number
  foundrySlots?: number
  foundryFitSlots?: number
  foundryMasteryReduce?: number
  foundryInfiniteReduce?: number
  droneEfficiency?: number
  extraUtilitySlots?: number
  offFocusAdd?: number
  researchQueueSlots?: number
  protocolXp?: number
  unlockRelay?: NetworkBarId
  unlockReliquary?: ReliquaryColor
}

export const HIVE_RESEARCH_BRANCHES: {
  id: HiveResearchBranch
  name: string
  blurb: string
}[] = [
  {
    id: 'material',
    name: 'Material',
    blurb: 'Foundry, salvage, crafts, and construction. Pick this to grow the shop floor.',
  },
  {
    id: 'energy',
    name: 'Energy',
    blurb: 'Furnace channels, Network throughput, and plate. Pick this to power more systems at once.',
  },
  {
    id: 'observation',
    name: 'Observation',
    blurb: 'Reliquary, notes, and the research desk. Pick this for information, shards, and automation depth.',
  },
]

export const HIVE_RESEARCH_NODES: Record<HiveResearchBranch, HiveResearchNodeDef[]> = {
  material: [
    { name: 'Slag Assay', blurb: 'A little more salvage from wrecks.', kind: 'incremental', salvage: 0.03 },
    { name: 'Loom Timing', blurb: 'Foundry crafts run a little faster.', kind: 'incremental', foundrySpeed: 0.03 },
    {
      name: 'Second Smelter Bay',
      blurb: 'Adds a Foundry smelter. The floor can run another recipe at once.',
      kind: 'breakthrough',
      foundrySlots: 1,
    },
    { name: 'Ingot Yield', blurb: 'A little more salvage.', kind: 'incremental', salvage: 0.03 },
    { name: 'Filament Draw', blurb: 'Foundry crafts run a little faster.', kind: 'incremental', foundrySpeed: 0.04 },
    {
      name: 'Pattern Floor',
      blurb: 'Recipe mastery gates open one rank sooner. Advanced stock comes online earlier.',
      kind: 'breakthrough',
      foundryMasteryReduce: 1,
    },
    { name: 'Stockpile', blurb: 'A little more salvage from wrecks.', kind: 'incremental', salvage: 0.04 },
    { name: 'Slag Temper', blurb: 'Foundry crafts run a little faster.', kind: 'incremental', foundrySpeed: 0.04 },
    {
      name: 'Keel Bay',
      blurb: 'One extra utility Core slot on the hull, and old Foundry recipes solve two ranks sooner.',
      kind: 'breakthrough',
      extraUtilitySlots: 1,
      foundryInfiniteReduce: 2,
    },
  ],
  energy: [
    { name: 'Ward Current', blurb: 'A little more max shield.', kind: 'incremental', shield: 0.03 },
    { name: 'Ash Kindling', blurb: 'Choir-ash makes a little more Heat.', kind: 'incremental', heatFromAsh: 0.08 },
    {
      name: 'Extra Tap',
      blurb: 'Lights one more Furnace channel at once.',
      kind: 'breakthrough',
      furnaceSlots: 1,
    },
    { name: 'Pulse Coupling', blurb: 'Network bars fill a little faster.', kind: 'incremental', networkFill: 0.04 },
    { name: 'Charge Lattice', blurb: 'A little more sortie damage.', kind: 'incremental', damage: 0.03 },
    {
      name: 'Corps Draw',
      blurb: 'Each assigned drone counts for more toward Network fill.',
      kind: 'breakthrough',
      droneEfficiency: 0.12,
    },
    { name: 'Plate Current', blurb: 'A little more max shield.', kind: 'incremental', shield: 0.04 },
    { name: 'Heat Channel', blurb: 'Ash banks a little hotter.', kind: 'incremental', heatFromAsh: 0.1 },
    {
      name: 'Relay Sight',
      blurb: 'Opens Strike Relay early, and lights one more Furnace channel.',
      kind: 'breakthrough',
      unlockRelay: 'strike-relay',
      furnaceSlots: 1,
    },
  ],
  observation: [
    { name: 'Archive Gain', blurb: 'Archive drips a little more Data.', kind: 'incremental', data: 0.05 },
    { name: 'Shard Sight', blurb: 'Wrecks drop shards a little more often.', kind: 'incremental', shardDrop: 0.02 },
    {
      name: 'Second Desk',
      blurb: 'Unfocused branches crawl faster. Background notes keep moving while you focus elsewhere.',
      kind: 'breakthrough',
      offFocusAdd: 0.5,
    },
    { name: 'Field Notes', blurb: 'All research XP climbs a little faster.', kind: 'incremental', researchXp: 0.04 },
    { name: 'Corps Sync', blurb: 'Network bars fill a little faster.', kind: 'incremental', networkFill: 0.04 },
    {
      name: 'Blue Bay',
      blurb: 'Opens the blue Reliquary slot. A new colour of chip can be fitted.',
      kind: 'breakthrough',
      unlockReliquary: 'blue',
    },
    { name: 'Log Keep', blurb: 'All research XP climbs a little faster.', kind: 'incremental', researchXp: 0.05 },
    { name: 'Chip Sweep', blurb: 'Wrecks drop shards a little more often.', kind: 'incremental', shardDrop: 0.02 },
    {
      name: 'Queue Hall',
      blurb: 'Research Queue holds three more branches. Active Protocols grant a little extra Research XP.',
      kind: 'breakthrough',
      researchQueueSlots: 3,
      protocolXp: 0.15,
    },
  ],
}

export function createEmptyHiveResearchState(): HiveResearchState {
  return {
    focus: 'material',
    xp: { material: 0, energy: 0, observation: 0 },
    completed: { material: 0, energy: 0, observation: 0 },
  }
}

function nodeCostBump(index: number): number {
  return isResearchBreakthroughIndex(index) ? 1.3 : 1
}

export function hiveResearchNodeCost(index: number, state?: GameState): number {
  const mult = state ? protocolModifiers(state).researchCostMult : 1
  const raw = 52 * Math.pow(1.5, Math.max(0, index))
  return Math.max(1, Math.floor(raw * nodeCostBump(index) * mult))
}

export function isResearchBreakthroughIndex(index: number): boolean {
  return index === 2 || index === 5 || index === 8
}

export function isResearchBreakthrough(node: HiveResearchNodeDef): boolean {
  return node.kind === 'breakthrough'
}

export function hiveResearchCompleted(state: GameState, branch: HiveResearchBranch): number {
  const cap = HIVE_RESEARCH_NODES[branch]?.length ?? HIVE_RESEARCH_NODES_PER_BRANCH
  const n = state.hiveResearch?.completed[branch] ?? 0
  return Math.max(0, Math.min(cap, Math.floor(n)))
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
  furnaceSlots: number
  foundrySlots: number
  foundryFitSlots: number
  foundryMasteryReduce: number
  foundryInfiniteReduce: number
  droneEfficiency: number
  extraUtilitySlots: number
  offFocusAdd: number
  researchQueueSlots: number
  protocolXp: number
  unlockRelays: NetworkBarId[]
  unlockReliquary: ReliquaryColor[]
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
    furnaceSlots: 0,
    foundrySlots: 0,
    foundryFitSlots: 0,
    foundryMasteryReduce: 0,
    foundryInfiniteReduce: 0,
    droneEfficiency: 0,
    extraUtilitySlots: 0,
    offFocusAdd: 0,
    researchQueueSlots: 0,
    protocolXp: 0,
    unlockRelays: [],
    unlockReliquary: [],
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
  out.furnaceSlots += node.furnaceSlots ?? 0
  out.foundrySlots += node.foundrySlots ?? 0
  out.foundryFitSlots += node.foundryFitSlots ?? 0
  out.foundryMasteryReduce += node.foundryMasteryReduce ?? 0
  out.foundryInfiniteReduce += node.foundryInfiniteReduce ?? 0
  out.droneEfficiency += node.droneEfficiency ?? 0
  out.extraUtilitySlots += node.extraUtilitySlots ?? 0
  out.offFocusAdd += node.offFocusAdd ?? 0
  out.researchQueueSlots += node.researchQueueSlots ?? 0
  out.protocolXp += node.protocolXp ?? 0
  if (node.unlockRelay && !out.unlockRelays.includes(node.unlockRelay)) {
    out.unlockRelays.push(node.unlockRelay)
  }
  if (node.unlockReliquary && !out.unlockReliquary.includes(node.unlockReliquary)) {
    out.unlockReliquary.push(node.unlockReliquary)
  }
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

export function hiveResearchFurnaceSlots(state: GameState): number {
  return hiveResearchBonuses(state).furnaceSlots
}

export function hiveResearchFoundrySlots(state: GameState): number {
  return hiveResearchBonuses(state).foundrySlots
}

export function hiveResearchFitSlots(state: GameState): number {
  return hiveResearchBonuses(state).foundryFitSlots
}

export function hiveResearchMasteryReduce(state: GameState): number {
  return hiveResearchBonuses(state).foundryMasteryReduce
}

export function hiveResearchInfiniteReduce(state: GameState): number {
  return hiveResearchBonuses(state).foundryInfiniteReduce
}

export function hiveResearchDroneEffMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).droneEfficiency
}

export function hiveResearchOffFocusMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).offFocusAdd
}

export function hiveResearchQueueCap(state: GameState): number {
  return RESEARCH_QUEUE_BASE + hiveResearchBonuses(state).researchQueueSlots
}

export function hiveResearchProtocolXpMult(state: GameState): number {
  if (!state.protocols?.activeId) return 1
  return 1 + hiveResearchBonuses(state).protocolXp
}

export function hiveResearchUnlocksRelay(state: GameState, id: NetworkBarId): boolean {
  return hiveResearchBonuses(state).unlockRelays.includes(id)
}

export function hiveResearchUnlocksReliquary(state: GameState, color: ReliquaryColor): boolean {
  return hiveResearchBonuses(state).unlockReliquary.includes(color)
}

export function hiveResearchExtraUtilitySlots(state: GameState): number {
  return hiveResearchBonuses(state).extraUtilitySlots
}

export function hiveResearchUpcoming(
  state: GameState,
  branch: HiveResearchBranch,
  count = RESEARCH_PREVIEW,
): { index: number; node: HiveResearchNodeDef }[] {
  const nodes = HIVE_RESEARCH_NODES[branch]
  const done = hiveResearchCompleted(state, branch)
  const out: { index: number; node: HiveResearchNodeDef }[] = []
  for (let i = done; i < nodes.length && out.length < count; i++) {
    const node = nodes[i]
    if (node) out.push({ index: i, node })
  }
  return out
}

export function hiveResearchNextBreakthrough(
  state: GameState,
  branch: HiveResearchBranch,
): { index: number; node: HiveResearchNodeDef } | null {
  const nodes = HIVE_RESEARCH_NODES[branch]
  const done = hiveResearchCompleted(state, branch)
  for (let i = done; i < nodes.length; i++) {
    const node = nodes[i]
    if (node && isResearchBreakthrough(node)) return { index: i, node }
  }
  return null
}

export function hiveResearchApproachingBreakthrough(state: GameState): boolean {
  if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return false
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const done = hiveResearchCompleted(state, branch.id)
    const next = HIVE_RESEARCH_NODES[branch.id][done]
    if (next && isResearchBreakthrough(next)) return true
  }
  return false
}

export function hiveResearchNodeEffectLine(node: HiveResearchNodeDef): string {
  if (node.foundrySlots) return 'Adds a Foundry smelter.'
  if (node.furnaceSlots) {
    return node.unlockRelay
      ? 'Opens Strike Relay and lights another Furnace channel.'
      : 'Lights one more Furnace channel at once.'
  }
  if (node.foundryMasteryReduce) return 'Recipe mastery gates open sooner.'
  if (node.extraUtilitySlots) return 'One extra utility Core slot on the hull. Old recipes solve sooner.'
  if (node.foundryFitSlots) return 'One extra fitted Foundry bit.'
  if (node.droneEfficiency) return 'Assigned drones fill Network bars harder.'
  if (node.offFocusAdd) return 'Unfocused branches crawl faster.'
  if (node.unlockReliquary) return 'Opens the blue Reliquary slot.'
  if (node.researchQueueSlots) return 'Deeper Research Queue. Active Protocols grant extra Research XP.'
  const bits: string[] = []
  if (node.salvage) bits.push(`+${Math.round(node.salvage * 100)}% salvage`)
  if (node.foundrySpeed) bits.push(`+${Math.round(node.foundrySpeed * 100)}% craft speed`)
  if (node.damage) bits.push(`+${Math.round(node.damage * 100)}% damage`)
  if (node.shield) bits.push(`+${Math.round(node.shield * 100)}% shield`)
  if (node.heatFromAsh) bits.push(`+${Math.round(node.heatFromAsh * 100)}% Heat from ash`)
  if (node.networkFill) bits.push(`+${Math.round(node.networkFill * 100)}% Network fill`)
  if (node.data) bits.push(`+${Math.round(node.data * 100)}% Archive data`)
  if (node.shardDrop) bits.push(`+${Math.round(node.shardDrop * 100)}% shard drops`)
  if (node.researchXp) bits.push(`+${Math.round(node.researchXp * 100)}% research XP`)
  return bits.join(' · ') || node.blurb
}

export function killResearchXp(state: GameState, isBoss: boolean): number {
  if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return 0
  const sector = Math.max(1, state.combat.sector)
  const route = routeResearchMult(normalizeRoute(state.combat.route))
  return (0.58 + 0.085 * (sector - 1)) * (isBoss ? 2.5 : 1) * route
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

/**
 * `labExtra` is Furnace × Reliquary research XP (applied at the combat call site
 * so this file does not import those systems).
 */
export function grantHiveResearchKillXp(state: GameState, isBoss: boolean, labExtra = 1): number {
  const base = killResearchXp(state, isBoss)
  if (base <= 0) return 0
  if (!state.hiveResearch) state.hiveResearch = createEmptyHiveResearchState()
  const focus = state.hiveResearch.focus
  const offFocus = hiveResearchOffFocusMult(state)
  const lab =
    Math.max(0.1, labExtra) *
    hiveResearchXpMult(state) *
    echoResearchXpMult(state) *
    processResearchSpeedMult(state) *
    foundryResearchXpMult(state) *
    hiveResearchProtocolXpMult(state)
  let granted = 0
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    const focusMult = branch.id === focus ? HIVE_RESEARCH_FOCUS_MULT : offFocus
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
