import type { FacilityId, GameState, YardArmId, YardBuildingId } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import { careerBestWave } from '../../game/waves'
import {
  FOUNDRY_FACILITIES,
  FOUNDRY_PANE_LABELS,
  FOUNDRY_RECIPES,
  canStartFabrication,
  craftsForNextLevel,
  fabricationJobLabel,
  formatFoundryCost,
  foundryCraftOutput,
  foundryCraftTime,
  foundryFacilityCommitted,
  foundryHasMaterialChain,
  foundryMasteryStepsFor,
  foundryMaterialCount,
  foundryNextMastery,
  foundryOwnedCount,
  foundryRecipeChainLine,
  foundryRecipeGateLine,
  foundryRecipeLevel,
  isFoundryRecipeUnlocked,
  scaledFoundryCost,
} from '../../game/foundry'
import { formatCompact } from '../../game/format'
import {
  blueprintFragmentTotals,
  blueprintProgress,
  formatPrintSourceLine,
  getBlueprint,
  listFarmableCores,
  modulePrintSector,
  PART_TYPES,
} from '../../game/catalog'
import { canAssembleBlueprint } from '../../game/actions'
import { sectorCanDropPrint } from '../../game/combat'
import { inspectFoundryRecipe } from '../../game/inspect'
import { InspectName } from '../InspectName'
import { SheetTabs } from '../SheetTabs'
import { markLocalOk } from '../../hooks/useJustBecame'
import { useSyncedPane } from '../../hooks/useSyncedPane'

export type FoundryPane = 'smelt' | 'build' | 'prints'

const FOUNDRY_PANES: { id: FoundryPane; label: string }[] = [
  { id: 'smelt', label: FOUNDRY_PANE_LABELS.smelt },
  { id: 'prints', label: FOUNDRY_PANE_LABELS.prints },
]

interface FoundryTabProps {
  state: GameState
  onSetSlot: (slotIndex: number, recipeId: string | null) => void
  onBuyUpgrade?: (upgradeId: string) => void
  onEquip?: (moduleId: string) => void
  onUnequip?: (moduleId: string) => void
  onAssemble: (moduleId: string) => void
  onTrack?: (moduleId: string | null) => void
  onBuyMax?: () => void
  onPlaceBuilding?: (index: number, buildingId: YardBuildingId) => void
  onClearBuilding?: (index: number) => void
  onBuyArm?: (id: YardArmId) => void
  onBuyMaxArms?: () => void
  onSaveLayout?: (name?: string) => void
  onLoadLayout?: (index: number) => void
  onStartFacility?: (id: FacilityId) => void
  onStopFabrication?: (slotIndex: number) => void
  guideTarget?: string | null
  focusTarget?: string | null
  requestedPane?: FoundryPane | 'ranks' | 'fit' | 'build' | null
  onBack?: () => void
}

function foundryPaneFromHints(
  guideTarget?: string | null,
  focusTarget?: string | null,
  requestedPane?: FoundryTabProps['requestedPane'],
): FoundryPane | null {
  if (requestedPane === 'build') return 'build'
  if (requestedPane === 'prints' || requestedPane === 'fit') return 'prints'
  if (requestedPane === 'smelt' || requestedPane === 'ranks') return 'smelt'
  if (focusTarget?.startsWith('print-') || focusTarget === 'foundry-prints') return 'prints'
  if (focusTarget === 'foundry-build' || guideTarget === 'foundry-build' || guideTarget === 'yard-grid') {
    return 'build'
  }
  if (guideTarget === 'foundry-prints') return 'prints'
  if (
    guideTarget === 'foundry-smelters' ||
    guideTarget === 'foundry-recipes' ||
    guideTarget === 'foundry-chain' ||
    guideTarget?.startsWith('foundry-recipe-')
  ) {
    return 'smelt'
  }
  return null
}

