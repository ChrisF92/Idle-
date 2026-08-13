import type { GameState, Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'
import { visibleResourceIds } from '../game/progression'

interface ResourceBarProps {
  state: GameState
  rates?: Partial<Resources>
}

function format(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(n < 10 ? 1 : 0)
}

export function ResourceBar({ state }: ResourceBarProps) {
  const ids = visibleResourceIds(state)
  return (
    <div className="hud-chips" aria-label="Resources">
      {ids.map((id) => (
        <span key={id} className="hud-chip">
          <span className="hud-chip-label">{RESOURCE_LABELS[id]}</span>
          <strong>{format(state.resources[id])}</strong>
        </span>
      ))}
    </div>
  )
}
