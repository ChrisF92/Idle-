/** Hive Research — branching timed projects. Progress persists across Rebuild. */

import type { GameState, HiveResearchBranch, HiveResearchState, NetworkBarId, ReliquaryColor } from './types'
import { careerBestWave, isSystemUnlocked, meetsWave } from './progression'
import { processResearchSpeedMult } from './process'
import { protocolModifiers } from './protocols'
import { foundryResearchXpMult } from './foundryBonuses'
import { recordPlaytest, noteSystemAction } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { getFrame, grantUnlockedFrame, stationEffectiveDrones } from './catalog'
import {
  getHiveResearchNode,
  HIVE_RESEARCH_NODES,
  LEGACY_RESEARCH_SEQUENCE,
  RESEARCH_BREAKTHROUGH_S,
  RESEARCH_INCREMENTAL_S,
  RESEARCH_TREE,
  resolvedResearchIds,
  type HiveResearchNodeDef,
  type HiveResearchNodeKind,
  type ResearchNodeViewState,
} from './hiveResearchTree'

export {
  getHiveResearchNode,
  HIVE_RESEARCH_NODES,
  LEGACY_RESEARCH_SEQUENCE,
  RESEARCH_BREAKTHROUGH_S,
  RESEARCH_INCREMENTAL_S,
  RESEARCH_TREE,
  resolvedResearchIds,
}
export type { HiveResearchNodeDef, HiveResearchNodeKind, ResearchNodeViewState }

export const HIVE_RESEARCH_UNLOCK_SECTOR = ACT1_CADENCE.research
/** @deprecated GDD uses one active project, not a focus multiplier. */
export const HIVE_RESEARCH_FOCUS_MULT = 1
export const HIVE_RESEARCH_NODES_PER_BRANCH = 7
export const RESEARCH_QUEUE_BASE = 3
/** Show only the next revealed layer so the mature tree stays hidden (GDD §138). */
export const RESEARCH_PREVIEW = 1
/** Each Research Worker adds this much research speed. */
export const HIVE_RESEARCH_WORKER_ACCEL = 0.25

export const HIVE_RESEARCH_BRANCHES: {
  id: HiveResearchBranch
  name: string
  tab: string
  blurb: string
}[] = [
  {
    id: 'energy',
    name: 'Hive Engineering',
    tab: 'Engineering',
    blurb: 'Frames, hull, Workshop, and reclaim.',
  },
  {
    id: 'observation',
    name: 'Drone Systems',
    tab: 'Drones',
    blurb: 'Targeting, Core behaviour, and Worker Drones.',
  },
  {
    id: 'material',
    name: 'Industrial Science',
    tab: 'Industry',
    blurb: 'Foundry, fabrication, and production capacity.',
  },
  {
    id: 'computation',
    name: 'Computational Systems',
    tab: 'Compute',
    blurb: 'Process, analytics, and smart controls.',
  },
]

export function createEmptyHiveResearchState(): HiveResearchState {
  const xp = {} as Record<HiveResearchBranch, number>
  const completed = {} as Record<HiveResearchBranch, number>
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    xp[branch.id] = 0
    completed[branch.id] = 0
  }
  return {
    focus: 'energy',
    active: false,
    activeNodeId: null,
    progress: 0,
    completedIds: [],
    xp,
    completed,
  }
}

export function migrateHiveResearchState(raw: HiveResearchState | undefined): HiveResearchState {
  const empty = createEmptyHiveResearchState()
  if (!raw || typeof raw !== 'object') return empty
  const focus = raw.focus
  empty.focus = HIVE_RESEARCH_BRANCHES.some((b) => b.id === focus) ? focus : 'energy'
  empty.active = raw.active === true
  for (const { id } of HIVE_RESEARCH_BRANCHES) {
    empty.xp[id] = Math.max(0, Number(raw.xp?.[id] ?? 0) || 0)
    empty.completed[id] = Math.max(0, Math.floor(Number(raw.completed?.[id] ?? 0) || 0))
  }

  empty.completedIds = resolvedResearchIds({
    completedIds: Array.isArray(raw.completedIds) ? raw.completedIds : [],
    completed: empty.completed,
  })
  syncCompletedCounts(empty)

  const savedActive = typeof raw.activeNodeId === 'string' ? raw.activeNodeId : null
  empty.activeNodeId =
    savedActive && getHiveResearchNode(savedActive) && !empty.completedIds.includes(savedActive)
      ? savedActive
      : null
  empty.progress = Math.max(0, Number(raw.progress ?? 0) || 0)
  if (empty.active && !empty.activeNodeId) {
    const next = firstAvailableNode({ hiveResearch: empty } as GameState, empty.focus)
    empty.activeNodeId = next?.id ?? null
    if (next) empty.progress = Math.max(empty.progress, empty.xp[empty.focus] ?? 0)
  }
  if (!empty.activeNodeId) {
    empty.active = false
    empty.progress = 0
  }
  return empty
}

