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
            ? `Completed ${count} time${count === 1 ? '' : 's'}. Rebuild carries knowledge backward. Reinforce changes the starting architecture of the Hive and the loop itself.`
            : `Clear Wave ${REINFORCE_UNLOCK_SECTOR} to reveal Reinforce.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">
          Rebuild carries knowledge backward through this loop. Reinforce changes the Hive's starting architecture. No Act 2 shop opens here.
        </p>
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
