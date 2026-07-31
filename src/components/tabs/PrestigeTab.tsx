import type { GameState } from '../../game/types'
import {
  CHALLENGE_SHOP,
  CHALLENGES,
  MATTER_SHOP,
  canBuyChallengeShop,
  canBuyMatterShop,
  challengeClearCount,
  challengeShopEffectBlurb,
  effectiveMaxClears,
  getChallenge,
  isChallengeUnlocked,
  matterShopEffectBlurb,
  prestigeMinSectorFor,
  shopMaxRank,
  shopRank,
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
          second-act power — shop ranks usually beat banking for a focused path.
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
        Banked PM: +1% damage & production each. Banked CP: +2% damage each. After your first
        prestige, challenges and Matter shop ranks define the climb. No respec.
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
      <p className="muted">
        Rankable permanents. Extra ranks add 45% of the base bonus (steeper PM cost each rank).
      </p>
      <ul className="def-list">
        {MATTER_SHOP.map((item) => {
          const rank = shopRank(prestige.matterShop, item.id)
          const maxRank = shopMaxRank(item)
          const check = canBuyMatterShop(state, item.id)
          const maxed = rank >= maxRank
          const label = maxed
            ? `Rank ${rank}/${maxRank}`
            : `Rank ${rank}/${maxRank} · ${check.cost ?? '?'} PM`
          return (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p className="muted">{item.description}</p>
                <p className="muted">
                  {rank > 0
                    ? matterShopEffectBlurb(item, rank)
                    : 'Not owned'}
                  {!maxed && rank > 0
                    ? ` → next ${matterShopEffectBlurb(item, rank + 1)}`
                    : ''}
                </p>
              </div>
              <div className="action-col">
                <span className="badge">{label}</span>
                <button
                  type="button"
                  disabled={!check.ok}
                  title={!check.ok ? check.reason : undefined}
                  onClick={() => onBuyMatterShop(item.id)}
                >
                  {maxed ? 'Maxed' : rank > 0 ? 'Upgrade' : 'Buy'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <h3>Challenge Point shop</h3>
      <p className="muted">
        Unique unlocks and stackable run-kits. Schematics permanently unlock modules.
      </p>
      <ul className="def-list">
        {CHALLENGE_SHOP.map((item) => {
          const rank = shopRank(prestige.shop, item.id)
          const maxRank = shopMaxRank(item)
          const check = canBuyChallengeShop(state, item.id)
          const maxed = rank >= maxRank
          const label = maxed
            ? `Rank ${rank}/${maxRank}`
            : `Rank ${rank}/${maxRank} · ${check.cost ?? '?'} CP`
          return (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p className="muted">{item.description}</p>
                <p className="muted">
                  {rank > 0
                    ? challengeShopEffectBlurb(item, rank)
                    : 'Not owned'}
                </p>
              </div>
              <div className="action-col">
                <span className="badge">{label}</span>
                <button
                  type="button"
                  disabled={!check.ok}
                  title={!check.ok ? check.reason : undefined}
                  onClick={() => onBuyShop(item.id)}
                >
                  {maxed ? 'Maxed' : rank > 0 ? 'Upgrade' : 'Buy'}
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
          const maxClears = effectiveMaxClears(c, prestige.shop)
          const capped = clears >= maxClears
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
              ? `+${(c.stackRepairBonus * 100).toFixed(0)}% hangar repair/clear`
              : null,
          ].filter(Boolean)
          const lockBits: string[] = []
          if (req) lockBits.push(`${reqName} ${reqClears}/${req.clears}`)
          if (c.requiresPrestiges) {
            lockBits.push(
              `${c.requiresPrestiges} prestige${c.requiresPrestiges === 1 ? '' : 's'} (${prestige.prestigeCount}/${c.requiresPrestiges})`,
            )
          }
          if (c.requiresSectorEver) {
            lockBits.push(
              `career sector ${c.requiresSectorEver} (${Math.max(state.meta.highestSectorEver, combat.highestSector)}/${c.requiresSectorEver})`,
            )
          }
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
                    Locked — {lockBits.join(' or ') || 'requirements unmet'}
                  </p>
                ) : null}
              </div>
              <div className="action-col">
                <span className="badge">
                  {isActive ? 'Active' : capped ? 'Maxed' : `${clears}/${maxClears}`}
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
