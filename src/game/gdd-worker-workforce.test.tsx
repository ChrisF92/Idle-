import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerDronesTab } from '../components/tabs/WorkerDronesTab'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'

function workforceState() {
  const state = atCareerWave(createInitialState(0), 170)
  state.base.workerDrones = 5
  state.base.assignments = {
    'scrap-field': 1,
    'alloy-foundry': 1,
    'fab-bay': 1,
    'sensor-net': 1,
    construction: 1,
  }
  state.foundry.facilities = ['worker-fabricator']
  state.foundry.slots[0] = { recipeId: 'recovered-stock', progress: 0.4, paid: true }
  state.foundry.fabrication = [
    { kind: 'core', jobId: 'flak-array', progress: 0.25, paid: true },
    { kind: 'facility', jobId: 'processing-line', progress: 0.5, paid: true },
  ]
  state.hiveResearch.active = true
  state.hiveResearch.focus = 'observation'
  state.hiveResearch.activeNodeId = 'd4-worker-calibration'
  return state
}

describe('Worker Drone workforce UI', () => {
  afterEach(() => cleanup())

  it('shows the exact workforce header and real active jobs', () => {
    render(<WorkerDronesTab state={workforceState()} onAssign={vi.fn()} />)
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Workers')
    expect(context.textContent).toContain('/ 6 capacity')
    expect(context.textContent).toContain('Assigned')
    expect(context.textContent).toContain('Idle')
    expect(context.textContent).toMatch(/5/)
    expect(context.textContent).not.toMatch(/Total16|Capacity18/)

    expect(screen.getByText('Recovered Stock Processing')).toBeTruthy()
    expect(screen.getByText('Flak Array Fabrication')).toBeTruthy()
    expect(screen.getByText('Research — Worker Calibration')).toBeTruthy()
    expect(screen.getByText('Worker Fabrication')).toBeTruthy()
    expect(screen.getByText('Salvage Operations')).toBeTruthy()
    expect(screen.getByText('Processing Line Infrastructure')).toBeTruthy()
    expect(screen.getAllByText(/Efficient \d+–\d+/).length).toBe(6)
    expect(screen.getAllByText(/\+1 Worker →/).length).toBe(6)
    expect(screen.getAllByRole('button', { name: /Assign Worker Drone to/ }).length).toBe(6)
  })

  it('contains no obsolete player-facing combat-work terminology', () => {
    render(<WorkerDronesTab state={workforceState()} onAssign={vi.fn()} />)
    expect(document.body.textContent).not.toMatch(/\bNetwork\b|\bStrike\b|\bWard\b|\bYield\b|\bLoom\b|\bRelay\b|\bLattice\b/)
  })

  it('shows one-click Balance only when Process supplies the convenience', () => {
    const state = workforceState()
    const { rerender } = render(<WorkerDronesTab state={state} onAssign={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Balance' })).toBeNull()
    rerender(<WorkerDronesTab state={state} onAssign={vi.fn()} onOptimise={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Balance' })).toBeTruthy()
  })
})
