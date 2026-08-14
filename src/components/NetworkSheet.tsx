import type { GameState, NetworkBarId, NetworkLinkId } from '../game/types'
import {
  NETWORK_BARS,
  NETWORK_LINKS,
  canBuyNetworkLink,
  isNetworkBarUnlocked,
  networkCycleMult,
  networkEffectLabel,
  networkFillRate,
  networkLevels,
  networkLinkCost,
  networkLinkEffectLabel,
  networkLinkPower,
  networkLinkRank,
  networkProgress,
} from '../game/network'
import { droneCap, dronePower, idleWorkers } from '../game/catalog'
import { formatCompact } from '../game/format'
import {
  inspectNetworkBar,
  inspectNetworkLink,
  inspectNetworkOverview,
} from '../game/inspect'
import { InspectName } from './InspectName'

interface NetworkSheetProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  onBuyLink?: (id: NetworkLinkId) => void
  compact?: boolean
}

export function NetworkSheet({
  state,
  onAssign,
  onBuyLink,
  compact = false,
}: NetworkSheetProps) {
  const idle = idleWorkers(state)
  const cap = droneCap(state)
  const power = dronePower(state)
  const link = networkLinkPower(state)
  const cycle = networkCycleMult(state)

  return (
    <div className={compact ? 'network-sheet network-sheet-compact' : 'network-sheet'}>
      <p className="network-corps">
        <InspectName
          name={`Corps ${state.base.workerDrones}/${cap}`}
          card={inspectNetworkOverview(state)}
        />
        <span className="muted"> · {idle} idle</span>
      </p>
      <p className="network-row-stats">
        Link power {formatCompact(link, 2)} · efficiency ×{power.toFixed(2)} · cycle ×
        {cycle.toFixed(2)}
      </p>
      {NETWORK_BARS.map((bar) => {
        const open = isNetworkBarUnlocked(state, bar.id)
        const assigned = state.base.assignments[bar.id] ?? 0
        const levels = networkLevels(state, bar.id as NetworkBarId)
        const fill = networkProgress(state, bar.id)
        const rate = networkFillRate(state, bar.id)

        return (
          <article key={bar.id} className={open ? 'network-row' : 'network-row locked'} data-guide={`network-${bar.id}`}>
            <div className="network-row-main">
              <InspectName name={bar.name} card={inspectNetworkBar(state, bar.id)} />
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
      {onBuyLink ? (
        <>
          <h3 className="foundry-heading" data-guide="network-links">
            Links
          </h3>
          {NETWORK_LINKS.map((linkDef) => {
            const rank = networkLinkRank(state, linkDef.id)
            const can = canBuyNetworkLink(state, linkDef.id)
            const cost = networkLinkCost(state, linkDef.id)
            const costLabel =
              cost == null
                ? ''
                : `${cost.amount} ${cost.resource === 'heat' ? 'Heat' : 'scrap'}`
            return (
              <article
                key={linkDef.id}
                className={can.ok || rank > 0 ? 'network-row' : 'network-row locked'}
              >
                <div className="network-row-main">
                  <InspectName name={linkDef.name} card={inspectNetworkLink(state, linkDef.id)} />
                  <span className="muted">
                    {rank}/{linkDef.maxRank}
                  </span>
                </div>
                <p className="network-row-stats">
                  {networkLinkEffectLabel(state, linkDef.id)}
                  {linkDef.blurb ? ` · ${linkDef.blurb}` : ''}
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onBuyLink(linkDef.id)}
                >
                  {rank >= linkDef.maxRank ? 'Maxed' : can.ok ? costLabel : can.reason}
                </button>
              </article>
            )
          })}
        </>
      ) : null}
      {!compact ? (
        <p className="muted">
          Tap a name for the full sheet. Drones fill bars — they never appear on the battlefield.
          {idle > 0 ? ` ${formatCompact(idle)} idle.` : ''}
        </p>
      ) : null}
    </div>
  )
}
