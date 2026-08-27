/**
 * Relic effect providers.
 *
 * Canonical names Standard vs Behavioural families but does not author exact
 * magnitudes or combat behaviours. Providers exist so later PRs can fill
 * authored values without scattering `if (relicId === ...)` through combat.
 *
 * All Act 1 family effects are currently pending.
 */

import type { GameState } from './types'
import { getRelicFamily, type RelicFamilyId, type RelicTier } from './relicCatalogue'
import { coreSocketRelics, getRelicInstance } from './relics'
import { isRelicEffectDisabledByChallenge } from './relicSources'

export interface CoreRelicModifiers {
  damageMult: number
  slewMult: number
  ballisticOutputMult: number
  durabilityMult: number
  industrialMult: number
  universalMult: number
}

const IDENTITY: CoreRelicModifiers = {
  damageMult: 1,
  slewMult: 1,
  ballisticOutputMult: 1,
  durabilityMult: 1,
  industrialMult: 1,
  universalMult: 1,
}

export interface BehaviouralRelicContext {
  state: GameState
  coreInstanceId: string
  moduleId: string
  familyId: RelicFamilyId
  tier: RelicTier
  relicId: string
}

export type BehaviouralRelicHandler = (ctx: BehaviouralRelicContext) => void

const behaviouralHandlers = new Map<RelicFamilyId, BehaviouralRelicHandler>()

/** Tests / later PRs may register an authored handler. Production has none. */
export function registerBehaviouralRelicHandler(familyId: RelicFamilyId, handler: BehaviouralRelicHandler | null): void {
  if (!handler) behaviouralHandlers.delete(familyId)
  else behaviouralHandlers.set(familyId, handler)
}

export function fittedRelicsOnCore(state: GameState, coreInstanceId: string) {
  return coreSocketRelics(state, coreInstanceId).flatMap((id) => {
    if (!id) return []
    const instance = getRelicInstance(state, id)
    if (!instance) return []
    const def = getRelicFamily(instance.familyId)
    if (!def) return []
    if (isRelicEffectDisabledByChallenge(state, instance.familyId as RelicFamilyId)) return []
    return [{ instance, def }]
  })
}

/**
 * Per-physical-Core Standard modifier aggregation.
 * Returns identity while family effects remain unauthored.
 */
export function coreRelicModifiers(state: GameState, coreInstanceId: string): CoreRelicModifiers {
  const fitted = fittedRelicsOnCore(state, coreInstanceId)
  if (fitted.length === 0) return IDENTITY
  // No authored Standard magnitudes exist. Do not invent percentages.
  return { ...IDENTITY }
}

export function runBehaviouralRelicHooks(
  state: GameState,
  coreInstanceId: string,
  moduleId: string,
): void {
  for (const { instance, def } of fittedRelicsOnCore(state, coreInstanceId)) {
    if (def.kind !== 'behavioural') continue
    const handler = behaviouralHandlers.get(def.id)
    handler?.({
      state,
      coreInstanceId,
      moduleId,
      familyId: def.id,
      tier: instance.tier,
      relicId: instance.id,
    })
  }
}

/**
 * Resonance Tap future Furnace-facing provider. Returns null until authored
 * and must not be wired into legacy Furnace.
 */
export function resonanceTapFurnaceEffect(
  _state: GameState,
  _coreInstanceId: string,
): null {
  return null
}

export function coreHasBehaviouralRelic(state: GameState, coreInstanceId: string, familyId: RelicFamilyId): boolean {
  return fittedRelicsOnCore(state, coreInstanceId).some(
    (row) => row.def.kind === 'behavioural' && row.def.id === familyId,
  )
}
