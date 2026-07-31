import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isSystemUnlocked } from '../game/progression'

const TABS: { id: TabId; label: string }[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'shipyard', label: 'Shipyard' },
  { id: 'base', label: 'Base' },
  { id: 'research', label: 'Research' },
  { id: 'core', label: 'Core' },
  { id: 'codex', label: 'Codex' },
  { id: 'ai', label: 'AI' },
  { id: 'prestige', label: 'Prestige' },
  { id: 'stats', label: 'Stats' },
]

interface TabNavProps {
  active: TabId
  onChange: (tab: TabId) => void
  state: GameState
}

export function TabNav({ active, onChange, state }: TabNavProps) {
  return (
    <nav className="tab-nav" aria-label="Game systems">
      {TABS.map((tab) => {
        const unlocked = isSystemUnlocked(state, tab.id)
        if (!unlocked) return null
        return (
          <button
            key={tab.id}
            type="button"
            data-guide={`${tab.id}-tab`}
            className={active === tab.id ? 'tab active' : 'tab'}
            title={tab.label}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
