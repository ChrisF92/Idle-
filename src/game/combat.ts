/**
 * Phase 1 orbital-defence combat.
 * Flagship holds (0,0); enemies approach on radial lanes from the spawn ring.
 */

import type {
  CombatFx,
  CombatProjectile,
  CombatUnit,
  GameState,
  PartType,
  UnitShape,
  WeaponInstance,
  WeaponTag,
} from './types'
import {
  SPAWN_DISTANCE,
  SPAWN_RADIUS,
  PROJECTILE_SPEED,
  arenaDistance,
  moveRadial,
  polarToCartesian,
} from './arena'
import {
  encounterForWave,
  enemyForSector,
  familyIntel,
  softCounterForFamily,
  familyShape,
  escortOrbitPosition,
  waveHullScale,
  waveDamageScale,
  type EnemyFamily,
  type WaveEncounter,
} from './waves'
import {
  aiDoctrinesActive,
  challengeShopDropBonus,
  challengeShopMatchupBonus,
  challengeStackRepairBonus,
  essenceBonusDataPerClear,
  getEnemyDropTable,
  getModule,
  isStationUnlocked,
  matterShopDataPerClear,
  matterShopDropBonus,
  matterShopRepairMult,
  matterShopScrapBonus,
  partId,
  pickWeightedDropEntry,
  stationRepairBonus,
} from './catalog'
import { isSystemUnlocked } from './progression'
import { buildFlagshipWeapons, computeShipStats, globalDamageMultiplier } from './state'
import {
  logisticsDropMult,
  reactorsRepairMult,
  sensorsMatchupBonus,
} from './core'
import { computeSignalCoreBonuses, grantSignalCoreDrop } from './signalCores'
import { computeExpeditionUpgradeBonuses } from './expeditionUpgrades'
import { computeForwardBaseBonuses } from './forwardBase'

/* ── Re-exports (arena / waves) ─────────────────────────────────────── */

export {
  SPAWN_DISTANCE,
  SPAWN_RADIUS,
  PROJECTILE_SPEED,
  encounterForWave,
  enemyForSector,
  familyIntel,
  softCounterForFamily,
  familyShape,
  escortOrbitPosition,
}
export type { EnemyFamily }
/** @deprecated Prefer WaveEncounter — alias kept for call sites. */
export type SectorEncounter = WaveEncounter

/** @deprecated Use PROJECTILE_SPEED — tag variance removed. */
export function projectileSpeedForTag(_tag: string): number {
  return PROJECTILE_SPEED
}

/** Expedition boss waves (wave 100 Entity + endless %25). */
export function isBossWave(wave: number): boolean {
  return wave === 100 || (wave > 100 && wave % 25 === 0)
}

/** @deprecated Prefer isBossWave — legacy sector-index boss check. */
export function isBossSector(sector: number): boolean {
  return sector > 0 && sector % 5 === 0
}

/** Hull scale alias — argument treated as expedition wave in Phase 1. */
export function enemySectorScale(waveOrSector: number): number {
  return waveHullScale(waveOrSector)
}

/** Damage scale alias — argument treated as expedition wave in Phase 1. */
export function enemyDamageScale(waveOrSector: number): number {
  return waveDamageScale(waveOrSector)
}

/* ── Codex ──────────────────────────────────────────────────────────── */

export const CODEX_FAMILIES: EnemyFamily[] = [
  'swarm',
  'armored',
  'ethereal',
  'divine',
  'titan',
]

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

/* ── Sector roster (sample waves — no WAVES_PER_SECTOR loop) ────────── */

export interface SectorRosterEntry {
  key: string
  name: string
  family: EnemyFamily
  shape: UnitShape
  isBoss: boolean
  count: number
  summary: string
  hull: number
  shield: number
  armor: number
  evasion: number
  dps: number
  speed: number
  range: number
  weaponTags: WeaponTag[]
}

function rosterStatsFromUnit(u: CombatUnit): Pick<
  SectorRosterEntry,
  'hull' | 'shield' | 'armor' | 'evasion' | 'dps' | 'speed' | 'range' | 'weaponTags'
> {
  const weapon = u.weapons[0]
  const cooldown = Math.max(0.05, weapon?.cooldown ?? 1)
  return {
    hull: u.hullMax,
    shield: u.shieldMax,
    armor: u.armor,
    evasion: u.evasion,
    dps: (weapon?.damage ?? 0) / cooldown,
    speed: u.speed,
    range: weapon?.range ?? 0,
    weaponTags: [...(weapon?.tags ?? [])],
  }
}

