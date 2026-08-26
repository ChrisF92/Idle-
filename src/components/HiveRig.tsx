import { getFrame, getModule } from '../game/catalog'
import { usableCoreSlots } from '../game/coreSlots'
import { equippedCoreVisuals, hiveFrameStyle } from '../game/hiveVisual'
import type { GameState } from '../game/types'

export type HiveRigTarget =
  | { kind: 'hive' }
  | { kind: 'core'; moduleId: string; coreInstanceId?: string }
  | { kind: 'slot' }

interface HiveRigProps {
  state: GameState
  compact?: boolean
  interactive?: boolean
  onSelect?: (target: HiveRigTarget) => void
}

export function HiveRig({ state, compact = false, interactive = false, onSelect }: HiveRigProps) {
  const frame = getFrame(state.shipyard.frameId)
  const style = hiveFrameStyle(state.shipyard.frameId)
  const cores = equippedCoreVisuals(state)
  const emptyCount = Math.max(0, usableCoreSlots(state) - cores.length)

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
        const angle = (index / Math.max(1, cores.length + emptyCount)) * Math.PI * 2 - Math.PI / 2
        const r = compact ? 38 + core.orbit * 0.15 : 52 + core.orbit * 0.35
        return (
          <button
            key={core.coreInstanceId ?? `${core.id}-${index}`}
            type="button"
            className={`hive-rig-sat is-${core.role} is-${core.kind}`}
            style={{
              left: `calc(50% + ${Math.cos(angle) * r}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px)`,
            }}
            disabled={!interactive}
            data-guide={`core-${core.id}`}
            aria-label={getModule(core.id)?.name ?? core.id}
            onClick={() =>
              onSelect?.({
                kind: 'core',
                moduleId: core.id,
                coreInstanceId: core.coreInstanceId,
              })
            }
          />
        )
      })}
      {Array.from({ length: emptyCount }, (_, index) => {
        const angle =
          ((cores.length + index) / Math.max(1, cores.length + emptyCount)) * Math.PI * 2 - Math.PI / 2
        const r = compact ? 42 : 58
        return (
          <button
            key={`empty-${index}`}
            type="button"
            className="hive-rig-sat is-empty"
            style={{
              left: `calc(50% + ${Math.cos(angle) * r}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px)`,
            }}
            disabled={!interactive}
            aria-label="Empty Core slot"
            onClick={() => onSelect?.({ kind: 'slot' })}
          />
        )
      })}
    </div>
  )
}
