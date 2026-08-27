/** Production Act 1 Boss registry. Unique mechanics stay pending unless authored. */

import type { CombatUnit } from './types'
import {
  setBossProvider,
  type BossBuildContext,
  type BossEncounterSpec,
} from './bossProvider'
import { BOSS_WARNING_DURATION, isBossWave } from './waves'
import { FORMATION_IDS, formationRngFor, formationSlots, type FormationId } from './formations'
import { TYPICAL_SPAWN_RADIUS, pointFromBearing } from './geometry'
import { buildHostileUnit, getHostileDef, introducedHostiles, type HostileId } from './hostileCatalogue'
import {
  BOSS_SCALING,
  BOSS_WARNING_CROWN,
  BOSS_WARNING_DEFAULT,
  CHOIR_CROWN_SEEDS,
  enemyDamageScale,
  enemyWaveScale,
} from './hostileSeeds'
import { hashSeed } from './simRng'

export type BossId =
  | 'pack-tyrant-i'
  | 'broodheart-matriarch'
  | 'iron-behemoth-i'
  | 'iron-regent'
  | 'veil-seer-i'
  | 'veil-architect'
  | 'siege-node-i'
  | 'bastion-engine'
  | 'choir-exarch-i'
  | 'ember-cantor'
  | 'pack-tyrant-ii'
  | 'canticle-engine'
  | 'iron-behemoth-ii'
  | 'reclaimer-leviathan'
  | 'veil-seer-ii'
  | 'null-battery'
  | 'siege-node-ii'
  | 'crown-shepherd'
  | 'choir-exarch-ii'
  | 'choir-crown'

export type BossSourceKind =
  | 'foundry-flak'
  | 'heavy-lance'
  | 'grav-tether'
  | 'slag-spitter'
  | 'phase-beam'
  | 'sensor-array'
  | 'barrier-projector'
  | 'aegis-relay-route'
  | 'furnace-unlock'
  | 'reactor-choir-tap'
  | 'prismatic-lens-route'
  | 'phase-needle-route'
  | 'penetrator-guide-route'
  | 'salvage-matrix-route'
  | 'advanced-resources'
  | 'fixed-mount-route'
  | 'universal-resonator-route'
  | 'crown-signal'
  | 'crown-matrix'
  | 'act1-complete'

export type ChoirCrownPhase = 'convergence' | 'reconstruction' | 'loopbreak'

export interface BossDef {
  id: BossId
  name: string
  wave: number
  sourceKind: BossSourceKind
  sourceLabel: string
  mechanicStatus: 'authored' | 'pending'
  mechanicSummary: string | null
  warningDuration: number
}

