import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOL_UNLOCK_SECTOR,
  PROTOCOLS,
  activeProtocol,
  canEnterProtocol,
  protocolRank,
} from '../../game/protocols'

interface ProtocolsTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
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
            ? 'Mute one system. Clear the goal sector. Rank it forever.'
            : `Clear sector ${PROTOCOL_UNLOCK_SECTOR} to open Protocols.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Restricted sortie. Cores and Salvage wipe when a Protocol starts.</p>
      ) : (
        <div className="panel-scroll">
          {active ? (
            <article className="network-row">
              <div className="network-row-main">
                <strong>{active.name}</strong>
                <span className="muted">Goal S{active.goalSector}</span>
              </div>
              <p className="network-row-stats">{active.blurb}</p>
              <button type="button" onClick={onAbandon}>
                Abandon
              </button>
            </article>
          ) : null}
          {PROTOCOLS.map((p) => {
            const rank = protocolRank(state, p.id)
            const check = canEnterProtocol(state, p.id)
            const running = active?.id === p.id
            return (
              <article key={p.id} className={running ? 'network-row' : 'network-row'}>
                <div className="network-row-main">
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {rank}/{PROTOCOL_MAX_RANK} · S{p.goalSector}
                  </span>
                </div>
                <p className="network-row-stats">{p.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={running || !check.ok}
                  onClick={() => onEnter(p.id)}
                >
                  {running ? 'Active' : check.ok ? 'Start' : check.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
