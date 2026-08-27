/** Choir Crown three-phase runtime. Deterministic and saveable. */

import type { CombatUnit, GameState, WavePackageState } from './types'
import { CHOIR_CROWN_SEEDS } from './hostileSeeds'
import { buildHostileUnit, getHostileDef, introducedHostiles } from './hostileCatalogue'
import { admitUnitToPackage } from './waveRuntime'
import { noteBossPhaseDuration } from './encounterTelemetry'
import { hashSeed } from './simRng'
import { TYPICAL_SPAWN_RADIUS, pointFromBearing } from './geometry'
import type { ChoirCrownPhase } from './bossRegistry'

export interface ChoirCrownState {
  phase: ChoirCrownPhase
  phaseStartedAt: number
  reconstructionSpawned: boolean
  loopbreakSpawned: boolean
  jamCooldownLeft: number
}

export function emptyChoirCrown(now = 0): ChoirCrownState {
  return {
    phase: 'convergence',
    phaseStartedAt: now,
    reconstructionSpawned: false,
    loopbreakSpawned: false,
    jamCooldownLeft: 2,
  }
}

function bossUnit(state: GameState): CombatUnit | undefined {
  return state.combat.enemyUnits.find((u) => u.hull > 0 && u.bossId === 'choir-crown')
}

function bossPackage(state: GameState): WavePackageState | undefined {
  return state.combat.packages.find((p) => p.kind === 'boss' && p.wave === 1000)
}

function setPhase(state: GameState, boss: CombatUnit, phase: ChoirCrownPhase): void {
  const now = state.combat.simTime ?? 0
  if (!state.combat.choirCrown) state.combat.choirCrown = emptyChoirCrown(now)
  state.combat.choirCrown.phase = phase
  state.combat.choirCrown.phaseStartedAt = now
  boss.choirCrownPhase = phase
  boss.choirCrownPhaseStartedAt = now
  state.combat.bossPhase = phase === 'convergence' ? 0 : phase === 'reconstruction' ? 1 : 2
}

function spawnSupport(state: GameState, ids: string[], tag: string): void {
  const pkg = bossPackage(state)
  if (!pkg) return
  const wave = 1000
  ids.forEach((id, i) => {
    const def = getHostileDef(id)
    if (!def) return
    const unit = buildHostileUnit({ def, wave })
    unit.isBossSupport = true
    unit.rewardWeight = 0.35
    const pos = pointFromBearing((i / Math.max(1, ids.length)) * Math.PI * 2, TYPICAL_SPAWN_RADIUS * 0.72)
    unit.x = pos.x
    unit.y = pos.y
    unit.heading = (i / Math.max(1, ids.length)) * Math.PI * 2
    unit.id = `draft-${tag}-${i}`
    admitUnitToPackage(state, pkg, unit)
  })
}

function reconstructionIds(seed: number): string[] {
  const pool = introducedHostiles(1000).map((d) => d.id)
  const out: string[] = []
  for (let i = 0; i < CHOIR_CROWN_SEEDS.reconstructionNodes; i++) {
    out.push(pool[hashSeed(seed, 0x4ec0, i) % pool.length]!)
  }
  return out
}

function loopbreakIds(seed: number): string[] {
  const pool = introducedHostiles(1000).map((d) => d.id)
  const out: string[] = []
  for (let i = 0; i < CHOIR_CROWN_SEEDS.loopbreakExtra; i++) {
    out.push(pool[hashSeed(seed, 0x10b7, i) % pool.length]!)
  }
  return out
}

function applyReconstructionProfile(boss: CombatUnit): void {
  boss.armor = Math.max(boss.armor, (boss.authoredArmor ?? 6) + 6)
  boss.shield = Math.min(boss.shield, boss.shieldMax * 0.15)
  const slam = boss.weapons[0]
  if (slam) {
    slam.name = 'Crown slam'
    slam.telegraphDuration = CHOIR_CROWN_SEEDS.slamTelegraph
    slam.cooldown = CHOIR_CROWN_SEEDS.slamCooldown
    slam.damage *= CHOIR_CROWN_SEEDS.slamDamageMult
    slam.tags = slam.tags.includes('kinetic') ? slam.tags : [...slam.tags, 'kinetic']
  }
}

