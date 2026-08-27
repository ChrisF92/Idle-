/**
 * Act 1 Relics — physical inventory, sockets, fitting, Tier transformation.
 *
 * Replacement for the legacy Reliquary / Shard / colour-slot system.
 */

import type { GameState, RelicInstance, RelicSocketClass, RelicSocketSpec, RelicState } from './types'
import { getModule, moduleMasteryRank } from './catalog'
import { masteryMilestonesFor, matureSocketLayout } from './coreMastery'
import { resolveCoreInstance } from './coreInstances'
import { noteSystemAction } from './playtest'
import { isSystemUnlocked } from './progression'
import {
  getRelicFamily,
  isRelicFamilyId,
  isValidRelicTier,
  RELIC_SOCKET_LABELS,
  relicFamilyName,
  relicTierLabel,
  type RelicFamilyId,
  type RelicKind,
  type RelicTier,
} from './relicCatalogue'
import { canUpgradeRelicToTier2, canUpgradeRelicToTier3 } from './relicSources'

export {
  BEHAVIOURAL_RELIC_IDS,
  CHALLENGE_RELIC_SOURCES,
  getRelicFamily,
  isRelicFamilyId,
  RELIC_FAMILIES,
  RELIC_FAMILY_IDS,
  RELIC_SOCKET_CLASSES,
  RELIC_SOCKET_LABELS,
  STANDARD_RELIC_IDS,
  relicFamilyName,
  relicTierLabel,
  type RelicFamilyDef,
  type RelicFamilyId,
  type RelicKind,
  type RelicTier,
} from './relicCatalogue'

export { canUpgradeRelicToTier2, canUpgradeRelicToTier3 } from './relicSources'

export function createEmptyRelicState(): RelicState {
  return { instances: [], nextSerial: {}, coreFits: {} }
}

export function relicState(state: GameState): RelicState {
  if (!state.relics) state.relics = createEmptyRelicState()
  if (!Array.isArray(state.relics.instances)) state.relics.instances = []
  if (!state.relics.nextSerial) state.relics.nextSerial = {}
  if (!state.relics.coreFits) state.relics.coreFits = {}
  return state.relics
}

export function isRelicsUnlocked(state: GameState): boolean {
  return isSystemUnlocked(state, 'reliquary')
}

export function getRelicInstance(state: GameState, id: string): RelicInstance | undefined {
  return relicState(state).instances.find((row) => row.id === id)
}

export function relicInstancesOfFamily(state: GameState, familyId: RelicFamilyId): RelicInstance[] {
  return relicState(state).instances.filter((row) => row.familyId === familyId)
}

export function relicFamilyOwnedCount(state: GameState, familyId: RelicFamilyId): number {
  return relicInstancesOfFamily(state, familyId).length
}

export function physicalRelicOwned(state: GameState, familyId: string): boolean {
  if (!isRelicFamilyId(familyId)) return false
  return relicFamilyOwnedCount(state, familyId) > 0
}

function nextRelicId(state: GameState, familyId: RelicFamilyId): string {
  const relics = relicState(state)
  const used = new Set(relics.instances.map((row) => row.id))
  let serial = Math.max(1, Math.floor(Number(relics.nextSerial[familyId] ?? 1) || 1))
  while (used.has(`${familyId}:${serial}`)) serial += 1
  relics.nextSerial[familyId] = serial + 1
  return `${familyId}:${serial}`
}

/** Creates exactly one physical Relic. Does not fit it. */
export function addRelicInstance(
  state: GameState,
  familyId: RelicFamilyId,
  tier: RelicTier = 1,
): RelicInstance | null {
  if (!getRelicFamily(familyId) || !isValidRelicTier(tier)) return null
  const relics = relicState(state)
  const instance: RelicInstance = {
    id: nextRelicId(state, familyId),
    familyId,
    tier,
  }
  relics.instances.push(instance)
  return instance
}

export function transformRelicTier(state: GameState, instanceId: string, toTier: RelicTier): boolean {
  const instance = getRelicInstance(state, instanceId)
  if (!instance) return false
  if (!isValidRelicTier(toTier)) return false
  if (toTier !== instance.tier + 1) return false
  instance.tier = toTier
  return true
}

