/**
 * Final Act 1 hostile catalogue. Source of truth for identities, first-contact
 * Waves, and authored-vs-pending mechanical metadata.
 *
 * Family/role/unique-mechanic fields stay `pending` unless the canonical
 * document (or a later merged implementation note) explicitly authors them.
 * Do not infer family from a name.
 */

import type { CombatUnit, EnemyRole, UnitShape, WeaponInstance } from './types'
import { TYPICAL_SPAWN_RADIUS } from './geometry'
import {
  BREACH_ENGINE_SPIKE,
  ELITE_ROLE_BASELINE,
  ROLE_NEUTRAL_BASELINE,
  enemyDamageScale,
  enemyWaveScale,
  type CommanderTraitId,
} from './hostileSeeds'

export type { CommanderTraitId }

export type EnemyFamilyId = 'swarm' | 'armored' | 'veil' | 'siege' | 'choir' | 'apex'

export const ENEMY_FAMILY_IDS: readonly EnemyFamilyId[] = [
  'swarm',
  'armored',
  'veil',
  'siege',
  'choir',
  'apex',
] as const

export const ENEMY_FAMILY_LABELS: Record<EnemyFamilyId, string> = {
  swarm: 'Swarm',
  armored: 'Armored',
  veil: 'Veil',
  siege: 'Siege',
  choir: 'Choir',
  apex: 'Apex',
}

export type AuthoredStatus = 'authored' | 'pending'

export type HostileCategory = 'none' | 'support' | 'disruptor'

export type HostileId =
  | 'void-mite'
  | 'needle-skitter'
  | 'brood-splitter'
  | 'carapace-walker'
  | 'cinder-diver'
  | 'phase-wisp'
  | 'bulwark'
  | 'iron-ram'
  | 'veil-sniper'
  | 'mortar-cyst'
  | 'bastion-husk'
  | 'mirror-shade'
  | 'ashen-chorister'
  | 'suppressor-node'
  | 'prism-warder'
  | 'cantor'
  | 'resonance-vessel'
  | 'reclaimer'
  | 'breach-engine'
  | 'choir-sentinel'
  | 'null-shepherd'
  | 'crowned-husk'

export type HostileMechanicId = 'death-position-hazard' | 'partial-shield-bypass-spike'

export interface HostileDef {
  id: HostileId
  name: string
  firstContactWave: number
  family: EnemyFamilyId | null
  familyStatus: AuthoredStatus
  role: 'elite' | null
  roleStatus: AuthoredStatus
  mechanicId: HostileMechanicId | null
  mechanicStatus: AuthoredStatus
  mechanicSummary: string | null
  category: HostileCategory
  categoryStatus: AuthoredStatus
  commanderEligible: boolean
  /** Null means trait compatibility is pending (family unauthored). */
  traitCompatibility: CommanderTraitId[] | null
  traitCompatibilityStatus: AuthoredStatus
  shape: UnitShape
  usesDevBaseline: boolean
}

const LEGACY_FILLER_NAMES = [
  'Ashen Drifter',
  'Needle Cloud',
  'Hive Shard',
  'Iron Cyst',
  'Echo Veil',
  'Null Mirage',
  'God-Spark Remnant',
  'Halo Fragment',
  'Choir Speck',
  'Titan Larva',
  'Leviathan Seed',
  'Throne Husk',
] as const

function entry(
  partial: Omit<HostileDef, 'family' | 'familyStatus' | 'role' | 'roleStatus' | 'mechanicId' | 'mechanicStatus' | 'mechanicSummary' | 'category' | 'categoryStatus' | 'commanderEligible' | 'traitCompatibility' | 'traitCompatibilityStatus' | 'usesDevBaseline' | 'shape'> &
    Partial<HostileDef>,
): HostileDef {
  return {
    family: null,
    familyStatus: 'pending',
    role: null,
    roleStatus: 'pending',
    mechanicId: null,
    mechanicStatus: 'pending',
    mechanicSummary: null,
    category: 'none',
    categoryStatus: 'pending',
    commanderEligible: true,
    traitCompatibility: null,
    traitCompatibilityStatus: 'pending',
    shape: 'circle',
    usesDevBaseline: true,
    ...partial,
  }
}

