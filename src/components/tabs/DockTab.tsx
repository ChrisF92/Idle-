import type { GameState, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { canPrestige } from '../../game/actions'
import { prestigeMinSectorFor } from '../../game/catalog'
import { formatCompact } from '../../game/format'
import { markLocalOk } from '../../hooks/useJustBecame'
import {
  RUN_UPGRADES,
  workshopCost,
  workshopLevel,
} from '../../game/workshop'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onBuyWorkshop?: (id: RunUpgradeId) => void
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
  onBuyWorkshop,
}: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const summary = combat.lastSortie
  const rebuildReady = canPrestige(state)
  const rebuildMin = prestigeMinSectorFor(state.prestige.shop)
  const dockMode = live ? 'is-live' : rebuildReady ? 'is-rebuild' : 'is-ready'
  const hullPct = meterScale(combat.playerHull, stats.hullMax)
  const shieldPct = meterScale(combat.playerShield, stats.shieldMax)
  const showWorkshop = Boolean(state.meta.hullLostOnce) && !live
  const bestWave = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)

  return (
    <section className={`panel screen-panel dock-screen ${dockMode}`}>
      <div className="panel-scroll">
      <header className="dock-hero">
        <p className="hud-chip-label">Best Wave {bestWave || '—'}</p>
        <h2>Dock</h2>
        <p className="muted">
          {live
            ? 'Sortie live. Combat continues while you are here.'
            : rebuildReady
              ? 'Hull is docked. Rebuild hangar is ready.'
              : !summary.outcome
                ? 'Your Hive is ready. Launch a Sortie — every run starts at Wave 1.'
                : 'Spend Scrap in Workshop, then launch another Sortie from Wave 1.'}
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
          Battlefield · W{combat.wave}
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
          Launch Sortie
        </button>
      )}

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

      {showWorkshop ? (
        <div className="dock-workshop" data-guide="workshop">
          <p className="combat-hud-kicker">Workshop</p>
          <h3>Starting power</h3>
          <p className="muted">Scrap survives Sorties. These levels reset on Rebuild.</p>
          {RUN_UPGRADES.filter((def) => bestWave >= def.minBestWave || def.minBestWave === 0).map(
            (def) => {
              const level = workshopLevel(state, def.id)
              const cost = workshopCost(level)
              const affordable = state.resources.scrap >= cost
              return (
                <button
                  key={def.id}
                  type="button"
                  className={affordable ? 'network-row is-affordable' : 'network-row'}
                  disabled={!onBuyWorkshop || !affordable}
                  onClick={() => onBuyWorkshop?.(def.id)}
                >
                  <span>
                    <strong>{def.name}</strong>
                    <span className="muted"> Lv {level} → {level + 1}</span>
                  </span>
                  <strong>{formatCompact(cost)} Scrap</strong>
                </button>
              )
            },
          )}
        </div>
      ) : null}

      {summary.outcome ? (
        <div className="dock-summary">
          <p className="dock-summary-title">
            SORTIE COMPLETE · Wave {summary.wave}
            {summary.newBest ? ' · New Best' : ''}
          </p>
          <div className="stat-row dock-stats">
            <div>
              <span className="muted">Scrap</span>
              <strong>+{formatCompact(summary.scrapEarned)}</strong>
            </div>
            <div>
              <span className="muted">Salvage</span>
              <strong>+{formatCompact(summary.salvageGained)}</strong>
            </div>
            <div>
              <span className="muted">Kills</span>
              <strong>{formatCompact(summary.stats.kills)}</strong>
            </div>
          </div>
          {summary.note ? <p className="muted dock-last">{summary.note}</p> : null}
        </div>
      ) : (
        <p className="muted dock-last dock-empty">No sortie yet</p>
      )}
      </div>
    </section>
  )
}
