import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isHubTabOpen } from '../game/progression'
import { attentionAria, systemsTabAttention, tabAttention } from '../game/hubAttention'
import { isMoreNavTab, isSystemsNavTab } from '../game/moreStations'
import { AttentionPips } from './AttentionPips'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'combat', label: 'Sortie', icon: '▲' },
  { id: 'dock', label: 'Dock', icon: '⌂' },
  { id: 'foundry', label: 'Systems', icon: '▣' },
  { id: 'stats', label: 'More', icon: '☰' },
]

interface TabNavProps {
  active: TabId
  onChange: (tab: TabId) => void
  state: GameState
}

export function TabNav({ active, onChange, state }: TabNavProps) {
  const moreActive = isMoreNavTab(active)
  const systemsActive = isSystemsNavTab(active)
  return (
    <nav className="bottom-nav" aria-label="Game systems">
      {TABS.map((tab) => {
        const unlocked = isHubTabOpen(state, tab.id)
        if ((tab.id === 'foundry' || tab.id === 'stats' || tab.id === 'dock') && !unlocked) {
          return null
        }
        const isActive =
          tab.id === 'stats' ? moreActive : tab.id === 'foundry' ? systemsActive : active === tab.id
        const flags = tab.id === 'foundry' ? systemsTabAttention(state) : tabAttention(state, tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            data-guide={`${tab.id}-tab`}
            className={isActive ? 'nav-item active' : 'nav-item'}
            disabled={!unlocked}
            title={attentionAria(tab.label, flags)}
            aria-label={attentionAria(tab.label, flags)}
            onClick={() => unlocked && onChange(tab.id)}
          >
            <span className="nav-icon" aria-hidden>
              {tab.icon}
            </span>
            <span className="nav-label">{tab.label}</span>
            <AttentionPips spend={flags.spend} fresh={flags.fresh} />
          </button>
        )
      })}
    </nav>
  )
}
