import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProcessTab } from '../components/tabs/ProcessTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE, PROCESS_MIN_REBUILDS } from './cadence'
import { processConfig } from './process'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function processState() {
  const s = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.process)
  s.prestige.prestigeCount = PROCESS_MIN_REBUILDS
  s.hiveResearch.completed.energy = 1
  s.resources.aiPoints = 40
  return s
}

function renderProcess(state = processState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onBuy: vi.fn(),
    onConfig: vi.fn(),
  }
  render(
    <OverlayProvider>
      <ProcessTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('Process 3.0 UI', () => {
  afterEach(cleanup)

  it('shows the Process header and four panes', () => {
    renderProcess()
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toMatch(/Process Points/)
    expect(context.textContent).toMatch(/Automations/)
    expect(context.textContent).toMatch(/Profile/)
    expect(context.textContent).toMatch(/Rules/)
    expect(screen.getByRole('tab', { name: 'Capabilities' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Automations' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Rules' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Profiles' })).toBeTruthy()
    expect(document.querySelector('.process-graph')).toBeTruthy()
    expect(document.querySelector('.network-row')).toBeNull()
    expect(screen.getByText('QoL')).toBeTruthy()
    expect(screen.getByText('Sortie')).toBeTruthy()
    expect(screen.getByText('Logic')).toBeTruthy()
  })

  it('lists owned automations with ON/OFF and last action', () => {
    const state = processState()
    state.process.purchased = ['auto-shop', 'spend-ratios']
    state.process.config = {
      ...processConfig(state),
      shop: { autoBuy: true, ratios: { attack: 50, defense: 30, economy: 20 }, salvageReserve: 2000 },
    }
    renderProcess(state)
    fireEvent.click(screen.getByRole('tab', { name: 'Automations' }))
    expect(screen.getByText('Sortie Auto-Buy')).toBeTruthy()
    expect(screen.getByText(/50 \/ 30 \/ 20/)).toBeTruthy()
    expect(screen.getByText(/Reserve/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ON' })).toBeTruthy()
    expect(screen.getByText(/Last action/)).toBeTruthy()
  })

  it('edits a rule in a full-height sheet with chips, not syntax', () => {
    const state = processState()
    state.process.purchased = ['buy-ten', 'auto-shop', 'spend-ratios', 'rule-builder', 'run-profiles']
    state.process.config = { ...processConfig(state), activeProfileId: 'farm' }
    renderProcess(state)
    fireEvent.click(screen.getByRole('tab', { name: 'Rules' }))
    expect(screen.getByText('WHEN')).toBeTruthy()
    expect(screen.getByText(/Wave ≥/)).toBeTruthy()
    expect(screen.getByText('THEN')).toBeTruthy()
    expect(screen.queryByText(/Threat|Pressure|if \(/)).toBeNull()
    fireEvent.click(screen.getByText(/Wave ≥/))
    expect(screen.getByRole('dialog', { name: 'Bank Economy' })).toBeTruthy()
    expect(screen.getByText('WHEN')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete rule' })).toBeTruthy()
  })

  it('summarises Farm, Push, Challenge, and Custom profiles', () => {
    const state = processState()
    state.process.purchased = ['rule-builder', 'run-profiles']
    state.process.config = { ...processConfig(state), activeProfileId: 'farm' }
    renderProcess(state)
    fireEvent.click(screen.getByRole('tab', { name: 'Profiles' }))
    expect(screen.getByText('Farm')).toBeTruthy()
    expect(screen.getByText('Push')).toBeTruthy()
    expect(screen.getByText('Challenge')).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
    expect(screen.getAllByText(/Sortie/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Workers/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Furnace/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Extract/).length).toBeGreaterThan(0)
  })
})
