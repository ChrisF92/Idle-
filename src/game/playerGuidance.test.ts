import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { exportSave, importSave } from './save'
import { markHullLost } from './testHelpers'
import {
  isEstablishedCareer,
  migrateOnboardingState,
  rebuildConsequenceLists,
  reinforceConsequenceLists,
  isFirstDefeatReport,
  sortieNextHints,
  processCoreHintReady,
} from './playerGuidance'
import { captureToastSnapshot, diffToasts } from './toasts'
import { applyDevAction } from './dev'

describe('player guidance helpers', () => {
  it('does not pause any remaining overlay lesson', () => {
    const fresh = createInitialState(0)
    expect(isEstablishedCareer(fresh)).toBe(false)
  })

  it('treats progressed careers as established and marks beginner ids', () => {
    const s = createInitialState(0)
    s.meta.highestSectorEver = 68
    s.prestige.prestigeCount = 1
    s.meta.seenOnboarding = ['guide-drone-cap', 'guide-furnace-v2-ash']
    migrateOnboardingState(s)
    expect(s.meta.seenOnboarding).toContain('guide-launch')
    expect(s.meta.seenOnboarding).toContain('guide-network-strike')
    expect(s.meta.seenOnboarding).toContain('guide-furnace-light')
  })

  it('does not flood a brand-new save with beginner completion', () => {
    const s = createInitialState(0)
    migrateOnboardingState(s)
    expect(s.meta.seenOnboarding).toEqual([])
  })

  it('maps legacy launch ids onto the new launch hint', () => {
    const s = createInitialState(0)
    s.meta.seenOnboarding = ['guide-shipyard-tab']
    migrateOnboardingState(s)
    expect(s.meta.seenOnboarding).toContain('guide-launch')
    expect(s.meta.seenOnboarding).not.toContain('guide-core-run')
  })

  it('lists accurate Rebuild keep/reset from unlocked systems', () => {
    const s = markHullLost(createInitialState(0))
    s.meta.highestSectorEver = 68
    s.combat.highestSector = 68
    s.combat.sector = 7
    const lists = rebuildConsequenceLists(s)
    expect(lists.gain[0]).toMatch(/Rebuild Matter/)
    expect(lists.keep).toEqual(expect.arrayContaining(['Research', 'Foundry recipes, stock, and facilities']))
    expect(lists.reset).toEqual(expect.arrayContaining(['Salvage', 'Run upgrades', 'Workshop']))
    expect(lists.change).toEqual([])
  })

  it('Reinforce lists keep Foundry and still reset the run', () => {
    const s = markHullLost(createInitialState(0))
    s.meta.highestSectorEver = 680
    const lists = reinforceConsequenceLists(s)
    expect(lists.gain.join(' ')).toMatch(/Rebuild Matter/)
    expect(lists.reset).toContain('Salvage')
  })

  it('flags the first defeat until the starter Cores have been used', () => {
    const s = markHullLost(createInitialState(0))
    expect(isFirstDefeatReport(s)).toBe(true)
    s.shipyard.moduleLevels['pulse-cannon'] = 1
    s.shipyard.moduleLevels['plate-layer'] = 1
    expect(isFirstDefeatReport(s)).toBe(false)
  })

  it('suggests idle drones and Plate from unlocked systems only', () => {
    const s = markHullLost(createInitialState(0))
    s.shipyard.moduleLevels['pulse-cannon'] = 3
    s.shipyard.moduleLevels['plate-layer'] = 1
    s.base.workerDrones = 4
    s.base.assignments = {}
    const hints = sortieNextHints(s)
    expect(hints.some((h) => /idle/i.test(h))).toBe(true)
    expect(hints).toContain('Spend Salvage on Attack, Defense, or Economy upgrades next Sortie')
    expect(hints.join(' ')).not.toMatch(/Salvage on Cores/i)
    expect(hints.join(' ')).not.toMatch(/Furnace/)
  })

  it('does not unlock retired Process Core automation', () => {
    const s = markHullLost(createInitialState(0))
    s.meta.aiUnlocked = true
    s.meta.highestSectorEver = 42
    s.combat.highestSector = 42
    s.prestige.prestigeCount = 2
    s.research.unlocked.push('basic-optics')
    s.meta.completedAchievements = ['first-blood']
    s.shipyard.moduleLevels['pulse-cannon'] = 4
    s.shipyard.moduleLevels['plate-layer'] = 3
    expect(processCoreHintReady(s)).toBe(false)
    const prev = captureToastSnapshot(s)
    prev.processCoreHint = false
    const toasts = diffToasts(prev, captureToastSnapshot(s), s)
    expect(toasts.some((t) => t.id === 'process:cores')).toBe(false)
  })

  it('hydrates established saves so they skip beginner overlays', () => {
    const s = markHullLost(createInitialState(0))
    s.meta.highestSectorEver = 10
    s.prestige.prestigeCount = 2
    s.meta.seenOnboarding = ['guide-drone-cap']
    const loaded = importSave(exportSave(s))
    expect(loaded?.meta.seenOnboarding).toContain('guide-launch')
    expect(loaded?.meta.seenOnboarding).not.toContain('guide-core-run')
  })

  it('replay-first-run clears seen flags without wiping progress', () => {
    let s = markHullLost(createInitialState(0))
    s.meta.seenOnboarding = ['guide-launch']
    s.meta.highestSectorEver = 3
    s = applyDevAction(s, { type: 'reset-onboarding' })
    expect(s.meta.seenOnboarding).toEqual([])
    expect(s.meta.hullLostOnce).toBe(false)
    expect(s.meta.highestSectorEver).toBe(3)
  })
})
