import { useMemo, useState } from 'react'
import type { GameState, HiveResearchBranch } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  HIVE_RESEARCH_BRANCHES,
  formatResearchDuration,
  getHiveResearchNode,
  hiveResearchActive,
  hiveResearchActiveNode,
  hiveResearchBranchUnlocked,
  hiveResearchCombatSpeed,
  hiveResearchExtraUtilitySlots,
  hiveResearchFurnaceSlots,
  hiveResearchNodeDuration,
  hiveResearchNodeEffectLine,
  hiveResearchProcessCostMult,
  hiveResearchProgress,
  hiveResearchQueueCap,
  hiveResearchRemaining,
  hiveResearchSpeed,
  hiveResearchVisibleNodes,
  hiveResearchWorkshopStartRanks,
  isResearchBreakthrough,
  researchNodeViewState,
  type HiveResearchNodeDef,
} from '../../game/hiveResearch'
import { stationEffectiveDrones, droneCap } from '../../game/catalog'
import { foundryFabSlotCount, foundrySlotCount } from '../../game/foundry'
import { SheetTabs } from '../SheetTabs'
import {
  Badge,
  BottomSheet,
  ContextBar,
  Screen,
  ScreenHeader,
  Section,
  SectionHeader,
  StatPair,
} from '../../ui/primitives'
import { useSyncedPane } from '../../hooks/useSyncedPane'

interface ResearchTabProps {
  state: GameState
  onBack: () => void
  onStart: (nodeId: string) => void
  onFocus?: (branch: HiveResearchBranch) => void
  guideTarget?: string | null
  requestedBranch?: HiveResearchBranch | null
}

const BRANCH_TABS = HIVE_RESEARCH_BRANCHES.map((branch) => ({
  id: branch.id,
  label: branch.tab,
}))

function workerDuration(state: GameState, node: HiveResearchNodeDef, extraWorkers = 0): number {
  const assigned = Math.max(0, Math.floor(state.base.assignments['sensor-net'] ?? 0))
  const probe: GameState = {
    ...state,
    base: {
      ...state.base,
      assignments: {
        ...state.base.assignments,
        'sensor-net': assigned + extraWorkers,
      },
    },
  }
  const speed = hiveResearchSpeed(probe)
  return hiveResearchNodeDuration(node, state) / Math.max(0.01, speed)
}

function effectPreview(state: GameState, node: HiveResearchNodeDef): string[] {
  const lines: string[] = []
  if (node.furnaceSlots) {
    const now = 1 + hiveResearchFurnaceSlots(state)
    lines.push(`Furnace channels ${now} → ${now + node.furnaceSlots}`)
  }
  if (node.foundrySlots) {
    const now = foundrySlotCount(state)
    lines.push(`Processors ${now} → ${now + node.foundrySlots}`)
  }
  if (node.foundryFitSlots) {
    const now = foundryFabSlotCount(state)
    lines.push(`Fabricators ${now} → ${now + node.foundryFitSlots}`)
  }
  if (node.droneCapBonus) {
    const now = droneCap(state)
    lines.push(`Worker capacity ${now} → ${now + node.droneCapBonus}`)
  }
  if (node.extraUtilitySlots) {
    const now = hiveResearchExtraUtilitySlots(state)
    lines.push(`Utility Core slots ${now} → ${now + node.extraUtilitySlots}`)
  }
  if (node.workshopStartRanks) {
    const now = hiveResearchWorkshopStartRanks(state)
    lines.push(`Rebuild Workshop ranks ${now} → ${now + node.workshopStartRanks}`)
  }
  if (node.combatSpeed && node.combatSpeed > 1) {
    const now = hiveResearchCombatSpeed(state)
    lines.push(`Combat speed ×${now} → ×${Math.max(now, node.combatSpeed)}`)
  }
  if (node.processCostMult) {
    const now = hiveResearchProcessCostMult(state)
    lines.push(`Process costs ×${now} → ×${(now * node.processCostMult).toFixed(2)}`)
  }
  if (node.researchQueueSlots) {
    const now = hiveResearchQueueCap(state)
    lines.push(`Research queue ${now} → ${now + node.researchQueueSlots}`)
  }
  return [...new Set(lines.filter((line) => line && line !== hiveResearchNodeEffectLine(node)))]
}

