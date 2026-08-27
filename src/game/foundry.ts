/** Foundry — Processing, Fabrication, Material Mastery, infrastructure. */

import type {
  FabricationSlot,
  FacilityId,
  FabJobKind,
  FoundryMaterialId,
  FoundrySlot,
  FoundryState,
  GameState,
} from './types'
import { foundryThroughputMult } from './matter'
import { noteSystemAction, recordPlaytest } from './playtest'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'
import { grantUnlockedFrame } from './catalog'
import { addCoreInstance } from './coreInstances'
import { ownedWorkers, workerCapacity, workerJobContribution } from './workers'
import {
  canTrackBlueprint,
  discoverBlueprint,
  getBlueprint,
  isBlueprintDiscovered,
  physicalProductOwned,
  starterBlueprintIds,
  syncOwnedBlueprintsFromPhysical,
  tryCompleteAuthoredMasterySources,
} from './blueprints'
import {
  CORE_FABRICATION_RECIPES,
  FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY,
  FOUNDRY_CAPABILITY_ADVANCED_PROCESSING,
  FOUNDRY_FACILITIES,
  FOUNDRY_INFRASTRUCTURE_IDS,
  FOUNDRY_MATERIAL_IDS,
  FOUNDRY_MATERIAL_NAMES,
  FOUNDRY_RECIPES,
  FRAME_FABRICATION_RECIPES,
  WORKER_FABRICATION_RECIPE,
  getFabricationRecipe,
  getFacility,
  getFoundryRecipe,
  grantFoundryCapability,
  hasFoundryCapability,
  isFoundryCapabilityId,
  isFoundryMaterialId,
  scaleFabricationCost,
  type FoundryCapabilityId,
  type FoundryCost,
  type FoundryRecipeDef,
} from './foundryCatalogue'
import {
  MATERIAL_MASTERY_MAX_RANK,
  MATERIAL_MASTERY_XP_CUMULATIVE,
  MATERIAL_MASTERY_XP_PER_CYCLE,
  RECOVERY_STORAGE_SALVAGE_OPS_MULT,
  WORKER_SPEED_PER_CONTRIBUTION,
} from './foundrySeeds'

export type { FoundryCost, FoundryRecipeDef }
export {
  CORE_FABRICATION_RECIPES,
  FOUNDRY_FACILITIES,
  FOUNDRY_INFRASTRUCTURE_IDS,
  FOUNDRY_MATERIAL_IDS,
  FOUNDRY_MATERIAL_NAMES,
  FOUNDRY_RECIPES,
  FRAME_FABRICATION_RECIPES,
  WORKER_FABRICATION_RECIPE,
  getFacility,
  getFoundryRecipe,
  getFabricationRecipe,
  grantFoundryCapability,
  hasFoundryCapability,
  isFoundryCapabilityId,
  isFoundryMaterialId,
  scaleFabricationCost,
  type FoundryCapabilityId,
}

export type FoundryPaneId = 'processing' | 'fabrication' | 'mastery' | 'blueprints'

export const FOUNDRY_PANE_LABELS: Record<FoundryPaneId, string> = {
  processing: 'Processing',
  fabrication: 'Fabrication',
  mastery: 'Mastery',
  blueprints: 'Blueprints',
}

export const FOUNDRY_STARTING_SLOTS = 1
export const FOUNDRY_STARTING_FAB_SLOTS = 1
export const FOUNDRY_MAX_SLOTS = 5
export const FOUNDRY_MAX_FAB_SLOTS = 4

function emptySlot(): FoundrySlot {
  return { recipeId: null, progress: 0, paid: false }
}

function emptyFabSlot(): FabricationSlot {
  return { kind: null, jobId: null, progress: 0, paid: false }
}

export function createEmptyFoundryState(): FoundryState {
  return {
    materials: {},
    masteryXp: {},
    slots: [emptySlot()],
    fabrication: [emptyFabSlot()],
    facilities: [],
    fragments: {},
    discovered: [...starterBlueprintIds()],
    capabilities: [],
    trackedPrintId: null,
  }
}

