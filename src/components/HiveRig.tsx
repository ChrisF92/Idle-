import { frameRoleCap, getFrame, getModule } from '../game/catalog'
import { hiveResearchExtraUtilitySlots } from '../game/hiveResearch'
import { equippedCoreVisuals, hiveFrameStyle } from '../game/hiveVisual'
import type { GameState } from '../game/types'

export type HiveRigTarget = { kind: 'hive' } | { kind: 'core'; moduleId: string } | { kind: 'slot'; role: 'weapon' | 'defense' | 'utility' }

interface HiveRigProps {
  state: GameState
  compact?: boolean
  interactive?: boolean
  onSelect?: (target: HiveRigTarget) => void
}

const ROLE_ORDER = ['weapon', 'defense', 'utility'] as const

export function HiveRig({ state, compact = false, interactive = false, onSelect }: HiveRigProps) {
  const frame = getFrame(state.shipyard.frameId)
  const style = hiveFrameStyle(state.shipyard.frameId)
  const cores = equippedCoreVisuals(state)
  const extra = { utility: hiveResearchExtraUtilitySlots(state) }
  const empty: { role: (typeof ROLE_ORDER)[number]; index: number }[] = []
  if (frame) {
    for (const role of ROLE_ORDER) {
      const cap = frameRoleCap(frame, role, extra)
      const used = cores.filter((c) => c.role === role).length
      for (let i = used; i < cap; i += 1) empty.push({ role, index: i })
    }
  }

  return (
    <div className={`hive-rig${compact ? ' is-compact' : ''} is-${style}`} aria-hidden={!interactive}>
      <button
        type="button"
        className={`hive-rig-core is-${style}`}
        disabled={!interactive}
        data-guide="dock-hive"
        aria-label={`${frame?.name ?? 'Hive'} frame`}
        onClick={() => onSelect?.({ kind: 'hive' })}
      >
        <span className="hive-rig-ring" />
        <span className="hive-rig-body" />
      </button>
      {cores.map((core, index) => {
        const angle = (index / Math.max(1, cores.length + empty.length)) * Math.PI * 2 - Math.PI / 2
        const r = compact ? 38 + core.orbit * 0.15 : 52 + core.orbit * 0.35
        return (
          <button
            key={core.id}
            type="button"
            className={`hive-rig-sat is-${core.kind}`}
            style={{
              left: `calc(50% + ${Math.cos(angle) * r}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px)`,
            }}
            disabled={!interactive}
            data-guide={`core-${core.id}`}
            aria-label={getModule(core.id)?.name ?? core.id}
            onClick={() => onSelect?.({ kind: 'core', moduleId: core.id })}
          />
        )
      })}
      {empty.map((slot, index) => {
        const angle =
          ((cores.length + index) / Math.max(1, cores.length + empty.length)) * Math.PI * 2 - Math.PI / 2
        const r = compact ? 42 : 58
        return (
          <button
            key={`${slot.role}-${slot.index}`}
            type="button"
            className={`hive-rig-sat is-empty is-${slot.role}`}
            style={{
              left: `calc(50% + ${Math.cos(angle) * r}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px)`,
            }}
            disabled={!interactive}
            aria-label={`Empty ${slot.role} slot`}
            onClick={() => onSelect?.({ kind: 'slot', role: slot.role })}
          />
        )
      })}
    </div>
  )
}
