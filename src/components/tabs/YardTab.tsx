import type { GameState, YardArmId, YardBuildingId } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  YARD_ARMS,
  YARD_BUILDINGS,
  YARD_EXPAND_WAVE,
  YARD_GOOD_LABELS,
  canBuyYardArm,
  getYardBuilding,
  yardArmCost,
  yardArmed,
  yardGood,
  yardGridSize,
  yardPending,
  yardPendingSummary,
} from '../../game/yard'
import { formatCompact } from '../../game/format'
import { SheetTabs } from '../SheetTabs'
import { useSyncedPane } from '../../hooks/useSyncedPane'
import { hasProcess, processConfig, yardLayoutCap } from '../../game/process'

type YardPane = 'grid' | 'place' | 'arms'

const YARD_PANES: { id: YardPane; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'place', label: 'Place' },
  { id: 'arms', label: 'Arms' },
]

interface YardTabProps {
  state: GameState
  onBack?: () => void
  onPlace: (index: number, buildingId: YardBuildingId) => void
  onClear: (index: number) => void
  onBuyArm: (id: YardArmId) => void
  onBuyMax?: () => void
  onSaveLayout?: (name?: string) => void
  onLoadLayout?: (index: number) => void
  guideTarget?: string | null
  /** Render inside the Foundry Build pane — no More chrome. */
  embedded?: boolean
}

