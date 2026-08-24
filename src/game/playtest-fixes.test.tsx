import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OverlayProvider } from '../ui/overlay'
import { DockTab } from '../components/tabs/DockTab'
import { FoundryTab } from '../components/tabs/FoundryTab'
import { SystemsTab } from '../components/tabs/SystemsTab'
import { applyDevAction } from './dev'
import { selectFrame } from './actions'
import { createInitialState } from './state'
import { atCareerWave, markHullLost } from './testHelpers'
import { setDocked } from './tick'
import { ACT1_CADENCE } from './cadence'
import { careerBestWave } from './waves'
import { isSystemUnlocked } from './progression'
import { buildPlaytestReport } from './playtest'
import { RUN_UPGRADE_CAP } from './workshop'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

describe('playtest fix pass', () => {
  it('keeps W20 Foundry from unlocking later GDD doors', () => {
    let s = applyDevAction(createInitialState(0), { type: 'prep-gdd-door', wave: ACT1_CADENCE.foundry })
    s = applyDevAction(s, { type: 'fill-workers', count: 8 })
    expect(careerBestWave(s)).toBe(ACT1_CADENCE.foundry)
    expect(isSystemUnlocked(s, 'foundry')).toBe(true)
    expect(isSystemUnlocked(s, 'furnace')).toBe(false)
    expect(isSystemUnlocked(s, 'echo')).toBe(false)
    expect(isSystemUnlocked(s, 'capital')).toBe(false)
    expect(isSystemUnlocked(s, 'specialists')).toBe(false)
  })

  it('lets Dock change Frame after Extract', () => {
    let s = createInitialState(0)
    s.shipyard.unlockedFrames = ['starter-frame', 'bastion-frame']
    s = setDocked(s, false)
    expect(s.shipyard.frameLocked).toBe(true)
    expect(selectFrame(s, 'bastion-frame').shipyard.frameId).toBe('starter-frame')
    s = setDocked(s, true)
    expect(s.shipyard.frameLocked).toBe(false)
    s = selectFrame(s, 'bastion-frame')
    expect(s.shipyard.frameId).toBe('bastion-frame')

    s.shipyard.frameLocked = true
    s.combat.docked = true
    s = selectFrame(s, 'starter-frame')
    expect(s.shipyard.frameId).toBe('starter-frame')
    expect(s.shipyard.frameLocked).toBe(false)
  })

  it('shows every Frame slot in Attack, Defense, Utility order', () => {
    const state = createInitialState(0)
    state.shipyard.frameId = 'bastion-frame'

    render(
      <OverlayProvider>
        <DockTab
          state={state}
          pane="loadout"
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )

    const rows = Array.from(document.querySelectorAll('.dock-loadout .ui-item-row')).slice(1)
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      'Pulse Cannon',
      'Plate Layer',
      'Empty Defense Slot',
      'Empty Defense Slot',
      'Empty Utility Slot',
    ])
    expect(rows[0]?.querySelector('.ui-meta')?.textContent).toMatch(/^Attack · M/)

    fireEvent.click(screen.getByRole('button', { name: /empty utility slot/i }))
    expect(screen.getByText('Fit Core')).toBeTruthy()
  })

  it('renders uniform upgrade tiles with cost, affordability, and level/cap in info', () => {
    const state = markHullLost(atCareerWave(createInitialState(0), 50))
    state.resources.scrap = 519
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          pane="workshop"
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onRebuild={() => undefined}
          onBuyWorkshop={() => undefined}
        />
      </OverlayProvider>,
    )
    const tiles = document.querySelectorAll('.upgrade-tile')
    expect(tiles.length).toBeGreaterThan(1)
    expect(document.querySelector('.upgrade-tile-cost')).toBeTruthy()
    expect(document.querySelector('.upgrade-tile.is-affordable, .upgrade-tile.is-short')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /details/i })[0]!)
    expect(screen.getByText(new RegExp(`Level \\d+ / ${RUN_UPGRADE_CAP}`))).toBeTruthy()
  })

  it('does not dump Worker job lines onto the Foundry card', () => {
    const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    state.base.workerDrones = 17
    state.base.assignments = {
      'scrap-field': 0,
      'sensor-net': 0,
      'alloy-foundry': 0,
      'drone-fab': 0,
      'fab-bay': 5,
      construction: 0,
    }
    render(<SystemsTab state={state} onManage={() => undefined} />)
    expect(document.querySelector('.systems-workers-jobs')).toBeNull()
    expect(screen.queryByText(/Salvage ops/)).toBeNull()
    expect(screen.getByText('Foundry')).toBeTruthy()
    expect(screen.getByText(/assigned/)).toBeTruthy()
  })

  it('lists Fabrication drop Waves and families instead of enemy-family mismatch copy', () => {
    const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.foundry)
    render(
      <FoundryTab
        state={state}
        requestedPane="prints"
        onSetSlot={() => undefined}
        onAssemble={() => undefined}
      />,
    )
    expect(screen.queryByText(/fragments do not drop from this enemy family/i)).toBeNull()
    expect(screen.getByText(/Flak Array/)).toBeTruthy()
    expect(screen.getAllByText(/Swarm · Wave \d+\+/).length).toBeGreaterThan(0)
  })

  it('writes Frame, Workshop, and Systems on the playtest report', () => {
    const state = atCareerWave(createInitialState(0), ACT1_CADENCE.foundry)
    const report = buildPlaytestReport(state)
    expect(report).toMatch(/Frame: Starter Frame/)
    expect(report).toMatch(/Workshop starts:/)
    expect(report).toMatch(/Systems: Foundry/)
    expect(report).not.toMatch(/\bEcho\b/)
    expect(report).not.toMatch(/\bSpecialists\b/)
    expect(report).not.toMatch(/\bCapital\b/)
  })
})
