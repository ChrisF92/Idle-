import { useState } from 'react'
import type { GameState } from '../../game/types'
import { unlockedFoundryLogs } from '../../game/logs'
import { BottomSheet, ItemRow, Screen, ScreenHeader } from '../../ui/primitives'

interface LogsTabProps {
  state: GameState
  onBack: () => void
}

export function LogsTab({ state, onBack }: LogsTabProps) {
  const logs = unlockedFoundryLogs(state)
  const [openId, setOpenId] = useState<string | null>(null)
  const selected = logs.find((log) => log.id === openId) ?? null

  return (
    <Screen className="panel screen-panel" label="Foundry Logs">
      <ScreenHeader
        title="Foundry Logs"
        action={
          <button type="button" onClick={onBack}>
            More
          </button>
        }
      />
      <p className="ui-meta">{logs.length} notes on file.</p>
      <div className="panel-scroll">
        {logs.map((log) => (
          <ItemRow key={log.id} title={log.title} onClick={() => setOpenId(log.id)} />
        ))}
      </div>
      <BottomSheet open={Boolean(selected)} title={selected?.title ?? 'Note'} onClose={() => setOpenId(null)}>
        <p>{selected?.body}</p>
      </BottomSheet>
    </Screen>
  )
}
