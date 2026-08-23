import { useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { canPrestige, prestigeGainFor } from '../../game/actions'
import { canOpenRebuildHangar, rebuildCycle, rebuildWaveNeed, REBUILD_MIN_SORTIES } from '../../game/rebuild'
import { formatCompact } from '../../game/format'
import { markLocalOk } from '../../hooks/useJustBecame'
import { type BuyMode } from '../../game/workshop'
import { isRelicsUnlocked } from '../../game/reliquary'
import { type ModuleRole, getFrame, getModule, moduleMasteryRank } from '../../game/catalog'
import { SheetTabs } from '../SheetTabs'
import { HiveRig, type HiveRigTarget } from '../HiveRig'
import { CoreDetailSheet, CorePicker, FrameSheet } from '../LoadoutSheets'
import { BuyModeRow, UpgradeGrid } from '../UpgradeGrid'
import { frameBlurb, loadoutRelicFill } from '../../game/inventory'
import {
  ContextBar,
  ItemRow,
  Screen,
  Section,
  SectionHeader,
  StatPair,
  StickyAction,
} from '../../ui/primitives'

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
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
  onSelectFrame?: (frameId: string) => void
  onFitCore?: (moduleId: string) => void
  onUnfitCore?: (moduleId: string) => void
  onOpenInventory?: () => void
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
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
  onSelectFrame,
  onFitCore,
  onUnfitCore,
  onOpenInventory,
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
  const slots = (frame?.weaponSlots ?? 0) + (frame?.defenseSlots ?? 0) + (frame?.utilitySlots ?? 0)
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
  const relics = loadoutRelicFill(state)

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
    <Screen className="dock-screen is-tabbed" sticky label="Dock">
      <ContextBar>
        <StatPair label="Best Wave" value={bestWave ? `W${bestWave}` : '—'} />
        <StatPair label="Cycle" value={cycleNo} />
        {onOpenInventory ? (
          <button type="button" className="dock-inventory-btn" aria-label="Inventory" onClick={onOpenInventory}>
            Inventory
          </button>
        ) : null}
      </ContextBar>

      <div className="dock-hive-block">
        <HiveRig state={state} compact interactive={!locked} onSelect={onHive} />
        <p className="dock-hive-frame">
          <strong>{frame?.name ?? 'Hive'}</strong>
          <span className="ui-meta">
            {state.shipyard.modules.length}/{slots} Cores
          </span>
        </p>
        <div className="dock-glance">
          <StatPair label="DPS" value={formatCompact(stats.damage)} />
          <StatPair label="Hull" value={formatCompact(stats.hullMax)} />
          <StatPair label="Shield" value={formatCompact(stats.shieldMax)} />
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
            {locked ? <p className="ui-meta">Loadout is locked until this Sortie docks.</p> : null}
            <Section>
              <SectionHeader title="Frame" />
              <ItemRow
                title={frame?.name ?? 'Hive'}
                meta={frameBlurb(state)}
                onClick={() => setFrameOpen(true)}
              />
            </Section>
            <Section>
              <SectionHeader title="Cores" />
              {state.shipyard.modules.map((id) => {
                const def = getModule(id)
                return (
                  <ItemRow
                    key={id}
                    title={def?.name ?? id}
                    meta={`${def?.role === 'weapon' ? 'Weapon' : def?.role === 'defense' ? 'Defense' : 'Utility'} · M${moduleMasteryRank(state, id)}`}
                    guide={`core-${id}`}
                    onClick={() => setCoreDetail(id)}
                  />
                )
              })}
            </Section>
            <Section>
              <SectionHeader title="Relics" />
              <ItemRow
                title={isRelicsUnlocked(state) ? 'Sockets' : 'Locked'}
                meta={
                  isRelicsUnlocked(state)
                    ? `${relics.filled} / ${relics.sockets || '—'} filled`
                    : 'Opens with Relic sockets'
                }
                guide="relic-sockets"
                onClick={() => {
                  const first = state.shipyard.modules[0]
                  if (first) setCoreDetail(first)
                }}
              />
            </Section>
          </div>
        ) : null}

        {pane === 'workshop' && showWorkshop ? (
          <div className="dock-workshop" data-guide="workshop">
            {locked ? <p className="ui-meta">Workshop buys wait until Dock.</p> : null}
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
            <SectionHeader title="Rebuild" />
            <div className="dock-glance">
              <StatPair label="Cycle Best" value={cycle.bestWave || bestWave ? `W${cycle.bestWave || bestWave}` : '—'} />
              <StatPair
                label="Requirement"
                value={
                  (state.prestige.prestigeCount ?? 0) > 0
                    ? `Reach W${rebuildMin}`
                    : `W${rebuildMin}`
                }
              />
            </div>
            <p className="ui-meta">
              {(state.prestige.prestigeCount ?? 0) > 0
                ? `${cycle.sorties} Sortie${cycle.sorties === 1 ? '' : 's'} this cycle`
                : `${cycle.sorties} / ${REBUILD_MIN_SORTIES} Sorties completed`}
            </p>
            <StatPair
              label="Projected Matter"
              value={rebuildReady ? formatCompact(prestigeGainFor(state)) : '0'}
            />
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
              Preview Rebuild
            </button>
          </div>
        ) : null}
      </div>

      <StickyAction guide={live ? undefined : 'launch'}>
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
      </StickyAction>

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
          onEquipRelic={locked ? undefined : onEquipRelic}
          onRemoveRelic={locked ? undefined : onRemoveRelic}
          onUpgradeRelic={locked ? undefined : onUpgradeRelic}
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
    </Screen>
  )
}
