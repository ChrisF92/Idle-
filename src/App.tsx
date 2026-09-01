import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { isHubTabOpen, isSystemUnlocked } from './game/progression'
import { contentKeys } from './game/hubAttention'
import { showSystemsHub } from './game/systemsHub'
import { hasProcess } from './game/process'
import { isRemovedAct1Tab } from './game/moreStations'
import { setActiveNumberNotation } from './game/format'
import {
  captureToastSnapshot,
  diffToasts,
  dismissToast,
  enqueueToasts,
  expireToasts,
  isSortieActive,
  selectPresentation,
  showGlobalBottomNav,
  showSortieReturnControl,
  snapshotsEqual,
  type PresentationNav,
  type QueuedToast,
  type ToastSnapshot,
} from './game/presentation'
import { collectPauseReasons, isSimPaused } from './game/pause'
import { lessonFinished } from './game/onboarding'
import { prefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { WalletButton } from './components/WalletButton'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { DockTab, type DockPane } from './components/tabs/DockTab'
import { CombatTab } from './components/tabs/CombatTab'
import { NetworkTab } from './components/tabs/NetworkTab'
import { FoundryTab, type FoundryPane } from './components/tabs/FoundryTab'
import { SystemsTab } from './components/tabs/SystemsTab'
import { FurnaceTab } from './components/tabs/FurnaceTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { ProtocolsTab } from './components/tabs/ProtocolsTab'
import { ProcessTab } from './components/tabs/ProcessTab'
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
import { InventoryScreen } from './components/InventoryScreen'
import { LiveWaveControl } from './components/LiveWaveControl'
import { Act1FinaleOverlay } from './components/Act1FinaleOverlay'
import { OverlayProvider, useOverlay, useOverlayLayer } from './ui/overlay'
import './ui/tokens.css'
import './ui/primitives.css'
import './App.css'
import './polish.css'

const BalanceSimulator = lazy(async () => {
  const mod = await import('./components/BalanceSimulator')
  return { default: mod.BalanceSimulator }
})

function foundryPaneFromNav(nav: { pane?: string; focus?: string }): FoundryPane | null {
  if (nav.pane === 'processing' || nav.pane === 'smelt') return 'processing'
  if (nav.pane === 'fabrication' || nav.pane === 'build') return 'fabrication'
  if (nav.pane === 'mastery' || nav.pane === 'ranks') return 'mastery'
  if (nav.pane === 'blueprints' || nav.pane === 'prints' || nav.pane === 'fit') return 'blueprints'
  if (nav.focus?.startsWith('blueprint-') || nav.focus?.startsWith('print-')) return 'blueprints'
  if (nav.focus?.startsWith('project-') || nav.focus === 'foundry-build' || nav.focus === 'yard-grid') {
    return 'fabrication'
  }
  return null
}

export default function App() {
  return (
    <OverlayProvider>
      <AppShell />
    </OverlayProvider>
  )
}

function AppShell() {
  const game = useGame()
  const overlays = useOverlay()
  const [tab, setTab] = useState<TabId>(() => (game.state.combat.docked ? 'dock' : 'combat'))
  const [hangarOpen, setHangarOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  const [foundryPane, setFoundryPane] = useState<FoundryPane | null>(null)
  const [systemsView, setSystemsView] = useState<'hub' | 'foundry'>('foundry')
  const [dockPane, setDockPane] = useState<DockPane>('home')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [combatOverlayOpen, setCombatOverlayOpen] = useState(false)
  const [combatOverlaySelectedCoreId, setCombatOverlaySelectedCoreId] = useState<string | null>(null)
  const toastBaseline = useRef<ToastSnapshot | null>(null)
  const seenOutcome = useRef(game.state.combat.lastSortie.outcome)
  const dying = (game.state.combat.defeatLeft ?? 0) > 0
  const offlineOpen = Boolean(game.offlineReport)
  const sortieLive = isSortieActive(game.state)
  useOverlayLayer({
    id: 'rebuild-hangar',
    kind: 'confirm',
    open: hangarOpen,
    onClose: () => setHangarOpen(false),
  })
  useOverlayLayer({
    id: 'sortie-report',
    kind: 'modal',
    open: reportOpen,
    onClose: () => setReportOpen(false),
  })
  const onCombatOverlayUi = useCallback((info: { open: boolean; selectedCoreId: string | null }) => {
    setCombatOverlayOpen(info.open)
    setCombatOverlaySelectedCoreId(info.selectedCoreId)
  }, [])
  const acknowledgeOnboarding = game.acknowledgeOnboarding
  const overlayLessonPending = !lessonFinished(game.state, 'combat-overlay.ranges')
  useEffect(() => {
    if (!combatOverlaySelectedCoreId || !overlayLessonPending) return
    acknowledgeOnboarding('combat-overlay.ranges')
  }, [combatOverlaySelectedCoreId, overlayLessonPending, acknowledgeOnboarding])
  const updateBlocking = overlays.topBlockingKind === 'update'
  const finalePending = Boolean(game.state.meta.act1FinalePending)
  const presentation = selectPresentation(
    game.state,
    { tab, reportOpen, hangarOpen, combatOverlayOpen, combatOverlaySelectedCoreId },
    toasts,
    { updateBlocking, confirmOpen: hangarOpen, reportOpen, finalePending },
  )
  const onboarding = presentation?.kind === 'onboarding' ? presentation : null
  const pauseReasons = collectPauseReasons({
    onboardingPause: Boolean(onboarding?.pause),
    directiveOffer: (game.state.combat.directiveOffer?.length ?? 0) > 0 && Boolean(onboarding?.pause),
    confirmOpen: hangarOpen,
    finalePending,
    offlineOpen,
    simulatorOpen,
    updateBlocking,
  })
  game.simPausedRef.current = isSimPaused(pauseReasons)

  const go = useCallback(
    (next: TabId) => {
      if (isRemovedAct1Tab(next)) return
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
    (nav: PresentationNav) => {
      if (nav.kind === 'rebuild') {
        if (isHubTabOpen(game.state, 'dock')) setTab('dock')
        setDockPane('rebuild')
        return
      }
      if (nav.kind === 'cores' || nav.kind === 'inventory') {
        if (isHubTabOpen(game.state, 'dock')) setTab('dock')
        setDockPane('loadout')
        setFocusTarget(nav.moduleId ? `core-${nav.moduleId}` : 'dock-cores')
        return
      }
      if (nav.kind === 'tab' && isRemovedAct1Tab(nav.tab)) return
      if (isHubTabOpen(game.state, nav.tab) || (nav.tab === 'combat' && isSortieActive(game.state))) {
        if (nav.tab === 'foundry') setSystemsView(nav.pane === 'hub' ? 'hub' : 'foundry')
        if (nav.tab === 'dock' && nav.pane === 'workshop') setDockPane('workshop')
        else if (nav.tab === 'dock' && nav.pane === 'rebuild') setDockPane('rebuild')
        else if (nav.tab === 'dock' && nav.pane === 'loadout') setDockPane('loadout')
        else if (nav.tab === 'dock') setDockPane('home')
        setTab(nav.tab)
        if (nav.focus) setFocusTarget(nav.focus)
        const pane = foundryPaneFromNav(nav)
        if (nav.tab === 'foundry' && pane) setFoundryPane(pane)
      }
    },
    [game.state],
  )

  useEffect(() => {
    if (isRemovedAct1Tab(tab)) {
      setTab(isHubTabOpen(game.state, 'stats') ? 'stats' : 'dock')
      return
    }
    if (!isHubTabOpen(game.state, tab)) {
      const station =
        tab === 'furnace' ||
        tab === 'research' ||
        tab === 'protocols' ||
        tab === 'process' ||
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
    if (tab !== 'foundry') setFoundryPane(null)
  }, [tab])

  useEffect(() => {
    if (dying) setTab('combat')
  }, [dying])

  useEffect(() => {
    if (game.state.combat.docked && !dying && tab === 'combat') {
      setDockPane('home')
      setTab('dock')
    }
  }, [game.state.combat.docked, dying, tab])

  useEffect(() => {
    if (!game.state.combat.docked && tab !== 'combat' && !game.state.combat.sortiePaused) {
      game.setSortiePaused(true)
    }
  }, [tab, game.state.combat.docked, game.state.combat.sortiePaused])

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
    if (!onboarding?.nav) return
    const nav = onboarding.nav
    if (nav.tab === 'dock' && nav.pane === 'workshop') setDockPane('workshop')
    if (nav.tab === 'dock' && nav.pane === 'rebuild') setDockPane('rebuild')
    if (nav.tab === 'dock' && nav.pane === 'loadout') setDockPane('loadout')
    if (nav.tab === 'foundry') {
      setSystemsView(nav.systemsView ?? 'foundry')
      const pane = foundryPaneFromNav(nav)
      if (pane) setFoundryPane(pane)
    }
    if (nav.tab !== tab && (isHubTabOpen(game.state, nav.tab) || nav.tab === 'combat')) {
      setTab(nav.tab)
    }
  }, [onboarding, tab, game.state])

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

  useEffect(() => {
    if (toasts.length === 0 || onboarding || reportOpen) return
    const id = window.setInterval(() => {
      setToasts((q) => expireToasts(q, Date.now()))
    }, 400)
    return () => window.clearInterval(id)
  }, [toasts.length, onboarding, reportOpen])

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
        onboarding?.pause ? 'app-guide-lock' : '',
        tab === 'combat' && sortieLive ? 'is-sortie' : '',
        tab !== 'combat' && sortieLive && game.state.combat.sortiePaused ? 'is-sortie-away' : '',
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
            <WalletButton state={game.state} />
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
            onUnlockGeneric={game.buyGenericUnlock}
            onEquipRelic={game.equipRelic}
            onRemoveRelic={game.removeRelic}
            onUpgradeRelic={game.upgradeRelic}
            onSelectFrame={game.selectFrame}
            onFitCore={game.fitModule}
            onUnfitCore={game.unfitModule}
            onUpgradeCore={game.buyCoreStartingLevel}
            pane={dockPane}
            onPaneChange={setDockPane}
            onBuyMatter={game.buyMatterShop}
            onOpenInventory={() => setInventoryOpen(true)}
            focusModuleId={focusTarget?.startsWith('core-') ? focusTarget.slice(5) : null}
          />
        )}
        {tab === 'combat' && (
          <CombatTab
            state={game.state}
            onLaunch={() => {
              game.setDocked(false)
            }}
            onExtract={() => {
              game.extractSortie()
              setDockPane('home')
              setTab('dock')
            }}
            onExtractSheetOpen={() => {
              game.setSortiePaused(true)
              game.markExtractionExplained()
            }}
            onPause={() => game.setSortiePaused(true)}
            onResume={() => game.setSortiePaused(false)}
            onPauseAndBrowse={() => {
              game.setSortiePaused(true)
              setDockPane('home')
              setTab('dock')
            }}
            onBuyRunUpgrade={game.buyRunUpgrade}
            onViewReport={() => setReportOpen(true)}
            onMarkCoresSeen={() => game.markHubSeen('cores')}
            paused={isSimPaused(pauseReasons)}
            onboardingTarget={onboarding?.target ?? null}
            onCycleSpeed={game.cycleSortieSpeed}
            onSetCoreDoctrine={game.setCoreTargetingDoctrine}
            onChooseDirective={game.chooseDirective}
            onEquipRelic={game.equipRelic}
            onRemoveRelic={game.removeRelic}
            onCombatOverlayUi={onCombatOverlayUi}
          />
        )}
        {tab === 'network' && (
          <NetworkTab
            state={game.state}
            onAssign={game.assignWorker}
            onOptimise={hasProcess(game.state, 'worker-auto-fill') ? game.optimiseNetwork : undefined}
            guideTarget={onboarding?.target}
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
            onFabricateCore={game.assembleBlueprint}
            onStartRelic={game.upgradeRelic}
            onStartFacility={game.startFacility}
            onStartJob={game.startFabricationJob}
            onTrack={game.setTrackedPrint}
            guideTarget={onboarding?.target}
            focusTarget={focusTarget}
            requestedPane={foundryPane}
            onBack={showSystemsHub(game.state) ? () => setSystemsView('hub') : undefined}
          />
        )}
        {tab === 'furnace' && isHubTabOpen(game.state, 'furnace') && (
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
            onIgnite={game.igniteFurnace}
          />
        )}
        {tab === 'research' && isHubTabOpen(game.state, 'research') && (
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
            onStart={game.startResearch}
            guideTarget={onboarding?.target}
          />
        )}
        {tab === 'protocols' && (
          <ProtocolsTab
            state={game.state}
            onBack={() => go('stats')}
            onEnter={game.enterProtocol}
            onAbandon={game.abandonProtocol}
          />
        )}
        {tab === 'process' && isHubTabOpen(game.state, 'process') && (
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
            guideTarget={onboarding?.target}
          />
        )}
        {tab === 'reinforce' && (
          <ReinforceTab
            state={game.state}
            onBack={() => go('stats')}
            onReinforce={game.performReinforce}
          />
        )}
        {tab === 'logs' && <LogsTab state={game.state} onBack={() => go('stats')} />}
        {tab === 'codex' && (
          <CodexTab state={game.state} onBack={() => go('stats')} guideTarget={onboarding?.target} />
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
            guideTarget={onboarding?.target}
            onOpenInventory={() => setInventoryOpen(true)}
          />
        )}
      </main>

      {showSortieReturnControl(game.state, tab) ? (
        <LiveWaveControl
          wave={Math.max(1, game.state.combat.waveReached || game.state.combat.wave)}
          onReturn={() => setTab('combat')}
        />
      ) : null}
      {showGlobalBottomNav(game.state, tab) ? (
        <TabNav
          active={tab}
          onChange={(next) => {
            if (next === 'dock') {
              setDockPane('home')
              go('dock')
              return
            }
            if (next === 'foundry') openSystemsHub()
            else go(next)
          }}
          state={game.state}
        />
      ) : null}

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
            setDockPane('home')
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
            setDockPane('home')
            go('dock')
          }}
          onRunAgain={() => {
            setReportOpen(false)
            game.setDocked(false)
            go('combat')
          }}
          onViewCore={(moduleId) => {
            setReportOpen(false)
            setDockPane('loadout')
            setFocusTarget(`core-${moduleId}`)
            go('dock')
          }}
        />
      ) : null}

      {simulatorOpen ? (
        <Suspense fallback={null}>
          <BalanceSimulator onClose={() => setSimulatorOpen(false)} />
        </Suspense>
      ) : null}

      <InventoryScreen
        state={game.state}
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onSelectFrame={game.selectFrame}
        onFitCore={game.fitModule}
        onUpgradeCore={game.buyCoreStartingLevel}
        onUpgradeRelic={game.upgradeRelic}
        onOpenFoundry={(pane) => {
          setInventoryOpen(false)
          setFoundryPane(pane)
          go('foundry')
        }}
      />

      {onboarding ? (
        <GuideOverlay
          item={onboarding}
          onComplete={game.acknowledgeOnboarding}
          onSkip={game.skipOnboarding}
        />
      ) : null}
      <Act1FinaleOverlay
        open={finalePending}
        onContinue={() => game.dismissAct1Finale()}
        onOpenReinforce={() => {
          game.dismissAct1Finale()
          go('reinforce')
        }}
      />
      <ToastStack
        item={presentation?.kind === 'toast' ? presentation : null}
        onDismiss={(id) => {
          setToasts((q) => dismissToast(q, id))
          game.acknowledgeEvent(id)
        }}
        onAction={applyToastNav}
      />
      <PwaUpdateBanner />
    </div>
  )
}
