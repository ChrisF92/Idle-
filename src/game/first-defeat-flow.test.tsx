import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SortieReport } from '../components/SortieReport'
import { createInitialState } from './state'
import { markHullLost } from './testHelpers'

afterEach(cleanup)

describe('First defeat report', () => {
  it('closes the first combat loop with one primary route back to Dock', () => {
    const state = markHullLost(createInitialState(0))
    const dock = vi.fn()
    render(
      <SortieReport
        state={state}
        summary={{
          ...state.combat.lastSortie,
          outcome: 'defeat',
          wave: 8,
          previousBest: 0,
          newBest: true,
          scrapEarned: 24,
          stats: {
            ...state.combat.lastSortie.stats,
            kills: 13,
            damageDealt: 72,
            damageTaken: 40,
            finalFightTime: 18,
          },
        }}
        onClose={() => undefined}
        onDock={dock}
        onRunAgain={() => undefined}
      />,
    )

    expect(screen.getByText(/Wave 8 · New Best/)).toBeTruthy()
    expect(screen.getByText(/24 Scrap/)).toBeTruthy()
    expect(screen.getByText(/Salvage from that Sortie is gone/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run Again' })).toBeNull()

    const details = screen.getByText('Run details').closest('details')
    expect(details).toBeTruthy()
    fireEvent.click(within(details!).getByText('Run details'))
    expect(within(details!).getByText(/13 hostiles destroyed/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Return to Dock' }))
    expect(dock).toHaveBeenCalledOnce()
  })
})
