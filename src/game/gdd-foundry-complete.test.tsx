import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { getBlueprint, PART_TYPES, partId } from './catalog'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'

function foundryState(wave = ACT1_CADENCE.foundryAdvanced) {
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
  it('uses the four final panes without legacy player-facing tabs', () => {
    renderFoundry()
    expect(screen.getByRole('tab', { name: 'Processing' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Fabrication' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mastery' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Blueprints' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /Smelt|Prints|Build|Construction|Fit|Ranks/i })).toBeNull()
  })

  it('keeps the header compact and shows active Processors first', () => {
    const state = foundryState()
    state.base.assignments['alloy-foundry'] = 2
    state.base.assignments['fab-bay'] = 1
    state.foundry.slots[0] = { recipeId: 'slag-ingot', progress: 0.4, paid: false }
    state.resources.scrap = 0
    renderFoundry(state)
    expect(screen.getByText('Foundry workers').nextElementSibling?.textContent).toBe('3')
    expect(screen.getByText('Processors').nextElementSibling?.textContent).toBe('1/1')
    expect(screen.getByText('Fabricators').nextElementSibling?.textContent).toBe('0/1')
    expect(screen.getByText('Processor I')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /Recovered Stock/i }))
    expect(screen.getByRole('dialog', { name: 'Recovered Stock' })).toBeTruthy()
    expect(screen.getByText('Milestones')).toBeTruthy()
    expect(screen.getByText(/M10/)).toBeTruthy()
  })

  it('completes a Blueprint without creating the Core and links to its project', () => {
    const state = foundryState(80)
    const moduleId = 'flak-array'
    const recipe = getBlueprint(moduleId)!
    state.meta.discoveredModules.push(moduleId)
    for (const part of PART_TYPES) state.parts[partId(moduleId, part)] = recipe[part]
    expect(state.shipyard.unlockedModules).not.toContain(moduleId)
    renderFoundry(state, 'blueprints')
    fireEvent.click(screen.getByRole('button', { name: /Flak Array.*COMPLETE/i }))
    expect(screen.getByText('View Project')).toBeTruthy()
    fireEvent.click(screen.getByText('View Project'))
    expect(screen.getByRole('dialog', { name: 'Flak Array' })).toBeTruthy()
    expect(screen.getByText(/Blueprint complete/i)).toBeTruthy()
    expect(state.shipyard.unlockedModules).not.toContain(moduleId)
  })
})