export function isFoundryAvailable(state: GameState): boolean {
  return careerBestWave(state) >= ACT1_CADENCE.foundry
}

export function foundryOwnedCount(state: GameState, id: FacilityId): number {
  return (state.foundry?.facilities ?? []).filter((row) => row === id).length
}

export function foundryFacilityCommitted(state: GameState, id: FacilityId): number {
  const queued = (state.foundry?.fabrication ?? []).filter(
    (slot) => slot.kind === 'facility' && slot.jobId === id,
  ).length
  return foundryOwnedCount(state, id) + queued
}

export function hasFacility(state: GameState, id: FacilityId): boolean {
  return foundryOwnedCount(state, id) > 0
}

export function foundrySlotCount(state: GameState): number {
  const extra = foundryOwnedCount(state, 'processing-line')
  return Math.min(FOUNDRY_MAX_SLOTS, FOUNDRY_STARTING_SLOTS + extra)
}

export function foundryFabSlotCount(state: GameState): number {
  const extra = foundryOwnedCount(state, 'fabrication-bay')
  return Math.min(FOUNDRY_MAX_FAB_SLOTS, FOUNDRY_STARTING_FAB_SLOTS + extra)
}

export function foundryMaterialCount(state: GameState, id: string): number {
  return Math.max(0, state.foundry?.materials[id] ?? 0)
}

export function materialMasteryXp(state: GameState, id: FoundryMaterialId): number {
  return Math.max(0, state.foundry?.masteryXp[id] ?? 0)
}

export function materialMasteryRank(state: GameState, id: FoundryMaterialId): number {
  const xp = materialMasteryXp(state, id)
  let rank = 0
  for (let i = MATERIAL_MASTERY_XP_CUMULATIVE.length - 1; i >= 0; i -= 1) {
    if (xp >= MATERIAL_MASTERY_XP_CUMULATIVE[i]!) {
      rank = i
      break
    }
  }
  return Math.min(MATERIAL_MASTERY_MAX_RANK, rank)
}

export function materialMasteryXpIntoRank(state: GameState, id: FoundryMaterialId): {
  rank: number
  xp: number
  into: number
  need: number
  maxed: boolean
} {
  const rank = materialMasteryRank(state, id)
  const xp = materialMasteryXp(state, id)
  if (rank >= MATERIAL_MASTERY_MAX_RANK) {
    return { rank, xp, into: 0, need: 0, maxed: true }
  }
  const at = MATERIAL_MASTERY_XP_CUMULATIVE[rank]!
  const next = MATERIAL_MASTERY_XP_CUMULATIVE[rank + 1]!
  return { rank, xp, into: xp - at, need: next - at, maxed: false }
}

export function isFoundryRecipeUnlocked(state: GameState, id: FoundryMaterialId): boolean {
  if (!isFoundryAvailable(state)) return false
  const def = getFoundryRecipe(id)
  if (!def || !def.recipeAuthored) return false
  for (const cap of def.capabilities ?? []) {
    if (!hasFoundryCapability(state, cap)) return false
  }
  return true
}

export function foundryRecipeLockReason(state: GameState, id: FoundryMaterialId): string | null {
  const def = getFoundryRecipe(id)
  if (!def) return 'Unknown recipe'
  if (!isFoundryAvailable(state)) return `Reach Wave ${ACT1_CADENCE.foundry}`
  if (!def.recipeAuthored) return 'Deterministic recipe not yet authored'
  for (const cap of def.capabilities ?? []) {
    if (!hasFoundryCapability(state, cap)) {
      if (cap === FOUNDRY_CAPABILITY_ADVANCED_PROCESSING) return 'Requires advanced processing'
      if (cap === FOUNDRY_CAPABILITY_ADVANCED_FOUNDRY) return 'Requires advanced Foundry'
      return `Requires ${cap}`
    }
  }
  return null
}

export function workerJobSpeedMult(state: GameState, jobId: string): number {
  const assigned = Math.max(0, Math.floor(state.base.assignments[jobId] ?? 0))
  return 1 + workerJobContribution(assigned, jobId) * WORKER_SPEED_PER_CONTRIBUTION
}

