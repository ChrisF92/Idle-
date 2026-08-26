import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { getBlueprint } from './catalog'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'

function foundryState(wave: number = ACT1_CADENCE.foundryAdvanced) {
  return atCareerWave(createInitialState(0), wave)
}

function renderFoundry(state = foundryState(), pane?: 'processing' | 'fabrication' | 'mastery' | 'blueprints') {
  const props = {
    state,
    requestedPane: pane,
    onSetSlot: vi.fn(),
    onFabricateCore: vi.fn(),
    onStartFacility: vi.fn(),
    onStartRelic: vi.fn(),
    onStopFabrication: vi.fn(),
    onTrack: vi.fn(),
  }
  render(
    <OverlayProvider>
      <FoundryTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('complete Foundry interface', () => {
  afterEach(() => cleanup())

  it('uses the four final panes without legacy player-facing tabs', () => {
    renderFoundry()
    expect(screen.getByRole('tab', { name: 'Processing' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Fabrication' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mastery' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Blueprints' })).toBeTruthy()
    for (const legacy of ['Smelt', 'Prints', 'Build', 'Construction', 'Fit', 'Ranks']) {
      expect(screen.queryByRole('tab', { name: legacy })).toBeNull()
    }
  })

  it('keeps the header compact and shows active Processors first', () => {
    const state = foundryState()
    state.base.assignments['alloy-foundry'] = 2
    state.base.assignments['fab-bay'] = 1
    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: false }
    state.resources.scrap = 0
    renderFoundry(state)
    const context = document.querySelector('.ui-context-bar')!
    expect(context.textContent).toContain('Foundry workers3')
    expect(context.textContent).toContain('Processors1/1')
    expect(context.textContent).toContain('Fabricators0/1')
    expect(screen.getAllByText('Processor I').length).toBeGreaterThan(0)
    expect(screen.getByText(/Waiting for Scrap/i)).toBeTruthy()
    expect(screen.getByText(/2 Worker Drones/)).toBeTruthy()
  })

  it('places Infrastructure projects under Fabrication', () => {
    renderFoundry(foundryState(), 'fabrication')
    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Infrastructure' }))
    expect(screen.getByText('Processing Line')).toBeTruthy()
    expect(screen.getByText('Fabrication Machinery')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Build' })).toBeNull()
  })

  it('moves long-lived material progression to the Mastery pane and sheet', () => {
    const state = foundryState()
    state.foundry.recipeLevels['slag-ingot'] = 5
    state.foundry.recipeXp['slag-ingot'] = 2
    renderFoundry(state, 'mastery')
    expect(screen.getByText('Material Mastery')).toBeTruthy()
    expect(screen.getByText('M5')).toBeTruthy()
    fireEvent.click(document.querySelector('.foundry-mastery-card')!)
    expect(screen.getByRole('dialog', { name: 'Recovered Stock' })).toBeTruthy()
    expect(screen.getByText('Milestones')).toBeTruthy()
    expect(screen.getAllByText(/M10/).length).toBeGreaterThan(0)
  })

  it('does not complete leftover Blueprints for a final Core', () => {
    const state = foundryState(80)
    const moduleId = 'flak-array'
    expect(getBlueprint(moduleId)).toBeUndefined()
    state.meta.discoveredModules.push(moduleId)
    renderFoundry(state, 'blueprints')
    expect(screen.queryByRole('button', { name: /Flak Array/i })).toBeNull()
    expect(state.shipyard.unlockedModules).not.toContain(moduleId)
    expect(state.shipyard.coreInstances.every((row) => row.moduleId !== moduleId)).toBe(true)
  })
})