const ROSTER_SAMPLE_WAVES = [1, 5, 10, 15, 20] as const

/** Sample enemy types from milestone waves (Phase 1 intel panel). */
export function sectorRoster(_sector: number): SectorRosterEntry[] {
  const groups = new Map<string, SectorRosterEntry>()
  for (const wave of ROSTER_SAMPLE_WAVES) {
    const encounter = encounterForWave('sector-1', wave)
    for (const u of encounter.units) {
      const key = `${u.family}:${u.name}`
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        if (u.hullMax > existing.hull) {
          Object.assign(existing, rosterStatsFromUnit(u))
        }
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
          ? 'Sector Entity — survive the examination.'
          : familyIntel(u.family as EnemyFamily),
        ...rosterStatsFromUnit(u),
      })
    }
  }
  return [...groups.values()]
}

/* ── Player fleet ───────────────────────────────────────────────────── */

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
  const run = computeExpeditionUpgradeBonuses(state.combat.upgrades)
  const base = computeForwardBaseBonuses(state)
  const storeDmg = (run.damageMult - 1) * base.offenceRankScale
  const escortDmgMult = (1 + storeDmg) * base.gunneryDamageMult
  const droneDmg = 6 * globalDamageMultiplier(state) * escortDmgMult
  const fireRate = (1 + (run.fireRateMult - 1) * base.offenceRankScale) * base.gunneryFireRateMult
  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    const n = mod?.escorts ?? 0
    for (let i = 0; i < n; i += 1) {
      const slot = escortOrbitPosition(escortIndex)
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
            Math.max(0.2, 1 / fireRate),
            70 * run.rangeMult,
            ['kinetic'],
          ),
        ],
        isBoss: false,
        isFlagship: false,
        dots: [],
        x: slot.x,
        y: slot.y,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
      })
    }
  }

  return [flagship, ...escorts]
}

/* ── Fight summary / matchup hints ──────────────────────────────────── */

export interface FightSummary {
  playerDps: number
  enemyDps: number
  matchupNotes: string[]
  playerAlive: number
  enemyAlive: number
}

function fittedRoles(state: GameState): Record<'weapon' | 'defense' | 'utility', number> {
  const counts = { weapon: 0, defense: 0, utility: 0 }
  for (const id of state.shipyard.modules) {
    const role = getModule(id)?.role
    if (role) counts[role] += 1
  }
  return counts
}

/** Rough DPS / matchup notes for UI (not the live resolution path). */
export function computeFightDamage(state: GameState): FightSummary {
  const stats = computeShipStats(state)
  const family = (state.combat.enemyFamily || 'swarm') as EnemyFamily
  const roles = fittedRoles(state)
  const notes: string[] = []
  const matchupScale =
    1 +
    challengeShopMatchupBonus(state.prestige.shop) +
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup

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

  const wave = Math.max(1, state.combat.wave)
  const enemyUnits =
    state.combat.enemyUnits.length > 0
      ? state.combat.enemyUnits
      : encounterForWave('sector-1', wave).units
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

/* ── Aggregates / boss phases / repair ──────────────────────────────── */

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

/** Auto boss phase shifts — retags titan resistances. Keeps polar position. */
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
  if (state.shipyard.modules.includes('nano-lathe')) rate *= 1.6
  const shopMult = matterShopRepairMult(state.prestige.matterShop)
  rate /= Math.max(0.2, shopMult)
  rate *= 1 + challengeStackRepairBonus(state.prestige.challengeClears)
  rate += stationRepairBonus(state)
  rate *= reactorsRepairMult(state.core?.ranks.reactors ?? 0)
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

/* ── Movement / targeting ───────────────────────────────────────────── */

function moveUnits(state: GameState, dt: number): void {
  let escortIdx = 0
  for (const unit of state.combat.playerUnits) {
    if (unit.isFlagship) {
      unit.x = 0
      unit.y = 0
    } else {
      const slot = escortOrbitPosition(escortIdx)
      unit.x = slot.x
      unit.y = slot.y
      escortIdx += 1
    }
  }

  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const r = Math.hypot(unit.x, unit.y)
    const target = unit.engageRange
    if (r > target + 2) {
      const next = moveRadial(unit.x, unit.y, target, unit.speed, dt)
      unit.x = next.x
      unit.y = next.y
    } else if (unit.kite && r < target - 6) {
      const next = moveRadial(unit.x, unit.y, target, unit.speed * 0.85, dt)
      unit.x = next.x
      unit.y = next.y
    }
    // Slight tangential drift so packs don't stack perfectly
    const curR = Math.hypot(unit.x, unit.y)
    if (curR > 1e-6) {
      const angle = Math.atan2(unit.y, unit.x)
      const drift = Math.sin(curR * 0.04 + angle) * 0.002
      const next = polarToCartesian(curR, angle + drift)
      unit.x = next.x
      unit.y = next.y
    }
  }
}

