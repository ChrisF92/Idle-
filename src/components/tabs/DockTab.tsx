import { useEffect, useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { canPrestige, prestigeGainFor } from '../../game/actions'
import { canOpenRebuildHangar, rebuildWaveNeed } from '../../game/rebuild'
import { formatCompact } from '../../game/format'
import { markLocalOk } from '../../hooks/useJustBecame'
import { type BuyMode } from '../../game/workshop'
import { type ModuleRole, frameRoleCap, getFrame, getModule, moduleMasteryRank } from '../../game/catalog'
import { hiveResearchExtraUtilitySlots } from '../../game/hiveResearch'
import { isSystemUnlocked } from '../../game/progression'
import { SheetTabs } from '../SheetTabs'
import { CoreDetailSheet, CorePicker, FrameSheet } from '../LoadoutSheets'
import { BuyModeRow, UpgradeGrid } from '../UpgradeGrid'
import { frameBlurb } from '../../game/inventory'
import { ResourceBar } from '../ResourceBar'
import { DockHivePreview } from '../DockHivePreview'
import { MatterShopSheet } from '../RebuildHangar'
import {
  ContextBar,
  ItemRow,
  Screen,
  Section,
  SectionHeader,
  StatPair,
  StickyAction,
} from '../../ui/primitives'
import { coreInstanceAtSlot, coreInstanceCopyNumber } from '../../game/coreInstances'
import { coreStartingLevel } from '../../game/coreProgression'

export type DockPane = 'home' | 'loadout' | 'workshop' | 'rebuild'

const LOADOUT_ROLE_ORDER: ModuleRole[] = ['weapon', 'defense', 'utility']
const LOADOUT_ROLE_LABEL: Record<ModuleRole, string> = {
  weapon: 'Attack',
  defense: 'Defense',
  utility: 'Utility',
}

interface DockTabProps {
  state: GameState
  onLaunch: () => void
  onOpenSortie: () => void
  onRebuild: () => void
  onBuyWorkshop?: (id: RunUpgradeId, count?: number) => void
  onBuyMatter?: (itemId: string) => void
  onUpgrade?: (moduleId: string) => void
  onPickMilestone?: (moduleId: string, milestoneId: string, choiceId: string) => void
  onBuyMaxCores?: () => void
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
  onUpgradeRelic?: (relicId: string) => void
  onSelectFrame?: (frameId: string) => void
  onFitCore?: (moduleId: string, coreInstanceId?: string) => void
  onUnfitCore?: (moduleId: string, coreInstanceId?: string) => void
  onUpgradeCore?: (coreInstanceId: string, count?: number) => void
  onOpenInventory?: () => void
  pane?: DockPane
  onPaneChange?: (pane: DockPane) => void
  focusModuleId?: string | null
}

export function DockTab({
  state,
  onLaunch,
  onOpenSortie,
  onRebuild,
  onBuyWorkshop,
  onBuyMatter,
  onEquipRelic,
  onRemoveRelic,
  onUpgradeRelic,
  onSelectFrame,
  onFitCore,
  onUnfitCore,
  onUpgradeCore,
  onOpenInventory,
  pane: paneProp,
  onPaneChange,
  focusModuleId,
}: DockTabProps) {
  const { combat } = state
  const live = !combat.docked
  const rebuildReady = canPrestige(state)
  const hangarOpen = canOpenRebuildHangar(state)
  const rebuildMin = rebuildWaveNeed(state)
  const showWorkshop = Boolean(state.meta.hullLostOnce)
  const bestWave = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)
  const cycleNo = (state.prestige.prestigeCount ?? 0) + 1
  const frame = getFrame(state.shipyard.frameId)
  const fittedCores = state.shipyard.modules.map((moduleId, slot) => ({
    moduleId,
    coreInstanceId: coreInstanceAtSlot(state, slot)?.id,
    role: getModule(moduleId)?.role,
  }))
  const loadoutSlots = frame
    ? LOADOUT_ROLE_ORDER.flatMap((role) => {
        const modules = fittedCores.filter((core) => core.role === role)
        const capacity = frameRoleCap(frame, role, { utility: hiveResearchExtraUtilitySlots(state) })
        return Array.from({ length: capacity }, (_, index) => ({
          role,
          moduleId: modules[index]?.moduleId,
          coreInstanceId: modules[index]?.coreInstanceId,
        }))
      })
    : []
  const [localPane, setLocalPane] = useState<DockPane>('home')
  const pane = paneProp ?? localPane
  const setPane = (next: DockPane) => {
    if (!showWorkshop && next === 'workshop') return
    setLocalPane(next)
    onPaneChange?.(next)
  }
  const [workshopCat, setWorkshopCat] = useState<RunUpgradeCategory>('attack')
  const [buyMode, setBuyMode] = useState<BuyMode>(1)
  const [frameOpen, setFrameOpen] = useState(false)
  const focusSlot = focusModuleId ? state.shipyard.modules.indexOf(focusModuleId) : -1
  const focusedCoreInstanceId = coreInstanceAtSlot(state, focusSlot)?.id
  const [coreDetail, setCoreDetail] = useState<{
    moduleId: string
    coreInstanceId?: string
  } | null>(
    focusModuleId
      ? { moduleId: focusModuleId, coreInstanceId: focusedCoreInstanceId }
      : null,
  )
  const [picker, setPicker] = useState<{
    replaceId?: string
    replaceCoreInstanceId?: string
    role?: ModuleRole
  } | null>(null)
  const [matterShopOpen, setMatterShopOpen] = useState(false)
  const locked = live
  const matterShopAvailable =
    isSystemUnlocked(state, 'slag') || (state.resources.prestigeMatter ?? 0) > 0

  useEffect(() => {
    if (!focusModuleId) return
    setLocalPane('loadout')
    onPaneChange?.('loadout')
    setCoreDetail({
      moduleId: focusModuleId,
      coreInstanceId: focusedCoreInstanceId,
    })
  }, [focusModuleId, focusedCoreInstanceId, onPaneChange])

  function fitReplacement(moduleId: string, coreInstanceId: string) {
    if (picker?.replaceId) {
      onUnfitCore?.(picker.replaceId, picker.replaceCoreInstanceId)
    }
    onFitCore?.(moduleId, coreInstanceId)
    setPicker(null)
    setCoreDetail(null)
  }

  return (
    <Screen className="dock-screen is-tabbed" sticky label="Dock">
      <div className="dock-screen-head">
        <ContextBar>
          {pane === 'home' ? (
            <StatPair label="Best Wave" value={bestWave ? `W${bestWave}` : '—'} />
          ) : (
            <button type="button" className="dock-back-btn" onClick={() => setPane('home')}>
              Dock
            </button>
          )}
          {pane === 'loadout' && onOpenInventory ? (
            <button type="button" className="dock-inventory-btn" onClick={onOpenInventory}>
              Inventory
            </button>
          ) : null}
          {pane === 'loadout' ? <ResourceBar state={state} only={['scrap']} compact /> : null}
          {pane === 'workshop' ? <ResourceBar state={state} only={['scrap']} compact /> : null}
          {pane === 'rebuild' ? <ResourceBar state={state} only={['prestigeMatter']} compact /> : null}
        </ContextBar>
        {pane === 'workshop' && showWorkshop ? (
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
        ) : null}
      </div>

      <div className="dock-pane">
        {pane === 'home' ? (
          <div className="dock-home">
            <DockHivePreview state={state} />
            {locked ? <p className="ui-meta">Prep is locked until this Sortie docks.</p> : null}
            <ItemRow
              title="Loadout"
              meta="Frame and Cores"
              guide="dock-cores"
              onClick={() => setPane('loadout')}
            />
            {showWorkshop ? (
              <ItemRow
                title="Workshop"
                meta="Starting power"
                guide="workshop"
                onClick={() => setPane('workshop')}
              />
            ) : null}
            <ItemRow
              title="Rebuild"
              meta={hangarOpen ? 'Available' : 'Inactive'}
              guide="rebuild-btn"
              onClick={() => setPane('rebuild')}
            />
          </div>
        ) : null}

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
              <div data-guide="relic-sockets" data-onboarding="onboarding.relic.install">
                <SectionHeader title="Cores" />
              </div>
              {loadoutSlots.map(({ role, moduleId, coreInstanceId }, index) => {
                const def = moduleId ? getModule(moduleId) : undefined
                const roleLabel = LOADOUT_ROLE_LABEL[role]
                const copyCount = moduleId
                  ? state.shipyard.coreInstances.filter(
                      (instance) => instance.moduleId === moduleId,
                    ).length
                  : 0
                const copyLabel =
                  coreInstanceId && copyCount > 1
                    ? ` · Copy ${coreInstanceCopyNumber(state, coreInstanceId)}`
                    : ''
                const level = coreInstanceId
                  ? coreStartingLevel(state, coreInstanceId)
                  : 0
                const title = moduleId ? (def?.name ?? moduleId) : `Empty ${roleLabel} Slot`
                return (
                  <div
                    key={coreInstanceId ?? `${role}-${index}`}
                    className={`dock-core-slot${moduleId ? ' is-equipped' : ''}`}
                  >
                    <ItemRow
                      title={title}
                      meta={
                        moduleId
                          ? `${roleLabel}${copyLabel} · Lv${level} · M${moduleMasteryRank(state, moduleId)}`
                          : 'Tap to fit a Core'
                      }
                      guide={moduleId ? `core-${moduleId}` : undefined}
                      onClick={() => {
                        if (moduleId) setCoreDetail({ moduleId, coreInstanceId })
                        else setPicker({ role })
                      }}
                    />
                    {moduleId && coreInstanceId ? (
                      <button
                        type="button"
                        className="dock-core-unfit"
                        disabled={locked || !onUnfitCore}
                        aria-label={`Unequip ${title}${copyLabel}`}
                        onClick={() => onUnfitCore?.(moduleId, coreInstanceId)}
                      >
                        Unequip
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </Section>
          </div>
        ) : null}

        {pane === 'workshop' && showWorkshop ? (
          <div className="dock-workshop" data-guide="workshop">
            {locked ? <p className="ui-meta">Workshop buys wait until Dock.</p> : null}
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
            <div className="dock-glance">
              <StatPair label="Best Wave" value={bestWave ? `W${bestWave}` : '—'} />
              <StatPair label="Cycle" value={cycleNo} />
            </div>
            <StatPair
              label="Projected Matter"
              value={rebuildReady ? formatCompact(prestigeGainFor(state)) : '0'}
            />
            <button
              type="button"
              className="primary"
              data-guide="rebuild-btn"
              data-onboarding="onboarding.rebuild.preview"
              disabled={!hangarOpen}
              onClick={(e) => {
                markLocalOk(e.currentTarget)
                onRebuild()
              }}
            >
              {hangarOpen ? 'Preview Rebuild' : `Inactive · W${rebuildMin}`}
            </button>
            {matterShopAvailable ? (
              <button type="button" onClick={() => setMatterShopOpen(true)}>
                Matter upgrades
              </button>
            ) : null}
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
          moduleId={coreDetail.moduleId}
          coreInstanceId={coreDetail.coreInstanceId}
          locked={locked}
          onChange={() =>
            setPicker({
              replaceId: coreDetail.moduleId,
              replaceCoreInstanceId: coreDetail.coreInstanceId,
              role: getModule(coreDetail.moduleId)?.role,
            })
          }
          onClose={() => setCoreDetail(null)}
          onEquipRelic={locked ? undefined : onEquipRelic}
          onRemoveRelic={locked ? undefined : onRemoveRelic}
          onUpgradeRelic={locked ? undefined : onUpgradeRelic}
          onUpgradeCore={locked ? undefined : onUpgradeCore}
        />
      ) : null}
      {picker ? (
        <CorePicker
          state={state}
          replaceId={picker.replaceId}
          replaceCoreInstanceId={picker.replaceCoreInstanceId}
          role={picker.role}
          locked={locked}
          onEquip={fitReplacement}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {matterShopOpen ? (
        <MatterShopSheet
          state={state}
          onClose={() => setMatterShopOpen(false)}
          onBuyMatter={locked ? undefined : onBuyMatter}
        />
      ) : null}
    </Screen>
  )
}
