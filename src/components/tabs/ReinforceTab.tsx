import { useEffect, useState } from 'react'
import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  REINFORCE_UNLOCK_SECTOR,
  canReinforce,
  reinforceCount,
} from '../../game/reinforce'
import { reinforceConsequenceLists } from '../../game/playerGuidance'
import { ConsequencePanel } from '../ConsequencePanel'

interface ReinforceTabProps {
  state: GameState
  onBack: () => void
  onReinforce: () => void
  onBlockingChange?: (open: boolean) => void
}

export function ReinforceTab({ state, onBack, onReinforce, onBlockingChange }: ReinforceTabProps) {
  const open = isSystemUnlocked(state, 'reinforce')
  const check = canReinforce(state)
  const count = reinforceCount(state)
  const [confirm, setConfirm] = useState(false)
  const lists = reinforceConsequenceLists(state)

  useEffect(() => {
    onBlockingChange?.(confirm)
    return () => onBlockingChange?.(false)
  }, [confirm, onBlockingChange])

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
            ? `Completed ${count} time${count === 1 ? '' : 's'}. Future Rebuild kits grow.`
            : `Reach Wave ${REINFORCE_UNLOCK_SECTOR} for the second prestige.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Reinforce keeps the Foundry and starts the lane again.</p>
      ) : (
        <div className="panel-scroll">
          <ConsequencePanel lists={lists} />
          <p className="assign-row">
            <button
              type="button"
              className="primary"
              data-guide="reinforce-go"
              disabled={!check.ok}
              onClick={() => setConfirm(true)}
            >
              {check.ok ? 'Reinforce' : check.reason}
            </button>
          </p>
        </div>
      )}
      {confirm ? (
        <div className="modal-backdrop" role="dialog" aria-labelledby="reinforce-confirm-title">
          <div className="modal-sheet">
            <header className="modal-header">
              <h3 id="reinforce-confirm-title">Reinforce</h3>
              <button type="button" onClick={() => setConfirm(false)}>
                Close
              </button>
            </header>
            <ConsequencePanel lists={lists} />
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onReinforce()
                  setConfirm(false)
                }}
              >
                Reinforce
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
