import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './state'
import { startCombat, advanceSeconds, setDocked, freezeActiveSortie, handleAppHidden, setSortiePaused, tickGame, LIVE_TICK_CAP, extractSortie } from './tick'
import { tryCompleteChallenge, assignWorker, setFoundrySlot } from './actions'
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
import { createSimRng, rngNext } from './simRng'
import { SIM_FIXED_DT } from './simClock'
import { setTestBossProvider } from './bossProvider'
import { startBossEncounter, startWavePackage, tickWaveScheduler, type WaveSchedulerHooks } from './waveScheduler'
import { admitUnitToPackage, emptyWaveRuntime, livingEnemyCount, markWaveReached } from './waveRuntime'
import { saveGame, loadOrCreateGame, clearSave } from './save'
import { applyOfflineCatchUp, applyWallClock, handleAppVisible } from './offline'
import { isSortieActive, showGlobalBottomNav, showSortieReturnControl } from './presentation'
import type { CombatUnit, GameState } from './types'
import { dropTableEntries, familyCanDropPrint, getChallenge, legacyChallengeGoalWave, modulePrintWave } from './catalog'
import { maybeGrantSystemUnlocks } from './progression'
import { ACT1_CADENCE } from './cadence'
import { liveBossHp } from './uiReadout'
import {
  grantEnemyKillRewards,
  pruneDeadEnemyUnits,
  rewardWaveOf,
  rollEnemyPartDrop,
  salvageFromKill,
  simulateCombat,
} from './combat'

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
    idSeq: { ...state.combat.idSeq },
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

