import { useState } from 'react'
import type { FabJobKind, FacilityId, FoundryRecipeId, GameState } from '../../game/types'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  PART_TYPES,
  blueprintFragmentTotals,
  blueprintProgress,
  formatPrintSourceLine,
  getBlueprint,
  getModule,
  isCorePrintUnlocked,
  listFoundryPrintCards,
  modulePrintWave,
} from '../../game/catalog'
import { canAssembleBlueprint } from '../../game/actions'
import {
  FOUNDRY_FACILITIES,
  FOUNDRY_PANE_LABELS,
  FOUNDRY_RECIPES,
  canStartFabrication,
  craftsForNextLevel,
  fabricationJobLabel,
  fabricationJobTime,
  formatFoundryCost,
  foundryCraftOutput,
  foundryCraftTime,
  foundryFabSlotCount,
  foundryFabricationSpeed,
  foundryFacilityCommitted,
  foundryMasteryEffect,
  foundryMasteryStepsFor,
  foundryMaterialCount,
  foundryMissingCost,
  foundryNextMastery,
  foundryOwnedCount,
  foundryProcessingSpeed,
  foundryReachedMastery,
  foundryRecipeLevel,
  foundrySlotCount,
  getFacility,
  getFoundryRecipe,
  isFoundryRecipeUnlocked,
  scaledFoundryCost,
  type FoundryCost,
  type FoundryPaneId,
} from '../../game/foundry'
import { careerBestWave } from '../../game/waves'
import { formatCompact } from '../../game/format'
import {
  SHARDS,
  getShard,
  relicTier,
  shardEffectBlurb,
} from '../../game/reliquary'
import { isSystemUnlocked } from '../../game/progression'
import { workerJobCap } from '../../game/workers'
import { SheetTabs } from '../SheetTabs'
import {
  Badge,
  BottomSheet,
  ContextBar,
  EmptyState,
  ItemGrid,
  ItemRow,
  Screen,
  ScreenHeader,
  Section,
  SectionHeader,
  StatPair,
  SummaryCard,
} from '../../ui/primitives'
import { useSyncedPane } from '../../hooks/useSyncedPane'
import { markLocalOk } from '../../hooks/useJustBecame'

export type FoundryPane = FoundryPaneId
type FabricationStateFilter = 'ready' | 'all' | 'tracked'
type FabricationCategory = 'core' | 'relic' | 'infrastructure'
type BlueprintCategory = 'core' | 'relic' | 'hive' | 'industry'

const FOUNDRY_PANES: { id: FoundryPane; label: string }[] = [
  { id: 'processing', label: FOUNDRY_PANE_LABELS.processing },
  { id: 'fabrication', label: FOUNDRY_PANE_LABELS.fabrication },
  { id: 'mastery', label: FOUNDRY_PANE_LABELS.mastery },
  { id: 'blueprints', label: FOUNDRY_PANE_LABELS.blueprints },
]

const FAB_STATE_FILTERS: { id: FabricationStateFilter; label: string }[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'all', label: 'All' },
  { id: 'tracked', label: 'Tracked' },
]

const FAB_CATEGORIES: { id: FabricationCategory; label: string }[] = [
  { id: 'core', label: 'Cores' },
  { id: 'relic', label: 'Relics' },
  { id: 'infrastructure', label: 'Infrastructure' },
]

const BLUEPRINT_CATEGORIES: { id: BlueprintCategory; label: string }[] = [
  { id: 'core', label: 'Cores' },
  { id: 'relic', label: 'Relics' },
  { id: 'hive', label: 'Hive' },
  { id: 'industry', label: 'Industry' },
]

interface FoundryTabProps {
  state: GameState
  onSetSlot: (slotIndex: number, recipeId: string | null) => void
  onFabricateCore: (moduleId: string) => void
  onTrack?: (moduleId: string | null) => void
  onStartRelic?: (relicId: string) => void
  onStartFacility?: (id: FacilityId) => void
  onStopFabrication?: (slotIndex: number) => void
  guideTarget?: string | null
  focusTarget?: string | null
  requestedPane?: FoundryPane | 'smelt' | 'prints' | 'build' | 'ranks' | 'fit' | null
  onBack?: () => void
}

