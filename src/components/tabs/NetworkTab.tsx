import type { GameState, NetworkLinkId, ProcessNetworkPreset } from '../../game/types'
import {
  droneCap,
  idleWorkers,
  isStationUnlocked,
  STATIONS,
} from '../../game/catalog'
import { useJustBecame } from '../../hooks/useJustBecame'
import { WORKER_JOB_IDS, workerJobCapLine, workerJobLabel } from '../../game/workers'

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

  const jobs = STATIONS.filter((station) => WORKER_JOB_IDS.includes(station.id))

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
      <p className="muted">
        Each job has an efficient range and a hard cap. Extra drones on a full job do nothing.
      </p>
      <div className="panel-scroll">
        {jobs.map((job) => {
          const open = isStationUnlocked(state, job.id)
          const assigned = state.base.assignments[job.id] ?? 0
          const rowClass = [
            'network-row',
            open ? (assigned > 0 ? 'is-active' : 'is-idle') : 'locked',
            idleFlash && idle > 0 ? 'idle-flash' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <article key={job.id} className={rowClass} data-guide={`worker-${job.id}`}>
              <div className="network-row-main">
                <strong>{workerJobLabel(job.id, job.name)}</strong>
                <span className="muted">{workerJobCapLine(assigned, job.id)}</span>
              </div>
              <p className="network-row-stats">{job.description}</p>
              {job.id === 'scrap-field' && open ? (
                <p className="muted">
                  {assigned > 0
                    ? `Scrap +${((job.rates.scrap ?? 0) * assigned).toFixed(1)}/s`
                    : `Scrap 0/s → +${(job.rates.scrap ?? 0).toFixed(1)}/s with 1 drone`}
                </p>
              ) : null}
              {open ? (
                <p className="assign-row">
                  <button type="button" disabled={assigned <= 0} onClick={() => onAssign(job.id, -1)}>
                    −
                  </button>
                  <button
                    type="button"
                    data-guide={`worker-${job.id}`}
                    disabled={idle <= 0}
                    onClick={() => onAssign(job.id, 1)}
                  >
                    +
                  </button>
                </p>
              ) : (
                <p className="muted">Locked</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
