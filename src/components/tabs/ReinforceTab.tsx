import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  REINFORCE_UNLOCK_SECTOR,
  canReinforce,
  reinforceCount,
} from '../../game/reinforce'
import { prestigeGainFor } from '../../game/actions'

interface ReinforceTabProps {
  state: GameState
  onBack: () => void
  onReinforce: () => void
}

export function ReinforceTab({ state, onBack, onReinforce }: ReinforceTabProps) {
  const open = isSystemUnlocked(state, 'reinforce')
  const check = canReinforce(state)
  const count = reinforceCount(state)
  const preview = Math.max(1, Math.floor(prestigeGainFor(state) * 0.5))

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Reinforce</h2>
        <p>
          {open
            ? `×${count} · next +${preview} PM · future Rebuild kits grow`
            : `Clear sector ${REINFORCE_UNLOCK_SECTOR} for the second prestige.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Rebuild swaps guns. Reinforce keeps the foundry and starts the lane again.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted">
            Soft-resets the run like a Rebuild, then permanently boosts returning kits and PM
            gains. Cores wipe. Foundry, Yard, Specialists, and Capital ranks stay.
          </p>
          <p className="assign-row">
            <button
              type="button"
              className="primary"
              data-guide="reinforce-go"
              disabled={!check.ok}
              onClick={onReinforce}
            >
              {check.ok ? 'Reinforce' : check.reason}
            </button>
          </p>
        </div>
      )}
    </section>
  )
}