export const HOSTILE_DEFS: readonly HostileDef[] = [
  entry({ id: 'void-mite', name: 'Void Mite', firstContactWave: 1 }),
  entry({ id: 'needle-skitter', name: 'Needle Skitter', firstContactWave: 30 }),
  entry({ id: 'brood-splitter', name: 'Brood Splitter', firstContactWave: 85 }),
  entry({ id: 'carapace-walker', name: 'Carapace Walker', firstContactWave: 115 }),
  entry({ id: 'cinder-diver', name: 'Cinder Diver', firstContactWave: 140 }),
  entry({ id: 'phase-wisp', name: 'Phase Wisp', firstContactWave: 175 }),
  entry({ id: 'bulwark', name: 'Bulwark', firstContactWave: 190 }),
  entry({ id: 'iron-ram', name: 'Iron Ram', firstContactWave: 260 }),
  entry({ id: 'veil-sniper', name: 'Veil Sniper', firstContactWave: 290 }),
  entry({ id: 'mortar-cyst', name: 'Mortar Cyst', firstContactWave: 325 }),
  entry({ id: 'bastion-husk', name: 'Bastion Husk', firstContactWave: 365 }),
  entry({ id: 'mirror-shade', name: 'Mirror Shade', firstContactWave: 395 }),
  entry({ id: 'ashen-chorister', name: 'Ashen Chorister', firstContactWave: 440 }),
  entry({ id: 'suppressor-node', name: 'Suppressor Node', firstContactWave: 470 }),
  entry({ id: 'prism-warder', name: 'Prism Warder', firstContactWave: 515 }),
  entry({ id: 'cantor', name: 'Cantor', firstContactWave: 565 }),
  entry({
    id: 'resonance-vessel',
    name: 'Resonance Vessel',
    firstContactWave: 665,
    mechanicId: 'death-position-hazard',
    mechanicStatus: 'authored',
    mechanicSummary: 'Death-position danger: a bounded radial hazard at the kill location.',
  }),
  entry({ id: 'reclaimer', name: 'Reclaimer', firstContactWave: 690 }),
  entry({
    id: 'breach-engine',
    name: 'Breach Engine',
    firstContactWave: 740,
    mechanicId: 'partial-shield-bypass-spike',
    mechanicStatus: 'authored',
    mechanicSummary: 'Telegraphed heavy spike with modest partial Shield bypass. Not full Shield ignore.',
  }),
  entry({
    id: 'choir-sentinel',
    name: 'Choir Sentinel',
    firstContactWave: 815,
    role: 'elite',
    roleStatus: 'authored',
    usesDevBaseline: false,
  }),
  entry({ id: 'null-shepherd', name: 'Null Shepherd', firstContactWave: 865 }),
  entry({
    id: 'crowned-husk',
    name: 'Crowned Husk',
    firstContactWave: 935,
    role: 'elite',
    roleStatus: 'authored',
    usesDevBaseline: false,
  }),
]

export const HOSTILE_IDS: readonly HostileId[] = HOSTILE_DEFS.map((d) => d.id)

const BY_ID = new Map(HOSTILE_DEFS.map((d) => [d.id, d]))

export function getHostileDef(id: string | undefined | null): HostileDef | undefined {
  if (!id) return undefined
  return BY_ID.get(id as HostileId)
}

export function isHostileId(id: string): id is HostileId {
  return BY_ID.has(id as HostileId)
}

export function isLegacyFillerName(name: string): boolean {
  return (LEGACY_FILLER_NAMES as readonly string[]).includes(name)
}

export function introducedHostiles(wave: number): HostileDef[] {
  const w = Math.max(1, Math.floor(wave))
  return HOSTILE_DEFS.filter((d) => d.firstContactWave <= w)
}

export function firstContactHostile(wave: number): HostileDef | undefined {
  const w = Math.max(1, Math.floor(wave))
  return HOSTILE_DEFS.find((d) => d.firstContactWave === w)
}

export function isHostileEligible(id: string, wave: number): boolean {
  const def = getHostileDef(id)
  if (!def) return false
  return def.firstContactWave <= Math.max(1, Math.floor(wave))
}

export const COMMANDER_TRAIT_IDS: readonly CommanderTraitId[] = [
  'vanguard',
  'ironclad',
  'wardbearer',
  'rallying',
  'displacer',
  'suppressor',
  'volatile',
  'breacher',
]

export const COMMANDER_TRAIT_LABELS: Record<CommanderTraitId, string> = {
  vanguard: 'Vanguard',
  ironclad: 'Ironclad',
  wardbearer: 'Wardbearer',
  rallying: 'Rallying',
  displacer: 'Displacer',
  suppressor: 'Suppressor',
  volatile: 'Volatile',
  breacher: 'Breacher',
}

export const COMMANDER_TRAIT_ICONS: Record<CommanderTraitId, string> = {
  vanguard: '▲',
  ironclad: '■',
  wardbearer: '◇',
  rallying: '✚',
  displacer: '⇉',
  suppressor: '⊘',
  volatile: '✺',
  breacher: '▶',
}

