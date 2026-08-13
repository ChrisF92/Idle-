import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { wavesForSector } from '../../game/sectors'
import { canPrestige } from '../../game/actions'
import { prestigeMinSectorFor } from '../../game/catalog'
import { formatCompact } from '../../game/format'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
}

export function DockTab({ state, onLaunch, onOpenSortie, onRebuild }: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const waves = wavesForSector(combat.sector)
  const summary = combat.lastSortie
  const rebuildReady = canPrestige(state)
  const rebuildMin = prestigeMinSectorFor(state.prestige.shop)

  return (
    <section className="panel screen-panel dock-screen">
      <header className="dock-hero">
        <p className="hud-chip-label">Sector {combat.sector}</p>
        <h2>Dock</h2>
      </header>

      <div className="stat-row dock-stats">
        <div>
          <span className="muted">Hull</span>
          <strong>
            {Math.ceil(combat.playerHull)}/{Math.ceil(stats.hullMax)}
          </strong>
        </div>
        <div>
          <span className="muted">Shield</span>
          <strong>
            {Math.ceil(combat.playerShield)}/{Math.ceil(stats.shieldMax)}
          </strong>
        </div>
        <div>
          <span className="muted">DPS</span>
          <strong>{formatCompact(stats.damage)}</strong>
        </div>
      </div>

      {live ? (
        <button type="button" className="primary dock-cta" onClick={onOpenSortie}>
          Battlefield · S{combat.sector} W{combat.wave}/{waves}
        </button>
      ) : (
        <button type="button" className="primary dock-cta" data-guide="launch" onClick={onLaunch}>
          Launch sortie
        </button>
      )}

      <button type="button" className="dock-rebuild" disabled={!rebuildReady} onClick={onRebuild}>
        {rebuildReady ? 'Rebuild hangar' : `Rebuild · sector ${rebuildMin}`}
      </button>

      <p className="muted dock-last">
        {summary.outcome
          ? `Last: ${summary.outcome === 'defeat' ? 'Defeat' : 'Extract'} S${summary.sector} W${summary.wave}`
          : 'No sortie yet'}
      </p>
    </section>
  )
}
