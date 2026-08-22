import { useState } from 'react'
import type { GameState, ModuleRole, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats, RESOURCE_LABELS } from '../../game/state'
import { canPrestige, prestigeGainFor } from '../../game/actions'
import { canOpenRebuildHangar, rebuildCycle, rebuildWaveNeed, workshopInvestment } from '../../game/rebuild'
import { formatCompact } from '../../game/format'
import { markLocalOk } from '../../hooks/useJustBecame'
import { type BuyMode } from '../../game/workshop'
import { isRelicsUnlocked, SHARDS, shardOwned } from '../../game/reliquary'
import { getFrame, getModule } from '../../game/catalog'
import { hasProcess } from '../../game/process'
import { CoreSheet } from '../CoreSheet'
import { SheetTabs } from '../SheetTabs'
import { HiveRig, type HiveRigTarget } from '../HiveRig'
import { CoreDetailSheet, CorePicker, FrameSheet } from '../LoadoutSheets'
import { BuyModeRow, UpgradeGrid } from '../UpgradeGrid'
import { coreDps, coreShieldOutput, permanentMultipliers } from '../../game/uiReadout'

export type DockPane = 'loadout' | 'workshop' | 'rebuild'

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onBuyWorkshop?: (id: RunUpgradeId, count?: number) => void
  onUpgrade?: (moduleId: string) => void
  onPickMilestone?: (moduleId: string, milestoneId: string, choiceId: string) => void
  onBuyMaxCores?: () => void
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, relicId?: string, socketIndex?: number) => void
  onSelectFrame?: (frameId: string) => void
  onFitCore?: (moduleId: string) => void
  onUnfitCore?: (moduleId: string) => void
  pane?: DockPane
  onPaneChange?: (pane: DockPane) => void
  focusModuleId?: string | null
}

