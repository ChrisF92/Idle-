import { describe, expect, it } from 'vitest'
import { buyMatterShop, cycleSortieSpeed } from './actions'
import { hiveResearchCombatSpeed } from './hiveResearch'
import { processCombatSpeedMult } from './process'
import { createInitialState } from './state'
import { markHullLost, atCareerWave } from './testHelpers'
import { advanceSeconds, handleAppHidden, setDocked, setSortiePaused, tickGame } from './tick'
import { availableSortieSpeeds } from './uiReadout'
import { availableTimeCompressionSpeeds, selectedTimeCompression } from './matter'
import { tickFoundry } from './foundry'

describe('Time Compression clock', () => {
  it('is the only general combat-speed track', () => {
    const s = createInitialState(0)
    s.ai.purchased = ['combat-chrono-1', 'combat-chrono-2', 'combat-chrono-3']
    s.process.purchased = ['combat-tempo', 'combat-overclock']
    expect(hiveResearchCombatSpeed(s)).toBe(1)
    expect(processCombatSpeedMult(s)).toBe(1)
    expect(availableSortieSpeeds(s)).toEqual([1])
  })

  it('cycles through unlocked speeds and persists across Rebuild preference storage', () => {
    let s = createInitialState(0)
    s.resources.prestigeMatter = 200
    s = buyMatterShop(s, 'time-compression-1')
    s = buyMatterShop(s, 'time-compression-2')
    expect(availableTimeCompressionSpeeds(s)).toEqual([1, 1.5, 2])
    expect(selectedTimeCompression(s)).toBe(1)
    s = cycleSortieSpeed(s)
    expect(s.meta.sortieSpeed).toBe(1.5)
    s = cycleSortieSpeed(s)
    expect(s.meta.sortieSpeed).toBe(2)
  })

  it('1× vs 3× equal simulation time matches combat clock through the public path', () => {
    const seed = atCareerWave(markHullLost(createInitialState(0)), 20)
    seed.foundry.slots = seed.foundry.slots.map((slot, i) =>
      i === 0 ? { ...slot, recipeId: 'slag-ingot', progress: 0, paid: true } : slot,
    )
    let a = setDocked(structuredClone(seed), false)
    let b = setDocked(structuredClone(seed), false)
    b.prestige.matterShop = {
      'time-compression-1': 1,
      'time-compression-2': 1,
      'time-compression-3': 1,
    }
    b.meta.sortieSpeed = 3
    advanceSeconds(a, 30)
    advanceSeconds(b, 10)
    expect(b.combat.simTime).toBeCloseTo(a.combat.simTime, 4)
    expect(b.combat.wave).toBe(a.combat.wave)
    expect(b.foundry.slots[0]?.progress ?? 0).toBeLessThan(a.foundry.slots[0]?.progress ?? 1)
  })

  it('does not speed Foundry while compressing combat', () => {
    const a = createInitialState(0)
    a.foundry.slots = a.foundry.slots.map((slot, i) =>
      i === 0 ? { ...slot, recipeId: 'slag-ingot', progress: 0, paid: true } : slot,
    )
    const b = structuredClone(a)
    b.prestige.matterShop = {
      'time-compression-1': 1,
      'time-compression-2': 1,
      'time-compression-3': 1,
    }
    b.meta.sortieSpeed = 3
    tickFoundry(a, 10)
    tickFoundry(b, 10)
    expect(b.foundry.slots[0]?.progress).toBeCloseTo(a.foundry.slots[0]?.progress ?? 0, 8)
  })

  it('paused and hidden 3× combat sim stays frozen', () => {
    let s = setDocked(markHullLost(createInitialState(0)), false)
    s.prestige.matterShop = {
      'time-compression-1': 1,
      'time-compression-2': 1,
      'time-compression-3': 1,
    }
    s.meta.sortieSpeed = 3
    s = setSortiePaused(s, true)
    const sim = s.combat.simTime
    advanceSeconds(s, 2)
    expect(s.combat.simTime).toBe(sim)
    s = handleAppHidden(s)
    const now = (s.lastTickAt ?? 0) + 5000
    s = tickGame(s, now, false)
    expect(s.combat.sortiePaused).toBe(true)
    expect(s.combat.simTime).toBe(sim)
  })
})
