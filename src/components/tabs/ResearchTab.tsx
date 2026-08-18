import type { GameState, HiveResearchBranch } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_FOCUS_MULT,
  HIVE_RESEARCH_NODES,
  hiveResearchApproachingBreakthrough,
  hiveResearchCompleted,
  hiveResearchNextBreakthrough,
  hiveResearchNodeCost,
  hiveResearchNodeEffectLine,
  hiveResearchUpcoming,
  hiveResearchXp,
  isResearchBreakthrough,
} from '../../game/hiveResearch'
import { formatCompact } from '../../game/format'
import { inspectResearchBranch } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface ResearchTabProps {
  state: GameState
  onBack: () => void
  onFocus: (branch: HiveResearchBranch) => void
  guideTarget?: string | null
}

export function ResearchTab({ state, onBack, onFocus, guideTarget = null }: ResearchTabProps) {
  const open = isSystemUnlocked(state, 'research')
  const focus = state.hiveResearch?.focus ?? 'material'
  const highlightBt = hiveResearchApproachingBreakthrough(state) && guideTarget === 'research-breakthrough'

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
            ? `Focus ${HIVE_RESEARCH_FOCUS_MULT}× on one branch. The others still run.`
            : 'Clear sector 7 to open Research.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Material, Energy, and Observation land here. Archive still makes Data.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted" data-guide="research-branches">
            Material grows the Foundry. Energy powers Furnace and Network. Observation opens Reliquary slots.
          </p>
          {HIVE_RESEARCH_BRANCHES.map((branch) => {
            const done = hiveResearchCompleted(state, branch.id)
            const nodes = HIVE_RESEARCH_NODES[branch.id]
            const xp = hiveResearchXp(state, branch.id)
            const upcoming = hiveResearchUpcoming(state, branch.id)
            const next = upcoming[0]?.node
            const need = next ? hiveResearchNodeCost(done, state) : 0
            const fill = next ? Math.min(1, xp / Math.max(1, need)) : 1
            const focused = focus === branch.id
            const nextBt = hiveResearchNextBreakthrough(state, branch.id)
            const nextIsBt = Boolean(next && isResearchBreakthrough(next))
            return (
              <article
                key={branch.id}
                className={`network-row${nextIsBt ? ' research-row-breakthrough' : ''}${
                  highlightBt && nextIsBt ? ' is-ready' : ''
                }`}
                  data-guide={!focused ? 'research-focus' : undefined}
              >
                <div className="network-row-main">
                  <InspectName name={branch.name} card={inspectResearchBranch(state, branch.id)} />
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
                    ? `${nextIsBt ? 'Breakthrough · ' : ''}${next.name} · ${formatCompact(xp, 1)}/${formatCompact(need)}`
                    : 'Branch complete'}
                </p>
                {next ? <p className="network-row-stats">{next.blurb}</p> : null}
                {nextBt && nextBt.index !== done ? (
                  <p className="research-lookahead">
                    Next breakthrough in {nextBt.index - done} · {nextBt.node.name}
                  </p>
                ) : null}
                {upcoming.length > 0 ? (
                  <ol className="research-preview" data-guide="research-preview">
                    {upcoming.map(({ index, node }) => (
                      <li
                        key={node.name}
                        className={isResearchBreakthrough(node) ? 'research-breakthrough' : undefined}
                        data-guide={isResearchBreakthrough(node) && index === done ? 'research-breakthrough' : undefined}
                      >
                        <strong>
                          {isResearchBreakthrough(node) ? 'Breakthrough' : `+${index - done === 0 ? 'Now' : index - done}`}
                        </strong>
                        {' · '}
                        {node.name}
                        {' — '}
                        {hiveResearchNodeEffectLine(node)}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {done > 0 ? (
                  <ul className="station-node-list">
                    {nodes.slice(0, done).map((node) => (
                      <li
                        key={node.name}
                        className={isResearchBreakthrough(node) ? 'research-breakthrough' : undefined}
                      >
                        {isResearchBreakthrough(node) ? 'Breakthrough · ' : ''}
                        {node.name}
                      </li>
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
