/** Fleet combat: ranged approach, cooldowns, bosses, salvage drops. */

import type {
  CombatFx,
  CombatProjectile,
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
  essenceBonusDataPerClear,
  getModule,
  matterShopDataPerClear,
  matterShopRepairMult,
  matterShopScrapBonus,
  stationRepairBonus,
} from './catalog'
import { WAVES_PER_SECTOR, isSystemUnlocked } from './progression'
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
  salvageReward: number
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

/** Lane spawn distance ahead of the player. */
export const SPAWN_DISTANCE = 180

/** Lane-units / second — tuned so mid-range shots take a visible travel beat. */
export function projectileSpeedForTag(tag: string): number {
  switch (tag) {
    case 'pierce':
      return 300
    case 'energy':
    case 'antiShield':
      return 260
    case 'splash':
      return 210
    default:
      return 240
  }
}

let unitSeq = 0
let fxGlobalSeq = 0
let projGlobalSeq = 0
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
  range: number,
  tags: WeaponTag[],
  splash = 0,
  telegraphDuration = 0,
): WeaponInstance {
  return {
    id,
    name,
    damage,
    cooldown,
    cooldownLeft: 0,
    range,
    tags,
    splash,
    dotDuration: 0,
    dotDamage: 0,
    telegraphDuration,
    telegraphLeft: 0,
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
  range: number
  speed: number
  engageRange: number
  kite?: boolean
  tags?: WeaponTag[]
  splash?: number
  telegraphDuration?: number
  isBoss?: boolean
  shape?: UnitShape
  x?: number
  y?: number
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
        opts.range,
        opts.tags ?? ['kinetic'],
        opts.splash ?? 0,
        opts.telegraphDuration ?? 0,
      ),
    ],
    isBoss: opts.isBoss ?? false,
    isFlagship: opts.isBoss ?? false,
    dots: [],
    x: opts.x ?? SPAWN_DISTANCE,
    y: opts.y ?? 0,
    speed: opts.speed,
    engageRange: opts.engageRange,
    kite: opts.kite ?? false,
    phaseWarnLeft: 0,
  }
}

function packY(index: number, count: number): number {
  if (count <= 1) return 0
  const spread = Math.min(70, 18 * (count - 1))
  return -spread / 2 + (spread / Math.max(1, count - 1)) * index
}

export function enemyForSector(sector: number, wave = 1): SectorEncounter {
  const bossSector = isBossSector(sector)
  const bossWave = bossSector && wave >= WAVES_PER_SECTOR
  const family: EnemyFamily = bossWave
    ? 'titan'
    : bossSector
      ? bossPreludeFamily(sector, wave)
      : (FAMILY_ROTATION[(sector - 1) % FAMILY_ROTATION.length] ?? 'swarm')
  const names = NAMES[family]
  const name =
    names[(Math.floor((sector - 1) / FAMILY_ROTATION.length) + wave - 1) % names.length] ??
    'Unknown Entity'

  const waveScale = 1 + Math.max(0, wave - 1) * 0.08
  const units = bossWave
    ? buildBossPack(sector, name, waveScale)
    : buildWavePack(sector, family, name, wave, waveScale)

  const waveLabel = `W${wave}`
  return {
    id: `${family}-${sector}-w${wave}`,
    name: bossWave
      ? `${name} (Boss)`
      : bossSector
        ? `${name} vanguard (${waveLabel})`
        : `${name} pack (${waveLabel})`,
    family,
    tags: bossWave ? [family, 'boss'] : [family],
    isBoss: bossWave,
    scrapReward: bossSector ? 20 + sector * 4 : 5 + sector * 2,
    dataReward: bossSector ? 4 + Math.floor(sector / 2) : 1 + Math.floor(sector / 3),
    // AI Points come from achievements later — never from combat drops.
    aiReward: 0,
    essenceReward: bossWave ? 1 + Math.floor(sector / 10) : 0,
    salvageReward: bossSector ? 8 + sector : 3 + Math.floor(sector * 0.8),
    blurb: familyBlurb(family, bossWave),
    units,
  }
}

/** Prelude waves on boss sectors cycle supporting families before the titan. */
function bossPreludeFamily(sector: number, wave: number): EnemyFamily {
  const pool: EnemyFamily[] = ['swarm', 'armored', 'ethereal', 'divine']
  return pool[(sector + wave) % pool.length] ?? 'swarm'
}

