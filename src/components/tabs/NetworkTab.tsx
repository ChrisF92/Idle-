import { useEffect, useRef, useState } from 'react'
import type { GameState, NetworkLinkId } from '../../game/types'
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

type NetworkPane = 'bars' | 'links'

const NETWORK_PANES: { id: NetworkPane; label: string; guide?: string }[] = [
  { id: 'bars', label: 'Bars' },
  { id: 'links', label: 'Links', guide: 'network-links' },
]

interface NetworkTabProps {
  state: GameState
  onAssign: (barId: string, delta: number) => void
  onBuyLink: (id: NetworkLinkId) => void
  guideTarget?: string | null
}

export function NetworkTab({ state, onAssign, onBuyLink, guideTarget = null }: NetworkTabProps) {
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
