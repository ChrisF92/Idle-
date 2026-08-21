import type { GameState, YardArmId, YardBuildingId } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  canBuyFoundryUpgrade,
  foundryCraftOutput,
  foundryCraftTime,
  foundryFitSlots,
  foundryHasMaterialChain,
  foundryMaterialCount,
  foundryNextMastery,
  foundryRecipeChainLine,
  foundryRecipeLevel,
  foundryUpgradeCost,
  formatFoundryCost,
  foundryRecipeGateLine,
  isFoundryInfinite,
  isFoundryModuleUnlocked,
  isFoundryRecipeUnlocked,
  scaledFoundryCost,
  craftsForNextLevel,
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
import {
  inspectFoundryModule,
  inspectFoundryRecipe,
  inspectFoundryUpgrade,
} from '../../game/inspect'
import { InspectName } from '../InspectName'
import { SheetTabs } from '../SheetTabs'
import { YardTab } from './YardTab'
import { markLocalOk, useJustBecame } from '../../hooks/useJustBecame'
import { useSyncedPane } from '../../hooks/useSyncedPane'
import { hasProcess } from '../../game/process'

export type FoundryPane = 'smelt' | 'build' | 'ranks' | 'prints' | 'fit'

const FOUNDRY_PANES: { id: FoundryPane; label: string }[] = [
  { id: 'smelt', label: 'Smelt' },
  { id: 'ranks', label: 'Ranks' },
  { id: 'prints', label: 'Prints' },
  { id: 'fit', label: 'Fit' },
]

interface FoundryTabProps {
  state: GameState
  onSetSlot: (slotIndex: number, recipeId: string | null) => void
  onBuyUpgrade: (upgradeId: string) => void
  onEquip: (moduleId: string) => void
  onUnequip: (moduleId: string) => void
  onAssemble: (moduleId: string) => void
  onTrack?: (moduleId: string | null) => void
  onBuyMax?: () => void
  onPlaceBuilding?: (index: number, buildingId: YardBuildingId) => void
  onClearBuilding?: (index: number) => void
  onBuyArm?: (id: YardArmId) => void
  onBuyMaxArms?: () => void
  onSaveLayout?: (name?: string) => void
  onLoadLayout?: (index: number) => void
  guideTarget?: string | null
  focusTarget?: string | null
  requestedPane?: FoundryPane | null
  onBack?: () => void
}

