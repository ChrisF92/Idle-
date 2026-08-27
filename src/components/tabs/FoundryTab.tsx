import { useState } from 'react'
import type { FabJobKind, FacilityId, FoundryMaterialId, GameState } from '../../game/types'
import { ACT1_CADENCE } from '../../game/cadence'
import { getModule } from '../../game/catalog'
import {
  BLUEPRINTS,
  blueprintDisplayName,
  blueprintFragmentCount,
  blueprintLifecycle,
  canTrackBlueprint,
  getBlueprint,
  physicalProductOwned,
} from '../../game/blueprints'
import {
  CORE_FABRICATION_RECIPES,
  FOUNDRY_FACILITIES,
  FOUNDRY_PANE_LABELS,
  FOUNDRY_RECIPES,
  FRAME_FABRICATION_RECIPES,
  WORKER_FABRICATION_RECIPE,
  canStartFabrication,
  canStartProcessing,
  fabricationJobLabel,
  formatFoundryCost,
  foundryCraftTime,
  foundryFabSlotCount,
  foundryFabricationSpeed,
  foundryMaterialCount,
  foundryOwnedCount,
  foundryProcessingSpeed,
  foundryRecipeLockReason,
  foundrySlotCount,
  getFabricationRecipe,
  getFoundryRecipe,
  idleProcessingSlot,
  materialMasteryXpIntoRank,
  scaleFabricationCost,
  type FoundryCost,
  type FoundryPaneId,
} from '../../game/foundry'
import { isSystemUnlocked } from '../../game/progression'
import { ownedWorkers, workerCapacity } from '../../game/workers'
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

export type FoundryPane = FoundryPaneId
type FabricationCategory = 'core' | 'frame' | 'worker' | 'infrastructure'
type BlueprintCategory = 'core' | 'frame'

const FOUNDRY_PANES: { id: FoundryPane; label: string }[] = [
  { id: 'processing', label: FOUNDRY_PANE_LABELS.processing },
  { id: 'fabrication', label: FOUNDRY_PANE_LABELS.fabrication },
  { id: 'mastery', label: FOUNDRY_PANE_LABELS.mastery },
  { id: 'blueprints', label: FOUNDRY_PANE_LABELS.blueprints },
]

const FAB_CATEGORIES: { id: FabricationCategory; label: string }[] = [
  { id: 'core', label: 'Cores' },
  { id: 'frame', label: 'Frames' },
  { id: 'worker', label: 'Workers' },
  { id: 'infrastructure', label: 'Infrastructure' },
]

const BLUEPRINT_CATEGORIES: { id: BlueprintCategory; label: string }[] = [
  { id: 'core', label: 'Cores' },
  { id: 'frame', label: 'Frames' },
]

interface FoundryTabProps {
  state: GameState
  onSetSlot: (slotIndex: number, recipeId: string | null) => void
  onFabricateCore: (moduleId: string) => void
  onTrack?: (moduleId: string | null) => void
  onStartRelic?: (relicId: string) => void
  onStartFacility?: (id: FacilityId) => void
  onStartJob?: (kind: FabJobKind, jobId: string) => void
  guideTarget?: string | null
  focusTarget?: string | null
  requestedPane?: FoundryPane | 'smelt' | 'prints' | 'build' | 'ranks' | 'fit' | null
  onBack?: () => void
}

