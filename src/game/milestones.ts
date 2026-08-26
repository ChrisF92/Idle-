/** Leftover USI 2-pick Core Level nodes are retired. Authored Mastery lives in coreMastery.ts. */

import type { GameState, WeaponInstance } from './types'

export interface CoreMilestoneChoice {
  id: string
  name: string
  blurb: string
  damageMult?: number
  cooldownMult?: number
  rangeAdd?: number
  shieldMult?: number
  regenAdd?: number
  armorDamage?: number
  shieldDamage?: number
}

export interface CoreMilestoneDef {
  id: string
  level: number
  choices: [CoreMilestoneChoice, CoreMilestoneChoice]
}

export const CORE_MILESTONES: Record<string, CoreMilestoneDef[]> = {}

export interface MilestoneMods {
  damageMult: number
  cooldownMult: number
  rangeAdd: number
  shieldMult: number
  regenAdd: number
  armorDamage?: number
  shieldDamage?: number
}

export function emptyMilestoneMods(): MilestoneMods {
  return {
    damageMult: 1,
    cooldownMult: 1,
    rangeAdd: 0,
    shieldMult: 1,
    regenAdd: 0,
  }
}

export function milestonesFor(_moduleId: string): CoreMilestoneDef[] {
  return []
}

export function pendingMilestone(
  _moduleId: string,
  _level: number,
  _picks: Record<string, string> | undefined,
): CoreMilestoneDef | null {
  return null
}

export function milestoneModsFor(
  _moduleId: string,
  _picks: Record<string, string> | undefined,
): MilestoneMods {
  return emptyMilestoneMods()
}

export function applyMilestoneToWeapon(weapon: WeaponInstance, _mods: MilestoneMods): WeaponInstance {
  return weapon
}

export function corePicksFor(
  _state: GameState,
  _moduleId: string,
): Record<string, string> | undefined {
  return undefined
}

export function fittedRegenBonus(_state: GameState): number {
  return 0
}

export function fittedShieldMilestoneMult(_state: GameState): number {
  return 1
}
