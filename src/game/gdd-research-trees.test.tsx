import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchTab } from '../components/tabs/ResearchTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { getHiveResearchNode, HIVE_RESEARCH_NODES } from './hiveResearch'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function researchState() {
  return atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.research)
}

function renderResearch(state = researchState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onStart: vi.fn(),
  }
  render(
    <OverlayProvider>
      <ResearchTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('branching Research interface', () => {
  afterEach(() => cleanup())

  it('shows the compact header and four discipline tabs', () => {
    renderResearch()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toMatch(/Project/)
    expect(context.textContent).toMatch(/Progress/)
    expect(context.textContent).toMatch(/Remaining/)
    expect(context.textContent).toMatch(/Speed/)
    expect(context.textContent).toMatch(/Workers/)
    expect(screen.getByRole('tab', { name: 'Engineering' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Drones' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Industry' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Compute' })).toBeTruthy()
  })

  it('reveals only the root until a project is chosen, then opens a sheet', () => {
    renderResearch()
    expect(screen.getByRole('button', { name: 'Plate Bank' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Extra Tap' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Plate Bank' }))
    expect(screen.getByRole('dialog', { name: 'Plate Bank' })).toBeTruthy()
    expect(screen.getAllByText(/Cycle Core Level/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Duration/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Research' })).toBeTruthy()
  })

  it('starts the chosen project from the sheet', () => {
    const props = renderResearch()
    fireEvent.click(screen.getByRole('button', { name: 'Plate Bank' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Research' }))
    expect(props.onStart).toHaveBeenCalledWith('plate-bank')
  })

  it('opens Drone Systems on Priority Lock and keeps Compute locked until Process', () => {
    renderResearch()
    fireEvent.click(screen.getByRole('tab', { name: 'Drones' }))
    expect(screen.getByRole('button', { name: 'Priority Lock' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Compute' }))
    expect(screen.getByText(/Opens at Wave/)).toBeTruthy()
  })

  it('keeps genuine forks in the authored trees', () => {
    const children = (id: string) =>
      Object.values(HIVE_RESEARCH_NODES)
        .flat()
        .filter((node) => node.prerequisites.includes(id))
        .map((node) => node.id)
    expect(children('plate-bank').length).toBeGreaterThanOrEqual(2)
    expect(children('priority-lock').length).toBeGreaterThanOrEqual(2)
    expect(children('second-processor').length).toBeGreaterThanOrEqual(2)
    expect(getHiveResearchNode('hangar-swap')?.prerequisites).toEqual(['extra-tap', 'keel-bay'])
    expect(getHiveResearchNode('hearth-line')?.prerequisites).toEqual(['pattern-floor', 'fab-machinery'])
    expect(getHiveResearchNode('workforce-sync')?.prerequisites).toEqual(['drone-racks', 'combat-sim'])
    expect(getHiveResearchNode('auto-desk')?.prerequisites).toEqual(['inspect-layer', 'process-primer'])
  })
})
