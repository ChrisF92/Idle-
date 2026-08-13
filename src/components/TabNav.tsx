import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isSystemUnlocked } from '../game/progression'

const TABS: { id: TabId; label: string }[] = [
  { id: 'dock', label: 'Dock' },
  { id: 'combat', label: 'Sortie' },
  { id: 'cores', label: 'Cores' },
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
        if (!isSystemUnlocked(state, tab.id)) return null
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
