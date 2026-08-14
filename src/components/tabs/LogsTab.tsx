import type { GameState } from '../../game/types'
import { unlockedFoundryLogs } from '../../game/logs'

interface LogsTabProps {
  state: GameState
  onBack: () => void
}

export function LogsTab({ state, onBack }: LogsTabProps) {
  const logs = unlockedFoundryLogs(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Foundry Logs</h2>
        <p>{logs.length} notes on file.</p>
      </header>
      <div className="panel-scroll">
        {logs.map((log) => (
          <article key={log.id} className="network-row">
            <div className="network-row-main">
              <strong>{log.title}</strong>
            </div>
            <p className="network-row-stats">{log.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
