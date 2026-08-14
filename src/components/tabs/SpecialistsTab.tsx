import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  SPECIALISTS,
  SPECIALIST_MAX_RANK,
  SPECIALIST_UNLOCK_SECTOR,
  canRankSpecialist,
  specialistMastery,
  specialistRank,
  specialistRankCost,
} from '../../game/specialists'
import { formatCompact } from '../../game/format'
import type { SpecialistId } from '../../game/types'

interface SpecialistsTabProps {
  state: GameState
  onBack: () => void
  onRank: (id: SpecialistId) => void
}

export function SpecialistsTab({ state, onBack, onRank }: SpecialistsTabProps) {
  const open = isSystemUnlocked(state, 'specialists')
  const salvage = state.resources.salvage ?? 0
  const heat = state.resources.heat ?? 0
  const mastery = specialistMastery(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2 data-guide="specialists-list">Specialists</h2>
        <p>
          {open
            ? `${formatCompact(salvage, 1)} Salvage · ${formatCompact(heat, 1)} Heat · Mastery ${mastery}`
            : `Clear sector ${SPECIALIST_UNLOCK_SECTOR} to print specialists.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Gunner, Warden, and Scavenger persist across Rebuild.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted">
            First rank is a print. Every 10 ranks across the three roles add +1% sortie damage.
          </p>
          {SPECIALISTS.map((spec) => {
            const rank = specialistRank(state, spec.id)
            const cost = specialistRankCost(rank)
            const can = canRankSpecialist(state, spec.id)
            const bonus =
              spec.damage != null
                ? `+${(spec.damage * 100).toFixed(1)}% dmg / rank`
                : spec.shield != null
                  ? `+${(spec.shield * 100).toFixed(0)}% shield / rank`
                  : `+${((spec.salvage ?? 0) * 100).toFixed(0)}% salvage / rank`
            return (
              <article key={spec.id} className="network-row">
                <div className="network-row-main">
                  <strong>{spec.name}</strong>
                  <span className="muted">
                    Lv {rank}/{SPECIALIST_MAX_RANK}
                  </span>
                </div>
                <p className="network-row-stats">
                  {spec.blurb} {bonus}.
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onRank(spec.id)}
                >
                  {can.ok
                    ? `${formatCompact(cost.salvage)} Salvage · ${formatCompact(cost.heat)} Heat`
                    : can.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
