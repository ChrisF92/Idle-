/** Fleet combat: multi-unit packs, weapon cooldowns, bosses, repair. */

import type {
  CombatFx,
  CombatUnit,
  GameState,
  UnitShape,
  WeaponInstance,
  WeaponTag,
} from './types'
import {
  aiDoctrinesActive,
  challengeShopMatchupBonus,
  challengeStackRepairBonus,
  getModule,
  matterShopRepairMult,
} from './catalog'
import { buildFlagshipWeapons, computeShipStats, globalDamageMultiplier } from './state'

export type EnemyFamily = 'swarm' | 'armored' | 'ethereal' | 'divine' | 'titan'

export interface SectorEncounter {
  id: string
  name: string
  family: EnemyFamily
  tags: string[]
  isBoss: boolean
  scrapReward: number
  dataReward: number
  aiReward: number
  essenceReward: number
  blurb: string
  units: CombatUnit[]
}

const FAMILY_ROTATION: EnemyFamily[] = ['swarm', 'armored', 'ethereal', 'divine']

const NAMES: Record<EnemyFamily, string[]> = {
  swarm: ['Void Mite', 'Ashen Drifter', 'Needle Cloud'],
  armored: ['Hive Shard', 'Carapace Walker', 'Iron Cyst'],
  ethereal: ['Phase Wisp', 'Echo Veil', 'Null Mirage'],
  divine: ['God-Spark Remnant', 'Halo Fragment', 'Choir Speck'],
  titan: ['Titan Larva', 'Leviathan Seed', 'Throne Husk'],
}

const FAMILY_SHAPE: Record<EnemyFamily, UnitShape> = {
  swarm: 'circle',
  armored: 'square',
  ethereal: 'diamond',
  divine: 'hex',
  titan: 'hex',
}

let unitSeq = 0
function nextUnitId(prefix: string): string {
  unitSeq += 1
  return `${prefix}-${unitSeq}`
}

export function isBossSector(sector: number): boolean {
  return sector > 0 && sector % 5 === 0
}

function makeWeapon(
  id: string,
  name: string,
  damage: number,
  cooldown: number,
  tags: WeaponTag[],
  splash = 0,
): WeaponInstance {
  return {
    id,
    name,
    damage,
    cooldown,
    cooldownLeft: 0,
    tags,
    splash,
    dotDuration: 0,
    dotDamage: 0,
  }
}

function makeEnemyUnit(opts: {
  name: string
  family: EnemyFamily
  hull: number
  armor?: number
  shield?: number
  evasion?: number
  damage: number
  cooldown?: number
  tags?: WeaponTag[]
  splash?: number
  isBoss?: boolean
  shape?: UnitShape
}): CombatUnit {
  const family = opts.family
  return {
    id: nextUnitId(`e-${family}`),
    side: 'enemy',
    name: opts.name,
    shape: opts.shape ?? FAMILY_SHAPE[family],
    family,
    hull: opts.hull,
    hullMax: opts.hull,
    shield: opts.shield ?? 0,
    shieldMax: opts.shield ?? 0,
    armor: opts.armor ?? 0,
    evasion: opts.evasion ?? 0,
    damageTakenMult: 1,
    weapons: [
      makeWeapon(
        nextUnitId('ew'),
        `${opts.name} strike`,
        opts.damage,
        opts.cooldown ?? 1,
        opts.tags ?? ['kinetic'],
        opts.splash ?? 0,
      ),
    ],
    isBoss: opts.isBoss ?? false,
    isFlagship: opts.isBoss ?? false,
    dots: [],
  }
}

export function enemyForSector(sector: number): SectorEncounter {
  const boss = isBossSector(sector)
  const family: EnemyFamily = boss
    ? 'titan'
    : (FAMILY_ROTATION[(sector - 1) % FAMILY_ROTATION.length] ?? 'swarm')
  const names = NAMES[family]
  const name =
    names[(Math.floor((sector - 1) / FAMILY_ROTATION.length)) % names.length] ??
    'Unknown Entity'

  const units = boss
    ? buildBossPack(sector, name)
    : buildPack(sector, family, name)

  return {
    id: `${family}-${sector}`,
    name: boss ? `${name} (Boss)` : `${name} pack`,
    family,
    tags: boss ? [family, 'boss'] : [family],
    isBoss: boss,
    scrapReward: boss ? 20 + sector * 4 : 5 + sector * 2,
    dataReward: boss ? 4 + Math.floor(sector / 2) : 1 + Math.floor(sector / 3),
    aiReward: boss ? 1.5 : sector % 5 === 0 ? 1 : 0.15,
    essenceReward: boss ? 1 + Math.floor(sector / 10) : 0,
    blurb: familyBlurb(family, boss),
    units,
  }
}

