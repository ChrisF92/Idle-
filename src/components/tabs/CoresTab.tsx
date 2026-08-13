import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'
import { CoreSheet } from '../CoreSheet'

interface CoresTabProps {
  state: GameState
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
}

export function CoresTab({ state, onUpgrade, onPickMilestone }: CoresTabProps) {
  const stats = computeShipStats(state)
  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Cores</h2>
        <p>
          {formatCompact(stats.damage)} DPS · {formatCompact(stats.hullMax)} hull ·{' '}
          {formatCompact(stats.shieldMax)} shield
        </p>
      </header>
      <div className="panel-scroll">
        <CoreSheet state={state} onUpgrade={onUpgrade} onPickMilestone={onPickMilestone} />
      </div>
    </section>
  )
}