export function foundryProcessingSpeed(state: GameState): number {
  return foundryThroughputMult(state) * workerJobSpeedMult(state, 'alloy-foundry')
}

export function foundryFabricationSpeed(state: GameState, kind: FabJobKind | null): number {
  const job = kind === 'facility' || kind === 'worker' ? 'construction' : 'fab-bay'
  const workerJob = kind === 'worker' ? 'drone-fab' : job
  return foundryThroughputMult(state) * workerJobSpeedMult(state, workerJob)
}

export function foundryCraftTime(_state: GameState, id: FoundryMaterialId): number {
  return getFoundryRecipe(id)?.craftTime ?? 999
}

export function fabricationJobTime(_state: GameState, kind: FabJobKind, jobId: string): number {
  return getFabricationRecipe(kind, jobId)?.craftTime ?? 0
}

function canPayCost(state: GameState, cost: FoundryCost): boolean {
  if ((cost.salvage ?? 0) > state.resources.salvage) return false
  if ((cost.scrap ?? 0) > state.resources.scrap) return false
  if ((cost.ash ?? 0) > state.resources.choirAsh) return false
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) return false
  }
  return true
}

export function foundryMissingCost(state: GameState, cost: FoundryCost): string | null {
  if ((cost.salvage ?? 0) > state.resources.salvage) return 'Salvage'
  if ((cost.scrap ?? 0) > state.resources.scrap) return 'Scrap'
  if ((cost.ash ?? 0) > state.resources.choirAsh) return 'Ash'
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if ((n ?? 0) > foundryMaterialCount(state, id)) {
      return isFoundryMaterialId(id) ? FOUNDRY_MATERIAL_NAMES[id] : id
    }
  }
  return null
}

function payCost(state: GameState, cost: FoundryCost): void {
  state.resources.salvage -= cost.salvage ?? 0
  state.resources.scrap -= cost.scrap ?? 0
  state.resources.choirAsh -= cost.ash ?? 0
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    if (!n) continue
    state.foundry.materials[id] = Math.max(0, (state.foundry.materials[id] ?? 0) - n)
  }
}

export function formatFoundryCost(cost: FoundryCost): string {
  const bits: string[] = []
  if (cost.salvage) bits.push(`${cost.salvage} salvage`)
  if (cost.scrap) bits.push(`${cost.scrap} scrap`)
  if (cost.ash) bits.push(`${cost.ash} Ash`)
  for (const [id, n] of Object.entries(cost.materials ?? {})) {
    const name = isFoundryMaterialId(id) ? FOUNDRY_MATERIAL_NAMES[id] : id
    bits.push(`${n} ${name}`)
  }
  return bits.join(' · ') || 'free'
}

function grantProcessingOutput(state: GameState, id: FoundryMaterialId): void {
  const def = getFoundryRecipe(id)
  if (!def) return
  state.foundry.materials[id] = (state.foundry.materials[id] ?? 0) + 1
  const xp = materialMasteryXp(state, id)
  const cap = MATERIAL_MASTERY_XP_CUMULATIVE[MATERIAL_MASTERY_MAX_RANK]!
  if (xp < cap) {
    state.foundry.masteryXp[id] = Math.min(cap, xp + MATERIAL_MASTERY_XP_PER_CYCLE)
  }
  tryCompleteAuthoredMasterySources(
    state,
    (materialId) => materialMasteryRank(state, materialId),
    (capability) => hasFoundryCapability(state, capability),
  )
  recordPlaytest(state, 'foundry_craft', { n: def.name, firstKey: `process:${id}` })
  noteSystemAction(state, 'foundry')
}

function ensureSlotCount(state: GameState): void {
  if (!state.foundry.slots) state.foundry.slots = [emptySlot()]
  if (!state.foundry.fabrication) state.foundry.fabrication = [emptyFabSlot()]
  const need = foundrySlotCount(state)
  while (state.foundry.slots.length < need) state.foundry.slots.push(emptySlot())
  const fabNeed = foundryFabSlotCount(state)
  while (state.foundry.fabrication.length < fabNeed) state.foundry.fabrication.push(emptyFabSlot())
}

