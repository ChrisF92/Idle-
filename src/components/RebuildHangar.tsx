import { useMemo, useState } from 'react'
import type { GameState } from '../game/types'
import {
  SHIP_FRAMES,
  SHIP_MODULES,
  canFitModuleOnFrame,
  getFrame,
  getModule,
  prestigeMinSectorFor,
  trimModulesToFrame,
} from '../game/catalog'
import { canPrestige, prestigeGainFor } from '../game/actions'
import { yardPendingSummary } from '../game/yard'
import { isSystemUnlocked } from '../game/progression'
import { RESOURCE_LABELS } from '../game/state'

interface RebuildHangarProps {
  state: GameState
  onConfirm: (hangar: { frameId: string; modules: string[] }) => void
  onClose: () => void
}

export function RebuildHangar({ state, onConfirm, onClose }: RebuildHangarProps) {
  const available = SHIP_FRAMES.filter((f) => state.shipyard.unlockedFrames.includes(f.id))
  const [frameId, setFrameId] = useState(state.shipyard.frameId)
  const frame = getFrame(frameId) ?? available[0]!
  const [modules, setModules] = useState(() =>
    trimModulesToFrame(state.shipyard.modules, frame),
  )

  const ready = canPrestige(state)
  const gain = prestigeGainFor(state)
  const rebuildMin = prestigeMinSectorFor(state.prestige.shop)

  const weapons = useMemo(
    () => SHIP_MODULES.filter((m) => m.role === 'weapon' && state.shipyard.unlockedModules.includes(m.id)),
    [state.shipyard.unlockedModules],
  )
  const shields = useMemo(
    () =>
      SHIP_MODULES.filter((m) => m.role === 'defense' && state.shipyard.unlockedModules.includes(m.id)),
    [state.shipyard.unlockedModules],
  )

  function toggle(id: string) {
    const def = getModule(id)
    if (!def) return
    if (modules.includes(id)) {
      setModules(modules.filter((m) => m !== id))
      return
    }
    if (!canFitModuleOnFrame(frame, modules, id)) {
      const withoutRole = modules.filter((m) => getModule(m)?.role !== def.role)
      if (canFitModuleOnFrame(frame, withoutRole, id)) {
        setModules(trimModulesToFrame([...withoutRole, id], frame))
      }
      return
    }
    setModules([...modules, id])
  }

  function pickFrame(id: string) {
    const next = getFrame(id)
    if (!next) return
    setFrameId(id)
    setModules(trimModulesToFrame(modules, next))
  }

  return (
    <div className="modal-backdrop hangar-backdrop" role="dialog" aria-labelledby="rebuild-title">
      <div className="hangar-sheet">
        <header className="modal-header">
          <div>
            <h3 id="rebuild-title">Rebuild hangar</h3>
            <p className="muted">
              Swap hull and Cores. Levels and unspent Salvage wipe. +{gain}{' '}
              {RESOURCE_LABELS.prestigeMatter}.
              {isSystemUnlocked(state, 'yard') ? ` Yard: ${yardPendingSummary(state)}.` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="hangar-body">
          <h4 data-guide="hangar-hull">Hull</h4>
          <div className="hangar-picks">
            {available.map((f) => (
              <button
                key={f.id}
                type="button"
                className={frameId === f.id ? 'primary' : undefined}
                onClick={() => pickFrame(f.id)}
              >
                {f.name}
                <span className="muted">
                  {' '}
                  {f.weaponSlots}W {f.defenseSlots}S {f.utilitySlots}U
                </span>
              </button>
            ))}
          </div>

          <h4>Weapon</h4>
          <div className="hangar-picks">
            {weapons.map((m) => (
              <button
                key={m.id}
                type="button"
                className={modules.includes(m.id) ? 'primary' : undefined}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          <h4>Shield</h4>
          <div className="hangar-picks">
            {shields.map((m) => (
              <button
                key={m.id}
                type="button"
                className={modules.includes(m.id) ? 'primary' : undefined}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            data-guide="hangar-confirm"
            disabled={!ready}
            onClick={() => onConfirm({ frameId, modules })}
          >
            {ready ? `Confirm Rebuild` : `Reach sector ${rebuildMin}`}
          </button>
        </div>
      </div>
    </div>
  )
}
