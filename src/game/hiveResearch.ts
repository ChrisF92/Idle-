/** Hive Research — one timed project at a time. Progress persists across Rebuild. */

import type { GameState, HiveResearchBranch, HiveResearchState, NetworkBarId, ReliquaryColor } from './types'
import { careerBestWave, isSystemUnlocked, meetsWave } from './progression'
import { processResearchSpeedMult } from './process'
import { protocolModifiers } from './protocols'
import { foundryResearchXpMult } from './foundryBonuses'
import { recordPlaytest, noteSystemAction } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { stationEffectiveDrones } from './catalog'

export const HIVE_RESEARCH_UNLOCK_SECTOR = ACT1_CADENCE.research
/** @deprecated GDD uses one active project, not a focus multiplier. */
export const HIVE_RESEARCH_FOCUS_MULT = 1
export const HIVE_RESEARCH_NODES_PER_BRANCH = 9
export const RESEARCH_QUEUE_BASE = 3
/** Show only the next project so the mature tree stays hidden (GDD §138). */
export const RESEARCH_PREVIEW = 1
export const RESEARCH_INCREMENTAL_S = 8 * 60
export const RESEARCH_BREAKTHROUGH_S = 20 * 60
/** Each Sensor Net drone adds this much research speed. */
export const HIVE_RESEARCH_WORKER_ACCEL = 0.25

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
    id: 'energy',
    name: 'Hive Engineering',
    blurb: 'Frames, hull, Workshop, and Core capacity.',
  },
  {
    id: 'observation',
    name: 'Drone Systems',
    blurb: 'Worker efficiency, targeting, and combat analytics.',
  },
  {
    id: 'material',
    name: 'Industrial Science',
    blurb: 'Foundry, fabrication, and production capacity.',
  },
  {
    id: 'computation',
    name: 'Computational Systems',
    blurb: 'Process, automation, analytics, and smart controls.',
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
      blurb: 'Opens Archive Relay ahead of its normal gate, and lights one more Furnace channel.',
      kind: 'breakthrough',
      unlockRelay: 'archive-relay',
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
      blurb: 'Research Queue holds three more branches. Active Challenges grant a little extra Research XP.',
      kind: 'breakthrough',
      researchQueueSlots: 3,
      protocolXp: 0.15,
    },
  ],
  computation: [
    { name: 'Loop Notes', blurb: 'Research crawls a little faster.', kind: 'incremental', researchXp: 0.04 },
    { name: 'Idle Watch', blurb: 'Assigned drones fill jobs a little harder.', kind: 'incremental', droneEfficiency: 0.04 },
    {
      name: 'Queue Desk',
      blurb: 'The Research Queue holds one more branch.',
      kind: 'breakthrough',
      researchQueueSlots: 1,
    },
    { name: 'Sortie Log', blurb: 'Active Challenges grant a little extra Research speed.', kind: 'incremental', protocolXp: 0.05 },
    { name: 'Ash Audit', blurb: 'A little more salvage from wrecks.', kind: 'incremental', salvage: 0.03 },
    {
      name: 'Background Slot',
      blurb: 'Unfocused branches crawl faster while another project is active.',
      kind: 'breakthrough',
      offFocusAdd: 0.25,
    },
    { name: 'Worker Brief', blurb: 'Assigned drones fill jobs a little harder.', kind: 'incremental', droneEfficiency: 0.05 },
    { name: 'Craft Clock', blurb: 'Foundry crafts run a little faster.', kind: 'incremental', foundrySpeed: 0.03 },
    {
      name: 'Auto Desk',
      blurb: 'Deeper Research Queue. Process can keep more branches in motion.',
      kind: 'breakthrough',
      researchQueueSlots: 2,
      researchXp: 0.06,
    },
  ],
}

export function createEmptyHiveResearchState(): HiveResearchState {
  const xp = {} as Record<HiveResearchBranch, number>
  const completed = {} as Record<HiveResearchBranch, number>
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    xp[branch.id] = 0
    completed[branch.id] = 0
  }
  return { focus: 'energy', active: false, xp, completed }
}

export function hiveResearchComputationUnlocked(state: GameState): boolean {
  return meetsWave(state, ACT1_CADENCE.mastery) && isSystemUnlocked(state, 'process')
}

export function hiveResearchBranchUnlocked(state: GameState, branch: HiveResearchBranch): boolean {
  if (branch === 'computation') return hiveResearchComputationUnlocked(state)
  return careerBestWave(state) >= HIVE_RESEARCH_UNLOCK_SECTOR
}

export function hiveResearchStartableBranches(state: GameState): HiveResearchBranch[] {
  return HIVE_RESEARCH_BRANCHES.filter((branch) => hiveResearchBranchUnlocked(state, branch.id)).map(
    (branch) => branch.id,
  )
}

