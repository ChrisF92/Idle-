import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  ASH_PER_HEAT,
  FURNACE_TRACKS,
  canBuyFurnaceRank,
  furnaceRank,
  furnaceRankCost,
} from '../../game/furnace'
import { formatCompact } from '../../game/format'
import type { FurnaceTrackId } from '../../game/types'
import { inspectFurnaceOverview, inspectFurnaceTrack } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface FurnaceTabProps {
  state: GameState
  onBack: () => void
  onConvert: () => void
  onBuyRank: (id: FurnaceTrackId) => void
}

export function FurnaceTab({ state, onBack, onConvert, onBuyRank }: FurnaceTabProps) {
  const open = isSystemUnlocked(state, 'furnace')
  const ash = state.resources.choirAsh ?? 0
  const heat = state.resources.heat ?? 0
  const batches = Math.floor(ash / ASH_PER_HEAT)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>
          <InspectName name="Furnace" card={inspectFurnaceOverview(state)} />
        </h2>
        <p>
          {open
            ? `${formatCompact(ash, 1)} ash · ${formatCompact(heat, 1)} Heat · ${ASH_PER_HEAT} ash banks 1 Heat`
            : 'Clear sector 5 to light the Furnace.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Kills drop Choir-ash automatically — no clicker.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted">{ASH_PER_HEAT} ash banks 1 Heat. Flares collect themselves.</p>
          <p className="assign-row">
            <button type="button" className="primary" disabled={batches <= 0} onClick={onConvert} data-guide="furnace-bank">
              Bank {formatCompact(batches)} Heat
            </button>
          </p>
          <h3 className="foundry-heading" data-guide="furnace-ranks">
            Ranks
          </h3>
          {FURNACE_TRACKS.map((track) => {
            const rank = furnaceRank(state, track.id)
            const cost = furnaceRankCost(rank)
            const can = canBuyFurnaceRank(state, track.id)
            return (
              <article key={track.id} className="network-row">
                <div className="network-row-main">
                  <InspectName name={track.name} card={inspectFurnaceTrack(state, track.id)} />
                  <span className="muted">Lv {rank}</span>
                </div>
                <p className="network-row-stats">{track.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onBuyRank(track.id)}
                >
                  {can.ok ? `${cost} Heat` : can.reason}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
