import { afterEach, describe, expect, it } from 'vitest'
import { computeShipStats, createInitialState } from './state'
import { atCareerWave, equipPostTutorialLoadout } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import { tickAutomation } from './automation'
import { hasProcessMastery } from './process'
import {
  addRelicInstance,
  corePrimarySocket,
  coreRelicId,
  coreSocketRelics,
  equipRelicOnCore,
  isRelicsUnlocked,
  removeRelicFromCore,
  setRelicSocketActivationProvider,
} from './relics'
import { coreRelicModifiers } from './relicEffects'
import { fitModule, unfitModule } from './actions'
import { grantModuleCopy, masteryMilestonesFor } from './coreProgression'
import { sanitizeCoreFits } from './save'
import {
  FIXTURE_POWER_BEHAVIOURAL,
  FIXTURE_POWER_STANDARD,
  installAuthoredRelicFixtures,
  resetRelicTestFixtures,
} from './relicTestFixtures'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function relicDock(wave = ACT1_CADENCE.reliquary) {
  let s = atCareerWave(createInitialState(0), wave)
  s = equipPostTutorialLoadout(s)
  s.combat.docked = true
  return s
}

afterEach(() => {
  setRelicSocketActivationProvider(null)
  resetRelicTestFixtures()
})

describe('GDD Relics in Cores', () => {
  it('unlocks Relics at the Act 1 door without inventing a global socket schedule', () => {
    const locked = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary - 1)
    expect(isRelicsUnlocked(locked)).toBe(false)

    const open = atCareerWave(createInitialState(0), ACT1_CADENCE.reliquary)
    expect(isRelicsUnlocked(open)).toBe(true)
    expect(corePrimarySocket('pulse-cannon')).toBe('power')
    expect(corePrimarySocket('plate-layer')).toBe('shield')
    expect(ACT1_CADENCE.reliquary).toBe(320)
    expect(coreSocketRelics(open, 'pulse-cannon:1').filter(Boolean)).toEqual([])
  })

  it('installs a physical Relic into a fitted Core without a global damage bonus', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0])
    let s = relicDock()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    const before = computeShipStats(s).damage
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id)
    expect(coreRelicId(s, 'pulse-cannon:1')).toBe(relic.id)
    expect(s.relics.coreFits['pulse-cannon:1']?.[0]).toBe(relic.id)
    expect(coreRelicModifiers(s, 'pulse-cannon:1').damageMult).toBe(1)
    expect(computeShipStats(s).damage).toBe(before)
  })

  it('keeps separate Relic loadouts on duplicate Core instances', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0])
    let s = relicDock()
    s.shipyard.frameId = 'swarm-frame'
    s.shipyard.unlockedFrames.push('swarm-frame')
    grantModuleCopy(s, 'pulse-cannon')
    s = fitModule(s, 'pulse-cannon')
    const pulseInstances = s.shipyard.modules.flatMap((moduleId, slot) =>
      moduleId === 'pulse-cannon' ? [s.shipyard.equippedCoreIds[slot]!] : [],
    )
    expect(pulseInstances).toHaveLength(2)

    const a = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    const b = addRelicInstance(s, FIXTURE_POWER_BEHAVIOURAL.id)!
    s = equipRelicOnCore(s, pulseInstances[0]!, a.id)
    s = equipRelicOnCore(s, pulseInstances[1]!, b.id)

    expect(coreSocketRelics(s, pulseInstances[0]!)[0]).toBe(a.id)
    expect(coreSocketRelics(s, pulseInstances[1]!)[0]).toBe(b.id)

    s = unfitModule(s, 'pulse-cannon', pulseInstances[1])
    expect(coreSocketRelics(s, pulseInstances[1]!)[0]).toBe(b.id)
  })

  it('drops type-keyed Relic fits instead of migrating them onto a physical copy', () => {
    const s = relicDock()
    s.relics.coreFits = { 'pulse-cannon': ['power-coupler:1'] }
    sanitizeCoreFits(s)
    expect(s.relics.coreFits['pulse-cannon']).toBeUndefined()
    expect(s.relics.coreFits['pulse-cannon:1']?.some(Boolean)).toBeFalsy()
  })

  it('authors Pulse M20 as Relic expansion without specifying later socket counts', () => {
    expect(corePrimarySocket('phase-beam')).toBe('optical')
    expect(corePrimarySocket('flak-array')).toBe('ballistic')
    expect(corePrimarySocket('heavy-lance')).toBe('ballistic')
    expect(masteryMilestonesFor('pulse-cannon').find((ms) => ms.level === 20)?.effect).toBe(
      'socket-expand',
    )
  })

  it('does not let Process auto-fit Relics or treat ownership as Reliquary mastery', () => {
    const s = relicDock()
    s.process.purchased = ['auto-relic', 'reliquary-keep', 'reliquary-quality', 'reliquary-merge']
    addRelicInstance(s, 'power-coupler')
    expect(hasProcessMastery(s, 'reliquary')).toBe(false)
    tickAutomation(s)
    expect(coreSocketRelics(s, 'pulse-cannon:1')[0] ?? null).toBeNull()
    expect(s.relics.instances).toHaveLength(1)
    const src = readFileSync(resolve(process.cwd(), 'src/game/automation.ts'), 'utf8')
    expect(src).not.toMatch(/autoSeatShards/)
  })

  it('removes Relics freely while Docked and refuses mid-Sortie swaps', () => {
    installAuthoredRelicFixtures()
    setRelicSocketActivationProvider(() => [0])
    let s = relicDock()
    const relic = addRelicInstance(s, FIXTURE_POWER_STANDARD.id)!
    s = equipRelicOnCore(s, 'pulse-cannon:1', relic.id)
    s.combat.docked = false
    const live = removeRelicFromCore(s, 'pulse-cannon:1')
    expect(coreRelicId(live, 'pulse-cannon:1')).toBe(relic.id)
    s.combat.docked = true
    s = removeRelicFromCore(s, 'pulse-cannon:1')
    expect(coreRelicId(s, 'pulse-cannon:1')).toBeNull()
    expect(s.relics.instances.some((row) => row.id === relic.id)).toBe(true)
  })
})