interface FabricationProject {
  kind: FabJobKind
  jobId: string
  sourceId?: string
  category: FabricationCategory
  name: string
  purpose: string
  time: number
  cost: FoundryCost
  ready: boolean
  reason?: string
  tracked?: boolean
  blueprintLine: string
  effect: string
  inProgress?: boolean
}

function paneFromHints(
  guideTarget?: string | null,
  focusTarget?: string | null,
  requestedPane?: FoundryTabProps['requestedPane'],
): FoundryPane | null {
  if (requestedPane === 'processing' || requestedPane === 'fabrication' || requestedPane === 'mastery' || requestedPane === 'blueprints') {
    return requestedPane
  }
  if (requestedPane === 'smelt' || requestedPane === 'ranks') return requestedPane === 'ranks' ? 'mastery' : 'processing'
  if (requestedPane === 'prints' || requestedPane === 'fit') return 'blueprints'
  if (requestedPane === 'build') return 'fabrication'
  if (focusTarget?.startsWith('project-')) return 'fabrication'
  if (focusTarget?.startsWith('blueprint-') || focusTarget?.startsWith('print-')) return 'blueprints'
  if (focusTarget === 'foundry-build' || guideTarget === 'foundry-build' || guideTarget === 'yard-grid') return 'fabrication'
  if (guideTarget === 'foundry-mastery') return 'mastery'
  if (
    guideTarget === 'foundry-smelters' ||
    guideTarget === 'foundry-recipes' ||
    guideTarget === 'foundry-chain' ||
    guideTarget?.startsWith('foundry-recipe-')
  ) {
    return 'processing'
  }
  return null
}

function roman(index: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][index] ?? String(index + 1)
}

function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds))
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const secs = value % 60
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function processingWorkers(state: GameState): number {
  return Math.max(0, state.base.assignments['alloy-foundry'] ?? 0)
}

function fabricationWorkers(state: GameState, kind: FabJobKind | null): number {
  return Math.max(0, state.base.assignments[kind === 'facility' ? 'construction' : 'fab-bay'] ?? 0)
}

function foundryWorkers(state: GameState): number {
  return processingWorkers(state) +
    Math.max(0, state.base.assignments['fab-bay'] ?? 0) +
    Math.max(0, state.base.assignments.construction ?? 0)
}

function materialLines(cost: FoundryCost): string[] {
  const lines: string[] = []
  if (cost.scrap) lines.push(`${cost.scrap} Scrap`)
  if (cost.salvage) lines.push(`${cost.salvage} Salvage`)
  for (const [id, amount] of Object.entries(cost.materials ?? {})) {
    if (!amount) continue
    lines.push(`${amount} ${getFoundryRecipe(id)?.name ?? id}`)
  }
  return lines
}

function completeChain(recipeId: FoundryRecipeId, seen = new Set<string>()): string[] {
  if (seen.has(recipeId)) return []
  seen.add(recipeId)
  const recipe = getFoundryRecipe(recipeId)
  if (!recipe) return []
  const lines: string[] = []
  for (const input of Object.keys(recipe.costs.materials ?? {})) {
    lines.push(...completeChain(input as FoundryRecipeId, seen))
  }
  lines.push(`${formatFoundryCost(recipe.costs)} → ${recipe.name}`)
  return lines
}

function coreEffectLine(moduleId: string): string {
  const def = getModule(moduleId)
  if (!def) return 'Core definition unavailable.'
  const bits = [def.description]
  if (def.weapon) bits.push(`Damage ${formatCompact(def.weapon.damage)}`)
  if (def.hullBonus) bits.push(`Hull +${formatCompact(def.hullBonus)}`)
  if (def.shieldBonus) bits.push(`Shield +${formatCompact(def.shieldBonus)}`)
  if (def.armorBonus) bits.push(`Armor +${formatCompact(def.armorBonus)}`)
  return bits.join(' · ')
}

