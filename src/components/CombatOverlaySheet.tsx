import { useEffect, useState } from 'react'
import { BottomSheet } from '../ui/primitives'
import type { CombatOverlayMode, GameState } from '../game/types'
import {
  canConfigureTargetingDoctrine,
  targetCapableLoadoutCores,
  type TargetingCoreReadout,
} from '../game/coreTargeting'

/** Stationary Core selector minimum. Matches `--touch` (44 CSS px). */
export const CORE_SELECTOR_MIN_HEIGHT_PX = 44

export function CombatOverlaySheet({
  open,
  state,
  mode,
  selectedCoreId,
  onClose,
  onMode,
  onSelectCore,
}: {
  open: boolean
  state: GameState
  mode: CombatOverlayMode
  selectedCoreId: string | null
  onClose: () => void
  onMode: (mode: CombatOverlayMode) => void
  onSelectCore: (coreInstanceId: string) => void
}) {
  const cores = targetCapableLoadoutCores(state)
  const selected = cores.find((core) => core.coreInstanceId === selectedCoreId) ?? null

  return (
    <BottomSheet
      open={open}
      title="Combat Overlay"
      overlayId="combat-overlay"
      size="full"
      onClose={onClose}
      kicker="Range and firing geometry"
    >
      <p className="ui-meta combat-overlay-hint">
        Combat Overlay shows physical Core range, acquisition and firing geometry. Select a Core
        from the stationary list; moving-Core tapping is optional.
      </p>
      <div className="overlay-mode-row" role="group" aria-label="Overlay mode">
        {(['off', 'selected', 'all'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`overlay-mode-btn${mode === id ? ' is-on' : ''}`}
            aria-pressed={mode === id}
            onClick={() => onMode(id)}
          >
            {id === 'off' ? 'Off' : id === 'selected' ? 'Selected Core' : 'All Cores'}
          </button>
        ))}
      </div>
      {cores.length === 0 ? (
        <p className="ui-meta" data-testid="combat-overlay-empty">
          No target-capable Cores fitted.
        </p>
      ) : (
        <CoreSelectorList
          cores={cores}
          selectedId={selected?.coreInstanceId ?? null}
          onSelect={onSelectCore}
          detail={mode === 'selected' ? selected : null}
        />
      )}
      {mode === 'off' ? (
        <p className="ui-meta">Overlay is off. No targeting geometry is drawn on the battlefield.</p>
      ) : null}
      {canConfigureTargetingDoctrine(state) ? (
        <p className="ui-meta">Doctrine can be changed from Targeting while Docked or Paused.</p>
      ) : null}
    </BottomSheet>
  )
}

