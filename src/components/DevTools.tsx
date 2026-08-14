import { useState } from 'react'
import type { DevAction } from '../game/dev'
import { isDevToolsEnabled, setDevToolsEnabled } from '../game/dev'

interface DevToolsProps {
  onDevAction: (action: DevAction) => void
}

const HIVE_RESOURCES: DevAction = {
  type: 'add-resources',
  amounts: {
    scrap: 500,
    alloys: 200,
    energy: 200,
    data: 100,
    essence: 10,
    aiPoints: 20,
    prestigeMatter: 5,
    challengePoints: 5,
    salvage: 400,
    choirAsh: 80,
    heat: 40,
  },
}

const YARD_GOODS: DevAction = {
  type: 'add-yard-goods',
  amounts: { ore: 80, flux: 40, ingot: 20 },
}

function prepDoor(onDevAction: (action: DevAction) => void, sector: number): void {
  onDevAction({ type: 'skip-guides' })
  onDevAction({ type: 'unlock-catalog' })
  onDevAction({ type: 'set-prestige-count', count: 1 })
  onDevAction({ type: 'jump-sector', sector })
  onDevAction(HIVE_RESOURCES)
  onDevAction(YARD_GOODS)
  onDevAction({ type: 'fill-workers', count: 8 })
  onDevAction({ type: 'dock-heal' })
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
            Hiveworks cheats — saved in this browser. Append <code>?dev=0</code> to turn off via URL.
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
            {[8, 18, 22, 51].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setSector(String(n))
                  onDevAction({ type: 'jump-sector', sector: n })
                }}
              >
                S{n}
              </button>
            ))}
          </div>
          <div className="dev-tools-row">
            <button type="button" onClick={() => onDevAction({ type: 'set-wave', wave: 1 })}>
              Wave 1
            </button>
            <button
              type="button"
              onClick={() => onDevAction({ type: 'force-boss-wave' })}
            >
              Force boss
            </button>
            <button
              type="button"
              onClick={() =>
                onDevAction({
                  type: 'set-module-levels',
                  levels: { 'pulse-cannon': 20, 'plate-layer': 0 },
                })
              }
            >
              Pulse 20 / Plate 0
            </button>
            <button
              type="button"
              onClick={() =>
                onDevAction({
                  type: 'set-module-levels',
                  levels: { 'pulse-cannon': 12, 'plate-layer': 12 },
                })
              }
            >
              Pulse 12 / Plate 12
            </button>
          </div>
          <div className="dev-tools-row">
            <button type="button" onClick={() => onDevAction(HIVE_RESOURCES)}>
              +Resources
            </button>
            <button type="button" onClick={() => onDevAction(YARD_GOODS)}>
              +Yard goods
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
          </div>
          <div className="dev-tools-row">
            <button type="button" className="primary" onClick={() => prepDoor(onDevAction, 18)}>
              Test Protocols @ 18
            </button>
            <button type="button" className="primary" onClick={() => prepDoor(onDevAction, 22)}>
              Test Echo @ 22
            </button>
            <button type="button" className="primary" onClick={() => prepDoor(onDevAction, 51)}>
              Test Specialists @ 51
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
