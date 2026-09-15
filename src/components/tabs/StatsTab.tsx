import { useEffect, useState } from 'react'
import type { GameState, TabId } from '../../game/types'
import type { DevAction } from '../../game/dev'
import { exportSave } from '../../game/save'
import type { NumberNotation } from '../../game/format'
import { APP_BUILD } from '../../buildMeta'
import { forceReloadApp } from '../../pwaReload'
import { careerBestWave } from '../../game/waves'
import { moreStationAttention } from '../../game/hubAttention'
import { moreStationBuckets, type MoreStationDef } from '../../game/moreStations'
import { AttentionPips } from '../AttentionPips'
import { ItemRow, Section, SectionHeader, StatPair } from '../../ui/primitives'
import { useChildScreenBack } from '../../hooks/useChildScreenBack'

type MorePane = 'home' | 'help' | 'settings' | 'save' | 'about' | 'career'

interface StatsTabProps {
  state: GameState
  onHardReset: () => void
  onImport: (code: string) => boolean
  onDevAction: (action: DevAction) => void
  onRebuild?: () => void
  onNotation?: (mode: NumberNotation) => void
  onDamageNumbers?: (mode: 'minimal' | 'standard' | 'detailed') => void
  onOpenStation?: (tab: TabId) => void
  onOpenSimulator?: () => void
  onOpenInventory?: () => void
  guideTarget?: string | null
}

const PANE_TITLES: Record<Exclude<MorePane, 'home'>, string> = {
  help: 'Help & Guides',
  settings: 'Settings',
  save: 'Save Data',
  about: 'About',
  career: 'Career Statistics',
}

function MoreHeader({ pane, onBack }: { pane: MorePane; onBack: () => void }) {
  if (pane === 'home') {
    return (
      <header className="panel-header more-header">
        <h2>More</h2>
        <p>Inventory, guidance, preferences, and unlocked secondary systems.</p>
      </header>
    )
  }
  return (
    <header className="panel-header more-header is-child">
      <button type="button" className="more-back-btn" onClick={onBack}>
        More
      </button>
      <h2>{PANE_TITLES[pane]}</h2>
    </header>
  )
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
  const flags = moreStationAttention(state, station.id)
  return (
    <ItemRow
      title={
        <>
          {station.name}
          <AttentionPips spend={flags.spend} fresh={flags.fresh} layout="inline" />
        </>
      }
      meta={station.blurb}
      guide={`station-${station.id}`}
      onClick={() => onOpen(station.id)}
    />
  )
}

