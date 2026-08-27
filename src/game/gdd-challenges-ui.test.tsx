import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProtocolsTab } from '../components/tabs/ProtocolsTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE, CHALLENGE_MIN_REBUILDS } from './cadence'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function challengeState() {
  const s = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.protocols)
  s.prestige.prestigeCount = CHALLENGE_MIN_REBUILDS
  s.hiveResearch.completed.energy = 1
  s.combat.docked = true
  s.foundry.masteryXp['recovered-stock'] = 1
  s.base.assignments['scrap-field'] = 2
  s.resources.choirAsh = 12
  s.workshop.coreStarts = { 'pulse-cannon:1': 4, 'plate-layer:1': 4 }
  s.relics.coreFits = { 'pulse-cannon:1': ['relic-test'] }
  return s
}

function renderChallenges(state = challengeState()) {
  const props = {
    state,
    onBack: vi.fn(),
    onEnter: vi.fn(),
    onAbandon: vi.fn(),
  }
  render(
    <OverlayProvider>
      <ProtocolsTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('Challenges UI', () => {
  afterEach(() => cleanup())

  it('prints glance cards without dumping the full restriction sheet', () => {
    renderChallenges()
    expect(screen.getByText('Glass Hive')).toBeTruthy()
    expect(screen.getByText(/Hull is halved/)).toBeTruthy()
    expect(screen.getByText(/Goal Wave 80/)).toBeTruthy()
    expect(screen.getByText(/Plate Chip/)).toBeTruthy()
    expect(document.querySelector('.network-row')).toBeNull()
    expect(screen.queryByText('Disabled systems.')).toBeNull()
    expect(screen.queryByText('Modified Hive')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start Challenge' })).toBeNull()
    expect(screen.queryByText(/Echo/)).toBeNull()
  })

  it('opens a full sheet with restriction, modifiers, Hive stats, and Start Challenge', () => {
    const props = renderChallenges()
    fireEvent.click(screen.getByRole('button', { name: /Glass Hive/ }))
    expect(screen.getByRole('dialog', { name: 'Glass Hive' })).toBeTruthy()
    expect(screen.getByText('Disabled systems.')).toBeTruthy()
    expect(screen.getByText(/Hull integrity/)).toBeTruthy()
    expect(screen.getByText(/Uses the normal Sortie engine/)).toBeTruthy()
    expect(screen.getByText(/Every Challenge starts at Wave 1/)).toBeTruthy()
    expect(screen.getByText('Modified Hive')).toBeTruthy()
    expect(screen.getByText('Starting Wave')).toBeTruthy()
    expect(screen.getByText('Hull modifier')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }))
    expect(props.onEnter).toHaveBeenCalledWith('glass-ward')
  })
})
