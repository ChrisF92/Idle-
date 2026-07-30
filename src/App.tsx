import { useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { CombatTab } from './components/tabs/CombatTab'
import { ShipyardTab } from './components/tabs/ShipyardTab'
import { BaseTab } from './components/tabs/BaseTab'
import { ResearchTab } from './components/tabs/ResearchTab'
import { AiTab } from './components/tabs/AiTab'
import { PrestigeTab } from './components/tabs/PrestigeTab'
import { StatsTab } from './components/tabs/StatsTab'
import './App.css'

export default function App() {
  const { state, engage, hardReset, applyImportedSave } = useGame()
  const [tab, setTab] = useState<TabId>('combat')

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">Cosmic Idle</p>
          <p className="tagline">Working title — fleet vs entities</p>
        </div>
      </header>

      <ResourceBar resources={state.resources} />
      <TabNav active={tab} onChange={setTab} />

      <main className="main">
        {tab === 'combat' && <CombatTab state={state} onEngage={engage} />}
        {tab === 'shipyard' && <ShipyardTab state={state} />}
        {tab === 'base' && <BaseTab state={state} />}
        {tab === 'research' && <ResearchTab state={state} />}
        {tab === 'ai' && <AiTab state={state} />}
        {tab === 'prestige' && <PrestigeTab state={state} />}
        {tab === 'stats' && (
          <StatsTab state={state} onHardReset={hardReset} onImport={applyImportedSave} />
        )}
      </main>
    </div>
  )
}
