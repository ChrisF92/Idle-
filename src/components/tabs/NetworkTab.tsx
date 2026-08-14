import type { GameState, NetworkLinkId } from '../../game/types'
import {
  droneCap,
  dronePower,
  idleWorkers,
  WORKER_MANUFACTURE_SECONDS,
  workerManufactureSpeed,
} from '../../game/catalog'
import { networkLinkPower, networkManufactureMult } from '../../game/network'
import { formatCompact } from '../../game/format'
import { NetworkSheet } from '../NetworkSheet'

interface NetworkTabProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  onBuyLink: (id: NetworkLinkId) => void
}

export function NetworkTab({ state, onAssign, onBuyLink }: NetworkTabProps) {
  const cap = droneCap(state)
  const idle = idleWorkers(state)
  const atCap = state.base.workerDrones >= cap
  const speed = workerManufactureSpeed(state) * networkManufactureMult(state)
  const eta =
    atCap || speed <= 0
      ? null
      : ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed
  const link = networkLinkPower(state)
  const efficiency = dronePower(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Network</h2>
        <p>
          Link power {formatCompact(link, 2)} · efficiency ×{efficiency.toFixed(2)}. Corps{' '}
          {state.base.workerDrones}/{cap}
          {idle ? ` · ${idle} idle` : ''}
          {atCap ? ' · cap' : eta != null ? ` · next drone ${Math.ceil(eta)}s` : ''}
        </p>
      </header>
      <div className="manufacture-bar network-manufacture" data-guide="network-manufacture" aria-hidden>
        <div
          className="manufacture-bar-fill"
          style={{ width: `${Math.round((atCap ? 1 : state.base.manufactureProgress) * 100)}%` }}
        />
      </div>
      <div className="panel-scroll">
        <NetworkSheet state={state} onAssign={onAssign} onBuyLink={onBuyLink} />
      </div>
    </section>
  )
}