/**
 * Wave-aware packs so W1–W5 are not identical.
 * Wave patterns: skirmish → pressure → elite → mixed → climax.
 */
function buildWavePack(
  sector: number,
  family: EnemyFamily,
  name: string,
  wave: number,
  waveScale: number,
): CombatUnit[] {
  const pattern = ((wave - 1) % 5) as 0 | 1 | 2 | 3 | 4
  const scale = (1 + (sector - 1) * 0.12) * waveScale

  switch (family) {
    case 'swarm':
      return buildSwarmWave(name, scale, pattern, sector)
    case 'armored':
      return buildArmoredWave(name, scale, pattern, sector)
    case 'ethereal':
      return buildEtherealWave(name, scale, pattern, sector)
    case 'divine':
      return buildDivineWave(name, scale, pattern, sector)
    default:
      return buildSwarmWave(name, scale, pattern, sector)
  }
}

function buildSwarmWave(
  name: string,
  scale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0: // skirmish — small fast cloud
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Mite ${i + 1}`,
          family: 'swarm',
          hull: 12 * scale,
          damage: 2.2 * scale,
          cooldown: 0.9,
          range: 40,
          speed: 42,
          engageRange: 34,
          x: SPAWN_DISTANCE + i * 8,
          y: packY(i, 3),
        }),
      )
    case 1: // pressure — denser rush
      return Array.from({ length: Math.min(7, 5 + Math.floor(sector / 6)) }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'swarm',
          hull: 15 * scale,
          damage: 2.5 * scale,
          cooldown: 0.95,
          range: 42,
          speed: 38,
          engageRange: 36,
          x: SPAWN_DISTANCE + i * 7,
          y: packY(i, 6),
        }),
      )
    case 2: // elite — spitters behind screen
      return [
        ...Array.from({ length: 3 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} Screen ${i + 1}`,
            family: 'swarm',
            hull: 14 * scale,
            damage: 2.4 * scale,
            cooldown: 1,
            range: 40,
            speed: 40,
            engageRange: 35,
            x: SPAWN_DISTANCE + i * 6,
            y: packY(i, 3),
          }),
        ),
        makeEnemyUnit({
          name: `${name} Spitter`,
          family: 'swarm',
          hull: 22 * scale,
          damage: 4.2 * scale,
          cooldown: 1.3,
          range: 95,
          speed: 22,
          engageRange: 90,
          kite: true,
          tags: ['splash'],
          splash: 1,
          x: SPAWN_DISTANCE + 35,
          y: 0,
        }),
      ]
    case 3: // mixed — swarm + armored wedge
      return [
        ...Array.from({ length: 4 }, (_, i) =>
          makeEnemyUnit({
            name: `${name} ${i + 1}`,
            family: 'swarm',
            hull: 14 * scale,
            damage: 2.4 * scale,
            cooldown: 0.95,
            range: 42,
            speed: 38,
            engageRange: 36,
            x: SPAWN_DISTANCE + i * 8,
            y: packY(i, 4),
          }),
        ),
        makeEnemyUnit({
          name: `${name} Wedge`,
          family: 'armored',
          hull: 34 * scale,
          armor: 2,
          damage: 3.8 * scale,
          cooldown: 1.35,
          range: 58,
          speed: 18,
          engageRange: 52,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 28,
          y: 0,
        }),
      ]
    case 4: // climax — max cloud + brute
    default: {
      const count = Math.min(8, 5 + Math.floor(sector / 5))
      const units = Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'swarm',
          hull: 16 * scale,
          damage: 2.7 * scale,
          cooldown: 0.9,
          range: 42,
          speed: 40,
          engageRange: 36,
          x: SPAWN_DISTANCE + i * 7,
          y: packY(i, count),
        }),
      )
      units.push(
        makeEnemyUnit({
          name: `${name} Brute`,
          family: 'armored',
          hull: 40 * scale,
          armor: 3,
          damage: 4.5 * scale,
          cooldown: 1.4,
          range: 60,
          speed: 17,
          engageRange: 55,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 42,
          y: 0,
        }),
      )
      return units
    }
  }
}