function syncCompletedCounts(research: HiveResearchState): void {
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    research.completed[branch.id] = research.completedIds.filter(
      (id) => getHiveResearchNode(id)?.branch === branch.id,
    ).length
  }
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

export function hiveResearchCompletedIds(state: GameState): string[] {
  return resolvedResearchIds(state.hiveResearch)
}

export function hiveResearchHasNode(state: GameState, id: string): boolean {
  return hiveResearchCompletedIds(state).includes(id)
}

export function hiveResearchNodeDuration(node: HiveResearchNodeDef, state?: GameState): number {
  const mult = state ? protocolModifiers(state).researchCostMult : 1
  return Math.max(1, Math.floor(node.duration * mult))
}

/** @deprecated Prefer hiveResearchNodeDuration(node). Index maps onto Hive Engineering layout order. */
export function hiveResearchNodeCost(nodeOrIndex: HiveResearchNodeDef | number, state?: GameState): number {
  if (typeof nodeOrIndex !== 'number') return hiveResearchNodeDuration(nodeOrIndex, state)
  const nodes = HIVE_RESEARCH_NODES.energy
  const node = nodes[nodeOrIndex] ?? nodes[0]
  if (!node) return Math.max(1, Math.floor(RESEARCH_INCREMENTAL_S * Math.pow(1.25, Math.max(0, nodeOrIndex))))
  return hiveResearchNodeDuration(node, state)
}

export function isResearchBreakthroughIndex(index: number): boolean {
  return index === 2 || index === 5 || index === 8
}

export function isResearchBreakthrough(node: HiveResearchNodeDef): boolean {
  return node.kind === 'breakthrough'
}

export function hiveResearchCompleted(state: GameState, branch: HiveResearchBranch): number {
  const cap = HIVE_RESEARCH_NODES[branch]?.length ?? HIVE_RESEARCH_NODES_PER_BRANCH
  const n = hiveResearchCompletedIds(state).filter((id) => getHiveResearchNode(id)?.branch === branch).length
  return Math.max(0, Math.min(cap, n))
}

export function hiveResearchXp(state: GameState, branch: HiveResearchBranch): number {
  if (state.hiveResearch?.focus === branch && state.hiveResearch.active) {
    return Math.max(0, state.hiveResearch.progress ?? 0)
  }
  return Math.max(0, state.hiveResearch?.xp[branch] ?? 0)
}

export function hiveResearchProgress(state: GameState): number {
  return Math.max(0, state.hiveResearch?.progress ?? 0)
}