function ResearchGraph({
  state,
  branch,
  onSelect,
  spotlightAvailable,
}: {
  state: GameState
  branch: HiveResearchBranch
  onSelect: (node: HiveResearchNodeDef) => void
  spotlightAvailable?: boolean
}) {
  const nodes = hiveResearchVisibleNodes(state, branch)
  const cols = Math.max(1, ...nodes.map((node) => node.col + 1))
  const rows = Math.max(1, ...nodes.map((node) => node.row + 1))
  const lookup = new Map(nodes.map((node) => [node.id, node]))

  return (
    <div
      className="research-graph"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(3.6rem, 1fr))`,
        gridTemplateRows: `repeat(${rows}, 4.6rem)`,
      }}
    >
      <svg className="research-graph-edges" aria-hidden>
        {nodes.flatMap((node) =>
          node.prerequisites.map((id) => {
            const from = lookup.get(id)
            if (!from) return null
            const x1 = ((from.col + 0.5) / cols) * 100
            const y1 = ((from.row + 0.5) / rows) * 100
            const x2 = ((node.col + 0.5) / cols) * 100
            const y2 = ((node.row + 0.5) / rows) * 100
            return (
              <line
                key={`${id}-${node.id}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
              />
            )
          }),
        )}
      </svg>
      {nodes.map((node) => {
        const view = researchNodeViewState(state, node)
        const revealed = view === 'completed' || view === 'active' || view === 'available'
        return (
          <button
            key={node.id}
            type="button"
            className={[
              'research-graph-node',
              isResearchBreakthrough(node) ? 'is-breakthrough' : '',
              `is-${view}`,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ gridColumn: node.col + 1, gridRow: node.row + 1 }}
            onClick={() => onSelect(node)}
            data-guide={view === 'available' ? 'research-focus' : undefined}
            data-onboarding={
              spotlightAvailable && view === 'available' ? 'onboarding.research.available-node' : undefined
            }
            aria-label={revealed ? node.name : 'Locked project'}
          >
            <span className="research-graph-icon" />
            {revealed ? <span className="research-graph-name">{node.shortName}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function ResearchTab({ state, onBack, onStart, requestedBranch, guideTarget }: ResearchTabProps) {
  const open = isSystemUnlocked(state, 'research')
  const running = hiveResearchActiveNode(state)
  const defaultBranch = running?.branch ?? 'energy'
  const [branch, setBranch] = useSyncedPane<HiveResearchBranch>(defaultBranch, requestedBranch)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? getHiveResearchNode(selectedId) : null
  const selectedView = selected ? researchNodeViewState(state, selected) : null
  const drones = stationEffectiveDrones(state, 'sensor-net')
  const speed = hiveResearchSpeed(state)
  const need = running ? hiveResearchNodeDuration(running, state) : 0
  const have = running ? hiveResearchProgress(state) : 0
  const pct = need > 0 ? Math.min(100, Math.round((100 * have) / need)) : 0
  const left = running && speed > 0 ? hiveResearchRemaining(state) / speed : 0
  const discipline = HIVE_RESEARCH_BRANCHES.find((row) => row.id === branch)!
  const selectedDiscipline = selected
    ? HIVE_RESEARCH_BRANCHES.find((row) => row.id === selected.branch)?.name ?? discipline.name
    : discipline.name
  const locked = !hiveResearchBranchUnlocked(state, branch)

  const sheetBody = useMemo(() => {
    if (!selected) return null
    const duration = workerDuration(state, selected)
    const plus = workerDuration(state, selected, 1)
    return (
      <>
        <p>{selected.blurb}</p>
        <p className="ui-meta">{hiveResearchNodeEffectLine(selected)}</p>
        {effectPreview(state, selected).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>Duration {formatResearchDuration(duration)}</p>
        <p className="ui-meta">
          {selected.prerequisites.length
            ? `Requires ${selected.prerequisites.map((id) => getHiveResearchNode(id)?.name ?? id).join(', ')}`
            : 'No prerequisites'}
        </p>
        <p className="ui-meta">
          {drones > 0
            ? `${drones} Worker Drones · +1 Worker → ${formatResearchDuration(plus)}`
            : `Assign Worker Drones to shorten this. +1 Worker → ${formatResearchDuration(plus)}`}
        </p>
      </>
    )
  }, [drones, selected, state])

  return (
    <Screen className="panel screen-panel research-screen" label="Research">
      <ScreenHeader
        title="Research"
        action={
          <button type="button" onClick={onBack}>
            Systems
          </button>
        }
      />
      <ContextBar>
        <StatPair label="Project" value={running?.name ?? 'Idle'} />
        <StatPair label="Progress" value={running ? `${pct}%` : '—'} />
        <StatPair label="Remaining" value={running ? formatResearchDuration(left) : '—'} />
        <StatPair label="Speed" value={`×${speed.toFixed(2)}`} />
        <StatPair label="Workers" value={drones} />
      </ContextBar>
      {!open ? (
        <p className="muted">Reach Wave {ACT1_CADENCE.research} to open Research.</p>
      ) : (
        <>
          <SheetTabs
            value={branch}
            onChange={setBranch}
            options={BRANCH_TABS}
            label="Research disciplines"
          />
          <div className="panel-scroll research-scroll">
            <Section>
              <SectionHeader
                title={discipline.name}
                action={
                  selectedView === 'active' || running?.branch === branch ? <Badge tone="ok">Active</Badge> : undefined
                }
              />
              <p className="ui-meta">{discipline.blurb}</p>
              {locked ? (
                <p className="muted">Opens at Wave {ACT1_CADENCE.mastery} after Process.</p>
              ) : (
                <ResearchGraph
                  state={state}
                  branch={branch}
                  onSelect={(node) => setSelectedId(node.id)}
                  spotlightAvailable={
                    guideTarget === 'onboarding.research.available-node' || guideTarget === 'research-focus'
                  }
                />
              )}
            </Section>
          </div>
        </>
      )}
      <BottomSheet
        open={Boolean(selected) && !locked}
        title={selected?.name ?? 'Project'}
        kicker={selectedDiscipline}
        onClose={() => setSelectedId(null)}
        footer={
          selected && selectedView === 'available' ? (
            <button
              type="button"
              className="primary"
              data-guide="research-focus"
              data-onboarding={
                guideTarget === 'onboarding.research.available-node' ? 'onboarding.research.available-node' : undefined
              }
              disabled={hiveResearchActive(state)}
              onClick={() => {
                onStart(selected.id)
                setSelectedId(null)
              }}
            >
              Start Research
            </button>
          ) : selectedView === 'active' ? (
            <p className="ui-meta">This project is already running.</p>
          ) : selectedView === 'completed' ? (
            <p className="ui-meta">Complete. Permanent.</p>
          ) : (
            <p className="ui-meta">Locked until its prerequisites finish.</p>
          )
        }
      >
        {sheetBody}
      </BottomSheet>
    </Screen>
  )
}
