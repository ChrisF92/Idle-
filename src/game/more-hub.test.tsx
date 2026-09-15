import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StatsTab } from '../components/tabs/StatsTab'
import { createInitialState } from './state'
import { atCareerWave } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

afterEach(cleanup)

function renderMore(state = createInitialState(0), onOpenStation = vi.fn()) {
  return {
    onOpenStation,
    ...render(
      <StatsTab
        state={state}
        onHardReset={() => undefined}
        onImport={() => false}
        onDevAction={() => undefined}
        onNotation={() => undefined}
        onDamageNumbers={() => undefined}
        onOpenStation={onOpenStation}
        onOpenSimulator={() => undefined}
        onOpenInventory={() => undefined}
      />,
    ),
  }
}

describe('More hub navigation', () => {
  it('shows the five approved fresh-save destinations in order', () => {
    renderMore()
    const labels = [...document.querySelectorAll('.more-list .ui-item-row strong')]
      .map((element) => element.textContent?.trim())
    expect(labels).toEqual(['Inventory', 'Help & Guides', 'Settings', 'Save Data', 'About'])
    expect(screen.queryByText('Career Statistics')).toBeNull()
    expect(screen.queryByText('Codex')).toBeNull()
    expect(screen.queryByText(/Developer|Balance Simulator/)).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Stations' })).toBeNull()
  })

  it('opens Settings as a child and returns to the More hub', () => {
    renderMore()
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Number notation' })).toBeTruthy()
    expect(screen.queryByText('Copy export code')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: /Save Data/ })).toBeTruthy()
  })

  it('keeps Save Data separate from Settings', () => {
    renderMore()
    fireEvent.click(screen.getByRole('button', { name: /Save Data/ }))
    expect(screen.getByRole('heading', { name: 'Save Data' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy export code' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hard reset' })).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: 'Number notation' })).toBeNull()
  })

  it('reveals Career Statistics only after a completed Sortie', () => {
    const state = createInitialState(0)
    state.combat.lastSortie.outcome = 'defeat'
    state.combat.lastSortie.wave = 12
    state.combat.lastSortie.scrapEarned = 30
    renderMore(state)
    fireEvent.click(screen.getByRole('button', { name: /Career Statistics/ }))
    expect(screen.getByRole('heading', { name: 'Career Statistics' })).toBeTruthy()
    expect(screen.getByText(/Defeat at Wave 12/)).toBeTruthy()
  })

  it('adds unlocked secondary systems without exposing locked ones', () => {
    const open = vi.fn()
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.codex)
    renderMore(state, open)
    fireEvent.click(screen.getByRole('button', { name: /Codex/ }))
    expect(open).toHaveBeenCalledWith('codex')
    expect(screen.queryByText('Challenges')).toBeNull()
    expect(screen.queryByText('Reinforce')).toBeNull()
  })
})