export function hiveResearchBanked(state: GameState): number {
  let total = hiveResearchProgress(state)
  for (const id of hiveResearchCompletedIds(state)) {
    const node = getHiveResearchNode(id)
    if (node) total += hiveResearchNodeDuration(node, state)
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
  focusFire: boolean
  coreStartLevel: number
  workshopStartRanks: number
  salvageOpsMult: number
  droneCapBonus: number
  workerManufacture: number
  foundryOutput: number
  processCostMult: number
  inspectDetail: boolean
  hubIntel: boolean
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
    focusFire: false,
    coreStartLevel: 0,
    workshopStartRanks: 0,
    salvageOpsMult: 0,
    droneCapBonus: 0,
    workerManufacture: 0,
    foundryOutput: 0,
    processCostMult: 1,
    inspectDetail: false,
    hubIntel: false,
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
  out.coreStartLevel += node.coreStartLevel ?? 0
  out.workshopStartRanks += node.workshopStartRanks ?? 0
  out.salvageOpsMult += node.salvageOpsMult ?? 0
  out.droneCapBonus += node.droneCapBonus ?? 0
  out.workerManufacture += node.workerManufacture ?? 0
  out.foundryOutput += node.foundryOutput ?? 0
  if (node.processCostMult) out.processCostMult *= node.processCostMult
  if (node.inspectDetail) out.inspectDetail = true
  if (node.hubIntel) out.hubIntel = true
  if (node.unlockRelay && !out.unlockRelays.includes(node.unlockRelay)) {
    out.unlockRelays.push(node.unlockRelay)
  }
  if (node.unlockReliquary && !out.unlockReliquary.includes(node.unlockReliquary)) {
    out.unlockReliquary.push(node.unlockReliquary)
  }
  if (node.focusFire) out.focusFire = true
}

export function hiveResearchBonuses(state: GameState): HiveBonuses {
  const out = emptyHiveBonuses()
  for (const id of hiveResearchCompletedIds(state)) {
    const node = getHiveResearchNode(id)
    if (node) addNode(out, node)
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

export function hiveResearchCombatSpeed(state: GameState): number {
  let best = 1
  for (const id of hiveResearchCompletedIds(state)) {
    const speed = getHiveResearchNode(id)?.combatSpeed ?? 1
    if (speed > best) best = speed
  }
  return best
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

export function hiveResearchFocusFire(state: GameState): boolean {
  return hiveResearchBonuses(state).focusFire
}

export function hiveResearchCoreStartLevel(state: GameState): number {
  return hiveResearchBonuses(state).coreStartLevel
}

export function hiveResearchWorkshopStartRanks(state: GameState): number {
  return hiveResearchBonuses(state).workshopStartRanks
}

export function hiveResearchSalvageOpsMult(state: GameState): number {
  return 1 + hiveResearchBonuses(state).salvageOpsMult
}

export function hiveResearchDroneCapBonus(state: GameState): number {
  return hiveResearchBonuses(state).droneCapBonus
}

export function hiveResearchWorkerManufacture(state: GameState): number {
  return hiveResearchBonuses(state).workerManufacture
}

export function hiveResearchFoundryOutput(state: GameState): number {
  return hiveResearchBonuses(state).foundryOutput
}

export function hiveResearchProcessCostMult(state: GameState): number {
  return hiveResearchBonuses(state).processCostMult
}

export function hiveResearchInspectDetail(state: GameState): boolean {
  return hiveResearchBonuses(state).inspectDetail
}

export function hiveResearchHubIntel(state: GameState): boolean {
  return hiveResearchBonuses(state).hubIntel
}

export function hiveResearchPrerequisitesMet(state: GameState, node: HiveResearchNodeDef): boolean {
  return node.prerequisites.every((id) => hiveResearchHasNode(state, id))
}

export function researchNodeViewState(state: GameState, node: HiveResearchNodeDef): ResearchNodeViewState {
  if (hiveResearchHasNode(state, node.id)) return 'completed'
  if (state.hiveResearch?.activeNodeId === node.id && hiveResearchActive(state)) return 'active'
  if (!hiveResearchBranchUnlocked(state, node.branch)) return 'hidden'
  if (hiveResearchPrerequisitesMet(state, node)) return 'available'
  const parentRevealed = node.prerequisites.some(
    (id) => hiveResearchHasNode(state, id) || (state.hiveResearch?.activeNodeId === id && hiveResearchActive(state)),
  )
  return parentRevealed ? 'locked' : 'hidden'
}

export function hiveResearchAvailableNodes(state: GameState, branch?: HiveResearchBranch): HiveResearchNodeDef[] {
  return RESEARCH_TREE.filter((node) => {
    if (branch && node.branch !== branch) return false
    if (!hiveResearchBranchUnlocked(state, node.branch)) return false
    return researchNodeViewState(state, node) === 'available'
  })
}

export function hiveResearchVisibleNodes(state: GameState, branch: HiveResearchBranch): HiveResearchNodeDef[] {
  return HIVE_RESEARCH_NODES[branch].filter((node) => researchNodeViewState(state, node) !== 'hidden')
}

function firstAvailableNode(state: GameState, branch: HiveResearchBranch): HiveResearchNodeDef | null {
  return hiveResearchAvailableNodes(state, branch)[0] ?? null
}

export function hiveResearchUpcoming(
  state: GameState,
  branch: HiveResearchBranch,
  count = RESEARCH_PREVIEW,
): { index: number; node: HiveResearchNodeDef }[] {
  return hiveResearchAvailableNodes(state, branch)
    .slice(0, count)
    .map((node) => ({
      index: HIVE_RESEARCH_NODES[branch].findIndex((row) => row.id === node.id),
      node,
    }))
}

export function hiveResearchNextBreakthrough(
  state: GameState,
  branch: HiveResearchBranch,
): { index: number; node: HiveResearchNodeDef } | null {
  const next = hiveResearchAvailableNodes(state, branch).find((node) => isResearchBreakthrough(node))
    ?? hiveResearchVisibleNodes(state, branch).find(
      (node) => isResearchBreakthrough(node) && !hiveResearchHasNode(state, node.id),
    )
  if (!next) return null
  return { index: HIVE_RESEARCH_NODES[branch].findIndex((row) => row.id === next.id), node: next }
}

export function hiveResearchApproachingBreakthrough(state: GameState): boolean {
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return false
  const active = hiveResearchActiveNode(state)
  if (active && isResearchBreakthrough(active)) return true
  for (const branch of HIVE_RESEARCH_BRANCHES) {
    if (hiveResearchUpcoming(state, branch.id).some((row) => isResearchBreakthrough(row.node))) return true
  }
  return false
}

export function hiveResearchNodeEffectLine(node: HiveResearchNodeDef): string {
  const bits: string[] = []
  if (node.focusFire) bits.push('Cores lock wounded hulls and bosses first')
  if (node.foundrySlots) bits.push(`Foundry Processors +${node.foundrySlots}`)
  if (node.furnaceSlots) bits.push(`Furnace channels +${node.furnaceSlots}`)
  if (node.unlockFrame) bits.push(`Unlocks ${getFrame(node.unlockFrame)?.name ?? node.unlockFrame}`)
  if (node.foundryMasteryReduce) bits.push(`Mastery gates −${node.foundryMasteryReduce} rank`)
  if (node.foundryInfiniteReduce) bits.push(`Mastery gates −${node.foundryInfiniteReduce}`)
  if (node.extraUtilitySlots) bits.push(`Utility Core slots +${node.extraUtilitySlots}`)
  if (node.foundryFitSlots) bits.push(`Fabrication slots +${node.foundryFitSlots}`)
  if (node.droneEfficiency) bits.push(`Worker contribution +${Math.round(node.droneEfficiency * 100)}%`)
  if (node.offFocusAdd) bits.push(`Idle research crawl +${Math.round(node.offFocusAdd * 100)}%`)
  if (node.researchQueueSlots) bits.push(`Research queue +${node.researchQueueSlots}`)
  if (node.protocolXp) bits.push(`Challenge research +${Math.round(node.protocolXp * 100)}%`)
  if (node.unlockReliquary) bits.push(`Opens the ${node.unlockReliquary} Reliquary slot`)
  if (node.coreStartLevel) bits.push(`Cycle Core Level +${node.coreStartLevel}`)
  if (node.workshopStartRanks) bits.push(`Rebuild Workshop ranks +${node.workshopStartRanks}`)
  if (node.salvageOpsMult) bits.push('Salvage Operations haul at 2×')
  if (node.droneCapBonus) bits.push(`Worker Drone capacity +${node.droneCapBonus}`)
  if (node.workerManufacture) bits.push('Worker fabrication runs faster')
  if (node.foundryOutput) bits.push(`Processing output +${node.foundryOutput}/cycle`)
  if (node.processCostMult) bits.push(`Process costs ×${node.processCostMult}`)
  if (node.inspectDetail) bits.push('Inspect shows current → result')
  if (node.hubIntel) bits.push('Systems hub shows remaining time and effect')
  if (node.salvage) bits.push(`+${Math.round(node.salvage * 100)}% salvage`)
  if (node.foundrySpeed) bits.push(`+${Math.round(node.foundrySpeed * 100)}% craft speed`)
  if (node.damage) bits.push(`+${Math.round(node.damage * 100)}% damage`)
  if (node.shield) bits.push(`+${Math.round(node.shield * 100)}% shield`)
  if (node.heatFromAsh) bits.push(`+${Math.round(node.heatFromAsh * 100)}% Heat from ash`)
  if (node.networkFill) bits.push(`+${Math.round(node.networkFill * 100)}% Worker contribution`)
  if (node.data) bits.push(`+${Math.round(node.data * 100)}% research speed`)
  if (node.shardDrop) bits.push(`+${Math.round(node.shardDrop * 100)}% shard drops`)
  if (node.researchXp) bits.push(`+${Math.round(node.researchXp * 100)}% research speed`)
  if (node.combatSpeed && node.combatSpeed > 1) bits.push(`Combat speed ×${node.combatSpeed}`)
  return bits.join(' · ') || node.blurb
}

export function hiveResearchSpeed(state: GameState): number {
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return 0
  const drones = stationEffectiveDrones(state, 'sensor-net') * hiveResearchDroneEffMult(state)
  const labor = 1 + HIVE_RESEARCH_WORKER_ACCEL * drones
  return (
    labor *
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
  if (!state.hiveResearch?.active) return null
  const id = state.hiveResearch.activeNodeId
  if (id) return getHiveResearchNode(id) ?? null
  return firstAvailableNode(state, state.hiveResearch.focus ?? 'energy')
}

export function hiveResearchRemaining(state: GameState): number {
  const node = hiveResearchActiveNode(state)
  if (!node) return 0
  return Math.max(0, hiveResearchNodeDuration(node, state) - hiveResearchProgress(state))
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

function finishNode(state: GameState, node: HiveResearchNodeDef): void {
  if (!state.hiveResearch) state.hiveResearch = createEmptyHiveResearchState()
  if (!state.hiveResearch.completedIds.includes(node.id)) {
    state.hiveResearch.completedIds = [...state.hiveResearch.completedIds, node.id]
  }
  syncCompletedCounts(state.hiveResearch)
  if (node.unlockFrame) {
    const frame = getFrame(node.unlockFrame)
    grantUnlockedFrame(
      state,
      node.unlockFrame,
      frame ? `Research unlocked the ${frame.name}.` : 'Research unlocked a new Frame.',
    )
  }
  if (node.kind === 'breakthrough') {
    recordPlaytest(state, 'research_break', { n: node.name, v: node.branch })
  }
  noteSystemAction(state, 'research')
  state.hiveResearch.active = false
  state.hiveResearch.activeNodeId = null
  state.hiveResearch.progress = 0
  state.hiveResearch.xp[node.branch] = 0
}

export function tickResearch(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return
  if (careerBestWave(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return
  if (!state.hiveResearch) state.hiveResearch = createEmptyHiveResearchState()
  if (!state.hiveResearch.completedIds) {
    Object.assign(state.hiveResearch, migrateHiveResearchState(state.hiveResearch))
  }
  if (!state.hiveResearch.active) return
  const node = hiveResearchActiveNode(state)
  if (!node || !hiveResearchBranchUnlocked(state, node.branch)) {
    state.hiveResearch.active = false
    state.hiveResearch.activeNodeId = null
    return
  }
  const speed = hiveResearchSpeed(state)
  if (speed <= 0) return
  if ((state.hiveResearch.progress ?? 0) <= 0) {
    state.hiveResearch.progress = Math.max(0, state.hiveResearch.xp[node.branch] ?? 0)
  }
  state.hiveResearch.progress = hiveResearchProgress(state) + dtSeconds * speed
  state.hiveResearch.xp[node.branch] = state.hiveResearch.progress
  const need = hiveResearchNodeDuration(node, state)
  if (state.hiveResearch.progress + 1e-6 >= need) finishNode(state, node)
}

/** Combat no longer feeds every branch. Research ticks on time instead. */
export function grantHiveResearchKillXp(
  _state: GameState,
  _isBoss: boolean,
  _labExtra = 1,
): number {
  return 0
}

export function startResearch(state: GameState, nodeId: string): GameState {
  const node = getHiveResearchNode(nodeId)
  if (!node) return state
  if (!hiveResearchBranchUnlocked(state, node.branch)) return state
  if (hiveResearchHasNode(state, nodeId)) return state
  if (!hiveResearchPrerequisitesMet(state, node)) return state
  if (state.hiveResearch?.activeNodeId === nodeId && state.hiveResearch.active) return state
  if (hiveResearchActive(state) && state.hiveResearch?.activeNodeId !== nodeId) return state
  const next = structuredClone(state)
  if (!next.hiveResearch) next.hiveResearch = createEmptyHiveResearchState()
  next.hiveResearch.focus = node.branch
  next.hiveResearch.active = true
  next.hiveResearch.activeNodeId = node.id
  next.hiveResearch.progress = 0
  next.hiveResearch.xp[node.branch] = 0
  noteSystemAction(next, 'research')
  return next
}

export function setResearchFocus(state: GameState, branch: HiveResearchBranch): GameState {
  if (!HIVE_RESEARCH_BRANCHES.some((b) => b.id === branch)) return state
  if (!hiveResearchBranchUnlocked(state, branch)) return state
  const available = firstAvailableNode(state, branch)
  if (!available) return state
  if (state.hiveResearch?.activeNodeId === available.id && state.hiveResearch.active) return state
  if (hiveResearchActive(state) && state.hiveResearch?.focus === branch) return state
  return startResearch(state, available.id)
}
