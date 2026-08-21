import { useEffect, useRef, useState } from 'react'
import type { GameState, NetworkLinkId, ProcessNetworkPreset } from '../../game/types'
import {
  droneCap,
  idleWorkers,
  isStationUnlocked,
  stationBaseSlots,
  stationEffectiveDrones,
  STATIONS,
  WORKER_MANUFACTURE_SECONDS,
  workerManufactureSpeed,
} from '../../game/catalog'
import { formatCompact } from '../../game/format'
import { useJustBecame } from '../../hooks/useJustBecame'
import { WORKER_JOB_IDS } from '../../game/workers'

interface NetworkTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onBuyLink?: (id: NetworkLinkId) => void
  onOptimise?: () => void
  onPreset?: (preset: ProcessNetworkPreset) => void
  guideTarget?: string | null
}

export function NetworkTab({ state, onAssign, onOptimise }: NetworkTabProps) {
  const cap = droneCap(state)
  const idle = idleWorkers(state)
  const atCap = state.base.workerDrones >= cap
  const speed = workerManufactureSpeed(state)
  const eta =
    atCap || speed <= 0
      ? null
      : ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed
  const drones = state.base.workerDrones
  const prevDrones = useRef(drones)
  const [justMade, setJustMade] = useState(false)
  const idleFlash = useJustBecame(idle > 0)
  const fill = atCap ? 1 : state.base.manufactureProgress

  useEffect(() => {
    if (drones > prevDrones.current) {
      setJustMade(true)
      const t = window.setTimeout(() => setJustMade(false), 560)
      prevDrones.current = drones
      return () => window.clearTimeout(t)
    }
    prevDrones.current = drones
  }, [drones])

  const jobs = STATIONS.filter((station) => WORKER_JOB_IDS.includes(station.id))

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Worker Drones</h2>
        <p>
          Corps {state.base.workerDrones}/{cap}
          {idle ? ` · ${idle} idle` : ''}
          {atCap ? ' · cap' : eta != null ? ` · next drone ${Math.ceil(eta)}s` : ''}
        </p>
      </header>
      <div
        className={`manufacture-bar network-manufacture${atCap ? ' is-capped' : ''}${justMade ? ' just-complete' : ''}`}
        data-guide="network-manufacture"
        aria-hidden
      >
        <div className="manufacture-bar-fill" style={{ transform: `scaleX(${fill})` }} />
      </div>
      {onOptimise ? (
        <p className="assign-row">
          <button type="button" className="primary" onClick={onOptimise}>
            Balance jobs
          </button>
        </p>
      ) : null}
      <p className="muted">
        Jobs have a hard cap. Extra drones on a full job do nothing.
      </p>
      <div className="panel-scroll">
        {jobs.map((job) => {
          const open = isStationUnlocked(state, job.id)
          const assigned = state.base.assignments[job.id] ?? 0
          const slots = stationBaseSlots(job)
          const effective = stationEffectiveDrones(state, job.id)
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
                <strong>{job.name}</strong>
                <span className="muted">
                  {assigned}
                  {slots > 0 ? ` / ${slots}` : ''}
                </span>
              </div>
              <p className="network-row-stats">
                {job.description}
                {open && slots > 0 ? ` · effective ${formatCompact(effective, 1)}` : ''}
              </p>
              {open ? (
                <p className="assign-row">
                  <button type="button" disabled={assigned <= 0} onClick={() => onAssign(job.id, -1)}>
                    −
                  </button>
                  <button type="button" disabled={idle <= 0} onClick={() => onAssign(job.id, 1)}>
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
