import { useEffect, useState } from 'react'
import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOLS,
  activeProtocol,
  canEnterProtocol,
  protocolBestWave,
  protocolCumulativeLine,
  protocolDisabledLine,
  protocolGoalWave,
  protocolNextRewardText,
  protocolRank,
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

function ChallengeCard({
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
  const goal = protocolGoalWave(state, def.id)
  const best = protocolBestWave(state, def.id)
  const next = protocolNextRewardText(state, def.id)
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
        <strong>Goal.</strong> Reach Wave {goal}.
      </p>
      <p className="network-row-stats">
        <strong>Reward.</strong> {next}
      </p>
      <p className="network-row-stats">
        <strong>Disabled.</strong> {protocolDisabledLine(def)}
      </p>
      <p className="network-row-stats">
        <strong>Current best.</strong> {best > 0 ? `Wave ${best}` : 'None yet'}
      </p>
      {rank > 0 ? <p className="network-row-stats">Owned: {cumulative}</p> : null}
      <button
        type="button"
        className="primary"
        disabled={running || !check.ok}
        onClick={() => onRequestStart(def.id)}
      >
        {running ? 'Active' : check.ok ? 'Start Challenge' : check.reason}
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
        <h2>Challenges</h2>
        <p>
          {open
            ? 'Can this account solve a modified version of the normal rules?'
            : `Reach Wave ${ACT1_CADENCE.protocols} after Process is online.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">
          Challenges reuse the Sortie engine. Restriction, goal, reward, and disabled systems are listed before launch.
        </p>
      ) : (
        <div className="panel-scroll" data-guide="protocols-list">
          {active ? (
            <article className="network-row is-infra" data-guide="protocol-abandon">
              <div className="network-row-main">
                <strong>{active.name}</strong>
                <span className="muted">Goal Wave {protocolGoalWave(state, active.id)}</span>
              </div>
              <p className="network-row-stats">{active.restriction}</p>
              <p className="network-row-stats">
                Best this run Wave {Math.max(state.combat.wave, protocolBestWave(state, active.id))} · next{' '}
                {protocolNextRewardText(state, active.id)}
              </p>
              <button type="button" onClick={onAbandon}>
                Abandon
              </button>
            </article>
          ) : null}
          {PROTOCOLS.map((p) => (
            <ChallengeCard
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
        <div className="modal-backdrop" role="dialog" aria-labelledby="challenge-confirm-title">
          <div className="modal-sheet">
            <header className="modal-header">
              <h3 id="challenge-confirm-title">{pending.name}</h3>
              <button type="button" onClick={() => setPendingId(null)}>
                Close
              </button>
            </header>
            <p className="network-row-stats">
              <strong>Restriction.</strong> {pending.restriction}
            </p>
            <p className="network-row-stats">
              <strong>Goal.</strong> Reach Wave {protocolGoalWave(state, pending.id)}.
            </p>
            <p className="network-row-stats">
              <strong>Reward.</strong> {protocolNextRewardText(state, pending.id)}
            </p>
            <p className="network-row-stats">
              <strong>Disabled.</strong> {protocolDisabledLine(pending)}
            </p>
            <p className="network-row-stats">
              <strong>Current best.</strong>{' '}
              {protocolBestWave(state, pending.id) > 0
                ? `Wave ${protocolBestWave(state, pending.id)}`
                : 'None yet'}
            </p>
            <ConsequencePanel
              lists={{
                gain: [protocolNextRewardText(state, pending.id)],
                keep: ['Foundry', 'Relics', 'Research', 'Process', 'Challenge ranks'],
                reset: ['Salvage', 'Core levels', 'Current Sortie'],
                change: [],
              }}
            />
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
                Start Challenge
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