function pushFoundryLog(state: GameState, line: string): void {
  state.combat.log = [line, ...state.combat.log].slice(0, 40)
}

function coreCopies(state: GameState, moduleId: string): number {
  return (state.shipyard.coreInstances ?? []).filter((row) => row.moduleId === moduleId).length
}

function completeFabrication(state: GameState, slot: FabricationSlot): void {
  if (!slot.kind || !slot.jobId) return
  const recipe = getFabricationRecipe(slot.kind, slot.jobId)
  if (!recipe) return
  if (slot.kind === 'facility') {
    const def = getFacility(slot.jobId)
    if (!def) return
    state.foundry.facilities = [...(state.foundry.facilities ?? []), slot.jobId as FacilityId]
    ensureSlotCount(state)
    pushFoundryLog(state, `${def.name} online.`)
    recordPlaytest(state, 'foundry_craft', { n: def.name, firstKey: `facility:${slot.jobId}` })
    noteSystemAction(state, 'foundry')
    return
  }
  if (slot.kind === 'core') {
    const instance = addCoreInstance(state.shipyard, slot.jobId)
    const bp = getBlueprint(slot.jobId)
    if (bp) discoverBlueprint(state, slot.jobId)
    pushFoundryLog(state, `Fabricated ${bp?.name ?? slot.jobId} (${instance.id}).`)
    recordPlaytest(state, 'foundry_craft', { n: instance.id, firstKey: `core-fab:${instance.id}` })
    noteSystemAction(state, 'foundry')
    return
  }
  if (slot.kind === 'frame') {
    grantUnlockedFrame(state, slot.jobId, `Fabricated the ${getBlueprint(slot.jobId)?.name ?? slot.jobId} Frame.`)
    discoverBlueprint(state, slot.jobId)
    noteSystemAction(state, 'foundry')
    return
  }
  if (slot.kind === 'worker') {
    if (ownedWorkers(state) < workerCapacity(state)) {
      state.base.workerDrones += 1
      state.meta.lifetimeDronesBuilt = (state.meta.lifetimeDronesBuilt ?? 0) + 1
      pushFoundryLog(state, `Worker Drone fabricated. Workers: ${state.base.workerDrones}.`)
    }
    noteSystemAction(state, 'foundry')
    return
  }
}

function clearFabSlot(slot: FabricationSlot): void {
  slot.kind = null
  slot.jobId = null
  slot.progress = 0
  slot.paid = false
}

function tickProcessing(state: GameState, dtSeconds: number): void {
  const budget = Math.max(0, dtSeconds) * foundryProcessingSpeed(state)
  for (const slot of state.foundry.slots) {
    if (!slot.recipeId || !slot.paid) continue
    const time = foundryCraftTime(state, slot.recipeId)
    if (time <= 0) continue
    slot.progress = Math.min(1, slot.progress + budget / time)
    if (slot.progress < 1) continue
    grantProcessingOutput(state, slot.recipeId)
    slot.recipeId = null
    slot.progress = 0
    slot.paid = false
  }
}

function tickFabrication(state: GameState, dtSeconds: number): void {
  for (const slot of state.foundry.fabrication) {
    if (!slot.kind || !slot.jobId || !slot.paid) continue
    if (!getFabricationRecipe(slot.kind, slot.jobId)) {
      clearFabSlot(slot)
      continue
    }
    const time = fabricationJobTime(state, slot.kind, slot.jobId)
    if (time <= 0) continue
    const speed = foundryFabricationSpeed(state, slot.kind)
    slot.progress = Math.min(1, slot.progress + (Math.max(0, dtSeconds) * speed) / time)
    if (slot.progress < 1) continue
    completeFabrication(state, slot)
    clearFabSlot(slot)
  }
}

export function tickFoundry(state: GameState, dtSeconds: number): void {
  if (!state.foundry) state.foundry = createEmptyFoundryState()
  syncOwnedBlueprintsFromPhysical(state)
  state.foundry.capabilities = (state.foundry.capabilities ?? []).filter(isFoundryCapabilityId)
  if (state.foundry.trackedPrintId && !canTrackBlueprint(state, state.foundry.trackedPrintId)) {
    state.foundry.trackedPrintId = null
  }
  ensureSlotCount(state)
  tickProcessing(state, dtSeconds)
  tickFabrication(state, dtSeconds)
}

