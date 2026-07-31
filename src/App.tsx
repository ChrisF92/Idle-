import { useEffect, useMemo, useState } from 'react'
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
import { StatsTab } from './components/tabs/StatsTab'
import './App.css'

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('combat')
  const rates = useMemo(() => computeResourceRates(game.state), [game.state])
  const guide = activeGuideStep(game.state, tab)
  const ack = game.acknowledgeOnboarding

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

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">Cosmic Idle</p>
          <p className="tagline">Working title — fleet vs entities</p>
        </div>
      </header>

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
          />
        )}
        {tab === 'base' && (
          <BaseTab
            state={game.state}
            onAssign={game.assignWorker}
            onAutoBalance={game.autoBalanceWorkers}
          />
        )}
        {tab === 'research' && (
          <ResearchTab
            state={game.state}
            onBuyResearch={game.buyResearch}
            onBuyEssence={game.buyEssenceUpgrade}
          />
        )}
        {tab === 'codex' && <CodexTab state={game.state} />}
        {tab === 'ai' && <AiTab state={game.state} onBuy={game.buyAiNode} />}
        {tab === 'prestige' && (
          <PrestigeTab
            state={game.state}
            onPrestige={game.prestige}
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
          />
        )}
      </main>

      {guide ? (
        <GuideOverlay step={guide} onComplete={ack} onSkip={ack} />
      ) : null}
    </div>
  )
}
