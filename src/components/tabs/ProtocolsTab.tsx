import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOL_UNLOCK_SECTOR,
  PROTOCOLS,
  activeProtocol,
  canEnterProtocol,
  protocolBestSector,
  protocolCumulativeLine,
  protocolGoalSector,
  protocolNextRewards,
  protocolRank,
  protocolRewardLine,
  type ProtocolDef,
} from '../../game/protocols'
import { inspectProtocol } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface ProtocolsTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
}

function ProtocolCard({
  state,
  def,
  running,
  onEnter,
}: {
  state: GameState
  def: ProtocolDef
  running: boolean
  onEnter: (id: string) => void
}) {
  const rank = protocolRank(state, def.id)
  const check = canEnterProtocol(state, def.id)
  const goal = protocolGoalSector(state, def.id)
  const best = protocolBestSector(state, def.id)
  const next = protocolRewardLine(protocolNextRewards(state, def.id))
  const cumulative = protocolCumulativeLine(state, def.id)
  return (
    <article
      className={running ? 'network-row is-active' : 'network-row'}
      data-guide={`protocol-${def.id}`}
    >
      <div className="network-row-main">
        <InspectName name={def.name} card={inspectProtocol(state, def.id)} />
        <span className="muted">
          {rank}/{PROTOCOL_MAX_RANK} · goal S{goal}
        </span>
      </div>
      <p className="network-row-stats">{def.restriction}</p>
      <p className="network-row-stats">
        Next: {next}
        {best > 0 ? ` · best S${best}` : ''}
      </p>
      {rank > 0 ? (
        <p className="network-row-stats">Owned: {cumulative}</p>
      ) : (
        <p className="network-row-stats">First clear: {def.rewards[0]?.blurb}</p>
      )}
      <details className="network-explain">
        <summary>How this scales</summary>
        <p>{def.blurb} Completions change formulas — they are not a flat shop.</p>
        {rank > 0 ? <p>{cumulative}</p> : <p>First clear: {def.rewards[0]?.blurb}</p>}
      </details>
      <button
        type="button"
        className="primary"
        disabled={running || !check.ok}
        onClick={() => onEnter(def.id)}
      >
        {running ? 'Active' : check.ok ? 'Start' : check.reason}
      </button>
    </article>
  )
}

export function ProtocolsTab({ state, onBack, onEnter, onAbandon }: ProtocolsTabProps) {
  const open = isSystemUnlocked(state, 'protocols')
  const active = activeProtocol(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Protocols</h2>
        <p>
          {open
            ? 'Mute one system. Clear the goal. Completions change how that system scales forever.'
            : `Clear sector ${PROTOCOL_UNLOCK_SECTOR} to open Protocols.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Restricted sortie. Cores and Salvage wipe when a Protocol starts. Ranks persist.</p>
      ) : (
        <div className="panel-scroll" data-guide="protocols-list">
          {active ? (
            <article className="network-row is-infra" data-guide="protocol-abandon">
              <div className="network-row-main">
                <strong>{active.name}</strong>
                <span className="muted">Goal S{protocolGoalSector(state, active.id)}</span>
              </div>
              <p className="network-row-stats">{active.restriction}</p>
              <p className="network-row-stats">
                Best this run S{Math.max(state.combat.highestSector, state.combat.sector)} · next{' '}
                {protocolRewardLine(protocolNextRewards(state, active.id))}
              </p>
              <button type="button" onClick={onAbandon}>
                Abandon
              </button>
            </article>
          ) : null}
          {PROTOCOLS.map((p) => (
            <ProtocolCard
              key={p.id}
              state={state}
              def={p}
              running={active?.id === p.id}
              onEnter={onEnter}
            />
          ))}
        </div>
      )}
    </section>
  )
}
