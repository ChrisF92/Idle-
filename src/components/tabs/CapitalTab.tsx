import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  CAPITAL_MAX_RANK,
  CAPITAL_TRACKS,
  CAPITAL_UNLOCK_SECTOR,
  canRankCapital,
  capitalRank,
  capitalRankCost,
} from '../../game/capital'
import { formatCompact } from '../../game/format'
import type { CapitalId } from '../../game/types'

interface CapitalTabProps {
  state: GameState
  onBack: () => void
  onRank: (id: CapitalId) => void
}

export function CapitalTab({ state, onBack, onRank }: CapitalTabProps) {
  const open = isSystemUnlocked(state, 'capital')
  const salvage = state.resources.salvage ?? 0
  const heat = state.resources.heat ?? 0

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2 data-guide="capital-tracks">Capital</h2>
        <p>
          {open
            ? `${formatCompact(salvage, 1)} Salvage · ${formatCompact(heat, 1)} Heat`
            : `Finish the Task List and clear sector ${CAPITAL_UNLOCK_SECTOR}.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Second combat scale stays on the ship. No fighters on the field.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted">Ranks persist across Rebuild. Capital Hull unlocks in the hangar.</p>
          {CAPITAL_TRACKS.map((track) => {
            const rank = capitalRank(state, track.id)
            const cost = capitalRankCost(rank)
            const can = canRankCapital(state, track.id)
            const bonus =
              track.damage != null
                ? `+${(track.damage * 100).toFixed(0)}% dmg / rank`
                : track.shield != null
                  ? `+${(track.shield * 100).toFixed(0)}% shield / rank`
                  : `+${((track.salvage ?? 0) * 100).toFixed(0)}% salvage / rank`
            return (
              <article key={track.id} className="network-row">
                <div className="network-row-main">
                  <strong>{track.name}</strong>
                  <span className="muted">
                    Lv {rank}/{CAPITAL_MAX_RANK}
                  </span>
                </div>
                <p className="network-row-stats">
                  {track.blurb} {bonus}.
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onRank(track.id)}
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
