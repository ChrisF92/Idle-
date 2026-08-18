import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { TASKS, TASK_UNLOCK_SECTOR, taskListProgress } from '../../game/tasks'
import { CAPITAL_UNLOCK_SECTOR } from '../../game/capital'

interface TasksTabProps {
  state: GameState
  onBack: () => void
}

export function TasksTab({ state, onBack }: TasksTabProps) {
  const open = isSystemUnlocked(state, 'tasks')
  const { done, total } = taskListProgress(state)

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Task List</h2>
        <p>
          {open
            ? `${done}/${total} done · Capital at sector ${CAPITAL_UNLOCK_SECTOR} when the list is complete`
            : `Clear sector ${TASK_UNLOCK_SECTOR} to open the list.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">A checklist. Finish it to open Capital.</p>
      ) : (
        <div className="panel-scroll" data-guide="tasks-list">
          {TASKS.map((task) => {
            const ok = task.done(state)
            return (
              <article key={task.id} className="network-row">
                <div className="network-row-main">
                  <strong>{task.name}</strong>
                  <span className="muted">{ok ? 'Done' : 'Open'}</span>
                </div>
                <p className="network-row-stats">{task.blurb}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
