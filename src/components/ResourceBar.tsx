import type { Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'

const PRIMARY: (keyof Resources)[] = [
  'scrap',
  'alloys',
  'energy',
  'data',
  'essence',
  'aiPoints',
]

interface ResourceBarProps {
  resources: Resources
}

function format(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(n < 10 ? 1 : 0)
}

export function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div className="resource-bar" aria-label="Resources">
      {PRIMARY.map((id) => (
        <div key={id} className="resource-chip">
          <span className="resource-label">{RESOURCE_LABELS[id]}</span>
          <span className="resource-value">{format(resources[id])}</span>
        </div>
      ))}
    </div>
  )
}
