import { useState } from 'react'
import type { GameState } from '../game/types'
import { buildPlaytestReport, exportPlaytestJson } from '../game/playtest'

interface PlaytestReportProps {
  state: GameState
  onClose: () => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function PlaytestReport({ state, onClose }: PlaytestReportProps) {
  const report = buildPlaytestReport(state)
  const json = exportPlaytestJson(state)
  const [copied, setCopied] = useState<string | null>(null)

  return (
    <div className="modal-backdrop playtest-report-backdrop" role="dialog" aria-labelledby="playtest-report-title">
      <div className="modal-sheet playtest-report-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Local only</p>
            <h3 id="playtest-report-title">Playtest report</h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="muted">
          Device log for balancing. Nothing is sent off this machine.
        </p>
        <pre className="playtest-report-pre">{report}</pre>
        <label className="stack">
          <span className="muted">Raw JSON</span>
          <textarea className="playtest-json" readOnly rows={8} value={json} />
        </label>
        <p className="assign-row">
          <button
            type="button"
            className="primary"
            onClick={() => {
              void copyText(report).then((ok) => setCopied(ok ? 'report' : 'failed'))
            }}
          >
            Copy report
          </button>
          <button
            type="button"
            onClick={() => {
              void copyText(json).then((ok) => setCopied(ok ? 'json' : 'failed'))
            }}
          >
            Copy JSON
          </button>
        </p>
        {copied === 'report' ? <p className="muted">Report copied.</p> : null}
        {copied === 'json' ? <p className="muted">JSON copied.</p> : null}
        {copied === 'failed' ? <p className="muted">Select the text and copy it manually.</p> : null}
      </div>
    </div>
  )
}
