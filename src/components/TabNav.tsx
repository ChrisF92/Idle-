import type { TabId } from '../game/types'

const TABS: { id: TabId; label: string }[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'shipyard', label: 'Shipyard' },
  { id: 'base', label: 'Base' },
  { id: 'research', label: 'Research' },
  { id: 'codex', label: 'Codex' },
  { id: 'ai', label: 'AI' },
  { id: 'prestige', label: 'Prestige' },
  { id: 'stats', label: 'Stats' },
]

interface TabNavProps {
  active: TabId
  onChange: (tab: TabId) => void
}

export function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav className="tab-nav" aria-label="Game systems">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? 'tab active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
