import type { GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { canPrestige } from '../../game/actions'
import { prestigeMinSectorFor } from '../../game/catalog'
import { formatCompact } from '../../game/format'
import { careerHighestSector } from '../../game/progression'
import {
  isRouteBUnlocked,
  maxLaunchSector,
  normalizeRoute,
  wavesForSector,
} from '../../game/sectors'
import { getEchoRun } from '../../game/echo'
import { activeProtocol } from '../../game/protocols'
import { markLocalOk } from '../../hooks/useJustBecame'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onSetSector?: (sector: number) => void
  onSetRoute?: (route: 'A' | 'B') => void
}

function meterScale(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(1, current / max))
}

export function DockTab({
  state,
  onLaunch,
  onOpenSortie,
  onRebuild,
  onSetSector,
  onSetRoute,
}: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const waves = wavesForSector(combat.sector)
  const summary = combat.lastSortie
  const rebuildReady = canPrestige(state)
  const rebuildMin = prestigeMinSectorFor(state.prestige.shop)
  const cleared = careerHighestSector(state)
  const maxStart = maxLaunchSector(cleared)
  const routeB = isRouteBUnlocked(cleared)
  const route = normalizeRoute(combat.route)
  const protocol = activeProtocol(state)
  const echoRun = state.echo?.activeId ? getEchoRun(state.echo.activeId) : undefined
  const specialRun = Boolean(protocol || echoRun)
  const dockMode = live ? 'is-live' : rebuildReady ? 'is-rebuild' : 'is-ready'
  const hullPct = meterScale(combat.playerHull, stats.hullMax)
  const shieldPct = meterScale(combat.playerShield, stats.shieldMax)

  return (
    <section className={`panel screen-panel dock-screen ${dockMode}`}>
      <header className="dock-hero">
        <p className="hud-chip-label">
          Sector {combat.sector}
          {routeB ? (combat.route === 'B' ? 'B' : 'A') : ''}
        </p>
        <h2>Dock</h2>
        <p className="muted">
          {live
            ? 'Sortie live. Hold or Advance from the battlefield.'
            : rebuildReady
              ? 'Hull is docked. Rebuild hangar is ready.'
              : !summary.outcome
                ? 'Your Scout is ready. Launch a sortie and see how far it gets.'
                : 'Spend Salvage on Cores, then launch again.'}
        </p>
      </header>

      <div className="stat-row dock-stats">
        <div>
          <span className="muted">Hull</span>
          <strong>
            {Math.ceil(combat.playerHull)}/{Math.ceil(stats.hullMax)}
          </strong>
          <span className="dock-stat-meter hull" aria-hidden>
            <span style={{ transform: `scaleX(${hullPct})` }} />
          </span>
        </div>
        <div>
          <span className="muted">Shield</span>
          <strong>
            {Math.ceil(combat.playerShield)}/{Math.ceil(stats.shieldMax)}
          </strong>
          <span className="dock-stat-meter shield" aria-hidden>
            <span style={{ transform: `scaleX(${shieldPct})` }} />
          </span>
        </div>
        <div>
          <span className="muted">DPS</span>
          <strong>{formatCompact(stats.damage)}</strong>
        </div>
      </div>

      {live ? (
        <button type="button" className="primary dock-cta" onClick={onOpenSortie}>
          <span className="live-pip" aria-hidden />
          Battlefield · S{combat.sector} W{combat.wave}/{waves}
        </button>
      ) : (
        <button
          type="button"
          className="primary dock-cta"
          data-guide="launch"
          onClick={(e) => {
            markLocalOk(e.currentTarget)
            onLaunch()
          }}
        >
          {echoRun ? `Launch ${echoRun.name}` : protocol ? `Launch ${protocol.name}` : 'Launch Sortie'}
        </button>
      )}

      {!live && onSetSector && maxStart > 1 && !specialRun ? (
        <p className="assign-row dock-launch-row">
          <button
            type="button"
            disabled={combat.sector <= 1}
            onClick={() => onSetSector(combat.sector - 1)}
          >
            −
          </button>
          <span className="muted">Start S{combat.sector}</span>
          <button
            type="button"
            disabled={combat.sector >= maxStart}
            onClick={() => onSetSector(combat.sector + 1)}
          >
            +
          </button>
        </p>
      ) : null}

      {!live && onSetRoute && routeB && !specialRun ? (
        <div className="sheet-tabs notation-tabs">
          <button
            type="button"
            className={route !== 'B' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => onSetRoute('A')}
          >
            Route A
          </button>
          <button
            type="button"
            className={route === 'B' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => onSetRoute('B')}
          >
            Route B
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="dock-rebuild"
        data-guide="rebuild-btn"
        disabled={!rebuildReady}
        onClick={(e) => {
          markLocalOk(e.currentTarget)
          onRebuild()
        }}
      >
        {rebuildReady ? 'Rebuild hangar' : `Rebuild · sector ${rebuildMin}`}
      </button>

      {summary.outcome ? (
        <div className="dock-summary">
          <p className="dock-summary-title">
            {summary.outcome === 'defeat' ? 'Defeat' : 'Run'} · S{summary.sector} W
            {summary.wave}
          </p>
          <div className="stat-row dock-stats">
            <div>
              <span className="muted">Sectors</span>
              <strong>{summary.sectorsCleared}</strong>
            </div>
            <div>
              <span className="muted">Salvage</span>
              <strong>+{formatCompact(summary.salvageGained)}</strong>
            </div>
            <div>
              <span className="muted">Spent</span>
              <strong>{formatCompact(summary.salvageSpent)}</strong>
            </div>
          </div>
          <div className="stat-row dock-stats">
            <div>
              <span className="muted">Milestones</span>
              <strong>{summary.milestones}</strong>
            </div>
            <div>
              <span className="muted">Research</span>
              <strong>+{formatCompact(summary.researchXp)}</strong>
            </div>
            <div>
              <span className="muted">Network</span>
              <strong>+{summary.networkLevels}</strong>
            </div>
          </div>
          {summary.note ? <p className="muted dock-last">{summary.note}</p> : null}
        </div>
      ) : (
        <p className="muted dock-last dock-empty">No sortie yet</p>
      )}
    </section>
  )
}
