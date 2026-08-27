/**
 * PR6 Relic source / capability boundaries.
 *
 * PR9 owns Relic Tempering / Masterwork Tempering.
 * PR10 owns Challenge Relic grants.
 * PR7 owns Boss Relic drop tables.
 */

import type { GameState } from './types'
import { CHALLENGE_RELIC_SOURCES, getRelicFamily, type RelicFamilyId } from './relicCatalogue'

export interface RelicTemperCapabilityProvider {
  canUpgradeRelicToTier2(state: GameState): boolean
  canUpgradeRelicToTier3(state: GameState): boolean
}

const DORMANT_TEMPER: RelicTemperCapabilityProvider = {
  canUpgradeRelicToTier2: () => false,
  canUpgradeRelicToTier3: () => false,
}

let temperProvider: RelicTemperCapabilityProvider = DORMANT_TEMPER

/** Test injection. Production stays dormant until PR9 supplies the final Research interface. */
export function setRelicTemperCapabilityProvider(provider: RelicTemperCapabilityProvider | null): void {
  temperProvider = provider ?? DORMANT_TEMPER
}

export function canUpgradeRelicToTier2(state: GameState): boolean {
  return temperProvider.canUpgradeRelicToTier2(state) === true
}

export function canUpgradeRelicToTier3(state: GameState): boolean {
  return temperProvider.canUpgradeRelicToTier3(state) === true
}

export type RelicChallengeRestrictionProvider = (state: GameState, familyId: RelicFamilyId) => boolean

let challengeRestriction: RelicChallengeRestrictionProvider | null = null

/** PR10 may disable specific Relic effects during a Challenge. */
export function setRelicChallengeRestrictionProvider(provider: RelicChallengeRestrictionProvider | null): void {
  challengeRestriction = provider
}

export function isRelicEffectDisabledByChallenge(state: GameState, familyId: RelicFamilyId): boolean {
  return challengeRestriction?.(state, familyId) === true
}

export function relicFamilyForChallenge(challengeId: string): RelicFamilyId | undefined {
  return CHALLENGE_RELIC_SOURCES.find((row) => row.challengeId === challengeId)?.familyId
}

export function challengeIdForRelicFamily(familyId: RelicFamilyId): string | undefined {
  return getRelicFamily(familyId)?.source.challengeId
}

/**
 * PR10 hook: Challenge completion reveals the Relic Blueprint.
 * Does not fabricate a physical Relic.
 */
/** PR10 calls `completeBlueprintFromSource(state, familyId)` with this id. Does not fabricate. */
export function pendingChallengeRelicFamily(challengeId: string): RelicFamilyId | null {
  return relicFamilyForChallenge(challengeId) ?? null
}

/** PR7 calls `completeBlueprintFromSource` with a boss-route family. Does not fabricate. */
export function isBossRouteRelicFamily(familyId: RelicFamilyId): boolean {
  return getRelicFamily(familyId)?.source.kind === 'boss-route'
}
