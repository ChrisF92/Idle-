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
      expect(help.body.join(' ')).not.toMatch(/USI|ITRTG|analogue/i)
      expect(screenHelpFor(id).title).toBe(help.title)
    }
  })

  it('hides late More doors until they are close, and opens Yard after Rebuild', () => {
    const fresh = createInitialState(0)
    const early = moreStationBuckets(fresh)
    expect(early.open.map((s) => s.id)).toEqual([])
    expect(early.next.map((s) => s.id)).toEqual(
      expect.arrayContaining(['reliquary', 'furnace', 'process', 'yard']),
    )
    expect(early.next.map((s) => s.id)).not.toContain('capital')
    expect(early.later.map((s) => s.id)).toEqual(
      expect.arrayContaining(['protocols', 'specialists', 'capital', 'reinforce']),
    )
    expect(MORE_STATIONS.some((s) => s.id === 'logs')).toBe(false)

    const rebuilt = createInitialState(0)
    rebuilt.prestige.prestigeCount = 1
    const after = moreStationBuckets(rebuilt)
    expect(after.open.map((s) => s.id)).toEqual(expect.arrayContaining(['yard', 'slag']))
  })
})
