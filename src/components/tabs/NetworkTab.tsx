import type { GameState } from '../../game/types'
import {
  droneCap,
  idleWorkers,
  WORKER_MANUFACTURE_SECONDS,
  workerManufactureSpeed,
} from '../../game/catalog'
import { networkManufactureMult } from '../../game/network'
import { NetworkSheet } from '../NetworkSheet'

interface NetworkTabProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
}

export function NetworkTab({ state, onAssign }: NetworkTabProps) {
  const cap = droneCap(state)
  const atCap = state.base.workerDrones >= cap
  const speed = workerManufactureSpeed(state) * networkManufactureMult(state)
  const eta =
    atCap || speed <= 0
      ? null
      : ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Network</h2>
        <p>
          {state.base.workerDrones}/{cap} drones · {idleWorkers(state)} idle
          {atCap ? ' · cap' : eta != null ? ` · next ${Math.ceil(eta)}s` : ''}
        </p>
      </header>
      <div className="manufacture-bar network-manufacture" aria-hidden>
        <div
          className="manufacture-bar-fill"
          style={{ width: `${Math.round((atCap ? 1 : state.base.manufactureProgress) * 100)}%` }}
        />
      </div>
      <div className="panel-scroll">
        <NetworkSheet state={state} onAssign={onAssign} />
      </div>
    </section>
  )
}
