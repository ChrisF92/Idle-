import type { GameState } from '../../game/types'
import { CHALLENGE_SHOP, CHALLENGES, MATTER_SHOP } from '../../game/catalog'
import { RESOURCE_LABELS } from '../../game/state'
import {
  canEnterChallenge,
  canPrestige,
  prestigeGainFor,
} from '../../game/actions'
import { prestigeMinSectorFor } from '../../game/catalog'

interface PrestigeTabProps {
  state: GameState
  onPrestige: () => void
  onEnterChallenge: (challengeId: string) => void
  onAbandonChallenge: () => void
  onBuyShop: (itemId: string) => void
  onBuyMatterShop: (itemId: string) => void
}

export function PrestigeTab({
  state,
  onPrestige,
  onEnterChallenge,
  onAbandonChallenge,
  onBuyShop,
  onBuyMatterShop,
}: PrestigeTabProps) {
  const { prestige, resources, combat } = state
  const gain = prestigeGainFor(state)
  const prestigeReady = canPrestige(state)
  const minSector = prestigeMinSectorFor(prestige.shop)
  const active = prestige.activeChallengeId
    ? CHALLENGES.find((c) => c.id === prestige.activeChallengeId)
    : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Prestige & Challenges</h2>
        <p>
          Soft reset at sector {minSector}+. Spend Prestige Matter and Challenge Points on permanent
          upgrades — or bank them for a smaller passive bonus.
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
        Unspent Prestige Matter: +2% damage & production each. Unspent CP: +2% damage each. Shop
        purchases are permanent and usually beat banking for a focused path.
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
            {!prestigeReady ? ` (need sector ${minSector}+)` : ''}.
          </p>
          <button type="button" className="primary" disabled={!prestigeReady} onClick={onPrestige}>
            Prestige
          </button>
        </div>
      )}

      <h3>Prestige Matter shop</h3>
      <ul className="def-list">
        {MATTER_SHOP.map((item) => {
          const owned = prestige.matterShop.includes(item.id)
          const canBuy = !owned && resources.prestigeMatter >= item.costPm
          return (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p className="muted">{item.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">{owned ? 'Owned' : `${item.costPm} PM`}</span>
                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuyMatterShop(item.id)}
                >
                  {owned ? 'Owned' : 'Buy'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Challenge Point shop</h3>
      <ul className="def-list">
        {CHALLENGE_SHOP.map((item) => {
          const owned = prestige.shop.includes(item.id)
          const canBuy = !owned && resources.challengePoints >= item.costCp
          return (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p className="muted">{item.description}</p>
              </div>
              <div className="action-col">
                <span className="badge">{owned ? 'Owned' : `${item.costCp} CP`}</span>
                <button type="button" disabled={!canBuy} onClick={() => onBuyShop(item.id)}>
                  {owned ? 'Owned' : 'Buy'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

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
