import type { Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'

const PRIMARY: (keyof Resources)[] = [
  'scrap',
  'alloys',
  'energy',
  'data',
  'essence',
  'aiPoints',
  'salvage',
]

interface ResourceBarProps {
  resources: Resources
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

export function ResourceBar({ resources, rates = {} }: ResourceBarProps) {
  return (
    <div className="resource-bar" aria-label="Resources">
      {PRIMARY.map((id) => {
        const rate = rates[id] ?? 0
        const showRate = Math.abs(rate) >= 0.005
        return (
          <div key={id} className="resource-chip">
            <span className="resource-label">{RESOURCE_LABELS[id]}</span>
            <span className="resource-value">{format(resources[id])}</span>
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
