import type { GameState } from '../../game/types'
import {
  CORE_ATTR_IDS,
  CORE_ATTR_LABELS,
  CORE_TRAIN_STATION,
  coreAttrBonusSummary,
  coreTrainingSpeed,
  secondsForNextRank,
} from '../../game/core'
import { getStation, idleWorkers, isStationUnlocked } from '../../game/catalog'

interface CoreTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
}

export function CoreTab({ state, onAssign }: CoreTabProps) {
  const idle = idleWorkers(state)
  const unlocked = state.research.unlocked.includes('core-training')

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Core</h2>
        <p>
          Assign workers to training stations to raise Core attributes. Ranks only increase —
          there is no respec. Prestige and challenge resets clear all ranks.
        </p>
      </header>

      {!unlocked ? (
        <p className="muted">Requires research: Core Training.</p>
      ) : (
        <>
          <div className="stat-row">
            <div>
              <span className="muted">Workers</span>
              <strong>{state.base.workerDrones}</strong>
            </div>
            <div>
              <span className="muted">Idle</span>
              <strong>{idle}</strong>
            </div>
          </div>

          <h3>Attributes</h3>
          <ul className="def-list">
            {CORE_ATTR_IDS.map((attrId) => {
              const stationId = CORE_TRAIN_STATION[attrId]
              const station = getStation(stationId)
              const stationOpen = isStationUnlocked(state, stationId)
              const assigned = state.base.assignments[stationId] ?? 0
              const rank = state.core.ranks[attrId] ?? 0
              const progress = state.core.progress[attrId] ?? 0
              const speed = coreTrainingSpeed(state, attrId)
              const eta =
                speed > 0
                  ? ((1 - progress) * secondsForNextRank(rank)) / speed
                  : null

              return (
                <li key={attrId}>
                  <div>
                    <strong>
                      {CORE_ATTR_LABELS[attrId]}{' '}
                      <span className="badge">Rank {rank}</span>
                    </strong>
                    <p className="muted">{station?.description}</p>
                    <p className="muted">{coreAttrBonusSummary(attrId, rank)}</p>
                    {!stationOpen ? (
                      <p className="muted">Station locked</p>
                    ) : (
                      <p className="muted">
                        {assigned} workers
                        {eta != null ? ` · next rank ~${eta.toFixed(0)}s` : ' · assign workers to train'}
                      </p>
                    )}
                    <div className="manufacture-bar" aria-label={`${attrId} training progress`}>
                      <div
                        className="manufacture-bar-fill"
                        style={{ width: `${Math.min(100, progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="action-col">
                    <span className="badge">{assigned} assigned</span>
                    <div className="assign-row">
                      <button
                        type="button"
                        disabled={!stationOpen || assigned <= 0}
                        onClick={() => onAssign(stationId, -1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={!stationOpen || idle <= 0}
                        onClick={() => onAssign(stationId, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