export function hiveResearchNodeCost(index: number, state?: GameState): number {
  const mult = state ? protocolModifiers(state).researchCostMult : 1
  const base = isResearchBreakthroughIndex(index) ? RESEARCH_BREAKTHROUGH_S : RESEARCH_INCREMENTAL_S
  const raw = base * Math.pow(1.25, Math.max(0, index))
  return Math.max(1, Math.floor(raw * mult))
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
  const late = meetsWave(state, ACT1_CADENCE.mastery) ? 1 : 0
  return hiveResearchBonuses(state).extraUtilitySlots + late
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
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return false
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
      ? 'Opens Archive Relay and lights another Furnace channel.'
      : 'Lights one more Furnace channel at once.'
  }
  if (node.foundryMasteryReduce) return 'Recipe mastery gates open sooner.'
  if (node.extraUtilitySlots) return 'One extra utility Core slot on the hull. Old recipes solve sooner.'
  if (node.foundryFitSlots) return 'One extra fitted Foundry bit.'
  if (node.droneEfficiency) return 'Assigned drones fill jobs harder.'
  if (node.offFocusAdd) return 'Background research crawls faster while another project is active.'
  if (node.unlockReliquary) return 'Opens the blue Reliquary slot.'
  if (node.researchQueueSlots) return 'Deeper Research Queue. Active Challenges grant extra Research speed.'
  if (node.protocolXp) return 'Active Challenges grant extra Research speed.'
  const bits: string[] = []
  if (node.salvage) bits.push(`+${Math.round(node.salvage * 100)}% salvage`)
  if (node.foundrySpeed) bits.push(`+${Math.round(node.foundrySpeed * 100)}% craft speed`)
  if (node.damage) bits.push(`+${Math.round(node.damage * 100)}% damage`)
  if (node.shield) bits.push(`+${Math.round(node.shield * 100)}% shield`)
  if (node.heatFromAsh) bits.push(`+${Math.round(node.heatFromAsh * 100)}% Heat from ash`)
  if (node.networkFill) bits.push(`+${Math.round(node.networkFill * 100)}% Network fill`)
  if (node.data) bits.push(`+${Math.round(node.data * 100)}% Archive data`)
  if (node.shardDrop) bits.push(`+${Math.round(node.shardDrop * 100)}% shard drops`)
  if (node.researchXp) bits.push(`+${Math.round(node.researchXp * 100)}% research speed`)
  return bits.join(' · ') || node.blurb
}

export function hiveResearchSpeed(state: GameState): number {
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return 0
  const drones = stationEffectiveDrones(state, 'sensor-net')
  return (
    (1 + HIVE_RESEARCH_WORKER_ACCEL * drones) *
    hiveResearchXpMult(state) *
    processResearchSpeedMult(state) *
    foundryResearchXpMult(state) *
    hiveResearchProtocolXpMult(state)
  )
}

export function hiveResearchActive(state: GameState): boolean {
  return Boolean(state.hiveResearch?.active)
}

export function hiveResearchActiveNode(state: GameState): HiveResearchNodeDef | null {
  if (!hiveResearchActive(state)) return null
  const branch = state.hiveResearch?.focus ?? 'energy'
  const done = hiveResearchCompleted(state, branch)
  return HIVE_RESEARCH_NODES[branch][done] ?? null
}

export function formatResearchDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return mm > 0 ? `${h}h ${mm}m` : `${h}h`
  }
  if (m <= 0) return `${r}s`
  return r > 0 ? `${m}m ${r}s` : `${m}m`
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
    const node = nodes[idx]
    if (node?.kind === 'breakthrough') {
      recordPlaytest(state, 'research_break', { n: node.name, v: branch })
    }
    noteSystemAction(state, 'research')
    state.hiveResearch.active = false
  }
}

export function tickResearch(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return
  if (!state.hiveResearch?.active) return
  const branch = state.hiveResearch.focus
  if (!hiveResearchBranchUnlocked(state, branch)) {
    state.hiveResearch.active = false
    return
  }
  const nodes = HIVE_RESEARCH_NODES[branch]
  if (hiveResearchCompleted(state, branch) >= nodes.length) {
    state.hiveResearch.active = false
    return
  }
  const speed = hiveResearchSpeed(state)
  if (speed <= 0) return
  state.hiveResearch.xp[branch] = (state.hiveResearch.xp[branch] ?? 0) + dtSeconds * speed
  tryCompleteNodes(state, branch)
}

/** Combat no longer feeds every branch. Research ticks on time instead. */
export function grantHiveResearchKillXp(
  _state: GameState,
  _isBoss: boolean,
  _labExtra = 1,
): number {
  return 0
}

export function setResearchFocus(state: GameState, branch: HiveResearchBranch): GameState {
  if (!HIVE_RESEARCH_BRANCHES.some((b) => b.id === branch)) return state
  if (!hiveResearchBranchUnlocked(state, branch)) return state
  if (hiveResearchCompleted(state, branch) >= HIVE_RESEARCH_NODES[branch].length) return state
  if (state.hiveResearch?.focus === branch && state.hiveResearch.active) return state
  const next = structuredClone(state)
  if (!next.hiveResearch) next.hiveResearch = createEmptyHiveResearchState()
  next.hiveResearch.focus = branch
  next.hiveResearch.active = true
  noteSystemAction(next, 'research')
  return next
}
