import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'

interface FoundryTabProps {
  state: GameState
}

export function FoundryTab({ state }: FoundryTabProps) {
  const open = isSystemUnlocked(state, 'foundry')
  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Foundry</h2>
        <p>Synth analogue — recipes and drone smelters. Unlocks with sector 2.</p>
      </header>
      {open ? (
        <p className="notice-box">
          Foundry is online. Smelters and recipes land in a later pass — this door is the USI
          sector-2 unlock.
        </p>
      ) : (
        <p className="muted">Clear sector 2 to bring the Foundry online.</p>
      )}
    </section>
  )
}
