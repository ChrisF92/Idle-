import { useMemo, useState } from 'react'
import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import { formatCompact } from '../../game/format'
import { computeShipStats } from '../../game/state'
import {
  PROTOCOL_MAX_RANK,
  PROTOCOLS,
  activeProtocol,
  canEnterProtocol,
  challengeRankLabel,
  challengeRestrictionLine,
  challengeScenarioLines,
  createEmptyProtocolState,
  protocolBestWave,
  protocolDisabledLine,
  protocolGoalWave,
  protocolNextRewardText,
  protocolRank,
  protocolRewardSummary,
  type ProtocolDef,
} from '../../game/protocols'
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

interface ProtocolsTabProps {
  state: GameState
  onBack: () => void
  onEnter: (id: string) => void
  onAbandon: () => void
}

function challengeHiveStats(state: GameState, def: ProtocolDef): { label: string; value: string }[] {
  const preview: GameState = {
    ...state,
    protocols: { ...(state.protocols ?? createEmptyProtocolState()), activeId: def.id },
  }
  const stats = computeShipStats(preview)
  const lines = [
    { label: 'Starting Wave', value: '1' },
    { label: 'Hull', value: formatCompact(stats.hullMax) },
    { label: 'Shield', value: formatCompact(stats.shieldMax) },
  ]
  if (def.hullMult && def.hullMult !== 1) {
    lines.push({ label: 'Hull modifier', value: `×${def.hullMult}` })
  }
  if (def.enemyDensityMult && def.enemyDensityMult !== 1) {
    lines.push({ label: 'Enemy density', value: `×${def.enemyDensityMult}` })
  }
  switch (def.mute) {
    case 'weapons':
      lines.push({ label: 'Weapon Cores', value: 'Muted' })
      break
    case 'shields':
      lines.push({ label: 'Shield bonuses', value: 'Muted' })
      break
    case 'furnace':
      lines.push({ label: 'Furnace', value: 'Muted' })
      break
    case 'salvage':
      lines.push({ label: 'Salvage from wrecks', value: 'None' })
      break
    case 'foundry':
      lines.push({ label: 'Foundry combat', value: 'Muted' })
      break
    case 'reliquary':
      lines.push({ label: 'Relics', value: 'Muted' })
      break
    case 'network':
      lines.push({ label: 'Encounter density', value: 'Swarm' })
      break
    default:
      break
  }
  return lines
}

function ChallengeCard({
  state,
  def,
  onOpen,
}: {
  state: GameState
  def: ProtocolDef
  onOpen: (id: string) => void
}) {
  const rank = protocolRank(state, def.id)
  const goal = protocolGoalWave(state, def.id)
  const best = protocolBestWave(state, def.id)
  return (
    <SummaryCard
      title={def.name}
      value={challengeRestrictionLine(def)}
      secondary={`Goal Wave ${goal} · Best ${best > 0 ? `Wave ${best}` : 'none'}`}
      progress={rank / PROTOCOL_MAX_RANK}
      action={
        <span className="challenge-card-meta">
          <Badge tone={rank > 0 ? 'ok' : 'default'}>{challengeRankLabel(state, def.id)}</Badge>
          <span className="ui-meta">{protocolRewardSummary(state, def.id)}</span>
        </span>
      }
      onClick={() => onOpen(def.id)}
    />
  )
}

export function ProtocolsTab({ state, onBack, onEnter, onAbandon }: ProtocolsTabProps) {
  const open = isSystemUnlocked(state, 'protocols')
  const active = activeProtocol(state)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? PROTOCOLS.find((p) => p.id === selectedId) : undefined
  const check = selected ? canEnterProtocol(state, selected.id) : { ok: false, reason: undefined }
  const ranks = PROTOCOLS.reduce((n, def) => n + protocolRank(state, def.id), 0)
  const hiveStats = useMemo(
    () => (selected ? challengeHiveStats(state, selected) : []),
    [selected, state],
  )

  return (
    <Screen className="panel screen-panel challenge-screen" label="Challenges">
      <ScreenHeader
        title="Challenges"
        action={
          <button type="button" onClick={onBack}>
            More
          </button>
        }
      />
      <ContextBar>
        <StatPair label="Active" value={active?.name ?? 'None'} />
        <StatPair label="Ranks" value={ranks} />
        <StatPair label="Door" value={`Wave ${ACT1_CADENCE.protocols}`} />
      </ContextBar>
      {!open ? (
        <p className="muted">
          Reach Wave {ACT1_CADENCE.protocols} after Process is online. Challenges reuse the normal Sortie
          engine from Wave 1.
        </p>
      ) : (
        <div className="panel-scroll" data-guide="protocols-list" data-onboarding="onboarding.challenges.list">
          {active ? (
            <Section>
              <SummaryCard
                title={active.name}
                value="Active Challenge"
                secondary={`Goal Wave ${protocolGoalWave(state, active.id)} · this run Wave ${state.combat.wave}`}
                action={
                  <button type="button" data-guide="protocol-abandon" onClick={onAbandon}>
                    Abandon
                  </button>
                }
              />
            </Section>
          ) : null}
          <Section>
            {PROTOCOLS.map((def) => (
              <ChallengeCard
                key={def.id}
                state={state}
                def={def}
                onOpen={setSelectedId}
              />
            ))}
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
        footer={
          selected ? (
            <button
              type="button"
              className="primary"
              disabled={!check.ok || active?.id === selected.id}
              onClick={() => {
                onEnter(selected.id)
                setSelectedId(null)
              }}
            >
              {active?.id === selected.id ? 'Active' : check.ok ? 'Start Challenge' : check.reason}
            </button>
          ) : null
        }
      >
        {selected ? (
          <>
            <p>
              <strong>Restriction.</strong> {selected.restriction}
            </p>
            <p>
              <strong>Disabled systems.</strong> {protocolDisabledLine(selected)}
            </p>
            <Section>
              <h3 className="ui-section-title">Scenario</h3>
              {challengeScenarioLines(selected).map((line) => (
                <p key={line} className="ui-meta">
                  {line}
                </p>
              ))}
            </Section>
            <ContextBar>
              <StatPair label="Goal" value={`Wave ${protocolGoalWave(state, selected.id)}`} />
              <StatPair
                label="Current best"
                value={
                  protocolBestWave(state, selected.id) > 0
                    ? `Wave ${protocolBestWave(state, selected.id)}`
                    : 'None yet'
                }
              />
              <StatPair label="Rank" value={challengeRankLabel(state, selected.id)} />
            </ContextBar>
            <p>
              <strong>Reward.</strong> {protocolNextRewardText(state, selected.id)}
            </p>
            <Section>
              <h3 className="ui-section-title">Modified Hive</h3>
              {hiveStats.map((row) => (
                <StatPair key={row.label} label={row.label} value={row.value} />
              ))}
            </Section>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