function buildPack(sector: number, family: EnemyFamily, name: string): CombatUnit[] {
  const scale = 1 + (sector - 1) * 0.12
  switch (family) {
    case 'swarm': {
      const count = Math.min(8, 4 + Math.floor(sector / 4))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family,
          hull: 18 * scale,
          damage: 3.2 * scale,
          cooldown: 0.9,
          splash: 0,
        }),
      )
    }
    case 'armored': {
      const count = Math.min(4, 2 + Math.floor(sector / 8))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family,
          hull: 55 * scale,
          armor: 4 + Math.floor(sector / 5),
          damage: 6 * scale,
          cooldown: 1.3,
          tags: ['kinetic'],
        }),
      )
    }
    case 'ethereal': {
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family,
          hull: 32 * scale,
          shield: 20 * scale,
          evasion: 0.12,
          damage: 5 * scale,
          cooldown: 1.1,
          tags: ['energy'],
        }),
      )
    }
    case 'divine': {
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family,
          hull: 45 * scale,
          shield: 15 * scale,
          damage: 7 * scale,
          cooldown: 1.2,
          tags: ['energy'],
        }),
        makeEnemyUnit({
          name: `${name} Attendant`,
          family,
          hull: 28 * scale,
          evasion: 0.08,
          damage: 4.5 * scale,
          cooldown: 1,
          tags: ['energy'],
        }),
        makeEnemyUnit({
          name: `${name} Attendant`,
          family,
          hull: 28 * scale,
          evasion: 0.08,
          damage: 4.5 * scale,
          cooldown: 1,
          tags: ['energy'],
        }),
      ]
    }
    default:
      return [
        makeEnemyUnit({
          name,
          family: 'swarm',
          hull: 40 * scale,
          damage: 5 * scale,
        }),
      ]
  }
}

function buildBossPack(sector: number, name: string): CombatUnit[] {
  const scale = 1 + (sector - 1) * 0.14
  const titan = makeEnemyUnit({
    name: `${name} (Boss)`,
    family: 'titan',
    hull: 220 * scale,
    armor: 3,
    shield: 40 * scale,
    damage: 11 * scale,
    cooldown: 1.1,
    tags: ['kinetic'],
    isBoss: true,
    shape: 'hex',
  })
  const adds = [
    makeEnemyUnit({
      name: 'Thrall',
      family: 'swarm',
      hull: 30 * scale,
      damage: 4 * scale,
      cooldown: 1,
    }),
    makeEnemyUnit({
      name: 'Thrall',
      family: 'swarm',
      hull: 30 * scale,
      damage: 4 * scale,
      cooldown: 1,
    }),
  ]
  return [titan, ...adds]
}

function familyBlurb(family: EnemyFamily, boss: boolean): string {
  if (boss) return 'Boss: phases shift automatically. Defense + pierce help.'
  switch (family) {
    case 'swarm':
      return 'Swarm pack: many light hulls. Flak / Defense help.'
    case 'armored':
      return 'Armored pack: thick plates. Pierce weapons help.'
    case 'ethereal':
      return 'Ethereal pack: shields + evasion. Energy / Utility help.'
    case 'divine':
      return 'Divine pack: mixed aura. Energy / Utility help.'
    case 'titan':
      return 'Titan-class entity.'
  }
}

