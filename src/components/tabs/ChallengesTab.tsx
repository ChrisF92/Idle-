import { useMemo, useState } from 'react'
import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import { formatCompact } from '../../game/format'
import { computeShipStats } from '../../game/state'
import {
  CHALLENGE_MAX_MEDAL,
  CHALLENGES,
  activeChallenge,
  canEnterChallenge,
  challengeBestWave,
  challengeDisabledSystems,
  challengeGoalWave,
  challengeMedalLabel,
  challengeMedalRank,
  challengeRewardSummary,
  challengeScenarioLines,
  type ChallengeDef,
} from '../../game/challenges'
import {
  Badge,
  BottomSheet,
  ContextBar,
  Screen,
  ScreenHeader,
  Section,
  StatPair,
  SummaryCard,
} from '../../ui/primitives'

interface ChallengesTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
}

function challengeHiveStats(state: GameState, def: ChallengeDef): { label: string; value: string }[] {
  const preview: GameState = {
    ...state,
    challenges: { ...state.challenges, activeId: def.id },
  }
  const stats = computeShipStats(preview)
  return [
    { label: 'Starting Wave', value: '1' },
    { label: 'Hull', value: formatCompact(stats.hullMax) },
    { label: 'Shield', value: formatCompact(stats.shieldMax) },
  ]
}

function ChallengeCard({ state, def, onOpen }: { state: GameState; def: ChallengeDef; onOpen: (id: string) => void }) {
  const rank = challengeMedalRank(state, def.id)
  const best = challengeBestWave(state, def.id)
  const complete = def.finale ? rank >= 1 : rank >= CHALLENGE_MAX_MEDAL
  return (
    <SummaryCard
      title={def.name}
      value={def.restriction}
      secondary={`Next target W${complete ? def.targetWave : challengeGoalWave(state, def.id)} · Best ${best > 0 ? `W${best}` : 'none'}`}
      progress={def.finale ? rank : rank / CHALLENGE_MAX_MEDAL}
      action={
        <span className="challenge-card-meta">
          <Badge tone={rank > 0 ? 'ok' : 'default'}>{challengeMedalLabel(state, def.id)}</Badge>
          <span className="ui-meta">{challengeRewardSummary(state, def.id)}</span>
        </span>
      }
      onClick={() => onOpen(def.id)}
    />
  )
}

export function ChallengesTab({ state, onBack, onEnter, onAbandon }: ChallengesTabProps) {
  const open = isSystemUnlocked(state, 'challenges')
  const active = activeChallenge(state)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? CHALLENGES.find((row) => row.id === selectedId) : undefined
  const check = selected ? canEnterChallenge(state, selected.id) : { ok: false, reason: undefined }
  const medals = CHALLENGES.reduce((sum, def) => sum + challengeMedalRank(state, def.id), 0)
  const hiveStats = useMemo(() => (selected ? challengeHiveStats(state, selected) : []), [selected, state])

  return (
    <Screen className="panel screen-panel challenge-screen" label="Challenges">
      <ScreenHeader title="Challenges" action={<button type="button" onClick={onBack}>More</button>} />
      <ContextBar>
        <StatPair label="Active" value={active?.name ?? 'None'} />
        <StatPair label="Medals" value={medals} />
        <StatPair label="Door" value={`Wave ${ACT1_CADENCE.challenges}`} />
      </ContextBar>
      {!open ? (
        <p className="muted">Reach Wave {ACT1_CADENCE.challenges}. Challenges use your normal account in a fresh Wave 1 Sortie.</p>
      ) : (
        <div className="panel-scroll" data-guide="challenges-list" data-onboarding="onboarding.challenges.list">
          {active ? (
            <Section>
              <SummaryCard
                title={active.name}
                value="Active Challenge"
                secondary={`Target W${challengeGoalWave(state, active.id)} · this attempt W${state.combat.waveReached}`}
                action={<button type="button" data-guide="challenge-abandon" onClick={onAbandon}>Abandon</button>}
              />
            </Section>
          ) : null}
          <Section>
            {CHALLENGES.map((def) => <ChallengeCard key={def.id} state={state} def={def} onOpen={setSelectedId} />)}
          </Section>
        </div>
      )}
      <BottomSheet
        open={Boolean(selected)}
        title={selected?.name ?? 'Challenge'}
        kicker="Challenge"
        size="full"
        overlayId="challenge-detail"
        onClose={() => setSelectedId(null)}
        footer={selected ? (
          <button
            type="button"
            className="primary"
            disabled={!check.ok || active?.id === selected.id}
            onClick={() => { onEnter(selected.id); setSelectedId(null) }}
          >
            {active?.id === selected.id ? 'Active' : check.ok ? 'Start Challenge' : check.reason}
          </button>
        ) : null}
      >
        {selected ? (
          <>
            <p><strong>Restriction.</strong> {selected.restriction}</p>
            <p><strong>Disabled systems.</strong> {challengeDisabledSystems(selected)}</p>
            <Section>
              <h3 className="ui-section-title">Scenario</h3>
              {challengeScenarioLines(selected).map((line) => <p key={line} className="ui-meta">{line}</p>)}
            </Section>
            <ContextBar>
              <StatPair label="Next target" value={`Wave ${challengeGoalWave(state, selected.id)}`} />
              <StatPair label="Current best" value={challengeBestWave(state, selected.id) > 0 ? `Wave ${challengeBestWave(state, selected.id)}` : 'None yet'} />
              <StatPair label="Medal" value={challengeMedalLabel(state, selected.id)} />
            </ContextBar>
            <p><strong>Reward.</strong> {challengeRewardSummary(state, selected.id)}</p>
            <Section>
              <h3 className="ui-section-title">Modified Hive</h3>
              {hiveStats.map((row) => <StatPair key={row.label} label={row.label} value={row.value} />)}
            </Section>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
