import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'
import {
  captureToastSnapshot,
  diffToasts,
  enqueueToasts,
  expireToasts,
  TOAST_MAX_QUEUE,
} from './toasts'
import { blueprintProgress } from './catalog'

describe('session toasts', () => {
  it('emits nothing when the current state is the baseline', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 8
    state.combat.highestSector = 8
    const snap = captureToastSnapshot(state)
    expect(diffToasts(snap, snap, state)).toEqual([])
  })

  it('toasts hull-loss systems once, not as historical spam', () => {
    const fresh = createInitialState(0)
    const prev = captureToastSnapshot(fresh)
    const nextState = markHullLost(fresh)
    const next = captureToastSnapshot(nextState)
    const toasts = diffToasts(prev, next, nextState)
    expect(toasts.map((t) => t.id)).toEqual(['sys:workshop'])
    expect(toasts[0]?.action?.nav).toEqual({ kind: 'tab', tab: 'dock' })
  })

  it('toasts Worker Drones when the workforce unlocks', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    state.meta.highestSectorEver = 30
    state.combat.bestWave = 30
    const toasts = diffToasts(prev, captureToastSnapshot(state), state)
    expect(toasts.find((toast) => toast.id === 'sys:network')?.title).toBe('Worker Drones unlocked')
    expect(toasts.find((toast) => toast.id === 'sys:network')?.body).not.toMatch(/Network/)
  })

  it('toasts Foundry unlock with a direct action', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    const toasts = diffToasts(prev, captureToastSnapshot(state), state)
    expect(toasts.some((t) => t.id === 'sys:foundry')).toBe(true)
    const foundry = toasts.find((t) => t.id === 'sys:foundry')
    expect(foundry?.action?.label).toBe('OPEN')
    expect(foundry?.action?.nav).toEqual({ kind: 'tab', tab: 'foundry' })
  })

  it('toasts Research rather than duplicating Archive at sector 7', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    const prev = captureToastSnapshot(state)
    state.meta.highestSectorEver = 34
    state.combat.highestSector = 34
    const ids = diffToasts(prev, captureToastSnapshot(state), state).map((t) => t.id)
    expect(ids).toContain('sys:research')
    expect(ids).not.toContain('netbar:archive')
  })

  it('toasts Rebuild the first time the hangar is available', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    state.combat.sector = 12
    const toasts = diffToasts(prev, captureToastSnapshot(state), state)
    expect(toasts.some((t) => t.id === 'sys:rebuild')).toBe(true)
    expect(toasts.find((t) => t.id === 'sys:rebuild')?.action?.nav).toEqual({ kind: 'rebuild' })
  })

  it('toasts a completed Core Blueprint with View Project', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 8
    state.combat.highestSector = 8
    const prev = captureToastSnapshot(state)
    const blueprint = captureToastSnapshot(state).farmablePrints[0]
    expect(blueprint).toBeTruthy()
    state.parts[`${blueprint}:casing`] = 9
    state.parts[`${blueprint}:core`] = 9
    state.parts[`${blueprint}:lens`] = 9
    expect(blueprintProgress(state, blueprint!)?.complete).toBe(true)
    const toasts = diffToasts(prev, captureToastSnapshot(state), state)
    expect(toasts.some((t) => t.id === `blueprint-complete:${blueprint}`)).toBe(true)
    expect(toasts.find((t) => t.id === `blueprint-complete:${blueprint}`)?.action?.label).toBe('VIEW PROJECT')
    expect(toasts.find((t) => t.id === `blueprint-complete:${blueprint}`)?.category).toBe('BLUEPRINT COMPLETE')
  })

  it('toasts completed Infrastructure', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 6
    state.combat.highestSector = 6
    state.combat.docked = true
    const prev = captureToastSnapshot(state)
    state.foundry.facilities.push('processing-line')
    const toasts = diffToasts(prev, captureToastSnapshot(state), state)
    expect(toasts.some((t) => t.id === 'fab-facility:processing-line')).toBe(true)
    expect(toasts.find((t) => t.id === 'fab-facility:processing-line')?.action?.label).toBe('VIEW INFRASTRUCTURE')
  })

  it('coalesces duplicate ids and bounds the queue', () => {
    const first = enqueueToasts(
      [],
      [{ id: 'sys:foundry', category: 'SYSTEM ONLINE', title: 'A', body: 'one' }],
      1000,
    )
    const dup = enqueueToasts(
      first,
      [{ id: 'sys:foundry', category: 'SYSTEM ONLINE', title: 'B', body: 'two' }],
      2000,
    )
    expect(dup).toHaveLength(1)
    expect(dup[0]?.title).toBe('B')
    expect(dup[0]?.createdAt).toBe(2000)

    const many = enqueueToasts(
      [],
      Array.from({ length: 12 }, (_, i) => ({
        id: `sys:${i}`,
        category: 'SYSTEM ONLINE',
        title: `${i}`,
        body: 'x',
      })),
      3000,
    )
    expect(many).toHaveLength(TOAST_MAX_QUEUE)
  })

  it('expires stale toasts without keeping a history', () => {
    const q = enqueueToasts(
      [],
      [{ id: 'sys:foundry', category: 'SYSTEM ONLINE', title: 'A', body: 'one' }],
      1000,
    )
    expect(expireToasts(q, 1000 + 4999)).toHaveLength(1)
    expect(expireToasts(q, 1000 + 5000)).toHaveLength(0)
  })
})
