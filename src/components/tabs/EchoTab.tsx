import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  ECHO_TREE,
  ECHO_UNLOCK_SECTOR,
  ECHO_RUNS,
  canBuyEchoNode,
  canEnterEcho,
  echoClears,
  echoHasNode,
  getEchoRun,
} from '../../game/echo'
import { formatCompact } from '../../game/format'

interface EchoTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
  onBuy: (id: string) => void
}

export function EchoTab({ state, onBack, onEnter, onAbandon, onBuy }: EchoTabProps) {
  const open = isSystemUnlocked(state, 'echo')
  const activeId = state.echo?.activeId ?? null
  const active = activeId ? getEchoRun(activeId) : undefined
  const points = state.echo?.points ?? 0

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Echo Runs</h2>
        <p>
          {open
            ? `${formatCompact(points)} Echo · short gauntlets, then the tree`
            : `Clear sector ${ECHO_UNLOCK_SECTOR} to open Echo Runs.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">USI Warp Drive analogue. Cores stay. Three waves, then a Titan echo.</p>
      ) : (
        <div className="panel-scroll">
          {active ? (
            <article className="network-row">
              <div className="network-row-main">
                <strong>{active.name}</strong>
                <span className="muted">Queued</span>
              </div>
              <p className="network-row-stats">Launch from Dock to fight it.</p>
              <button type="button" onClick={onAbandon}>
                Abort
              </button>
            </article>
          ) : null}
          <h3 className="foundry-heading">Gauntlets</h3>
          {ECHO_RUNS.map((run) => {
            const check = canEnterEcho(state, run.id)
            const clears = echoClears(state, run.id)
            const running = activeId === run.id
            return (
              <article key={run.id} className="network-row">
                <div className="network-row-main">
                  <strong>{run.name}</strong>
                  <span className="muted">
                    {clears > 0 ? `×${clears}` : 'New'} · +{run.reward}
                  </span>
                </div>
                <p className="network-row-stats">{run.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={running || !check.ok}
                  onClick={() => onEnter(run.id)}
                >
                  {running ? 'Queued' : check.ok ? 'Queue' : check.reason}
                </button>
              </article>
            )
          })}
          <h3 className="foundry-heading">Tree</h3>
          {ECHO_TREE.map((node) => {
            const owned = echoHasNode(state, node.id)
            const check = canBuyEchoNode(state, node.id)
            return (
              <article key={node.id} className={owned ? 'network-row' : 'network-row'}>
                <div className="network-row-main">
                  <strong>{node.name}</strong>
                  <span className="muted">{owned ? 'Owned' : `${node.cost} Echo`}</span>
                </div>
                <p className="network-row-stats">{node.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={owned || !check.ok}
                  onClick={() => onBuy(node.id)}
                >
                  {owned ? 'Owned' : check.ok ? 'Buy' : check.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