export function buildPlayerFleet(state: GameState): CombatUnit[] {
  const stats = computeShipStats(state)
  const hull = Math.min(state.combat.playerHull, stats.hullMax)
  const shield = Math.min(state.combat.playerShield, stats.shieldMax)
  const flagship: CombatUnit = {
    id: 'flagship',
    side: 'player',
    name: 'Flagship',
    shape: 'triangle',
    family: 'player',
    hull: Math.max(1, hull),
    hullMax: stats.hullMax,
    shield,
    shieldMax: stats.shieldMax,
    armor: stats.armor,
    evasion: stats.evasion,
    damageTakenMult: stats.damageTakenMult,
    weapons: buildFlagshipWeapons(state),
    isBoss: false,
    isFlagship: true,
    dots: [],
  }

  const escorts: CombatUnit[] = []
  let escortIndex = 0
  const droneDmg = 6 * globalDamageMultiplier(state)
  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    const n = mod?.escorts ?? 0
    for (let i = 0; i < n; i += 1) {
      escortIndex += 1
      escorts.push({
        id: `escort-${escortIndex}`,
        side: 'player',
        name: `Drone ${escortIndex}`,
        shape: 'circle',
        family: 'escort',
        hull: 28 + stats.hullMax * 0.05,
        hullMax: 28 + stats.hullMax * 0.05,
        shield: 0,
        shieldMax: 0,
        armor: 0,
        evasion: 0.05,
        damageTakenMult: 1,
        weapons: [
          makeWeapon(`escort-wpn-${escortIndex}`, 'Drone Pulse', droneDmg, 1, ['kinetic']),
        ],
        isBoss: false,
        isFlagship: false,
        dots: [],
      })
    }
  }

  return [flagship, ...escorts]
}

export interface FightSummary {
  playerDps: number
  enemyDps: number
  matchupNotes: string[]
  playerAlive: number
  enemyAlive: number
}