function buildArmoredWave(
  name: string,
  scale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Scout Plate`,
          family: 'armored',
          hull: 36 * scale,
          armor: 2,
          damage: 4 * scale,
          cooldown: 1.3,
          range: 70,
          speed: 20,
          engageRange: 65,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1: {
      const count = Math.min(3, 2 + Math.floor(sector / 10))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'armored',
          hull: 44 * scale,
          armor: 3 + Math.floor(sector / 6),
          damage: 5 * scale,
          cooldown: 1.35,
          range: 75,
          speed: 16,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + i * 14,
          y: packY(i, count),
        }),
      )
    }
    case 2: // siege — slow mortar + escort plate
      return [
        makeEnemyUnit({
          name: `${name} Siege`,
          family: 'armored',
          hull: 55 * scale,
          armor: 4,
          damage: 7 * scale,
          cooldown: 1.8,
          range: 110,
          speed: 12,
          engageRange: 100,
          kite: true,
          tags: ['kinetic', 'splash'],
          splash: 1,
          x: SPAWN_DISTANCE + 20,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Escort`,
          family: 'armored',
          hull: 32 * scale,
          armor: 2,
          damage: 4 * scale,
          cooldown: 1.2,
          range: 60,
          speed: 20,
          engageRange: 55,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: -30,
        }),
      ]
    case 3: // mixed — plates + ethereal spotter
      return [
        makeEnemyUnit({
          name: `${name} 1`,
          family: 'armored',
          hull: 46 * scale,
          armor: 3,
          damage: 5 * scale,
          cooldown: 1.35,
          range: 75,
          speed: 16,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: -20,
        }),
        makeEnemyUnit({
          name: `${name} 2`,
          family: 'armored',
          hull: 46 * scale,
          armor: 3,
          damage: 5 * scale,
          cooldown: 1.35,
          range: 75,
          speed: 16,
          engageRange: 70,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE,
          y: 20,
        }),
        makeEnemyUnit({
          name: `${name} Spotter`,
          family: 'ethereal',
          hull: 22 * scale,
          shield: 12 * scale,
          evasion: 0.12,
          damage: 3.2 * scale,
          cooldown: 1.1,
          range: 115,
          speed: 26,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 30,
          y: 0,
        }),
      ]
    case 4:
    default: {
      const count = Math.min(4, 2 + Math.floor(sector / 8))
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'armored',
          hull: 50 * scale,
          armor: 4 + Math.floor(sector / 5),
          damage: 5.5 * scale,
          cooldown: 1.3,
          range: 78,
          speed: 15,
          engageRange: 72,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + i * 12,
          y: packY(i, count),
        }),
      )
    }
  }
}

