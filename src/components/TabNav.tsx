import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isSystemUnlocked } from '../game/progression'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dock', label: 'Dock', icon: '⌂' },
  { id: 'combat', label: 'Sortie', icon: '▲' },
  { id: 'network', label: 'Network', icon: '◈' },
  { id: 'foundry', label: 'Foundry', icon: '▣' },
  { id: 'stats', label: 'More', icon: '☰' },
]

interface TabNavProps {
  active: TabId
  onChange: (tab: TabId) => void
  state: GameState
}

export function TabNav({ active, onChange, state }: TabNavProps) {
  const moreActive =
    active === 'stats' || active === 'reliquary' || active === 'furnace' || active === 'research'
  return (
    <nav className="bottom-nav" aria-label="Game systems">
      {TABS.map((tab) => {
        const unlocked = isSystemUnlocked(state, tab.id)
        if (tab.id === 'foundry' && !unlocked) return null
        const isActive = tab.id === 'stats' ? moreActive : active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            data-guide={`${tab.id}-tab`}
            className={isActive ? 'nav-item active' : 'nav-item'}
            disabled={!unlocked}
            title={tab.label}
            onClick={() => unlocked && onChange(tab.id)}
          >
            <span className="nav-icon" aria-hidden>
              {tab.icon}
            </span>
            <span className="nav-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