export const COMMANDER_TRAIT_BLURBS: Record<CommanderTraitId, string> = {
  vanguard: 'Aggressive mobile leader. Faster movement and a small ally speed aura.',
  ironclad: 'Durable promoted target. Extra Hull and plating. No aura.',
  wardbearer: 'Visible Shield commander. Temporary ally Shield support while alive.',
  rallying: 'Offensive support leader. Nearby allies attack faster while it lives.',
  displacer: 'Telegraphs, then shifts bearing. Player Cores must orbitally traverse.',
  suppressor: 'Reduces weapon-Core orbital slew and acquisition. Never to zero.',
  volatile: 'Death-position blast at its physical location. Safer to kill at range.',
  breacher: 'Telegraphed heavy spike with modest partial Shield bypass.',
}

function makeWeapon(
  id: string,
  name: string,
  damage: number,
  cooldown: number,
  range: number,
  extra?: Partial<WeaponInstance>,
): WeaponInstance {
  return {
    id,
    name,
    damage,
    cooldown,
    cooldownLeft: 0,
    range,
    tags: extra?.tags ?? ['kinetic'],
    splash: extra?.splash ?? 0,
    dotDuration: extra?.dotDuration ?? 0,
    dotDamage: extra?.dotDamage ?? 0,
    telegraphDuration: extra?.telegraphDuration ?? 0,
    telegraphLeft: 0,
    delivery: extra?.delivery,
    shieldBypassFrac: extra?.shieldBypassFrac,
  }
}

export function combatRoleFor(def: HostileDef): EnemyRole | undefined {
  if (def.role === 'elite') return 'elite'
  return undefined
}

/**
 * Build a runnable CombatUnit. Pending hostiles use the isolated
 * role-neutral development baseline. Authored mechanics are applied on top.
 */
export function buildHostileUnit(opts: {
  def: HostileDef
  wave: number
  x?: number
  y?: number
  heading?: number
}): CombatUnit {
  const { def, wave } = opts
  const hullScale = enemyWaveScale(wave)
  const dmgScale = enemyDamageScale(wave)
  const baseline = def.role === 'elite' ? ELITE_ROLE_BASELINE : ROLE_NEUTRAL_BASELINE
  const hull = baseline.hull * hullScale
  const shield = baseline.shield * hullScale
  const damage = baseline.damage * dmgScale
  const gunRange = Math.max(baseline.range, baseline.engageRange + 8, 80)
  const spike = def.mechanicId === 'partial-shield-bypass-spike'
  const weapon = spike
    ? makeWeapon(
        `${def.id}-spike`,
        `${def.name} spike`,
        damage * BREACH_ENGINE_SPIKE.damageMult,
        BREACH_ENGINE_SPIKE.cooldown,
        gunRange,
        {
          tags: ['kinetic', 'bypass'],
          telegraphDuration: BREACH_ENGINE_SPIKE.charge,
          delivery: 'charge',
          shieldBypassFrac: BREACH_ENGINE_SPIKE.bypassFrac,
        },
      )
    : makeWeapon(`${def.id}-wpn`, `${def.name} strike`, damage, baseline.cooldown, gunRange)

  return {
    id: `draft-${def.id}`,
    side: 'enemy',
    name: def.name,
    shape: def.shape,
    family: def.family ?? '',
    hostileId: def.id,
    familyStatus: def.familyStatus,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    armor: baseline.armor,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [weapon],
    isBoss: false,
    isFlagship: false,
    dots: [],
    role: combatRoleFor(def),
    x: opts.x ?? 0,
    y: opts.y ?? TYPICAL_SPAWN_RADIUS,
    heading: opts.heading ?? 0,
    speed: baseline.speed,
    authoredSpeed: baseline.speed,
    authoredHullMax: hull,
    authoredShieldMax: shield,
    authoredArmor: baseline.armor,
    engageRange: baseline.engageRange,
    kite: baseline.kite,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: 1,
    resonanceArmed: def.mechanicId === 'death-position-hazard',
    usesDevBaseline: def.usesDevBaseline && def.mechanicStatus !== 'authored' && def.roleStatus !== 'authored',
  }
}

export function hostileShape(def: HostileDef): UnitShape {
  return def.shape
}

export function pendingFamilyIds(defs: readonly HostileDef[] = HOSTILE_DEFS): HostileId[] {
  return defs.filter((d) => d.familyStatus === 'pending').map((d) => d.id)
}

export function pendingRoleIds(defs: readonly HostileDef[] = HOSTILE_DEFS): HostileId[] {
  return defs.filter((d) => d.roleStatus === 'pending').map((d) => d.id)
}

export function authoredMechanicIds(defs: readonly HostileDef[] = HOSTILE_DEFS): HostileId[] {
  return defs.filter((d) => d.mechanicStatus === 'authored').map((d) => d.id)
}
