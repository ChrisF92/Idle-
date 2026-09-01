import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChallengesTab } from '../components/tabs/ChallengesTab'
import { OverlayProvider } from '../ui/overlay'
import { ACT1_CADENCE } from './cadence'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'

function challengeState() {
  const s = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.challenges)
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
      <ChallengesTab {...props} />
    </OverlayProvider>,
  )
  return props
}

describe('Challenges UI', () => {
  afterEach(() => cleanup())

  it('prints glance cards without dumping the full restriction sheet', () => {
    renderChallenges()
    expect(screen.getByText('Glass Frame')).toBeTruthy()
    expect(screen.getByText(/Maximum Hull reduced by 50%/)).toBeTruthy()
    expect(screen.getByText(/Next target W450/)).toBeTruthy()
    expect(screen.getByText(/Ablative Mesh Blueprint/)).toBeTruthy()
    expect(document.querySelector('.network-row')).toBeNull()
    expect(screen.queryByText('Disabled systems.')).toBeNull()
    expect(screen.queryByText('Modified Hive')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start Challenge' })).toBeNull()
    expect(screen.queryByText(/Echo/)).toBeNull()
  })

  it('opens a full sheet with restriction, modifiers, Hive stats, and Start Challenge', () => {
    const props = renderChallenges()
    fireEvent.click(screen.getByRole('button', { name: /Glass Frame/ }))
    expect(screen.getByRole('dialog', { name: 'Glass Frame' })).toBeTruthy()
    expect(screen.getByText('Disabled systems.')).toBeTruthy()
    expect(screen.getAllByText(/Maximum Hull reduced by 50%/).length).toBeGreaterThan(0)
    expect(screen.getByText(/normal account and starts a fresh Sortie at Wave 1/)).toBeTruthy()
    expect(screen.getByText(/No entry currency and no Rebuild is consumed/)).toBeTruthy()
    expect(screen.getByText('Modified Hive')).toBeTruthy()
    expect(screen.getByText('Starting Wave')).toBeTruthy()
    expect(screen.getByText('Hull')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Challenge' }))
    expect(props.onEnter).toHaveBeenCalledWith('glass-frame')
  })
})
