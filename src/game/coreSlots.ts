/**
 * Universal Core-slot architecture.
 *
 * All Frame slots are untyped. Role tags never decide legality.
 * Normal account bus: 2 → 3 (early) → 4 (mid) → 5 (late Engineering/Foundry).
 * Swarm is the only Act 1 Frame with +1 relative capacity, capped at 6.
 */

import { careerBestWave } from './progression'
import { equippedFrame, getFrame, STARTER_FRAME_ID, SWARM_FRAME_ID } from './catalog'
import type { CoreSlotGrant, GameState } from './types'

export type { CoreSlotGrant, CoreSlotGrantSource } from './types'

/** Starter bus. Canonical W1. */
export const STARTER_ACCOUNT_CORE_SLOTS = 2
/** Early third position. Canonical timeline W75. */
export const EARLY_ACCOUNT_CORE_SLOT_WAVE = 75
/** Mid fourth position. Canonical timeline ~W330. */
export const MID_ACCOUNT_CORE_SLOT_WAVE = 330
/** Normal Frames never exceed this. Swarm may reach 6. */
export const NORMAL_ACCOUNT_CORE_SLOT_CAP = 5
export const SWARM_CORE_SLOT_CAP = 6

export function accountCoreSlotGrants(
  state: Pick<GameState, 'meta' | 'combat'>,
): CoreSlotGrant[] {
  const grants: CoreSlotGrant[] = [
    { id: 'starter-bus', source: 'starter', slots: STARTER_ACCOUNT_CORE_SLOTS },
  ]
  const best = careerBestWave(state)
  if (best >= EARLY_ACCOUNT_CORE_SLOT_WAVE) {
    grants.push({ id: 'early-bus', source: 'early-bus', slots: 1 })
  }
  if (best >= MID_ACCOUNT_CORE_SLOT_WAVE) {
    grants.push({ id: 'mid-bus', source: 'mid-bus', slots: 1 })
  }
  for (const grant of state.meta.coreSlotGrants ?? []) {
    if (!grant || typeof grant.id !== 'string') continue
    const slots = Math.max(0, Math.floor(grant.slots ?? 0))
    if (slots <= 0) continue
    if (grants.some((row) => row.id === grant.id)) continue
    grants.push({ id: grant.id, source: grant.source ?? 'test', slots })
  }
  return grants
}

/** Normal account bus before Frame modifiers. Capped at 5. */
export function normalAccountCoreSlots(state: Pick<GameState, 'meta' | 'combat'>): number {
  const total = accountCoreSlotGrants(state).reduce((sum, grant) => sum + grant.slots, 0)
  return Math.max(STARTER_ACCOUNT_CORE_SLOTS, Math.min(NORMAL_ACCOUNT_CORE_SLOT_CAP, total))
}

export function isSwarmFrame(frameId: string | undefined | null): boolean {
  return frameId === SWARM_FRAME_ID
}

/**
 * Authoritative usable Core positions for the equipped Frame.
 * Swarm: min(6, normal + 1). Every other Act 1 Frame: the normal bus.
 */
export function usableCoreSlots(
  state: Pick<GameState, 'meta' | 'combat' | 'shipyard'>,
  frameId = state.shipyard.frameId,
): number {
  const normal = normalAccountCoreSlots(state)
  if (isSwarmFrame(frameId ?? STARTER_FRAME_ID)) {
    return Math.min(SWARM_CORE_SLOT_CAP, normal + 1)
  }
  return normal
}

export function grantAccountCoreSlots(
  state: GameState,
  grant: CoreSlotGrant,
): GameState {
  const slots = Math.max(0, Math.floor(grant.slots))
  if (slots <= 0) return state
  const existing = state.meta.coreSlotGrants ?? []
  if (existing.some((row) => row.id === grant.id)) return state
  const next = structuredClone(state)
  next.meta.coreSlotGrants = [...existing, { ...grant, slots }]
  return next
}

export function canFitCoreInUniversalSlot(
  state: Pick<GameState, 'meta' | 'combat' | 'shipyard'>,
  fittedCount: number,
  frameId = state.shipyard.frameId,
): boolean {
  return fittedCount < usableCoreSlots(state, frameId)
}

export function trimModulesToUsableSlots(
  state: Pick<GameState, 'meta' | 'combat' | 'shipyard'>,
  moduleIds: string[],
  frameId = state.shipyard.frameId,
): string[] {
  const cap = usableCoreSlots(state, frameId)
  return moduleIds.filter((id) => Boolean(id)).slice(0, cap)
}

export function frameSlotSummary(state: Pick<GameState, 'meta' | 'combat' | 'shipyard'>): string {
  const usable = usableCoreSlots(state)
  const frame = getFrame(state.shipyard.frameId) ?? equippedFrame(state as GameState)
  if (isSwarmFrame(frame.id)) {
    return `${usable} universal Core positions (Swarm +1, cap ${SWARM_CORE_SLOT_CAP})`
  }
  return `${usable} universal Core positions`
}
