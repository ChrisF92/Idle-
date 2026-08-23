import type { GameState, NetworkLinkId, ProcessNetworkPreset } from '../../game/types'
import {
  droneCap,
  idleWorkers,
  isStationUnlocked,
  STATIONS,
} from '../../game/catalog'
import { useJustBecame } from '../../hooks/useJustBecame'
import { visibleWorkerJobIds } from '../../game/catalog'
import { workerJobConsequence } from '../../game/workerReadout'

interface NetworkTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onBuyLink?: (id: NetworkLinkId) => void
  onOptimise?: () => void
  onPreset?: (preset: ProcessNetworkPreset) => void
  guideTarget?: string | null
  onBack?: () => void
}

export function NetworkTab({ state, onAssign, onOptimise, onBack }: NetworkTabProps) {
  const cap = droneCap(state)
  const idle = idleWorkers(state)
  const atCap = state.base.workerDrones >= cap
  const idleFlash = useJustBecame(idle > 0)

  const openIds = new Set(visibleWorkerJobIds(state))
  const jobs = STATIONS.filter((station) => openIds.has(station.id))

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        {onBack ? (
          <p className="assign-row">
            <button type="button" onClick={onBack}>
              Systems
            </button>
          </p>
        ) : null}
        <h2>Worker Drones</h2>
        <p>
          Corps {state.base.workerDrones}/{cap}
          {idle ? ` · ${idle} idle` : ''}
          {atCap ? ' · cap' : ''}
        </p>
      </header>
      {onOptimise ? (
        <p className="assign-row">
          <button type="button" className="primary" onClick={onOptimise}>
            Balance jobs
          </button>
        </p>
      ) : null}
      <div className="panel-scroll">
        {jobs.map((job) => {
          const open = isStationUnlocked(state, job.id)
          const assigned = state.base.assignments[job.id] ?? 0
          const effect = workerJobConsequence(state, job.id)
          const rowClass = [
            'network-row',
            'worker-job-row',
            open ? (assigned > 0 ? 'is-active' : 'is-idle') : 'locked',
            idleFlash && idle > 0 ? 'idle-flash' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <article key={job.id} className={rowClass} data-guide={`worker-${job.id}`}>
              <div className="network-row-main">
                <strong>{effect.title}</strong>
                <span className="muted">{effect.assigned} Worker Drones</span>
              </div>
              <p className="ui-meta">{effect.band}</p>
              <p className="network-row-stats">{open ? effect.current : 'Locked'}</p>
              {open ? <p className="ui-meta">{effect.next}</p> : null}
              {open ? (
                <p className="assign-row worker-stepper">
                  <button type="button" disabled={assigned <= 0} aria-label={`Remove drone from ${effect.title}`} onClick={() => onAssign(job.id, -1)}>
                    −
                  </button>
                  <strong aria-live="polite">{assigned}</strong>
                  <button
                    type="button"
                    data-guide={`worker-${job.id}`}
                    disabled={idle <= 0}
                    aria-label={`Assign drone to ${effect.title}`}
                    onClick={() => onAssign(job.id, 1)}
                  >
                    +
                  </button>
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
