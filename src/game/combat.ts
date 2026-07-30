/** Combat entities, role matchups, and fight helpers. */

import type { GameState } from './types'
import { getModule, aiDoctrinesActive } from './catalog'
import { computeShipStats } from './state'

export type EnemyFamily = 'swarm' | 'armored' | 'ethereal' | 'divine' | 'titan'

export interface EnemyInstance {
  id: string
  name: string
  family: EnemyFamily
  tags: string[]
  isBoss: boolean
  hull: number
  damage: number
  scrapReward: number
  dataReward: number
  aiReward: number
  essenceReward: number
  blurb: string
}

const FAMILY_ROTATION: EnemyFamily[] = ['swarm', 'armored', 'ethereal', 'divine']

const NAMES: Record<EnemyFamily, string[]> = {
  swarm: ['Void Mite', 'Ashen Drifter', 'Needle Cloud'],
  armored: ['Hive Shard', 'Carapace Walker', 'Iron Cyst'],
  ethereal: ['Phase Wisp', 'Echo Veil', 'Null Mirage'],
  divine: ['God-Spark Remnant', 'Halo Fragment', 'Choir Speck'],
  titan: ['Titan Larva', 'Leviathan Seed', 'Throne Husk'],
}

export function isBossSector(sector: number): boolean {
  return sector > 0 && sector % 5 === 0
}

export function enemyForSector(sector: number): EnemyInstance {
  const boss = isBossSector(sector)
  const family: EnemyFamily = boss
    ? 'titan'
    : (FAMILY_ROTATION[(sector - 1) % FAMILY_ROTATION.length] ?? 'swarm')
  const names = NAMES[family]
  const name = names[(Math.floor((sector - 1) / FAMILY_ROTATION.length)) % names.length] ?? 'Unknown Entity'

  const baseHull = boss ? 90 + sector * 28 : 40 + sector * 15
  const baseDamage = boss ? 7 + sector * 1.1 : 5 + sector * 0.8

  return {
    id: `${family}-${sector}`,
    name: boss ? `${name} (Boss)` : name,
    family,
    tags: boss ? [family, 'boss'] : [family],
    isBoss: boss,
    hull: baseHull,
    damage: baseDamage,
    scrapReward: boss ? 20 + sector * 4 : 5 + sector * 2,
    dataReward: boss ? 4 + Math.floor(sector / 2) : 1 + Math.floor(sector / 3),
    aiReward: boss ? 1.5 : sector % 5 === 0 ? 1 : 0.15,
    essenceReward: boss ? 1 + Math.floor(sector / 10) : 0,
    blurb: familyBlurb(family, boss),
  }
}

function familyBlurb(family: EnemyFamily, boss: boolean): string {
  if (boss) return 'Boss: bring Defense. Weapons help chip the shell.'
  switch (family) {
    case 'swarm':
      return 'Swarm: high chip damage. Defense modules help.'
    case 'armored':
      return 'Armored: thick hull. Weapon modules help.'
    case 'ethereal':
      return 'Ethereal: hard to track. Utility modules help.'
    case 'divine':
      return 'Divine: anomalous aura. Utility modules help.'
    case 'titan':
      return 'Titan-class entity.'
  }
}

export interface FightTickDamage {
  playerDps: number
  enemyDps: number
  matchupNotes: string[]
}

/** Apply role matchups vs the active enemy family. */
export function computeFightDamage(state: GameState): FightTickDamage {
  const stats = computeShipStats(state)
  const family = (state.combat.enemyFamily || 'swarm') as EnemyFamily
  const roles = fittedRoles(state)
  const notes: string[] = []

  let playerDps = stats.damage
  let incomingMult = stats.damageTakenMult
  const enemyBase =
    state.combat.enemyDamage > 0
      ? state.combat.enemyDamage
      : 5 + state.combat.sector * 0.8

  if (family === 'armored' && roles.weapon > 0) {
    const bonus = 1 + 0.18 * roles.weapon
    playerDps *= bonus
    notes.push(`Weapons vs Armored ×${bonus.toFixed(2)}`)
  }

  if ((family === 'ethereal' || family === 'divine') && roles.utility > 0) {
    const bonus = 1 + 0.2 * Math.min(roles.utility, 2)
    playerDps *= bonus
    notes.push(`Utility vs ${family} ×${bonus.toFixed(2)}`)
  }

  if (family === 'swarm' && roles.defense > 0) {
    const reduce = Math.pow(0.88, roles.defense)
    incomingMult *= reduce
    notes.push(`Defense vs Swarm ×${reduce.toFixed(2)} incoming`)
  }

  if (family === 'titan' || state.combat.isBoss) {
    if (roles.weapon > 0) {
      playerDps *= 1.1
      notes.push('Weapons vs Boss ×1.10')
    }
    if (roles.defense === 0) {
      incomingMult *= 1.2
      notes.push('No Defense vs Boss ×1.20 incoming')
    } else {
      incomingMult *= Math.pow(0.92, roles.defense)
      notes.push('Defense steadies boss pressure')
    }
    if (aiDoctrinesActive(state, 'boss-protocol')) {
      playerDps *= 1.25
      notes.push('Boss Protocol ×1.25')
    }
  }

  return {
    playerDps,
    enemyDps: enemyBase * incomingMult,
    matchupNotes: notes,
  }
}

function fittedRoles(state: GameState): Record<'weapon' | 'defense' | 'utility', number> {
  const counts = { weapon: 0, defense: 0, utility: 0 }
  for (const id of state.shipyard.modules) {
    const role = getModule(id)?.role
    if (role) counts[role] += 1
  }
  return counts
}

export function matchupHintForSector(sector: number, fittedModuleIds: string[]): string {
  const enemy = enemyForSector(sector)
  const roles = { weapon: 0, defense: 0, utility: 0 }
  for (const id of fittedModuleIds) {
    const role = getModule(id)?.role
    if (role) roles[role] += 1
  }

  if (enemy.family === 'swarm' && roles.defense === 0) {
    return 'Hint: fit Defense against Swarm.'
  }
  if (enemy.family === 'armored' && roles.weapon === 0) {
    return 'Hint: fit Weapons against Armored.'
  }
  if (
    (enemy.family === 'ethereal' || enemy.family === 'divine') &&
    roles.utility === 0
  ) {
    return 'Hint: fit Utility against Ethereal/Divine.'
  }
  if (enemy.isBoss && roles.defense === 0) {
    return 'Hint: bosses punish naked hull — fit Defense.'
  }
  return enemy.blurb
}