function PrintRow({
  state,
  mod,
  onAssemble,
  onTrack,
}: {
  state: GameState
  mod: ReturnType<typeof listFarmableCores>[number]
  onAssemble: (moduleId: string) => void
  onTrack?: (moduleId: string | null) => void
}) {
  const progress = blueprintProgress(state, mod.id)
  const totals = blueprintFragmentTotals(progress?.owned, progress?.need)
  const recipe = getBlueprint(mod.id)
  const check = canAssembleBlueprint(state, mod.id)
  const tracked = state.foundry.trackedPrintId === mod.id
  const queued = state.foundry.fabrication.some((slot) => slot.kind === 'core' && slot.jobId === mod.id)
  const need = modulePrintSector(mod.id)
  const printed = state.shipyard.unlockedModules.includes(mod.id)
  const partsLine = PART_TYPES.map((pt) => `${progress?.owned[pt] ?? 0}/${progress?.need[pt] ?? 0} ${pt}`).join(' · ')
  const sourceLine = recipe ? formatPrintSourceLine(mod.id) : ''
  const foundryLine = recipe?.foundry
    ? Object.entries(recipe.foundry)
        .map(([id, n]) => `${n} ${FOUNDRY_RECIPES.find((r) => r.id === id)?.name ?? id}`)
        .join(' · ')
    : ''
  const familyMismatch = !sectorCanDropPrint(state.combat.sector, mod.id)

  return (
    <article className={printed ? 'network-row is-fitted' : queued ? 'network-row is-active' : 'network-row'}>
      <div className="network-row-main">
        <strong>{mod.name}</strong>
        <span className="muted">
          {queued ? 'Fabricating' : printed ? 'Printed' : check.ok ? 'Ready to fabricate' : `W${need}`}
        </span>
      </div>
      <p className="network-row-stats">
        {printed
          ? 'Fit this Core at Dock after the job completes.'
          : `Fragments ${totals.have} / ${totals.need}`}
      </p>
      {!printed ? <p className="network-row-stats print-parts">{partsLine}</p> : null}
      {!printed && (sourceLine || foundryLine) ? (
        <p className="network-row-stats">{[sourceLine, foundryLine].filter(Boolean).join(' · ')}</p>
      ) : null}
      {familyMismatch ? (
        <p className="network-row-stats print-warn">
          {mod.name} fragments do not drop from this enemy family.
        </p>
      ) : null}
      {!printed && !queued ? (
        <p className="print-row-actions">
          {onTrack ? (
            <button type="button" className={tracked ? 'primary' : undefined} onClick={() => onTrack(tracked ? null : mod.id)}>
              {tracked ? 'Tracked' : 'Track'}
            </button>
          ) : null}
          <button
            type="button"
            className="primary"
            disabled={!check.ok}
            onClick={(e) => {
              markLocalOk(e.currentTarget)
              onAssemble(mod.id)
            }}
          >
            {check.ok ? 'Fabricate' : check.reason ?? 'Farm wrecks'}
          </button>
        </p>
      ) : null}
    </article>
  )
}

