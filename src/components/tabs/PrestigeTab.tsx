import { useEffect, useState } from 'react'
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
import { challengesContentUnlocked } from '../../game/progression'

type PrestigeSub = 'run' | 'challenges'
type ChallengePane = 'shop' | 'runs'

interface PrestigeTabProps {
  state: GameState
  /** Active guide target — used to open the matching sub-tab. */
  guideTarget?: string | null
  onPrestige: () => void
  onAscend: () => void
  onEnterChallenge: (challengeId: string) => void
  onAbandonChallenge: () => void
  onBuyShop: (itemId: string) => void
  onBuyMatterShop: (itemId: string) => void
}

export function PrestigeTab({
  state,
  guideTarget = null,
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
  const showChallenges = challengesContentUnlocked(state)
  const [sub, setSub] = useState<PrestigeSub>('run')
  const [challengePane, setChallengePane] = useState<ChallengePane>('runs')
  const activeSub: PrestigeSub = showChallenges ? sub : 'run'

  useEffect(() => {
    if (!guideTarget) return
    if (
      guideTarget === 'challenges-subtab' ||
      guideTarget === 'challenges-section' ||
      guideTarget === 'challenge-shop'
    ) {
      if (showChallenges) setSub('challenges')
    }
    if (guideTarget === 'challenge-shop') setChallengePane('shop')
    if (guideTarget === 'challenges-section' || guideTarget === 'challenges-subtab') {
      setChallengePane('runs')
    }
    if (
      guideTarget === 'matter-shop' ||
      guideTarget === 'prestige-btn' ||
      guideTarget === 'ascend-btn'
    ) {
      setSub('run')
    }
  }, [guideTarget, showChallenges])

  const active = prestige.activeChallengeId
    ? CHALLENGES.find((c) => c.id === prestige.activeChallengeId)
    : null

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Prestige</h2>
        <p>
          Soft reset for Matter & Challenge Points. Shops are permanent. Deep ranks +
          Ascension keep the sink endless.
        </p>
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
        {showChallenges || resources.challengePoints > 0 ? (
          <div>
            <span className="muted">{RESOURCE_LABELS.challengePoints}</span>
            <strong>{resources.challengePoints.toFixed(0)}</strong>
          </div>
        ) : null}
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
      ) : null}

      {showChallenges ? (
        <div className="sub-tabs" role="tablist" aria-label="Prestige sections">
          <button
            type="button"
            role="tab"
            className={activeSub === 'run' ? 'sub-tab active' : 'sub-tab'}
            aria-selected={activeSub === 'run'}
            onClick={() => setSub('run')}
          >
            Prestige
          </button>
          <button
            type="button"
            role="tab"
            data-guide="challenges-subtab"
            className={activeSub === 'challenges' ? 'sub-tab active' : 'sub-tab'}
            aria-selected={activeSub === 'challenges'}
            onClick={() => setSub('challenges')}
          >
            Challenges
          </button>
        </div>
      ) : null}

      {activeSub === 'run' ? (
        <>
          {!active ? (
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
          ) : (
            <p className="muted">Finish or abandon the active challenge to prestige again.</p>
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
                  rank > 0 ? matterShopEffectBlurb(item, rank) : item.description
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
        </>
      ) : (
        <>
          <p className="muted">
            Optional restricted runs for Challenge Points. Prestige normally anytime —
            challenges are never required. Enter from sector {minSector}+.
          </p>

          <div className="sub-tabs" role="tablist" aria-label="Challenge sections">
            <button
              type="button"
              role="tab"
              data-guide="challenges-section"
              className={challengePane === 'runs' ? 'sub-tab active' : 'sub-tab'}
              aria-selected={challengePane === 'runs'}
              onClick={() => setChallengePane('runs')}
            >
              Runs
            </button>
            <button
              type="button"
              role="tab"
              data-guide="challenge-shop"
              className={challengePane === 'shop' ? 'sub-tab active' : 'sub-tab'}
              aria-selected={challengePane === 'shop'}
              onClick={() => setChallengePane('shop')}
            >
              Shop
            </button>
          </div>

          {challengePane === 'shop' ? (
          <ul className="shop-list">
            {CHALLENGE_SHOP.map((item) => {
              const rank = shopRank(prestige.shop, item.id)
              const maxRank = shopMaxRank(item)
              const check = canBuyChallengeShop(state, item.id)
              const maxed = rank >= maxRank
              const effect =
                rank > 0 ? challengeShopEffectBlurb(item, rank) : item.description
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
          ) : (
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
              const reqName = req
                ? getChallenge(req.challengeId)?.name ?? req.challengeId
                : ''
              const stackBits = [
                c.stackDamageBonus
                  ? `+${(c.stackDamageBonus * 100).toFixed(1)}% dmg`
                  : null,
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
              const enterTitle = !canEnter
                ? !unlocked
                  ? `Locked — ${lockBits.join(' / ') || 'requirements'}`
                  : capped
                    ? 'Max clears'
                    : active
                      ? 'Finish or abandon the active challenge'
                      : combat.sector < minSector
                        ? `Need sector ${minSector}+`
                        : 'Cannot enter'
                : undefined
              return (
                <li key={c.id} className="shop-row">
                  <div className="shop-row-main">
                    <strong>{c.name}</strong>
                    <span className="badge">goal S{c.goalSector}</span>
                    <span className="muted shop-row-effect">
                      {c.restriction}
                      {stackBits.length ? ` · ${stackBits.join(', ')}/clear` : ''}
                      {' · '}
                      {c.rewardChallengePoints} CP
                    </span>
                    {!unlocked ? (
                      <span className="notice-warn">
                        Locked — {lockBits.join(' / ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="shop-row-actions">
                    <span className="badge">
                      {isActive ? 'Active' : capped ? 'Maxed' : `${clears}/${maxClears}`}
                    </span>
                    <button
                      type="button"
                      disabled={!canEnter}
                      title={enterTitle}
                      onClick={() => onEnterChallenge(c.id)}
                    >
                      {capped ? 'Maxed' : isActive ? 'Running' : 'Enter'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          )}
        </>
      )}
    </section>
  )
}