export function CoreSelectorList({
  cores,
  selectedId,
  onSelect,
  detail,
}: {
  cores: TargetingCoreReadout[]
  selectedId: string | null
  onSelect: (coreInstanceId: string) => void
  detail?: TargetingCoreReadout | null
}) {
  return (
    <div className="core-selector" data-testid="core-selector" data-onboarding="onboarding.combat-overlay.core-selector">
      <p className="ui-kicker">Cores</p>
      <ul className="core-selector-list">
        {cores.map((core) => (
          <li key={core.coreInstanceId}>
            <button
              type="button"
              className={`core-selector-row${selectedId === core.coreInstanceId ? ' is-selected' : ''}`}
              aria-pressed={selectedId === core.coreInstanceId}
              style={{ minHeight: CORE_SELECTOR_MIN_HEIGHT_PX }}
              onClick={() => onSelect(core.coreInstanceId)}
            >
              <span className="core-selector-name">
                {selectedId === core.coreInstanceId ? (
                  <span className="core-selector-selected-mark" aria-hidden>
                    ▸ SELECTED
                  </span>
                ) : null}
                {core.label}
                <span className="ui-meta"> {doctrineLabel(core.doctrine)}</span>
              </span>
              <span className="ui-meta">
                Fire {Math.round(core.fireRange)} · Acquire {Math.round(core.acquisitionRange)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {detail ? <CoreDetailReadout core={detail} /> : null}
    </div>
  )
}

export function CoreDetailReadout({ core }: { core: TargetingCoreReadout }) {
  return (
    <dl className="core-detail-readout" data-testid="core-detail-readout" aria-label="Selected Core targeting">
      <div>
        <dt>Doctrine</dt>
        <dd>{doctrineLabel(core.doctrine)}</dd>
      </div>
      <div>
        <dt>Fire Range</dt>
        <dd>{Math.round(core.fireRange)}</dd>
      </div>
      <div>
        <dt>Acquisition Range</dt>
        <dd>{Math.round(core.acquisitionRange)}</dd>
      </div>
      <div>
        <dt>Arc</dt>
        <dd>{Math.round(core.firingArcDeg)}°</dd>
      </div>
      <div>
        <dt>Slew</dt>
        <dd>{Math.round(core.slewRateDegPerSec)}°/s</dd>
      </div>
    </dl>
  )
}

export function TargetingSheet({
  open,
  state,
  onClose,
  onSetDoctrine,
}: {
  open: boolean
  state: GameState
  onClose: () => void
  onSetDoctrine: (coreInstanceId: string, doctrine: import('../game/types').TargetingDoctrineId) => void
}) {
  const cores = targetCapableLoadoutCores(state)
  const [selectedId, setSelectedId] = useState<string | null>(cores[0]?.coreInstanceId ?? null)
  const ids = cores.map((core) => core.coreInstanceId).join('|')
  useEffect(() => {
    if (!open) return
    if (!selectedId || !ids.split('|').includes(selectedId)) {
      setSelectedId(cores[0]?.coreInstanceId ?? null)
    }
  }, [open, ids, selectedId, cores])
  const selected = cores.find((core) => core.coreInstanceId === selectedId) ?? cores[0]
  return (
    <BottomSheet
      open={open}
      title="Targeting"
      overlayId="targeting-config"
      size="full"
      onClose={onClose}
      kicker="Fire-Control Doctrine"
    >
      <p className="ui-meta">Each physical Core keeps its own Doctrine. Compatible choices only.</p>
      <div className="core-selector" data-testid="targeting-core-list">
        <ul className="core-selector-list">
          {cores.map((core) => (
            <li key={core.coreInstanceId}>
              <button
                type="button"
                className={`core-selector-row${selected?.coreInstanceId === core.coreInstanceId ? ' is-selected' : ''}`}
                aria-pressed={selected?.coreInstanceId === core.coreInstanceId}
                style={{ minHeight: CORE_SELECTOR_MIN_HEIGHT_PX }}
                onClick={() => setSelectedId(core.coreInstanceId)}
              >
                <span className="core-selector-name">
                  {selected?.coreInstanceId === core.coreInstanceId ? (
                    <span className="core-selector-selected-mark" aria-hidden>
                      ▸ SELECTED
                    </span>
                  ) : null}
                  {core.label}
                  <span className="ui-meta"> {doctrineLabel(core.doctrine)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selected ? (
        <>
          <CoreDetailReadout core={selected} />
          <TargetingDoctrinePicker core={selected} onSetDoctrine={onSetDoctrine} />
        </>
      ) : (
        <p className="ui-meta">No target-capable Cores fitted.</p>
      )}
    </BottomSheet>
  )
}

function TargetingDoctrinePicker({
  core,
  onSetDoctrine,
}: {
  core: TargetingCoreReadout
  onSetDoctrine: (coreInstanceId: string, doctrine: import('../game/types').TargetingDoctrineId) => void
}) {
  return (
    <div className="doctrine-picker" data-testid={`doctrine-picker-${core.coreInstanceId}`}>
      <p className="ui-kicker">{core.label}</p>
      <div className="overlay-mode-row" role="group" aria-label={`${core.label} doctrines`}>
        {core.allowedDoctrines.map((id) => (
          <button
            key={id}
            type="button"
            className={`overlay-mode-btn${core.doctrine === id ? ' is-on' : ''}`}
            aria-pressed={core.doctrine === id}
            onClick={() => onSetDoctrine(core.coreInstanceId, id)}
          >
            {doctrineLabel(id)}
          </button>
        ))}
      </div>
    </div>
  )
}

function doctrineLabel(id: string): string {
  switch (id) {
    case 'threat':
      return 'Threat'
    case 'focus':
      return 'Focus'
    case 'execution':
      return 'Execution'
    case 'heavy':
      return 'Heavy'
    case 'shield':
      return 'Shield'
    case 'cluster':
      return 'Cluster'
    default:
      return id
  }
}