const DOCK_PANES: { id: DockPane; label: string; guide?: string }[] = [
  { id: 'loadout', label: 'Loadout', guide: 'dock-cores' },
  { id: 'workshop', label: 'Workshop', guide: 'workshop' },
  { id: 'rebuild', label: 'Rebuild' },
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
  onSelectFrame,
  onFitCore,
  onUnfitCore,
  pane: paneProp,
  onPaneChange,
  focusModuleId,
}: DockTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const live = !combat.docked
  const rebuildReady = canPrestige(state)
  const hangarOpen = canOpenRebuildHangar(state)
  const rebuildMin = rebuildWaveNeed(state)
  const showWorkshop = Boolean(state.meta.hullLostOnce)
  const bestWave = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)
  const cycleNo = (state.prestige.prestigeCount ?? 0) + 1
  const cycle = rebuildCycle(state)
  const frame = getFrame(state.shipyard.frameId)
  const matter = state.resources.prestigeMatter ?? 0
  const [localPane, setLocalPane] = useState<DockPane>('loadout')
  const pane = paneProp ?? localPane
  const setPane = (next: DockPane) => {
    if (!showWorkshop && next === 'workshop') return
    setLocalPane(next)
    onPaneChange?.(next)
  }
  const [workshopCat, setWorkshopCat] = useState<RunUpgradeCategory>('attack')
  const [buyMode, setBuyMode] = useState<BuyMode>(1)
  const [frameOpen, setFrameOpen] = useState(false)
  const [coreDetail, setCoreDetail] = useState<string | null>(focusModuleId ?? null)
  const [picker, setPicker] = useState<{ replaceId?: string; role?: ModuleRole } | null>(null)
  const locked = live
  const perm = permanentMultipliers(state)

  function onHive(target: HiveRigTarget) {
    if (target.kind === 'hive') setFrameOpen(true)
    if (target.kind === 'core') setCoreDetail(target.moduleId)
    if (target.kind === 'slot') setPicker({ role: target.role })
  }

  function fitReplacement(moduleId: string) {
    if (picker?.replaceId && picker.replaceId !== moduleId) onUnfitCore?.(picker.replaceId)
    onFitCore?.(moduleId)
    setPicker(null)
    setCoreDetail(null)
  }

  return (
    <section className="panel screen-panel dock-screen is-tabbed">
      <div className="dock-summary-head">
        <div className="dock-meta-line">
          <span>
            Best Wave <strong>W{bestWave || '—'}</strong>
          </span>
          <span>
            CYCLE <strong>{cycleNo}</strong>
          </span>
        </div>
        <div className="dock-meta-line">
          <span>
            Scrap <strong>{formatCompact(state.resources.scrap)}</strong>
          </span>
          <span>
            Matter <strong>{formatCompact(matter)}</strong>
          </span>
        </div>
        <HiveRig state={state} compact interactive={!locked} onSelect={onHive} />
        <div className="dock-hive-readout">
          <strong>
            {frame?.name ?? 'Hive'} · {state.shipyard.modules.length}/
            {(frame?.weaponSlots ?? 0) + (frame?.defenseSlots ?? 0) + (frame?.utilitySlots ?? 0)} CORES
          </strong>
          <p>
            DPS {formatCompact(stats.damage)} · Hull {formatCompact(stats.hullMax)} · Sh{' '}
            {formatCompact(stats.shieldMax)}
          </p>
        </div>
        <div className="a11y-loadout">
          <button type="button" onClick={() => setFrameOpen(true)}>
            Frame
          </button>
          {state.shipyard.modules.map((id) => (
            <button key={id} type="button" onClick={() => setCoreDetail(id)}>
              {getModule(id)?.name ?? id}
            </button>
          ))}
        </div>
      </div>

      <SheetTabs
        value={pane}
        onChange={setPane}
        options={showWorkshop ? DOCK_PANES : DOCK_PANES.filter((p) => p.id !== 'workshop')}
        label="Dock sections"
      />

      <div className="dock-pane">
        {pane === 'loadout' ? (
          <div className="dock-loadout" data-guide="dock-cores">
            <p className="muted">Equip and rank Cores here with Scrap — those ranks last until Rebuild.</p>
            {locked ? <p className="muted">Loadout is locked until this Sortie docks.</p> : null}
            {!locked && isRelicsUnlocked(state) ? (
              <p className="muted" data-guide="relic-sockets">
                {SHARDS.some((shard) => shardOwned(state, shard.id) > 0)
                  ? 'Matching sockets only — Power, Shield, or Industrial.'
                  : 'Relic sockets are open. Recover Relics from wrecks, then install them into matching Core sockets.'}
              </p>
            ) : null}
            <CoreSheet
              state={state}
              compact
              inspectOnly={locked}
              onUpgrade={onUpgrade ?? (() => undefined)}
              onPickMilestone={onPickMilestone ?? (() => undefined)}
              onBuyMax={!locked && hasProcess(state, 'core-buy-max') ? onBuyMaxCores : undefined}
              onEquipRelic={locked ? undefined : onEquipRelic}
              onRemoveRelic={locked ? undefined : onRemoveRelic}
            />
          </div>
        ) : null}

        {pane === 'workshop' && showWorkshop ? (
          <div className="dock-workshop" data-guide="workshop">
            <p className="dock-scrap-balance">
              {RESOURCE_LABELS.scrap} <strong>{formatCompact(state.resources.scrap)}</strong>
            </p>
            {locked ? <p className="muted">Workshop buys wait until Dock.</p> : null}
            <SheetTabs
              value={workshopCat}
              onChange={setWorkshopCat}
              options={[
                { id: 'attack', label: 'Attack' },
                { id: 'defense', label: 'Defense' },
                { id: 'economy', label: 'Economy' },
              ]}
              label="Workshop categories"
            />
            <BuyModeRow state={state} value={buyMode} onChange={setBuyMode} />
            <UpgradeGrid
              state={state}
              category={workshopCat}
              kind="workshop"
              buyMode={buyMode}
              onBuy={locked ? undefined : (id, count) => onBuyWorkshop?.(id, count)}
            />
          </div>
        ) : null}

        {pane === 'rebuild' ? (
          <div className="dock-rebuild-dash">
            <p className="combat-hud-kicker">Rebuild</p>
            <dl className="upgrade-card-stats">
              <div>
                <dt>Cycle Best</dt>
                <dd>W{cycle.bestWave || bestWave || '—'}</dd>
              </div>
              <div>
                <dt>Sorties</dt>
                <dd>{cycle.sorties}</dd>
              </div>
              <div>
                <dt>Workshop ranks</dt>
                <dd>{workshopInvestment(state)}</dd>
              </div>
              <div>
                <dt>Scrap generated</dt>
                <dd>{formatCompact(cycle.scrapEarned)}</dd>
              </div>
            </dl>
            {rebuildReady ? (
              <p>
                Matter if Rebuilt <strong>+{formatCompact(prestigeGainFor(state))}</strong>
              </p>
            ) : (
              <p className="muted">
                {(state.prestige.prestigeCount ?? 0) > 0
                  ? `Need Wave ${rebuildMin} this cycle.`
                  : `Reach Wave ${rebuildMin} and finish ${3} Sorties.`}
              </p>
            )}
            <p className="muted">
              Permanent · Damage ×{perm.damage.toFixed(1)} · Defense ×{perm.defense.toFixed(1)} · Industry ×
              {perm.industry.toFixed(1)}
            </p>
            <button
              type="button"
              className="primary"
              data-guide="rebuild-btn"
              disabled={!hangarOpen}
              onClick={(e) => {
                markLocalOk(e.currentTarget)
                onRebuild()
              }}
            >
              {rebuildReady
                ? 'Preview Rebuild'
                : (state.prestige.prestigeCount ?? 0) > 0
                  ? 'Matter upgrades'
                  : `Rebuild · Wave ${rebuildMin}`}
            </button>
          </div>
        ) : null}
      </div>

      {live ? (
        <button type="button" className="primary dock-cta" onClick={onOpenSortie}>
          <span className="live-pip" aria-hidden />
          Return to Sortie · W{combat.wave}
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

      {frameOpen ? (
        <FrameSheet
          state={state}
          locked={locked}
          onEquip={(id) => {
            onSelectFrame?.(id)
            setFrameOpen(false)
          }}
          onClose={() => setFrameOpen(false)}
        />
      ) : null}
      {coreDetail ? (
        <CoreDetailSheet
          state={state}
          moduleId={coreDetail}
          locked={locked}
          onChange={() => setPicker({ replaceId: coreDetail, role: getModule(coreDetail)?.role })}
          onClose={() => setCoreDetail(null)}
        />
      ) : null}
      {picker ? (
        <CorePicker
          state={state}
          replaceId={picker.replaceId}
          role={picker.role}
          locked={locked}
          onEquip={fitReplacement}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </section>
  )
}
