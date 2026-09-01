import { useMemo, useState } from 'react'
import type {
  FoundryRecipeId,
  GameState,
  ProcessCondition,
  ProcessNetworkPreset,
  ProcessProfile,
  ProcessRule,
  ProcessThenKind,
  ProcessWhenKind,
} from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  NETWORK_PRESET_LABELS,
  PROCESS_LANES,
  PROCESS_NODES,
  canBuyProcessNode,
  firstAffordableProcessNode,
  hasProcess,
  processActiveAutomationCount,
  processAllowsAnd,
  processAllowsOr,
  processAutomationCards,
  processAvailable,
  processConfig,
  processLaneNodes,
  processMaxConditions,
  processRuleCapacity,
  processRulesUsed,
} from '../../game/process'
import {
  PROCESS_THEN_OPTIONS,
  PROCESS_WHEN_OPTIONS,
  activeProcessProfile,
  blankProcessAction,
  blankProcessCondition,
  blankProcessRule,
  formatProcessRule,
  normalizeSpend,
} from '../../game/processProfiles'
import { processPointSourcesByGroup } from '../../game/processPoints'
import { FOUNDRY_RECIPES } from '../../game/foundry'
import {
  hiveResearchAvailableNodes,
  hiveResearchQueueCap,
  HIVE_RESEARCH_BRANCHES,
} from '../../game/hiveResearch'
import { WORKER_JOB_IDS, workerJobLabel } from '../../game/workers'
import { STATIONS } from '../../game/catalog'
import { DIRECTIVES } from '../../game/directives'
import { SheetTabs } from '../SheetTabs'
import {
  Badge,
  BottomSheet,
  ContextBar,
  EmptyState,
  InfoButton,
  Screen,
  ScreenHeader,
  Section,
  SectionHeader,
  StatPair,
  SummaryCard,
} from '../../ui/primitives'
import { useSyncedPane } from '../../hooks/useSyncedPane'

type ProcessPane = 'capabilities' | 'automations' | 'rules' | 'profiles'

const PROCESS_PANES: { id: ProcessPane; label: string }[] = [
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'automations', label: 'Automations' },
  { id: 'rules', label: 'Rules' },
  { id: 'profiles', label: 'Profiles' },
]

interface ProcessTabProps {
  state: GameState
  onBack: () => void
  onBuy: (id: string) => void
  onConfig?: (config: GameState['process']['config']) => void
  guideTarget?: string | null
}

function nodeTone(state: GameState, id: string): 'owned' | 'available' | 'locked' {
  if (hasProcess(state, id)) return 'owned'
  return canBuyProcessNode(state, id).ok ? 'available' : 'locked'
}

function patchConfig(
  state: GameState,
  onConfig: (config: GameState['process']['config']) => void,
  mutate: (next: GameState['process']['config']) => void,
) {
  const next = structuredClone(processConfig(state))
  mutate(next)
  onConfig(next)
}