export function fittedRelicIds(state: GameState): string[] {
  const ids: string[] = []
  for (const slots of Object.values(relicState(state).coreFits)) {
    if (!Array.isArray(slots)) continue
    for (const id of slots) if (id) ids.push(id)
  }
  return ids
}

export function relicFitLocation(
  state: GameState,
  relicId: string,
): { coreInstanceId: string; socketIndex: number } | null {
  for (const [coreInstanceId, slots] of Object.entries(relicState(state).coreFits)) {
    if (!Array.isArray(slots)) continue
    const socketIndex = slots.findIndex((id) => id === relicId)
    if (socketIndex >= 0) return { coreInstanceId, socketIndex }
  }
  return null
}

export function isRelicFitted(state: GameState, relicId: string): boolean {
  return relicFitLocation(state, relicId) != null
}

export function coreSocketRelics(state: GameState, coreIdOrModuleId: string): Array<string | null> {
  const instance = resolveCoreInstance(state, coreIdOrModuleId)
  const key = instance?.id ?? coreIdOrModuleId
  const raw = relicState(state).coreFits[key]
  return Array.isArray(raw) ? [...raw] : []
}

export function coreRelicId(state: GameState, coreIdOrModuleId: string): string | null {
  return coreSocketRelics(state, coreIdOrModuleId).find((id) => typeof id === 'string' && id.length > 0) ?? null
}

export interface CoreSocketView {
  index: number
  spec: RelicSocketSpec
  active: boolean
  unlock: 'relic-system' | 'mastery-20' | 'pending'
  unlockLabel: string
}

function socketSpecLabel(spec: RelicSocketSpec): string {
  const primary = RELIC_SOCKET_LABELS[spec.type]
  if (spec.alt) return `${primary}/${RELIC_SOCKET_LABELS[spec.alt]}`
  return primary
}

export function matureLayoutLine(moduleId: string): string {
  return matureSocketLayout(moduleId).map(socketSpecLabel).join(' → ')
}

/**
 * Runtime sockets for one physical Core.
 *
 * - Position 0 uses the authored first mature type once Relics are unlocked.
 * - M20 `socket-expand` activates the matching later position.
 * - Remaining positions stay pending. Slash-notation Universal is mature
 *   metadata only unless the authored expand type is already Universal.
 */
export function coreSocketViews(state: GameState, coreIdOrModuleId: string): CoreSocketView[] {
  const instance = resolveCoreInstance(state, coreIdOrModuleId)
  const moduleId = instance?.moduleId ?? coreIdOrModuleId
  const mature = matureSocketLayout(moduleId)
  const expand = masteryMilestonesFor(moduleId).find(
    (ms) => ms.level === 20 && ms.effect === 'socket-expand' && ms.socket,
  )
  const mastery = moduleMasteryRank(state, moduleId)
  const unlocked = isRelicsUnlocked(state) && Boolean(instance)

  return mature.map((spec, index) => {
    if (index === 0) {
      return {
        index,
        spec: { type: spec.type },
        active: unlocked,
        unlock: 'relic-system',
        unlockLabel: unlocked ? 'Active' : 'Relic system locked',
      }
    }
    if (expand?.socket && spec.type === expand.socket && index === 1) {
      const active = unlocked && mastery >= 20
      return {
        index,
        spec: { type: expand.socket },
        active,
        unlock: 'mastery-20',
        unlockLabel: active ? 'Active · M20' : 'Unlocks at Mastery 20',
      }
    }
    return {
      index,
      spec,
      active: false,
      unlock: 'pending',
      unlockLabel: 'Socket milestone pending design',
    }
  })
}

export function activeCoreSockets(state: GameState, coreIdOrModuleId: string): RelicSocketSpec[] {
  return coreSocketViews(state, coreIdOrModuleId)
    .filter((row) => row.active)
    .map((row) => row.spec)
}

export function coreSocketLayout(state: GameState, coreIdOrModuleId: string): RelicSocketClass[] {
  return activeCoreSockets(state, coreIdOrModuleId).map((spec) => spec.type)
}

export function corePrimarySocket(moduleId: string): RelicSocketClass {
  return matureSocketLayout(moduleId)[0]?.type ?? 'power'
}

