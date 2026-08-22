import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import {
  activeGuideStep,
  guideAutoTabs,
  guidePausesSimulation,
  isHubTabOpen,
  isSystemUnlocked,
} from './game/progression'
import { contentKeys } from './game/hubAttention'
import { showSystemsHub } from './game/systemsHub'
import { setActiveNumberNotation } from './game/format'
import {
  captureToastSnapshot,
  diffToasts,
  dismissToast,
  enqueueToasts,
  expireToasts,
  snapshotsEqual,
  TOAST_TTL_MS,
  type QueuedToast,
  type ToastNav,
  type ToastSnapshot,
} from './game/toasts'
import { prefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { DockTab, type DockPane } from './components/tabs/DockTab'
import { CombatTab } from './components/tabs/CombatTab'
import { NetworkTab } from './components/tabs/NetworkTab'
import { FoundryTab, type FoundryPane } from './components/tabs/FoundryTab'
import { SystemsTab } from './components/tabs/SystemsTab'
import { ReliquaryTab } from './components/tabs/ReliquaryTab'
import { FurnaceTab } from './components/tabs/FurnaceTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { YardTab } from './components/tabs/YardTab'
import { SlagTab } from './components/tabs/SlagTab'
import { ProtocolsTab } from './components/tabs/ProtocolsTab'
import { ProcessTab } from './components/tabs/ProcessTab'
import { SpecialistsTab } from './components/tabs/SpecialistsTab'
import { TasksTab } from './components/tabs/TasksTab'
import { CapitalTab } from './components/tabs/CapitalTab'
import { ReinforceTab } from './components/tabs/ReinforceTab'
import { LogsTab } from './components/tabs/LogsTab'
import { CodexTab } from './components/tabs/CodexTab'
import { StatsTab } from './components/tabs/StatsTab'
import { RebuildHangar } from './components/RebuildHangar'
import { SortieReport } from './components/SortieReport'
import { GuideOverlay } from './components/GuideOverlay'
import { ScreenHelp } from './components/ScreenHelp'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import { ToastStack } from './components/ToastStack'
import './App.css'
import './polish.css'

const BalanceSimulator = lazy(async () => {
  const mod = await import('./components/BalanceSimulator')
  return { default: mod.BalanceSimulator }
})

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('dock')
  const [hangarOpen, setHangarOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [blockingModal, setBlockingModal] = useState(false)
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  const [foundryPane, setFoundryPane] = useState<FoundryPane | null>(null)
  const [systemsView, setSystemsView] = useState<'hub' | 'foundry'>('foundry')
  const [dockPane, setDockPane] = useState<DockPane>('loadout')
  const toastBaseline = useRef<ToastSnapshot | null>(null)
  const seenOutcome = useRef(game.state.combat.lastSortie.outcome)
  const lastGuideId = useRef<string | null>(null)
  const [heldGuideId, setHeldGuideId] = useState<string | null>(null)
  const dying = (game.state.combat.defeatLeft ?? 0) > 0
  const live = !game.state.combat.docked || dying
  const offlineOpen = Boolean(game.offlineReport)
  const guide =
    dying || reportOpen || hangarOpen || blockingModal || offlineOpen
      ? null
      : activeGuideStep(game.state, tab, heldGuideId)
  const pauseSim =
    guidePausesSimulation(guide) || hangarOpen || blockingModal || simulatorOpen || offlineOpen
  game.simPausedRef.current = pauseSim

  const go = useCallback(
    (next: TabId) => {
      if (next === 'yard') {
        setFoundryPane('build')
        setSystemsView('foundry')
        if (isHubTabOpen(game.state, 'foundry')) setTab('foundry')
        return
      }
      if (next === 'foundry') {
        setSystemsView('foundry')
        if (isHubTabOpen(game.state, next)) setTab(next)
        return
      }
      if (next === 'network') {
        if (isHubTabOpen(game.state, next)) setTab(next)
        return
      }
      if (isHubTabOpen(game.state, next)) setTab(next)
    },
    [game.state],
  )

  const openSystemsHub = useCallback(() => {
    if (!isHubTabOpen(game.state, 'foundry')) return
    setSystemsView(showSystemsHub(game.state) ? 'hub' : 'foundry')
    setTab('foundry')
  }, [game.state])

  const applyToastNav = useCallback(
    (nav: ToastNav) => {
      if (nav.kind === 'rebuild') {
        if (isHubTabOpen(game.state, 'dock')) setTab('dock')
        setDockPane('rebuild')
        return
      }
      if (nav.kind === 'cores') {
        if (isHubTabOpen(game.state, 'dock')) setTab('dock')
        setDockPane('loadout')
        setFocusTarget(nav.moduleId ? `core-${nav.moduleId}` : 'dock-cores')
        return
      }
      if (isHubTabOpen(game.state, nav.tab)) {
        if (nav.tab === 'foundry') setSystemsView('foundry')
        if (nav.tab === 'dock') setDockPane('loadout')
        setTab(nav.tab)
        if (nav.focus) setFocusTarget(nav.focus)
        if (nav.tab === 'foundry' && nav.focus?.startsWith('print-')) setFoundryPane('prints')
        if (nav.tab === 'foundry' && (nav.focus === 'foundry-fit' || nav.focus?.startsWith('fit-'))) {
          setFoundryPane('fit')
        }
        if (nav.tab === 'foundry' && (nav.focus === 'foundry-build' || nav.focus === 'yard-grid')) {
          setFoundryPane('build')
        }
      }
    },
    [game.state],
  )

  useEffect(() => {
    if (!isHubTabOpen(game.state, tab)) {
      const station =
        tab === 'reliquary' ||
        tab === 'furnace' ||
        tab === 'research' ||
        tab === 'yard' ||
        tab === 'slag' ||
        tab === 'protocols' ||
        tab === 'echo' ||
        tab === 'process' ||
        tab === 'specialists' ||
        tab === 'tasks' ||
        tab === 'capital' ||
        tab === 'reinforce' ||
        tab === 'logs' ||
        tab === 'codex'
      if (tab === 'network' && isHubTabOpen(game.state, 'foundry')) {
        setSystemsView(showSystemsHub(game.state) ? 'hub' : 'foundry')
        setTab('foundry')
      } else if (
        (tab === 'furnace' || tab === 'research' || tab === 'process') &&
        isHubTabOpen(game.state, 'foundry')
      ) {
        setSystemsView(showSystemsHub(game.state) ? 'hub' : 'foundry')
        setTab('foundry')
      } else if (station && isHubTabOpen(game.state, 'stats')) setTab('stats')
      else if (isHubTabOpen(game.state, 'dock')) setTab('dock')
      else setTab('combat')
    }
  }, [game.state, tab])

  useEffect(() => {
    setActiveNumberNotation(game.state.meta.numberNotation ?? 'engineering')
  }, [game.state.meta.numberNotation])

  useEffect(() => {
    game.syncCompletedGuides(tab)
  }, [tab, game])

  useEffect(() => {
    if (guide?.id === 'guide-upgrade-pulse' || guide?.id === 'guide-upgrade-plate') {
      game.ensureStarterCoresSalvage()
    }
  }, [guide?.id, game])

  const hubStamp = contentKeys(game.state, tab).join('|')
  useEffect(() => {
    game.markHubSeen(tab)
    if (tab === 'foundry' && systemsView === 'hub') {
      if (isSystemUnlocked(game.state, 'network')) game.markHubSeen('network')
      if (isSystemUnlocked(game.state, 'furnace')) game.markHubSeen('furnace')
      if (isSystemUnlocked(game.state, 'research')) game.markHubSeen('research')
      if (isSystemUnlocked(game.state, 'process')) game.markHubSeen('process')
    }
  }, [tab, hubStamp, systemsView, game])

  useEffect(() => {
    setHeldGuideId(guide?.id ?? null)
  }, [guide?.id])

  useEffect(() => {
    if (tab !== 'foundry') setFoundryPane(null)
  }, [tab])

  useEffect(() => {
    if (dying) setTab('combat')
  }, [dying])

  useEffect(() => {
    const out = game.state.combat.lastSortie.outcome
    if (
      out === 'defeat' &&
      seenOutcome.current !== 'defeat' &&
      game.state.combat.docked &&
      !dying
    ) {
      setReportOpen(true)
      setTab('dock')
    }
    seenOutcome.current = out
  }, [game.state.combat.lastSortie, game.state.combat.docked, dying])

  useEffect(() => {
    if (!guide) return
    if (guide.target === 'workshop' || guide.id.includes('workshop')) setDockPane('workshop')
    else if (guide.target === 'rebuild-btn' || guide.id.includes('rebuild') || guide.id.includes('prestige-hangar')) {
      setDockPane('rebuild')
    } else if (
      guide.tab === 'dock' &&
      (guide.target === 'dock-cores' || guide.target.startsWith('upgrade-') || guide.target.startsWith('core-'))
    ) {
      setDockPane('loadout')
    }
  }, [guide])

  useEffect(() => {
    if (!guideAutoTabs(guide) || !guide?.tab || dying) return
    if (!game.state.combat.docked && guide.tab !== 'combat') return
    if (guide.id === lastGuideId.current) return
    lastGuideId.current = guide.id
    if (isHubTabOpen(game.state, guide.tab)) {
      if (guide.tab === 'foundry') setSystemsView('foundry')
      setTab(guide.tab)
    }
  }, [guide, dying, game.state])

  useEffect(() => {
    const snap = captureToastSnapshot(game.state)
    const prev = toastBaseline.current
    if (!prev) {
      toastBaseline.current = snap
      return
    }
    if (snapshotsEqual(prev, snap)) return
    const incoming = diffToasts(prev, snap, game.state)
    toastBaseline.current = snap
    if (incoming.length === 0) return
    setToasts((q) => enqueueToasts(q, incoming, Date.now()))
  }, [game.state])

  const toastSuppressed = pauseSim || reportOpen

  useEffect(() => {
    if (toasts.length === 0 || toastSuppressed) return
    const id = window.setInterval(() => {
      setToasts((q) => expireToasts(q, Date.now(), TOAST_TTL_MS))
    }, 400)
    return () => window.clearInterval(id)
  }, [toasts.length, toastSuppressed])

  useEffect(() => {
    if (!focusTarget) return
    const run = () => {
      const el = document.querySelector(`[data-focus="${CSS.escape(focusTarget)}"]`)
      el?.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    }
    const t = window.setTimeout(run, 60)
    return () => window.clearTimeout(t)
  }, [tab, focusTarget])

  return (
    <div
      className={[
        'app',
        guidePausesSimulation(guide) ? 'app-guide-lock' : '',
        tab === 'combat' ? 'is-sortie' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tab !== 'combat' ? (
        <div className="chrome-top">
          <header className={`topbar is-${tab === 'dock' ? 'dock' : tab === 'stats' ? 'more' : 'systems'}`}>
            <div className="brand-cluster">
              <p className="brand">
                {tab === 'dock'
                  ? 'Hiveworks'
                  : tab === 'stats'
                    ? 'More'
                    : tab === 'network'
                      ? 'Worker Drones'
                      : tab === 'foundry' && systemsView === 'hub'
                        ? 'Systems'
                        : tab === 'foundry'
                          ? 'Foundry'
                          : tab === 'furnace'
                            ? 'Furnace'
                            : tab === 'research'
                              ? 'Research'
                              : tab === 'process'
                                ? 'Process'
                                : 'Hiveworks'}
              </p>
              <ScreenHelp screen={tab} />
            </div>
            {tab === 'dock' ? <ResourceBar state={game.state} only={['scrap', 'prestigeMatter']} /> : null}
            {live ? (
              <button type="button" className="combat-chip" onClick={() => go('combat')}>
                <span className="live-pip" aria-hidden />
                LIVE · W{game.state.combat.wave}
              </button>
            ) : null}
          </header>
        </div>
      ) : null}

      <main className="main">
        {tab === 'dock' && (
          <DockTab
            state={game.state}
            onLaunch={() => {
              game.setDocked(false)
              go('combat')
            }}
            onOpenSortie={() => go('combat')}
            onRebuild={() => setHangarOpen(true)}
            onBuyWorkshop={game.buyWorkshopUpgrade}
            onUpgrade={game.upgradeModule}
            onPickMilestone={game.pickCoreMilestone}
            onBuyMaxCores={game.buyMaxCores}
            onEquipRelic={game.equipRelic}
            onRemoveRelic={game.removeRelic}
            onSelectFrame={game.selectFrame}
            onFitCore={game.fitModule}
            onUnfitCore={game.unfitModule}
            pane={dockPane}
            onPaneChange={setDockPane}
            focusModuleId={focusTarget?.startsWith('core-') ? focusTarget.slice(5) : null}
          />
        )}
        {tab === 'combat' && (
          <CombatTab
            state={game.state}
            onLaunch={() => {
              game.setDocked(false)
            }}
            onExtract={() => game.setDocked(true)}
            onBuyRunUpgrade={game.buyRunUpgrade}
            onViewReport={() => setReportOpen(true)}
            onUpgrade={game.upgradeModule}
            onPickMilestone={game.pickCoreMilestone}
            onMarkCoresSeen={() => game.markHubSeen('cores')}
            paused={pauseSim}
            guide={guide}
            onCycleSpeed={game.cycleSortieSpeed}
            onOpenFoundry={() => {
              setFoundryPane('smelt')
              go('foundry')
            }}
            onOpenPrints={() => {
              setFoundryPane('prints')
              go('foundry')
            }}
            onBuyMaxCores={game.buyMaxCores}
            onChooseDirective={game.chooseDirective}
            onEquipRelic={game.equipRelic}
            onRemoveRelic={game.removeRelic}
          />
        )}
        {tab === 'network' && (
          <NetworkTab
            state={game.state}
            onAssign={game.assignWorker}
            onBuyLink={game.buyNetworkLink}
            onOptimise={game.optimiseNetwork}
            onPreset={game.applyNetworkPreset}
            guideTarget={guide?.target}
            onBack={
              showSystemsHub(game.state)
                ? () => {
                    setSystemsView('hub')
                    if (isHubTabOpen(game.state, 'foundry')) setTab('foundry')
                  }
                : undefined
            }
          />
        )}
        {tab === 'foundry' && systemsView === 'hub' && showSystemsHub(game.state) ? (
          <SystemsTab
            state={game.state}
            onManage={(id) => {
              if (id === 'foundry') setSystemsView('foundry')
              else go(id)
            }}
          />
        ) : null}
        {tab === 'foundry' && !(systemsView === 'hub' && showSystemsHub(game.state)) && (
          <FoundryTab
            state={game.state}
            onSetSlot={game.setFoundrySlot}
            onBuyUpgrade={game.buyFoundryUpgrade}
            onEquip={game.equipFoundryModule}
            onUnequip={game.unequipFoundryModule}
            onAssemble={game.assembleBlueprint}
            onTrack={game.setTrackedPrint}
            onBuyMax={game.buyMaxFoundryUpgrades}
            onPlaceBuilding={game.placeYardBuilding}
            onClearBuilding={game.clearYardBuilding}
            onBuyArm={game.buyYardArm}
            onBuyMaxArms={game.buyMaxYardArms}
            onSaveLayout={game.saveYardLayout}
            onLoadLayout={game.loadYardLayout}
            guideTarget={guide?.target}
            focusTarget={focusTarget}
            requestedPane={foundryPane}
            onBack={showSystemsHub(game.state) ? () => setSystemsView('hub') : undefined}
          />
        )}
        {tab === 'reliquary' && (
          <ReliquaryTab
            state={game.state}
            onBack={() => go('stats')}
            onEquipRelic={game.equipRelic}
            onRemoveRelic={game.removeRelic}
            onUpgradeRelic={game.upgradeRelic}
          />
        )}
        {tab === 'furnace' && (
          <FurnaceTab
            state={game.state}
            onBack={
              showSystemsHub(game.state)
                ? () => {
                    setSystemsView('hub')
                    if (isHubTabOpen(game.state, 'foundry')) setTab('foundry')
                  }
                : () => go('stats')
            }
            onConvert={game.convertAshToHeat}
            onSetChannel={game.setFurnaceChannel}
          />
        )}
        {tab === 'research' && (
          <ResearchTab
            state={game.state}
            onBack={
              showSystemsHub(game.state)
                ? () => {
                    setSystemsView('hub')
                    if (isHubTabOpen(game.state, 'foundry')) setTab('foundry')
                  }
                : () => go('stats')
            }
            onFocus={game.setResearchFocus}
            guideTarget={guide?.target}
          />
        )}
        {tab === 'yard' && (
          <YardTab
            state={game.state}
            onBack={() => go('stats')}
            onPlace={game.placeYardBuilding}
            onClear={game.clearYardBuilding}
            onBuyArm={game.buyYardArm}
            onBuyMax={game.buyMaxYardArms}
            onSaveLayout={game.saveYardLayout}
            onLoadLayout={game.loadYardLayout}
            guideTarget={guide?.target}
          />
        )}
        {tab === 'slag' && (
          <SlagTab
            state={game.state}
            onBack={() => go('stats')}
            onBuy={game.buyMatterShop}
          />
        )}
        {tab === 'protocols' && (
          <ProtocolsTab
            state={game.state}
            onBack={() => go('stats')}
            onEnter={game.enterProtocol}
            onAbandon={game.abandonProtocol}
            onBlockingChange={setBlockingModal}
          />
        )}
        {tab === 'process' && (
          <ProcessTab
            state={game.state}
            onBack={
              showSystemsHub(game.state)
                ? () => {
                    setSystemsView('hub')
                    if (isHubTabOpen(game.state, 'foundry')) setTab('foundry')
                  }
                : () => go('stats')
            }
            onBuy={game.buyProcessNode}
            onConfig={game.setProcessConfig}
            guideTarget={guide?.target}
          />
        )}
        {tab === 'specialists' && (
          <SpecialistsTab
            state={game.state}
            onBack={() => go('stats')}
            onRank={game.rankSpecialist}
          />
        )}
        {tab === 'tasks' && <TasksTab state={game.state} onBack={() => go('stats')} />}
        {tab === 'capital' && (
          <CapitalTab
            state={game.state}
            onBack={() => go('stats')}
            onRank={game.rankCapital}
          />
        )}
        {tab === 'reinforce' && (
          <ReinforceTab
            state={game.state}
            onBack={() => go('stats')}
            onReinforce={game.performReinforce}
            onBlockingChange={setBlockingModal}
          />
        )}
        {tab === 'logs' && <LogsTab state={game.state} onBack={() => go('stats')} />}
        {tab === 'codex' && (
          <CodexTab state={game.state} onBack={() => go('stats')} guideTarget={guide?.target} />
        )}
        {tab === 'stats' && (
          <StatsTab
            state={game.state}
            onHardReset={game.hardReset}
            onImport={game.applyImportedSave}
            onDevAction={game.applyDevAction}
            onRebuild={() => setHangarOpen(true)}
            onNotation={game.setNumberNotation}
            onDamageNumbers={game.setDamageNumbers}
            onOpenStation={go}
            onOpenSimulator={() => setSimulatorOpen(true)}
            guideTarget={guide?.target}
          />
        )}
      </main>

      <TabNav
        active={tab}
        onChange={(next) => {
          if (next === 'foundry') openSystemsHub()
          else go(next)
        }}
        state={game.state}
      />

      {hangarOpen ? (
        <RebuildHangar
          state={game.state}
          onClose={() => setHangarOpen(false)}
          onConfirm={() => {
            game.performRebuild({
              frameId: game.state.shipyard.frameId,
              modules: [...game.state.shipyard.modules],
            })
            setHangarOpen(false)
            setDockPane('loadout')
            go('dock')
          }}
          onBuyMatter={game.buyMatterShop}
        />
      ) : null}

      {game.offlineReport ? (
        <OfflineBanner
          report={game.offlineReport}
          onDismiss={game.dismissOfflineReport}
        />
      ) : null}

      {reportOpen && game.state.combat.lastSortie.outcome ? (
        <SortieReport
          summary={game.state.combat.lastSortie}
          state={game.state}
          onClose={() => setReportOpen(false)}
          onDock={() => {
            setReportOpen(false)
            go('dock')
          }}
          onRunAgain={() => {
            setReportOpen(false)
            game.setDocked(false)
            go('combat')
          }}
        />
      ) : null}

      {simulatorOpen ? (
        <Suspense fallback={null}>
          <BalanceSimulator onClose={() => setSimulatorOpen(false)} />
        </Suspense>
      ) : null}

      {guide ? (
        <GuideOverlay
          step={guide}
          onComplete={game.acknowledgeOnboarding}
          onSkip={game.skipOnboarding}
        />
      ) : null}
      <ToastStack
        toasts={toasts}
        suppressed={toastSuppressed}
        onDismiss={(id) => setToasts((q) => dismissToast(q, id))}
        onAction={applyToastNav}
      />
      <PwaUpdateBanner escapeHatch={Boolean(guide && guidePausesSimulation(guide))} />
    </div>
  )
}