export function persistFoundryOnRebuild(foundry: FoundryState): FoundryState {
  return structuredClone(foundry)
}

export function idleProcessingSlot(state: GameState): number {
  ensureSlotCount(state)
  return state.foundry.slots.findIndex((slot) => !slot.recipeId)
}

export function idleFabricationSlot(state: GameState): number {
  ensureSlotCount(state)
  return (state.foundry.fabrication ?? []).findIndex((slot) => !slot.kind)
}

export function canStartProcessing(
  state: GameState,
  recipeId: FoundryMaterialId,
): { ok: boolean; reason?: string; cost?: FoundryCost } {
  if (!isFoundryAvailable(state)) return { ok: false, reason: `Reach Wave ${ACT1_CADENCE.foundry}` }
  const lock = foundryRecipeLockReason(state, recipeId)
  if (lock) return { ok: false, reason: lock }
  const def = getFoundryRecipe(recipeId)
  if (!def) return { ok: false, reason: 'Unknown recipe' }
  if (idleProcessingSlot(state) < 0) return { ok: false, reason: 'No free Processor' }
  if (!canPayCost(state, def.costs)) {
    return { ok: false, reason: `Need ${foundryMissingCost(state, def.costs)}`, cost: def.costs }
  }
  return { ok: true, cost: def.costs }
}

export function startProcessing(state: GameState, slotIndex: number, recipeId: FoundryMaterialId | null): GameState {
  if (recipeId === null) return state
  const check = canStartProcessing(state, recipeId)
  if (!check.ok) return state
  const next = structuredClone(state)
  ensureSlotCount(next)
  const slot = next.foundry.slots[slotIndex]
  if (!slot || slot.recipeId) return state
  if (check.cost) payCost(next, check.cost)
  slot.recipeId = recipeId
  slot.progress = 0
  slot.paid = true
  noteSystemAction(next, 'foundry')
  return next
}

/** Start one Processing cycle on the given slot. Does not auto-repeat. */
export function setFoundrySlot(
  state: GameState,
  slotIndex: number,
  recipeId: FoundryMaterialId | null,
): GameState {
  return startProcessing(state, slotIndex, recipeId)
}

function copiesForJob(state: GameState, kind: FabJobKind, jobId: string): number {
  if (kind === 'core') return coreCopies(state, jobId)
  if (kind === 'frame') return (state.shipyard.unlockedFrames ?? []).includes(jobId) ? 1 : 0
  return 0
}

export function canStartFabrication(
  state: GameState,
  kind: FabJobKind,
  jobId: string,
): { ok: boolean; reason?: string; cost?: FoundryCost } {
  if (!isFoundryAvailable(state)) return { ok: false, reason: `Reach Wave ${ACT1_CADENCE.foundry}` }
  if (idleFabricationSlot(state) < 0) return { ok: false, reason: 'No fabrication slot' }
  if (kind === 'relic') return { ok: false, reason: 'Relic fabrication is PR6' }
  if (kind === 'worker') {
    if (!hasFacility(state, 'worker-fabricator')) return { ok: false, reason: 'Build Worker Fabricator' }
    const queued = (state.foundry.fabrication ?? []).filter((slot) => slot.kind === 'worker').length
    if (ownedWorkers(state) + queued >= workerCapacity(state)) {
      return { ok: false, reason: 'Worker capacity full' }
    }
    const recipe = getFabricationRecipe('worker', 'worker')
    if (!recipe) return { ok: false, reason: 'Unknown job' }
    if (!canPayCost(state, recipe.costs)) {
      return { ok: false, reason: `Need ${foundryMissingCost(state, recipe.costs)}`, cost: recipe.costs }
    }
    return { ok: true, cost: recipe.costs }
  }
  if (kind === 'facility') {
    const def = getFacility(jobId)
    if (!def) return { ok: false, reason: 'Unknown facility' }
    const committed =
      foundryOwnedCount(state, def.id) +
      (state.foundry.fabrication ?? []).filter((slot) => slot.kind === 'facility' && slot.jobId === def.id).length
    if (committed >= def.maxOwned) return { ok: false, reason: 'Already built' }
    if (!canPayCost(state, def.costs)) {
      return { ok: false, reason: `Need ${foundryMissingCost(state, def.costs)}`, cost: def.costs }
    }
    return { ok: true, cost: def.costs }
  }
  const recipe = getFabricationRecipe(kind, jobId)
  if (!recipe) return { ok: false, reason: 'Unknown blueprint' }
  const bp = getBlueprint(jobId)
  if (!bp) return { ok: false, reason: 'Unknown blueprint' }
  if (!isBlueprintDiscovered(state, jobId) && !physicalProductOwned(state, bp)) {
    return { ok: false, reason: 'Blueprint not discovered' }
  }
  const cost = scaleFabricationCost(recipe.costs, copiesForJob(state, kind, jobId))
  if (!canPayCost(state, cost)) {
    return { ok: false, reason: `Need ${foundryMissingCost(state, cost)}`, cost }
  }
  return { ok: true, cost }
}

