import type { GameState, HiveResearchBranch } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  HIVE_RESEARCH_BRANCHES,
  HIVE_RESEARCH_NODES,
  formatResearchDuration,
  hiveResearchActive,
  hiveResearchBranchUnlocked,
  hiveResearchCompleted,
  hiveResearchNodeCost,
  hiveResearchNodeEffectLine,
  hiveResearchSpeed,
  hiveResearchUpcoming,
  hiveResearchXp,
  isResearchBreakthrough,
} from '../../game/hiveResearch'
import { stationEffectiveDrones } from '../../game/catalog'
import { inspectResearchBranch } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface ResearchTabProps {
  state: GameState
  onBack: () => void
  onFocus: (branch: HiveResearchBranch) => void
  guideTarget?: string | null
}

export function ResearchTab({ state, onBack, onFocus }: ResearchTabProps) {
  const open = isSystemUnlocked(state, 'research')
  const running = hiveResearchActive(state)
  const focus = state.hiveResearch?.focus ?? 'energy'
  const speed = hiveResearchSpeed(state)
  const drones = stationEffectiveDrones(state, 'sensor-net')

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            Systems
          </button>
        </p>
        <h2>Research</h2>
        <p>
          {open
            ? 'One project at a time. It runs during Sorties, at Dock, and offline.'
            : `Reach Wave ${ACT1_CADENCE.research} to open Research.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">Pick a discipline, start its next project, and assign Sensor Net drones to speed it up.</p>
      ) : (
        <div className="panel-scroll">
          <p className="muted" data-guide="research-branches">
            Sensor Net {drones} · speed ×{speed.toFixed(2)}.
          </p>
          {HIVE_RESEARCH_BRANCHES.map((branch) => {
            const locked = !hiveResearchBranchUnlocked(state, branch.id)
            if (locked) {
              return (
                <article key={branch.id} className="network-row">
                  <div className="network-row-main">
                    <span>{branch.name}</span>
                    <span className="muted">Locked</span>
                  </div>
                  <p className="network-row-stats">{branch.blurb}</p>
                  <p className="muted">Opens at Wave {ACT1_CADENCE.mastery} after Process.</p>
                </article>
              )
            }
            const done = hiveResearchCompleted(state, branch.id)
            const nodes = HIVE_RESEARCH_NODES[branch.id]
            const xp = hiveResearchXp(state, branch.id)
            const upcoming = hiveResearchUpcoming(state, branch.id)
            const next = upcoming[0]?.node
            const need = next ? hiveResearchNodeCost(done, state) : 0
            const fill = next ? Math.min(1, xp / Math.max(1, need)) : 1
            const researching = running && focus === branch.id
            const left = next && speed > 0 ? Math.max(0, (need - xp) / speed) : 0
            const nextIsBt = Boolean(next && isResearchBreakthrough(next))
            return (
              <article
                key={branch.id}
                className={`network-row${nextIsBt ? ' research-row-breakthrough' : ''}${
                  researching ? ' is-active' : ''
                }`}
                data-guide={!researching ? 'research-focus' : undefined}
              >
                <div className="network-row-main">
                  <InspectName name={branch.name} card={inspectResearchBranch(state, branch.id)} />
                  <span className="muted">
                    {done}/{nodes.length}
                    {researching ? ' · researching' : ''}
                  </span>
                </div>
                <p className="network-row-stats">{branch.blurb}</p>
                {next ? (
                  <>
                    <div className="network-fill" aria-hidden>
                      <span style={{ width: `${Math.round(fill * 100)}%` }} />
                    </div>
                    <p className="muted">
                      {nextIsBt ? 'Breakthrough · ' : ''}
                      {next.name}
                      {researching
                        ? ` · ${formatResearchDuration(left)} left`
                        : ` · ${formatResearchDuration(need)}`}
                    </p>
                    <p className="network-row-stats">{hiveResearchNodeEffectLine(next)}</p>
                  </>
                ) : (
                  <p className="muted">Discipline complete</p>
                )}
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
                {next ? (
                  <button
                    type="button"
                    className={researching ? 'primary' : undefined}
                    disabled={researching}
                    onClick={() => onFocus(branch.id)}
                    data-guide="research-focus"
                  >
                    {researching ? 'Researching' : 'Research this'}
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
