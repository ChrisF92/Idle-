import { useState } from 'react'
import type { GameState } from '../game/types'
import type { DevAction } from '../game/dev'
import { GDD_DOOR_PRESETS, isDevToolsEnabled, setDevToolsEnabled } from '../game/dev'
import { ONBOARDING_LESSON_IDS } from '../game/onboarding'
import { SHIP_FRAMES } from '../game/catalog'
import { PlaytestReport } from './PlaytestReport'

interface DevToolsProps {
  state?: GameState
  onDevAction: (action: DevAction) => void
  onOpenSimulator?: () => void
}

const HIVE_RESOURCES: DevAction = {
  type: 'add-resources',
  amounts: {
    scrap: 500,
    salvage: 400,
    prestigeMatter: 5,
    choirAsh: 80,
    heat: 40,
    alloys: 200,
    energy: 200,
    data: 100,
    aiPoints: 20,
  },
}

function prepDoor(onDevAction: (action: DevAction) => void, wave: number): void {
  onDevAction({ type: 'skip-guides' })
  onDevAction({ type: 'prep-gdd-door', wave })
  onDevAction(HIVE_RESOURCES)
  if (wave >= 30) onDevAction({ type: 'fill-workers', count: 8 })
  onDevAction({ type: 'dock-heal' })
}

export function DevTools({ state, onDevAction, onOpenSimulator }: DevToolsProps) {
  const [enabled, setEnabled] = useState(() => isDevToolsEnabled())
  const [bestWave, setBestWave] = useState('70')
  const [open, setOpen] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)

  if (!enabled) {
    if (!import.meta.env.DEV) return null
    return (
      <div className="dev-tools">
        <p className="muted">
          Dev tools are off. Enable them for Wave / door cheats while testing (also via{' '}
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
            Hiveworks cheats — GDD Wave cadence. Saved in this browser. Append <code>?dev=0</code> to
            turn off.
          </p>
          {onOpenSimulator ? (
            <p className="assign-row">
              <button type="button" className="primary" onClick={onOpenSimulator}>
                Balance Simulator
              </button>
              {state ? (
                <button type="button" className="primary" onClick={() => setReportOpen(true)}>
                  Playtest report
                </button>
              ) : null}
            </p>
          ) : state ? (
            <p className="assign-row">
              <button type="button" className="primary" onClick={() => setReportOpen(true)}>
                Playtest report
              </button>
            </p>
          ) : null}
          <div className="dev-tools-row">
            <label>
              Best Wave{' '}
              <input
                type="number"
                min={0}
                value={bestWave}
                onChange={(e) => setBestWave(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onDevAction({ type: 'set-best-wave', wave: Number(bestWave) || 0 })
              }
            >
              Set Best
            </button>
          </div>
          <div className="dev-tools-row">
            {GDD_DOOR_PRESETS.map((door) => (
              <button
                key={door.wave}
                type="button"
                className="primary"
                onClick={() => {
                  setBestWave(String(door.wave))
                  prepDoor(onDevAction, door.wave)
                }}
              >
                {door.label}
              </button>
            ))}
          </div>
          <div className="dev-tools-row">
            <button type="button" onClick={() => onDevAction({ type: 'set-best-wave', wave: 1 })}>
              Best W1
            </button>
            <button
              type="button"
              onClick={() =>
                onDevAction({
                  type: 'set-core-mastery',
                  ranks: { 'pulse-cannon': 10, 'plate-layer': 10 },
                })
              }
            >
              Mastery 10 / 10
            </button>
          </div>
          <div className="dev-tools-row">
            <button type="button" onClick={() => onDevAction(HIVE_RESOURCES)}>
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
            <button type="button" onClick={() => onDevAction({ type: 'dock-heal' })}>
              Dock + heal
            </button>
          </div>
          <div className="dev-tools-row">
            {SHIP_FRAMES.map((frame) => (
              <button
                key={frame.id}
                type="button"
                onClick={() => onDevAction({ type: 'select-frame', frameId: frame.id })}
              >
                {frame.name}
              </button>
            ))}
          </div>
          <div className="dev-tools-row">
            <button
              type="button"
              onClick={() => onDevAction({ type: 'set-prestige-count', count: 2 })}
            >
              Rebuilds = 2
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'skip-guides' })}>
              Skip guides
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'clear-guides' })}>
              Reset guides
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'reset-onboarding' })}>
              Replay first-run
            </button>
          </div>
          <div className="dev-tools-row">
            {ONBOARDING_LESSON_IDS.map((id) => (
              <button key={id} type="button" onClick={() => onDevAction({ type: 'prep-onboarding-door', lessonId: id })}>
                Door {id}
              </button>
            ))}
            <button type="button" onClick={() => onDevAction({ type: 'seed-late-game' })}>
              Seed W1000
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'inject-process-profile', profileId: 'farm' })}>
              Inject Farm
            </button>
            <button type="button" onClick={() => onDevAction({ type: 'inject-process-profile', profileId: 'push' })}>
              Inject Push
            </button>
          </div>
        </div>
      ) : null}
      {reportOpen && state ? <PlaytestReport state={state} onClose={() => setReportOpen(false)} /> : null}
    </div>
  )
}