/** Rough DPS / matchup notes for UI (not the live resolution path). */
export function computeFightDamage(state: GameState): FightSummary {
  const stats = computeShipStats(state)
  const family = (state.combat.enemyFamily || 'swarm') as EnemyFamily
  const roles = fittedRoles(state)
  const notes: string[] = []
  const matchupScale = 1 + challengeShopMatchupBonus(state.prestige.shop)

  let playerDps = stats.damage
  let incomingMult = stats.damageTakenMult

  if (family === 'armored' && roles.weapon > 0) {
    const bonus = 1 + 0.18 * roles.weapon * matchupScale
    playerDps *= bonus
    notes.push(`Weapons vs Armored ×${bonus.toFixed(2)}`)
  }
  if ((family === 'ethereal' || family === 'divine') && roles.utility > 0) {
    const bonus = 1 + 0.2 * Math.min(roles.utility, 2) * matchupScale
    playerDps *= bonus
    notes.push(`Utility vs ${family} ×${bonus.toFixed(2)}`)
  }
  if (family === 'swarm' && roles.defense > 0) {
    const reduce = Math.pow(0.88, roles.defense * matchupScale)
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

  const enemyUnits =
    state.combat.enemyUnits.length > 0
      ? state.combat.enemyUnits
      : enemyForSector(state.combat.sector).units
  const enemyDps =
    enemyUnits
      .filter((u) => u.hull > 0)
      .reduce((s, u) => s + u.weapons.reduce((a, w) => a + w.damage / w.cooldown, 0), 0) *
    incomingMult

  return {
    playerDps,
    enemyDps,
    matchupNotes: notes,
    playerAlive: state.combat.playerUnits.filter((u) => u.hull > 0).length,
    enemyAlive: state.combat.enemyUnits.filter((u) => u.hull > 0).length,
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

  if (enemy.family === 'swarm' && roles.defense === 0 && !fittedModuleIds.includes('flak-array')) {
    return 'Hint: Flak or Defense vs Swarm packs.'
  }
  if (enemy.family === 'armored' && roles.weapon === 0) {
    return 'Hint: fit pierce Weapons against Armored.'
  }
  if (
    (enemy.family === 'ethereal' || enemy.family === 'divine') &&
    roles.utility === 0 &&
    !fittedModuleIds.includes('phase-beam')
  ) {
    return 'Hint: Energy weapons or Utility vs Ethereal/Divine.'
  }
  if (enemy.isBoss && roles.defense === 0) {
    return 'Hint: bosses punish naked hull — fit Defense.'
  }
  return enemy.blurb
}

export function syncHullAggregates(state: GameState): void {
  const enemies = state.combat.enemyUnits
  state.combat.enemyHull = enemies.reduce((s, u) => s + Math.max(0, u.hull), 0)
  state.combat.enemyHullMax = enemies.reduce((s, u) => s + u.hullMax, 0)
  const flag = state.combat.playerUnits.find((u) => u.isFlagship)
  if (flag) {
    state.combat.playerHull = flag.hull
    state.combat.playerHullMax = flag.hullMax
    state.combat.playerShield = flag.shield
    state.combat.playerShieldMax = flag.shieldMax
  }
}

/** Auto boss phase shifts — retags titan resistances. Mutates combat. */
export function maybeAdvanceBossPhase(
  state: GameState,
  pushLog: (state: GameState, line: string) => void,
): void {
  if (!state.combat.isBoss) return
  const boss = state.combat.enemyUnits.find((u) => u.isBoss)
  if (!boss || boss.hullMax <= 0) return
  const pct = boss.hull / boss.hullMax

  if (state.combat.bossPhase < 1 && pct <= 2 / 3) {
    state.combat.bossPhase = 1
    state.combat.enemyFamily = 'armored'
    state.combat.enemyTags = ['armored', 'boss']
    boss.family = 'armored'
    boss.armor += 4
    for (const w of boss.weapons) w.damage *= 1.15
    pushLog(state, 'Boss phase 2 — shell hardens [armored].')
  }

  if (state.combat.bossPhase < 2 && pct <= 1 / 3) {
    state.combat.bossPhase = 2
    state.combat.enemyFamily = 'ethereal'
    state.combat.enemyTags = ['ethereal', 'boss']
    boss.family = 'ethereal'
    boss.evasion = Math.min(0.35, boss.evasion + 0.1)
    boss.shield = Math.max(boss.shield, boss.shieldMax * 0.4)
    for (const w of boss.weapons) w.damage *= 1.2
    pushLog(state, 'Boss phase 3 — form frays [ethereal].')
  }
}

/** Hull points restored per second while not in a fight. */
export function repairRatePerSecond(state: GameState): number {
  let rate = 5
  if (aiDoctrinesActive(state, 'auto-engage')) rate *= 2
  const shopMult = matterShopRepairMult(state.prestige.matterShop)
  // repairMult < 1 means faster
  rate /= Math.max(0.2, shopMult)
  rate *= 1 + challengeStackRepairBonus(state.prestige.challengeClears)
  if (!state.combat.campaign) rate *= 1.5 // Holding repairs faster
  return rate
}

export function shieldRepairRatePerSecond(state: GameState): number {
  return repairRatePerSecond(state) * 0.8
}

/** Minimum flagship hull fraction before Advance re-engages. */
export const REENGAGE_HULL_FRACTION = 0.35

export function canReengage(state: GameState): boolean {
  const max = Math.max(1, state.combat.playerHullMax)
  return state.combat.playerHull / max >= REENGAGE_HULL_FRACTION
}

function pickTarget(
  attackersSide: 'player' | 'enemy',
  foes: CombatUnit[],
  focusFire: boolean,
): CombatUnit | null {
  const living = foes.filter((u) => u.hull > 0)
  if (living.length === 0) return null
  if (attackersSide === 'player' && focusFire) {
    living.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
      return a.hull / a.hullMax - b.hull / b.hullMax
    })
    return living[0] ?? null
  }
  // Default: nearest threat = lowest hull remaining (keeps packs clearing)
  living.sort((a, b) => a.hull - b.hull)
  return living[0] ?? null
}

function matchupMultiplier(
  tags: WeaponTag[],
  target: CombatUnit,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
  bossProtocol: boolean,
): number {
  let mult = 1
  const family = target.family
  if (family === 'armored' && (tags.includes('pierce') || tags.includes('kinetic'))) {
    mult *= 1 + 0.12 * Math.max(1, roles.weapon) * matchupScale
  }
  if (
    (family === 'ethereal' || family === 'divine') &&
    (tags.includes('energy') || tags.includes('antiShield'))
  ) {
    mult *= 1 + 0.14 * Math.max(1, roles.utility) * matchupScale
  }
  if (family === 'swarm' && tags.includes('splash')) {
    mult *= 1.25
  }
  if (target.isBoss) {
    if (tags.includes('pierce')) mult *= 1.1
    if (bossProtocol) mult *= 1.25
  }
  return mult
}

