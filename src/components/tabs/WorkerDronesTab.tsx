import type { GameState } from '../../game/types'
import { droneCap, idleWorkers, STATIONS, visibleWorkerJobIds } from '../../game/catalog'
import { workerJobConsequence } from '../../game/workerReadout'
import { workerAllocationSummary, workerJobCap } from '../../game/workers'
import {
  ContextBar,
  Screen,
  ScreenHeader,
  Section,
  SectionHeader,
  StatPair,
} from '../../ui/primitives'

interface WorkerDronesTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onOptimise?: () => void
  guideTarget?: string | null
  onBack?: () => void
}

export function WorkerDronesTab({ state, onAssign, onOptimise, guideTarget, onBack }: WorkerDronesTabProps) {
  const summary = workerAllocationSummary(state)
  const capacity = droneCap(state)
  const idle = idleWorkers(state)
  const openIds = new Set(visibleWorkerJobIds(state))
  const jobs = STATIONS.filter((station) => openIds.has(station.id))

  return (
    <Screen className="panel screen-panel worker-drones-screen" label="Worker Drones">
      <ScreenHeader
        title="Worker Drones"
        action={onBack ? <button type="button" onClick={onBack}>Systems</button> : undefined}
      />
      <ContextBar>
        <StatPair label="Total" value={summary.total} />
        <StatPair label="Assigned" value={summary.assigned} />
        <StatPair label="Idle" value={summary.idle} />
        <StatPair label="Capacity" value={capacity} />
      </ContextBar>
      <div className="panel-scroll worker-drones-scroll">
        <Section>
          <SectionHeader
            title="Active Work"
            action={onOptimise ? (
              <button type="button" onClick={onOptimise}>Balance</button>
            ) : undefined}
          />
          <div className="worker-job-list">
            {jobs.map((job) => {
              const effect = workerJobConsequence(state, job.id)
              const assigned = effect.assigned
              return (
                <article
                  key={job.id}
                  className="worker-job-card"
                  data-guide={`worker-${job.id}`}
                  data-onboarding={job.id === 'scrap-field' ? 'onboarding.workers.salvage' : undefined}
                >
                  <strong className="worker-job-title">{effect.title}</strong>
                  <span className="worker-job-assignment">
                    {assigned} Worker{assigned === 1 ? '' : 's'}
                  </span>
                  <span className="ui-meta">{effect.band}</span>
                  <span>{effect.current}</span>
                  <span className="ui-meta">{effect.next}</span>
                  <div className="worker-stepper">
                    <button
                      type="button"
                      disabled={assigned <= 0}
                      aria-label={`Remove Worker Drone from ${effect.title}`}
                      onClick={() => onAssign(job.id, -1)}
                    >
                      −
                    </button>
                    <strong aria-live="polite">{assigned}</strong>
                    <button
                      type="button"
                      data-guide={`worker-${job.id}`}
                      data-onboarding={
                        job.id === 'scrap-field' && guideTarget === 'onboarding.workers.salvage'
                          ? 'onboarding.workers.salvage'
                          : undefined
                      }
                      disabled={idle <= 0 || assigned >= workerJobCap(job.id).hard}
                      aria-label={`Assign Worker Drone to ${effect.title}`}
                      onClick={() => onAssign(job.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </Section>
      </div>
    </Screen>
  )
}
