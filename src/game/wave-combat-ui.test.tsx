import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TabNav } from '../components/TabNav'
import { createInitialState } from './state'
import { startCombat } from './tick'
import { isSortieActive } from './presentation'
import { atCareerWave, markHullLost } from './testHelpers'
import { ACT1_CADENCE } from './cadence'

describe('live Sortie chrome', () => {
  it('renders DOCK | SYSTEMS | MORE while docked, and live Sortie hides that nav contract', () => {
    const docked = atCareerWave(markHullLost(createInitialState(1)), ACT1_CADENCE.workers)
    render(<TabNav active="dock" onChange={() => undefined} state={docked} />)
    expect(screen.getByLabelText('Game systems')).toBeTruthy()
    expect(screen.getByText('Dock')).toBeTruthy()
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()

    const live = startCombat(docked)
    expect(isSortieActive(live)).toBe(true)
    expect(isSortieActive(docked)).toBe(false)
  })
})

describe('live Sortie chrome', () => {
  it('renders DOCK | SYSTEMS | MORE only while docked', () => {
    const docked = createInitialState(1)
    const { unmount } = render(
      <TabNav active="dock" onChange={() => undefined} state={docked} />,
    )
    expect(screen.getByLabelText('Game systems')).toBeTruthy()
    expect(screen.getByText('Dock')).toBeTruthy()
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()
    unmount()

    const live = startCombat(docked)
    expect(isSortieActive(live)).toBe(true)
  })
})