function CapabilityGraph({
  state,
  onSelect,
  guideId,
}: {
  state: GameState
  onSelect: (id: string) => void
  guideId: string | null
}) {
  return (
    <div className="process-graph">
      {PROCESS_LANES.map((lane) => {
        const nodes = processLaneNodes(state, lane.id)
        if (nodes.length === 0) return null
        return (
          <div key={lane.id} className="process-lane">
            <span className="process-lane-label">{lane.name}</span>
            <div className="process-lane-track">
              {nodes.map((node) => {
                const tone = nodeTone(state, node.id)
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`process-graph-node is-${tone}`}
                    onClick={() => onSelect(node.id)}
                    data-guide={guideId === node.id ? 'process-first-buy' : undefined}
                    data-onboarding={guideId === node.id ? 'onboarding.process.first-capability' : undefined}
                    aria-label={node.name}
                  >
                    <span className="process-graph-icon" />
                    <span className="process-graph-name">{node.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NodeConfig({
  state,
  nodeId,
  onConfig,
}: {
  state: GameState
  nodeId: string
  onConfig: (config: GameState['process']['config']) => void
}) {
  const cfg = processConfig(state)
  const patch = (mutate: (next: GameState['process']['config']) => void) => patchConfig(state, onConfig, mutate)

  if (nodeId === 'sortie-auto-buy' || nodeId === 'spend-profiles') {
    return (
      <div className="process-config-block" data-guide="process-config">
        {nodeId === 'sortie-auto-buy' ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.shop.autoBuy}
              onChange={(e) => patch((c) => { c.shop.autoBuy = e.target.checked })}
            />
            Auto-buy Attack / Defense / Economy
          </label>
        ) : null}
        {(['attack', 'defense', 'economy'] as const).map((key) => (
          <label key={key} className="process-config">
            {key === 'attack' ? 'Attack %' : key === 'defense' ? 'Defense %' : 'Economy %'}
            <input
              type="number"
              min={0}
              value={cfg.shop.ratios[key]}
              onChange={(e) => patch((c) => { c.shop.ratios[key] = Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        ))}
        <label className="process-config">
          Salvage reserve
          <input
            type="number"
            min={0}
            value={cfg.shop.salvageReserve}
            onChange={(e) => patch((c) => { c.shop.salvageReserve = Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
      </div>
    )
  }
  if (nodeId === 'worker-presets' || nodeId === 'worker-auto-fill') {
    return (
      <div className="process-config-block" data-guide="process-config">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.network.enabled}
            onChange={(e) => patch((c) => { c.network.enabled = e.target.checked })}
          />
          Auto Fill on
        </label>
        <label className="process-config">
          Preset
          <select
            value={cfg.network.preset}
            onChange={(e) => patch((c) => { c.network.preset = e.target.value as ProcessNetworkPreset })}
          >
            {(Object.keys(NETWORK_PRESET_LABELS) as ProcessNetworkPreset[])
              .filter((id) => id !== 'custom' || hasProcess(state, 'worker-weights'))
              .map((id) => (
                <option key={id} value={id}>
                  {NETWORK_PRESET_LABELS[id]}
                </option>
              ))}
          </select>
        </label>
      </div>
    )
  }
  if (nodeId === 'worker-weights') {
    const jobs = STATIONS.filter((station) => WORKER_JOB_IDS.includes(station.id))
    return (
      <div className="process-config-block">
        {jobs.map((job) => (
          <label key={job.id} className="process-config">
            {workerJobLabel(job.id, job.name)}
            <input
              type="number"
              min={0}
              value={cfg.network.ratios[job.id] ?? 0}
              onChange={(e) =>
                patch((c) => {
                  c.network.ratios[job.id] = Math.max(0, Number(e.target.value) || 0)
                  c.network.preset = 'custom'
                })
              }
            />
          </label>
        ))}
      </div>
    )
  }
  if (nodeId === 'processing-repeat' || nodeId === 'dependency-processing' || nodeId === 'material-stock-targets') {
    const stockEntries = Object.entries(cfg.foundry.minStock ?? {})
    return (
      <div className="process-config-block">
        {nodeId !== 'material-stock-targets' ? (
          <label className="process-config">
            {nodeId === 'dependency-processing' ? 'Target' : 'Repeat'}
            <select
              value={(nodeId === 'dependency-processing' ? cfg.foundry.targetRecipe : cfg.foundry.repeatRecipe) ?? ''}
              onChange={(e) =>
                patch((c) => {
                  const id = (e.target.value || null) as FoundryRecipeId | null
                  if (nodeId === 'dependency-processing') c.foundry.targetRecipe = id
                  else c.foundry.repeatRecipe = id
                })
              }
            >
              <option value="">None</option>
              {FOUNDRY_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="process-config">
              Material
              <select
                value={stockEntries[0]?.[0] ?? ''}
                onChange={(e) =>
                  patch((c) => {
                    const min = stockEntries[0]?.[1] ?? 100
                    c.foundry.minStock = e.target.value ? { [e.target.value as FoundryRecipeId]: min } : {}
                  })
                }
              >
                <option value="">None</option>
                {FOUNDRY_RECIPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="process-config">
              Keep ≥
              <input
                type="number"
                min={0}
                value={stockEntries[0]?.[1] ?? 0}
                onChange={(e) =>
                  patch((c) => {
                    const id = (stockEntries[0]?.[0] ?? 'recovered-stock') as FoundryRecipeId
                    c.foundry.minStock = { [id]: Math.max(0, Number(e.target.value) || 0) }
                  })
                }
              />
            </label>
          </>
        )}
      </div>
    )
  }
  if (nodeId === 'dependency-processing') {
    const cap = 3
    const queue = [...cfg.foundry.queue]
    while (queue.length < cap) queue.push('' as FoundryRecipeId)
    return (
      <div className="process-config-block" data-guide="process-foundry-queue">
        <p className="muted">Production queue · {cap} slots</p>
        {queue.slice(0, cap).map((id, i) => (
          <label key={i} className="process-config">
            {i + 1}
            <select
              value={id}
              onChange={(e) =>
                patch((c) => {
                  const next = [...c.foundry.queue]
                  while (next.length < cap) next.push('' as FoundryRecipeId)
                  next[i] = e.target.value as FoundryRecipeId
                  c.foundry.queue = next.filter(Boolean) as FoundryRecipeId[]
                })
              }
            >
              <option value="">Empty</option>
              {FOUNDRY_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    )
  }
  if (nodeId === 'auto-extract' || nodeId === 'repeat-sortie') {
    return (
      <div className="process-config-block">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.sortie.autoExtract}
            onChange={(e) => patch((c) => { c.sortie.autoExtract = e.target.checked })}
          />
          Auto Extract
        </label>
        <label className="process-config">
          Hull %
          <input
            type="number"
            min={5}
            max={90}
            value={Math.round(cfg.sortie.extractHullPct * 100)}
            onChange={(e) =>
              patch((c) => {
                c.sortie.extractHullPct = Math.min(0.9, Math.max(0.05, (Number(e.target.value) || 35) / 100))
              })
            }
          />
        </label>
        {hasProcess(state, 'repeat-sortie') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.sortie.autoRelaunch}
              onChange={(e) => patch((c) => { c.sortie.autoRelaunch = e.target.checked })}
            />
            Auto Launch
          </label>
        ) : null}
      </div>
    )
  }
  if (nodeId === 'directive-preference') {
    const choices = Array.from({ length: 3 }, (_, index) => cfg.sortie.directivePreference[index] ?? '')
    return (
      <div className="process-config-block">
        <p className="muted">Pick the highest offered Directive in this order. If none appear, continue unchanged.</p>
        {choices.map((id, index) => (
          <label key={index} className="process-config">
            Priority {index + 1}
            <select
              value={id}
              onChange={(e) => patch((c) => {
                const next = [...c.sortie.directivePreference]
                next[index] = e.target.value
                c.sortie.directivePreference = next.filter(Boolean).filter((value, i, all) => all.indexOf(value) === i)
              })}
            >
              <option value="">None</option>
              {DIRECTIVES.map((directive) => (
                <option key={directive.id} value={directive.id}>{directive.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    )
  }
  if (nodeId === 'research-queue-assist' || nodeId === 'research-preference') {
    const available = hiveResearchAvailableNodes(state)
    const cap = hiveResearchQueueCap(state)
    const queue = [...cfg.research.queue]
    while (queue.length < cap) queue.push('')
    return (
      <div className="process-config-block" data-guide="process-research-queue">
        {hasProcess(state, 'research-preference') ? (
          <>
            <label className="process-config" data-guide="process-research-auto">
              <input
                type="checkbox"
                checked={cfg.research.autoResearch}
                onChange={(e) => patch((c) => { c.research.autoResearch = e.target.checked })}
              />
              Continue visible branch after queue exhaustion
            </label>
            <label className="process-config">
              Preferred discipline
              <select
                value={cfg.research.branchPriority[0] ?? 'energy'}
                onChange={(e) => patch((c) => {
                  const selected = e.target.value as (typeof c.research.branchPriority)[number]
                  c.research.branchPriority = [selected, ...c.research.branchPriority.filter((id) => id !== selected)]
                })}
              >
                {HIVE_RESEARCH_BRANCHES.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
          </>
        ) : null}
        {hasProcess(state, 'research-queue-assist') ? (
          <>
            <p className="muted">Queue · {cap} slots</p>
            {queue.slice(0, cap).map((id, i) => (
              <label key={i} className="process-config">
                {i + 1}
                <select
                  value={id}
                  onChange={(e) =>
                    patch((c) => {
                      const next = [...c.research.queue]
                      while (next.length < cap) next.push('')
                      next[i] = e.target.value
                      c.research.queue = next.filter(Boolean)
                    })
                  }
                >
                  <option value="">Empty</option>
                  {available.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        ) : null}
      </div>
    )
  }
  if (nodeId === 'ash-budgeting' || nodeId === 'furnace-presets' || nodeId === 'furnace-auto-ignite') {
    return (
      <div className="process-config-block">
        <label className="process-config">
          Preset
          <select value={cfg.furnace.preset ?? 'push'} onChange={(e) => patch((c) => { c.furnace.preset = e.target.value })}>
            <option value="push">Push</option>
            <option value="farm">Farm</option>
            <option value="industry">Industry</option>
            <option value="research">Research</option>
          </select>
        </label>
        {hasProcess(state, 'ash-budgeting') ? (
          <label className="process-config">
            Maximum Ash budget
            <input type="number" min={0} value={cfg.furnace.reserveHeat} onChange={(e) => patch((c) => { c.furnace.reserveHeat = Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        ) : null}
        {hasProcess(state, 'furnace-auto-ignite') ? (
          <label className="process-config">
            <input type="checkbox" checked={cfg.furnace.autoChannel} onChange={(e) => patch((c) => { c.furnace.autoChannel = e.target.checked })} />
            Allow one-time Ignite when an enabled rule triggers
          </label>
        ) : null}
        <p className="muted">Process cannot alter an Ignited Furnace.</p>
      </div>
    )
  }
  if (nodeId === 'challenge-profile') {
    return (
      <div className="process-config-block">
        <p className="muted">Loads the CHALLENGE automation profile during an active Challenge. It never starts or bypasses a Challenge.</p>
      </div>
    )
  }
  return null
}

function RuleEditor({
  state,
  rule,
  onChange,
}: {
  state: GameState
  rule: ProcessRule
  onChange: (next: ProcessRule) => void
}) {
  const maxWhen = Math.max(1, processMaxConditions(state))
  const canAnd = processAllowsAnd(state)
  const canOr = processAllowsOr(state)
  const setWhen = (index: number, cond: ProcessCondition) => {
    const when = rule.when.map((row, i) => (i === index ? cond : row))
    onChange({ ...rule, when })
  }
  return (
    <div className="process-rule-editor">
      <label className="process-config">
        Name
        <input value={rule.label ?? ''} onChange={(e) => onChange({ ...rule, label: e.target.value })} />
      </label>
      <p className="combat-hud-kicker">WHEN</p>
      {rule.when.map((cond, index) => {
        const opt = PROCESS_WHEN_OPTIONS.find((row) => row.id === cond.kind)
        return (
          <div key={`${rule.id}-w-${index}`} className="process-rule-chip-row">
            {index > 0 ? (
              <button
                type="button"
                className="process-join-chip"
                disabled={!canOr && !canAnd}
                onClick={() => onChange({ ...rule, join: rule.join === 'or' && canOr ? 'and' : canOr ? 'or' : 'and' })}
              >
                {rule.join === 'or' && canOr ? 'OR' : 'AND'}
              </button>
            ) : null}
            <select
              value={cond.kind}
              onChange={(e) => setWhen(index, { ...cond, kind: e.target.value as ProcessWhenKind })}
            >
              {PROCESS_WHEN_OPTIONS.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
            {opt?.needsRecipe ? (
              <select
                value={cond.recipeId ?? ''}
                onChange={(e) => setWhen(index, { ...cond, recipeId: e.target.value as FoundryRecipeId })}
              >
                {FOUNDRY_RECIPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : null}
            {cond.kind === 'profile-is' ? (
              <select
                value={cond.profileId ?? ''}
                onChange={(e) => setWhen(index, { ...cond, profileId: e.target.value })}
              >
                <option value="">Choose profile</option>
                {processConfig(state).profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            ) : null}
            {opt?.needsValue ? (
              <input
                type="number"
                min={0}
                value={cond.value ?? 0}
                onChange={(e) => setWhen(index, { ...cond, value: Math.max(0, Number(e.target.value) || 0) })}
              />
            ) : null}
          </div>
        )
      })}
      {rule.when.length < maxWhen ? (
        <button type="button" onClick={() => onChange({ ...rule, when: [...rule.when, blankProcessCondition()] })}>
          Add condition
        </button>
      ) : null}
      <p className="combat-hud-kicker">THEN</p>
      <select
        value={rule.then.kind}
        onChange={(e) => onChange({ ...rule, then: { ...blankProcessAction(), kind: e.target.value as ProcessThenKind } })}
      >
        {PROCESS_THEN_OPTIONS.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
      {rule.then.kind === 'spend-profile' || rule.then.kind === 'spend-ratios' ? (
        <div className="process-config-block">
          {(['attack', 'defense', 'economy'] as const).map((key) => (
            <label key={key} className="process-config">
              {key}
              <input
                type="number"
                min={0}
                value={rule.then.spend?.[key] ?? 0}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    then: {
                      ...rule.then,
                      spend: normalizeSpend({
                        attack: rule.then.spend?.attack ?? 0,
                        defense: rule.then.spend?.defense ?? 0,
                        economy: rule.then.spend?.economy ?? 0,
                        [key]: Math.max(0, Number(e.target.value) || 0),
                      }),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      {rule.then.kind === 'worker-preset' ? (
        <select
          value={rule.then.workerPreset ?? 'balanced'}
          onChange={(e) => onChange({ ...rule, then: { ...rule.then, workerPreset: e.target.value as ProcessNetworkPreset } })}
        >
          {(Object.keys(NETWORK_PRESET_LABELS) as ProcessNetworkPreset[]).map((id) => (
            <option key={id} value={id}>
              {NETWORK_PRESET_LABELS[id]}
            </option>
          ))}
        </select>
      ) : null}
      {rule.then.kind === 'furnace-preset' ? (
        <select
          value={rule.then.furnacePreset ?? 'push'}
          onChange={(e) => onChange({ ...rule, then: { ...rule.then, furnacePreset: e.target.value } })}
        >
          <option value="push">Push</option>
          <option value="farm">Farm</option>
          <option value="industry">Industry</option>
          <option value="research">Research</option>
        </select>
      ) : null}
      {rule.then.kind === 'switch-profile' ? (
        <select
          value={rule.then.profileId ?? ''}
          onChange={(e) => onChange({ ...rule, then: { ...rule.then, profileId: e.target.value } })}
        >
          <option value="">Choose profile</option>
          {processConfig(state).profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
      ) : null}
      {rule.then.kind === 'foundry-target' || rule.then.kind === 'repeat-recipe' || rule.then.kind === 'foundry-stock' ? (
        <>
          <select
            value={rule.then.recipeId ?? ''}
            onChange={(e) => onChange({ ...rule, then: { ...rule.then, recipeId: e.target.value as FoundryRecipeId } })}
          >
            {FOUNDRY_RECIPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {rule.then.kind === 'foundry-stock' ? (
            <input
              type="number"
              min={0}
              value={rule.then.stockMin ?? 0}
              onChange={(e) => onChange({ ...rule, then: { ...rule.then, stockMin: Math.max(0, Number(e.target.value) || 0) } })}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function profileSummary(profile: ProcessProfile): string[] {
  const spend = normalizeSpend(profile.spend)
  return [
    `Sortie ${spend.attack}/${spend.defense}/${spend.economy} · Reserve ${profile.salvageReserve}`,
    `Workers ${profile.workerPreset ? NETWORK_PRESET_LABELS[profile.workerPreset] : '—'}`,
    `Furnace ${profile.furnacePreset ?? '—'}`,
    `Extract ${profile.autoExtract ? `ON · Hull ${Math.round(profile.extractHullPct * 100)}%` : 'Off'}`,
    `Foundry ${profile.foundryRepeat ?? '—'} · Research ${profile.researchAutoNext ? 'auto-next' : 'manual'}`,
  ]
}

export function ProcessTab({
  state,
  onBack,
  onBuy,
  onConfig,
  guideTarget,
}: ProcessTabProps) {
  const open = isSystemUnlocked(state, 'process')
  const [pane, setPane] = useSyncedPane<ProcessPane>('capabilities')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ruleId, setRuleId] = useState<string | null>(null)
  const [pointsOpen, setPointsOpen] = useState(false)
  const cfg = processConfig(state)
  const points = Math.floor(processAvailable(state))
  const autos = processActiveAutomationCount(state)
  const profile = activeProcessProfile(state)
  const rulesUsed = processRulesUsed(state)
  const ruleCap = processRuleCapacity(state)
  const firstBuy = firstAffordableProcessNode(state)
  const selectedNode = PROCESS_NODES.find((n) => n.id === selectedId)
  const ruleProfile = profile ?? cfg.profiles.find((p) => p.id === 'custom') ?? cfg.profiles[0]
  const editingRule = ruleProfile?.rules.find((r) => r.id === ruleId) ?? null
  const groups = processPointSourcesByGroup(state)
  const check = selectedNode ? canBuyProcessNode(state, selectedNode.id) : { ok: false, reason: 'Unknown node' }

  const selectedBlurb = useMemo(() => {
    if (!selectedNode) return null
    const prior = selectedNode.requiresId ? PROCESS_NODES.find((n) => n.id === selectedNode.requiresId) : undefined
    return (
      <>
        <p>{selectedNode.blurb}</p>
        <p className="ui-meta">{selectedNode.cost} Process Points</p>
        {!hasProcess(state, selectedNode.id) && prior && !hasProcess(state, prior.id) ? (
          <p className="ui-meta">Need {prior.name}</p>
        ) : null}
        {hasProcess(state, selectedNode.id) && onConfig ? (
          <NodeConfig state={state} nodeId={selectedNode.id} onConfig={onConfig} />
        ) : null}
      </>
    )
  }, [onConfig, selectedNode, state])

  if (!open) {
    return (
      <Screen className="panel screen-panel process-screen" label="Process">
        <ScreenHeader
          title="Process"
          action={
            <button type="button" onClick={onBack}>
              Systems
            </button>
          }
        />
        <p className="muted">
          Complete Process Kernel in Computational Systems Research.
        </p>
      </Screen>
    )
  }

  return (
    <Screen className="panel screen-panel process-screen" label="Process">
      <ScreenHeader
        title="Process"
        action={
          <span className="process-header-actions">
            <InfoButton label="Process Points sources" onClick={() => setPointsOpen(true)} />
            <button type="button" onClick={onBack}>
              Systems
            </button>
          </span>
        }
      />
      <ContextBar>
        <StatPair label="Process Points" value={points} />
        <StatPair label="Automations" value={autos} />
        <StatPair label="Profile" value={profile?.name ?? 'None'} />
        <StatPair label="Rules" value={`${rulesUsed} / ${ruleCap}`} />
      </ContextBar>
      <SheetTabs value={pane} onChange={setPane} options={PROCESS_PANES} label="Process navigation" />
      <div className="panel-scroll process-scroll">
        {pane === 'capabilities' ? (
          <Section>
            <SectionHeader title="Capability graph" />
            <CapabilityGraph
              state={state}
              onSelect={setSelectedId}
              guideId={
                guideTarget === 'process-first-buy' || guideTarget === 'onboarding.process.first-capability'
                  ? firstBuy?.id ?? null
                  : null
              }
            />
          </Section>
        ) : null}
        {pane === 'automations' ? (
          <Section>
            <SectionHeader title="Active automations" />
            {processAutomationCards(state).length === 0 ? (
              <EmptyState title="No automations yet" body="Buy Sortie, Foundry, Research, or Furnace capabilities first." />
            ) : (
              processAutomationCards(state).map((card) => (
                <article key={card.id} className="process-auto-card">
                  <header>
                    <strong>{card.name}</strong>
                    {onConfig && ['sortie-auto-buy', 'auto-extract', 'repeat-sortie', 'worker-auto-fill', 'research-preference', 'furnace-auto-ignite'].includes(card.id) ? (
                      <button
                        type="button"
                        className={card.enabled ? 'sheet-tab active' : 'sheet-tab'}
                        onClick={() =>
                          patchConfig(state, onConfig, (next) => {
                            if (card.id === 'sortie-auto-buy') next.shop.autoBuy = !next.shop.autoBuy
                            if (card.id === 'auto-extract') next.sortie.autoExtract = !next.sortie.autoExtract
                            if (card.id === 'repeat-sortie') next.sortie.autoRelaunch = !next.sortie.autoRelaunch
                            if (card.id === 'worker-auto-fill') next.network.enabled = !next.network.enabled
                            if (card.id === 'research-preference') next.research.autoResearch = !next.research.autoResearch
                            if (card.id === 'furnace-auto-ignite') next.furnace.autoChannel = !next.furnace.autoChannel
                          })
                        }
                      >
                        {card.enabled ? 'ON' : 'OFF'}
                      </button>
                    ) : (
                      <Badge tone={card.enabled ? 'ok' : 'default'}>{card.enabled ? 'ON' : 'OFF'}</Badge>
                    )}
                  </header>
                  <p>{card.summary}</p>
                  <p className="ui-meta">Last action · {card.lastAction}</p>
                </article>
              ))
            )}
          </Section>
        ) : null}
        {pane === 'rules' ? (
          <Section>
            <SectionHeader
              title="Rules"
              action={
                onConfig && ruleProfile && hasProcess(state, 'rule-builder') ? (
                  <button
                    type="button"
                    disabled={ruleProfile.rules.length >= Math.max(1, ruleCap)}
                    onClick={() =>
                      patchConfig(state, onConfig, (next) => {
                        const p = next.profiles.find((row) => row.id === ruleProfile.id)
                        if (!p) return
                        if (p.rules.length >= processRuleCapacity(state)) return
                        p.rules.push(blankProcessRule(p.rules.length))
                      })
                    }
                  >
                    Add rule
                  </button>
                ) : null
              }
            />
            {!hasProcess(state, 'rule-builder') ? (
              <EmptyState title="Buy First Condition" body="Rules use real Wave, Hull, stock, and idle values." />
            ) : (
              (ruleProfile?.rules ?? []).map((rule) => {
                const view = formatProcessRule(rule)
                return (
                  <button key={rule.id} type="button" className="process-rule-card" onClick={() => setRuleId(rule.id)}>
                    <p className="combat-hud-kicker">WHEN</p>
                    {view.when.map((line, i) => (
                      <p key={`${rule.id}-${line}-${i}`}>
                        {i > 0 ? `${view.join} ` : ''}
                        {line}
                      </p>
                    ))}
                    <p className="combat-hud-kicker">THEN</p>
                    <p>{view.then}</p>
                  </button>
                )
              })
            )}
          </Section>
        ) : null}
        {pane === 'profiles' ? (
          <Section>
            <SectionHeader title="Profiles" />
            {(cfg.profiles ?? []).map((row) => (
              <SummaryCard
                key={row.id}
                title={row.name}
                value={cfg.activeProfileId === row.id ? 'Active' : 'Preset'}
                secondary={profileSummary(row).join(' · ')}
                onClick={
                  onConfig && hasProcess(state, 'process-profiles')
                    ? () => patchConfig(state, onConfig, (next) => { next.activeProfileId = row.id })
                    : undefined
                }
              />
            ))}
            {!hasProcess(state, 'process-profiles') ? (
              <p className="ui-meta">Buy Process Profiles to activate Farm, Push, Blueprint, Challenge, or Custom.</p>
            ) : null}
          </Section>
        ) : null}
      </div>
      <BottomSheet
        open={Boolean(selectedNode)}
        title={selectedNode?.name ?? 'Capability'}
        onClose={() => setSelectedId(null)}
        footer={
          selectedNode && !hasProcess(state, selectedNode.id) ? (
            <button
              type="button"
              className="primary"
              disabled={!check.ok}
              onClick={() => {
                onBuy(selectedNode.id)
                setSelectedId(null)
              }}
            >
              {check.ok ? `Buy · ${selectedNode.cost}` : check.reason}
            </button>
          ) : null
        }
      >
        {selectedBlurb}
      </BottomSheet>
      <BottomSheet
        open={Boolean(editingRule && ruleProfile && onConfig)}
        title={editingRule?.label || 'Rule'}
        size="full"
        onClose={() => setRuleId(null)}
        footer={
          editingRule && onConfig ? (
            <button
              type="button"
              onClick={() => {
                patchConfig(state, onConfig, (next) => {
                  const p = next.profiles.find((row) => row.id === ruleProfile?.id)
                  if (!p) return
                  p.rules = p.rules.filter((row) => row.id !== editingRule.id)
                })
                setRuleId(null)
              }}
            >
              Delete rule
            </button>
          ) : null
        }
      >
        {editingRule && ruleProfile && onConfig ? (
          <RuleEditor
            state={state}
            rule={editingRule}
            onChange={(nextRule) =>
              patchConfig(state, onConfig, (next) => {
                const p = next.profiles.find((row) => row.id === ruleProfile.id)
                if (!p) return
                p.rules = p.rules.map((row) => (row.id === nextRule.id ? nextRule : row))
              })
            }
          />
        ) : null}
      </BottomSheet>
      <BottomSheet open={pointsOpen} title="Process Points" onClose={() => setPointsOpen(false)}>
        <p>Points come from account mastery. Time passing does not award them.</p>
        {groups.map((group) => (
          <section key={group.group}>
            <h3 className="foundry-heading">{group.label}</h3>
            {group.earned.map((row) => (
              <p key={row.id}>
                Earned · {row.name} · {row.points} pts
              </p>
            ))}
            {group.upcoming.slice(0, 4).map((row) => (
              <p key={row.id} className="ui-meta">
                Upcoming · {row.name} · {row.points} pts
              </p>
            ))}
          </section>
        ))}
      </BottomSheet>
    </Screen>
  )
}