function tickJams(state: GameState, dt: number, crown: ChoirCrownState): void {
  if (!state.combat.coreJams) state.combat.coreJams = []
  for (const jam of state.combat.coreJams) {
    if (jam.telegraphLeft > 0) {
      jam.telegraphLeft = Math.max(0, jam.telegraphLeft - dt)
      if (jam.telegraphLeft <= 0) jam.jamLeft = CHOIR_CROWN_SEEDS.jamDuration
    } else if (jam.jamLeft > 0) {
      jam.jamLeft = Math.max(0, jam.jamLeft - dt)
    }
  }
  state.combat.coreJams = state.combat.coreJams.filter((j) => j.telegraphLeft > 0 || j.jamLeft > 0)
  for (const core of state.combat.playerUnits) {
    if (!core.isCore) continue
    const jam = state.combat.coreJams.find((j) => j.coreId === (core.coreInstanceId ?? core.id))
    core.coreJamTelegraphLeft = jam?.telegraphLeft ?? 0
    core.coreJamLeft = jam?.jamLeft ?? 0
  }
  crown.jamCooldownLeft -= dt
  if (crown.jamCooldownLeft > 0) return
  const cores = state.combat.playerUnits.filter((u) => u.isCore && u.coreModuleId)
  if (cores.length === 0) return
  const pick = cores[hashSeed(state.combat.sortieSeed ?? 1, Math.floor(state.combat.simTime ?? 0), 0x1a11) % cores.length]!
  const id = pick.coreInstanceId ?? pick.id
  if (state.combat.coreJams.some((j) => j.coreId === id)) return
  state.combat.coreJams.push({
    coreId: id,
    telegraphLeft: CHOIR_CROWN_SEEDS.jamTelegraph,
    jamLeft: 0,
  })
  pick.phaseWarnLeft = CHOIR_CROWN_SEEDS.jamTelegraph
  crown.jamCooldownLeft = CHOIR_CROWN_SEEDS.jamCooldown
}

export function tickChoirCrown(state: GameState, dt: number): void {
  const boss = bossUnit(state)
  if (!boss) return
  if (!state.combat.choirCrown) {
    state.combat.choirCrown = emptyChoirCrown(state.combat.simTime ?? 0)
    boss.choirCrownPhase = 'convergence'
  }
  const crown = state.combat.choirCrown
  const hullFrac = boss.hullMax > 0 ? boss.hull / boss.hullMax : 1
  noteBossPhaseDuration(state, crown.phase, dt)

  if (crown.phase === 'convergence' && hullFrac <= CHOIR_CROWN_SEEDS.reconstructionHullFrac) {
    setPhase(state, boss, 'reconstruction')
    applyReconstructionProfile(boss)
    if (!crown.reconstructionSpawned) {
      spawnSupport(state, reconstructionIds(state.combat.sortieSeed ?? 1), 'crown-node')
      crown.reconstructionSpawned = true
    }
  } else if (crown.phase === 'reconstruction' && hullFrac <= CHOIR_CROWN_SEEDS.loopbreakHullFrac) {
    setPhase(state, boss, 'loopbreak')
    if (!crown.loopbreakSpawned) {
      spawnSupport(state, loopbreakIds(state.combat.sortieSeed ?? 1), 'crown-front')
      crown.loopbreakSpawned = true
    }
  }

  if (crown.phase === 'loopbreak') tickJams(state, dt, crown)
}

export function isCoreJammed(state: GameState, core: CombatUnit): boolean {
  const id = core.coreInstanceId ?? core.id
  const jam = (state.combat.coreJams ?? []).find((j) => j.coreId === id)
  return Boolean(jam && jam.jamLeft > 0 && jam.telegraphLeft <= 0)
}

export function choirCrownPhaseOf(state: GameState): ChoirCrownPhase | null {
  return state.combat.choirCrown?.phase ?? bossUnit(state)?.choirCrownPhase ?? null
}