function buildProjects(state: GameState): FabricationProject[] {
  const projects: FabricationProject[] = []
  for (const mod of listFoundryPrintCards(state)) {
    const recipe = getBlueprint(mod.id)
    if (!recipe) continue
    const check = canAssembleBlueprint(state, mod.id)
    const cost: FoundryCost = { materials: { ...(recipe.foundry ?? {}) } }
    const missing = foundryMissingCost(state, cost)
    projects.push({
      kind: 'core',
      jobId: mod.id,
      category: 'core',
      name: mod.name,
      purpose: mod.description,
      time: fabricationJobTime(state, 'core', mod.id),
      cost,
      ready: check.ok,
      reason: missing ? `Missing ${missing}` : check.reason,
      tracked: state.foundry.trackedPrintId === mod.id,
      blueprintLine: blueprintProgress(state, mod.id)?.complete
        ? 'Blueprint complete'
        : 'Blueprint fragments incomplete',
      effect: coreEffectLine(mod.id),
    })
  }
  if (isSystemUnlocked(state, 'reliquary')) {
    for (const source of SHARDS.filter((row) => row.upgradesTo)) {
      const target = source.upgradesTo ? getShard(source.upgradesTo) : undefined
      if (!target) continue
      const jobId = `${source.id}>${target.id}`
      const check = canStartFabrication(state, 'relic', jobId)
      const cost: FoundryCost = { materials: { 'slag-ingot': relicTier(target) >= 3 ? 10 : 4 } }
      projects.push({
        kind: 'relic',
        jobId,
        sourceId: source.id,
        category: 'relic',
        name: target.name,
        purpose: target.blurb,
        time: fabricationJobTime(state, 'relic', jobId),
        cost,
        ready: check.ok,
        reason: foundryMissingCost(state, cost) ? `Missing ${foundryMissingCost(state, cost)}` : check.reason,
        blueprintLine: `${source.name} upgrade route`,
        effect: shardEffectBlurb(target),
      })
    }
  }
  if (isSystemUnlocked(state, 'yard')) {
    for (const facility of FOUNDRY_FACILITIES) {
      const check = canStartFabrication(state, 'facility', facility.id)
      projects.push({
        kind: 'facility',
        jobId: facility.id,
        category: 'infrastructure',
        name: facility.name,
        purpose: facility.blurb,
        time: fabricationJobTime(state, 'facility', facility.id),
        cost: facility.costs,
        ready: check.ok,
        reason: foundryMissingCost(state, facility.costs)
          ? `Missing ${foundryMissingCost(state, facility.costs)}`
          : check.reason,
        blueprintLine: `Industry plan · Wave ${facility.requiresBestWave}`,
        effect: facility.blurb,
      })
    }
  }
  return projects
}

function ProcessorCard({
  state,
  index,
  onView,
  onStop,
}: {
  state: GameState
  index: number
  onView: (id: FoundryRecipeId) => void
  onStop: () => void
}) {
  const slot = state.foundry.slots[index]
  if (!slot?.recipeId) {
    return (
      <article className="foundry-work-card is-idle">
        <span className="ui-kicker">Processor {roman(index)}</span>
        <strong>Idle</strong>
        <span className="ui-meta">Select a material below.</span>
      </article>
    )
  }
  const recipe = getFoundryRecipe(slot.recipeId)
  if (!recipe) return null
  const cost = scaledFoundryCost(state, recipe.id)
  const missing = slot.paid ? null : foundryMissingCost(state, cost)
  const level = foundryRecipeLevel(state, recipe.id)
  const speed = foundryProcessingSpeed(state)
  return (
    <article className="foundry-work-card is-active">
      <button type="button" className="foundry-card-main" onClick={() => onView(recipe.id)}>
        <span className="ui-kicker">Processor {roman(index)}</span>
        <span className="foundry-card-title">
          <strong>{recipe.name}</strong>
          <Badge tone={missing ? 'warn' : 'ok'}>{missing ? `Waiting for ${missing}` : 'Running'}</Badge>
        </span>
        <span className="ui-meta">{formatFoundryCost(cost)} → ×{foundryCraftOutput(state, recipe.id)} {recipe.name}</span>
        <span className="ui-meta">Stock {formatCompact(foundryMaterialCount(state, recipe.id))} · M{level}</span>
        <span className="ui-progress" aria-label={`${Math.round(slot.progress * 100)}% complete`}>
          <span style={{ transform: `scaleX(${slot.progress})` }} />
        </span>
        <span className="ui-meta">
          {formatSeconds(foundryCraftTime(state, recipe.id) / Math.max(0.01, speed))} per cycle · {processingWorkers(state)} Worker Drones · ×{speed.toFixed(2)}
        </span>
      </button>
      <button type="button" onClick={onStop}>Stop</button>
    </article>
  )
}

