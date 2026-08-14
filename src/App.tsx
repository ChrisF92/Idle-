import { useCallback, useEffect, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { isSystemUnlocked } from './game/progression'
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
import { ProtocolsTab } from './components/tabs/ProtocolsTab'
import { EchoTab } from './components/tabs/EchoTab'
import { ProcessTab } from './components/tabs/ProcessTab'
import { SpecialistsTab } from './components/tabs/SpecialistsTab'
import { TasksTab } from './components/tabs/TasksTab'
import { CapitalTab } from './components/tabs/CapitalTab'
import { ReinforceTab } from './components/tabs/ReinforceTab'
import { LogsTab } from './components/tabs/LogsTab'
import { StatsTab } from './components/tabs/StatsTab'
import { RebuildHangar } from './components/RebuildHangar'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import './App.css'

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('dock')
  const [hangarOpen, setHangarOpen] = useState(false)
  const live = !game.state.combat.docked
  const waves = wavesForSector(game.state.combat.sector)

  const go = useCallback(
    (next: TabId) => {
      if (isSystemUnlocked(game.state, next)) setTab(next)
    },
    [game.state],
  )

  useEffect(() => {
    if (!isSystemUnlocked(game.state, tab)) {
      const station =
        tab === 'reliquary' ||
        tab === 'furnace' ||
        tab === 'research' ||
        tab === 'yard' ||
        tab === 'protocols' ||
        tab === 'echo' ||
        tab === 'process' ||
        tab === 'specialists' ||
        tab === 'tasks' ||
        tab === 'capital' ||
        tab === 'reinforce' ||
        tab === 'logs'
      setTab(station ? 'stats' : 'dock')
    }
  }, [game.state, tab])

  useEffect(() => {
    setActiveNumberNotation(game.state.meta.numberNotation ?? 'engineering')
  }, [game.state.meta.numberNotation])

  return (
    <div className="app">
      <div className="chrome-top">
      <header className="topbar">
        <p className="brand">Hiveworks</p>
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
            onExtract={() => {
              game.setDocked(true)
              go('dock')
            }}
            onLaunch={() => {
              game.setDocked(false)
            }}
            onUpgrade={game.upgradeModule}
            onPickMilestone={game.pickCoreMilestone}
            onAssign={game.assignWorker}
          />
        )}
        {tab === 'network' && (
          <NetworkTab state={game.state} onAssign={game.assignWorker} />
        )}
        {tab === 'foundry' && (
          <FoundryTab
            state={game.state}
            onSetSlot={game.setFoundrySlot}
            onBuyUpgrade={game.buyFoundryUpgrade}
            onEquip={game.equipFoundryModule}
            onUnequip={game.unequipFoundryModule}
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
        {tab === 'stats' && (
          <StatsTab
            state={game.state}
            onHardReset={game.hardReset}
            onImport={game.applyImportedSave}
            onDevAction={game.applyDevAction}
            onRebuild={() => setHangarOpen(true)}
            onNotation={game.setNumberNotation}
            onOpenStation={go}
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
    </div>
  )
}
