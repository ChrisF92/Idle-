import type { GameState } from '../../game/types'
import { CHALLENGES, PRESTIGE_MIN_SECTOR } from '../../game/catalog'
import { RESOURCE_LABELS } from '../../game/state'
import {
  canEnterChallenge,
  canPrestige,
  prestigeGainFor,
} from '../../game/actions'

interface PrestigeTabProps {
  state: GameState
  onPrestige: () => void
  onEnterChallenge: (challengeId: string) => void
  onAbandonChallenge: () => void
}

export function PrestigeTab({
  state,
  onPrestige,
  onEnterChallenge,
  onAbandonChallenge,
}: PrestigeTabProps) {
  const { prestige, resources, combat } = state
  const gain = prestigeGainFor(state)
  const prestigeReady = canPrestige(state)
  const active = prestige.activeChallengeId
    ? CHALLENGES.find((c) => c.id === prestige.activeChallengeId)
    : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Prestige & Challenges</h2>
        <p>
          Soft reset at sector {PRESTIGE_MIN_SECTOR}+. Challenges are restricted prestige runs with
          permanent Challenge Points.
        </p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Prestiges</span>
          <strong>{prestige.prestigeCount}</strong>
        </div>
        <div>
          <span className="muted">{RESOURCE_LABELS.prestigeMatter}</span>
          <strong>{resources.prestigeMatter.toFixed(0)}</strong>
        </div>
        <div>
          <span className="muted">{RESOURCE_LABELS.challengePoints}</span>
          <strong>{resources.challengePoints.toFixed(0)}</strong>
        </div>
        <div>
          <span className="muted">Current sector</span>
          <strong>{combat.sector}</strong>
        </div>
      </div>

      <p className="muted">
        Prestige Matter: +2% damage & production each. Challenge Points: +3% damage each. Ship
        unlocks are kept across prestiges.
      </p>

      {active ? (
        <div className="notice-box">
          <p>
            Active challenge: <strong>{active.name}</strong> — reach sector {active.goalSector}{' '}
            (cleared {Math.max(0, combat.sector - 1)}).
          </p>
          <p className="muted">{active.restriction}</p>
          <button type="button" className="danger" onClick={onAbandonChallenge}>
            Abandon challenge
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted">
            Next prestige yields <strong>+{gain}</strong> Prestige Matter
            {!prestigeReady
              ? ` (need sector ${PRESTIGE_MIN_SECTOR}+)`
              : ''}
            .
          </p>
          <button type="button" className="primary" disabled={!prestigeReady} onClick={onPrestige}>
            Prestige
          </button>
        </div>
      )}

      <h3>Challenges</h3>
      <ul className="def-list">
        {CHALLENGES.map((c) => {
          const done = prestige.completedChallenges.includes(c.id)
          const isActive = prestige.activeChallengeId === c.id
          const canEnter = canEnterChallenge(state, c.id)
          return (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p className="muted">{c.description}</p>
                <p className="muted">
                  Restriction: {c.restriction}. Reward: {c.rewardChallengePoints} CP
                </p>
              </div>
              <div className="action-col">
                <span className="badge">
                  {isActive ? 'Active' : done ? 'Cleared' : 'Open'}
                </span>
                <button
                  type="button"
                  disabled={!canEnter}
                  onClick={() => onEnterChallenge(c.id)}
                >
                  {done ? 'Done' : isActive ? 'Running' : 'Enter'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