function pickTarget(
  attacker: CombatUnit,
  foes: CombatUnit[],
  weapon: WeaponInstance,
  focusFire: boolean,
): CombatUnit | null {
  const living = foes.filter(
    (u) => u.hull > 0 && arenaDistance(attacker, u) <= weapon.range + 0.5,
  )
  if (living.length === 0) return null
  if (attacker.side === 'player' && focusFire) {
    living.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
      return a.hull / a.hullMax - b.hull / b.hullMax
    })
    return living[0] ?? null
  }
  living.sort((a, b) => arenaDistance(attacker, a) - arenaDistance(attacker, b))
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

/* ── Loot / damage / projectiles ────────────────────────────────────── */

export interface PartDropResult {
  partId: string
  moduleId: string
  partType: PartType
  discovered: boolean
}

/**
 * Roll blueprint part drops for a slain enemy.
 * Parts stay offline until Alloy Foundry is unlocked (alloy-smelting + Research).
 */
export function rollEnemyPartDrop(
  state: GameState,
  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name'>,
  rng: () => number = Math.random,
): PartDropResult[] {
  if (!isStationUnlocked(state, 'alloy-foundry')) return []

  const table = getEnemyDropTable(unit.family)
  if (!table) return []

  let chance =
    table.chance *
    logisticsDropMult(state) *
    (1 + computeSignalCoreBonuses(state).drop) *
    (1 +
      matterShopDropBonus(state.prestige.matterShop) +
      challengeShopDropBonus(state.prestige.shop))
  let rolls = 1
  if (unit.isBoss) {
    chance = Math.min(1, chance * (table.bossChanceMult ?? 2))
    rolls = table.bossRolls ?? 2
  } else {
    chance = Math.min(1, chance)
  }

  const results: PartDropResult[] = []
  for (let i = 0; i < rolls; i++) {
    if (rng() > chance) continue
    const entry = pickWeightedDropEntry(unit.family, state.combat.sector, rng)
    if (!entry) continue
    const id = partId(entry.moduleId, entry.partType)
    state.parts = {
      ...state.parts,
      [id]: (state.parts[id] ?? 0) + 1,
    }
    let discovered = false
    if (!state.meta.discoveredModules.includes(entry.moduleId)) {
      state.meta.discoveredModules = [
        ...state.meta.discoveredModules,
        entry.moduleId,
      ]
      discovered = true
      const modName = getModule(entry.moduleId)?.name ?? entry.moduleId
      const partLabel =
        entry.partType.charAt(0).toUpperCase() + entry.partType.slice(1)
      state.combat.log = [
        `Blueprint fragment recovered: ${modName} ${partLabel}`,
        ...state.combat.log,
      ].slice(0, 40)
    }
    results.push({
      partId: id,
      moduleId: entry.moduleId,
      partType: entry.partType,
      discovered,
    })
  }
  return results
}

