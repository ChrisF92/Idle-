import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { activeGuideStep, isHangarGuideStep, isHubTabOpen } from './game/progression'
import { wavesForSector } from './game/sectors'
import { setActiveNumberNotation } from './game/format'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { DockTab } from './components/tabs/DockTab'
import { CombatTab } from './components/tabs/CombatTab'
import { NetworkTab } from './components/tabs/NetworkTab'
import { FoundryTab } from './components/tabs/FoundryTab'
import { ReliquaryTab } from './components/tabs/ReliquaryTab'
import { FurnaceTab } from './components/tabs/FurnaceTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { YardTab } from './components/tabs/YardTab'
import { SlagTab } from './components/tabs/SlagTab'
import { ProtocolsTab } from './components/tabs/ProtocolsTab'
import { EchoTab } from './components/tabs/EchoTab'
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
import './App.css'

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
  const seenOutcome = useRef(game.state.combat.lastSortie.outcome)
  const lastGuideId = useRef<string | null>(null)
  const [heldGuideId, setHeldGuideId] = useState<string | null>(null)
  const dying = (game.state.combat.defeatLeft ?? 0) > 0
  const live = !game.state.combat.docked || dying
  const waves = wavesForSector(game.state.combat.sector)
  const guide =
    dying || reportOpen ? null : activeGuideStep(game.state, tab, heldGuideId, { hangarOpen })
  game.simPausedRef.current = Boolean(guide) || simulatorOpen

  const go = useCallback(
    (next: TabId) => {
      if (isHubTabOpen(game.state, next)) setTab(next)
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
      if (station && isHubTabOpen(game.state, 'stats')) setTab('stats')
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
    setHeldGuideId(guide?.id ?? null)
  }, [guide?.id])

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
    if (!guide || !hangarOpen) return
    if (!isHangarGuideStep(guide)) setHangarOpen(false)
  }, [guide, hangarOpen])

  useEffect(() => {
    if (!guide?.tab || dying) return
    if (!game.state.combat.docked && guide.tab !== 'combat') return
    if (guide.id === lastGuideId.current) return
    lastGuideId.current = guide.id
    if (isHubTabOpen(game.state, guide.tab)) setTab(guide.tab)
  }, [guide, dying, game.state])

  return (
    <div className={guide ? 'app app-guide-lock' : 'app'}>
      <div className="chrome-top">
      <header className="topbar">
        <div className="brand-cluster">
          <p className="brand">Hiveworks</p>
          <ScreenHelp screen={tab} />
        </div>
        <ResourceBar state={game.state} />
        {live ? (
          <button type="button" className="combat-chip" onClick={() => go('combat')}>
            Live {game.state.combat.wave}/{waves}
          </button>
        ) : null}
      </header>

      <PwaUpdateBanner />

      {game.offlineReport ? (
        <OfflineBanner
          report={game.offlineReport}
          onDismiss={game.dismissOfflineReport}
        />
      ) : null}
      </div>

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
            onSetSector={game.setLaunchSector}
            onSetRoute={game.setSectorRoute}
          />
        )}
        {tab === 'combat' && (
          <CombatTab
            state={game.state}
            onLaunch={() => {
              game.setDocked(false)
            }}
            onSetPushMode={game.setPushMode}
            onUpgrade={game.upgradeModule}
            onPickMilestone={game.pickCoreMilestone}
            paused={Boolean(guide)}
            guide={guide}
          />
        )}
        {tab === 'network' && (
          <NetworkTab
            state={game.state}
            onAssign={game.assignWorker}
            onBuyLink={game.buyNetworkLink}
          />
        )}
        {tab === 'foundry' && (
          <FoundryTab
            state={game.state}
            onSetSlot={game.setFoundrySlot}
            onBuyUpgrade={game.buyFoundryUpgrade}
            onEquip={game.equipFoundryModule}
            onUnequip={game.unequipFoundryModule}
            onAssemble={game.assembleBlueprint}
          />
        )}
        {tab === 'reliquary' && (
          <ReliquaryTab
            state={game.state}
            onBack={() => go('stats')}
            onInsert={game.insertShard}
            onRemove={game.removeShard}
          />
        )}
        {tab === 'furnace' && (
          <FurnaceTab
            state={game.state}
            onBack={() => go('stats')}
            onConvert={game.convertAshToHeat}
            onBuyRank={game.buyFurnaceRank}
          />
        )}
        {tab === 'research' && (
          <ResearchTab
            state={game.state}
            onBack={() => go('stats')}
            onFocus={game.setResearchFocus}
          />
        )}
        {tab === 'yard' && (
          <YardTab
            state={game.state}
            onBack={() => go('stats')}
            onPlace={game.placeYardBuilding}
            onClear={game.clearYardBuilding}
            onBuyArm={game.buyYardArm}
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
          />
        )}
        {tab === 'echo' && (
          <EchoTab
            state={game.state}
            onBack={() => go('stats')}
            onEnter={game.enterEcho}
            onAbandon={game.abandonEcho}
            onBuy={game.buyEchoNode}
          />
        )}
        {tab === 'process' && (
          <ProcessTab
            state={game.state}
            onBack={() => go('stats')}
            onBuy={game.buyProcessNode}
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
          />
        )}
        {tab === 'logs' && <LogsTab state={game.state} onBack={() => go('stats')} />}
        {tab === 'codex' && <CodexTab state={game.state} onBack={() => go('stats')} />}
        {tab === 'stats' && (
          <StatsTab
            state={game.state}
            onHardReset={game.hardReset}
            onImport={game.applyImportedSave}
            onDevAction={game.applyDevAction}
            onRebuild={() => setHangarOpen(true)}
            onNotation={game.setNumberNotation}
            onOpenStation={go}
            onOpenSimulator={() => setSimulatorOpen(true)}
          />
        )}
      </main>

      <TabNav active={tab} onChange={go} state={game.state} />

      {hangarOpen ? (
        <RebuildHangar
          state={game.state}
          onClose={() => setHangarOpen(false)}
          onConfirm={(hangar) => {
            game.performRebuild(hangar)
            setHangarOpen(false)
            go('dock')
          }}
        />
      ) : null}

      {reportOpen && game.state.combat.lastSortie.outcome ? (
        <SortieReport
          summary={game.state.combat.lastSortie}
          onClose={() => setReportOpen(false)}
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
    </div>
  )
}
