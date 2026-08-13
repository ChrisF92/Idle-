import type { GameState, HiveResearchBranch } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_FOCUS_MULT,
  HIVE_RESEARCH_NODES,
  hiveResearchCompleted,
  hiveResearchNodeCost,
  hiveResearchXp,
} from '../../game/hiveResearch'
import { formatCompact } from '../../game/format'

interface ResearchTabProps {
  state: GameState
  onBack: () => void
  onFocus: (branch: HiveResearchBranch) => void
}

export function ResearchTab({ state, onBack, onFocus }: ResearchTabProps) {
  const open = isSystemUnlocked(state, 'research')
  const focus = state.hiveResearch?.focus ?? 'material'

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Research</h2>
        <p>
          {open
            ? `Focus ${HIVE_RESEARCH_FOCUS_MULT}× on one branch. Kills feed all three.`
            : 'Clear sector 7 to open Research.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Material, Energy, and Observation land here. Archive still makes Data.</p>
      ) : (
        <div className="panel-scroll">
          {HIVE_RESEARCH_BRANCHES.map((branch) => {
            const done = hiveResearchCompleted(state, branch.id)
            const nodes = HIVE_RESEARCH_NODES[branch.id]
            const xp = hiveResearchXp(state, branch.id)
            const next = nodes[done]
            const need = next ? hiveResearchNodeCost(done) : 0
            const fill = next ? Math.min(1, xp / Math.max(1, need)) : 1
            const focused = focus === branch.id
            return (
              <article key={branch.id} className="network-row">
                <div className="network-row-main">
                  <strong>{branch.name}</strong>
                  <span className="muted">
                    {done}/{nodes.length}
                    {focused ? ' · focus' : ''}
                  </span>
                </div>
                <p className="network-row-stats">{branch.blurb}</p>
                <div className="network-fill" aria-hidden>
                  <span style={{ width: `${Math.round(fill * 100)}%` }} />
                </div>
                <p className="muted">
                  {next
                    ? `${next.name} · ${formatCompact(xp, 1)}/${formatCompact(need)}`
                    : 'Branch complete'}
                </p>
                {next ? <p className="network-row-stats">{next.blurb}</p> : null}
                {done > 0 ? (
                  <ul className="station-node-list">
                    {nodes.slice(0, done).map((node) => (
                      <li key={node.name}>{node.name}</li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className={focused ? 'primary' : undefined}
                  disabled={focused}
                  onClick={() => onFocus(branch.id)}
                >
                  {focused ? 'Focused' : `Focus ${HIVE_RESEARCH_FOCUS_MULT}×`}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
