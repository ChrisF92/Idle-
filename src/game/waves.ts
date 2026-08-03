/**
 * Phase 1 procedural wave packs for Sector 1 Expeditions.
 * Deterministic per (sectorId, wave). Authored packs can override later.
 */

import {
  ARENA_RADIUS,
  SPAWN_RADIUS,
  polarToCartesian,
  spawnSectorAngle,
} from './arena'
import { seededRng } from './rng'
import type { CombatUnit, UnitShape, WeaponInstance, WeaponTag } from './types'

export type EnemyFamily = 'swarm' | 'armored' | 'ethereal' | 'divine' | 'titan'

export interface WaveEncounter {
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

const NAMES: Record<EnemyFamily, string[]> = {
  swarm: ['Void Mite', 'Ashen Drifter', 'Needle Cloud', 'Drift Spur'],
  armored: ['Hive Shard', 'Carapace Walker', 'Iron Cyst', 'Plate Beetle'],
  ethereal: ['Phase Wisp', 'Echo Veil', 'Null Mirage', 'Slip Ghost'],
  divine: ['God-Spark Remnant', 'Halo Fragment', 'Choir Speck', 'Aureole'],
  titan: ['Frontier Entity', 'Leviathan Seed', 'Throne Husk'],
}

const FAMILY_SHAPE: Record<EnemyFamily, UnitShape> = {
  swarm: 'circle',
  armored: 'square',
  ethereal: 'diamond',
  divine: 'hex',
  titan: 'hex',
}

let unitSeq = 0
function nextId(prefix: string): string {
  unitSeq += 1
  return `${prefix}-${unitSeq}`
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

function makeEnemy(opts: {
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
  angle: number
  spawnRadius?: number
}): CombatUnit {
  const spawnR = opts.spawnRadius ?? SPAWN_RADIUS
  const pos = polarToCartesian(spawnR, opts.angle)
  return {
    id: nextId(`e-${opts.family}`),
    side: 'enemy',
    name: opts.name,
    shape: FAMILY_SHAPE[opts.family],
    family: opts.family,
    hull: opts.hull,
    hullMax: opts.hull,
    shield: opts.shield ?? 0,
    shieldMax: opts.shield ?? 0,
    armor: opts.armor ?? 0,
    evasion: opts.evasion ?? 0,
    damageTakenMult: 1,
    weapons: [
      makeWeapon(
        nextId('ew'),
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
    x: pos.x,
    y: pos.y,
    speed: opts.speed,
    engageRange: opts.engageRange,
    kite: opts.kite ?? false,
    phaseWarnLeft: 0,
  }
}

/** Hull scale across Sector 1 waves (provisional). */
export function waveHullScale(wave: number): number {
  return Math.pow(1.028, Math.max(0, wave - 1))
}

/** Enemy damage scale across Sector 1 waves (provisional). */
export function waveDamageScale(wave: number): number {
  return 0.85 * Math.pow(1.018, Math.max(0, wave - 1))
}

function familyWeights(wave: number): Partial<Record<EnemyFamily, number>> {
  if (wave >= 100 && wave % 25 === 0) return { titan: 1 }
  if (wave <= 19) return { swarm: 1 }
  if (wave <= 44) return { swarm: 0.65, armored: 0.35 }
  if (wave <= 74) return { swarm: 0.45, armored: 0.3, ethereal: 0.25 }
  if (wave <= 99) return { swarm: 0.35, armored: 0.25, ethereal: 0.25, divine: 0.15 }
  // Endless mixed
  return { swarm: 0.3, armored: 0.25, ethereal: 0.2, divine: 0.15, titan: 0.1 }
}

function pickFamily(
  weights: Partial<Record<EnemyFamily, number>>,
  rng: () => number,
): EnemyFamily {
  const entries = Object.entries(weights) as [EnemyFamily, number][]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [family, weight] of entries) {
    roll -= weight
    if (roll <= 0) return family
  }
  return entries[0]?.[0] ?? 'swarm'
}

function pickName(family: EnemyFamily, rng: () => number): string {
  const list = NAMES[family]
  return list[Math.floor(rng() * list.length)] ?? family
}

function unitCountForWave(wave: number, rng: () => number): number {
  if (wave === 100) return 1
  if (wave % 25 === 0 && wave > 100) return 1
  const base = 3 + Math.floor(wave / 12)
  const jitter = Math.floor(rng() * 3)
  return Math.min(14, base + jitter)
}

function familyStats(
  family: EnemyFamily,
  wave: number,
  elite: boolean,
): {
  hull: number
  armor: number
  shield: number
  evasion: number
  damage: number
  speed: number
  engageRange: number
  kite: boolean
  tags: WeaponTag[]
  splash: number
  range: number
  cooldown: number
} {
  const h = waveHullScale(wave)
  const d = waveDamageScale(wave)
  const eliteMult = elite ? 1.65 : 1

  switch (family) {
    case 'swarm':
      return {
        hull: 18 * h * eliteMult,
        armor: 0,
        shield: 0,
        evasion: 0.02,
        damage: 4 * d * eliteMult,
        speed: 55 + Math.min(25, wave * 0.2),
        engageRange: 35 + (elite ? 10 : 0),
        kite: false,
        tags: elite ? ['kinetic', 'splash'] : ['kinetic'],
        splash: elite ? 1 : 0,
        range: 50,
        cooldown: 0.85,
      }
    case 'armored':
      return {
        hull: 40 * h * eliteMult,
        armor: 3 + Math.floor(wave / 20),
        shield: 0,
        evasion: 0,
        damage: 7 * d * eliteMult,
        speed: 28,
        engageRange: 55,
        kite: false,
        tags: ['kinetic'],
        splash: 0,
        range: 60,
        cooldown: 1.2,
      }
    case 'ethereal':
      return {
        hull: 22 * h * eliteMult,
        armor: 0,
        shield: 12 * h * 0.4,
        evasion: 0.12 + (elite ? 0.05 : 0),
        damage: 6 * d * eliteMult,
        speed: 40,
        engageRange: 110,
        kite: true,
        tags: ['energy'],
        splash: 0,
        range: 125,
        cooldown: 1.05,
      }
    case 'divine':
      return {
        hull: 30 * h * eliteMult,
        armor: 1,
        shield: 18 * h * 0.5,
        evasion: 0.06,
        damage: 8 * d * eliteMult,
        speed: 32,
        engageRange: 95,
        kite: true,
        tags: ['energy', 'antiShield'],
        splash: 0,
        range: 115,
        cooldown: 1.15,
      }
    case 'titan':
      return {
        hull: 220 * h * (wave >= 100 ? 1.4 : 1),
        armor: 6,
        shield: 80 * h * 0.5,
        evasion: 0.04,
        damage: 14 * d,
        speed: 18,
        engageRange: 90,
        kite: false,
        tags: ['kinetic', 'splash'],
        splash: 2,
        range: 130,
        cooldown: 1.6,
      }
  }
}

function isEliteWave(wave: number): boolean {
  return wave % 5 === 0 && wave % 10 !== 0 && wave < 100
}

function isCommanderOrBossWave(wave: number): boolean {
  return wave === 100 || (wave > 100 && wave % 25 === 0) || wave === 20 || wave === 50 || wave === 75
}

/**
 * Build a deterministic procedural encounter for a Sector wave.
 */
export function encounterForWave(sectorId: string, wave: number): WaveEncounter {
  const rng = seededRng(sectorId, wave)
  const boss = wave === 100 || (wave > 100 && wave % 25 === 0)
  const elite = !boss && isEliteWave(wave)
  const weights = familyWeights(wave)
  const primary = boss ? ('titan' as EnemyFamily) : pickFamily(weights, rng)

  const units: CombatUnit[] = []
  const count = boss ? 1 + (wave === 100 ? 2 : 0) : unitCountForWave(wave, rng)

  if (boss) {
    const stats = familyStats('titan', wave, false)
    const angle = spawnSectorAngle(0, (rng() - 0.5) * 0.3)
    units.push(
      makeEnemy({
        name: wave === 100 ? 'Frontier Entity' : pickName('titan', rng),
        family: 'titan',
        hull: stats.hull,
        armor: stats.armor,
        shield: stats.shield,
        evasion: stats.evasion,
        damage: stats.damage,
        cooldown: stats.cooldown,
        range: stats.range,
        speed: stats.speed,
        engageRange: stats.engageRange,
        kite: false,
        tags: stats.tags,
        splash: stats.splash,
        telegraphDuration: 0.85,
        isBoss: true,
        angle,
        spawnRadius: SPAWN_RADIUS + 8,
      }),
    )
    // Support thralls for wave 100
    if (wave === 100) {
      for (let i = 0; i < 2; i += 1) {
        const thrall = familyStats('swarm', wave, true)
        units.push(
          makeEnemy({
            name: 'Entity Thrall',
            family: 'swarm',
            hull: thrall.hull * 0.7,
            damage: thrall.damage * 0.8,
            range: thrall.range,
            speed: thrall.speed,
            engageRange: thrall.engageRange,
            tags: ['kinetic'],
            angle: spawnSectorAngle(2 + i * 3, (rng() - 0.5) * 0.4),
          }),
        )
      }
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      const family =
        i === 0 ? primary : pickFamily(weights, rng)
      const stats = familyStats(family, wave, elite && i === 0)
      const sector = Math.floor(rng() * 8)
      const jitter = (rng() - 0.5) * 0.35
      units.push(
        makeEnemy({
          name: elite && i === 0 ? `Elite ${pickName(family, rng)}` : pickName(family, rng),
          family,
          hull: stats.hull * (0.85 + rng() * 0.3),
          armor: stats.armor,
          shield: stats.shield,
          evasion: stats.evasion,
          damage: stats.damage * (0.9 + rng() * 0.2),
          cooldown: stats.cooldown,
          range: stats.range,
          speed: stats.speed * (0.9 + rng() * 0.2),
          engageRange: stats.engageRange + (rng() - 0.5) * 8,
          kite: stats.kite,
          tags: stats.tags,
          splash: stats.splash,
          angle: spawnSectorAngle(sector, jitter),
          spawnRadius: SPAWN_RADIUS + (rng() - 0.5) * 10,
        }),
      )
    }
  }

  const scrapReward = Math.round(2 + wave * 0.35 + (elite ? 4 : 0) + (boss ? 20 : 0))
  const salvageReward = Math.round(1 + wave * 0.25 + (elite ? 3 : 0) + (boss ? 12 : 0))
  const dataReward = wave >= 15 ? Math.round(1 + wave * 0.08) : 0
  const essenceReward = boss || isCommanderOrBossWave(wave) ? Math.round(1 + wave * 0.05) : 0

  const name = boss
    ? units[0]?.name ?? 'Entity'
    : elite
      ? `Elite ${NAMES[primary][0]} Pack`
      : `${NAMES[primary][0]} Pack`

  return {
    id: `${sectorId}-w${wave}`,
    name,
    family: primary,
    tags: [primary, ...(elite ? ['elite'] : []), ...(boss ? ['boss'] : [])],
    isBoss: boss,
    scrapReward,
    dataReward,
    aiReward: 0,
    essenceReward,
    salvageReward,
    blurb: boss
      ? 'Sector Entity — survive the examination.'
      : elite
        ? 'Elite pressure spike.'
        : `${primary} hostiles inbound from the perimeter.`,
    units,
  }
}

/** @deprecated Prefer encounterForWave — kept for transitional call sites. */
export function enemyForSector(sector: number, wave = 1): WaveEncounter {
  // Bridge: old sector/wave pairs → expedition wave ≈ (sector-1)*7 + wave
  // During Phase 1 combat.sector stays 1 and combat.wave is the expedition wave.
  const expeditionWave = sector <= 1 ? wave : (sector - 1) * 7 + wave
  return encounterForWave('sector-1', expeditionWave)
}

export function familyIntel(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Fast packs. Splash and fire rate excel.'
    case 'armored':
      return 'Heavy plating. Pierce and sustained fire help.'
    case 'ethereal':
      return 'Phase kites. Energy weapons and accuracy matter.'
    case 'divine':
      return 'Shielded specialists. Anti-shield and focus fire.'
    case 'titan':
      return 'Entity-class threat. Prepare for phases and pressure.'
  }
}

export function softCounterForFamily(family: EnemyFamily): string {
  switch (family) {
    case 'swarm':
      return 'Flak / splash'
    case 'armored':
      return 'Pierce weapons'
    case 'ethereal':
      return 'Energy / sensors'
    case 'divine':
      return 'Anti-shield'
    case 'titan':
      return 'Balanced loadout'
  }
}

export function familyShape(family: EnemyFamily): UnitShape {
  return FAMILY_SHAPE[family]
}

/** Soft cap so early escorts stay readable inside the orbital ring. */
export function escortOrbitPosition(index: number): { x: number; y: number } {
  const radius = 28 + (index % 3) * 8
  const angle = -Math.PI / 2 + index * 0.9
  return polarToCartesian(radius, angle)
}

export { ARENA_RADIUS }