function launchSeeded(seed: number, now = 1): GameState {
  const state = createInitialState(now)
  state.combat.sortieSeed = seed
  return startCombat(state)
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
    expect(launched.combat.log.filter((line) => line.startsWith('Wave 1 reached'))).toHaveLength(1)
    expect(launched.combat.packages.some((p) => p.wave === 1 && p.reached)).toBe(true)
  })

  it('treats waveReached as the only Wave-Reached progress coordinate', () => {
    const pre = createInitialState(1)
    pre.combat.docked = false
    pre.combat.inFight = true
    Object.assign(pre.combat, emptyWaveRuntime())
    pre.combat.wave = 0
    expect(pre.combat.waveReached).toBe(0)
    expect(pre.combat.packages).toEqual([])

    const displayAhead = createInitialState(1)
    displayAhead.combat.wave = 1
    displayAhead.combat.waveReached = 0
    expect(markWaveReached(displayAhead, 1)).toBe(true)
    expect(displayAhead.combat.waveReached).toBe(1)
    expect(markWaveReached(displayAhead, 1)).toBe(false)
    expect(displayAhead.combat.waveReached).toBe(1)

    const live = startCombat(createInitialState(1))
    expect(live.combat.waveReached).toBe(1)
    expect(live.meta.bestWave).toBeGreaterThanOrEqual(1)
    expect(live.combat.bestWave).toBeGreaterThanOrEqual(1)
    expect(live.combat.log.filter((line) => /Wave 1 reached/.test(line))).toHaveLength(1)
    const logs = live.combat.log.length
    tickWaveScheduler(live, 0.05, silentHooks())
    tickWaveScheduler(live, 0.05, silentHooks())
    expect(live.combat.log.filter((line) => /Wave 1 reached/.test(line))).toHaveLength(1)
    expect(live.combat.log.length).toBeGreaterThanOrEqual(logs)

    saveGame(live)
    const loaded = loadOrCreateGame(Date.now() + 8_000)
    expect(loaded.combat.waveReached).toBe(1)
    expect(loaded.combat.sortiePaused).toBe(true)
    loaded.combat.sortiePaused = false
    const before = loaded.combat.log.filter((line) => /Wave 1 reached/.test(line)).length
    advanceSeconds(loaded, 1.2)
    expect(loaded.combat.log.filter((line) => /Wave 1 reached/.test(line))).toHaveLength(before)
  })

  it('does not require a Sector coordinate or Route choice', () => {
    const state = startCombat(createInitialState(1))
    expect('sector' in state.combat).toBe(false)
    expect('route' in state.combat).toBe(false)
    expect('pushMode' in state.combat).toBe(false)
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

    const scrapBefore = state.resources.scrap
    while (pkg.pendingCount > 0 || livingEnemyCount(state) > 0) {
      for (const unit of state.combat.enemyUnits) kill(state, unit)
      tickWaveScheduler(state, 0, silentHooks())
    }
    expect(pkg.rewardPaid).toBe(true)
    const scrapAfter = state.resources.scrap
    expect(scrapAfter).toBeGreaterThan(scrapBefore)
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.resources.scrap).toBe(scrapAfter)
    expect(pkg.rewardPaid).toBe(true)
  })

  it('holds the W50 Boss boundary until that Wave\'s reinforcement timestamp is due', () => {
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
    state.combat.nextReinforcementAt = (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL
    state.combat.bossBoundary = { phase: 'idle', wave: 0, warningLeft: 0 }
    const backlog = durableDrone('pre-boss', 49)
    backlog.packageId = 'pkg-pre'
    state.combat.enemyUnits = [backlog]
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('idle')

    state.combat.simTime = state.combat.nextReinforcementAt
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
    expect(state.combat.enemyName).toBe('Fixture Titan')

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
    expect(showGlobalBottomNav(docked, 'dock')).toBe(true)
    const live = startCombat(docked)
    expect(live.combat.docked).toBe(false)
    expect(isSortieActive(live)).toBe(true)
    expect(showGlobalBottomNav(live, 'combat')).toBe(false)
    expect(showSortieReturnControl(live, 'combat')).toBe(false)
    const paused = setSortiePaused(live, true)
    expect(showGlobalBottomNav(paused, 'combat')).toBe(false)
    expect(showGlobalBottomNav(paused, 'dock')).toBe(true)
    expect(showSortieReturnControl(paused, 'dock')).toBe(true)
  })

  it('does not keep a checkpoint or start-wave launch selector', () => {
    const state = createInitialState(1)
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
      expect(core.weapons.length).toBeGreaterThan(0)
    }
  })

  it('pays W1 kill salvage and drop eligibility when a W1 enemy dies during a later Wave', () => {
    const state = launchSeeded(11)
    muteWeapons(state)
    const w1 = state.combat.packages.find((p) => p.wave === 1)!
    const survivor = durableDrone('w1-econ', 1)
    survivor.packageId = w1.id
    survivor.rewardWeight = 1
    state.combat.enemyUnits = [survivor]
    w1.spawnedUnitIds = [survivor.id]
    w1.pendingCount = 0
    w1.totalUnits = 1
    const until = (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL * 4 + 0.2
    while ((state.combat.simTime ?? 0) + 1e-9 < until && state.combat.inFight) {
      muteWeapons(state)
      advanceSeconds(state, SIM_FIXED_DT)
    }
    expect(state.combat.waveReached).toBeGreaterThanOrEqual(5)
    expect(state.combat.enemyUnits.some((u) => u.id === 'w1-econ' && u.hull > 0)).toBe(true)
    expect(survivor.sourceWave).toBe(1)
    expect(rewardWaveOf(survivor)).toBe(1)

    const w1Pay = createInitialState(1)
    const w200Pay = createInitialState(1)
    grantEnemyKillRewards(w1Pay, { ...survivor, sourceWave: 1, rewardWeight: 1, isBoss: false })
    grantEnemyKillRewards(w200Pay, { ...survivor, sourceWave: 200, rewardWeight: 1, isBoss: false })
    expect(w1Pay.resources.salvage).toBeGreaterThan(0)
    expect(salvageFromKill(1, false, undefined, w1Pay)).toBeLessThan(
      salvageFromKill(200, false, undefined, w200Pay),
    )
    expect(w200Pay.resources.salvage).toBeGreaterThan(w1Pay.resources.salvage)

    state.meta.bestWave = Math.max(state.meta.bestWave, ACT1_CADENCE.foundry)
    maybeGrantSystemUnlocks(state)
    const latePrint = 'heavy-lance'
    expect(modulePrintWave(latePrint)).toBeGreaterThan(1)
    expect(familyCanDropPrint('armored', latePrint, 1)).toBe(false)
    expect(familyCanDropPrint('armored', latePrint, modulePrintWave(latePrint))).toBe(true)
    const drops = rollEnemyPartDrop(
      state,
      { family: 'armored', isBoss: false, name: 'Jug', sourceWave: 1, rewardWeight: 1 },
      () => 0,
    )
    expect(drops.every((d) => modulePrintWave(d.moduleId) <= 1)).toBe(true)
    const lateDrops = rollEnemyPartDrop(
      state,
      {
        family: 'armored',
        isBoss: false,
        name: 'Jug',
        sourceWave: modulePrintWave(latePrint),
        rewardWeight: 1,
      },
      () => 0,
    )
    expect(lateDrops.some((d) => d.moduleId === latePrint)).toBe(true)
  })

  it('keeps pending units on their source-Wave economics when released', () => {
    const state = launchSeeded(21)
    muteWeapons(state)
    state.combat.enemyUnits = []
    state.combat.packages = []
    state.combat.pendingReinforcements = []
    const extras = Array.from({ length: ACTIVE_ENEMY_SOFT_CAP + 4 }, (_, i) =>
      durableDrone(`pend-econ-${i}`, 4, i * 0.2),
    )
    startWavePackage(state, 4, silentHooks(), extras)
    const pkg = state.combat.packages.find((p) => p.wave === 4)!
    expect(pkg.pendingCount).toBeGreaterThan(0)
    expect(state.combat.pendingReinforcements[0]?.units.every((u) => u.sourceWave === 4)).toBe(true)
    for (const unit of state.combat.enemyUnits) kill(state, unit)
    tickWaveScheduler(state, 0, silentHooks())
    const released = state.combat.enemyUnits.find((u) => u.hull > 0)!
    expect(released.sourceWave).toBe(4)
    const salvage0 = state.resources.salvage
    grantEnemyKillRewards(state, released)
    expect(state.resources.salvage - salvage0).toBe(salvageFromKill(4, false, undefined, state))
  })

  it('keeps post-reload continuation equivalent after identical simulated time', () => {
    const state = launchSeeded(77)
    advanceSeconds(state, 2.4)
    const branchA = structuredClone(state)
    saveGame(state)
    const branchB = loadOrCreateGame(Date.now() + 60_000)
    expect(branchB.combat.sortiePaused).toBe(true)
    branchB.combat.sortiePaused = false
    expect(fingerprint(branchB)).toEqual(fingerprint(branchA))
    advanceSeconds(branchA, 3.1)
    advanceSeconds(branchB, 3.1)
    expect(fingerprint(branchB)).toEqual(fingerprint(branchA))
  })

  it('mints a new Sortie seed per launch and preserves it across reload', () => {
    const first = startCombat(createInitialState(3))
    expect(first.combat.sortieSeed).toBeGreaterThan(0)
    expect(first.meta.sortieSerial).toBe(1)
    saveGame(first)
    const reloaded = loadOrCreateGame(Date.now() + 5_000)
    expect(reloaded.combat.sortieSeed).toBe(first.combat.sortieSeed)
    expect(reloaded.meta.sortieSerial).toBe(1)

    const live = structuredClone(first)
    live.meta.bestWave = 210
    live.combat.bestWave = 210
    const extracted = extractSortie(live)
    const second = setDocked(extracted, false)
    expect(second.combat.sortieSeed).not.toBe(first.combat.sortieSeed)
    expect(second.meta.sortieSerial).toBe(2)
  })

  it('does not let combat RNG consumption change a future Wave formation', () => {
    const a = launchSeeded(42)
    const b = launchSeeded(42)
    muteWeapons(a)
    muteWeapons(b)
    for (let i = 0; i < 80; i++) rngNext(a.combat.rng)
    expect(a.combat.rng.s).not.toBe(b.combat.rng.s)
    advanceSeconds(a, NORMAL_REINFORCEMENT_INTERVAL + 0.05)
    advanceSeconds(b, NORMAL_REINFORCEMENT_INTERVAL + 0.05)
    const w2a = a.combat.packages.find((p) => p.wave === 2)!
    const w2b = b.combat.packages.find((p) => p.wave === 2)!
    const pose = (s: GameState, pkgId: string) =>
      s.combat.enemyUnits
        .filter((u) => u.packageId === pkgId)
        .map((u) => ({ x: u.x, y: u.y, heading: u.heading }))
    expect(pose(a, w2a.id)).toEqual(pose(b, w2b.id))
  })

  it('prunes dead enemies so enemyUnits stays bounded around live combat', () => {
    const state = launchSeeded(8)
    muteWeapons(state)
    let paid = 0
    for (let wave = 3; wave <= 18; wave++) {
      const pack = Array.from({ length: 6 }, (_, i) => durableDrone(`stress-${wave}-${i}`, wave, i))
      startWavePackage(state, wave, silentHooks(), pack)
      const pkg = state.combat.packages.find((p) => p.wave === wave)!
      const salvageBefore = state.resources.salvage
      for (const unit of [...state.combat.enemyUnits]) {
        if (unit.packageId !== pkg.id) continue
        grantEnemyKillRewards(state, unit)
        kill(state, unit)
      }
      expect(state.resources.salvage).toBeGreaterThan(salvageBefore)
      paid += 1
      tickWaveScheduler(state, 0, silentHooks())
      expect(pkg.secured).toBe(true)
      expect(pkg.rewardPaid).toBe(true)
      expect(state.combat.enemyUnits.every((u) => u.hull > 0)).toBe(true)
      expect(state.combat.enemyUnits.length).toBeLessThanOrEqual(ACTIVE_ENEMY_SOFT_CAP)
    }
    expect(paid).toBe(16)
    expect(state.combat.packages.length).toBeGreaterThan(10)
  })

  it('keeps Boss provider name/family/metadata authoritative after the encounter starts', () => {
    setTestBossProvider((ctx) => {
      const unit = durableDrone('meta-boss', ctx.wave)
      unit.family = 'ethereal'
      unit.name = 'Unique Provider Matriarch'
      unit.isBoss = true
      return {
        id: 'unique-provider-id',
        name: 'Unique Provider Matriarch',
        warningDuration: 2,
        blurb: 'authored',
        units: [unit],
      }
    })
    const state = launchSeeded(50)
    muteWeapons(state)
    state.combat.nextWave = 50
    state.combat.nextReinforcementAt = state.combat.simTime
    state.combat.enemyUnits = []
    state.combat.pendingReinforcements = []
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('holding')
    tickWaveScheduler(state, 0, silentHooks())
    tickWaveScheduler(state, 2, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('active')
    expect(state.combat.enemyName).toBe('Unique Provider Matriarch')
    expect(state.combat.enemyFamily).toBe('ethereal')
    expect(state.combat.enemyTags).toContain('unique-provider-id')
    expect(state.combat.bossMechanic).toBe('unique-provider-id')
  })

  it('honours the provider authored warningDuration', () => {
    setTestBossProvider((ctx) => ({
      id: 'long-warn',
      name: 'Slow Herald',
      warningDuration: 5,
      blurb: 'test',
      units: [durableDrone('slow-boss', ctx.wave)],
    }))
    const state = launchSeeded(50)
    muteWeapons(state)
    state.combat.nextWave = 50
    state.combat.nextReinforcementAt = state.combat.simTime
    state.combat.enemyUnits = []
    state.combat.pendingReinforcements = []
    tickWaveScheduler(state, 0, silentHooks())
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('warning')
    expect(state.combat.bossBoundary.warningLeft).toBe(5)
    tickWaveScheduler(state, 2, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('warning')
    tickWaveScheduler(state, 3.1, silentHooks())
    expect(state.combat.bossBoundary.phase).toBe('active')
  })

  it('does not apply generic legacy Boss phase mutation to provider Bosses', () => {
    setTestBossProvider((ctx) => {
      const unit = durableDrone('phase-boss', ctx.wave)
      unit.family = 'titan'
      unit.isBoss = true
      unit.hull = 90
      unit.hullMax = 90
      return {
        id: 'neutral-boss',
        name: 'Neutral Boundary',
        warningDuration: 0.1,
        blurb: 'test',
        units: [unit],
      }
    })
    const state = launchSeeded(50)
    muteWeapons(state)
    state.combat.nextWave = 50
    state.combat.nextReinforcementAt = state.combat.simTime
    state.combat.enemyUnits = []
    state.combat.pendingReinforcements = []
    tickWaveScheduler(state, 0, silentHooks())
    tickWaveScheduler(state, 0, silentHooks())
    tickWaveScheduler(state, 0.2, silentHooks())
    const boss = state.combat.enemyUnits.find((u) => u.isBoss)!
    boss.hull = boss.hullMax * 0.2
    const beforeFamily = boss.family
    const beforeCount = state.combat.enemyUnits.length
    simulateCombat(state, 0.5, () => undefined)
    const still = state.combat.enemyUnits.find((u) => u.id === boss.id)
    expect(state.combat.bossPhase).toBe(0)
    expect(still?.family ?? beforeFamily).toBe('titan')
    expect(state.combat.enemyFamily).not.toBe('armored')
    expect(state.combat.enemyUnits.filter((u) => u.hull > 0).length).toBeLessThanOrEqual(beforeCount)
  })

  it('blocks Wave Secured while a dynamically admitted package add is still alive', () => {
    const state = launchSeeded(9)
    muteWeapons(state)
    const boss = durableDrone('pkg-boss', 7)
    boss.isBoss = true
    startWavePackage(state, 7, silentHooks(), [boss], 'boss')
    const pkg = state.combat.packages.find((p) => p.wave === 7)!
    const liveBoss = state.combat.enemyUnits.find((u) => u.packageId === pkg.id)!
    const add = durableDrone('pkg-add', 7, 1)
    admitUnitToPackage(state, pkg, add)
    expect(pkg.spawnedUnitIds.length).toBe(2)
    kill(state, liveBoss)
    pruneDeadEnemyUnits(state)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(false)
    expect(pkg.rewardPaid).toBe(false)
    const liveAdd = state.combat.enemyUnits.find((u) => u.packageId === pkg.id && u.hull > 0)!
    kill(state, liveAdd)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(true)
    expect(pkg.rewardPaid).toBe(true)
    const scrap = state.resources.scrap
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.resources.scrap).toBe(scrap)
  })

  it('does not use X-only distance for combat geometry in the radial foundation', () => {
    const combatSrc = readFileSync(join(process.cwd(), 'src/game/combat.ts'), 'utf8')
    expect(combatSrc).not.toMatch(/Math\.abs\(\([^)]*\.x/)
    expect(combatSrc).not.toMatch(/tickBossSupportAura/)
  })

  it('cannot clear an active Challenge from career Best Wave alone', () => {
    expect(legacyChallengeGoalWave({ goalSector: 30 })).toBe(300)
    const challenge = getChallenge('mono-pulse')!
    expect(legacyChallengeGoalWave(challenge)).toBe(300)

    const late = createInitialState(1)
    late.prestige.activeChallengeId = 'mono-pulse'
    late.combat.wave = 299
    late.combat.waveReached = 299
    tryCompleteChallenge(late)
    expect(late.prestige.activeChallengeId).toBe('mono-pulse')
    expect(late.prestige.challengeClears['mono-pulse'] ?? 0).toBe(0)
    late.combat.waveReached = 300
    late.combat.wave = 300
    tryCompleteChallenge(late)
    expect(late.prestige.activeChallengeId).toBeNull()
    expect(late.prestige.challengeClears['mono-pulse']).toBe(1)

    const state = createInitialState(1)
    state.meta.bestWave = 1000
    state.combat.bestWave = 1000
    state.prestige.activeChallengeId = 'mono-pulse'
    state.combat.wave = 1
    state.combat.waveReached = 1
    tryCompleteChallenge(state)
    expect(state.prestige.activeChallengeId).toBe('mono-pulse')
    expect(state.prestige.challengeClears['mono-pulse'] ?? 0).toBe(0)
  })

  it('keeps provider Boss identity on the authored Boss and not escorts', () => {
    const state = launchSeeded(13)
    muteWeapons(state)
    const boss = durableDrone('actual-boss', 50)
    boss.isBoss = true
    boss.name = 'Actual Boss'
    boss.family = 'titan'
    const escortA = durableDrone('escort-a', 50, 0.8)
    escortA.isBoss = false
    escortA.name = 'Escort A'
    const escortB = durableDrone('escort-b', 50, 1.6)
    escortB.isBoss = false
    escortB.name = 'Escort B'
    setTestBossProvider(() => ({
      id: 'mixed-escort',
      name: 'Escort boundary',
      warningDuration: 0.4,
      units: [boss, escortA, escortB],
      blurb: 'One Boss and two escorts',
    }))
    state.combat.nextWave = 50
    state.combat.bossBoundary = {
      phase: 'warning',
      wave: 50,
      warningLeft: 0,
      warningDuration: 0.4,
    }
    startBossEncounter(state, silentHooks())
    const pkg = state.combat.packages.find((p) => p.kind === 'boss')!
    const living = state.combat.enemyUnits.filter((u) => u.packageId === pkg.id && u.hull > 0)
    expect(living).toHaveLength(3)
    expect(living.filter((u) => u.isBoss)).toHaveLength(1)
    const hud = liveBossHp(state)
    expect(hud).toBeTruthy()
    const actual = living.find((u) => u.isBoss)!
    expect(hud!.hull).toBe(actual.hull)
    expect(hud!.hullMax).toBe(actual.hullMax)

    const escort = living.find((u) => !u.isBoss)!
    const salvage0 = state.resources.salvage
    grantEnemyKillRewards(state, escort)
    const escortPay = state.resources.salvage - salvage0
    expect(escortPay).toBe(salvageFromKill(escort.sourceWave, false, undefined, state))
    expect(escortPay).not.toBe(salvageFromKill(escort.sourceWave, true, undefined, state))
    escort.hull = 0
    pruneDeadEnemyUnits(state)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(false)

    for (const unit of state.combat.enemyUnits.filter((u) => u.packageId === pkg.id && !u.isBoss)) {
      kill(state, unit)
    }
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(false)
    kill(state, actual)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.secured).toBe(true)
  })

  it('admits dynamic package adds through the cap-aware pending path', () => {
    const state = launchSeeded(15)
    muteWeapons(state)
    state.combat.enemyUnits = []
    state.combat.packages = []
    state.combat.pendingReinforcements = []
    const filler = Array.from({ length: ACTIVE_ENEMY_SOFT_CAP }, (_, i) =>
      durableDrone(`fill-${i}`, 8, i * 0.11),
    )
    startWavePackage(state, 8, silentHooks(), filler)
    const pkg = state.combat.packages.find((p) => p.wave === 8)!
    expect(livingEnemyCount(state)).toBe(ACTIVE_ENEMY_SOFT_CAP)
    const add = durableDrone('boss-add', 8, 2.2)
    admitUnitToPackage(state, pkg, add)
    expect(livingEnemyCount(state)).toBe(ACTIVE_ENEMY_SOFT_CAP)
    expect(pkg.pendingCount).toBeGreaterThan(0)
    expect(pkg.secured).toBe(false)
    const pendingUnit = state.combat.pendingReinforcements.find((row) => row.packageId === pkg.id)?.units[0]
    expect(pendingUnit?.sourceWave).toBe(8)
    expect(pendingUnit?.packageId).toBe(pkg.id)

    const one = state.combat.enemyUnits.find((u) => u.hull > 0)!
    kill(state, one)
    tickWaveScheduler(state, 0, silentHooks())
    expect(pkg.pendingCount).toBe(0)
    const spawnedAdd = state.combat.enemyUnits.find((u) => u.id === pendingUnit?.id)
    expect(spawnedAdd).toBeTruthy()
    expect(spawnedAdd!.packageId).toBe(pkg.id)
    expect(spawnedAdd!.sourceWave).toBe(8)

    for (const unit of [...state.combat.enemyUnits]) kill(state, unit)
    tickWaveScheduler(state, 0, silentHooks())
    while (pkg.pendingCount > 0 || state.combat.enemyUnits.some((u) => u.packageId === pkg.id && u.hull > 0)) {
      for (const unit of state.combat.enemyUnits) kill(state, unit)
      tickWaveScheduler(state, 0, silentHooks())
    }
    expect(pkg.secured).toBe(true)
    expect(pkg.rewardPaid).toBe(true)
    const scrap = state.resources.scrap
    tickWaveScheduler(state, 0, silentHooks())
    expect(state.resources.scrap).toBe(scrap)
  })

  it('freezes Sortie combat while PAUSED and resumes from the same state', () => {
    const live = startCombat(createInitialState(4))
    muteWeapons(live)
    advanceSeconds(live, 0.8)
    const sim = live.combat.simTime
    const waveAt = live.combat.nextReinforcementAt
    const pos = live.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))
    const cd = live.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))
    const paused = setSortiePaused(live, true)
    expect(paused.combat.sortiePaused).toBe(true)
    advanceSeconds(paused, 2.5)
    expect(paused.combat.simTime).toBe(sim)
    expect(paused.combat.nextReinforcementAt).toBe(waveAt)
    expect(paused.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))).toEqual(pos)
    expect(paused.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))).toEqual(cd)
    const resumed = setSortiePaused(paused, false)
    advanceSeconds(resumed, 0.4)
    expect(resumed.combat.simTime).toBeGreaterThan(sim)
  })

  it('hidden-app freeze dumps zero combat time and stays paused until Resume', () => {
    let state = startCombat(createInitialState(6))
    muteWeapons(state)
    advanceSeconds(state, 0.6)
    const sim = state.combat.simTime
    const waveAt = state.combat.nextReinforcementAt
    const pos = state.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))
    const cd = state.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))
    state = handleAppHidden(state)
    expect(state.combat.sortiePaused).toBe(true)
    state.lastTickAt = Date.now() - 90_000
    state = tickGame(state, Date.now())
    expect(state.combat.simTime).toBe(sim)
    expect(state.combat.nextReinforcementAt).toBe(waveAt)
    expect(state.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))).toEqual(pos)
    expect(state.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))).toEqual(cd)
    expect(state.combat.sortiePaused).toBe(true)
    state = setSortiePaused(state, false)
    advanceSeconds(state, 0.3)
    expect(state.combat.simTime).toBeGreaterThan(sim)
  })

  it('keeps Foundry/industry clocks independent of Sortie pause', () => {
    let state = startCombat(createInitialState(2))
    muteWeapons(state)
    state.meta.bestWave = ACT1_CADENCE.foundry
    state.combat.bestWave = ACT1_CADENCE.foundry
    state.resources.scrap = 80
    state.base.workerDrones = Math.max(2, state.base.workerDrones)
    state = assignWorker(state, 'scrap-field', 2)
    state = setFoundrySlot(state, 0, 'slag-ingot')
    const paused = freezeActiveSortie(state)
    const sim = paused.combat.simTime
    const recipeProgress = paused.foundry.slots[0]?.progress ?? 0
    advanceSeconds(paused, 32)
    expect(paused.combat.simTime).toBe(sim)
    expect(paused.foundry.slots[0]?.progress ?? 0).toBeGreaterThan(recipeProgress)
    expect(paused.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('keeps wave bonus drop tables on Wave 120/160/220 rather than old Sector 12/16/22', () => {
    expect(familyCanDropPrint('swarm', 'barrier-projector', 50)).toBe(false)
    expect(familyCanDropPrint('swarm', 'barrier-projector', 119)).toBe(false)
    expect(familyCanDropPrint('swarm', 'barrier-projector', 120)).toBe(true)
    expect(dropTableEntries('swarm', 12).some((e) => e.moduleId === 'barrier-projector')).toBe(false)
    expect(modulePrintWave('pulse-cannon')).toBeLessThan(160)
  })

  it('applies industry-only offline catch-up on hidden→visible without combat time', () => {
    let state = startCombat(createInitialState(2))
    muteWeapons(state)
    state.meta.bestWave = ACT1_CADENCE.workers
    state.combat.bestWave = ACT1_CADENCE.workers
    state.resources.scrap = 80
    state.base.workerDrones = Math.max(2, state.base.workerDrones)
    state = assignWorker(state, 'scrap-field', 2)
    state = setFoundrySlot(state, 0, 'slag-ingot')
    advanceSeconds(state, 0.4)
    const sim = state.combat.simTime
    const waveAt = state.combat.nextReinforcementAt
    const pos = state.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))
    const cd = state.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))
    const wave = state.combat.wave
    const hideAt = 50_000
    state.lastTickAt = hideAt
    state = handleAppHidden(state)
    expect(state.combat.sortiePaused).toBe(true)

    const hiddenMs = 10 * 60 * 1000
    const capControl = structuredClone(state)
    capControl.lastTickAt = hideAt
    advanceSeconds(capControl, LIVE_TICK_CAP)

    const { state: visible, report } = handleAppVisible(state, hideAt + hiddenMs)
    expect(visible.combat.simTime).toBe(sim)
    expect(visible.combat.sortiePaused).toBe(true)
    expect(visible.combat.wave).toBe(wave)
    expect(visible.combat.nextReinforcementAt).toBe(waveAt)
    expect(visible.combat.enemyUnits.map((u) => ({ id: u.id, x: u.x, y: u.y }))).toEqual(pos)
    expect(visible.combat.playerUnits.flatMap((u) => u.weapons.map((w) => w.cooldownLeft))).toEqual(cd)
    expect(visible.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThan(
      capControl.foundry.materials['slag-ingot'] ?? 0,
    )
    expect(report?.appliedMs).toBeGreaterThan(LIVE_TICK_CAP * 1000)
    expect(visible.lastTickAt).toBe(hideAt + hiddenMs)

    const scrapAfter = visible.resources.scrap
    const foundryAfter = visible.foundry.slots[0]?.progress ?? 0
    const { state: again, report: againReport } = handleAppVisible(visible, hideAt + hiddenMs + 40)
    expect(again.resources.scrap).toBeCloseTo(scrapAfter, 5)
    expect(again.foundry.slots[0]?.progress ?? 0).toBeCloseTo(foundryAfter, 8)
    expect(againReport).toBeNull()
    expect(again.combat.simTime).toBe(sim)
    expect(again.combat.sortiePaused).toBe(true)

    const wall = applyWallClock(structuredClone(state), hideAt + hiddenMs)
    expect(wall.state.combat.simTime).toBe(sim)
    expect(wall.state.foundry.materials['slag-ingot'] ?? 0).toBeGreaterThan(
      capControl.foundry.materials['slag-ingot'] ?? 0,
    )

    const workersOnly = structuredClone(state)
    for (const slot of workersOnly.foundry.slots) {
      if (slot) {
        slot.recipeId = '' as never
        slot.progress = 0
        slot.paid = false
      }
    }
    const workerCap = structuredClone(workersOnly)
    advanceSeconds(workerCap, LIVE_TICK_CAP)
    const { state: workerVisible } = handleAppVisible(workersOnly, hideAt + hiddenMs)
    expect(workerVisible.resources.scrap).toBeGreaterThan(workerCap.resources.scrap)

    const resumed = setSortiePaused(again, false)
    advanceSeconds(resumed, 0.3)
    expect(resumed.combat.simTime).toBeGreaterThan(sim)
  })

  it('does not double-apply hidden time across visible catch-up then reload', () => {
    let state = startCombat(createInitialState(3))
    muteWeapons(state)
    state.meta.bestWave = ACT1_CADENCE.workers
    state.combat.bestWave = ACT1_CADENCE.workers
    state.base.workerDrones = Math.max(2, state.base.workerDrones)
    state = assignWorker(state, 'scrap-field', 2)
    const hideAt = 80_000
    state.lastTickAt = hideAt
    state = handleAppHidden(state)
    const visibleAt = hideAt + 8 * 60 * 1000
    const { state: visible } = handleAppVisible(state, visibleAt)
    const scrap = visible.resources.scrap
    const sim = visible.combat.simTime
    saveGame(visible)
    const loaded = loadOrCreateGame(visibleAt + 200)
    const { state: reloaded } = applyOfflineCatchUp(loaded, visibleAt + 200)
    expect(reloaded.combat.simTime).toBe(sim)
    expect(reloaded.combat.sortiePaused).toBe(true)
    expect(reloaded.resources.scrap).toBeCloseTo(scrap, 5)
  })

  it('clears sortiePaused when a paused Sortie is Extracted', () => {
    let state = startCombat(createInitialState(1))
    state = setSortiePaused(state, true)
    expect(state.combat.sortiePaused).toBe(true)
    state.meta.bestWave = Math.max(state.meta.bestWave ?? 0, 210)
    state.combat.bestWave = Math.max(state.combat.bestWave ?? 0, 210)
    const extracted = extractSortie(state)
    expect(extracted.combat.docked).toBe(true)
    expect(extracted.combat.inFight).toBe(false)
    expect(extracted.combat.sortiePaused).toBe(false)
    expect(isSortieActive(extracted)).toBe(false)
  })

  it('does not keep obsolete Route/Sector/checkpoint compatibility stubs', () => {
    const root = process.cwd()
    const sources = [
      'src/game/actions.ts',
      'src/game/tick.ts',
      'src/game/dev.ts',
      'src/game/frontier.ts',
      'src/game/types.ts',
      'src/game/combat.ts',
      'src/game/catalog.ts',
      'src/hooks/useGame.ts',
    ].map((rel) => readFileSync(join(root, rel), 'utf8'))
    const joined = sources.join('\n')
    expect(joined).not.toMatch(/export (function|type|interface) (setLaunchSector|setSectorRoute|setCampaign|setPushMode|warpToSector|retryFrontier|resumeCampaign|dismissFrontierNotice|SectorRoute|CombatPushMode|FrontierNotice|modulePrintSector)\b/)
    expect(joined).not.toMatch(/['"]jump-sector['"]|['"]set-wave['"]|['"]force-boss-wave['"]/)
    expect(joined).not.toMatch(/sectorCanDropPrint|sectorRoster|matchupHintForSector|minimumPlayerWeaponRangeForSector/)
    expect(() => readFileSync(join(root, 'src/game/bossMechanics.ts'), 'utf8')).toThrow()
  })
})
