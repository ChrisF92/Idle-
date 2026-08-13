import type { GameState, NetworkBarId } from '../game/types'
import {
  NETWORK_BARS,
  isNetworkBarUnlocked,
  networkEffectLabel,
  networkFillRate,
  networkLevels,
  networkProgress,
} from '../game/network'
import { droneCap, idleWorkers } from '../game/catalog'
import { formatCompact } from '../game/format'

interface NetworkSheetProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  compact?: boolean
}

export function NetworkSheet({ state, onAssign, compact = false }: NetworkSheetProps) {
  const idle = idleWorkers(state)
  const cap = droneCap(state)

  return (
    <div className={compact ? 'network-sheet network-sheet-compact' : 'network-sheet'}>
      <p className="network-corps">
        Corps {state.base.workerDrones}/{cap}
        <span className="muted"> · {idle} idle</span>
      </p>
      {NETWORK_BARS.map((bar) => {
        const open = isNetworkBarUnlocked(state, bar.id)
        const assigned = state.base.assignments[bar.id] ?? 0
        const levels = networkLevels(state, bar.id as NetworkBarId)
        const fill = networkProgress(state, bar.id)
        const rate = networkFillRate(state, bar.id)

        return (
          <article key={bar.id} className={open ? 'network-row' : 'network-row locked'}>
            <div className="network-row-main">
              <strong>{bar.name}</strong>
              <span className="muted">{open ? `Lv ${levels}` : `Sector ${bar.requiresSectorEver}`}</span>
            </div>
            {open ? (
              <>
                <p className="network-row-stats">
                  {networkEffectLabel(state, bar.id)}
                  {rate > 0 ? ` · ${rate.toFixed(2)}/s` : ''}
                </p>
                <div className="network-fill" aria-hidden>
                  <span style={{ width: `${Math.round(fill * 100)}%` }} />
                </div>
                <div className="network-assign">
                  <button type="button" disabled={assigned <= 0} onClick={() => onAssign(bar.id, -1)}>
                    −
                  </button>
                  <strong>{assigned}</strong>
                  <button type="button" disabled={idle <= 0} onClick={() => onAssign(bar.id, 1)}>
                    +
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">{bar.blurb}</p>
            )}
          </article>
        )
      })}
      {!compact ? (
        <p className="muted">
          Drones fill bars. Bars buff the ship — they never appear on the battlefield.
          {idle > 0 ? ` ${formatCompact(idle)} idle.` : ''}
        </p>
      ) : null}
    </div>
  )
}
