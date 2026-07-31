import { useState } from 'react'
import type { DevAction } from '../game/dev'
import { isDevToolsEnabled, setDevToolsEnabled } from '../game/dev'

interface DevToolsProps {
  onDevAction: (action: DevAction) => void
}

export function DevTools({ onDevAction }: DevToolsProps) {
  const [enabled, setEnabled] = useState(() => isDevToolsEnabled())
  const [sector, setSector] = useState('8')
  const [open, setOpen] = useState(true)

  if (!enabled) {
    return (
      <div className="dev-tools">
        <p className="muted">
          Dev tools are off. Enable them for jump/sector cheats while testing (also via{' '}
          <code>?dev=1</code>).
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setDevToolsEnabled(true)
            setEnabled(true)
          }}
        >
          Enable Dev Tools
        </button>
      </div>
    )
  }

  return (
    <div className="dev-tools">
      <div className="dev-tools-row">
        <button type="button" className="dev-tools-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide Dev Tools' : 'Show Dev Tools'}
        </button>
        <button
          type="button"
          onClick={() => {
            setDevToolsEnabled(false)
            setEnabled(false)
          }}
        >
          Disable
        </button>
      </div>
      {open ? (
        <div className="dev-tools-body">
          <p className="muted">
            Testing cheats — saved in this browser. Append <code>?dev=0</code> to turn off via URL.
          </p>
          <div className="dev-tools-row">
            <label>
              Sector{' '}
              <input
                type="number"
                min={1}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onDevAction({ type: 'jump-sector', sector: Number(sector) || 1 })
              }
            >
              Jump
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'set-wave', wave: 5 })}>
              Wave 5
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'force-boss-wave' })}>
              Force boss
            </button>
          </div>
          <div className="dev-tools-row">
            <button
              type="button"
              onClick={() =>
                onDevAction({
                  type: 'add-resources',
                  amounts: {
                    scrap: 500,
                    alloys: 200,
                    energy: 200,
                    data: 100,
                    essence: 10,
                    aiPoints: 10,
                    prestigeMatter: 5,
                    challengePoints: 5,
                    salvage: 100,
                  },
                })
              }
            >
              +Resources
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'unlock-catalog' })}>
              Unlock catalog
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'grant-achievements' })}>
              All achievements
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'fill-workers', count: 8 })}>
              +Workers
            </button>
            <button
              type="button"
              onClick={() => onDevAction({ type: 'fill-combat-drones', count: 6 })}
            >
              +Combat drones
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'dock-heal' })}>
              Pause + heal
            </button>
          </div>
          <div className="dev-tools-row">
            <button
              type="button"
              onClick={() => onDevAction({ type: 'set-prestige-count', count: 1 })}
            >
              Prestige count = 1
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'skip-guides' })}>
              Skip guides
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'clear-guides' })}>
              Reset guides
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDevAction({ type: 'skip-guides' })
                onDevAction({ type: 'jump-sector', sector: 8 })
                onDevAction({
                  type: 'add-resources',
                  amounts: { scrap: 200, salvage: 50, data: 40, aiPoints: 5 },
                })
              }}
            >
              Test prestige @ 8
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
