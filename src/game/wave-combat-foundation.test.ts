import { afterEach, describe, expect, it } from 'vitest'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { startCombat, advanceSeconds, warpToSector } from './tick'
import { setLaunchSector, setSectorRoute } from './actions'
import {
  ACT1_FINAL_WAVE,
  ACTIVE_ENEMY_SOFT_CAP,
  isAct1FinaleWave,
  isBossWave,
  isCommanderCandidateWave,
  isSignatureBossWave,
  NORMAL_REINFORCEMENT_INTERVAL,
} from './waves'
import { TYPICAL_SPAWN_RADIUS, distanceToHive, moveRadially, pointFromBearing } from './geometry'
import { FORMATION_IDS, formationSlots, pickFormation } from './formations'
import { createSimRng } from './simRng'
import { SIM_FIXED_DT } from './simClock'
import { setTestBossProvider } from './bossProvider'
import { startWavePackage, tickWaveScheduler, type WaveSchedulerHooks } from './waveScheduler'
import { livingEnemyCount } from './waveRuntime'
import { saveGame, loadOrCreateGame, clearSave } from './save'
import { applyOfflineCatchUp } from './offline'
import { isSortieActive } from './presentation'
import type { CombatUnit, GameState } from './types'
import { grantEnemyKillRewards } from './combat'

function silentHooks(): WaveSchedulerHooks {
  return { pushLog: () => undefined }
}

function muteWeapons(state: GameState): void {
  for (const unit of [...state.combat.playerUnits, ...state.combat.enemyUnits]) {
    for (const weapon of unit.weapons) {
      weapon.damage = 0
      weapon.cooldownLeft = 99
    }
  }
}

function durableDrone(id: string, wave: number, bearing = 0): CombatUnit {
  const pos = pointFromBearing(bearing, TYPICAL_SPAWN_RADIUS)
  return {
    id,
    side: 'enemy',
    name: 'Durable probe',
    shape: 'circle',
    family: 'swarm',
    hull: 1_000_000,
    hullMax: 1_000_000,
    shield: 0,
    shieldMax: 0,
    armor: 0,
    evasion: 0,
    damageTakenMult: 1,
    weapons: [
      {
        id: `${id}-wpn`,
        name: 'Idle',
        damage: 0,
        cooldown: 9,
        cooldownLeft: 9,
        range: 40,
        tags: ['kinetic'],
        splash: 0,
        dotDuration: 0,
        dotDamage: 0,
        telegraphDuration: 0,
        telegraphLeft: 0,
      },
    ],
    isBoss: false,
    isFlagship: false,
    dots: [],
    x: pos.x,
    y: pos.y,
    heading: bearing,
    speed: 12,
    engageRange: 90,
    kite: false,
    phaseWarnLeft: 0,
    regenDelay: 0,
    sourceWave: wave,
  }
}

function kill(state: GameState, unit: CombatUnit): void {
  unit.hull = 0
}

function fingerprint(state: GameState) {
  return {
    wave: state.combat.wave,
    waveReached: state.combat.waveReached,
    nextWave: state.combat.nextWave,
    nextReinforcementAt: state.combat.nextReinforcementAt,
    simTime: state.combat.simTime,
    rng: state.combat.rng.s,
    hull: state.combat.playerHull,
    shield: state.combat.playerShield,
    boss: { ...state.combat.bossBoundary },
    packages: state.combat.packages.map((p) => ({
      id: p.id,
      wave: p.wave,
      secured: p.secured,
      rewardPaid: p.rewardPaid,
      pendingCount: p.pendingCount,
      spawned: [...p.spawnedUnitIds],
    })),
    pending: state.combat.pendingReinforcements.map((p) => ({
      id: p.id,
      wave: p.wave,
      packageId: p.packageId,
      n: p.units.length,
    })),
    enemies: state.combat.enemyUnits.map((u) => ({
      id: u.id,
      x: u.x,
      y: u.y,
      hull: u.hull,
      shield: u.shield,
      packageId: u.packageId,
      sourceWave: u.sourceWave,
    })),
    projectiles: state.combat.projectiles.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      originX: p.originX,
      originY: p.originY,
    })),
    cores: state.combat.playerUnits
      .filter((u) => u.isCore)
      .map((u) => ({
        id: u.id,
        x: u.x,
        y: u.y,
        heading: u.heading,
        cd: u.weapons[0]?.cooldownLeft ?? 0,
      })),
    scrap: state.resources.scrap,
    salvage: state.resources.salvage,
  }
}