/**
 * Universal is a SOCKET type. A Relic with class `universal` fits Universal
 * sockets (or a socket whose authored type is Universal). It does not fit
 * every typed socket.
 */
export function relicFitsSocket(relicClass: RelicSocketClass, socket: RelicSocketSpec | RelicSocketClass): boolean {
  const spec: RelicSocketSpec = typeof socket === 'string' ? { type: socket } : socket
  if (spec.type === 'universal' || spec.alt === 'universal') return true
  return spec.type === relicClass || spec.alt === relicClass
}

export function socketAcceptsRelic(spec: RelicSocketSpec | RelicSocketClass, familyId: string): boolean {
  const def = getRelicFamily(familyId)
  if (!def) return false
  return relicFitsSocket(def.socket, spec)
}

function padFits(slots: Array<string | null>, count: number): Array<string | null> {
  const next = slots.slice(0, Math.max(slots.length, count))
  while (next.length < count) next.push(null)
  return next
}

function behaviouralFittedOnCore(state: GameState, coreInstanceId: string, ignoreRelicId?: string): number {
  let count = 0
  for (const id of coreSocketRelics(state, coreInstanceId)) {
    if (!id || id === ignoreRelicId) continue
    if (getRelicFamily(getRelicInstance(state, id)?.familyId ?? '')?.kind === 'behavioural') count += 1
  }
  return count
}

export type RelicFitRejectReason =
  | 'not-docked'
  | 'relics-locked'
  | 'missing-core'
  | 'missing-relic'
  | 'socket-locked'
  | 'socket-mismatch'
  | 'already-fitted'
  | 'behavioural-limit'

export function canFitRelic(
  state: GameState,
  coreIdOrModuleId: string,
  relicId: string,
  socketIndex: number,
): { ok: boolean; reason?: RelicFitRejectReason } {
  if (!state.combat.docked) return { ok: false, reason: 'not-docked' }
  if (!isRelicsUnlocked(state)) return { ok: false, reason: 'relics-locked' }
  const core = resolveCoreInstance(state, coreIdOrModuleId)
  if (!core) return { ok: false, reason: 'missing-core' }
  const relic = getRelicInstance(state, relicId)
  if (!relic) return { ok: false, reason: 'missing-relic' }
  const def = getRelicFamily(relic.familyId)
  if (!def) return { ok: false, reason: 'missing-relic' }
  const views = coreSocketViews(state, core.id)
  const socket = views[socketIndex]
  if (!socket?.active) return { ok: false, reason: 'socket-locked' }
  if (!relicFitsSocket(def.socket, socket.spec)) return { ok: false, reason: 'socket-mismatch' }
  const elsewhere = relicFitLocation(state, relicId)
  if (elsewhere && (elsewhere.coreInstanceId !== core.id || elsewhere.socketIndex !== socketIndex)) {
    return { ok: false, reason: 'already-fitted' }
  }
  const current = coreSocketRelics(state, core.id)[socketIndex] ?? null
  if (def.kind === 'behavioural' && behaviouralFittedOnCore(state, core.id, current ?? undefined) >= 1) {
    return { ok: false, reason: 'behavioural-limit' }
  }
  return { ok: true }
}

export function relicFitBlockReason(reason: RelicFitRejectReason | undefined): string {
  switch (reason) {
    case 'not-docked':
      return 'Fitting is free only while Docked.'
    case 'relics-locked':
      return 'Relic system is not unlocked.'
    case 'missing-core':
      return 'That physical Core does not exist.'
    case 'missing-relic':
      return 'That physical Relic does not exist.'
    case 'socket-locked':
      return 'This socket is not active yet.'
    case 'socket-mismatch':
      return 'Socket class does not accept this Relic.'
    case 'already-fitted':
      return 'This Relic is already fitted elsewhere.'
    case 'behavioural-limit':
      return 'A physical Core may fit only one Behavioural Relic.'
    default:
      return 'Cannot fit this Relic.'
  }
}

