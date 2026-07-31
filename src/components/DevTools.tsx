import { useState } from 'react'
import type { DevAction } from '../game/dev'
import { isDevToolsEnabled } from '../game/dev'

interface DevToolsProps {
  onDevAction: (action: DevAction) => void
}

export function DevTools({ onDevAction }: DevToolsProps) {
  const [sector, setSector] = useState('8')
  const [open, setOpen] = useState(true)

  if (!isDevToolsEnabled()) return null

  return (
    <div className="dev-tools">
      <button type="button" className="dev-tools-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide Dev Tools' : 'Show Dev Tools'}
      </button>
      {open ? (
        <div className="dev-tools-body">
          <p className="muted">
            Local / <code>?dev=1</code> only. Use these to jump progression for testing.
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
            <button type="button" onClick={() => onDevAction({ type: 'fill-workers', count: 8 })}>
              +Workers
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'dock-heal' })}>
              Dock + heal
            </button>
          </div>
          <div className="dev-tools-row">
            <button
              type="button"
              onClick={() => onDevAction({ type: 'set-prestige-count', count: 1 })}
            >
              Prestige count = 1
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'clear-guides' })}>
              Reset guides
            </button>
            <button
              type="button"
              onClick={() => {
                onDevAction({ type: 'jump-sector', sector: 8 })
                onDevAction({ type: 'clear-guides' })
                onDevAction({
                  type: 'add-resources',
                  amounts: { scrap: 200, salvage: 50, data: 40 },
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
