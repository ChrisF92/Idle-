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
  canAscend,
  canEnterChallenge,
  canPrestige,
  prestigeGainFor,
} from '../../game/actions'

interface PrestigeTabProps {
  state: GameState
  onPrestige: () => void
  onAscend: () => void
  onEnterChallenge: (challengeId: string) => void
  onAbandonChallenge: () => void
  onBuyShop: (itemId: string) => void
  onBuyMatterShop: (itemId: string) => void
}

export function PrestigeTab({
  state,
  onPrestige,
  onAscend,
  onEnterChallenge,
  onAbandonChallenge,
  onBuyShop,
  onBuyMatterShop,
}: PrestigeTabProps) {
  const { prestige, resources, combat, meta } = state
  const gain = prestigeGainFor(state)
  const prestigeReady = canPrestige(state)
  const ascendReady = canAscend(state)
  const ascensions = meta.ascensionCount ?? 0
  const minSector = prestigeMinSectorFor(prestige.shop)
  const showMatterShop =
    prestige.prestigeCount > 0 || resources.prestigeMatter > 0 || ascensions > 0
  const showChallenges = prestige.prestigeCount >= 1
  const showChallengeShop =
    showChallenges ||
    resources.challengePoints > 0 ||
    Object.values(prestige.challengeClears).some((n) => n > 0)
  const active = prestige.activeChallengeId
    ? CHALLENGES.find((c) => c.id === prestige.activeChallengeId)
    : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Prestige</h2>
        <p>Soft reset for Matter & Challenge Points. Shops are permanent. Deep ranks + Ascension keep the sink endless.</p>
      </header>

      <div className="stat-row">
        <div>
          <span className="muted">Prestiges</span>
          <strong>{prestige.prestigeCount}</strong>
        </div>
        <div>
          <span className="muted">Ascensions</span>
          <strong>{ascensions}</strong>
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
          <span className="muted">Sector</span>
          <strong>{combat.sector}</strong>
        </div>
      </div>

      {active ? (
        <div className="notice-box">
          <p>
            <strong>{active.name}</strong> — sector {active.goalSector} (cleared{' '}
            {combat.highestSector})
          </p>
          <p className="muted">{active.restriction}</p>
          <button type="button" className="danger" onClick={onAbandonChallenge}>
            Abandon
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted">
            Next: <strong>+{gain}</strong> PM
            {ascensions > 0 ? ` · Ascension +${(ascensions * 35).toFixed(0)}%` : ''}
            {!prestigeReady ? ` · need sector ${minSector}+` : ''}
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
          {meta.act1Cleared ? (
            <>
              <p className="muted">
                Ascension soft-resets the run and permanently boosts future PM gains
                (+35% each). Unlocks deep Matter shop ranks. Need sector 30+.
              </p>
              <button
                type="button"
                data-guide="ascend-btn"
                disabled={!ascendReady}
                title={!ascendReady ? 'Need sector 30+ after Act 1' : undefined}
                onClick={onAscend}
              >
                Ascend
              </button>
            </>
          ) : null}
        </div>
      )}

      {showMatterShop ? <h3 data-guide="matter-shop">Matter shop</h3> : null}
      {showMatterShop ? (
      <ul className="shop-list">
        {MATTER_SHOP.map((item) => {
          const rank = shopRank(prestige.matterShop, item.id)
          const maxRank = shopMaxRank(item)
          const check = canBuyMatterShop(state, item.id)
          const maxed = rank >= maxRank
          const effect =
            rank > 0
              ? matterShopEffectBlurb(item, rank)
              : item.description
          return (
            <li key={item.id} className="shop-row">
              <div className="shop-row-main">
                <strong>{item.name}</strong>
                <span className="badge">
                  {rank}/{maxRank}
                </span>
                <span className="muted shop-row-effect">{effect}</span>
              </div>
              <div className="shop-row-actions">
                {!maxed ? (
                  <span className="badge">{check.cost ?? '?'} PM</span>
                ) : null}
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
      ) : null}

      {showChallengeShop ? <h3 data-guide="challenge-shop">Challenge shop</h3> : null}
      {showChallengeShop ? (
      <ul className="shop-list">
        {CHALLENGE_SHOP.map((item) => {
          const rank = shopRank(prestige.shop, item.id)
          const maxRank = shopMaxRank(item)
          const check = canBuyChallengeShop(state, item.id)
          const maxed = rank >= maxRank
          const effect =
            rank > 0
              ? challengeShopEffectBlurb(item, rank)
              : item.description
          return (
            <li key={item.id} className="shop-row">
              <div className="shop-row-main">
                <strong>{item.name}</strong>
                <span className="badge">
                  {rank}/{maxRank}
                </span>
                <span className="muted shop-row-effect">{effect}</span>
              </div>
              <div className="shop-row-actions">
                {!maxed ? (
                  <span className="badge">{check.cost ?? '?'} CP</span>
                ) : null}
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
      ) : null}

      {showChallenges ? <h3 data-guide="challenges-section">Challenges</h3> : null}
      {showChallenges ? (
      <ul className="shop-list">
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
            c.stackDamageBonus ? `+${(c.stackDamageBonus * 100).toFixed(1)}% dmg` : null,
            c.stackProductionBonus
              ? `+${(c.stackProductionBonus * 100).toFixed(1)}% prod`
              : null,
            c.stackRepairBonus
              ? `+${(c.stackRepairBonus * 100).toFixed(0)}% repair`
              : null,
          ].filter(Boolean)
          const lockBits: string[] = []
          if (req) lockBits.push(`${reqName} ${reqClears}/${req.clears}`)
          if (c.requiresPrestiges) {
            lockBits.push(`${c.requiresPrestiges} prestige`)
          }
          if (c.requiresSectorEver) {
            lockBits.push(`career S${c.requiresSectorEver}`)
          }
          return (
            <li key={c.id} className="shop-row">
              <div className="shop-row-main">
                <strong>{c.name}</strong>
                <span className="badge">S{c.goalSector}</span>
                <span className="muted shop-row-effect">
                  {c.restriction}
                  {stackBits.length ? ` · ${stackBits.join(', ')}/clear` : ''}
                  {' · '}
                  {c.rewardChallengePoints} CP
                </span>
                {!unlocked ? (
                  <span className="notice-warn">Locked — {lockBits.join(' / ')}</span>
                ) : null}
              </div>
              <div className="shop-row-actions">
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
      ) : null}
    </section>
  )
}
