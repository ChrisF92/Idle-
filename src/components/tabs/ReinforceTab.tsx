import { useEffect, useState } from 'react'
import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { REINFORCE_UNLOCK_SECTOR, canReinforce, reinforceCount } from '../../game/reinforce'
import { reinforceConsequenceLists } from '../../game/playerGuidance'
import { ConsequencePanel } from '../ConsequencePanel'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  ConfirmModal,
  ContextBar,
  Screen,
  ScreenHeader,
  Section,
  StatPair,
  StickyAction,
} from '../../ui/primitives'

interface ReinforceTabProps {
  state: GameState
  onBack: () => void
  onReinforce: () => void
}

const PRESENTATION_MS = 2800

export function ReinforceTab({ state, onBack, onReinforce }: ReinforceTabProps) {
  const open = isSystemUnlocked(state, 'reinforce')
  const check = canReinforce(state)
  const count = reinforceCount(state)
  const [confirm, setConfirm] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const lists = reinforceConsequenceLists(state)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!presenting) return
    if (reduced) return
    const id = window.setTimeout(() => {
      onReinforce()
      setPresenting(false)
    }, PRESENTATION_MS)
    return () => window.clearTimeout(id)
  }, [presenting, reduced, onReinforce])

  const beginReinforce = () => {
    setConfirm(false)
    setPresenting(true)
    if (reduced) {
      onReinforce()
      setPresenting(false)
    }
  }

  return (
    <Screen className="panel screen-panel reinforce-screen" label="Reinforce" sticky={open}>
      <ScreenHeader
        title="Reinforce"
        action={
          <button type="button" onClick={onBack}>
            More
          </button>
        }
      />
      <ContextBar>
        <StatPair label="Act 1" value={state.meta.act1Cleared ? 'Complete' : 'Open'} />
        <StatPair label="Reinforce count" value={count} />
        <StatPair label="Door" value={`Wave ${REINFORCE_UNLOCK_SECTOR}`} />
      </ContextBar>
      {!open ? (
        <p className="muted">
          Clear Wave {REINFORCE_UNLOCK_SECTOR} to reveal Reinforce. Rebuild carries knowledge backward.
          Reinforce reconstructs the Hive. No Act 2 shop opens here.
        </p>
      ) : (
        <div className="panel-scroll">
          <Section>
            <p>
              Act 1 is complete. Rebuild has carried knowledge as far as this loop allows. Reinforce is a
              larger reconstruction — the Hive’s starting architecture, not another Matter shop.
            </p>
            <ConsequencePanel lists={lists} variant="reinforce" />
          </Section>
          <StickyAction guide="reinforce-go">
            <button
              type="button"
              className="primary"
              disabled={!check.ok}
              onClick={() => setConfirm(true)}
            >
              {check.ok ? 'Reinforce' : check.reason}
            </button>
          </StickyAction>
        </div>
      )}
      <ConfirmModal
        open={confirm}
        title="Reinforce"
        overlayId="reinforce-confirm"
        onClose={() => setConfirm(false)}
      >
        <p>This reconstructs the Hive. Confirm the lists, then continue.</p>
        <ConsequencePanel lists={lists} variant="reinforce" />
        <div className="modal-actions">
          <button type="button" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={beginReinforce}>
            Confirm Reinforce
          </button>
        </div>
      </ConfirmModal>
      {presenting && !reduced ? (
        <div
          className="reinforce-presentation"
          role="dialog"
          aria-labelledby="reinforce-presentation-title"
          aria-modal="true"
        >
          <p className="ui-kicker">Temporal reconstruction</p>
          <h3 id="reinforce-presentation-title">The Hive destabilises</h3>
          <p>Time around the lattice distorts. Reconstruction begins.</p>
        </div>
      ) : null}
    </Screen>
  )
}