export function equipRelicOnCore(
  state: GameState,
  coreIdOrModuleId: string,
  relicId: string,
  socketIndex?: number,
): GameState {
  const core = resolveCoreInstance(state, coreIdOrModuleId)
  if (!core) return state
  const views = coreSocketViews(state, core.id)
  const def = getRelicFamily(getRelicInstance(state, relicId)?.familyId ?? '')
  let index = socketIndex
  if (index == null) {
    index = views.findIndex(
      (row, i) =>
        row.active &&
        !coreSocketRelics(state, core.id)[i] &&
        def &&
        relicFitsSocket(def.socket, row.spec),
    )
  }
  if (index == null || index < 0) return state
  const check = canFitRelic(state, core.id, relicId, index)
  if (!check.ok) return state
  const next = structuredClone(state)
  const relics = relicState(next)
  const layoutCount = Math.max(views.length, index + 1)
  const slots = padFits(coreSocketRelics(next, core.id), layoutCount)
  slots[index] = relicId
  relics.coreFits[core.id] = slots
  if (core.id !== coreIdOrModuleId) delete relics.coreFits[coreIdOrModuleId]
  noteSystemAction(next, 'reliquary')
  return next
}

export function removeRelicFromCore(
  state: GameState,
  coreIdOrModuleId: string,
  socketIndex?: number,
): GameState {
  if (!state.combat.docked) return state
  const core = resolveCoreInstance(state, coreIdOrModuleId)
  if (!core) return state
  const slots = coreSocketRelics(state, core.id)
  let index = socketIndex
  if (index == null) {
    index = -1
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i]) {
        index = i
        break
      }
    }
  }
  const fitted = index >= 0 ? slots[index] : null
  if (!fitted) return state
  const next = structuredClone(state)
  const copy = padFits(coreSocketRelics(next, core.id), index + 1)
  copy[index] = null
  relicState(next).coreFits[core.id] = copy
  return next
}

export function unfittedRelicInstances(state: GameState): RelicInstance[] {
  const fitted = new Set(fittedRelicIds(state))
  return relicState(state).instances.filter((row) => !fitted.has(row.id))
}

export function eligibleRelicsForSocket(
  state: GameState,
  coreInstanceId: string,
  socketIndex: number,
): RelicInstance[] {
  const socket = coreSocketViews(state, coreInstanceId)[socketIndex]
  if (!socket?.active) return []
  const fittedHere = coreSocketRelics(state, coreInstanceId)[socketIndex] ?? null
  return unfittedRelicInstances(state).filter((row) => {
    if (row.id === fittedHere) return false
    const def = getRelicFamily(row.familyId)
    if (!def) return false
    if (!relicFitsSocket(def.socket, socket.spec)) return false
    if (def.kind === 'behavioural' && behaviouralFittedOnCore(state, coreInstanceId, fittedHere ?? undefined) >= 1) {
      return false
    }
    return true
  })
}

export function relicKindOf(state: GameState, relicOrFamilyId: string): RelicKind | null {
  const instance = getRelicInstance(state, relicOrFamilyId)
  const familyId = instance?.familyId ?? (isRelicFamilyId(relicOrFamilyId) ? relicOrFamilyId : null)
  if (!familyId) return null
  return getRelicFamily(familyId)?.kind ?? null
}

export function inspectRelicEffectText(familyId: string): string {
  const def = getRelicFamily(familyId)
  if (!def) return 'Unknown Relic.'
  if (def.effectStatus === 'pending') {
    return `${def.effectBlurb} Effect detail pending design.`
  }
  return def.effectBlurb
}

export interface RelicInventoryRow {
  id: string
  familyId: RelicFamilyId
  name: string
  kind: RelicKind
  socket: RelicSocketClass
  tier: RelicTier
  fitted: boolean
  fittedCoreId: string | null
  fittedCoreName: string | null
  effectText: string
  effectPending: boolean
}

export function relicInventoryRows(state: GameState): RelicInventoryRow[] {
  return relicState(state).instances.map((row) => {
    const def = getRelicFamily(row.familyId)
    const loc = relicFitLocation(state, row.id)
    const core = loc ? resolveCoreInstance(state, loc.coreInstanceId) : null
    return {
      id: row.id,
      familyId: row.familyId,
      name: def?.name ?? row.familyId,
      kind: def?.kind ?? 'standard',
      socket: def?.socket ?? 'industrial',
      tier: row.tier,
      fitted: Boolean(loc),
      fittedCoreId: loc?.coreInstanceId ?? null,
      fittedCoreName: core ? getModule(core.moduleId)?.name ?? core.moduleId : null,
      effectText: inspectRelicEffectText(row.familyId),
      effectPending: def?.effectStatus !== 'authored',
    }
  })
}

