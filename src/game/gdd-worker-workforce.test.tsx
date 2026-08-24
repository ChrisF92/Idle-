import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerDronesTab } from '../components/tabs/WorkerDronesTab'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'

function workforceState() {
  const state = atCareerWave(createInitialState(0), 170)
  state.base.workerDrones = 16
  state.base.assignments = {
    'scrap-field': 1,
    'alloy-foundry': 3,
    'fab-bay': 2,
    'sensor-net': 4,
    'drone-fab': 2,
    construction: 2,
  }
  state.foundry.facilities = ['drone-fabricator', 'drone-racks', 'drone-racks']
  state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: true }
  state.foundry.fabrication = [
    { kind: 'core', jobId: 'flak-array', progress: 0.25, paid: true, complete: false },
    { kind: 'facility', jobId: 'processing-line', progress: 0.5, paid: true, complete: false },
  ]
  state.hiveResearch.active = true
  state.hiveResearch.focus = 'energy'
  return state
}

describe('Worker Drone workforce UI', () => {
  afterEach(() => cleanup())

  it('shows the exact workforce header and real active jobs', () => {
    render(<WorkerDronesTab state={workforceState()} onAssign={vi.fn()} />)
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Total16')
    expect(context.textContent).toContain('Assigned14')
    expect(context.textContent).toContain('Idle2')
    expect(context.textContent).toContain('Capacity18')

    expect(screen.getByText('Recovered Stock Processing')).toBeTruthy()
    expect(screen.getByText('Flak Array Fabrication')).toBeTruthy()
    expect(screen.getByText('Research — Priority Lock')).toBeTruthy()
    expect(screen.getByText('Worker Drone Fabrication')).toBeTruthy()
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
