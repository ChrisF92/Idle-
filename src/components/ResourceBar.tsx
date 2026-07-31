import type { GameState, Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'
import { visibleResourceIds } from '../game/progression'

interface ResourceBarProps {
  state: GameState
  rates?: Partial<Resources>
}

function format(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(n < 10 ? 1 : 0)
}

function formatRate(n: number): string {
  const abs = Math.abs(n)
  const body =
    abs >= 100 ? abs.toFixed(0) : abs >= 10 ? abs.toFixed(1) : abs.toFixed(2)
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${body}/s`
}

export function ResourceBar({ state, rates = {} }: ResourceBarProps) {
  const ids = visibleResourceIds(state)
  return (
    <div className="resource-bar" aria-label="Resources">
      {ids.map((id) => {
        const rate = rates[id] ?? 0
        const showRate = Math.abs(rate) >= 0.005
        return (
          <div key={id} className="resource-chip">
            <span className="resource-label">{RESOURCE_LABELS[id]}</span>
            <span className="resource-value">{format(state.resources[id])}</span>
            <span
              className={
                showRate
                  ? rate >= 0
                    ? 'resource-rate'
                    : 'resource-rate resource-rate-neg'
                  : 'resource-rate resource-rate-idle'
              }
            >
              {showRate ? formatRate(rate) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
