import type { TabId } from '../game/types'
import type { GameState } from '../game/types'
import { isHubTabOpen } from '../game/progression'
import { attentionAria, tabAttention } from '../game/hubAttention'
import { AttentionPips } from './AttentionPips'

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
    active === 'stats' ||
    active === 'reliquary' ||
    active === 'furnace' ||
    active === 'research' ||
    active === 'yard' ||
    active === 'slag' ||
    active === 'protocols' ||
    active === 'echo' ||
    active === 'process' ||
    active === 'specialists' ||
    active === 'tasks' ||
    active === 'capital' ||
    active === 'reinforce' ||
    active === 'logs' ||
    active === 'codex'
  return (
    <nav className="bottom-nav" aria-label="Game systems">
      {TABS.map((tab) => {
        const unlocked = isHubTabOpen(state, tab.id)
        if ((tab.id === 'foundry' || tab.id === 'network' || tab.id === 'stats' || tab.id === 'dock') && !unlocked) {
          return null
        }
        const isActive = tab.id === 'stats' ? moreActive : active === tab.id
        const flags = tabAttention(state, tab.id)
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