export function YardTab({
  state,
  onBack,
  onPlace,
  onClear,
  onBuyArm,
  onBuyMax,
  onSaveLayout,
  onLoadLayout,
  guideTarget = null,
  embedded = false,
}: YardTabProps) {
  const open = isSystemUnlocked(state, 'yard')
  const size = yardGridSize(state)
  const cells = [...(state.yard?.cells ?? [])]
  while (cells.length < size * size) cells.push({ buildingId: null })
  const hint = guideTarget === 'yard-grid' || guideTarget === 'foundry-build' ? 'grid' : null
  const [pane, setPane] = useSyncedPane<YardPane>('grid', hint)

  const body = !open ? (
    <p className="muted">
      Construction opens at Wave {ACT1_CADENCE.foundryAdvanced}. Buildings persist; arms apply on the next Rebuild.
    </p>
  ) : (
    <>
      <SheetTabs value={pane} onChange={setPane} options={YARD_PANES} label="Construction panes" />
      <div className={embedded ? undefined : 'panel-scroll'}>
          {pane === 'grid' ? (
            <>
          <div className="yard-grid" data-guide="yard-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size * size }, (_, i) => {
              const cell = cells[i]
              const def = cell?.buildingId ? getYardBuilding(cell.buildingId) : undefined
              return (
                <button
                  key={i}
                  type="button"
                  className={def ? 'yard-cell filled' : 'yard-cell'}
                  onClick={() => {
                    if (def) onClear(i)
                  }}
                >
                  {def ? def.name.replace(' ', '\n') : '+'}
                </button>
              )
            })}
          </div>
          {size < 4 ? (
            <p className="muted">Grid expands at Wave {YARD_EXPAND_WAVE}.</p>
          ) : null}
          {onSaveLayout && hasProcess(state, 'yard-layouts') ? (
            <YardLayouts
              state={state}
              onSaveLayout={onSaveLayout}
              onLoadLayout={onLoadLayout}
            />
          ) : null}
            </>
          ) : null}

          {pane === 'place' ? (
            <>
          <h3 className="foundry-heading">Place</h3>
          {YARD_BUILDINGS.map((b) => {
            const cost = Object.entries(b.cost)
              .map(([id, n]) => `${n} ${YARD_GOOD_LABELS[id as 'ore' | 'flux' | 'ingot']}`)
              .join(' · ')
            const idle = cells.findIndex((c) => !c.buildingId)
            const can =
              idle >= 0 &&
              Object.entries(b.cost).every(
                ([id, n]) => yardGood(state, id as 'ore' | 'flux' | 'ingot') >= (n ?? 0),
              )
            return (
              <article key={b.id} className="network-row">
                <div className="network-row-main">
                  <strong>{b.name}</strong>
                  <span className="muted">{formatCompact(b.rate, 2)}/s</span>
                </div>
                <p className="network-row-stats">
                  {b.blurb}
                  {cost ? ` · ${cost}` : ' · free'}
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can}
                  onClick={() => idle >= 0 && onPlace(idle, b.id)}
                >
                  {idle < 0 ? 'Grid full' : 'Place'}
                </button>
              </article>
            )
          })}
            </>
          ) : null}

          {pane === 'arms' ? (
            <>
          <h3 className="foundry-heading">Next Rebuild</h3>
          <p className="muted">{yardPendingSummary(state)}</p>
          {onBuyMax && hasProcess(state, 'yard-buy-max') ? (
            <p className="assign-row">
              <button type="button" className="primary" onClick={onBuyMax}>
                Buy Max
              </button>
            </p>
          ) : null}
          {YARD_ARMS.map((arm) => {
            const can = canBuyYardArm(state, arm.id)
            const cost = yardArmCost(state, arm.id)
            return (
              <article key={arm.id} className="network-row">
                <div className="network-row-main">
                  <strong>{arm.name}</strong>
                  <span className="muted">
                    armed {yardArmed(state, arm.id)} · queue {yardPending(state, arm.id)}
                  </span>
                </div>
                <p className="network-row-stats">{arm.blurb}</p>
                <button
                  type="button"
                  className="primary"
                  disabled={!can.ok}
                  onClick={() => onBuyArm(arm.id)}
                >
                  {can.ok ? `${cost} Ingots` : can.reason}
                </button>
              </article>
            )
          })}
            </>
          ) : null}
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="foundry-construction" data-guide="foundry-build">
        <h3 className="foundry-heading">Construction</h3>
        <p className="muted">
          Processing gear persists. Spend Ingots on arms that apply on the next Rebuild.
        </p>
        {body}
      </div>
    )
  }

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          {onBack ? (
            <button type="button" onClick={onBack}>
              More
            </button>
          ) : null}
        </p>
        <h2>Construction</h2>
        <p>
          {open
            ? `${size}×${size} · ${YARD_GOOD_LABELS.ore} ${formatCompact(yardGood(state, 'ore'), 1)} · ${YARD_GOOD_LABELS.flux} ${formatCompact(yardGood(state, 'flux'), 1)} · ${YARD_GOOD_LABELS.ingot} ${formatCompact(yardGood(state, 'ingot'), 1)}`
            : `Opens at Wave ${ACT1_CADENCE.foundryAdvanced} inside Foundry.`}
        </p>
      </header>
      {body}
    </section>
  )
}

function YardLayouts({
  state,
  onSaveLayout,
  onLoadLayout,
}: {
  state: GameState
  onSaveLayout: (name?: string) => void
  onLoadLayout?: (index: number) => void
}) {
  const layouts = processConfig(state).yard.layouts
  const cap = yardLayoutCap(state)
  const active = processConfig(state).yard.activeLayout
  return (
    <div className="process-config-block">
      <p className="assign-row">
        <button type="button" className="primary" onClick={() => onSaveLayout(`Layout ${layouts.length + 1}`)}>
          Save layout
        </button>
      </p>
      <p className="muted">
        {layouts.length}/{cap} saved. Extra slots come from Accumulation.
      </p>
      {layouts.map((layout, i) => (
        <p key={`${layout.name}-${i}`} className="assign-row">
          <button
            type="button"
            className={i === active ? 'primary' : undefined}
            disabled={!onLoadLayout}
            onClick={() => onLoadLayout?.(i)}
          >
            {layout.name || `Layout ${i + 1}`}
          </button>
        </p>
      ))}
    </div>
  )
}
