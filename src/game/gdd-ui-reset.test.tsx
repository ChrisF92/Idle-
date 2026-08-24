import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CombatTab } from '../components/tabs/CombatTab'
import { DockTab } from '../components/tabs/DockTab'
import { InventoryScreen } from '../components/InventoryScreen'
import { TabNav } from '../components/TabNav'
import { WalletButton } from '../components/WalletButton'
import { OverlayProvider, useOverlay, useOverlayLayer } from '../ui/overlay'
import { createInitialState } from './state'
import { grantModuleCopy } from './coreProgression'
import { ACT1_CADENCE } from './cadence'
import { atCareerWave, markHullLost } from './testHelpers'
import { useState } from 'react'

afterEach(cleanup)

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
})

function OverlayProbe({
  updateOpen,
  onboardOpen,
}: {
  updateOpen: boolean
  onboardOpen: boolean
}) {
  const [onboard, setOnboard] = useState(onboardOpen)
  const overlays = useOverlay()
  useOverlayLayer({
    id: 'probe-update',
    kind: 'update',
    open: updateOpen,
    onClose: () => undefined,
  })
  const onboardAllowed = useOverlayLayer({
    id: 'probe-onboard',
    kind: 'onboarding',
    open: onboard,
    onClose: () => setOnboard(false),
  })
  return (
    <div>
      <span>top:{overlays.topBlockingKind ?? 'none'}</span>
      <span>onboard:{onboardAllowed.allowed ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('UI architecture reset', () => {
  it('stretches Dock across one full-width grid column', () => {
    const polish = readFileSync(resolve(process.cwd(), 'src/polish.css'), 'utf8')
    const app = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')
    expect(polish).toMatch(/\.dock-screen\.is-tabbed\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    expect(app).toMatch(/\.dock-screen\s*\{[^}]*justify-content:\s*stretch/s)
    expect(app).not.toMatch(/\.dock-screen\s*\{[^}]*justify-content:\s*flex-start/s)
  })

  it('keeps Dock Loadout as rows and opens Core detail in a sheet', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          pane="loadout"
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onOpenInventory={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )
    expect(document.querySelector('.core-sheet')).toBeNull()
    expect(screen.queryByText(/Equip Cores and Relics here/i)).toBeNull()
    expect(screen.getByText('Pulse Cannon')).toBeTruthy()
    fireEvent.click(document.querySelector('.ui-item-row[data-guide="core-pulse-cannon"]')!)
    expect(screen.getByRole('dialog', { name: /Pulse Cannon/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change Core' })).toBeTruthy()
  })

  it('keeps Dock as a home hub with Launch and own screens', () => {
    const state = markHullLost(createInitialState(0))
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onOpenInventory={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )
    expect(screen.getByText('Best Wave')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Loadout/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Workshop/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Rebuild/ })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Loadout' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inventory' })).toBeNull()
    expect(document.querySelector('.hive-rig')).toBeNull()
    expect(document.querySelector('.dock-hive-preview')).toBeTruthy()
    expect(document.querySelector('.dock-hive-canvas')).toBeTruthy()
    expect(document.querySelector('.ui-sticky-action')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Launch Sortie' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Loadout/ }))
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeTruthy()
    expect(screen.queryByText('Sockets')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dock' }))
    fireEvent.click(screen.getByRole('button', { name: /Workshop/ }))
    const workshopTabs = document.querySelector('.dock-screen-head .sheet-tabs')
    const dockPane = document.querySelector('.dock-pane')
    expect(workshopTabs).toBeTruthy()
    expect(dockPane?.contains(workshopTabs)).toBe(false)
    expect(dockPane?.querySelector('.upgrade-grid')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dock' }))
    fireEvent.click(screen.getByRole('button', { name: /Rebuild/ }))
    expect(screen.getByText('Projected Matter')).toBeTruthy()
    expect(screen.getByText('Cycle')).toBeTruthy()
    expect(screen.queryByText(/Permanent · Damage/)).toBeNull()
  })

  it('does not render a docked Ready Sortie now that Dock launches', () => {
    const state = createInitialState(0)
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(document.querySelector('.sortie-screen')).toBeNull()
    expect(screen.queryByText('Ready')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Launch Sortie' })).toBeNull()
  })

  it('shows live Sortie HUD and a collapsed shop with a Cores tab', () => {
    const state = markHullLost(createInitialState(0))
    state.combat.docked = false
    render(
      <CombatTab
        state={state}
        onLaunch={() => undefined}
        onPickMilestone={() => undefined}
      />,
    )
    expect(screen.getByText('Salvage')).toBeTruthy()
    expect(screen.getByText('Scrap')).toBeTruthy()
    expect(screen.queryByText(/BEST/)).toBeNull()
    const canvas = document.querySelector('[data-guide="sortie-canvas"]')
    expect(canvas?.querySelector('.sortie-hud')).toBeTruthy()
    expect(canvas?.querySelector('[data-guide="sortie-hull"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Extract' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sortie menu' }))
    expect(document.querySelector('.sortie-menu-pop')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Extract' })).toBeTruthy()
    expect(document.querySelector('.sheet-overlay')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Attack' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show upgrades' }))
    expect(screen.getByRole('tab', { name: 'Attack' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Cores' })).toBeNull()
    expect(screen.queryByRole('button', { name: /CORES ·/ })).toBeNull()
    const shopTabs = document.querySelector('.sortie-shop-head .sheet-tabs')
    const shopBody = document.querySelector('.sortie-shop-body')
    expect(shopTabs).toBeTruthy()
    expect(shopBody).toBeTruthy()
    expect(shopBody?.contains(shopTabs)).toBe(false)
    expect(shopBody?.querySelector('.upgrade-grid')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-guide="salvage-stat"]')!)
    expect(screen.getByText('Salvage /s')).toBeTruthy()
  })

  it('lists Inventory categories and physical Core copies', () => {
    const state = createInitialState(0)
    grantModuleCopy(state, 'pulse-cannon')
    render(
      <OverlayProvider>
        <InventoryScreen state={state} open onClose={() => undefined} />
      </OverlayProvider>,
    )
    expect(screen.getByRole('tab', { name: 'Equipment' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Relics' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Materials' })).toBeTruthy()
    expect(screen.getByText(/Attack Core · Copy 1 · Equipped/)).toBeTruthy()
    expect(screen.getByText(/Attack Core · Copy 2 · Available/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Relics' }))
    expect(screen.getByText(/No Relics yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Materials' }))
    expect(screen.getByText('Industrial')).toBeTruthy()
  })

  it('blocks onboarding while an update overlay is active', () => {
    render(
      <OverlayProvider>
        <OverlayProbe updateOpen onboardOpen />
      </OverlayProvider>,
    )
    expect(screen.getByText('top:update')).toBeTruthy()
    expect(screen.getByText('onboard:no')).toBeTruthy()
  })

  it('opens a Wallet modal of currencies from the header icon', () => {
    const state = createInitialState(0)
    state.resources.scrap = 47
    render(
      <OverlayProvider>
        <WalletButton state={state} />
      </OverlayProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Wallet' }))
    expect(screen.getByRole('dialog', { name: 'Wallet' })).toBeTruthy()
    expect(screen.getByText('Scrap')).toBeTruthy()
  })

  it('keeps bottom nav to Dock, Systems, and More', () => {
    const state = atCareerWave(markHullLost(createInitialState(0)), ACT1_CADENCE.workers)
    render(<TabNav active="dock" onChange={() => undefined} state={state} />)
    expect(screen.getByRole('button', { name: /Dock/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Systems/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /More/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sortie/ })).toBeNull()
  })

  it('lists every Core mastery milestone and highlights unlocked ranks', () => {
    const state = markHullLost(createInitialState(0))
    state.meta.moduleMastery = { 'pulse-cannon': 10 }
    render(
      <OverlayProvider>
        <DockTab
          state={state}
          pane="loadout"
          onLaunch={() => undefined}
          onOpenSortie={() => undefined}
          onOpenInventory={() => undefined}
          onRebuild={() => undefined}
        />
      </OverlayProvider>,
    )
    fireEvent.click(document.querySelector('.ui-item-row[data-guide="core-pulse-cannon"]')!)
    expect(screen.getByText(/M5 · Hardened Pulse/)).toBeTruthy()
    expect(screen.getByText(/M10 · Tight Cycle/)).toBeTruthy()
    expect(screen.getByText(/M20 · Optical Socket/)).toBeTruthy()
    expect(screen.getByText(/M30 · Core Feed/)).toBeTruthy()
    expect(screen.getByText(/M50 · Foundry Arc/)).toBeTruthy()
    expect(screen.getByText(/M75 · Deep Pattern/)).toBeTruthy()
    expect(screen.getByText(/M100 · True Mastery/)).toBeTruthy()
    const unlocked = [...document.querySelectorAll('.mastery-ms.is-unlocked')].map((el) => el.textContent)
    expect(unlocked.some((text) => text?.includes('Hardened Pulse'))).toBe(true)
    expect(unlocked.some((text) => text?.includes('Tight Cycle'))).toBe(true)
    expect(unlocked.some((text) => text?.includes('Optical Socket'))).toBe(false)
    expect(document.querySelector('.mastery-ms.is-next')?.textContent).toMatch(/Optical Socket/)
    expect(screen.getByText(/Damage ×1\.08/)).toBeTruthy()
    expect(screen.getByText(/RoF ×1\.08/)).toBeTruthy()
    expect(screen.getByText(/\+1 Optical Relic socket/)).toBeTruthy()
    expect(screen.getByText(/Core Level scaling ×1\.10/)).toBeTruthy()
    expect(screen.getByText(/Damage ×1\.12 · Range \+10/)).toBeTruthy()
    expect(screen.getByText(/Damage ×1\.06 · Shield ×1\.06/)).toBeTruthy()
    expect(screen.queryByText(/Unlocks an extra Relic socket/)).toBeNull()
    expect(screen.queryByText(/The Core is fully understood/)).toBeNull()
  })
})
