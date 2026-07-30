import type { GameState } from '../../game/types'
import { CHALLENGES } from '../../game/catalog'
import { RESOURCE_LABELS } from '../../game/state'

interface PrestigeTabProps {
  state: GameState
}

export function PrestigeTab({ state }: PrestigeTabProps) {
  const { prestige, resources } = state

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Prestige & Challenges</h2>
        <p>Soft resets for permanent growth. Challenges are restricted prestige runs.</p>
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
      </div>

      <h3>Challenges</h3>
      <ul className="def-list">
        {CHALLENGES.map((c) => {
          const done = prestige.completedChallenges.includes(c.id)
          const active = prestige.activeChallengeId === c.id
          return (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p className="muted">{c.description}</p>
                <p className="muted">Restriction: {c.restriction}</p>
              </div>
              <span className="badge">{active ? 'Active' : done ? 'Cleared' : 'Locked'}</span>
            </li>
          )
        })}
      </ul>

      <p className="placeholder">Stub: prestige button + challenge entry at reset boundary.</p>
    </section>
  )
}
