import { useEffect, useState } from 'react'
import type { GameState, TabId } from '../../game/types'
import type { DevAction } from '../../game/dev'
import { exportSave } from '../../game/save'
import { DevTools } from '../DevTools'
import type { NumberNotation } from '../../game/format'
import {
  careerHighestSector,
  isSystemUnlocked,
  systemUnlockRequirement,
} from '../../game/progression'

/** Bump when shipping UI that players must refresh to see (PWA cache). */
export const APP_BUILD = '2026-08-14f'

const STATIONS: { id: TabId; name: string; blurb: string }[] = [
  { id: 'reliquary', name: 'Reliquary', blurb: 'Shards in colour slots. Red / orange at 3; pink at 6.' },
  { id: 'furnace', name: 'Furnace', blurb: 'Choir-ash → Heat → always-on ranks.' },
  { id: 'research', name: 'Research', blurb: 'Material / Energy / Observation. Focus one.' },
  { id: 'yard', name: 'Yard Grid', blurb: 'Buildings → Ingots. Arms apply on the next Rebuild.' },
  { id: 'protocols', name: 'Protocols', blurb: 'Restricted sorties. Rank the muted system.' },
  { id: 'echo', name: 'Echo Runs', blurb: 'Short gauntlets → Echo tree. Sector 22.' },
  { id: 'process', name: 'Process', blurb: 'Achievements → automation nodes.' },
  { id: 'specialists', name: 'Specialists', blurb: 'Gunner / Warden / Scavenger. Persist on Rebuild. Sector 51.' },
  { id: 'tasks', name: 'Task List', blurb: 'Checklist gate into Capital. Sector 72.' },
  { id: 'capital', name: 'Capital', blurb: 'Second combat scale on the ship. Sector 75 + Task List.' },
  { id: 'reinforce', name: 'Reinforce', blurb: 'Second prestige. Keeps the foundry. Sector 80.' },
  { id: 'logs', name: 'Foundry Logs', blurb: 'Short industrial notes as doors open.' },
]

interface StatsTabProps {
  state: GameState
  onHardReset: () => void
  onImport: (code: string) => boolean
  onDevAction: (action: DevAction) => void
  onRebuild?: () => void
  onNotation?: (mode: NumberNotation) => void
  onOpenStation?: (tab: TabId) => void
}

async function forceReloadApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Still reload even if cleanup fails.
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', APP_BUILD)
  window.location.replace(url.toString())
}

export function StatsTab({
  state,
  onHardReset,
  onImport,
  onDevAction,
  onRebuild,
  onNotation,
  onOpenStation,
}: StatsTabProps) {
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Nudge waiting service workers when the player opens Stats.
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.getRegistration().then((reg) => {
      void reg?.update()
    })
  }, [])

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>More</h2>
        <p>Stations, save, rebuild, build {APP_BUILD}.</p>
      </header>
      <div className="panel-scroll">
      {onOpenStation ? (
        <div>
          <h3 className="foundry-heading">Stations</h3>
          {STATIONS.map((station) => {
            const unlocked = isSystemUnlocked(state, station.id)
            const need = systemUnlockRequirement(station.id)
            return (
              <article
                key={station.id}
                className={unlocked ? 'network-row' : 'network-row locked'}
              >
                <div className="network-row-main">
                  <strong>{station.name}</strong>
                  <span className="muted">
                    {unlocked ? 'Open' : need ?? `Sector ${careerHighestSector(state)}`}
                  </span>
                </div>
                <p className="network-row-stats">{station.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  data-guide={`station-${station.id}`}
                  disabled={!unlocked}
                  onClick={() => unlocked && onOpenStation(station.id)}
                >
                  {unlocked ? 'Open' : need ?? 'Locked'}
                </button>
              </article>
            )
          })}
        </div>
      ) : null}

      {onNotation ? (
        <div>
          <p className="muted">Numbers over 999</p>
          <div className="sheet-tabs notation-tabs">
            <button
              type="button"
              className={state.meta.numberNotation !== 'scientific' ? 'sheet-tab active' : 'sheet-tab'}
              onClick={() => onNotation('engineering')}
            >
              Engineering
            </button>
            <button
              type="button"
              className={state.meta.numberNotation === 'scientific' ? 'sheet-tab active' : 'sheet-tab'}
              onClick={() => onNotation('scientific')}
            >
              Scientific
            </button>
          </div>
          <p className="muted">
            {state.meta.numberNotation === 'scientific' ? '1.23e4' : '12.3e3'}
          </p>
        </div>
      ) : null}

      {onRebuild ? (
        <p className="assign-row">
          <button type="button" className="primary" onClick={onRebuild}>
            Rebuild hangar
          </button>
        </p>
      ) : null}

      <div className="stat-row">
        <div>
          <span className="muted">App build</span>
          <strong>{APP_BUILD}</strong>
        </div>
        <div>
          <span className="muted">Save version</span>
          <strong>{state.version}</strong>
        </div>
        <div>
          <span className="muted">Sector reached</span>
          <strong>{state.combat.sector}</strong>
        </div>
        <div>
          <span className="muted">Prestiges</span>
          <strong>{state.prestige.prestigeCount}</strong>
        </div>
      </div>

      <p className="muted">
        If Stats looks outdated (no Dev Tools box below), tap <strong>Reload latest build</strong> —
        installed PWAs can keep an old cache.
      </p>
      <p className="assign-row">
        <button type="button" className="primary" onClick={() => void forceReloadApp()}>
          Reload latest build
        </button>
      </p>

      <DevTools onDevAction={onDevAction} />

      <p className="muted">
        Progressive Web App: after deploy to GitHub Pages (HTTPS), Android Chrome can Install /
        Add to Home screen. Offline shell caches the last build; saves stay in this browser&apos;s
        local storage (export/import to move devices).
      </p>

      <div className="stack">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(exportSave(state))
            setMessage('Save copied to clipboard.')
          }}
        >
          Copy export code
        </button>

        <label className="stack">
          <span className="muted">Import save code</span>
          <textarea
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            rows={3}
            placeholder="Paste save code…"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const ok = onImport(importCode)
            setMessage(ok ? 'Save imported.' : 'Import failed — invalid code.')
          }}
        >
          Import
        </button>

        <button
          type="button"
          className="danger"
          onClick={() => {
            if (window.confirm('Delete local save and start over?')) {
              onHardReset()
              setMessage('Save cleared.')
            }
          }}
        >
          Hard reset
        </button>
      </div>

      {message ? <p className="notice">{message}</p> : null}
      </div>
    </section>
  )
}