export function canStartRelicUpgrade(
  state: GameState,
  instanceId: string,
): { ok: boolean; reason?: string; toTier?: 2 | 3 } {
  if (!state.combat.docked) return { ok: false, reason: 'Upgrade Relics while Docked.' }
  if (!isRelicsUnlocked(state)) return { ok: false, reason: 'Relic system is not unlocked.' }
  const instance = getRelicInstance(state, instanceId)
  if (!instance) return { ok: false, reason: 'That physical Relic does not exist.' }
  if (instance.tier >= 3) return { ok: false, reason: 'Tier III cannot upgrade further.' }
  const toTier = (instance.tier + 1) as 2 | 3
  if (toTier === 2 && !canUpgradeRelicToTier2(state)) {
    return { ok: false, reason: 'Requires Relic Tempering (Industrial Science Research — PR9).' }
  }
  if (toTier === 3 && !canUpgradeRelicToTier3(state)) {
    return { ok: false, reason: 'Requires Masterwork Tempering (Industrial Science Research — PR9).' }
  }
  const busy = (state.foundry?.fabrication ?? []).some(
    (slot) =>
      slot.kind === 'relic' &&
      (slot.targetRelicId === instanceId || (slot.jobId != null && slot.jobId.includes(instanceId))),
  )
  if (busy) return { ok: false, reason: 'This Relic is already in the Foundry.' }
  return { ok: true, toTier }
}

/**
 * Sanitize current-version Relic state. Invalid fits are dropped; Relic
 * instances are never destroyed by a bad fit.
 */
export function sanitizeRelicState(state: GameState): void {
  const relics = relicState(state)
  const seen = new Set<string>()
  const instances: RelicInstance[] = []
  for (const raw of relics.instances) {
    if (!raw || typeof raw !== 'object') continue
    if (typeof raw.id !== 'string' || raw.id.length < 1) continue
    if (!isRelicFamilyId(raw.familyId)) continue
    if (!isValidRelicTier(raw.tier)) continue
    if (seen.has(raw.id)) continue
    seen.add(raw.id)
    instances.push({ id: raw.id, familyId: raw.familyId, tier: raw.tier })
  }
  relics.instances = instances

  const serial: RelicState['nextSerial'] = {}
  for (const row of instances) {
    const n = Number(row.id.slice(row.familyId.length + 1))
    if (Number.isFinite(n)) serial[row.familyId] = Math.max(serial[row.familyId] ?? 1, Math.floor(n) + 1)
  }
  for (const [familyId, n] of Object.entries(relics.nextSerial ?? {})) {
    if (!isRelicFamilyId(familyId)) continue
    serial[familyId] = Math.max(serial[familyId] ?? 1, Math.max(1, Math.floor(Number(n) || 1)))
  }
  relics.nextSerial = serial

  const coreIds = new Set((state.shipyard.coreInstances ?? []).map((row) => row.id))
  const relicIds = new Set(instances.map((row) => row.id))
  const usedRelics = new Set<string>()
  const nextFits: RelicState['coreFits'] = {}

  for (const [coreId, slots] of Object.entries(relics.coreFits ?? {})) {
    if (!coreIds.has(coreId) || !Array.isArray(slots)) continue
    const views = coreSocketViews(state, coreId)
    const cleaned: Array<string | null> = views.map(() => null)
    let behavioural = 0
    for (let i = 0; i < slots.length; i += 1) {
      const id = slots[i]
      if (typeof id !== 'string' || id.length < 1) continue
      if (!relicIds.has(id) || usedRelics.has(id)) continue
      const socket = views[i]
      if (!socket?.active) continue
      const instance = instances.find((row) => row.id === id)
      const def = instance ? getRelicFamily(instance.familyId) : undefined
      if (!def || !relicFitsSocket(def.socket, socket.spec)) continue
      if (def.kind === 'behavioural') {
        if (behavioural >= 1) continue
        behavioural += 1
      }
      cleaned[i] = id
      usedRelics.add(id)
    }
    nextFits[coreId] = cleaned
  }
  relics.coreFits = nextFits
}