function paneFromHints(
  guideTarget?: string | null,
  focusTarget?: string | null,
  requestedPane?: FoundryTabProps['requestedPane'],
): FoundryPane | null {
  if (
    requestedPane === 'processing' ||
    requestedPane === 'fabrication' ||
    requestedPane === 'mastery' ||
    requestedPane === 'blueprints'
  ) {
    return requestedPane
  }
  if (requestedPane === 'smelt' || requestedPane === 'ranks') {
    return requestedPane === 'ranks' ? 'mastery' : 'processing'
  }
  if (requestedPane === 'prints' || requestedPane === 'fit') return 'blueprints'
  if (requestedPane === 'build') return 'fabrication'
  if (focusTarget?.startsWith('project-')) return 'fabrication'
  if (focusTarget?.startsWith('blueprint-') || focusTarget?.startsWith('print-')) return 'blueprints'
  if (focusTarget === 'foundry-build' || guideTarget === 'foundry-build' || guideTarget === 'yard-grid') {
    return 'fabrication'
  }
  if (guideTarget === 'foundry-mastery') return 'mastery'
  if (guideTarget === 'onboarding.foundry.blueprint') return 'blueprints'
  if (
    guideTarget === 'foundry-smelters' ||
    guideTarget === 'foundry-recipes' ||
    guideTarget === 'foundry-chain' ||
    guideTarget === 'onboarding.foundry.processor' ||
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

function foundryWorkers(state: GameState): number {
  return (
    Math.max(0, state.base.assignments['alloy-foundry'] ?? 0) +
    Math.max(0, state.base.assignments['fab-bay'] ?? 0) +
    Math.max(0, state.base.assignments.construction ?? 0) +
    Math.max(0, state.base.assignments['drone-fab'] ?? 0)
  )
}

function lifecycleLabel(life: ReturnType<typeof blueprintLifecycle>): string {
  if (life === 'owned') return 'Owned'
  if (life === 'discovered') return 'Design known — fabrication required'
  if (life === 'fragmented') return 'Fragmented'
  return 'Unknown'
}

function sourceLine(id: string): string {
  const def = getBlueprint(id)
  if (!def) return ''
  return def.sources.map((source) => source.label).join(' · ')
}

function coreCopies(state: GameState, moduleId: string): number {
  return (state.shipyard.coreInstances ?? []).filter((row) => row.moduleId === moduleId).length
}

function costLines(cost: FoundryCost): string {
  return formatFoundryCost(cost)
}

function productFabricationRow(
  state: GameState,
  kind: 'core' | 'frame',
  row: { productId: string; costs: FoundryCost; craftTime: number },
): { title: string; meta: string; value: string; interactive: boolean } {
  const life = blueprintLifecycle(state, row.productId)
  const title = blueprintDisplayName(state, row.productId)
  if (life === 'unknown') {
    return { title, meta: 'Unknown', value: 'Unknown', interactive: false }
  }
  if (life === 'fragmented') {
    return { title, meta: 'Fragmented — fabrication locked', value: 'Locked', interactive: false }
  }
  const check = canStartFabrication(state, kind, row.productId)
  if (kind === 'core') {
    const copies = coreCopies(state, row.productId)
    const cost = scaleFabricationCost(row.costs, copies)
    return {
      title,
      meta: `${copies} owned · ${costLines(cost)} · ${formatSeconds(row.craftTime)}`,
      value: check.ok ? 'Fabricate' : check.reason ?? 'Locked',
      interactive: check.ok,
    }
  }
  const owned = (state.shipyard.unlockedFrames ?? []).includes(row.productId)
  return {
    title,
    meta: owned ? 'Owned' : `${costLines(row.costs)} · ${formatSeconds(row.craftTime)}`,
    value: check.ok ? 'Fabricate' : check.reason ?? 'Locked',
    interactive: check.ok,
  }
}

export function FoundryTab({
  state,
  onSetSlot,
  onFabricateCore,
  onTrack,
  onStartFacility,
  onStartJob,
  guideTarget = null,
  focusTarget = null,
  requestedPane = null,
  onBack,
}: FoundryTabProps) {
  const open = isSystemUnlocked(state, 'foundry')
  const hint = paneFromHints(guideTarget, focusTarget, requestedPane)
  const [pane, setPane] = useSyncedPane<FoundryPane>('processing', hint)
  const [recipeDetail, setRecipeDetail] = useState<FoundryMaterialId | null>(null)
  const [masteryDetail, setMasteryDetail] = useState<FoundryMaterialId | null>(null)
  const [blueprintDetail, setBlueprintDetail] = useState<string | null>(null)
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
  const speed = foundryProcessingSpeed(state)
  const fabSpeed = foundryFabricationSpeed(state, activeFabricators[0]?.kind ?? 'core')
  const recipe = recipeDetail ? getFoundryRecipe(recipeDetail) : undefined
  const masteryRecipe = masteryDetail ? getFoundryRecipe(masteryDetail) : undefined
  const blueprint = blueprintDetail ? getBlueprint(blueprintDetail) : undefined
  const idle = idleProcessingSlot(state)

  const startJob = (kind: FabJobKind, jobId: string) => {
    if (kind === 'core') onFabricateCore(jobId)
    else if (kind === 'facility') onStartFacility?.(jobId as FacilityId)
    else onStartJob?.(kind, jobId)
  }

  return (
    <Screen className="panel screen-panel foundry-screen" label="Foundry">
      <ScreenHeader
        title="Foundry"
        action={onBack ? <button type="button" onClick={onBack}>Systems</button> : undefined}
      />
      {!open ? (
        <EmptyState
          title={`Foundry opens at Wave ${ACT1_CADENCE.foundry}`}
          body="Processing and Fabrication continue offline once unlocked. No Rebuild is required."
        />
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
          {pane === 'fabrication' ? (
            <SheetTabs
              value={fabCategory}
              onChange={setFabCategory}
              options={FAB_CATEGORIES}
              label="Fabrication category"
            />
          ) : null}
          {pane === 'blueprints' ? (
            <SheetTabs
              value={blueprintCategory}
              onChange={setBlueprintCategory}
              options={BLUEPRINT_CATEGORIES}
              label="Blueprint category"
            />
          ) : null}
          <div className="panel-scroll foundry-scroll">
            {pane === 'processing' ? (
              <>
                <Section>
                  <SectionHeader title="Processors" />
                  <p className="ui-meta">
                    Speed ×{speed.toFixed(2)} · Matter Foundry Throughput and assigned Processing Workers.
                    Time Compression does not apply.
                  </p>
                  {state.foundry.slots.map((slot, index) => {
                    const def = slot.recipeId ? getFoundryRecipe(slot.recipeId) : undefined
                    const remaining = def
                      ? foundryCraftTime(state, def.id) * (1 - slot.progress) / Math.max(0.01, speed)
                      : 0
                    return (
                      <article key={index} className="foundry-processor-card" data-guide={`foundry-slot-${index}`}>
                        <strong>Processor {roman(index)}</strong>
                        {def ? (
                          <>
                            <span>{def.name}</span>
                            <span className="ui-meta">
                              {Math.round(slot.progress * 100)}% · {formatSeconds(remaining)} remaining
                            </span>
                            <span className="ui-progress" aria-hidden>
                              <span style={{ transform: `scaleX(${slot.progress})` }} />
                            </span>
                            <span className="ui-meta">Mastery XP on completion: {def.name}</span>
                          </>
                        ) : (
                          <span className="ui-meta">Idle — start one Processing cycle</span>
                        )}
                      </article>
                    )
                  })}
                </Section>
                <Section>
                  <SectionHeader title="Recipes" />
                  <ItemGrid>
                    {FOUNDRY_RECIPES.map((row) => {
                      const lock = foundryRecipeLockReason(state, row.id)
                      const check = canStartProcessing(state, row.id)
                      const stock = foundryMaterialCount(state, row.id)
                      const onboarding =
                        row.id === 'recovered-stock' ? 'onboarding.foundry.processor' : undefined
                      return (
                        <ItemRow
                          key={row.id}
                          title={row.name}
                          meta={
                            lock
                              ? lock
                              : `${costLines(row.costs)} → 1 · ${formatSeconds(row.craftTime)} · stock ${stock}`
                          }
                          value={check.ok ? 'Start' : lock ? 'Locked' : check.reason}
                          guide={`foundry-recipe-${row.id}`}
                          onboarding={onboarding}
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
                  <SectionHeader title="Active jobs" />
                  <p className="ui-meta">
                    Speed ×{fabSpeed.toFixed(2)}. Completing a job adds the physical item immediately.
                    It does not change the live Sortie loadout.
                  </p>
                  {state.foundry.fabrication.map((slot, index) => (
                    <article key={index} className="foundry-processor-card">
                      <strong>Bay {roman(index)}</strong>
                      {slot.kind && slot.jobId ? (
                        <>
                          <span>{fabricationJobLabel(state, slot)}</span>
                          <span className="ui-meta">{Math.round(slot.progress * 100)}%</span>
                          <span className="ui-progress" aria-hidden>
                            <span style={{ transform: `scaleX(${slot.progress})` }} />
                          </span>
                        </>
                      ) : (
                        <span className="ui-meta">Idle</span>
                      )}
                    </article>
                  ))}
                </Section>
                {fabCategory === 'core' ? (
                  <Section>
                    <SectionHeader title="Cores" />
                    <p className="ui-meta">Blueprint discovered ≠ item owned. Copy count is physical instances.</p>
                    <ItemGrid>
                      {CORE_FABRICATION_RECIPES.map((row) => {
                        const view = productFabricationRow(state, 'core', row)
                        return (
                          <ItemRow
                            key={row.productId}
                            title={view.title}
                            meta={view.meta}
                            value={view.value}
                            onClick={
                              view.interactive
                                ? () => {
                                    startJob('core', row.productId)
                                  }
                                : undefined
                            }
                          />
                        )
                      })}
                    </ItemGrid>
                  </Section>
                ) : null}
                {fabCategory === 'frame' ? (
                  <Section>
                    <SectionHeader title="Frames" />
                    <ItemGrid>
                      {FRAME_FABRICATION_RECIPES.map((row) => {
                        const view = productFabricationRow(state, 'frame', row)
                        return (
                          <ItemRow
                            key={row.productId}
                            title={view.title}
                            meta={view.meta}
                            value={view.value}
                            onClick={
                              view.interactive
                                ? () => {
                                    startJob('frame', row.productId)
                                  }
                                : undefined
                            }
                          />
                        )
                      })}
                    </ItemGrid>
                  </Section>
                ) : null}
                {fabCategory === 'worker' ? (
                  <Section>
                    <SectionHeader title="Worker Fabricator" />
                    <p className="ui-meta">
                      Workers {ownedWorkers(state)} / {workerCapacity(state)} capacity.
                      Capacity is not ownership.
                    </p>
                    {(() => {
                      const check = canStartFabrication(state, 'worker', 'worker')
                      const recipe = WORKER_FABRICATION_RECIPE
                      return (
                        <ItemRow
                          title={recipe.name}
                          meta={`${costLines(recipe.costs)} · ${formatSeconds(recipe.craftTime)}`}
                          value={check.ok ? 'Fabricate' : check.reason}
                          onboarding="onboarding.workers.fabricate"
                          onClick={() => {
                            if (check.ok) startJob('worker', 'worker')
                          }}
                        />
                      )
                    })()}
                  </Section>
                ) : null}
                {fabCategory === 'infrastructure' ? (
                  <Section>
                    <SectionHeader title="Infrastructure" />
                    <ItemGrid>
                      {FOUNDRY_FACILITIES.map((row) => {
                        const owned = foundryOwnedCount(state, row.id)
                        const check = canStartFabrication(state, 'facility', row.id)
                        return (
                          <ItemRow
                            key={row.id}
                            title={row.name}
                            meta={`${owned}/${row.maxOwned} · ${row.effect} · ${costLines(row.costs)}`}
                            value={check.ok ? 'Build' : check.reason}
                            onClick={() => {
                              if (check.ok) startJob('facility', row.id)
                            }}
                          />
                        )
                      })}
                    </ItemGrid>
                  </Section>
                ) : null}
              </>
            ) : null}

            {pane === 'mastery' ? (
              <Section>
                <SectionHeader title="Material Mastery" />
                <p className="ui-meta">M0→M5. XP comes from completed Processing cycles of that material.</p>
                <ItemGrid>
                  {FOUNDRY_RECIPES.map((row) => {
                    const progress = materialMasteryXpIntoRank(state, row.id)
                    return (
                      <ItemRow
                        key={row.id}
                        title={row.name}
                        meta={
                          progress.maxed
                            ? 'M5 — max'
                            : `M${progress.rank} · ${progress.into}/${progress.need} XP to M${progress.rank + 1}`
                        }
                        value={`M${progress.rank}`}
                        onClick={() => setMasteryDetail(row.id)}
                      />
                    )
                  })}
                </ItemGrid>
              </Section>
            ) : null}

            {pane === 'blueprints' ? (
              <>
                <Section>
                  <SectionHeader title="Blueprints" />
                  <p className="ui-meta">Discovery is a design. Fabrication creates the physical item.</p>
                  <ItemGrid>
                    {BLUEPRINTS.filter((row) => row.productKind === blueprintCategory).map((row) => {
                      const life = blueprintLifecycle(state, row.id)
                      const have = blueprintFragmentCount(state, row.id)
                      const tracked = state.foundry.trackedPrintId === row.id
                      const title = blueprintDisplayName(state, row.id)
                      const meta =
                        life === 'fragmented'
                          ? `${row.schematicName} ${have}/${row.fragmentsRequired}`
                          : life === 'discovered'
                            ? 'Design known — fabrication required'
                            : life === 'owned'
                              ? row.productKind === 'core'
                                ? `Owned · ${coreCopies(state, row.id)} physical`
                                : 'Owned'
                              : 'Unknown'
                      return (
                        <ItemRow
                          key={row.id}
                          title={title}
                          meta={meta}
                          value={tracked ? 'Tracked' : lifecycleLabel(life)}
                          onboarding={row.id === 'flak-array' ? 'onboarding.foundry.blueprint' : undefined}
                          onClick={() => setBlueprintDetail(row.id)}
                        />
                      )
                    })}
                  </ItemGrid>
                </Section>
              </>
            ) : null}
          </div>
        </>
      )}

      <BottomSheet
        open={Boolean(recipe)}
        title={recipe?.name ?? 'Recipe'}
        onClose={() => setRecipeDetail(null)}
        overlayId="foundry-processing-detail"
      >
        {recipe ? (
          <>
            <p>{recipe.blurb}</p>
            <p className="ui-meta">{costLines(recipe.costs)} → 1 {recipe.name}</p>
            <p className="ui-meta">Cycle {formatSeconds(recipe.craftTime)}. Mastery XP is awarded to this output.</p>
            {foundryRecipeLockReason(state, recipe.id) ? (
              <p className="ui-meta">{foundryRecipeLockReason(state, recipe.id)}</p>
            ) : (
              <button
                type="button"
                data-onboarding={recipe.id === 'recovered-stock' ? 'onboarding.foundry.processor' : undefined}
                disabled={!canStartProcessing(state, recipe.id).ok || idle < 0}
                onClick={() => {
                  if (idle >= 0) onSetSlot(idle, recipe.id)
                  setRecipeDetail(null)
                }}
              >
                Start cycle
              </button>
            )}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(masteryRecipe)}
        title={masteryRecipe?.name ?? 'Mastery'}
        onClose={() => setMasteryDetail(null)}
        overlayId="foundry-mastery-detail"
      >
        {masteryRecipe ? (
          <>
            {(() => {
              const progress = materialMasteryXpIntoRank(state, masteryRecipe.id)
              return (
                <>
                  <p>
                    {progress.maxed
                      ? 'M5. No further Material Mastery ranks.'
                      : `M${progress.rank} · ${progress.into}/${progress.need} XP to the next rank.`}
                  </p>
                  <p className="ui-meta">
                    Processing cycles grant XP. Direct recovery and owning stock do not.
                    Rank rewards beyond recipe/source prerequisites are not authored.
                  </p>
                </>
              )
            })()}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(blueprint)}
        title={blueprint ? blueprintDisplayName(state, blueprint.id) : 'Blueprint'}
        onClose={() => setBlueprintDetail(null)}
        overlayId="foundry-blueprint-detail"
      >
        {blueprint ? (
          <>
            {(() => {
              const life = blueprintLifecycle(state, blueprint.id)
              const have = blueprintFragmentCount(state, blueprint.id)
              const copies = blueprint.productKind === 'core' ? coreCopies(state, blueprint.id) : 0
              const owned = physicalProductOwned(state, blueprint)
              const recipe = getFabricationRecipe(blueprint.productKind, blueprint.id)
              const module = getModule(blueprint.id)
              const canTrack = Boolean(onTrack) && canTrackBlueprint(state, blueprint.id)
              return (
                <>
                  <p>
                    <Badge>{lifecycleLabel(life)}</Badge>
                  </p>
                  {life === 'unknown' ? (
                    <p className="ui-meta">An unidentified schematic. First fragment reveals its identity.</p>
                  ) : null}
                  {life === 'fragmented' ? (
                    <p>
                      {blueprint.schematicName} {have}/{blueprint.fragmentsRequired}
                    </p>
                  ) : null}
                  {life === 'discovered' ? (
                    <p>Design known — fabrication required. No physical copy yet.</p>
                  ) : null}
                  {life === 'owned' ? (
                    <p>
                      {blueprint.productKind === 'core'
                        ? `${copies} physical ${copies === 1 ? 'copy' : 'copies'} in inventory.`
                        : 'Physical Frame owned.'}
                    </p>
                  ) : null}
                  {life !== 'unknown' ? <p className="ui-meta">{sourceLine(blueprint.id)}</p> : null}
                  {module && life !== 'unknown' ? <p className="ui-meta">{module.description}</p> : null}
                  {recipe && (life === 'discovered' || owned) ? (
                    <button
                      type="button"
                      disabled={!canStartFabrication(state, blueprint.productKind, blueprint.id).ok}
                      onClick={() => {
                        startJob(blueprint.productKind, blueprint.id)
                        setBlueprintDetail(null)
                      }}
                    >
                      Fabricate
                    </button>
                  ) : null}
                  {canTrack || state.foundry.trackedPrintId === blueprint.id ? (
                    <button
                      type="button"
                      onClick={() =>
                        onTrack?.(state.foundry.trackedPrintId === blueprint.id ? null : blueprint.id)
                      }
                    >
                      {state.foundry.trackedPrintId === blueprint.id ? 'Untrack' : 'Track'}
                    </button>
                  ) : null}
                </>
              )
            })()}
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