function ActiveFabricatorCard({
  state,
  index,
  onView,
  onCancel,
}: {
  state: GameState
  index: number
  onView: (project: FabricationProject) => void
  onCancel: () => void
}) {
  const slot = state.foundry.fabrication[index]
  if (!slot?.kind || !slot.jobId) {
    return (
      <article className="foundry-work-card is-idle">
        <span className="ui-kicker">Fabricator {roman(index)}</span>
        <strong>Idle</strong>
        <span className="ui-meta">Choose a project below.</span>
      </article>
    )
  }
  const project = buildProjects(state).find((row) => row.kind === slot.kind && row.jobId === slot.jobId) ?? {
    kind: slot.kind,
    jobId: slot.jobId,
    category: slot.kind === 'facility' ? 'infrastructure' as const : slot.kind,
    name: fabricationJobLabel(state, slot),
    purpose: 'Fabrication project',
    time: fabricationJobTime(state, slot.kind, slot.jobId),
    cost: {},
    ready: false,
    blueprintLine: 'Requirements committed',
    effect: 'Project details unavailable.',
  }
  const speed = foundryFabricationSpeed(state, slot.kind)
  const remaining = slot.complete ? 0 : (project.time * (1 - slot.progress)) / Math.max(0.01, speed)
  return (
    <article className="foundry-work-card is-active">
      <div className="foundry-card-main">
        <span className="ui-kicker">Fabricator {roman(index)} · {project.category === 'infrastructure' ? 'Infrastructure' : project.category}</span>
        <span className="foundry-card-title">
          <strong>{project.name}</strong>
          <Badge tone={slot.complete ? 'ok' : 'default'}>{slot.complete ? 'Complete' : `${Math.round(slot.progress * 100)}%`}</Badge>
        </span>
        <span className="ui-progress" aria-label={`${Math.round(slot.progress * 100)}% complete`}>
          <span style={{ transform: `scaleX(${slot.progress})` }} />
        </span>
        <span className="ui-meta">{slot.complete ? 'Ready' : `${formatSeconds(remaining)} remaining`} · {fabricationWorkers(state, slot.kind)} Worker Drones</span>
        <span className="ui-meta">
          {slot.kind === 'core' ? 'Blueprint fragments committed ✓ · ' : ''}
          {materialLines(project.cost).join(' · ') || 'No material cost'} · committed ✓
        </span>
      </div>
      <div className="foundry-card-actions">
        <button type="button" onClick={() => onView({ ...project, inProgress: true })}>View Item</button>
        {!slot.complete ? <button type="button" onClick={onCancel}>Cancel</button> : null}
      </div>
    </article>
  )
}

