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
import { getFrame } from '../../game/catalog'
import { hasProcess } from '../../game/process'
import { Battlefield } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'
import { SheetTabs } from '../SheetTabs'
import { runUpgradePreview } from '../../game/workshop'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onBuyWorkshop?: (id: RunUpgradeId) => void
  onUpgrade?: (moduleId: string) => void
  onPickMilestone?: (moduleId: string, milestoneId: string, choiceId: string) => void
  onBuyMaxCores?: () => void
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
  onUpgrade,
  onPickMilestone,
  onBuyMaxCores,
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
                : 'Spend Scrap on Cores and Workshop, then launch another Sortie from Wave 1.'}
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

      {!live ? (
        <div className="dock-hive" aria-hidden>
          <Battlefield
            playerUnits={[
              {
                id: 'dock-flag',
                side: 'player',
                name: frame?.name ?? 'Hive',
                shape: 'triangle',
                family: 'player',
                hull: combat.playerHull,
                hullMax: stats.hullMax,
                shield: combat.playerShield,
                shieldMax: stats.shieldMax,
                armor: stats.armor,
                evasion: stats.evasion,
                damageTakenMult: stats.damageTakenMult,
                weapons: [],
                isBoss: false,
                isFlagship: true,
                dots: [],
                x: 0,
                y: 0,
                speed: 0,
                engageRange: 0,
                kite: false,
                phaseWarnLeft: 0,
              },
            ]}
            enemyUnits={[]}
            projectiles={[]}
            beams={[]}
            fx={[]}
            mode="docked"
          />
        </div>
      ) : null}

      <div className="dock-section dock-loadout" data-guide="dock-cores">
        <p className="combat-hud-kicker">Loadout</p>
        <h3>Hive</h3>
        <p className="muted">
          {frame?.name ?? 'Hive Frame'} · Equip and rank Cores here with Scrap. Ranks last until
          Rebuild.
        </p>
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
        {!live && isRelicsUnlocked(state) ? (
          <p className="muted" data-guide="relic-sockets">
            {SHARDS.some((shard) => shardOwned(state, shard.id) > 0)
              ? 'Matching sockets only — Power, Shield, or Industrial. Core Mastery 5 or Wave 275 adds Universal. Spare copies upgrade I–III in Relics with Slag Ingots.'
              : 'Relic sockets are open. Recover Relics from wrecks, then install them into matching Core sockets.'}
          </p>
        ) : null}
        <CoreSheet
          state={state}
          compact
          inspectOnly={live}
          onUpgrade={onUpgrade ?? (() => undefined)}
          onPickMilestone={onPickMilestone ?? (() => undefined)}
          onBuyMax={!live && hasProcess(state, 'core-buy-max') ? onBuyMaxCores : undefined}
          onEquipRelic={live ? undefined : onEquipRelic}
          onRemoveRelic={live ? undefined : onRemoveRelic}
        />
      </div>

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
            const preview = runUpgradePreview(state, def.id)
            return (
              <article key={def.id} className={affordable ? 'upgrade-card is-affordable' : 'upgrade-card'}>
                <header className="upgrade-card-head">
                  <strong>{def.name}</strong>
                  <span className="muted">Lv {level}</span>
                </header>
                <p className="muted">{def.blurb} Resets on Rebuild.</p>
                <dl className="upgrade-card-stats">
                  <div>
                    <dt>Current</dt>
                    <dd>{preview.current}</dd>
                  </div>
                  <div>
                    <dt>Next</dt>
                    <dd>{preview.next}</dd>
                  </div>
                  <div>
                    <dt>Cost</dt>
                    <dd>{formatCompact(cost)} Scrap</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="primary"
                  disabled={!onBuyWorkshop || !affordable}
                  onClick={() => onBuyWorkshop?.(def.id)}
                >
                  Buy
                </button>
              </article>
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
          RESET Scrap, Workshop, Core ranks, and Salvage. KEEP Best Wave, unlocks, and Matter.
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