export function StatsTab({
  state,
  onHardReset,
  onImport,
  onDevAction: _onDevAction,
  onRebuild: _onRebuild,
  onNotation,
  onDamageNumbers,
  onOpenStation,
  onOpenSimulator: _onOpenSimulator,
  onOpenInventory,
}: StatsTabProps) {
  const [pane, setPane] = useState<MorePane>('home')
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const stations = moreStationBuckets(state).open
  const careerAvailable = Boolean(state.combat.lastSortie.outcome)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.getRegistration().then((reg) => {
      void reg?.update()
    })
  }, [])

  function openPane(next: MorePane) {
    setMessage(null)
    setPane(next)
  }

  useChildScreenBack(pane === 'home' ? null : `more:${pane}`, () => openPane('home'))

  return (
    <section className="panel screen-panel more-screen" aria-label="More">
      <MoreHeader pane={pane} onBack={() => openPane('home')} />

      <div className="panel-scroll more-scroll">
        {pane === 'home' ? (
          <div className="more-list">
            {onOpenInventory ? (
              <ItemRow
                title="Inventory"
                meta="Frames, physical Cores, Relics, and materials"
                onClick={onOpenInventory}
              />
            ) : null}
            <ItemRow
              title="Help & Guides"
              meta="How the Hive, resources, and navigation work"
              onClick={() => openPane('help')}
            />
            {careerAvailable ? (
              <ItemRow
                title="Career Statistics"
                meta="Lifetime progress and latest Sortie"
                onClick={() => openPane('career')}
              />
            ) : null}
            {onOpenStation
              ? stations.map((station) => (
                  <StationRow
                    key={station.id}
                    station={station}
                    state={state}
                    onOpen={onOpenStation}
                  />
                ))
              : null}
            <ItemRow
              title="Settings"
              meta="Number notation, combat readouts, and app refresh"
              onClick={() => openPane('settings')}
            />
            <ItemRow
              title="Save Data"
              meta="Export, import, or clear this local save"
              onClick={() => openPane('save')}
            />
            <ItemRow
              title="About"
              meta="Build, save version, and installation information"
              onClick={() => openPane('about')}
            />
          </div>
        ) : null}

        {pane === 'help' ? (
          <div className="more-child">
            <Section>
              <SectionHeader title="Getting started" />
              <p>Fit your Frame and Cores at Dock, then launch a Sortie. Combat advances only while the Sortie is running.</p>
            </Section>
            <Section>
              <SectionHeader title="Resources" />
              <p>Salvage powers temporary Sortie upgrades. Scrap and later materials persist and have dedicated spending homes.</p>
            </Section>
            <Section>
              <SectionHeader title="Navigation" />
              <p>Dock owns preparation. Systems owns industry. More owns inventory, guidance, preferences, and secondary records.</p>
            </Section>
            <Section>
              <SectionHeader title="Need context?" />
              <p>Use the ? control in a screen header for help specific to the screen you are viewing.</p>
            </Section>
          </div>
        ) : null}

        {pane === 'settings' ? (
          <div className="more-child">
            {onNotation ? (
              <Section>
                <SectionHeader title="Number notation" />
                <div className="sheet-tabs notation-tabs" role="tablist" aria-label="Number notation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={state.meta.numberNotation !== 'scientific'}
                    className={state.meta.numberNotation !== 'scientific' ? 'sheet-tab active' : 'sheet-tab'}
                    onClick={() => onNotation('engineering')}
                  >
                    Engineering
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={state.meta.numberNotation === 'scientific'}
                    className={state.meta.numberNotation === 'scientific' ? 'sheet-tab active' : 'sheet-tab'}
                    onClick={() => onNotation('scientific')}
                  >
                    Scientific
                  </button>
                </div>
                <p className="muted">
                  Preview: {state.meta.numberNotation === 'scientific' ? '1.23e4' : '12.3e3'}
                </p>
              </Section>
            ) : null}

            {onDamageNumbers ? (
              <Section>
                <SectionHeader title="Combat numbers" />
                <div className="sheet-tabs notation-tabs" role="tablist" aria-label="Combat numbers">
                  {(['minimal', 'standard', 'detailed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={(state.meta.damageNumbers ?? 'standard') === mode}
                      className={(state.meta.damageNumbers ?? 'standard') === mode ? 'sheet-tab active' : 'sheet-tab'}
                      onClick={() => onDamageNumbers(mode)}
                    >
                      {mode === 'minimal' ? 'Minimal' : mode === 'detailed' ? 'Detailed' : 'Standard'}
                    </button>
                  ))}
                </div>
                <p className="muted">Standard is restrained. Detailed shows every hit.</p>
              </Section>
            ) : null}

            <Section>
              <SectionHeader title="Application" />
              <p className="muted">Installed versions can retain an older cached build.</p>
              <button type="button" className="primary more-wide-action" onClick={() => void forceReloadApp()}>
                Reload latest build
              </button>
            </Section>
          </div>
        ) : null}

        {pane === 'save' ? (
          <div className="more-child">
            <Section>
              <SectionHeader title="Export" />
              <p className="muted">Keep this code somewhere safe or use it to move your career to another device.</p>
              <textarea
                className="more-save-code"
                value={exportSave(state)}
                readOnly
                rows={3}
                aria-label="Export save code"
              />
              <button
                type="button"
                className="primary more-wide-action"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportSave(state))
                  setMessage('Save copied to clipboard.')
                }}
              >
                Copy export code
              </button>
            </Section>

            <Section>
              <SectionHeader title="Import" />
              <label className="stack">
                <span className="muted">Paste save code</span>
                <textarea
                  value={importCode}
                  onChange={(event) => setImportCode(event.target.value)}
                  rows={3}
                  placeholder="Paste save code…"
                  aria-label="Import save code"
                />
              </label>
              <button
                type="button"
                className="more-wide-action"
                onClick={() => {
                  const ok = onImport(importCode)
                  setMessage(ok ? 'Save imported.' : 'Import failed — invalid code.')
                }}
              >
                Import save
              </button>
            </Section>

            <Section>
              <SectionHeader title="Delete local data" />
              <p className="muted">This cannot be undone unless you have exported the save.</p>
              <button
                type="button"
                className="danger more-wide-action"
                onClick={() => {
                  if (window.confirm('Delete local save and start over?')) {
                    onHardReset()
                    setMessage('Save cleared.')
                  }
                }}
              >
                Hard reset
              </button>
            </Section>
            {message ? <p className="notice" role="status">{message}</p> : null}
          </div>
        ) : null}

        {pane === 'about' ? (
          <div className="more-child">
            <Section>
              <SectionHeader title="Hiveworks" />
              <p>A layered idle defense game about rebuilding a modular Hive and pushing deeper into the Choir.</p>
            </Section>
            <div className="more-stat-grid">
              <StatPair label="App build" value={APP_BUILD} />
              <StatPair label="Save version" value={state.version} />
            </div>
            <Section>
              <SectionHeader title="Installation" />
              <p>On Android Chrome, use Install App or Add to Home screen. Saves remain in this browser until exported or cleared.</p>
            </Section>
          </div>
        ) : null}

        {pane === 'career' ? (
          <div className="more-child">
            <div className="more-stat-grid">
              <StatPair label="Best Wave" value={careerBestWave(state) ? `W${careerBestWave(state)}` : 'W0'} />
              <StatPair label="Rebuilds" value={state.prestige.prestigeCount} />
              <StatPair label="Waves cleared" value={state.meta.lifetimeWaveClears} />
              <StatPair label="Sorties launched" value={state.meta.sortieSerial} />
            </div>
            <Section>
              <SectionHeader title="Latest Sortie" />
              <p>
                {state.combat.lastSortie.outcome === 'defeat' ? 'Defeat' : 'Withdrawn'} at Wave {state.combat.lastSortie.wave}.
              </p>
              <p className="muted">Scrap earned: {Math.floor(state.combat.lastSortie.scrapEarned)}</p>
            </Section>
          </div>
        ) : null}
      </div>
    </section>
  )
}
