import type { GameState, NetworkBarId, NetworkLinkId } from '../game/types'
import {
  NETWORK_LINKS,
  canBuyNetworkLink,
  getNetworkBar,
  isNetworkBarUnlocked,
  networkBarCapped,
  networkEffectLabel,
  networkFillCap,
  networkFillRate,
  networkInfraBars,
  networkInfraSectionVisible,
  networkInfraVisible,
  networkLevels,
  networkLinkCost,
  networkLinkEffectLabel,
  networkLinkRank,
  networkPrimaryBars,
  networkProgress,
  networkRelayBonusLabel,
  networkRelayId,
  type NetworkBarDef,
} from '../game/network'
import { droneCap, idleWorkers } from '../game/catalog'
import { formatCompact } from '../game/format'
import {
  inspectNetworkBar,
  inspectNetworkLink,
  inspectNetworkOverview,
} from '../game/inspect'
import { InspectName } from './InspectName'
import { markLocalOk, useJustBecame } from '../hooks/useJustBecame'

interface NetworkSheetProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  onBuyLink?: (id: NetworkLinkId) => void
  compact?: boolean
  idleHighlight?: boolean
  pane?: 'bars' | 'links'
}

function LinkRow({
  state,
  linkDef,
  onBuyLink,
}: {
  state: GameState
  linkDef: (typeof NETWORK_LINKS)[number]
  onBuyLink: (id: NetworkLinkId) => void
}) {
  const rank = networkLinkRank(state, linkDef.id)
  const can = canBuyNetworkLink(state, linkDef.id)
  const justReady = useJustBecame(can.ok)
  const cost = networkLinkCost(state, linkDef.id)
  const costLabel =
    cost == null ? '' : `${cost.amount} ${cost.resource === 'heat' ? 'Heat' : 'scrap'}`
  const rowClass = [
    'network-row',
    can.ok ? 'is-affordable' : rank > 0 ? 'is-active' : 'locked',
    justReady ? 'just-ready' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={rowClass}>
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
        onClick={(e) => {
          markLocalOk(e.currentTarget)
          onBuyLink(linkDef.id)
        }}
      >
        {rank >= linkDef.maxRank ? 'Maxed' : can.ok ? costLabel : can.reason}
      </button>
    </article>
  )
}

function BarRow({
  state,
  bar,
  idle,
  onAssign,
}: {
  state: GameState
  bar: NetworkBarDef
  idle: number
  onAssign: (barId: string, delta: number) => void
}) {
  const open = isNetworkBarUnlocked(state, bar.id)
  const assigned = state.base.assignments[bar.id] ?? 0
  const levels = networkLevels(state, bar.id)
  const fill = networkProgress(state, bar.id)
  const rate = networkFillRate(state, bar.id)
  const cap = networkFillCap(state, bar.id)
  const capped = networkBarCapped(state, bar.id)
  const infra = bar.layer !== 'primary'
  const rowClass = [
    'network-row',
    infra ? 'is-infra' : '',
    open ? (assigned > 0 ? 'is-active' : 'is-idle') : 'locked',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={rowClass}
      data-guide={`network-${bar.id}`}
      data-focus={`network-${bar.id}`}
    >
      <div className="network-row-main">
        <InspectName name={bar.name} card={open ? inspectNetworkBar(state, bar.id) : null} />
        <span className="muted">{open ? `Lv ${levels}` : `Sector ${bar.requiresBestWave}`}</span>
      </div>
      {open ? (
        <>
          <p className="network-row-stats">
            {networkEffectLabel(state, bar.id)}
            {rate > 0 ? ` · ${rate.toFixed(2)}/s` : ''}
            {capped ? ` · cap ${cap.toFixed(1)}/s` : ''}
          </p>
          {!infra ? <PrimaryRelayNote state={state} barId={bar.id} /> : null}
          {infra && bar.improves ? (
            <details className="network-explain">
              <summary>What this changes</summary>
              <p>{bar.improves}.</p>
              <p>{bar.detail[0]}</p>
            </details>
          ) : null}
          {capped ? (
            <p className="muted">
              {bar.layer === 'primary'
                ? 'At fill cap. Extra drones here do little — assign the Relay.'
                : bar.layer === 'relay'
                  ? 'At fill cap. Extra drones here do little — assign the Lattice if it is open.'
                  : 'At fill cap. Extra drones here do little — spread them.'}
            </p>
          ) : null}
          <div className={assigned > 0 ? 'network-fill is-active' : 'network-fill'} aria-hidden>
            <span style={{ transform: `scaleX(${fill})` }} />
          </div>
          <div className={`network-assign${idle > 0 ? ' has-idle-drones' : ''}`}>
            <button type="button" disabled={assigned <= 0} onClick={() => onAssign(bar.id, -1)}>
              −
            </button>
            <strong>{assigned}</strong>
            <button
              type="button"
              data-guide={`network-${bar.id}-plus`}
              disabled={idle <= 0}
              onClick={(e) => {
                markLocalOk(e.currentTarget)
                onAssign(bar.id, 1)
              }}
            >
              +
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{infra && bar.improves ? `${bar.blurb} · ${bar.improves}` : bar.blurb}</p>
      )}
    </article>
  )
}

