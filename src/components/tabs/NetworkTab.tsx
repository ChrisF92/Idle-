import { useEffect, useRef, useState } from 'react'
import type { GameState, NetworkLinkId, ProcessNetworkPreset } from '../../game/types'
import {
  droneCap,
  dronePower,
  idleWorkers,
  WORKER_MANUFACTURE_SECONDS,
  workerManufactureSpeed,
} from '../../game/catalog'
import { networkLinkPower, networkManufactureMult } from '../../game/network'
import { formatCompact } from '../../game/format'
import { NetworkSheet } from '../NetworkSheet'
import { SheetTabs } from '../SheetTabs'
import { useJustBecame } from '../../hooks/useJustBecame'
import { useSyncedPane } from '../../hooks/useSyncedPane'
import { hasProcess, NETWORK_PRESET_LABELS, processConfig } from '../../game/process'

type NetworkPane = 'bars' | 'links'

const NETWORK_PANES: { id: NetworkPane; label: string; guide?: string }[] = [
  { id: 'bars', label: 'Bars' },
  { id: 'links', label: 'Links', guide: 'network-links' },
]

interface NetworkTabProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  onBuyLink: (id: NetworkLinkId) => void
  onOptimise?: () => void
  onPreset?: (preset: ProcessNetworkPreset) => void
  guideTarget?: string | null
}

export function NetworkTab({ state, onAssign, onBuyLink, onOptimise, onPreset, guideTarget = null }: NetworkTabProps) {
  const cap = droneCap(state)
  const idle = idleWorkers(state)
  const atCap = state.base.workerDrones >= cap
  const speed = workerManufactureSpeed(state) * networkManufactureMult(state)
  const eta =
    atCap || speed <= 0
      ? null
      : ((1 - state.base.manufactureProgress) * WORKER_MANUFACTURE_SECONDS) / speed
  const link = networkLinkPower(state)
  const efficiency = dronePower(state)
  const fill = atCap ? 1 : state.base.manufactureProgress
  const drones = state.base.workerDrones
  const prevDrones = useRef(drones)
  const [justMade, setJustMade] = useState(false)
  const idleFlash = useJustBecame(idle > 0)
  const hint = guideTarget === 'network-links' ? 'links' : guideTarget?.startsWith('network-') ? 'bars' : null
  const [pane, setPane] = useSyncedPane<NetworkPane>('bars', hint)

  useEffect(() => {
    if (drones > prevDrones.current) {
      setJustMade(true)
      const t = window.setTimeout(() => setJustMade(false), 560)
      prevDrones.current = drones
      return () => window.clearTimeout(t)
    }
    prevDrones.current = drones
  }, [drones])

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Network</h2>
        <p>
          Link power {formatCompact(link, 2)} · efficiency ×{efficiency.toFixed(2)}. Corps{' '}
          {state.base.workerDrones}/{cap}
          {idle ? ` · ${idle} idle` : ''}
          {atCap ? ' · cap' : eta != null ? ` · next drone ${Math.ceil(eta)}s` : ''}
        </p>
      </header>
      <div
        className={`manufacture-bar network-manufacture${atCap ? ' is-capped' : ''}${justMade ? ' just-complete' : ''}`}
        data-guide="network-manufacture"
        aria-hidden
      >
        <div className="manufacture-bar-fill" style={{ transform: `scaleX(${fill})` }} />
      </div>
      <SheetTabs value={pane} onChange={setPane} options={NETWORK_PANES} label="Network panes" />
      {onOptimise && hasProcess(state, 'network-optimise') ? (
        <p className="assign-row" data-guide="network-optimise-btn">
          <button type="button" className="primary" onClick={onOptimise}>
            Optimise
          </button>
        </p>
      ) : null}
      {onPreset && hasProcess(state, 'network-presets') ? (
        <div className="process-config-block" data-guide="network-presets">
          <p className="muted">Presets write visible weights, then Optimise applies them to your drones.</p>
          <p className="assign-row">
            {(Object.keys(NETWORK_PRESET_LABELS) as ProcessNetworkPreset[])
              .filter((id) => id !== 'custom')
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  className={processConfig(state).network.preset === id ? 'primary' : undefined}
                  onClick={() => onPreset(id)}
                >
                  {NETWORK_PRESET_LABELS[id]}
                </button>
              ))}
          </p>
        </div>
      ) : null}
      {hasProcess(state, 'network-balance') ? (
        <p className="muted" data-guide="network-auto">
          Auto Optimise is {processConfig(state).network.enabled ? 'on' : 'off'}. Config lives under Process → Network.
        </p>
      ) : null}
      <div className="panel-scroll">
        <NetworkSheet
          state={state}
          onAssign={onAssign}
          onBuyLink={onBuyLink}
          idleHighlight={idleFlash}
          pane={pane}
        />
      </div>
    </section>
  )
}
