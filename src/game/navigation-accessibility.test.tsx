import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SheetTabs } from '../components/SheetTabs'
import { StatsTab } from '../components/tabs/StatsTab'
import { useChildScreenBack } from '../hooks/useChildScreenBack'
import { OverlayProvider } from '../ui/overlay'
import { BottomSheet } from '../ui/primitives'
import { createInitialState } from './state'

afterEach(() => {
  cleanup()
  history.replaceState({}, '')
})

function TabsProbe() {
  const [pane, setPane] = useState<'first' | 'second' | 'third'>('first')
  return (
    <SheetTabs
      value={pane}
      onChange={setPane}
      label="Probe panes"
      options={[
        { id: 'first', label: 'First' },
        { id: 'second', label: 'Second' },
        { id: 'third', label: 'Third' },
      ]}
    />
  )
}

function SheetProbe() {
  const [open, setOpen] = useState(false)
  return (
    <OverlayProvider>
      <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
      <BottomSheet open={open} title="Keyboard sheet" onClose={() => setOpen(false)}>
        <button type="button">Last action</button>
      </BottomSheet>
    </OverlayProvider>
  )
}

function ChildProbe() {
  const [child, setChild] = useState(false)
  useChildScreenBack(child ? 'probe:child' : null, () => setChild(false))
  return child ? <h2>Child screen</h2> : <button onClick={() => setChild(true)}>Open child</button>
}

describe('Navigation accessibility', () => {
  it('supports arrow, Home, and End navigation across pane tabs', () => {
    render(<TabsProbe />)
    const first = screen.getByRole('tab', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Second' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Second' }))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Third' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'First' }).getAttribute('aria-selected')).toBe('true')
  })

  it('moves focus into a sheet, traps it, and restores the opener', async () => {
    render(<SheetProbe />)
    const opener = screen.getByRole('button', { name: 'Open sheet' })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Keyboard sheet' })).toBeTruthy()
    const close = screen.getByRole('button', { name: 'Close' })
    await waitFor(() => expect(document.activeElement).toBe(close))
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last action' }))
    fireEvent.click(close)
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('uses browser Back to leave a child screen', async () => {
    render(<ChildProbe />)
    fireEvent.click(screen.getByRole('button', { name: 'Open child' }))
    expect(screen.getByRole('heading', { name: 'Child screen' })).toBeTruthy()
    fireEvent.popState(window, { state: {} })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open child' })).toBeTruthy())
  })

  it('returns a More utility child to its section hub on browser Back', async () => {
    render(
      <StatsTab
        state={createInitialState(0)}
        onHardReset={() => undefined}
        onImport={() => false}
        onDevAction={() => undefined}
      />,
    )
    fireEvent.click(screen.getByText('Help & Guides'))
    expect(screen.getByRole('heading', { name: 'Help & Guides' })).toBeTruthy()
    fireEvent.popState(window, { state: {} })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'More' })).toBeTruthy())
  })

  it('keeps compact mobile targets and safe-area layout in the CSS contract', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/ui/tokens.css'), 'utf8')
    const polish = readFileSync(resolve(process.cwd(), 'src/polish.css'), 'utf8')
    const app = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')
    expect(tokens).toMatch(/--touch:\s*44px/)
    expect(polish).toMatch(/@media \(max-width:\s*360px\)/)
    expect(app).toMatch(/safe-area-inset-bottom/)
  })
})
