/** USI-style Core milestone nodes — every 10 levels, 2-pick. */

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

export const CORE_MILESTONES: Record<string, CoreMilestoneDef[]> = {
  'pulse-cannon': [
    {
      id: 'pulse-10',
      level: 10,
      choices: [
        { id: 'focused', name: 'Focused Pulse', blurb: 'Damage ×1.15', damageMult: 1.15 },
        { id: 'rapid', name: 'Rapid Cycle', blurb: 'RoF ×1.18', cooldownMult: 1 / 1.18 },
      ],
    },
    {
      id: 'pulse-20',
      level: 20,
      choices: [
        { id: 'far-arc', name: 'Far Arc', blurb: '+24 range', rangeAdd: 24 },
        { id: 'hard-light', name: 'Hard Light', blurb: 'Armour dmg 0.40', armorDamage: 0.4 },
      ],
    },
    {
      id: 'pulse-30',
      level: 30,
      choices: [
        { id: 'overcharge', name: 'Overcharge', blurb: 'Damage ×1.20', damageMult: 1.2 },
        { id: 'twin-feed', name: 'Twin Feed', blurb: 'RoF ×1.15', cooldownMult: 1 / 1.15 },
      ],
    },
    {
      id: 'pulse-40',
      level: 40,
      choices: [
        { id: 'pierce-pulse', name: 'Pierce Pulse', blurb: 'Armour dmg 0.50', armorDamage: 0.5 },
        { id: 'ward-flare', name: 'Ward Flare', blurb: 'Shield dmg ×1.25', shieldDamage: 1.25 },
      ],
    },
  ],
  'plate-layer': [
    {
      id: 'plate-10',
      level: 10,
      choices: [
        { id: 'bulk', name: 'Bulk Ward', blurb: 'Max shield ×1.20', shieldMult: 1.2 },
        { id: 'quick', name: 'Quick Regen', blurb: '+3%/s regen', regenAdd: 0.03 },
      ],
    },
    {
      id: 'plate-20',
      level: 20,
      choices: [
        { id: 'capacitor', name: 'Capacitor', blurb: 'Max shield ×1.15', shieldMult: 1.15 },
        { id: 'siphon', name: 'Siphon Mesh', blurb: '+2%/s regen', regenAdd: 0.02 },
      ],
    },
    {
      id: 'plate-30',
      level: 30,
      choices: [
        { id: 'bastion', name: 'Bastion Field', blurb: 'Max shield ×1.25', shieldMult: 1.25 },
        { id: 'surge', name: 'Surge Regen', blurb: '+4%/s regen', regenAdd: 0.04 },
      ],
    },
  ],
}

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

export function milestonesFor(moduleId: string): CoreMilestoneDef[] {
  return CORE_MILESTONES[moduleId] ?? []
}

export function pendingMilestone(
  moduleId: string,
  level: number,
  picks: Record<string, string> | undefined,
): CoreMilestoneDef | null {
  for (const ms of milestonesFor(moduleId)) {
    if (level >= ms.level && !picks?.[ms.id]) return ms
  }
  return null
}

export function milestoneModsFor(
  moduleId: string,
  picks: Record<string, string> | undefined,
): MilestoneMods {
  const mods = emptyMilestoneMods()
  if (!picks) return mods
  for (const ms of milestonesFor(moduleId)) {
    const choiceId = picks[ms.id]
    if (!choiceId) continue
    const choice = ms.choices.find((c) => c.id === choiceId)
    if (!choice) continue
    if (choice.damageMult) mods.damageMult *= choice.damageMult
    if (choice.cooldownMult) mods.cooldownMult *= choice.cooldownMult
    if (choice.rangeAdd) mods.rangeAdd += choice.rangeAdd
    if (choice.shieldMult) mods.shieldMult *= choice.shieldMult
    if (choice.regenAdd) mods.regenAdd += choice.regenAdd
    if (choice.armorDamage != null) mods.armorDamage = choice.armorDamage
    if (choice.shieldDamage != null) mods.shieldDamage = choice.shieldDamage
  }
  return mods
}

export function applyMilestoneToWeapon(weapon: WeaponInstance, mods: MilestoneMods): WeaponInstance {
  return {
    ...weapon,
    damage: weapon.damage * mods.damageMult,
    cooldown: weapon.cooldown * mods.cooldownMult,
    range: weapon.range + mods.rangeAdd,
    armorDamage: mods.armorDamage ?? weapon.armorDamage,
    shieldDamage: mods.shieldDamage ?? weapon.shieldDamage,
  }
}

export function corePicksFor(
  state: GameState,
  moduleId: string,
): Record<string, string> | undefined {
  return state.shipyard.corePicks?.[moduleId]
}

export function fittedRegenBonus(state: GameState): number {
  let extra = 0
  for (const id of state.shipyard.modules) {
    extra += milestoneModsFor(id, corePicksFor(state, id)).regenAdd
  }
  return extra
}

export function fittedShieldMilestoneMult(state: GameState): number {
  let mult = 1
  for (const id of state.shipyard.modules) {
    mult *= milestoneModsFor(id, corePicksFor(state, id)).shieldMult
  }
  return mult
}
