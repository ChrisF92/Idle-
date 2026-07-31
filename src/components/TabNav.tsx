import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isSystemUnlocked, systemUnlockRequirement } from '../game/progression'

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
        const req = systemUnlockRequirement(tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            data-guide={`${tab.id}-tab`}
            className={
              active === tab.id ? 'tab active' : unlocked ? 'tab' : 'tab tab-locked'
            }
            disabled={!unlocked}
            title={unlocked ? tab.label : (req ?? 'Locked')}
            onClick={() => unlocked && onChange(tab.id)}
          >
            {tab.label}
            {!unlocked ? <span className="tab-lock-hint"> · locked</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
