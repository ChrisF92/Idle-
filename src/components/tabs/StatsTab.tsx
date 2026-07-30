import { useState } from 'react'
import type { GameState } from '../../game/types'
import { exportSave } from '../../game/save'

interface StatsTabProps {
  state: GameState
  onHardReset: () => void
  onImport: (code: string) => boolean
}

export function StatsTab({ state, onHardReset, onImport }: StatsTabProps) {
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Stats & Save</h2>
        <p>Local save only for now. Export/import for phone ↔ PC transfers.</p>
      </header>

      <div className="stat-row">
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
    </section>
  )
}