function buildEtherealWave(
  name: string,
  scale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Wisp`,
          family: 'ethereal',
          hull: 22 * scale,
          shield: 10 * scale,
          evasion: 0.1,
          damage: 3 * scale,
          cooldown: 1.1,
          range: 115,
          speed: 26,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1: {
      const count = sector <= 3 ? 2 : 3
      return Array.from({ length: count }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'ethereal',
          hull: 26 * scale,
          shield: 14 * scale,
          evasion: 0.12,
          damage: 3.5 * scale,
          cooldown: 1.15,
          range: 120,
          speed: 24,
          engageRange: 98,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + i * 10,
          y: packY(i, count),
        }),
      )
    }
    case 2: // phase blades — closer cutters
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Blade ${i + 1}`,
          family: 'ethereal',
          hull: 24 * scale,
          shield: 8 * scale,
          evasion: 0.16,
          damage: 4.2 * scale,
          cooldown: 0.95,
          range: 55,
          speed: 32,
          engageRange: 48,
          tags: ['energy', 'pierce'],
          x: SPAWN_DISTANCE + i * 8,
          y: packY(i, 3),
        }),
      )
    case 3: // mixed — wisps + swarm distractors
      return [
        makeEnemyUnit({
          name: `${name} 1`,
          family: 'ethereal',
          hull: 28 * scale,
          shield: 16 * scale,
          evasion: 0.12,
          damage: 3.6 * scale,
          cooldown: 1.15,
          range: 118,
          speed: 24,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 15,
          y: -24,
        }),
        makeEnemyUnit({
          name: `${name} 2`,
          family: 'ethereal',
          hull: 28 * scale,
          shield: 16 * scale,
          evasion: 0.12,
          damage: 3.6 * scale,
          cooldown: 1.15,
          range: 118,
          speed: 24,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 15,
          y: 24,
        }),
        makeEnemyUnit({
          name: `${name} Distractor`,
          family: 'swarm',
          hull: 14 * scale,
          damage: 2.5 * scale,
          cooldown: 0.9,
          range: 40,
          speed: 40,
          engageRange: 35,
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 4:
    default:
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} ${i + 1}`,
          family: 'ethereal',
          hull: 30 * scale,
          shield: 18 * scale,
          evasion: 0.14,
          damage: 3.8 * scale,
          cooldown: 1.1,
          range: 120,
          speed: 25,
          engageRange: 95,
          kite: true,
          tags: ['energy', 'antiShield'],
          x: SPAWN_DISTANCE + i * 10,
          y: packY(i, 3),
        }),
      )
  }
}

function buildDivineWave(
  name: string,
  scale: number,
  pattern: 0 | 1 | 2 | 3 | 4,
  _sector: number,
): CombatUnit[] {
  switch (pattern) {
    case 0:
      return [
        makeEnemyUnit({
          name: `${name} Speck`,
          family: 'divine',
          hull: 30 * scale,
          shield: 8 * scale,
          damage: 4 * scale,
          cooldown: 1.2,
          range: 110,
          speed: 16,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
      ]
    case 1:
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          hull: 38 * scale,
          shield: 12 * scale,
          damage: 5 * scale,
          cooldown: 1.25,
          range: 115,
          speed: 14,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Attendant`,
          family: 'divine',
          hull: 22 * scale,
          evasion: 0.08,
          damage: 3.5 * scale,
          cooldown: 1,
          range: 60,
          speed: 28,
          engageRange: 55,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 18,
          y: -26,
        }),
      ]
    case 2: // choir dive — three attendants, no core
      return Array.from({ length: 3 }, (_, i) =>
        makeEnemyUnit({
          name: `${name} Diver ${i + 1}`,
          family: 'divine',
          hull: 26 * scale,
          evasion: 0.1,
          damage: 4 * scale,
          cooldown: 0.95,
          range: 50,
          speed: 30,
          engageRange: 45,
          tags: ['energy'],
          x: SPAWN_DISTANCE + i * 10,
          y: packY(i, 3),
        }),
      )
    case 3: // mixed — core + armored votive
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          hull: 40 * scale,
          shield: 14 * scale,
          damage: 5.2 * scale,
          cooldown: 1.25,
          range: 115,
          speed: 14,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Votive`,
          family: 'armored',
          hull: 36 * scale,
          armor: 3,
          damage: 4 * scale,
          cooldown: 1.3,
          range: 65,
          speed: 18,
          engageRange: 60,
          tags: ['kinetic'],
          x: SPAWN_DISTANCE + 22,
          y: 28,
        }),
      ]
    case 4:
    default:
      return [
        makeEnemyUnit({
          name: `${name} Core`,
          family: 'divine',
          hull: 42 * scale,
          shield: 14 * scale,
          damage: 5.5 * scale,
          cooldown: 1.2,
          range: 115,
          speed: 14,
          engageRange: 100,
          kite: true,
          tags: ['energy'],
          x: SPAWN_DISTANCE,
          y: 0,
        }),
        makeEnemyUnit({
          name: `${name} Attendant`,
          family: 'divine',
          hull: 24 * scale,
          evasion: 0.08,
          damage: 3.8 * scale,
          cooldown: 1,
          range: 60,
          speed: 28,
          engageRange: 55,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 20,
          y: -28,
        }),
        makeEnemyUnit({
          name: `${name} Attendant`,
          family: 'divine',
          hull: 24 * scale,
          evasion: 0.08,
          damage: 3.8 * scale,
          cooldown: 1,
          range: 60,
          speed: 28,
          engageRange: 55,
          tags: ['energy'],
          x: SPAWN_DISTANCE + 20,
          y: 28,
        }),
      ]
  }
}

function buildBossPack(sector: number, name: string, waveScale = 1): CombatUnit[] {
  const scale = (1 + (sector - 1) * 0.1) * waveScale
  const titan = makeEnemyUnit({
    name: `${name} (Boss)`,
    family: 'titan',
    hull: 130 * scale,
    armor: 2,
    shield: 20 * scale,
    // Slower slam with a visible wind-up so players can react.
    damage: 9 * scale,
    cooldown: 2.4,
    telegraphDuration: 0.85,
    range: 120,
    speed: 10,
    engageRange: 100,
    kite: true,
    tags: ['kinetic'],
    isBoss: true,
    shape: 'hex',
    x: SPAWN_DISTANCE + 10,
    y: 0,
  })
  const thrallFamily: EnemyFamily = sector % 10 === 0 ? 'armored' : 'swarm'
  const adds = [
    makeEnemyUnit({
      name: thrallFamily === 'armored' ? 'Plate Thrall' : 'Thrall',
      family: thrallFamily,
      hull: (thrallFamily === 'armored' ? 26 : 18) * scale,
      armor: thrallFamily === 'armored' ? 3 : 0,
      damage: 2.8 * scale,
      cooldown: 1,
      range: thrallFamily === 'armored' ? 55 : 40,
      speed: thrallFamily === 'armored' ? 20 : 36,
      engageRange: thrallFamily === 'armored' ? 50 : 35,
      tags: thrallFamily === 'armored' ? ['kinetic'] : ['kinetic'],
      x: SPAWN_DISTANCE + 30,
      y: -34,
    }),
    makeEnemyUnit({
      name: thrallFamily === 'armored' ? 'Plate Thrall' : 'Thrall',
      family: thrallFamily,
      hull: (thrallFamily === 'armored' ? 26 : 18) * scale,
      armor: thrallFamily === 'armored' ? 3 : 0,
      damage: 2.8 * scale,
      cooldown: 1,
      range: thrallFamily === 'armored' ? 55 : 40,
      speed: thrallFamily === 'armored' ? 20 : 36,
      engageRange: thrallFamily === 'armored' ? 50 : 35,
      tags: ['kinetic'],
      x: SPAWN_DISTANCE + 30,
      y: 34,
    }),
  ]
  return [titan, ...adds]
}

function familyBlurb(family: EnemyFamily, boss: boolean): string {
  if (boss) {
    return 'Boss: three phases — kite titan, armored close, ethereal kite with shields.'
  }
  return familyIntel(family)
}

/** Plain-language family description for sector intel (no loadout advice). */
export function familyIntel(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Fast packs that rush to point-blank range.'
    case 'armored':
      return 'Slow mid-range plates with heavy hull.'
    case 'ethereal':
      return 'Long-range kiters that keep their distance.'
    case 'divine':
      return 'A distant core with diving attendants.'
    case 'titan':
      return 'Massive flag entity with shifting phases.'
  }
}

/** Soft-counter guidance shown in the Codex once a family is unlocked. */
export function softCounterForFamily(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Soft counter: Defense modules and Flak / Ion splash punish the rush.'
    case 'armored':
      return 'Soft counter: Weapon role and pierce (Lance / Rail) cut plates.'
    case 'ethereal':
      return 'Soft counter: Utility, Grav Tether, energy / anti-shield, or Rail reach.'
    case 'divine':
      return 'Soft counter: Utility / energy pressure; expect diving attendants.'
    case 'titan':
      return 'Soft counter: Defense + Ablative Mesh; pierce helps through phases.'
  }
}

export const CODEX_FAMILIES: EnemyFamily[] = [
  'swarm',
  'armored',
  'ethereal',
  'divine',
  'titan',
]

export function familyShape(family: EnemyFamily): UnitShape {
  return FAMILY_SHAPE[family]
}

/** Record families from living (or listed) combat units into career Codex memory. */
export function revealCodexFamilies(state: GameState, families: Iterable<string>): void {
  if (!state.codex) state.codex = { seenFamilies: [] }
  const seen = new Set(state.codex.seenFamilies)
  let changed = false
  for (const raw of families) {
    if (!CODEX_FAMILIES.includes(raw as EnemyFamily)) continue
    if (seen.has(raw as EnemyFamily)) continue
    seen.add(raw as EnemyFamily)
    changed = true
  }
  if (changed) {
    state.codex.seenFamilies = CODEX_FAMILIES.filter((f) => seen.has(f))
  }
}

export interface SectorRosterEntry {
  key: string
  name: string
  family: EnemyFamily
  shape: UnitShape
  isBoss: boolean
  count: number
  summary: string
}

/** Unique enemy types across all waves in a sector (for the sector intel panel). */
export function sectorRoster(sector: number): SectorRosterEntry[] {
  const groups = new Map<string, SectorRosterEntry>()
  for (let wave = 1; wave <= WAVES_PER_SECTOR; wave++) {
    const encounter = enemyForSector(sector, wave)
    for (const u of encounter.units) {
      const key = `${u.family}:${u.name}`
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        continue
      }
      groups.set(key, {
        key,
        name: u.name,
        family: u.family as EnemyFamily,
        shape: u.shape,
        isBoss: u.isBoss,
        count: 1,
        summary: u.isBoss
          ? familyBlurb(u.family as EnemyFamily, true)
          : familyIntel(u.family as EnemyFamily),
      })
    }
  }
  return [...groups.values()]
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
    x: 0,
    y: 0,
    speed: 0,
    engageRange: 0,
    kite: false,
    phaseWarnLeft: 0,
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
          makeWeapon(
            `escort-wpn-${escortIndex}`,
            'Drone Pulse',
            droneDmg,
            1,
            70,
            ['kinetic'],
          ),
        ],
        isBoss: false,
        isFlagship: false,
        dots: [],
        x: 12 + (escortIndex % 2) * 10,
        y: escortIndex % 2 === 0 ? -22 - escortIndex * 4 : 22 + escortIndex * 4,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
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
    boss.engageRange = 80
    boss.kite = false
    boss.phaseWarnLeft = 0.9
    for (const w of boss.weapons) {
      w.damage *= 1.15
      w.telegraphLeft = 0
      w.cooldownLeft = Math.max(w.cooldownLeft, 0.45)
    }
    revealCodexFamilies(state, ['armored'])
    pushLog(state, 'Boss phase 2 — shell hardens [armored], closing in.')
  }

  if (state.combat.bossPhase < 2 && pct <= 1 / 3) {
    state.combat.bossPhase = 2
    state.combat.enemyFamily = 'ethereal'
    state.combat.enemyTags = ['ethereal', 'boss']
    boss.family = 'ethereal'
    boss.evasion = Math.min(0.35, boss.evasion + 0.1)
    boss.shield = Math.max(boss.shield, boss.shieldMax * 0.4)
    boss.engageRange = 125
    boss.kite = true
    boss.phaseWarnLeft = 0.9
    for (const w of boss.weapons) {
      w.damage *= 1.2
      w.range = Math.max(w.range, 130)
      w.telegraphLeft = 0
      w.cooldownLeft = Math.max(w.cooldownLeft, 0.45)
    }
    revealCodexFamilies(state, ['ethereal'])
    pushLog(state, 'Boss phase 3 — form frays [ethereal], kiting out.')
  }
}

/** Hull points restored per second while Paused (full) or between fights (field rate). */
export function repairRatePerSecond(state: GameState): number {
  let rate = 5
  if (aiDoctrinesActive(state, 'auto-engage')) rate *= 2
  if (state.shipyard.modules.includes('nano-lathe')) rate *= 1.5
  const shopMult = matterShopRepairMult(state.prestige.matterShop)
  rate /= Math.max(0.2, shopMult)
  rate *= 1 + challengeStackRepairBonus(state.prestige.challengeClears)
  rate += stationRepairBonus(state)
  return rate
}

export function shieldRepairRatePerSecond(state: GameState): number {
  return repairRatePerSecond(state) * 0.8
}

/** Continuous Advance always re-engages (death warps with full hull). */
export function canReengage(_state: GameState): boolean {
  return true
}

export const REENGAGE_HULL_FRACTION = 0

function laneDistance(a: CombatUnit, b: CombatUnit): number {
  return Math.abs(a.x - b.x)
}

function moveUnits(state: GameState, dt: number): void {
  // Player flagship stays at x=0, y=0. Escorts hold relative slots.
  for (const unit of state.combat.playerUnits) {
    if (!unit.isFlagship) continue
    unit.x = 0
    unit.y = 0
  }

  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const target = unit.engageRange
    if (unit.x > target + 2) {
      unit.x = Math.max(target, unit.x - unit.speed * dt)
    } else if (unit.kite && unit.x < target - 6) {
      unit.x = Math.min(target, unit.x + unit.speed * dt * 0.85)
    }
    // Slight vertical drift so packs don't stack perfectly
    unit.y += Math.sin(unit.x * 0.04 + unit.y) * 0.15
    unit.y = Math.max(-80, Math.min(80, unit.y))
  }
}

function pickTarget(
  attacker: CombatUnit,
  foes: CombatUnit[],
  weapon: WeaponInstance,
  focusFire: boolean,
): CombatUnit | null {
  const living = foes.filter(
    (u) => u.hull > 0 && laneDistance(attacker, u) <= weapon.range + 0.5,
  )
  if (living.length === 0) return null
  if (attacker.side === 'player' && focusFire) {
    living.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
      return a.hull / a.hullMax - b.hull / b.hullMax
    })
    return living[0] ?? null
  }
  // Prefer nearest in lane
  living.sort((a, b) => laneDistance(attacker, a) - laneDistance(attacker, b))
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

function findUnit(state: GameState, id: string): CombatUnit | undefined {
  return (
    state.combat.playerUnits.find((u) => u.id === id) ??
    state.combat.enemyUnits.find((u) => u.id === id)
  )
}

function spawnProjectile(
  state: GameState,
  from: CombatUnit,
  to: CombatUnit,
  damage: number,
  weapon: WeaponInstance,
): void {
  const tag = weapon.tags[0] ?? 'kinetic'
  projGlobalSeq += 1
  state.combat.projectiles.push({
    id: `proj-${projGlobalSeq}`,
    fromId: from.id,
    toId: to.id,
    side: from.side,
    tag,
    x: from.x,
    y: from.y,
    damage,
    tags: [...weapon.tags],
    dotDuration: weapon.dotDuration,
    dotDamage: weapon.dotDamage,
    speed: projectileSpeedForTag(tag),
    attackerFamily: from.family,
  })
}

/** Advance in-flight shots; damage applies only on impact. */
function updateProjectiles(
  state: GameState,
  dt: number,
  roles: Record<'weapon' | 'defense' | 'utility', number>,
  matchupScale: number,
): CombatFx[] {
  const hits: CombatFx[] = []
  const kept: CombatProjectile[] = []

  for (const shot of state.combat.projectiles) {
    const target = findUnit(state, shot.toId)
    if (!target || target.hull <= 0) {
      // Target gone — dissipate
      continue
    }

    const dx = target.x - shot.x
    const dy = target.y - shot.y
    const dist = Math.hypot(dx, dy)
    const step = shot.speed * dt

    if (dist <= Math.max(3, step)) {
      // Impact
      if (target.evasion > 0 && Math.random() < target.evasion) {
        fxGlobalSeq += 1
        hits.push({
          id: `fx-${fxGlobalSeq}`,
          fromId: shot.fromId,
          toId: shot.toId,
          tag: 'miss',
          ttl: 0.2,
        })
        continue
      }

      let dmg = shot.damage
      if (shot.side !== 'player') {
        dmg *= incomingDefenseMult(target, shot.attackerFamily, roles, matchupScale)
      }
      applyDamageToUnit(target, dmg, shot.tags)
      if (shot.dotDuration > 0 && shot.dotDamage > 0) {
        target.dots.push({ dps: shot.dotDamage, remaining: shot.dotDuration })
      }
      fxGlobalSeq += 1
      hits.push({
        id: `fx-${fxGlobalSeq}`,
        fromId: shot.fromId,
        toId: shot.toId,
        tag: shot.tag,
        ttl: 0.25,
      })
      continue
    }

    shot.x += (dx / dist) * step
    shot.y += (dy / dist) * step
    kept.push(shot)
  }

  state.combat.projectiles = kept.slice(-80)
  return hits
}

/**
 * Continuous combat step (real seconds, not ticks).
 * Weapons only fire when a living target is inside weapon.range.
 * Damage is deferred until projectiles impact.
 */
export function simulateCombat(
  state: GameState,
  dt: number,
  pushLog: (state: GameState, line: string) => void,
): void {
  if (dt <= 0) return
  const roles = fittedRoles(state)
  const matchupScale = 1 + challengeShopMatchupBonus(state.prestige.shop)
  const focusFire = aiDoctrinesActive(state, 'focus-fire')
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')

  moveUnits(state, dt)

  // Resolve in-flight impacts first so hull updates before new targeting
  const hitFx = updateProjectiles(state, dt, roles, matchupScale)

  const sides: Array<'player' | 'enemy'> = ['player', 'enemy']
  for (const side of sides) {
    const allies = side === 'player' ? state.combat.playerUnits : state.combat.enemyUnits
    const foes = side === 'player' ? state.combat.enemyUnits : state.combat.playerUnits

    for (const unit of allies) {
      if (unit.hull <= 0) continue

      for (const dot of unit.dots) {
        if (dot.remaining <= 0) continue
        unit.hull = Math.max(0, unit.hull - dot.dps * dt)
        dot.remaining -= dt
      }
      unit.dots = unit.dots.filter((d) => d.remaining > 0)

      if (unit.phaseWarnLeft > 0) {
        unit.phaseWarnLeft = Math.max(0, unit.phaseWarnLeft - dt)
      }

      for (const weapon of unit.weapons) {
        weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt)

        // Finish an active telegraph → fire.
        if (weapon.telegraphLeft > 0) {
          weapon.telegraphLeft = Math.max(0, weapon.telegraphLeft - dt)
          if (weapon.telegraphLeft > 0) continue
        } else if (weapon.cooldownLeft > 0) {
          continue
        } else if (weapon.telegraphDuration > 0) {
          // Begin wind-up instead of firing immediately.
          const windupTarget = pickTarget(unit, foes, weapon, focusFire && side === 'player')
          if (!windupTarget) continue
          weapon.telegraphLeft = weapon.telegraphDuration
          continue
        }

        const primary = pickTarget(unit, foes, weapon, focusFire && side === 'player')
        if (!primary) continue

        const targets: CombatUnit[] = [primary]
        if (weapon.splash > 0 || weapon.tags.includes('splash')) {
          const extras = foes
            .filter(
              (u) =>
                u.hull > 0 &&
                u.id !== primary.id &&
                laneDistance(unit, u) <= weapon.range + 0.5,
            )
            .sort((a, b) => laneDistance(unit, a) - laneDistance(unit, b))
            .slice(0, weapon.splash || 1)
          targets.push(...extras)
        }

        let fired = false
        for (const target of targets) {
          if (target.hull <= 0) continue

          let dmg = weapon.damage
          if (side === 'player') {
            dmg *= matchupMultiplier(
              weapon.tags,
              target,
              roles,
              matchupScale,
              bossProtocol,
            )
          }
          // Enemy defense mult applied on impact (uses current roles)

          spawnProjectile(state, unit, target, dmg, weapon)
          fired = true
        }

        if (fired) weapon.cooldownLeft = weapon.cooldown
      }
    }
  }

  state.combat.fx = [...hitFx, ...state.combat.fx.map((f) => ({ ...f, ttl: f.ttl - dt }))]
    .filter((f) => f.ttl > 0)
    .slice(0, 64)

  maybeAdvanceBossPhase(state, pushLog)
  syncHullAggregates(state)
}

/** @deprecated use simulateCombat — kept for tests that step one second. */
export function resolveCombatTick(
  state: GameState,
  pushLog: (state: GameState, line: string) => void,
): void {
  simulateCombat(state, 1, pushLog)
}

export function totalEnemyHull(encounter: SectorEncounter): number {
  return encounter.units.reduce((s, u) => s + u.hullMax, 0)
}

/** Estimated Hold-farm payout for one full sector clear (all waves + drips). */
export function estimateHoldClearRewards(state: GameState): {
  scrap: number
  data: number
  salvage: number
} {
  const sector = state.combat.sector
  const clear = enemyForSector(sector, WAVES_PER_SECTOR)
  let scrap = clear.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrap *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrap *= 1.2
  scrap *= 1 + matterShopScrapBonus(state.prestige.matterShop)

  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  const siphon =
    essenceBonusDataPerClear(state.essence.purchased) +
    matterShopDataPerClear(state.prestige.matterShop)
  const data =
    dataBlocked || !isSystemUnlocked(state, 'research') ? 0 : clear.dataReward + siphon
  let salvage = clear.salvageReward

  // Mid-wave drips for waves 1..(n-1)
  for (let w = 1; w < WAVES_PER_SECTOR; w += 1) {
    const drip = 1 + Math.floor(sector / 4)
    scrap += drip
    salvage += Math.max(1, Math.floor(drip / 2))
  }

  return { scrap, data, salvage }
}

/**
 * Hold Accountant rates: clear rewards ÷ estimated clear time from fleet DPS vs wave hull.
 */
export function estimateHoldFarmRates(state: GameState): {
  scrapPerSec: number
  dataPerSec: number
  salvagePerSec: number
  scrapPerClear: number
  clearSeconds: number
} {
  const rewards = estimateHoldClearRewards(state)
  const dps = Math.max(1, computeShipStats(state).damage)
  let hullTotal = 0
  for (let w = 1; w <= WAVES_PER_SECTOR; w += 1) {
    hullTotal += totalEnemyHull(enemyForSector(state.combat.sector, w))
  }
  // Floor keeps early sectors from reporting absurd r/s when packs die instantly.
  const clearSeconds = Math.max(8, hullTotal / dps)
  return {
    scrapPerSec: rewards.scrap / clearSeconds,
    dataPerSec: rewards.data / clearSeconds,
    salvagePerSec: rewards.salvage / clearSeconds,
    scrapPerClear: rewards.scrap,
    clearSeconds,
  }
}
