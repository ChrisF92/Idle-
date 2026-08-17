import type { GameState, YardArmId, YardBuildingId } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  YARD_ARMS,
  YARD_BUILDINGS,
  YARD_EXPAND_SECTOR,
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

type YardPane = 'grid' | 'place' | 'arms'

const YARD_PANES: { id: YardPane; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'place', label: 'Place' },
  { id: 'arms', label: 'Arms' },
]

interface YardTabProps {
  state: GameState
  onBack: () => void
  onPlace: (index: number, buildingId: YardBuildingId) => void
  onClear: (index: number) => void
  onBuyArm: (id: YardArmId) => void
  guideTarget?: string | null
}

export function YardTab({ state, onBack, onPlace, onClear, onBuyArm, guideTarget = null }: YardTabProps) {
  const open = isSystemUnlocked(state, 'yard')
  const size = yardGridSize(state)
  const cells = [...(state.yard?.cells ?? [])]
  while (cells.length < size * size) cells.push({ buildingId: null })
  const hint = guideTarget === 'yard-grid' ? 'grid' : null
  const [pane, setPane] = useSyncedPane<YardPane>('grid', hint)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Yard Grid</h2>
        <p>
          {open
            ? `${size}×${size} · ${YARD_GOOD_LABELS.ore} ${formatCompact(yardGood(state, 'ore'), 1)} · ${YARD_GOOD_LABELS.flux} ${formatCompact(yardGood(state, 'flux'), 1)} · ${YARD_GOOD_LABELS.ingot} ${formatCompact(yardGood(state, 'ingot'), 1)}`
            : 'Rebuild once to open the Yard.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Buildings run while docked. Spend Ingots to queue the next Rebuild.</p>
      ) : (
        <>
          <SheetTabs value={pane} onChange={setPane} options={YARD_PANES} label="Yard panes" />
          <div className="panel-scroll">
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
            <p className="muted">Grid expands at sector {YARD_EXPAND_SECTOR}.</p>
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
      )}
    </section>
  )
}
