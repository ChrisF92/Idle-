import { useEffect, useState } from 'react'
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
import { ConsequencePanel } from '../ConsequencePanel'

interface ProtocolsTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
  onBlockingChange?: (open: boolean) => void
}

function firstProtocolStart(state: GameState): boolean {
  const ranks = state.protocols?.ranks ?? {}
  return Object.values(ranks).every((n) => !n)
}

function ProtocolCard({
  state,
  def,
  running,
  onRequestStart,
}: {
  state: GameState
  def: ProtocolDef
  running: boolean
  onRequestStart: (id: string) => void
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
          Rank {rank}/{PROTOCOL_MAX_RANK}
        </span>
      </div>
      <p className="network-row-stats">
        <strong>Restriction.</strong> {def.restriction}
      </p>
      <p className="network-row-stats">
        <strong>Goal.</strong> Reach Sector {goal}.
      </p>
      <p className="network-row-stats">
        <strong>Reward.</strong> {next}
        {best > 0 ? ` · best S${best}` : ''}
      </p>
      {rank > 0 ? <p className="network-row-stats">Owned: {cumulative}</p> : null}
      <p className="muted">Starting this Protocol resets your current run.</p>
      <button
        type="button"
        className="primary"
        disabled={running || !check.ok}
        onClick={() => onRequestStart(def.id)}
      >
        {running ? 'Active' : check.ok ? 'Start Protocol' : check.reason}
      </button>
    </article>
  )
}

export function ProtocolsTab({
  state,
  onBack,
  onEnter,
  onAbandon,
  onBlockingChange,
}: ProtocolsTabProps) {
  const open = isSystemUnlocked(state, 'protocols')
  const active = activeProtocol(state)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pending = pendingId ? PROTOCOLS.find((p) => p.id === pendingId) : undefined
  const first = firstProtocolStart(state)

  useEffect(() => {
    onBlockingChange?.(Boolean(pending))
    return () => onBlockingChange?.(false)
  }, [pending, onBlockingChange])

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
            ? 'Restricted sorties. Clear the goal for a permanent scaling bonus.'
            : `Clear sector ${PROTOCOL_UNLOCK_SECTOR} to open Protocols.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Each Protocol mutes one system. Starting one resets your current run.</p>
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
              onRequestStart={setPendingId}
            />
          ))}
        </div>
      )}
      {pending ? (
        <div className="modal-backdrop" role="dialog" aria-labelledby="protocol-confirm-title">
          <div className="modal-sheet">
            <header className="modal-header">
              <h3 id="protocol-confirm-title">{pending.name}</h3>
              <button type="button" onClick={() => setPendingId(null)}>
                Close
              </button>
            </header>
            {first ? (
              <ConsequencePanel
                lists={{
                  gain: [protocolRewardLine(protocolNextRewards(state, pending.id))],
                  keep: ['Foundry', 'Shards', 'Research', 'Process', 'Protocol ranks'],
                  reset: ['Salvage', 'Core levels', 'Network bar levels', 'Current sortie'],
                  change: [],
                }}
              />
            ) : (
              <p>Starting this Protocol resets Salvage, Core levels, and the current sortie.</p>
            )}
            <p className="muted">
              Restriction: {pending.restriction} Goal: Sector {protocolGoalSector(state, pending.id)}.
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onEnter(pending.id)
                  setPendingId(null)
                }}
              >
                Start Protocol
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
