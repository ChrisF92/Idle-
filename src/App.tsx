import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TabId } from './game/types'
import { useGame } from './hooks/useGame'
import { computeResourceRates } from './game/tick'
import { isSystemUnlocked } from './game/progression'
import { wavesForSector } from './game/sectors'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { OfflineBanner } from './components/OfflineBanner'
import { DockTab } from './components/tabs/DockTab'
import { CombatTab } from './components/tabs/CombatTab'
import { CoresTab } from './components/tabs/CoresTab'
import { StatsTab } from './components/tabs/StatsTab'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import './App.css'

export default function App() {
  const game = useGame()
  const [tab, setTab] = useState<TabId>('dock')
  const rates = useMemo(() => computeResourceRates(game.state), [game.state])
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
      setTab('dock')
    }
  }, [game.state, tab])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">Hiveworks</p>
          <p className="tagline">Foundry idle — USI combat, player-launched sorties</p>
        </div>
        {live ? (
          <button type="button" className="combat-chip" onClick={() => go('combat')}>
            Live S{game.state.combat.sector} W{game.state.combat.wave}/{waves} · hull{' '}
            {Math.ceil(game.state.combat.playerHull)}
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

      <ResourceBar state={game.state} rates={rates} />
      <TabNav active={tab} onChange={go} state={game.state} />

      <main className="main">
        {tab === 'dock' && (
          <DockTab
            state={game.state}
            onLaunch={() => {
              game.setDocked(false)
              go('combat')
            }}
            onOpenSortie={() => go('combat')}
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
          />
        )}
        {tab === 'cores' && (
          <CoresTab state={game.state} onUpgrade={game.upgradeModule} />
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
    </div>
  )
}