function foundryPaneFromHints(
  guideTarget?: string | null,
  focusTarget?: string | null,
  requestedPane?: FoundryPane | null,
): FoundryPane | null {
  if (requestedPane) return requestedPane
  if (focusTarget?.startsWith('print-') || focusTarget === 'foundry-prints') return 'prints'
  if (focusTarget === 'foundry-fit' || focusTarget?.startsWith('fit-')) return 'fit'
  if (focusTarget === 'foundry-build' || guideTarget === 'foundry-build' || guideTarget === 'yard-grid') {
    return 'build'
  }
  if (guideTarget === 'foundry-prints') return 'prints'
  if (guideTarget === 'foundry-ranks') return 'ranks'
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

function RankRow({
  state,
  up,
  onBuyUpgrade,
}: {
  state: GameState
  up: (typeof FOUNDRY_UPGRADES)[number]
  onBuyUpgrade: (upgradeId: string) => void
}) {
  const rank = state.foundry.upgrades[up.id] ?? 0
  const can = canBuyFoundryUpgrade(state, up.id)
  const justReady = useJustBecame(can.ok)
  const cost = foundryUpgradeCost(state, up.id)
  return (
    <article
      className={`network-row${can.ok ? ' is-affordable' : ''}${justReady ? ' just-ready' : ''}`}
    >
      <div className="network-row-main">
        <InspectName name={up.name} card={inspectFoundryUpgrade(state, up.id)} />
        <span className="muted">
          {rank}/{up.maxRank}
        </span>
      </div>
      <p className="network-row-stats">{up.blurb}</p>
      <button
        type="button"
        className="primary"
        disabled={!can.ok}
        onClick={(e) => {
          markLocalOk(e.currentTarget)
          onBuyUpgrade(up.id)
        }}
      >
        {rank >= up.maxRank ? 'Maxed' : can.ok ? `Buy · ${cost} FP` : can.reason ?? `Buy · ${cost} FP`}
      </button>
    </article>
  )
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
  const recipe = getBlueprint(mod.id)
  const progress = blueprintProgress(state, mod.id)
  const printed = state.shipyard.unlockedModules.includes(mod.id)
  const check = canAssembleBlueprint(state, mod.id)
  const justReady = useJustBecame(check.ok && !printed)
  const need = modulePrintSector(mod.id)
  const tracked = state.foundry.trackedPrintId === mod.id
  const totals = blueprintFragmentTotals(progress?.owned, progress?.need)
  const partsLine = recipe
    ? PART_TYPES.map((pt) => {
        const have = progress?.owned[pt] ?? 0
        const want = recipe[pt]
        return `${pt[0]!.toUpperCase()}${pt.slice(1)} ${have}/${want}`
      }).join(' · ')
    : ''
  const foundryLine = recipe?.foundry
    ? Object.entries(recipe.foundry)
        .map(([id, n]) => `${n} ${FOUNDRY_RECIPES.find((r) => r.id === id)?.name ?? id}`)
        .join(' · ')
    : ''
  const masteryLine = recipe?.requiresRecipeLevel
    ? `${FOUNDRY_RECIPES.find((r) => r.id === recipe.requiresRecipeLevel?.recipeId)?.name ?? recipe.requiresRecipeLevel.recipeId} Lv ${recipe.requiresRecipeLevel.level}`
    : ''
  const sourceLine = printed ? '' : formatPrintSourceLine(mod.id)
  const live = !state.combat.docked
  const familyMismatch =
    !printed &&
    tracked &&
    live &&
    !sectorCanDropPrint(state.combat.sector, mod.id, state.combat.route)
  const rowClass = printed
    ? 'network-row is-printed'
    : tracked
      ? `network-row is-tracked${check.ok ? ' is-complete is-ready' : ''}${justReady ? ' just-ready' : ''}`
      : check.ok
        ? `network-row is-complete is-ready${justReady ? ' just-ready' : ''}`
        : 'network-row locked'

  return (
    <article className={rowClass} data-focus={`print-${mod.id}`}>
      <div className="network-row-main">
        <strong>{mod.name}</strong>
        <span className={printed || check.ok || tracked ? 'status-tag ok' : 'muted'}>
          {printed
            ? 'Printed'
            : check.ok
              ? 'Ready to Assemble'
              : tracked
                ? 'Tracked'
                : `S${need} · ${mod.role === 'defense' ? 'Shield' : mod.role === 'utility' ? 'Utility' : 'Weapon'}`}
        </span>
      </div>
      <p className="network-row-stats">
        {printed
          ? 'Fit this Core on the next Rebuild.'
          : `Fragments ${totals.have} / ${totals.need}`}
      </p>
      {!printed ? (
        <p className="network-row-stats print-parts">{partsLine}</p>
      ) : null}
      {!printed && (sourceLine || foundryLine || masteryLine) ? (
        <p className="network-row-stats">
          {[sourceLine, foundryLine, masteryLine].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {familyMismatch ? (
        <p className="network-row-stats print-warn">
          {mod.name} fragments do not drop from this enemy family.
        </p>
      ) : null}
      {!printed ? (
        <p className="print-row-actions">
          {onTrack ? (
            <button
              type="button"
              className={tracked ? 'primary' : undefined}
              onClick={() => onTrack(tracked ? null : mod.id)}
            >
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
            {check.ok ? 'Assemble' : check.reason ?? 'Farm wrecks'}
          </button>
        </p>
      ) : null}
    </article>
  )
}

export function FoundryTab({
  state,
  onSetSlot,
  onBuyUpgrade,
  onEquip,
  onUnequip,
  onAssemble,
  onTrack,
  onBuyMax,
  onPlaceBuilding,
  onClearBuilding,
  onBuyArm,
  onBuyMaxArms,
  onSaveLayout,
  onLoadLayout,
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
        { id: 'smelt', label: 'Smelt' },
        { id: 'build', label: 'Build' },
        { id: 'ranks', label: 'Ranks' },
        { id: 'prints', label: 'Prints' },
        { id: 'fit', label: 'Fit' },
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
            ? `${formatCompact(foundry.points)} FP · ${foundry.slots.length} smelter${foundry.slots.length === 1 ? '' : 's'}`
            : `Reach Wave ${ACT1_CADENCE.foundry} to bring the Foundry online.`}
        </p>
      </header>
      {!open ? (
        <p className="muted empty-state">Turn Salvage into permanent materials. Opens at Wave {ACT1_CADENCE.foundry}.</p>
      ) : (
        <>
          <SheetTabs value={activePane} onChange={setPane} options={panes} label="Foundry panes" />
          <div className="panel-scroll">
          {activePane === 'smelt' ? (
            <>
          <h3 className="foundry-heading" data-guide="foundry-smelters">
            Smelters
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
            Advanced stock needs precursor materials. Example: Slag Ingot → Hardened Plate → Void Slag.
          </p>
          {FOUNDRY_RECIPES.map((recipe) => {
            const unlocked = isFoundryRecipeUnlocked(state, recipe.id)
            const inf = isFoundryInfinite(state, recipe.id)
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
                  <span className="muted">
                    {inf ? 'Solved' : unlocked ? `Lv ${level}` : 'Locked'}
                  </span>
                </div>
                <p className="network-row-stats">
                  {unlocked
                    ? inf
                      ? 'The floor supplies this. You can leave it idle.'
                      : `${formatFoundryCost(cost)} · ${formatCompact(time, 1)}s · ×${foundryCraftOutput(state, recipe.id)} · ${xp}/${need} · stock ${formatCompact(Number.isFinite(stock) ? stock : 0)}`
                    : recipe.blurb + ' · ' + foundryRecipeGateLine(recipe)}
                </p>
                {unlocked && !inf && foundryHasMaterialChain(recipe) ? (
                  <p className="network-row-stats">{foundryRecipeChainLine(recipe)}</p>
                ) : null}
                {unlocked && !inf && nextMastery ? (
                  <p className="network-row-stats">
                    Next mastery Lv {nextMastery.at}: {nextMastery.blurb}
                  </p>
                ) : null}
                {unlocked && !inf ? (
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
                    {assigned >= 0 ? 'Queued' : idleSlot >= 0 ? 'Smelt' : 'No slot'}
                  </button>
                ) : null}
              </article>
            )
          })}
            </>
          ) : null}

          {activePane === 'build' && onPlaceBuilding && onClearBuilding && onBuyArm ? (
            <YardTab
              embedded
              state={state}
              onPlace={onPlaceBuilding}
              onClear={onClearBuilding}
              onBuyArm={onBuyArm}
              onBuyMax={onBuyMaxArms}
              onSaveLayout={onSaveLayout}
              onLoadLayout={onLoadLayout}
              guideTarget={guideTarget}
            />
          ) : null}

          {activePane === 'ranks' ? (
            <>
              <h3 className="foundry-heading" data-guide="foundry-ranks">
                Ranks
              </h3>
              {onBuyMax && hasProcess(state, 'foundry-buy-max') ? (
                <p className="assign-row">
                  <button type="button" className="primary" onClick={onBuyMax}>
                    Buy Max
                  </button>
                </p>
              ) : null}
              {FOUNDRY_UPGRADES.map((up) => (
                <RankRow key={up.id} state={state} up={up} onBuyUpgrade={onBuyUpgrade} />
              ))}
            </>
          ) : null}

          {activePane === 'prints' ? (
            <>
              <h3 className="foundry-heading" data-guide="foundry-prints">
                Core prints
              </h3>
              <p className="muted">
                Track one print. Advance finds fragments as you push.
                farm it on purpose.
              </p>
              {listFarmableCores(state).map((mod) => (
                <PrintRow
                  key={mod.id}
                  state={state}
                  mod={mod}
                  onAssemble={onAssemble}
                  onTrack={onTrack}
                />
              ))}
            </>
          ) : null}

          {activePane === 'fit' ? (
            <>
              <h3 className="foundry-heading">Fit</h3>
              <p className="muted">{foundryFitSlots(state)} fitted bits. Swap only while docked.</p>
              {FOUNDRY_MODULES.map((mod) => {
                const unlocked = isFoundryModuleUnlocked(state, mod.id)
                const fitted = foundry.equipped.includes(mod.id)
                const costBits = Object.entries(mod.cost)
                  .map(([id, n]) => `${n} ${FOUNDRY_RECIPES.find((r) => r.id === id)?.name ?? id}`)
                  .join(' · ')
                return (
                  <article
                    key={mod.id}
                    className={
                      unlocked ? (fitted ? 'network-row is-fitted' : 'network-row is-ready') : 'network-row locked'
                    }
                  >
                    <div className="network-row-main">
                      <InspectName
                        name={mod.name}
                        card={unlocked ? inspectFoundryModule(state, mod.id) : null}
                      />
                      <span className={fitted ? 'status-tag teal' : unlocked ? 'status-tag ok' : 'muted'}>
                        {fitted ? 'Fitted' : unlocked ? 'Ready' : 'Locked'}
                      </span>
                    </div>
                    <p className="network-row-stats">
                      {mod.blurb}
                      {unlocked ? ` · ${costBits}` : ''}
                    </p>
                    {unlocked ? (
                      <button
                        type="button"
                        className={fitted ? undefined : 'primary'}
                        disabled={!state.combat.docked}
                        onClick={(e) => {
                          markLocalOk(e.currentTarget)
                          if (fitted) onUnequip(mod.id)
                          else onEquip(mod.id)
                        }}
                      >
                        {fitted ? 'Unequip' : 'Equip'}
                      </button>
                    ) : null}
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
