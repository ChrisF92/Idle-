import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchTab } from '../components/tabs/ResearchTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function renderResearch() {
  const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.research)
  const props = { state, onBack: vi.fn(), onStart: vi.fn() }
  render(<OverlayProvider><ResearchTab {...props} /></OverlayProvider>)
  return props
}

describe('PR9 Research interface', () => {
  afterEach(cleanup)

  it('shows four mobile discipline tabs and only the next available project', () => {
    renderResearch()
    for (const name of ['Engineering', 'Drones', 'Industry', 'Compute']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Cycle Engineering' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Workshop Tooling' })).toBeNull()
  })

  it('starts an authored project from its detail sheet', () => {
    const props = renderResearch()
    fireEvent.click(screen.getByRole('button', { name: 'Cycle Engineering' }))
    expect(screen.getByRole('dialog', { name: 'Cycle Engineering' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Research' }))
    expect(props.onStart).toHaveBeenCalledWith('e1-cycle-engineering')
  })

  it('opens each discipline at the Research door', () => {
    renderResearch()
    fireEvent.click(screen.getByRole('tab', { name: 'Drones' }))
    expect(screen.getByRole('button', { name: 'Fire-Control Doctrine' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Industry' }))
    expect(screen.getByRole('button', { name: 'Second Processor' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Compute' }))
    expect(screen.getByRole('button', { name: 'Queue Buffer' })).toBeTruthy()
  })
})