describe('PR1 wave-only radial combat foundation', () => {
  afterEach(() => {
    setTestBossProvider(null)
    clearSave()
  })

  it('starts a fresh normal Sortie at Wave 1', () => {
    const launched = startCombat(createInitialState(1))
    expect(launched.combat.wave).toBe(1)
    expect(launched.combat.waveReached).toBe(1)
    expect(launched.combat.nextWave).toBe(2)
    expect(launched.combat.packages.some((p) => p.wave === 1 && p.reached)).toBe(true)
  })

  it('does not require a Sector coordinate or Route choice', () => {
    const state = startCombat(createInitialState(1))
    expect('sector' in state.combat).toBe(false)
    expect('route' in state.combat).toBe(false)
    expect('pushMode' in state.combat).toBe(false)
    const routed = setSectorRoute(state, 'B')
    expect(routed).toBe(state)
  })

  it('uses ACT1_FINAL_WAVE 1000 and the canonical cadence helpers', () => {
    expect(ACT1_FINAL_WAVE).toBe(1000)
    expect(isAct1FinaleWave(1000)).toBe(true)
    expect(isCommanderCandidateWave(10)).toBe(true)
    expect(isCommanderCandidateWave(40)).toBe(true)
    expect(isCommanderCandidateWave(50)).toBe(false)
    expect(isCommanderCandidateWave(100)).toBe(false)
    expect(isBossWave(50)).toBe(true)
    expect(isBossWave(100)).toBe(true)
    expect(isSignatureBossWave(100)).toBe(true)
    expect(isSignatureBossWave(200)).toBe(true)
    expect(isSignatureBossWave(150)).toBe(false)
  })

  it('starts W2 while a W1 enemy is still alive, then secures out of order', () => {
    let state = startCombat(createInitialState(7))
    muteWeapons(state)
    const w1 = state.combat.packages.find((p) => p.wave === 1)!
    state.combat.enemyUnits = [durableDrone('w1-hold', 1)]
    state.combat.enemyUnits[0]!.packageId = w1.id
    w1.spawnedUnitIds = ['w1-hold']
    w1.pendingCount = 0
    w1.totalUnits = 1
    const scrapAtW1 = state.resources.scrap
    advanceSeconds(state, NORMAL_REINFORCEMENT_INTERVAL + 0.05)
    expect(state.combat.waveReached).toBeGreaterThanOrEqual(2)
    const w2 = state.combat.packages.find((p) => p.wave === 2)
    expect(w2).toBeTruthy()
    expect(state.combat.enemyUnits.some((u) => u.id === 'w1-hold' && u.hull > 0)).toBe(true)
    expect(w1.secured).toBe(false)

    for (const unit of state.combat.enemyUnits) {
      if (unit.sourceWave === 2 || unit.packageId === w2?.id) kill(state, unit)
    }
    tickWaveScheduler(state, 0, silentHooks())
    expect(w2?.secured).toBe(true)
    expect(w2?.rewardPaid).toBe(true)
    expect(w1.secured).toBe(false)
    const scrapAfterW2 = state.resources.scrap
    expect(scrapAfterW2).toBeGreaterThan(scrapAtW1)

    tickWaveScheduler(state, 0, silentHooks())
    expect(w2?.rewardPaid).toBe(true)
    expect(state.resources.scrap).toBe(scrapAfterW2)

    kill(state, state.combat.enemyUnits.find((u) => u.id === 'w1-hold')!)
    tickWaveScheduler(state, 0, silentHooks())
    expect(w1.secured).toBe(true)
    expect(w1.rewardPaid).toBe(true)
    expect(state.resources.scrap).toBeGreaterThan(scrapAfterW2)
  })

  it('marks Wave Reached when reinforcement starts, not when the field is empty', () => {
    const state = startCombat(createInitialState(3))
    expect(state.combat.waveReached).toBe(1)
    expect(state.combat.packages[0]?.reached).toBe(true)
    expect(state.combat.packages[0]?.secured).toBe(false)
    expect(state.combat.enemyUnits.some((u) => u.hull > 0)).toBe(true)
  })

  it('pays kill rewards immediately and Wave rewards only on Secure', () => {
    const state = startCombat(createInitialState(11))
    muteWeapons(state)
    const scrap0 = state.resources.scrap
    const salvage0 = state.resources.salvage
    const target = state.combat.enemyUnits.find((u) => u.hull > 0)!
    grantEnemyKillRewards(state, target)
    target.hull = 0
    expect(state.resources.salvage).toBeGreaterThan(salvage0)
    expect(state.combat.packages.find((p) => p.wave === 1)?.rewardPaid).toBe(false)
    tickWaveScheduler(state, 0, silentHooks())
    if (livingEnemyCount(state) === 0 && (state.combat.packages[0]?.pendingCount ?? 0) === 0) {
      expect(state.combat.packages[0]?.rewardPaid).toBe(true)
      expect(state.resources.scrap).toBeGreaterThan(scrap0)
    }
  })

  it('picks deterministic formations and bearings from the Sortie seed', () => {
    const a = createSimRng(42)
    const b = createSimRng(42)
    const ctxA = { rng: a, wave: 7, packageId: 'pkg-w7-1' }
    const ctxB = { rng: b, wave: 7, packageId: 'pkg-w7-1' }
    expect(pickFormation(ctxA)).toBe(pickFormation(ctxB))
    const id = pickFormation({ rng: createSimRng(42), wave: 7, packageId: 'pkg-w7-1' })
    expect(FORMATION_IDS).toContain(id)
    const slotsA = formationSlots(id, 4, { rng: createSimRng(42), wave: 7, packageId: 'pkg-w7-1' })
    const slotsB = formationSlots(id, 4, { rng: createSimRng(42), wave: 7, packageId: 'pkg-w7-1' })
    expect(slotsA).toEqual(slotsB)
  })

  it('spawns on a true 360° ring and uses Euclidean Hive distance with vector approach', () => {
    const bearings = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4]
    for (const bearing of bearings) {
      const p = pointFromBearing(bearing, TYPICAL_SPAWN_RADIUS)
      expect(distanceToHive(p.x, p.y)).toBeCloseTo(TYPICAL_SPAWN_RADIUS, 6)
    }
    const start = pointFromBearing(Math.PI / 2, 200)
    const next = moveRadially(start.x, start.y, -10)
    expect(distanceToHive(next.x, next.y)).toBeCloseTo(190, 6)
    expect(next.x).toBeGreaterThan(0)
    expect(Math.abs(next.y)).toBeLessThan(1e-6)

    const state = startCombat(createInitialState(99))
    for (const unit of state.combat.enemyUnits) {
      expect(distanceToHive(unit.x, unit.y)).toBeGreaterThan(40)
    }
    const xs = state.combat.enemyUnits.map((u) => u.x)
    const ys = state.combat.enemyUnits.map((u) => u.y)
    expect(xs.some((x) => Math.abs(x) > 1) || ys.some((y) => Math.abs(y) > 1)).toBe(true)
  })

  it('holds overflow units in pending reinforcement instead of dropping them', () => {
    const state = startCombat(createInitialState(21))
    muteWeapons(state)
    state.combat.enemyUnits = []
    state.combat.packages = []
    state.combat.pendingReinforcements = []
    const extras = Array.from({ length: ACTIVE_ENEMY_SOFT_CAP + 8 }, (_, i) =>
      durableDrone(`cap-${i}`, 3, i * 0.2),
    )
    startWavePackage(state, 3, silentHooks(), extras)
    expect(livingEnemyCount(state)).toBeLessThanOrEqual(ACTIVE_ENEMY_SOFT_CAP)
    const pkg = state.combat.packages.find((p) => p.wave === 3)!
    expect(pkg.pendingCount).toBeGreaterThan(0)
    expect(state.combat.pendingReinforcements[0]?.wave).toBe(3)
    expect(state.combat.pendingReinforcements[0]?.packageId).toBe(pkg.id)
    expect(pkg.secured).toBe(false)

    for (const unit of state.combat.enemyUnits) kill(state, unit)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(false)
    expect(livingEnemyCount(state)).toBeGreaterThan(0)

    const scrap = state.resources.scrap
    while (pkg.pendingCount > 0 || livingEnemyCount(state) > 0) {
      for (const unit of state.combat.enemyUnits) kill(state, unit)
      tickWaveScheduler(state, 0, silentHooks())
    }
    expect(pkg.rewardPaid).toBe(true)
    const scrapAfter = state.resources.scrap
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.resources.scrap).toBe(scrapAfter)
    expect(pkg.rewardPaid).toBe(true)
  })

  it('runs the Boss-boundary fixture without a free Hive heal', () => {
    setTestBossProvider((ctx) => ({
      id: 'test-boss',
      name: 'Fixture Titan',
      warningDuration: 2,
      blurb: 'test',
      units: [durableDrone('fixture-boss', ctx.wave)],
    }))
    const state = startCombat(createInitialState(50))
    muteWeapons(state)
    const hull = state.combat.playerHull
    const shield = state.combat.playerShield
    state.combat.nextWave = 50
    state.combat.nextReinforcementAt = Number.POSITIVE_INFINITY
    state.combat.bossBoundary = { phase: 'idle', wave: 0, warningLeft: 0 }
    const backlog = durableDrone('pre-boss', 49)
    backlog.packageId = 'pkg-pre'
    state.combat.enemyUnits = [backlog]
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('holding')

    kill(state, backlog)
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('warning')
    expect(state.combat.waveReached).toBeLessThan(50)

    tickWaveScheduler(state, 2, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('active')
    expect(state.combat.waveReached).toBe(50)
    expect(state.combat.packages.some((p) => p.wave === 50 && p.kind === 'boss')).toBe(true)
    expect(state.combat.nextReinforcementAt).toBe(Number.POSITIVE_INFINITY)
    expect(state.combat.playerHull).toBe(hull)
    expect(state.combat.playerShield).toBe(shield)

    const beforeNext = state.combat.nextWave
    tickWaveScheduler(state, 7, silentHooks())
    expect(state.combat.nextWave).toBe(beforeNext)
    expect(state.combat.bossBoundary.phase).toBe('active')

    const boss = state.combat.enemyUnits.find((u) => u.id.includes('fixture-boss') || u.isBoss)!
    kill(state, boss)
    tickWaveScheduler(state, 0, silentHooks())
    const bossPkg = state.combat.packages.find((p) => p.wave === 50)!
    expect(bossPkg.secured).toBe(true)
    expect(state.combat.bossBoundary.phase).toBe('cleared')
    expect(state.combat.nextWave).toBe(51)
    expect(Number.isFinite(state.combat.nextReinforcementAt)).toBe(true)
  })

  it('freezes combat across save/reload and long real-world delay', () => {
    const state = startCombat(createInitialState(13))
    muteWeapons(state)
    const core = state.combat.playerUnits.find((u) => u.isCore)
    if (core?.weapons[0]) core.weapons[0].cooldownLeft = 0.8
    state.combat.projectiles.push({
      id: 'proj-test',
      side: 'player',
      x: 12,
      y: 40,
      originX: core?.x ?? 8,
      originY: core?.y ?? 0,
      toId: state.combat.enemyUnits[0]?.id ?? 'missing',
      fromId: core?.id ?? 'hive',
      damage: 2,
      speed: 80,
      heading: 0.2,
      tag: 'kinetic',
      tags: ['kinetic'],
      dotDuration: 0,
      dotDamage: 0,
      attackerFamily: 'core',
    })
    advanceSeconds(state, 1.1)
    const before = fingerprint(state)
    saveGame(state)

    const loaded = loadOrCreateGame(Date.now() + 3_600_000)
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(fingerprint(loaded)).toEqual(before)

    loaded.lastTickAt = Date.now() - 86_400_000
    const caught = applyOfflineCatchUp(loaded, Date.now())
    expect(fingerprint(caught.state)).toMatchObject({
      wave: before.wave,
      simTime: before.simTime,
      hull: before.hull,
      shield: before.shield,
      enemies: before.enemies,
      projectiles: before.projectiles,
      cores: before.cores,
      scrap: before.scrap,
      salvage: before.salvage,
    })
    expect(caught.state.combat.simTime).toBe(before.simTime)
  })

  it('matches combat outcomes under identical seeds and fixed-step cadence', () => {
    const run = (chunks: number, chunk: number) => {
      const s = startCombat(createInitialState(77))
      muteWeapons(s)
      for (let i = 0; i < chunks; i++) advanceSeconds(s, chunk)
      return fingerprint(s)
    }
    expect(run(30, SIM_FIXED_DT)).toEqual(run(30, SIM_FIXED_DT))
    expect(run(30, SIM_FIXED_DT)).toEqual(run(1, 1))
  })

  it('hides global bottom navigation while a Sortie is live', () => {
    const docked = createInitialState(1)
    expect(docked.combat.docked).toBe(true)
    expect(isSortieActive(docked)).toBe(false)
    const live = startCombat(docked)
    expect(live.combat.docked).toBe(false)
    expect(isSortieActive(live)).toBe(true)
  })

  it('does not keep a checkpoint or start-wave launch selector', () => {
    const state = createInitialState(1)
    expect(setLaunchSector(state, 12)).toBe(state)
    expect(warpToSector(state, 40)).toBe(state)
    const live = startCombat(state)
    expect(live.combat.waveReached).toBe(1)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('fires Cores from their orbit position rather than the Hive origin', () => {
    const state = startCombat(createInitialState(5))
    const cores = state.combat.playerUnits.filter((u) => u.isCore)
    expect(cores.length).toBeGreaterThan(0)
    for (const core of cores) {
      expect(Math.hypot(core.x, core.y)).toBeGreaterThan(10)
      const def = getModule(core.coreModuleId ?? '')
      expect(def?.role === 'weapon' || core.weapons.length > 0).toBe(true)
    }
  })
})
