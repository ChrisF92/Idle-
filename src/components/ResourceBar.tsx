import type { GameState, Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'
import { visibleResourceIds } from '../game/progression'
import { formatNumber } from '../game/format'

interface ResourceBarProps {
  state: GameState
  rates?: Partial<Resources>
}

export function ResourceBar({ state }: ResourceBarProps) {
  const ids = visibleResourceIds(state)
  return (
    <div className="hud-chips" aria-label="Resources">
      {ids.map((id) => (
        <span key={id} className="hud-chip">
          <span className="hud-chip-label">{RESOURCE_LABELS[id]}</span>
          <strong>{formatNumber(state.resources[id], state.meta.numberNotation)}</strong>
        </span>
      ))}
    </div>
  )
}