export const BOSS_DEFS: readonly BossDef[] = [
  { id: 'pack-tyrant-i', name: 'Pack Tyrant I', wave: 50, sourceKind: 'foundry-flak', sourceLabel: 'Foundry + Flak discovery', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'broodheart-matriarch', name: 'Broodheart Matriarch', wave: 100, sourceKind: 'heavy-lance', sourceLabel: 'Heavy Lance', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'iron-behemoth-i', name: 'Iron Behemoth I', wave: 150, sourceKind: 'grav-tether', sourceLabel: 'Grav Tether', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'iron-regent', name: 'Iron Regent', wave: 200, sourceKind: 'slag-spitter', sourceLabel: 'Slag Spitter', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'veil-seer-i', name: 'Veil Seer I', wave: 250, sourceKind: 'phase-beam', sourceLabel: 'Phase Beam', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'veil-architect', name: 'Veil Architect', wave: 300, sourceKind: 'sensor-array', sourceLabel: 'Sensor Array', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'siege-node-i', name: 'Siege Node I', wave: 350, sourceKind: 'barrier-projector', sourceLabel: 'Barrier Projector', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'bastion-engine', name: 'Bastion Engine', wave: 400, sourceKind: 'aegis-relay-route', sourceLabel: 'Aegis Relay route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'choir-exarch-i', name: 'Choir Exarch I', wave: 450, sourceKind: 'furnace-unlock', sourceLabel: 'Furnace unlock source', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'ember-cantor', name: 'Ember Cantor', wave: 500, sourceKind: 'reactor-choir-tap', sourceLabel: 'Reactor Frame route / Choir Tap progression', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'pack-tyrant-ii', name: 'Pack Tyrant II', wave: 550, sourceKind: 'prismatic-lens-route', sourceLabel: 'Prismatic Lens route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'canticle-engine', name: 'Canticle Engine', wave: 600, sourceKind: 'phase-needle-route', sourceLabel: 'Phase Needle route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'iron-behemoth-ii', name: 'Iron Behemoth II', wave: 650, sourceKind: 'penetrator-guide-route', sourceLabel: 'Penetrator Guide route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'reclaimer-leviathan', name: 'Reclaimer Leviathan', wave: 700, sourceKind: 'salvage-matrix-route', sourceLabel: 'Salvage Matrix route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'veil-seer-ii', name: 'Veil Seer II', wave: 750, sourceKind: 'advanced-resources', sourceLabel: 'advanced resources', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'null-battery', name: 'Null Battery', wave: 800, sourceKind: 'fixed-mount-route', sourceLabel: 'Fixed Mount route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'siege-node-ii', name: 'Siege Node II', wave: 850, sourceKind: 'universal-resonator-route', sourceLabel: 'Universal Resonator route', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'crown-shepherd', name: 'Crown Shepherd', wave: 900, sourceKind: 'crown-signal', sourceLabel: 'Crown Signal / finale location', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  { id: 'choir-exarch-ii', name: 'Choir Exarch II', wave: 950, sourceKind: 'crown-matrix', sourceLabel: 'Crown Matrix / finale materials', mechanicStatus: 'pending', mechanicSummary: null, warningDuration: BOSS_WARNING_DEFAULT },
  {
    id: 'choir-crown',
    name: 'Choir Crown',
    wave: 1000,
    sourceKind: 'act1-complete',
    sourceLabel: 'Act 1 completion source',
    mechanicStatus: 'authored',
    mechanicSummary: 'Three phases: CONVERGENCE (Shield + family echoes), RECONSTRUCTION (Armor + slam + shell nodes), LOOPBREAK (telegraphed Core jams, mixed fronts, rising pressure, no giant regen).',
    warningDuration: BOSS_WARNING_CROWN,
  },
]

const BY_WAVE = new Map(BOSS_DEFS.map((d) => [d.wave, d]))
const BY_ID = new Map(BOSS_DEFS.map((d) => [d.id, d]))

export function getBossDef(id: string | undefined | null): BossDef | undefined {
  if (!id) return undefined
  return BY_ID.get(id as BossId)
}

export function bossDefForWave(wave: number): BossDef | undefined {
  return BY_WAVE.get(Math.max(0, Math.floor(wave)))
}

export function isBossId(id: string): id is BossId {
  return BY_ID.has(id as BossId)
}

function ehpMultForWave(wave: number): number {
  if (wave >= 1000) return BOSS_SCALING.crownEhpMult
  if (wave % 100 === 0) return BOSS_SCALING.signatureEhpMult
  return BOSS_SCALING.championEhpMult
}

function echoHostileIds(wave: number, seed: number, count: number): HostileId[] {
  const pool = introducedHostiles(wave).map((d) => d.id)
  if (pool.length === 0) return []
  const out: HostileId[] = []
  for (let i = 0; i < count; i++) {
    const idx = hashSeed(seed, wave, 0xec40, i) % pool.length
    const id = pool[idx]!
    if (!out.includes(id)) out.push(id)
  }
  while (out.length < Math.min(count, pool.length)) {
    const next = pool[out.length % pool.length]!
    if (!out.includes(next)) out.push(next)
    else break
  }
  return out
}

function place(units: CombatUnit[], wave: number, seed: number, formation: FormationId): void {
  const rng = formationRngFor(seed, wave, 90)
  const slots = formationSlots(formation, units.length, { rng, wave, packageId: `boss-w${wave}` })
  units.forEach((unit, i) => {
    const slot = slots[i] ?? slots[0]!
    unit.x = slot.x
    unit.y = slot.y
    unit.heading = slot.bearing
  })
}

function scaleBossBody(unit: CombatUnit, wave: number): CombatUnit {
  const mult = ehpMultForWave(wave)
  const hull = Math.max(1, unit.hullMax * mult)
  const shield = Math.max(0, Math.max(unit.shieldMax, unit.hullMax * BOSS_SCALING.shieldFrac) * hull / Math.max(1, unit.hullMax) * (wave >= 1000 ? 1.4 : 1))
  unit.hullMax = hull
  unit.hull = hull
  unit.shieldMax = shield
  unit.shield = shield
  unit.armor = unit.armor + BOSS_SCALING.armorAdd
  unit.authoredHullMax = hull
  unit.authoredShieldMax = shield
  unit.authoredArmor = unit.armor
  unit.isBoss = true
  unit.isFlagship = true
  unit.role = 'boss'
  unit.rewardWeight = 1
  unit.shape = 'hex'
  for (const wpn of unit.weapons) {
    wpn.damage *= BOSS_SCALING.damageMult
  }
  return unit
}

function genericEscorts(wave: number, seed: number, count: number): CombatUnit[] {
  const ids = echoHostileIds(wave, seed, count)
  return ids.map((id, i) => {
    const def = getHostileDef(id)!
    const unit = buildHostileUnit({ def, wave })
    unit.rewardWeight = 0.45
    unit.id = `draft-boss-escort-${i}`
    return unit
  })
}

function buildChoirCrown(ctx: BossBuildContext, def: BossDef): CombatUnit[] {
  const hullScale = enemyWaveScale(ctx.wave)
  const dmgScale = enemyDamageScale(ctx.wave)
  const pos = pointFromBearing(0, TYPICAL_SPAWN_RADIUS)
  const hull = 48 * hullScale * BOSS_SCALING.crownEhpMult
  const shield = hull * 0.55
  const boss: CombatUnit = {
    id: 'draft-choir-crown',
    side: 'enemy',
    name: def.name,
    shape: 'hex',
    family: '',
    familyStatus: 'pending',
    hostileId: undefined,
    bossId: def.id,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    armor: 6,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [
      {
        id: 'choir-crown-wpn',
        name: 'Crown pulse',
        damage: 6.5 * dmgScale * BOSS_SCALING.damageMult,
        cooldown: 1.6,
        cooldownLeft: 0.4,
        range: 110,
        tags: ['energy'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0.5,
        telegraphLeft: 0,
      },
    ],
    isBoss: true,
    isFlagship: true,
    role: 'boss',
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: 0,
    speed: 14,
    authoredSpeed: 14,
    authoredHullMax: hull,
    authoredShieldMax: shield,
    authoredArmor: 6,
    engageRange: 120,
    kite: true,
    phaseWarnLeft: 0,
    regenDelay: 0,
    rewardWeight: 1,
    choirCrownPhase: 'convergence',
    choirCrownPhaseStartedAt: 0,
  }
  const echoes = echoHostileIds(ctx.wave, ctx.seed, CHOIR_CROWN_SEEDS.echoCount).map((id, i) => {
    const unit = buildHostileUnit({ def: getHostileDef(id)!, wave: ctx.wave })
    unit.isBossSupport = true
    unit.rewardWeight = 0.4
    unit.id = `draft-crown-echo-${i}`
    return unit
  })
  const units = [boss, ...echoes]
  place(units, ctx.wave, ctx.seed, 'encirclement')
  return units
}

function buildStandardBoss(ctx: BossBuildContext, def: BossDef): CombatUnit[] {
  const leadId = echoHostileIds(ctx.wave, ctx.seed, 1)[0] ?? 'void-mite'
  const body = scaleBossBody(buildHostileUnit({ def: getHostileDef(leadId)!, wave: ctx.wave }), ctx.wave)
  body.name = def.name
  body.bossId = def.id
  body.hostileId = undefined
  body.family = ''
  body.familyStatus = 'pending'
  const escorts = genericEscorts(ctx.wave, ctx.seed + 17, ctx.wave >= 500 ? 2 : 1)
  const units = [body, ...escorts]
  const formation = FORMATION_IDS[hashSeed(ctx.seed, ctx.wave, 0xb055) % FORMATION_IDS.length]!
  place(units, ctx.wave, ctx.seed, formation)
  return units
}

export function productionBossProvider(ctx: BossBuildContext): BossEncounterSpec | null {
  if (!isBossWave(ctx.wave)) return null
  const def = bossDefForWave(ctx.wave)
  if (!def) return null
  const units = def.id === 'choir-crown' ? buildChoirCrown(ctx, def) : buildStandardBoss(ctx, def)
  return {
    id: def.id,
    name: def.name,
    warningDuration: def.warningDuration || BOSS_WARNING_DURATION,
    units,
    blurb: def.mechanicSummary ?? `${def.name}. Unique mechanic pending design.`,
  }
}

export function registerProductionBossProvider(): void {
  setBossProvider(productionBossProvider)
}

registerProductionBossProvider()
