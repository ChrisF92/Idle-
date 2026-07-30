import { useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { CombatTab } from './components/tabs/CombatTab'
import { ShipyardTab } from './components/tabs/ShipyardTab'
import { BaseTab } from './components/tabs/BaseTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { AiTab } from './components/tabs/AiTab'
import { PrestigeTab } from './components/tabs/PrestigeTab'
import { StatsTab } from './components/tabs/StatsTab'
import './App.css'

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('combat')

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

      <ResourceBar resources={game.state.resources} />
      <TabNav active={tab} onChange={setTab} />

      <main className="main">
        {tab === 'combat' && (
          <CombatTab
            state={game.state}
            onEngage={game.engage}
            onToggleCampaign={game.setCampaign}
            onResumeCampaign={game.resumeCampaign}
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
          />
        )}
        {tab === 'base' && <BaseTab state={game.state} onUpgrade={game.upgradeBuilding} />}
        {tab === 'research' && (
          <ResearchTab
            state={game.state}
            onBuyResearch={game.buyResearch}
            onBuyEssence={game.buyEssenceUpgrade}
          />
        )}
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
    </div>
  )
}
