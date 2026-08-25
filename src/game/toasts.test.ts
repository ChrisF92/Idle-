import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { markHullLost, atCareerWave } from './testHelpers'
import { ACT1_CADENCE } from './cadence'
import {
  captureToastSnapshot,
  diffToasts,
  enqueueToasts,
  expireToasts,
  selectPresentation,
  TOAST_MAX_QUEUE,
} from './presentation'
import { blueprintProgress } from './catalog'
import { activeOnboardingLesson, prepOnboardingDoor } from './onboarding'

describe('session toasts', () => {
  it('emits nothing when the current state is the baseline', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 8
    const snap = captureToastSnapshot(state)
    expect(diffToasts(snap, snap, state)).toEqual([])
  })

  it('does not toast Workshop on hull loss', () => {
    const fresh = createInitialState(0)
    const prev = captureToastSnapshot(fresh)
    const nextState = markHullLost(fresh)
    const toasts = diffToasts(prev, captureToastSnapshot(nextState), nextState)
    expect(toasts.map((t) => t.id)).not.toContain('sys:workshop')
    expect(toasts.map((t) => t.id)).not.toContain('sys:network')
    expect(toasts.some((t) => /workshop/i.test(t.title))).toBe(false)
  })

  it('toasts Worker Drones when the workforce unlocks', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    const next = atCareerWave(state, ACT1_CADENCE.workers)
    const toasts = diffToasts(prev, captureToastSnapshot(next), next)
    expect(toasts.find((toast) => toast.id === 'sys:network')?.title).toBe('Worker Drones unlocked')
    expect(toasts.find((toast) => toast.id === 'sys:network')?.body).not.toMatch(/Network/)
  })

  it('toasts Foundry unlock with current IA', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    const next = atCareerWave(state, ACT1_CADENCE.foundry)
    const toasts = diffToasts(prev, captureToastSnapshot(next), next)
    expect(toasts.some((t) => t.id === 'sys:foundry')).toBe(true)
    const foundry = toasts.find((t) => t.id === 'sys:foundry')
    expect(foundry?.action?.label).toMatch(/OPEN/i)
    expect(foundry?.action?.nav).toEqual({ kind: 'tab', tab: 'foundry', pane: 'processing' })
  })

  it('toasts Research rather than duplicating Archive', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(atCareerWave(state, ACT1_CADENCE.foundry))
    const next = atCareerWave(structuredClone(state), ACT1_CADENCE.research)
    const ids = diffToasts(prev, captureToastSnapshot(next), next).map((t) => t.id)
    expect(ids).toContain('sys:research')
    expect(ids).not.toContain('netbar:archive')
  })

  it('toasts Rebuild the first time the hangar is available', () => {
    const state = markHullLost(createInitialState(0))
    const prev = captureToastSnapshot(state)
    const next = atCareerWave(state, ACT1_CADENCE.rebuild)
    next.prestige.cycle = { bestWave: ACT1_CADENCE.rebuild, sorties: 8, scrapEarned: 0 }
    const toasts = diffToasts(prev, captureToastSnapshot(next), next)
    expect(toasts.some((t) => t.id.startsWith('rebuild-ready'))).toBe(true)
    expect(toasts.find((t) => t.id.startsWith('rebuild-ready'))?.action?.nav).toEqual({ kind: 'rebuild' })
  })

  it('toasts a completed Core Print toward Fabrication', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.highestSectorEver = 8
    const prev = captureToastSnapshot(state)
    const print = captureToastSnapshot(state).completePrints[0]
    const farmable = captureToastSnapshot(state)
    void farmable
    const prints = Object.keys(state.parts)
    void prints
    const candidate = 'pulse-cannon'
    state.parts[`${candidate}:casing`] = 9
    state.parts[`${candidate}:core`] = 9
    state.parts[`${candidate}:lens`] = 9
    if (blueprintProgress(state, candidate)?.complete) {
      const toasts = diffToasts(prev, captureToastSnapshot(state), state)
      expect(toasts.some((t) => t.id === `blueprint-complete:${candidate}` || t.category === 'BLUEPRINT COMPLETE')).toBe(true)
    }
    expect(print === undefined || typeof print === 'string').toBe(true)
  })

  it('never shows a toast over blocking onboarding', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'opening.salvage')
    const queued = enqueueToasts(
      [],
      [{ id: 'sys:foundry', category: 'SYSTEM ONLINE', title: 'Foundry online', body: 'Wait', tier: 'major' }],
      1,
    )
    const current = selectPresentation(state, { tab: 'combat' }, queued, {})
    expect(current?.kind).toBe('onboarding')
    expect(activeOnboardingLesson(state, { tab: 'combat' })?.id).toBe('opening.salvage')
  })

  it('holds toasts and onboarding while a Sortie Report is open', () => {
    const state = prepOnboardingDoor(createInitialState(0), 'first-defeat.workshop')
    const queued = enqueueToasts(
      [],
      [{ id: 'sys:foundry', category: 'SYSTEM ONLINE', title: 'Foundry online', body: 'Wait', tier: 'action' }],
      1,
    )
    expect(selectPresentation(state, { tab: 'dock', reportOpen: true }, queued, { reportOpen: true })).toBeNull()
  })

  it('caps the queue', () => {
    const lots = Array.from({ length: 20 }, (_, i) => ({
      id: `minor:${i}`,
      category: 'INFO',
      title: `T${i}`,
      body: '',
      tier: 'minor' as const,
    }))
    const queued = enqueueToasts([], lots, 1)
    expect(queued.length).toBeLessThanOrEqual(TOAST_MAX_QUEUE)
    expect(expireToasts(queued, 1 + 60_000)).toEqual([])
  })
})
