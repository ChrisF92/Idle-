import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { REINFORCE_UNLOCK_WAVE } from '../../game/reinforce'
import { ContextBar, Screen, ScreenHeader, Section, StatPair } from '../../ui/primitives'

interface ReinforceTabProps {
  state: GameState
  onBack: () => void
}

export function ReinforceTab({ state, onBack }: ReinforceTabProps) {
  const open = isSystemUnlocked(state, 'reinforce')

  return (
    <Screen className="panel screen-panel reinforce-screen" label="Beyond Act 1">
      <ScreenHeader
        title="Beyond Act 1"
        action={
          <button type="button" onClick={onBack}>
            More
          </button>
        }
      />
      <ContextBar>
        <StatPair label="Act 1" value={state.meta.act1Cleared ? 'Complete' : 'In progress'} />
        <StatPair label="Finale" value="Choir Crown" />
        <StatPair label="Door" value={`Wave ${REINFORCE_UNLOCK_WAVE}`} />
      </ContextBar>
      {!open ? (
        <p className="muted">
          Defeat the Wave {REINFORCE_UNLOCK_WAVE} Choir Crown to reveal what lies beyond Act 1.
        </p>
      ) : (
        <div className="panel-scroll">
          <Section>
            <p>
              Act 1 is complete. The Crown's collapse exposes a deeper temporal fault: the Hive has been
              reconstructed before, and Rebuild is only the smallest expression of that loop.
            </p>
            <p>
              <strong>Reinforce is a future direction, not an active reset.</strong> Its exact role, reset
              boundary, and whether Hiveworks needs a second prestige layer will be decided from Act 1
              simulator and playtest evidence.
            </p>
            <p className="muted">
              No resources are spent, no account state is reset, and no Act 2 economy is available here.
              Hollow Choir is now available under Challenges.
            </p>
          </Section>
        </div>
      )}
    </Screen>
  )
}
