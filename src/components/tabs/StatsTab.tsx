import { useEffect, useState } from 'react'
import type { GameState, TabId } from '../../game/types'
import type { DevAction } from '../../game/dev'
import { exportSave } from '../../game/save'
import { DevTools } from '../DevTools'
import type { NumberNotation } from '../../game/format'
import { APP_BUILD } from '../../buildMeta'
import { forceReloadApp } from '../../pwaReload'
import { isSystemUnlocked, systemUnlockRequirement } from '../../game/progression'
import { attentionAria, moreStationAttention } from '../../game/hubAttention'
import { moreStationBuckets, type MoreStationDef } from '../../game/moreStations'
import { AttentionPips } from '../AttentionPips'
import { SheetTabs } from '../SheetTabs'
import { useSyncedPane } from '../../hooks/useSyncedPane'

type MorePane = 'stations' | 'settings'

const MORE_PANES: { id: MorePane; label: string }[] = [
  { id: 'stations', label: 'Stations' },
  { id: 'settings', label: 'Settings' },
]

interface StatsTabProps {
  state: GameState
  onHardReset: () => void
  onImport: (code: string) => boolean
  onDevAction: (action: DevAction) => void
  onRebuild?: () => void
  onNotation?: (mode: NumberNotation) => void
  onOpenStation?: (tab: TabId) => void
  onOpenSimulator?: () => void
  guideTarget?: string | null
}

function StationRow({
  station,
  state,
  onOpen,
}: {
  station: MoreStationDef
  state: GameState
  onOpen: (tab: TabId) => void
}) {
  const unlocked = isSystemUnlocked(state, station.id)
  const need = systemUnlockRequirement(station.id)
  const flags = moreStationAttention(state, station.id)
  return (
    <article
      className={unlocked ? (flags.spend ? 'network-row is-affordable' : 'network-row is-ready') : 'network-row locked'}
      data-focus={`station-${station.id}`}
    >
      <div className="network-row-main">
        <strong>
          {station.name}
          <AttentionPips spend={flags.spend} fresh={flags.fresh} layout="inline" />
        </strong>
        <span className="muted">{unlocked ? 'Open' : need ?? 'Locked'}</span>
      </div>
      <p className="network-row-stats">{station.blurb}</p>
      <button
        type="button"
        className="primary"
        data-guide={`station-${station.id}`}
        disabled={!unlocked}
        aria-label={attentionAria(unlocked ? `Open ${station.name}` : need ?? 'Locked', flags)}
        onClick={() => unlocked && onOpen(station.id)}
      >
        {unlocked ? 'Open' : need ?? 'Locked'}
      </button>
    </article>
  )
}

export function StatsTab({
  state,
  onHardReset,
  onImport,
  onDevAction,
  onRebuild,
  onNotation,
  onOpenStation,
  onOpenSimulator,
  guideTarget = null,
}: StatsTabProps) {
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const buckets = moreStationBuckets(state)
  const hint =
    guideTarget === 'rebuild-btn' || guideTarget === 'station-logs' ? 'settings' : guideTarget?.startsWith('station-') ? 'stations' : null
  const [pane, setPane] = useSyncedPane<MorePane>('stations', hint)

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
        <p>Hangar stations. Save and settings on their own pane.</p>
      </header>
      <SheetTabs value={pane} onChange={setPane} options={MORE_PANES} label="More panes" />
      <div className="panel-scroll">
      {pane === 'stations' && onOpenStation ? (
        <div>
          {buckets.open.length > 0 ? (
            <>
              <h3 className="foundry-heading">Open</h3>
              {buckets.open.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  state={state}
                  onOpen={onOpenStation}
                />
              ))}
            </>
          ) : null}
          {buckets.next.length > 0 ? (
            <>
              <h3 className="foundry-heading">Coming up</h3>
              {buckets.next.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  state={state}
                  onOpen={onOpenStation}
                />
              ))}
            </>
          ) : null}
          {buckets.later.length > 0 ? (
            <details className="more-fold">
              <summary>Later systems ({buckets.later.length})</summary>
              {buckets.later.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  state={state}
                  onOpen={onOpenStation}
                />
              ))}
            </details>
          ) : null}
        </div>
      ) : null}

      {pane === 'settings' ? (
        <div className="stack">
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
            <button type="button" className="primary" data-guide="rebuild-btn" onClick={onRebuild}>
              Rebuild hangar
            </button>
          </p>
        ) : null}

        {onOpenStation ? (
          <p className="assign-row">
            <button type="button" data-guide="station-logs" onClick={() => onOpenStation('logs')}>
              Foundry Logs
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
            <span className="muted">Rebuilds</span>
            <strong>{state.prestige.prestigeCount}</strong>
          </div>
        </div>

        <p className="muted">
          If More looks outdated, tap <strong>Reload latest build</strong> — installed PWAs can keep
          an old cache.
        </p>
        <p className="assign-row">
          <button type="button" className="primary" onClick={() => void forceReloadApp()}>
            Reload latest build
          </button>
        </p>

        <DevTools state={state} onDevAction={onDevAction} onOpenSimulator={onOpenSimulator} />

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
        </div>
      ) : null}

      {message ? <p className="notice">{message}</p> : null}
      </div>
    </section>
  )
}