export function startFabrication(state: GameState, kind: FabJobKind, jobId: string): GameState {
  const check = canStartFabrication(state, kind, jobId)
  if (!check.ok) return state
  const next = structuredClone(state)
  ensureSlotCount(next)
  const index = idleFabricationSlot(next)
  const slot = next.foundry.fabrication[index]
  if (!slot) return state
  if (check.cost) payCost(next, check.cost)
  slot.kind = kind
  slot.jobId = jobId
  slot.progress = 0
  slot.paid = true
  noteSystemAction(next, 'foundry')
  return next
}

export function fabricationJobLabel(_state: GameState, slot: FabricationSlot): string {
  if (!slot.kind || !slot.jobId) return 'Idle'
  if (slot.kind === 'worker') return 'Worker Drone'
  const recipe = getFabricationRecipe(slot.kind, slot.jobId)
  return recipe?.name ?? slot.jobId
}

export function foundryRecipeChainLine(recipe: FoundryRecipeDef): string {
  const bits: string[] = []
  if (recipe.costs.scrap) bits.push(`${recipe.costs.scrap} Scrap`)
  if (recipe.costs.ash) bits.push(`${recipe.costs.ash} Ash`)
  for (const [id, n] of Object.entries(recipe.costs.materials ?? {})) {
    bits.push(`${n} ${isFoundryMaterialId(id) ? FOUNDRY_MATERIAL_NAMES[id] : id}`)
  }
  return bits.length ? `${bits.join(' + ')} → ${recipe.name}` : recipe.blurb
}

export function foundryHasMaterialChain(recipe: FoundryRecipeDef): boolean {
  return Object.keys(recipe.costs.materials ?? {}).length > 0
}

/**
 * PR9 extension: Research Annex live effect is unauthored.
 * Do not apply this to legacy hiveResearch in PR5.
 */
export function researchAnnexSpeedMult(_state: GameState): number {
  return 1
}

export function foundrySalvageOpsMult(state: GameState): number {
  return hasFacility(state, 'recovery-storage') ? RECOVERY_STORAGE_SALVAGE_OPS_MULT : 1
}

export function setTrackedPrint(state: GameState, moduleId: string | null): GameState {
  const current = state.foundry.trackedPrintId ?? null
  let nextId: string | null
  if (moduleId == null) {
    nextId = null
  } else if (current === moduleId) {
    nextId = null
  } else if (!canTrackBlueprint(state, moduleId)) {
    return state
  } else {
    nextId = moduleId
  }
  if (current === nextId) return state
  return { ...state, foundry: { ...state.foundry, trackedPrintId: nextId } }
}

export function foundryHasMasteryMilestone(state: GameState): boolean {
  return FOUNDRY_MATERIAL_IDS.some((id) => materialMasteryRank(state, id) >= 1)
}

export function foundryHasChainRecipe(state: GameState): boolean {
  return FOUNDRY_RECIPES.some((r) => isFoundryRecipeUnlocked(state, r.id) && foundryHasMaterialChain(r))
}

