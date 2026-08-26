import type { GameState, SortieSummary } from '../game/types'
import { formatCompact } from '../game/format'
import { isFirstDefeatReport } from '../game/playerGuidance'
import { getModule } from '../game/catalog'
import { corePrimaryOutput } from '../game/coreProgression'
import { formatRunTime } from '../game/uiReadout'

interface SortieReportProps {
  summary: SortieSummary
  state: GameState
  onClose: () => void
  onDock?: () => void
  onRunAgain?: () => void
  onViewCore?: (moduleId: string) => void
}

function spendPct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((100 * part) / total)}%`
}

export function SortieReport({ summary, state, onClose, onDock, onRunAgain, onViewCore }: SortieReportProps) {
  const defeat = summary.outcome === 'defeat'
  const firstDefeat = defeat && isFirstDefeatReport(state)
  const goDock = () => {
    onDock?.()
    onClose()
  }
  const runAgain = () => {
    if (firstDefeat) {
      goDock()
      return
    }
    onRunAgain?.()
    onClose()
  }
  const spend = summary.spendByCategory
  const spendTotal = (spend?.attack ?? 0) + (spend?.defense ?? 0) + (spend?.economy ?? 0)
  const stats = summary.stats
  const bossLeft =
    stats?.lastIsBoss && stats.finalEnemyHpMax > 0
      ? Math.round((100 * stats.finalEnemyHp) / stats.finalEnemyHpMax)
      : null
  const cores = (summary.cores ?? []).length > 0
    ? summary.cores!
    : state.shipyard.modules.map((id, slot) => ({
        moduleId: id,
        slot,
        runLevel: 0,
        masteryStart: 0,
        masteryEnd: 0,
        masteryXp: 0,
        salvageSpent: 0,
        contribution: 0,
        bossClears: 0,
        newBestBonus: false,
        milestones: [] as number[],
      }))

  return (
    <div className="modal-backdrop sortie-report-backdrop" role="dialog" aria-labelledby="sortie-report-title">
      <div className="modal-sheet sortie-report-sheet">
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">{defeat ? 'SORTIE COMPLETE' : 'EXTRACTED'}</p>
            <h3 id="sortie-report-title">
              {summary.previousBest > 0 ? `W${summary.previousBest} → W${summary.wave}` : `W${summary.wave}`}
              {summary.newBest ? ' · NEW BEST' : ''}
              {summary.newBest && summary.previousBest > 0 ? ` +${summary.wave - summary.previousBest}` : ''}
            </h3>
            <p className="muted">{formatRunTime(stats?.finalFightTime ?? 0)}</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        {firstDefeat ? (
          <>
            <p>
              Wave {summary.wave}
              {summary.newBest ? ' · New Best' : ''}
              {stats?.kills ? ` · ${stats.kills} destroyed` : ''}.
            </p>
            <p>
              You recovered <strong>{formatCompact(summary.scrapEarned)} Scrap</strong>.
            </p>
            <p className="muted">
              Salvage from that Sortie is gone. Scrap survives. Spend it in Workshop so the next Sortie
              starts stronger.
            </p>
          </>
        ) : (
          <>
            {summary.note ? <p className="muted">{summary.note}</p> : null}
            <section>
              <p className="combat-hud-kicker">Rewards</p>
              <div className="stat-row dock-stats">
                <div>
                  <span className="muted">Scrap earned</span>
                  <strong>+{formatCompact(summary.scrapEarned)}</strong>
                </div>
                {summary.outcome === 'extract' ? (
                  <div>
                    <span className="muted">Extraction bonus</span>
                    <strong>+{formatCompact(summary.extractionBonusScrap ?? 0)}</strong>
                  </div>
                ) : null}
                {summary.fragmentsEarned > 0 ? (
                  <div>
                    <span className="muted">Fragments</span>
                    <strong>+{formatCompact(summary.fragmentsEarned)}</strong>
                  </div>
                ) : null}
                {summary.ashEarned > 0 ? (
                  <div>
                    <span className="muted">Ash</span>
                    <strong>+{formatCompact(summary.ashEarned)}</strong>
                  </div>
                ) : null}
                {summary.dataEarned > 0 ? (
                  <div>
                    <span className="muted">Data</span>
                    <strong>+{formatCompact(summary.dataEarned)}</strong>
                  </div>
                ) : null}
              </div>
            </section>

            {spendTotal > 0 ? (
              <section>
                <p className="combat-hud-kicker">Spending</p>
                <div className="stat-row dock-stats">
                  <div>
                    <span className="muted">Attack</span>
                    <strong>{spendPct(spend.attack, spendTotal)}</strong>
                  </div>
                  <div>
                    <span className="muted">Defense</span>
                    <strong>{spendPct(spend.defense, spendTotal)}</strong>
                  </div>
                  <div>
                    <span className="muted">Economy</span>
                    <strong>{spendPct(spend.economy, spendTotal)}</strong>
                  </div>
                </div>
              </section>
            ) : null}

            {cores.length > 0 ? (
              <section>
                <p className="combat-hud-kicker">Core performance</p>
                <ul className="sortie-next">
                  {cores.map((row) => {
                    const name = getModule(row.moduleId)?.name ?? row.moduleId
                    const leveled = row.masteryEnd > row.masteryStart
                    const milestone = row.milestones[row.milestones.length - 1]
                    const out = corePrimaryOutput(state, row.slot)
                    return (
                      <li key={`${row.moduleId}-${row.slot}`}>
                        <strong>{name}</strong>
                        {leveled ? ` — M${row.masteryStart} → M${row.masteryEnd}` : ''}
                        {milestone ? ` · Mastery milestone M${milestone}` : ''}
                        <span className="muted">
                          {' '}
                          {row.masteryXp > 0 ? `+${row.masteryXp} Mastery XP` : 'No Mastery XP'}
                          {out ? ` · ${formatCompact(out.current)} ${out.label}` : ''}
                        </span>
                        {onViewCore && (leveled || milestone) ? (
                          <>
                            {' '}
                            <button type="button" onClick={() => onViewCore(row.moduleId)}>
                              View Core
                            </button>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <section>
              <p className="combat-hud-kicker">Sortie facts</p>
              <ul>
                {defeat ? <li>Hull reached zero.</li> : <li>Extraction · Safe return. No Matter.</li>}
                {bossLeft != null ? <li>Boss remained at {bossLeft}% HP.</li> : null}
                {stats?.finalFightTime > 0 ? (
                  <li>Final encounter {formatRunTime(stats.finalFightTime)}.</li>
                ) : null}
                {stats?.damageDealt > 0 ? <li>Damage dealt {formatCompact(stats.damageDealt)}.</li> : null}
                {stats?.damageTaken > 0 ? <li>Damage taken {formatCompact(stats.damageTaken)}.</li> : null}
              </ul>
            </section>
          </>
        )}

        <p className="assign-row sortie-report-actions">
          <button type="button" onClick={goDock}>
            Dock
          </button>
          <button type="button" className="primary" onClick={runAgain}>
            {firstDefeat ? 'Continue' : 'Run Again'}
          </button>
        </p>
      </div>
    </div>
  )
}
