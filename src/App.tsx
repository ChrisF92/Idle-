import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { computeResourceRates } from './game/tick'
import { activeGuideStep, isSystemUnlocked } from './game/progression'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { GuideOverlay } from './components/GuideOverlay'
import { CombatTab } from './components/tabs/CombatTab'
import { ShipyardTab } from './components/tabs/ShipyardTab'
import { BaseTab } from './components/tabs/BaseTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { CodexTab } from './components/tabs/CodexTab'
import { AiTab } from './components/tabs/AiTab'
import { PrestigeTab } from './components/tabs/PrestigeTab'
import { CoreTab } from './components/tabs/CoreTab'
import { StatsTab } from './components/tabs/StatsTab'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import './App.css'

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('combat')
  const [fabLaunchModuleId, setFabLaunchModuleId] = useState<string | null>(null)
  const rates = useMemo(() => computeResourceRates(game.state), [game.state])
  const guide = activeGuideStep(game.state, tab)
  const ack = game.acknowledgeOnboarding
  const onFabLaunchConsumed = useCallback(() => setFabLaunchModuleId(null), [])
  const onBuildModule = useCallback((moduleId: string) => {
    setFabLaunchModuleId(moduleId)
    setTab('base')
  }, [])

  useEffect(() => {
    if (!isSystemUnlocked(game.state, tab)) {
      setTab('combat')
    }
  }, [game.state, tab])

  useEffect(() => {
    if (guide?.tab && guide.tab !== tab && isSystemUnlocked(game.state, guide.tab)) {
      setTab(guide.tab)
    }
  }, [guide?.id, guide?.tab, game.state, tab])

  useEffect(() => {
    if (!guide?.completeWhen) return
    if (guide.completeWhen(game.state, tab)) {
      ack(guide.id)
    }
  }, [guide, game.state, tab, ack])

  useEffect(() => {
    document.body.classList.toggle('guide-active', Boolean(guide))
    return () => document.body.classList.remove('guide-active')
  }, [guide])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">Cosmic Idle</p>
          <p className="tagline">Working title — fleet vs entities</p>
        </div>
      </header>

      <PwaUpdateBanner />

      {game.offlineReport ? (
        <OfflineBanner
          report={game.offlineReport}
          onDismiss={game.dismissOfflineReport}
        />
      ) : null}

      <ResourceBar state={game.state} rates={rates} />
      <TabNav active={tab} onChange={setTab} state={game.state} />

      <main className="main">
        {tab === 'combat' && (
          <CombatTab
            state={game.state}
            onSetCampaign={game.setCampaign}
            onSetDocked={game.setDocked}
            onWarp={game.warpToSector}
          />
        )}
        {tab === 'shipyard' && (
          <ShipyardTab
            state={game.state}
            onUnlockFrame={game.unlockFrame}
            onSelectFrame={game.selectFrame}
            onUnlockModule={game.unlockModule}
            onFitModule={game.fitModule}
            onUnfitModule={game.unfitModule}
            onUpgradeModule={game.upgradeModule}
            onUnequipAll={game.unequipAll}
            onUpgradeCheapest={game.upgradeCheapest}
            onBuildModule={onBuildModule}
          />
        )}
        {tab === 'base' && (
          <BaseTab
            state={game.state}
            fabLaunchModuleId={fabLaunchModuleId}
            onFabLaunchConsumed={onFabLaunchConsumed}
            onAssign={game.assignWorker}
            onAutoBalance={game.autoBalanceWorkers}
            onStartFab={game.startFabProject}
            onLaunchFab={game.launchFabProject}
            onClearFab={game.clearFabProject}
            onDepositFab={game.depositFabPart}
            onWithdrawFab={game.withdrawFabPart}
            onSellPart={game.sellPart}
            onInvestMastery={game.investPartMastery}
          />
        )}
        {tab === 'research' && (
          <ResearchTab
            state={game.state}
            onBuyResearch={game.buyResearch}
            onBuyEssence={game.buyEssenceUpgrade}
          />
        )}
        {tab === 'core' && (
          <CoreTab
            state={game.state}
            onAssign={game.assignWorker}
            onEquipCore={game.equipSignalCore}
            onUnequipCore={game.unequipSignalCore}
            onMergeCores={game.mergeSignalCores}
          />
        )}
        {tab === 'codex' && <CodexTab state={game.state} />}
        {tab === 'ai' && <AiTab state={game.state} onBuy={game.buyAiNode} />}
        {tab === 'prestige' && (
          <PrestigeTab
            state={game.state}
            guideTarget={guide?.target}
            onPrestige={game.prestige}
            onAscend={game.ascend}
            onEnterChallenge={game.enterChallenge}
            onAbandonChallenge={game.abandonChallenge}
            onBuyShop={game.buyChallengeShop}
            onBuyMatterShop={game.buyMatterShop}
          />
        )}
        {tab === 'stats' && (
          <StatsTab
            state={game.state}
            onHardReset={game.hardReset}
            onImport={game.applyImportedSave}
            onDevAction={game.applyDevAction}
          />
        )}
      </main>

      {guide ? (
        <GuideOverlay step={guide} onComplete={ack} onSkip={ack} />
      ) : null}
    </div>
  )
}