function PrimaryRelayNote({ state, barId }: { state: GameState; barId: NetworkBarId }) {
  const relayId = networkRelayId(barId)
  if (!relayId || !isNetworkBarUnlocked(state, relayId)) return null
  const relay = getNetworkBar(relayId)
  return (
    <p className="muted">
      {relay?.name ?? 'Relay'} L{networkLevels(state, relayId)} · {networkRelayBonusLabel(state, barId)}
    </p>
  )
}

export function NetworkSheet({
  state,
  onAssign,
  onBuyLink,
  compact = false,
  idleHighlight = false,
  pane = 'bars',
}: NetworkSheetProps) {
  const idle = idleWorkers(state)
  const cap = droneCap(state)

  return (
    <div className={compact ? 'network-sheet network-sheet-compact' : 'network-sheet'}>
      {pane === 'bars' ? (
        <>
      <p className={`network-corps${idleHighlight ? ' just-ready' : ''}`} data-guide="network-corps">
        <InspectName
          name={`Drones ${state.base.workerDrones}/${cap}`}
          card={inspectNetworkOverview(state)}
        />
        <span className={idle > 0 ? 'status-tag live' : 'muted'}>
          {idle > 0 ? ` ${idle} idle` : ' · none idle'}
        </span>
      </p>
      <p className="network-row-stats">
        {idle > 0 ? `${idle} idle. Assign drones to Strike or Ward.` : 'All drones assigned.'}
      </p>
      <h3 className="foundry-heading">Bars</h3>
      {networkPrimaryBars().map((bar) => (
        <BarRow key={bar.id} state={state} bar={bar} idle={idle} onAssign={onAssign} />
      ))}
      {networkInfraSectionVisible(state) ? (
        <>
          <h3 className="foundry-heading" data-guide="network-infra">
            Infrastructure
          </h3>
          <p className="muted">Relays improve the bar behind them.</p>
          {networkInfraBars()
            .filter((bar) => networkInfraVisible(state, bar))
            .map((bar) => (
              <BarRow key={bar.id} state={state} bar={bar} idle={idle} onAssign={onAssign} />
            ))}
        </>
      ) : null}
      {!compact ? (
        <p className="muted">
          Tap a name for the full sheet. Drones fill bars — they never appear on the battlefield.
          {idle > 0 ? ` ${formatCompact(idle)} idle.` : ''}
        </p>
      ) : null}
        </>
      ) : null}
      {pane === 'links' && onBuyLink ? (
        <>
          <h3 className="foundry-heading" data-guide="network-links">
            Links
          </h3>
          {NETWORK_LINKS.map((linkDef) => (
            <LinkRow key={linkDef.id} state={state} linkDef={linkDef} onBuyLink={onBuyLink} />
          ))}
        </>
      ) : null}
    </div>
  )
}
