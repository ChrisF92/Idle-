import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { LIVE_SCREENS, SCREEN_HELP, screenHelpFor } from './screenHelp'
import { moreStationBuckets, MORE_STATIONS } from './moreStations'

describe('screen help and More buckets', () => {
  it('covers every live screen with a title and two beats of copy', () => {
    for (const id of LIVE_SCREENS) {
      const help = SCREEN_HELP[id]
      expect(help, id).toBeTruthy()
      expect(help.title.length).toBeGreaterThan(2)
      expect(help.body.length).toBeGreaterThanOrEqual(2)
      expect(help.body.join(' ')).not.toMatch(/USI|ITRTG|analogue|\bFlagship\b|\bSector\b/i)
      expect(screenHelpFor(id).title).toBe(help.title)
    }
  })

  it('hides locked doors on More and does not dump later systems', () => {
    const fresh = createInitialState(0)
    const early = moreStationBuckets(fresh)
    expect(early.open.map((s) => s.id)).toEqual([])
    expect(early.next).toEqual([])
    expect(early.later).toEqual([])
    expect(MORE_STATIONS.map((s) => s.id)).toEqual(['codex', 'challenges', 'reinforce'])
    expect(MORE_STATIONS.some((s) => s.id === 'logs')).toBe(false)

    const rebuilt = createInitialState(0)
    rebuilt.prestige.prestigeCount = 1
    const after = moreStationBuckets(rebuilt)
    expect(after.open.map((s) => s.id)).not.toContain('slag')
    expect(after.open.map((s) => s.id)).not.toContain('yard')
  })
})
