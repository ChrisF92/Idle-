import type { GameState } from '../../game/types'
import {
  CHALLENGE_SHOP,
  CHALLENGES,
  MATTER_SHOP,
  challengeClearCount,
  getChallenge,
  isChallengeUnlocked,
  prestigeMinSectorFor,
} from '../../game/catalog'
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
          Soft reset at sector {minSector}+. Prestige Matter and Challenge Points buy permanent
          second-act power — shops usually beat banking for a focused path.
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
        Banked PM: +2% damage & production each. Banked CP: +2% damage each. After your first
        prestige, challenges and Matter shop define the climb.
      </p>

      {active ? (
        <div className="notice-box">
          <p>
            Active challenge: <strong>{active.name}</strong> — reach sector {active.goalSector}{' '}
            (cleared {combat.highestSector}).
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
          <button
            type="button"
            className="primary"
            data-guide="prestige-btn"
            disabled={!prestigeReady}
            onClick={onPrestige}
          >
            Prestige
          </button>
        </div>
      )}

      <h3>Prestige Matter shop</h3>
      <p className="muted">Permanent run-wide bonuses. Drydock Boost speeds hangar repair.</p>
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
      <p className="muted">QoL and start boosts earned from challenge clears.</p>
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
      <p className="muted">
        Repeatable like ITRTG — each clear grants CP and a permanent stack bonus up to a cap.
      </p>
      <ul className="def-list">
        {CHALLENGES.map((c) => {
          const clears = challengeClearCount(prestige.challengeClears, c.id)
          const capped = clears >= c.maxClears
          const unlocked = isChallengeUnlocked(state, c.id)
          const isActive = prestige.activeChallengeId === c.id
          const canEnter = canEnterChallenge(state, c.id)
          const req = c.requiresChallengeClears
          const reqClears = req
            ? challengeClearCount(prestige.challengeClears, req.challengeId)
            : 0
          const reqName = req ? getChallenge(req.challengeId)?.name ?? req.challengeId : ''
          const stackBits = [
            c.stackDamageBonus ? `+${(c.stackDamageBonus * 100).toFixed(1)}% dmg/clear` : null,
            c.stackProductionBonus
              ? `+${(c.stackProductionBonus * 100).toFixed(1)}% prod/clear`
              : null,
            c.stackRepairBonus
              ? `+${(c.stackRepairBonus * 100).toFixed(0)}% docked repair/clear`
              : null,
          ].filter(Boolean)
          return (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p className="muted">{c.description}</p>
                <p className="muted">
                  Restriction: {c.restriction}. Reward: {c.rewardChallengePoints} CP
                  {stackBits.length ? ` · ${stackBits.join(', ')}` : ''}
                </p>
                {!unlocked ? (
                  <p className="notice-warn">
                    Locked
                    {req
                      ? ` — ${reqName} ${reqClears}/${req.clears}`
                      : ''}
                    {c.requiresPrestiges
                      ? ` — need ${c.requiresPrestiges} prestige${c.requiresPrestiges === 1 ? '' : 's'} (${prestige.prestigeCount}/${c.requiresPrestiges})`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">
                  {isActive ? 'Active' : capped ? 'Maxed' : `${clears}/${c.maxClears}`}
                </span>
                <button
                  type="button"
                  disabled={!canEnter}
                  onClick={() => onEnterChallenge(c.id)}
                >
                  {capped ? 'Maxed' : isActive ? 'Running' : 'Enter'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
