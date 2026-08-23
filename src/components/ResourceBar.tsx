import { useEffect, useRef, useState } from 'react'
import type { GameState, ResourceId, Resources } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'
import { visibleResourceIds } from '../game/progression'
import { formatNumber } from '../game/format'

const SHORT_LABELS: Partial<Record<ResourceId, string>> = {
  scrap: 'Scrap',
  prestigeMatter: 'Matter',
}

interface ResourceBarProps {
  state: GameState
  rates?: Partial<Resources>
  only?: ResourceId[]
  compact?: boolean
}

export function ResourceBar({ state, only, compact = false }: ResourceBarProps) {
  const ids = only ?? visibleResourceIds(state)
  const idKey = ids.join('|')
  const prev = useRef<Partial<Resources>>({})
  const [up, setUp] = useState<Partial<Record<keyof Resources, boolean>>>({})

  useEffect(() => {
    const risen: Partial<Record<keyof Resources, boolean>> = {}
    let any = false
    for (const id of idKey.split('|') as (keyof Resources)[]) {
      if (!id) continue
      const now = state.resources[id]
      const was = prev.current[id]
      if (was != null && now > was + 0.05) {
        risen[id] = true
        any = true
      }
      prev.current[id] = now
    }
    if (!any) return
    setUp(risen)
    const t = window.setTimeout(() => setUp({}), 420)
    return () => window.clearTimeout(t)
  }, [state.resources, idKey])

  return (
    <div className="hud-chips" aria-label="Resources">
      {ids.map((id) => (
        <span key={id} className="hud-chip">
          <span className="hud-chip-label">{compact ? SHORT_LABELS[id] ?? RESOURCE_LABELS[id] : RESOURCE_LABELS[id]}</span>
          <strong className={up[id] ? 'tick-up' : undefined}>
            {formatNumber(state.resources[id], state.meta.numberNotation)}
          </strong>
        </span>
      ))}
    </div>
  )
}

