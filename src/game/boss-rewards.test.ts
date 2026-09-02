import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { grantEnemyKillRewards } from './combat'
import { buildHostileUnit, getHostileDef } from './hostileCatalogue'
import { promoteToCommander } from './commanders'
import { COMMANDER_REWARD } from './hostileSeeds'
import {
  applyWaveSecureBlueprintSources,
  blueprintLifecycle,
  isBlueprintDiscovered,
} from './blueprints'
import { recordBossClearSources, relicRouteRemainsPending } from './bossClear'
import { getRelicFamily } from './relicCatalogue'
import { createEmptyFurnaceState } from './furnace'
import { tickWaveScheduler, type WaveSchedulerHooks } from './waveScheduler'

function silent(): WaveSchedulerHooks {
  return { pushLog: () => undefined }
}

describe('PR7 encounter rewards', () => {
  it('pays ordinary kills once and Commander kills with elevated multipliers once', () => {
    const ordinary = createInitialState(0)
    const commanderState = createInitialState(0)
    const unit = buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 20 })
    unit.rewardWeight = 1
    const cmdr = promoteToCommander(
      buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 20 }),
      'vanguard',
      getHostileDef('void-mite')!,
    )
    cmdr.rewardWeight = 1
    grantEnemyKillRewards(ordinary, unit)
    grantEnemyKillRewards(ordinary, unit)
    grantEnemyKillRewards(commanderState, cmdr)
    grantEnemyKillRewards(commanderState, cmdr)
    expect(commanderState.resources.salvage).toBeGreaterThan(ordinary.resources.salvage)
    expect(commanderState.resources.salvage / Math.max(1, ordinary.resources.salvage)).toBeCloseTo(
      COMMANDER_REWARD.salvageMult,
      0,
    )
  })

  it('does not treat a Commander kill as Wave secure', () => {
    const state = startCombat(createInitialState(3))
    const pkg = state.combat.packages[0]
    const cmdr = promoteToCommander(
      buildHostileUnit({ def: getHostileDef('void-mite')!, wave: 10 }),
      'vanguard',
      getHostileDef('void-mite')!,
    )
    cmdr.packageId = pkg?.id
    state.combat.enemyUnits.push(cmdr)
    grantEnemyKillRewards(state, cmdr)
    cmdr.hull = 0
    tickWaveScheduler(state, 0, silent())
    expect(pkg?.secured).not.toBe(true)
  })
})

const BLUEPRINT_WAVES = [
  [50, 'flak-array'],
  [100, 'heavy-lance'],
  [150, 'grav-tether'],
  [200, 'slag-spitter'],
  [250, 'phase-beam'],
  [300, 'sensor-array'],
  [350, 'barrier-projector'],
  [500, 'reactor-frame'],
] as const

describe('PR7 Boss-clear sources', () => {
  it('W50–W350 and W500 Blueprint sources fire on Boss Wave Secured only', () => {
    for (const [wave, id] of BLUEPRINT_WAVES) {
      const spawnOnly = createInitialState(0)
      spawnOnly.combat.enemyUnits = [
        {
          ...buildHostileUnit({ def: getHostileDef('void-mite')!, wave }),
          isBoss: true,
          bossId: 'pack-tyrant-i',
        },
      ]
      expect(isBlueprintDiscovered(spawnOnly, id)).toBe(false)
      const killOnly = createInitialState(0)
      const boss = {
        ...buildHostileUnit({ def: getHostileDef('void-mite')!, wave }),
        isBoss: true,
        rewardWeight: 1,
      }
      grantEnemyKillRewards(killOnly, boss)
      expect(isBlueprintDiscovered(killOnly, id)).toBe(false)
      const secured = createInitialState(0)
      applyWaveSecureBlueprintSources(secured, wave, 'boss')
      expect(blueprintLifecycle(secured, id)).toBe('discovered')
      applyWaveSecureBlueprintSources(secured, wave, 'boss')
      expect(blueprintLifecycle(secured, id)).toBe('discovered')
      expect(secured.shipyard.modules.includes(id)).toBe(false)
    }
  })

  it('W400/W550 Relic routes stay pending-design and do not fabricate', () => {
    const s = createInitialState(0)
    recordBossClearSources(s, 400)
    recordBossClearSources(s, 550)
    expect(s.codex.milestones).toContain('boss-cleared:w400')
    expect(relicRouteRemainsPending(400)).toBe(true)
    expect(relicRouteRemainsPending(550)).toBe(true)
    expect(getRelicFamily('aegis-relay')?.fabricationStatus).toBe('pending-design')
    expect(s.relics.instances).toEqual([])
  })

  it('W450 records Furnace unlock source without implementing Furnace', () => {
    const s = createInitialState(0)
    const before = JSON.stringify(s.furnace ?? createEmptyFurnaceState())
    recordBossClearSources(s, 450)
    expect(s.codex.milestones).toContain('furnace-unlock-source')
    expect(JSON.stringify(s.furnace ?? createEmptyFurnaceState())).toBe(before)
  })

  it('W900/W950/W1000 hand off to the finale without an Act 2 reset', () => {
    const s = createInitialState(0)
    s.prestige.prestigeCount = 2
    recordBossClearSources(s, 900)
    recordBossClearSources(s, 950)
    recordBossClearSources(s, 1000)
    expect(s.codex.milestones).toContain('crown-signal')
    expect(s.codex.milestones).toContain('crown-matrix-source')
    expect(s.codex.milestones).toContain('act1-boss-clear')
    expect(s.meta.act1Cleared).toBe(true)
    expect(s.prestige.prestigeCount).toBe(2)
    expect(s.meta.act1FinalePending).toBe(true)
  })
})