export function FoundryTab({
  state,
  onSetSlot,
  onAssemble,
  onTrack,
  onStartFacility,
  onStopFabrication,
  guideTarget = null,
  focusTarget = null,
  requestedPane = null,
  onBack,
}: FoundryTabProps) {
  const open = isSystemUnlocked(state, 'foundry')
  const construction = isSystemUnlocked(state, 'yard')
  const foundry = state.foundry
  const hint = foundryPaneFromHints(guideTarget, focusTarget, requestedPane)
  const [pane, setPane] = useSyncedPane<FoundryPane>('smelt', hint)
  const panes: { id: FoundryPane; label: string }[] = construction
    ? [
        { id: 'smelt', label: FOUNDRY_PANE_LABELS.smelt },
        { id: 'prints', label: FOUNDRY_PANE_LABELS.prints },
        { id: 'build', label: FOUNDRY_PANE_LABELS.build },
      ]
    : FOUNDRY_PANES
  const activePane = pane === 'build' && !construction ? 'smelt' : pane

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        {onBack ? (
          <p className="assign-row">
            <button type="button" onClick={onBack}>
              Systems
            </button>
          </p>
        ) : null}
        <h2>Foundry</h2>
        <p>
          {open
            ? `${foundry.slots.length} processor${foundry.slots.length === 1 ? '' : 's'} · ${foundry.fabrication.length} fabrication slot${foundry.fabrication.length === 1 ? '' : 's'}`
            : `Reach Wave ${ACT1_CADENCE.foundry} to bring the Foundry online.`}
        </p>
      </header>
      {!open ? (
        <p className="muted empty-state">Turn Scrap into permanent materials. Opens at Wave {ACT1_CADENCE.foundry}.</p>
      ) : (
        <>
          <SheetTabs value={activePane} onChange={setPane} options={panes} label="Foundry panes" />
          <div className="panel-scroll">
            {activePane === 'smelt' ? (
              <>
                <h3 className="foundry-heading" data-guide="foundry-smelters">
                  Processing
                </h3>
                {foundry.slots.map((slot, i) => (
                  <article
                    key={i}
                    className={slot.recipeId ? 'network-row is-active smelter-active' : 'network-row is-idle'}
                  >
                    <div className="network-row-main">
                      <strong>Slot {i + 1}</strong>
                      <span className={slot.recipeId ? 'status-tag live' : 'status-tag'}>
                        {slot.recipeId ? (
                          <InspectName
                            name={FOUNDRY_RECIPES.find((r) => r.id === slot.recipeId)?.name ?? 'Queued'}
                            card={inspectFoundryRecipe(state, slot.recipeId)}
                          />
                        ) : (
                          'Idle'
                        )}
                      </span>
                    </div>
                    {slot.recipeId ? (
                      <>
                        <div className="network-fill is-active" aria-hidden>
                          <span style={{ transform: `scaleX(${slot.progress})` }} />
                        </div>
                        <button type="button" onClick={() => onSetSlot(i, null)}>
                          Stop
                        </button>
                      </>
                    ) : (
                      <p className="muted">Pick a recipe below.</p>
                    )}
                  </article>
                ))}

                <h3 className="foundry-heading" data-guide="foundry-recipes">
                  Recipes
                </h3>
                <p className="foundry-chain" data-guide="foundry-chain">
                  Recovered Scrap becomes stock, then alloy, then tempered parts. Processing uses Scrap, not Salvage.
                </p>
                {FOUNDRY_RECIPES.filter((recipe) => isFoundryRecipeUnlocked(state, recipe.id)).map((recipe) => {
                  const unlocked = true
                  const level = foundryRecipeLevel(state, recipe.id)
                  const stock = foundryMaterialCount(state, recipe.id)
                  const cost = scaledFoundryCost(state, recipe.id)
                  const time = foundryCraftTime(state, recipe.id)
                  const xp = foundry.recipeXp[recipe.id] ?? 0
                  const need = craftsForNextLevel(level, state)
                  const assigned = foundry.slots.findIndex((s) => s.recipeId === recipe.id)
                  const idleSlot = foundry.slots.findIndex((s) => !s.recipeId)
                  const nextMastery = foundryNextMastery(state, recipe.id)
                  return (
                    <article
                      key={recipe.id}
                      className={
                        unlocked
                          ? assigned >= 0
                            ? 'network-row is-active'
                            : 'network-row is-ready'
                          : 'network-row locked'
                      }
                      data-guide={`foundry-recipe-${recipe.id}`}
                    >
                      <div className="network-row-main">
                        <InspectName
                          name={recipe.name}
                          card={unlocked ? inspectFoundryRecipe(state, recipe.id) : null}
                        />
                        <span className="muted">{unlocked ? `Lv ${level}` : 'Locked'}</span>
                      </div>
                      <p className="network-row-stats">
                        {unlocked
                          ? `${formatFoundryCost(cost)} · ${formatCompact(time, 1)}s · ×${foundryCraftOutput(state, recipe.id)} · ${xp}/${need} · stock ${formatCompact(stock)}`
                          : recipe.blurb + ' · ' + foundryRecipeGateLine(recipe)}
                      </p>
                      {unlocked && foundryHasMaterialChain(recipe) ? (
                        <p className="network-row-stats">{foundryRecipeChainLine(recipe)}</p>
                      ) : null}
                      {unlocked ? (
                        <ul className="foundry-mastery-table">
                          {foundryMasteryStepsFor(recipe, state).map((step) => (
                            <li key={step.at} className={level >= step.at ? 'is-done' : undefined}>
                              Lv {step.at}
                              {level >= step.at ? ' · done' : ''} — {step.blurb}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {unlocked && nextMastery ? (
                        <p className="network-row-stats">
                          Next mastery Lv {nextMastery.at}: {nextMastery.blurb}
                        </p>
                      ) : null}
                      {unlocked ? (
                        <button
                          type="button"
                          className="primary"
                          disabled={idleSlot < 0 && assigned < 0}
                          onClick={(e) => {
                            markLocalOk(e.currentTarget)
                            if (assigned >= 0) onSetSlot(assigned, null)
                            else if (idleSlot >= 0) onSetSlot(idleSlot, recipe.id)
                          }}
                        >
                          {assigned >= 0 ? 'Queued' : idleSlot >= 0 ? 'Process' : 'No slot'}
                        </button>
                      ) : null}
                    </article>
                  )
                })}
              </>
            ) : null}

            {activePane === 'prints' ? (
              <>
                <h3 className="foundry-heading" data-guide="foundry-prints">
                  Fabrication
                </h3>
                <p className="muted">
                  Combat finds blueprints and parts. Foundry spends time and materials. Jobs finish during a Sortie but
                  cannot be fitted until you Dock.
                </p>
                {foundry.fabrication.map((slot, i) => (
                  <article key={i} className={slot.kind ? 'network-row is-active' : 'network-row is-idle'}>
                    <div className="network-row-main">
                      <strong>Job {i + 1}</strong>
                      <span className={slot.kind ? 'status-tag live' : 'status-tag'}>
                        {slot.kind ? fabricationJobLabel(state, slot) : 'Idle'}
                      </span>
                    </div>
                    {slot.kind ? (
                      <>
                        <div className="network-fill is-active" aria-hidden>
                          <span style={{ transform: `scaleX(${slot.progress})` }} />
                        </div>
                        <p className="network-row-stats">
                          {slot.complete
                            ? slot.kind === 'facility'
                              ? 'Complete — bonus is live'
                              : 'Complete — fit at Dock'
                            : `${Math.round(slot.progress * 100)}%`}
                        </p>
                        {!slot.complete ? (
                          <button type="button" onClick={() => onStopFabrication?.(i)}>
                            Stop
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="muted">Start a Core, Relic upgrade, or facility below.</p>
                    )}
                  </article>
                ))}
                {listFarmableCores(state).map((mod) => (
                  <PrintRow key={mod.id} state={state} mod={mod} onAssemble={onAssemble} onTrack={onTrack} />
                ))}
              </>
            ) : null}

            {activePane === 'build' ? (
              <>
                <h3 className="foundry-heading">Construction</h3>
                <p className="muted">
                  Facilities consume a Fabrication slot and Construction workers. Bonuses apply as soon as the job finishes.
                </p>
                {FOUNDRY_FACILITIES.filter((facility) => careerBestWave(state) >= facility.requiresBestWave).map((facility) => {
                  const check = canStartFabrication(state, 'facility', facility.id)
                  const owned = foundryOwnedCount(state, facility.id)
                  const committed = foundryFacilityCommitted(state, facility.id)
                  const queued = state.foundry.fabrication.some(
                    (slot) => slot.kind === 'facility' && slot.jobId === facility.id,
                  )
                  return (
                    <article
                      key={facility.id}
                      className={owned > 0 ? 'network-row is-fitted' : queued ? 'network-row is-active' : 'network-row'}
                    >
                      <div className="network-row-main">
                        <strong>{facility.name}</strong>
                        <span className="muted">
                          {owned}/{facility.maxOwned}
                          {committed > owned ? ` · +${committed - owned} queued` : ''}
                        </span>
                      </div>
                      <p className="network-row-stats">{facility.blurb}</p>
                      <p className="network-row-stats">
                        {formatFoundryCost(facility.costs)} · {Math.round(facility.craftTime / 60)} min
                      </p>
                      <button
                        type="button"
                        className="primary"
                        disabled={!check.ok}
                        onClick={(e) => {
                          markLocalOk(e.currentTarget)
                          onStartFacility?.(facility.id)
                        }}
                      >
                        {check.ok ? 'Fabricate' : check.reason ?? 'Locked'}
                      </button>
                    </article>
                  )
                })}
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