export function FoundryTab({
  state,
  onSetSlot,
  onFabricateCore,
  onTrack,
  onStartRelic,
  onStartFacility,
  onStopFabrication,
  guideTarget = null,
  focusTarget = null,
  requestedPane = null,
  onBack,
}: FoundryTabProps) {
  const open = isSystemUnlocked(state, 'foundry')
  const hint = paneFromHints(guideTarget, focusTarget, requestedPane)
  const [pane, setPane] = useSyncedPane<FoundryPane>('processing', hint)
  const [recipeDetail, setRecipeDetail] = useState<FoundryRecipeId | null>(null)
  const [masteryDetail, setMasteryDetail] = useState<FoundryRecipeId | null>(null)
  const [projectDetail, setProjectDetail] = useState<FabricationProject | null>(null)
  const [blueprintDetail, setBlueprintDetail] = useState<string | null>(null)
  const [fabState, setFabState] = useState<FabricationStateFilter>('ready')
  const [fabCategory, setFabCategory] = useState<FabricationCategory>('core')
  const [blueprintCategory, setBlueprintCategory] = useState<BlueprintCategory>('core')

  const runningProcessors = state.foundry.slots.filter((slot) => slot.recipeId)
  const activeFabricators = state.foundry.fabrication.filter((slot) => slot.kind)
  const processingSummary = runningProcessors[0]?.recipeId
    ? `${getFoundryRecipe(runningProcessors[0].recipeId)?.name ?? 'Material'} · ${Math.round(runningProcessors[0].progress * 100)}%`
    : 'Idle'
  const fabSummary = activeFabricators[0]
    ? `${fabricationJobLabel(state, activeFabricators[0])} · ${Math.round(activeFabricators[0].progress * 100)}%`
    : 'Idle'
  const projects = buildProjects(state)
  const visibleProjects = projects.filter((project) => {
    if (project.category !== fabCategory) return false
    if (fabState === 'ready') return project.ready
    if (fabState === 'tracked') return project.tracked
    return true
  })
  const discoveredRecipes = FOUNDRY_RECIPES.filter((recipe) =>
    isFoundryRecipeUnlocked(state, recipe.id) ||
    foundryRecipeLevel(state, recipe.id) > 0 ||
    foundryMaterialCount(state, recipe.id) > 0
  )
  const blueprintModule = blueprintDetail ? getModule(blueprintDetail) : undefined
  const blueprint = blueprintDetail ? getBlueprint(blueprintDetail) : undefined
  const blueprintParts = blueprintDetail ? blueprintProgress(state, blueprintDetail) : null
  const recipe = recipeDetail ? getFoundryRecipe(recipeDetail) : undefined
  const masteryRecipe = masteryDetail ? getFoundryRecipe(masteryDetail) : undefined

  const startProject = (project: FabricationProject) => {
    if (project.kind === 'core') onFabricateCore(project.jobId)
    else if (project.kind === 'relic' && project.sourceId) onStartRelic?.(project.sourceId)
    else if (project.kind === 'facility') onStartFacility?.(project.jobId as FacilityId)
    setProjectDetail(null)
  }

  return (
    <Screen className="panel screen-panel foundry-screen" label="Foundry">
      <ScreenHeader
        title="Foundry"
        action={onBack ? <button type="button" onClick={onBack}>Systems</button> : undefined}
      />
      {!open ? (
        <EmptyState title={`Foundry opens at Wave ${ACT1_CADENCE.foundry}`} body="Processing and Fabrication continue offline once unlocked." />
      ) : (
        <>
          <ContextBar>
            <StatPair label="Foundry workers" value={foundryWorkers(state)} />
            <StatPair label="Processors" value={`${runningProcessors.length}/${foundrySlotCount(state)}`} />
            <StatPair label="Fabricators" value={`${activeFabricators.length}/${foundryFabSlotCount(state)}`} />
          </ContextBar>
          <div className="foundry-active-summary">
            <SummaryCard title="Processing" value={processingSummary} onClick={() => setPane('processing')} />
            <SummaryCard title="Fabrication" value={fabSummary} onClick={() => setPane('fabrication')} />
          </div>
          <SheetTabs value={pane} onChange={setPane} options={FOUNDRY_PANES} label="Foundry navigation" />
          <div className="panel-scroll foundry-scroll">
            {pane === 'processing' ? (
              <>
                <Section>
                  <SectionHeader title="Active Processors" />
                  <div className="foundry-work-list" data-guide="foundry-smelters">
                    {state.foundry.slots.map((_, index) => (
                      <ProcessorCard
                        key={index}
                        state={state}
                        index={index}
                        onView={setRecipeDetail}
                        onStop={() => onSetSlot(index, null)}
                      />
                    ))}
                  </div>
                </Section>
                <Section>
                  <SectionHeader title="Materials" />
                  <ItemGrid>
                    {FOUNDRY_RECIPES.filter((row) => isFoundryRecipeUnlocked(state, row.id)).map((row) => {
                      const assigned = state.foundry.slots.findIndex((slot) => slot.recipeId === row.id)
                      return (
                        <ItemRow
                          key={row.id}
                          title={row.name}
                          meta={`${formatFoundryCost(scaledFoundryCost(state, row.id))} → ×${foundryCraftOutput(state, row.id)} · Stock ${formatCompact(foundryMaterialCount(state, row.id))}`}
                          value={assigned >= 0 ? `Processor ${roman(assigned)}` : `M${foundryRecipeLevel(state, row.id)}`}
                          guide={`foundry-recipe-${row.id}`}
                          onClick={() => setRecipeDetail(row.id)}
                        />
                      )
                    })}
                  </ItemGrid>
                </Section>
              </>
            ) : null}

            {pane === 'fabrication' ? (
              <>
                <Section>
                  <SectionHeader title="Active Fabricators" />
                  <div className="foundry-work-list">
                    {state.foundry.fabrication.map((_, index) => (
                      <ActiveFabricatorCard
                        key={index}
                        state={state}
                        index={index}
                        onView={setProjectDetail}
                        onCancel={() => onStopFabrication?.(index)}
                      />
                    ))}
                  </div>
                </Section>
                <Section>
                  <SheetTabs value={fabState} onChange={setFabState} options={FAB_STATE_FILTERS} label="Fabrication readiness" />
                  <SheetTabs value={fabCategory} onChange={setFabCategory} options={FAB_CATEGORIES} label="Fabrication category" />
                  {visibleProjects.length > 0 ? (
                    <ItemGrid>
                      {visibleProjects.map((project) => (
                        <ItemRow
                          key={`${project.kind}:${project.jobId}`}
                          title={project.name}
                          meta={`${project.category === 'infrastructure' ? 'Infrastructure' : project.category} · ${project.purpose} · ${formatSeconds(project.time)}`}
                          value={project.ready ? 'Ready' : project.reason ?? 'Blocked'}
                          onClick={() => setProjectDetail(project)}
                        />
                      ))}
                    </ItemGrid>
                  ) : (
                    <EmptyState title="No matching projects" body={fabState === 'ready' ? 'Choose All to inspect blocked projects.' : 'Nothing has been discovered in this category yet.'} />
                  )}
                </Section>
              </>
            ) : null}

            {pane === 'mastery' ? (
              <Section>
                <SectionHeader title="Material Mastery" />
                <div className="foundry-mastery-list" data-guide="foundry-mastery">
                  {discoveredRecipes.map((row) => {
                    const level = foundryRecipeLevel(state, row.id)
                    const xp = state.foundry.recipeXp[row.id] ?? 0
                    const need = craftsForNextLevel(level, state)
                    const current = foundryReachedMastery(state, row.id).slice(-2).map(foundryMasteryEffect)
                    const next = foundryNextMastery(state, row.id)
                    return (
                      <button key={row.id} type="button" className="foundry-mastery-card" onClick={() => setMasteryDetail(row.id)}>
                        <span className="foundry-card-title"><strong>{row.name}</strong><Badge>M{level}</Badge></span>
                        <span className="ui-progress" aria-label={`${xp} of ${need} mastery XP`}>
                          <span style={{ transform: `scaleX(${need > 0 ? xp / need : 1})` }} />
                        </span>
                        <span className="ui-meta">Current · {current.join(' · ') || 'Base recipe'}</span>
                        <span className="ui-meta">Next · {next ? `M${next.at} ${foundryMasteryEffect(next)}` : 'Mastered'}</span>
                      </button>
                    )
                  })}
                </div>
              </Section>
            ) : null}

            {pane === 'blueprints' ? (
              <Section>
                <SheetTabs value={blueprintCategory} onChange={setBlueprintCategory} options={BLUEPRINT_CATEGORIES} label="Blueprint category" />
                {blueprintCategory === 'core' ? (
                  <div className="foundry-blueprint-list">
                    {listFoundryPrintCards(state).map((mod) => {
                      const progress = blueprintProgress(state, mod.id)
                      const totals = blueprintFragmentTotals(progress?.owned, progress?.need)
                      const openBlueprint = isCorePrintUnlocked(state, mod.id)
                      const fabricated = state.shipyard.unlockedModules.includes(mod.id)
                      const status = fabricated ? 'FABRICATED' : progress?.complete ? 'COMPLETE' : openBlueprint ? 'DISCOVERED' : 'UNKNOWN'
                      const tracked = state.foundry.trackedPrintId === mod.id
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          className="foundry-blueprint-card"
                          data-guide={`blueprint-${mod.id}`}
                          onClick={() => setBlueprintDetail(mod.id)}
                        >
                          <span className="foundry-blueprint-silhouette" aria-hidden>◇</span>
                          <span className="foundry-blueprint-copy">
                            <span className="foundry-card-title">
                              <strong>{status === 'UNKNOWN' ? 'Unknown Core' : mod.name}</strong>
                              <Badge tone={status === 'COMPLETE' || status === 'FABRICATED' ? 'ok' : 'default'}>{status}</Badge>
                            </span>
                            <span className="ui-meta">Fragments {totals.have}/{totals.need} · {openBlueprint ? formatPrintSourceLine(mod.id) : 'Source unknown'}</span>
                            {tracked ? <span className="ui-meta">Tracked</span> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState title={`No ${BLUEPRINT_CATEGORIES.find((row) => row.id === blueprintCategory)?.label} Blueprints discovered`} body="New Blueprint families appear here when their fragment sources enter the game." />
                )}
              </Section>
            ) : null}
          </div>
        </>
      )}

      <BottomSheet
        open={Boolean(recipe)}
        title={recipe?.name ?? 'Material'}
        kicker="Processing"
        onClose={() => setRecipeDetail(null)}
        overlayId="foundry-processing-detail"
        footer={recipe ? (
          <button
            type="button"
            className="primary"
            disabled={state.foundry.slots.every((slot) => slot.recipeId && slot.recipeId !== recipe.id)}
            onClick={(event) => {
              const assigned = state.foundry.slots.findIndex((slot) => slot.recipeId === recipe.id)
              const idle = state.foundry.slots.findIndex((slot) => !slot.recipeId)
              if (assigned >= 0) onSetSlot(assigned, null)
              else if (idle >= 0) {
                markLocalOk(event.currentTarget)
                onSetSlot(idle, recipe.id)
              }
              setRecipeDetail(null)
            }}
          >
            {state.foundry.slots.some((slot) => slot.recipeId === recipe.id) ? 'Stop Processing' : 'Start Processing'}
          </button>
        ) : undefined}
      >
        {recipe ? (
          <>
            <ContextBar>
              <StatPair label="Stock" value={formatCompact(foundryMaterialCount(state, recipe.id))} />
              <StatPair label="Output" value={`×${foundryCraftOutput(state, recipe.id)}`} />
              <StatPair label="Cycle" value={formatSeconds(foundryCraftTime(state, recipe.id) / Math.max(0.01, foundryProcessingSpeed(state)))} />
            </ContextBar>
            <p>{recipe.blurb}</p>
            <Section><SectionHeader title="Complete material chain" />{completeChain(recipe.id).map((line) => <p className="ui-meta" key={line}>{line}</p>)}</Section>
            <Section><SectionHeader title="Inputs" />{materialLines(scaledFoundryCost(state, recipe.id)).map((line) => <p className="ui-meta" key={line}>{line}</p>)}</Section>
            <p className="ui-meta">Worker contribution · {processingWorkers(state)} assigned · ×{foundryProcessingSpeed(state).toFixed(2)} total speed</p>
            <p className="ui-meta">Mastery XP · {state.foundry.recipeXp[recipe.id] ?? 0}/{craftsForNextLevel(foundryRecipeLevel(state, recipe.id), state)}</p>
            <p className="ui-meta">Current bonuses · {foundryReachedMastery(state, recipe.id).slice(-2).map(foundryMasteryEffect).join(' · ') || 'Base recipe'}</p>
            <p className="ui-meta">Next milestone · {foundryNextMastery(state, recipe.id) ? `M${foundryNextMastery(state, recipe.id)!.at} ${foundryMasteryEffect(foundryNextMastery(state, recipe.id)!)}` : 'Mastered'}</p>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={Boolean(projectDetail)} title={projectDetail?.name ?? 'Project'} kicker="Fabrication project" onClose={() => setProjectDetail(null)} overlayId="foundry-project-detail" footer={projectDetail && !projectDetail.inProgress ? (
        <button type="button" className="primary" disabled={!projectDetail.ready} onClick={() => startProject(projectDetail)}>
          {projectDetail.ready ? 'Fabricate' : projectDetail.reason ?? 'Requirements missing'}
        </button>
      ) : undefined}>
        {projectDetail ? (
          <>
            <p>{projectDetail.effect}</p>
            <ContextBar>
              <StatPair label="Type" value={projectDetail.category === 'infrastructure' ? 'Infrastructure' : projectDetail.category} />
              <StatPair label="Duration" value={formatSeconds(projectDetail.time)} />
            </ContextBar>
            <Section><SectionHeader title="Materials" />{materialLines(projectDetail.cost).length > 0 ? materialLines(projectDetail.cost).map((line) => <p className="ui-meta" key={line}>{line}</p>) : <p className="ui-meta">No Foundry materials required.</p>}</Section>
            <p className="ui-meta">Blueprint requirement · {projectDetail.blueprintLine}</p>
            <p className="ui-meta">
              Workers · {fabricationWorkers(state, projectDetail.kind)} assigned · efficient to {workerJobCap(projectDetail.kind === 'facility' ? 'construction' : 'fab-bay').efficient} · hard cap {workerJobCap(projectDetail.kind === 'facility' ? 'construction' : 'fab-bay').hard} · ×{foundryFabricationSpeed(state, projectDetail.kind).toFixed(2)}
            </p>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={Boolean(masteryRecipe)} title={masteryRecipe?.name ?? 'Mastery'} kicker="Material Mastery" size="full" onClose={() => setMasteryDetail(null)} overlayId="foundry-mastery-detail">
        {masteryRecipe ? (
          <>
            <ContextBar>
              <StatPair label="Level" value={`M${foundryRecipeLevel(state, masteryRecipe.id)}`} />
              <StatPair label="XP" value={`${state.foundry.recipeXp[masteryRecipe.id] ?? 0}/${craftsForNextLevel(foundryRecipeLevel(state, masteryRecipe.id), state)}`} />
            </ContextBar>
            <Section>
              <SectionHeader title="Milestones" />
              {foundryMasteryStepsFor(masteryRecipe, state).map((step) => {
                const level = foundryRecipeLevel(state, masteryRecipe.id)
                const next = foundryNextMastery(state, masteryRecipe.id)?.at === step.at
                return <p key={step.at} className={level >= step.at ? 'ui-meta is-done' : next ? 'ui-meta is-next' : 'ui-meta'}>M{step.at} · {foundryMasteryEffect(step)}{next ? ' · NEXT' : ''}</p>
              })}
            </Section>
            <p className="ui-meta">Produced by · {masteryRecipe.name}</p>
            <p className="ui-meta">Consumed by · {FOUNDRY_RECIPES.filter((row) => (row.costs.materials?.[masteryRecipe.id] ?? 0) > 0).map((row) => row.name).join(', ') || 'No discovered recipe'}</p>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={Boolean(blueprintModule && blueprint)} title={blueprintModule?.name ?? 'Blueprint'} kicker="Core Blueprint" size="full" onClose={() => setBlueprintDetail(null)} overlayId="foundry-blueprint-detail" footer={blueprintModule && blueprintParts?.complete && !state.shipyard.unlockedModules.includes(blueprintModule.id) ? (
        <button type="button" className="primary" onClick={() => {
          const project = projects.find((row) => row.kind === 'core' && row.jobId === blueprintModule.id)
          setBlueprintDetail(null)
          setFabCategory('core')
          setFabState('all')
          setPane('fabrication')
          if (project) setProjectDetail(project)
        }}>View Project</button>
      ) : undefined}>
        {blueprintModule && blueprint && blueprintParts ? (
          <>
            <p>{blueprintModule.description}</p>
            <ContextBar>
              <StatPair label="Fragments" value={`${blueprintFragmentTotals(blueprintParts.owned, blueprintParts.need).have}/${blueprintFragmentTotals(blueprintParts.owned, blueprintParts.need).need}`} />
              <StatPair label="State" value={state.shipyard.unlockedModules.includes(blueprintModule.id) ? 'Fabricated' : blueprintParts.complete ? 'Complete' : isCorePrintUnlocked(state, blueprintModule.id) ? 'Discovered' : 'Unknown'} />
            </ContextBar>
            <Section><SectionHeader title="Parts" />{PART_TYPES.map((part) => <p className="ui-meta" key={part}>{part} · {blueprintParts.owned[part]}/{blueprintParts.need[part]}</p>)}</Section>
            <p className="ui-meta">Source · {isCorePrintUnlocked(state, blueprintModule.id) ? formatPrintSourceLine(blueprintModule.id) : `Unknown until Wave ${modulePrintWave(blueprintModule.id)}`}</p>
            <p className="ui-meta">Result · {coreEffectLine(blueprintModule.id)}</p>
            <p className="ui-meta">Fabrication requirements · {formatFoundryCost({ materials: { ...(blueprint.foundry ?? {}) } })}</p>
            {onTrack && isCorePrintUnlocked(state, blueprintModule.id) && !blueprintParts.complete ? (
              <button type="button" onClick={() => onTrack(state.foundry.trackedPrintId === blueprintModule.id ? null : blueprintModule.id)}>
                {state.foundry.trackedPrintId === blueprintModule.id ? 'Tracked' : 'Track Blueprint'}
              </button>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