function applyDamageToUnit(
  target: CombatUnit,
  rawDamage: number,
  tags: WeaponTag[],
): number {
  let dmg = rawDamage * target.damageTakenMult

  if (tags.includes('antiShield') && target.shield > 0) {
    dmg *= 1.5
  }

  let armor = target.armor
  if (tags.includes('pierce')) armor *= 0.5
  dmg = Math.max(1, dmg - armor)

  let dealt = 0
  if (target.shield > 0) {
    const toShield = Math.min(target.shield, dmg)
    target.shield -= toShield
    dmg -= toShield
    dealt += toShield
  }
  if (dmg > 0) {
    const toHull = Math.min(target.hull, dmg)
    target.hull -= toHull
    dealt += toHull
  }
  return dealt
}

function incomingDefenseMult(
  target: CombatUnit,
  attackerFamily: string,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
): number {
  if (target.side !== 'player') return 1
  let mult = 1
  if (attackerFamily === 'swarm' && roles.defense > 0) {
    mult *= Math.pow(0.88, roles.defense * matchupScale)
  }
  if ((attackerFamily === 'titan' || attackerFamily === 'armored') && target.isFlagship) {
    if (roles.defense === 0) mult *= 1.15
    else mult *= Math.pow(0.94, roles.defense)
  }
  return mult
}

/** Resolve one second of fleet combat. Mutates state. */
export function resolveCombatTick(
  state: GameState,
  pushLog: (state: GameState, line: string) => void,
): void {
  const roles = fittedRoles(state)
  const matchupScale = 1 + challengeShopMatchupBonus(state.prestige.shop)
  const focusFire = aiDoctrinesActive(state, 'focus-fire')
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')
  const fx: CombatFx[] = []
  let fxSeq = 0

  const sides: Array<'player' | 'enemy'> = ['player', 'enemy']
  for (const side of sides) {
    const allies = side === 'player' ? state.combat.playerUnits : state.combat.enemyUnits
    const foes = side === 'player' ? state.combat.enemyUnits : state.combat.playerUnits

    for (const unit of allies) {
      if (unit.hull <= 0) continue

      // Tick DoTs
      for (const dot of unit.dots) {
        if (dot.remaining <= 0) continue
        unit.hull = Math.max(0, unit.hull - dot.dps)
        dot.remaining -= 1
      }
      unit.dots = unit.dots.filter((d) => d.remaining > 0)

      for (const weapon of unit.weapons) {
        weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - 1)
        if (weapon.cooldownLeft > 0) continue

        const primary = pickTarget(side, foes, focusFire && side === 'player')
        if (!primary) continue

        const targets: CombatUnit[] = [primary]
        if (weapon.splash > 0 || weapon.tags.includes('splash')) {
          const extras = foes
            .filter((u) => u.hull > 0 && u.id !== primary.id)
            .sort((a, b) => a.hull - b.hull)
            .slice(0, weapon.splash || 1)
          targets.push(...extras)
        }

        for (const target of targets) {
          if (target.hull <= 0) continue
          if (target.evasion > 0 && Math.random() < target.evasion) {
            continue
          }

          let dmg = weapon.damage
          if (side === 'player') {
            dmg *= matchupMultiplier(
              weapon.tags,
              target,
              roles,
              matchupScale,
              bossProtocol,
            )
          } else {
            dmg *= incomingDefenseMult(target, unit.family, roles, matchupScale)
          }

          applyDamageToUnit(target, dmg, weapon.tags)

          if (weapon.dotDuration > 0 && weapon.dotDamage > 0) {
            target.dots.push({ dps: weapon.dotDamage, remaining: weapon.dotDuration })
          }

          fxSeq += 1
          fx.push({
            id: `fx-${fxSeq}`,
            fromId: unit.id,
            toId: target.id,
            tag: weapon.tags[0] ?? 'kinetic',
            ttl: 1,
          })
        }

        weapon.cooldownLeft = weapon.cooldown
      }
    }
  }

  state.combat.fx = [...fx, ...state.combat.fx.map((f) => ({ ...f, ttl: f.ttl - 1 }))]
    .filter((f) => f.ttl > 0)
    .slice(0, 24)

  maybeAdvanceBossPhase(state, pushLog)
  syncHullAggregates(state)
}

export function totalEnemyHull(encounter: SectorEncounter): number {
  return encounter.units.reduce((s, u) => s + u.hullMax, 0)
}