function tryLootEnemyKill(
  state: GameState,
  unit: CombatUnit,
  prevHull: number,
): void {
  if (unit.side !== 'enemy') return
  if (prevHull > 0 && unit.hull <= 0) {
    rollEnemyPartDrop(state, unit)
    grantSignalCoreDrop(state, 'kill', { family: unit.family })
    const run = computeExpeditionUpgradeBonuses(state.combat.upgrades)
    const base = computeForwardBaseBonuses(state)
    const salvageGain = run.salvagePerKill + base.salvageKillFlat
    if (salvageGain > 0) {
      state.resources.salvage += salvageGain
      state.combat.runSalvageEarned += salvageGain
    }
  }
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

let fxGlobalSeq = 0
let projGlobalSeq = 0

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
    speed: PROJECTILE_SPEED,
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
    if (!target || target.hull <= 0) continue

    const dx = target.x - shot.x
    const dy = target.y - shot.y
    const dist = Math.hypot(dx, dy)
    const step = shot.speed * dt

    if (dist <= Math.max(3, step)) {
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
      if (shot.side === 'player') {
        const run = computeExpeditionUpgradeBonuses(state.combat.upgrades)
        if (target.isBoss) dmg *= run.bossDamageMult
        if (run.critChance > 0 && Math.random() < run.critChance) {
          dmg *= run.critDamageMult
        }
      } else {
        dmg *= incomingDefenseMult(target, shot.attackerFamily, roles, matchupScale)
      }
      const prevHull = target.hull
      applyDamageToUnit(target, dmg, shot.tags)
      tryLootEnemyKill(state, target, prevHull)
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

/* ── Simulate / resolve ─────────────────────────────────────────────── */

/**
 * Continuous combat step (real seconds).
 * Weapons fire when a living target is inside weapon.range.
 * Damage is deferred until projectiles impact.
 */
export function simulateCombat(
  state: GameState,
  dt: number,
  pushLog: (state: GameState, line: string) => void,
): void {
  if (dt <= 0) return
  const roles = fittedRoles(state)
  const matchupScale =
    1 +
    challengeShopMatchupBonus(state.prestige.shop) +
    sensorsMatchupBonus(state.core?.ranks.sensors ?? 0) +
    computeSignalCoreBonuses(state).matchup
  const focusFire = aiDoctrinesActive(state, 'focus-fire')
  const bossProtocol = aiDoctrinesActive(state, 'boss-protocol')

  moveUnits(state, dt)

  const hitFx = updateProjectiles(state, dt, roles, matchupScale)

  const sides: Array<'player' | 'enemy'> = ['player', 'enemy']
  for (const side of sides) {
    const allies = side === 'player' ? state.combat.playerUnits : state.combat.enemyUnits
    const foes = side === 'player' ? state.combat.enemyUnits : state.combat.playerUnits

    for (const unit of allies) {
      if (unit.hull <= 0) continue

      const prevHull = unit.hull
      for (const dot of unit.dots) {
        if (dot.remaining <= 0) continue
        unit.hull = Math.max(0, unit.hull - dot.dps * dt)
        dot.remaining -= dt
      }
      unit.dots = unit.dots.filter((d) => d.remaining > 0)
      tryLootEnemyKill(state, unit, prevHull)
      if (unit.hull <= 0) continue

      if (unit.phaseWarnLeft > 0) {
        unit.phaseWarnLeft = Math.max(0, unit.phaseWarnLeft - dt)
      }

      for (const weapon of unit.weapons) {
        weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt)

        if (weapon.telegraphLeft > 0) {
          weapon.telegraphLeft = Math.max(0, weapon.telegraphLeft - dt)
          if (weapon.telegraphLeft > 0) continue
        } else if (weapon.cooldownLeft > 0) {
          continue
        } else if (weapon.telegraphDuration > 0) {
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
                arenaDistance(unit, u) <= weapon.range + 0.5,
            )
            .sort((a, b) => arenaDistance(unit, a) - arenaDistance(unit, b))
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

/* ── Hold estimates (Phase 1: current wave only — Patrol not in scope) ─ */

/** Simple wave-based estimate for the current expedition wave. */
export function estimateHoldClearRewards(state: GameState): {
  scrap: number
  data: number
  salvage: number
} {
  const wave = Math.max(1, state.combat.wave)
  const enc = encounterForWave('sector-1', wave)
  let scrap = enc.scrapReward
  if (aiDoctrinesActive(state, 'scavenger')) scrap *= 1.3
  if (state.shipyard.modules.includes('salvage-rig')) scrap *= 1.25
  scrap *= 1 + matterShopScrapBonus(state.prestige.matterShop)

  const dataBlocked = state.prestige.activeChallengeId === 'data-drought'
  const siphon =
    essenceBonusDataPerClear(state.essence.purchased) +
    matterShopDataPerClear(state.prestige.matterShop)
  const data =
    dataBlocked || !isSystemUnlocked(state, 'research') ? 0 : enc.dataReward + siphon
  const salvage = enc.salvageReward

  return { scrap, data, salvage }
}

/**
 * Hold Accountant rates for the current wave (Phase 1 stub — no multi-wave Patrol clear).
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
  const wave = Math.max(1, state.combat.wave)
  const hullTotal = totalEnemyHull(encounterForWave('sector-1', wave))
  const clearSeconds = Math.max(8, hullTotal / dps)
  return {
    scrapPerSec: rewards.scrap / clearSeconds,
    dataPerSec: rewards.data / clearSeconds,
    salvagePerSec: rewards.salvage / clearSeconds,
    scrapPerClear: rewards.scrap,
    clearSeconds,
  }
}
