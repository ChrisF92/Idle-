import { useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats, RESOURCE_LABELS } from '../../game/state'
import { canPrestige, prestigeGainFor } from '../../game/actions'
import { canOpenRebuildHangar, rebuildCycle, rebuildWaveNeed } from '../../game/rebuild'
import { formatCompact } from '../../game/format'
import { markLocalOk } from '../../hooks/useJustBecame'
import {
  visibleRunUpgrades,
  workshopCost,
  workshopLevel,
} from '../../game/workshop'
import { isRelicsUnlocked, SHARDS, shardOwned } from '../../game/reliquary'
import { getFrame, getModule, moduleLevel, moduleMasteryRank } from '../../game/catalog'
import { CoreSheet } from '../CoreSheet'
import { SheetTabs } from '../SheetTabs'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onBuyWorkshop?: (id: RunUpgradeId) => void
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
}

function meterScale(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(1, current / max))
}

const WORKSHOP_PANES: { id: RunUpgradeCategory; label: string }[] = [
  { id: 'attack', label: 'Attack' },
  { id: 'defense', label: 'Defense' },
  { id: 'economy', label: 'Economy' },
]

export function DockTab({
  state,
  onLaunch,
  onOpenSortie,
  onRebuild,
  onBuyWorkshop,
  onEquipRelic,
  onRemoveRelic,
}: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const summary = combat.lastSortie
  const rebuildReady = canPrestige(state)
  const hangarOpen = canOpenRebuildHangar(state)
  const rebuildMin = rebuildWaveNeed(state)
  const dockMode = live ? 'is-live' : rebuildReady ? 'is-rebuild' : 'is-ready'
  const hullPct = meterScale(combat.playerHull, stats.hullMax)
  const shieldPct = meterScale(combat.playerShield, stats.shieldMax)
  const showWorkshop = Boolean(state.meta.hullLostOnce) && !live
  const bestWave = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)
  const cycleNo = (state.prestige.prestigeCount ?? 0) + 1
  const cycle = rebuildCycle(state)
  const frame = getFrame(state.shipyard.frameId)
  const matter = state.resources.prestigeMatter ?? 0
  const [workshopCat, setWorkshopCat] = useState<RunUpgradeCategory>('attack')

  return (
    <section className={`panel screen-panel dock-screen ${dockMode}`}>
      <div className="panel-scroll">
      <header className="dock-hero">
        <p className="hud-chip-label">Dock</p>
        <h2>Hive ready</h2>
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
          <span className="muted">Best Wave</span>
          <strong>{bestWave || '—'}</strong>
        </div>
        <div>
          <span className="muted">Cycle</span>
          <strong>{cycleNo}</strong>
        </div>
        <div>
          <span className="muted">{RESOURCE_LABELS.scrap}</span>
          <strong>{formatCompact(state.resources.scrap)}</strong>
        </div>
        <div>
          <span className="muted">Matter</span>
          <strong>{formatCompact(matter)}</strong>
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

      <div className="dock-section dock-loadout">
        <p className="combat-hud-kicker">Loadout</p>
        <h3>Hive</h3>
        <p className="muted">{frame?.name ?? 'Hive Frame'} · rank Cores on Sortie.</p>
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
        <ul className="dock-core-list">
          {state.shipyard.modules.map((id) => {
            const mod = getModule(id)
            const run = moduleLevel(state.shipyard.moduleLevels, id)
            const mastery = moduleMasteryRank(state, id)
            return (
              <li key={id}>
                <strong>{mod?.name ?? id}</strong>
                <span className="muted">
                  {' '}
                  Lv {run}
                  {mastery > 0 ? ` · Mastery ${mastery}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {!live && isRelicsUnlocked(state) ? (
        <div className="dock-relics" data-guide="relic-sockets">
          <p className="combat-hud-kicker">Loadout</p>
          <h3>Relics</h3>
          <p className="muted">
            {SHARDS.some((shard) => shardOwned(state, shard.id) > 0)
              ? 'Matching sockets only — Power, Shield, or Industrial. Core Mastery 5 adds Universal. Spare copies upgrade I–III in Relics with Slag Ingots.'
              : 'Relic sockets are open. Recover Relics from wrecks, then install them into matching Core sockets.'}
          </p>
          <CoreSheet
            state={state}
            compact
            relicsOnly
            onUpgrade={() => undefined}
            onPickMilestone={() => undefined}
            onEquipRelic={onEquipRelic}
            onRemoveRelic={onRemoveRelic}
          />
        </div>
      ) : null}

      {showWorkshop ? (
        <div className="dock-workshop" data-guide="workshop">
          <p className="combat-hud-kicker">Workshop</p>
          <h3>Starting power</h3>
          <p className="muted">Scrap survives Sorties. These levels reset on Rebuild.</p>
          <SheetTabs
            value={workshopCat}
            onChange={setWorkshopCat}
            options={WORKSHOP_PANES}
            label="Workshop categories"
          />
          {visibleRunUpgrades(bestWave, workshopCat).map((def) => {
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
          })}
          {visibleRunUpgrades(bestWave, workshopCat).length === 0 ? (
            <p className="muted">More {workshopCat} ranks open as Best Wave climbs.</p>
          ) : null}
        </div>
      ) : null}

      <div className="dock-section dock-rebuild-block">
        <p className="combat-hud-kicker">Rebuild</p>
        <h3>Cycle {cycleNo}</h3>
        <p className="muted">
          This cycle: Best Wave {cycle.bestWave || bestWave || '—'} · {cycle.sorties} sortie
          {cycle.sorties === 1 ? '' : 's'} · {formatCompact(cycle.scrapEarned)} Scrap generated.
        </p>
        <p className="muted">
          RESET Scrap, Workshop, and Salvage. KEEP Best Wave, unlocks, and Matter.
          {rebuildReady ? ` GAIN +${formatCompact(prestigeGainFor(state))} Matter.` : ''}
        </p>
        <button
          type="button"
          className="dock-rebuild"
          data-guide="rebuild-btn"
          disabled={!hangarOpen}
          onClick={(e) => {
            markLocalOk(e.currentTarget)
            onRebuild()
          }}
        >
          {rebuildReady
            ? 'Rebuild hangar'
            : (state.prestige.prestigeCount ?? 0) > 0
              ? 'Matter shop'
              : `Rebuild · Wave ${rebuildMin}`}
        </button>
      </div>

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
