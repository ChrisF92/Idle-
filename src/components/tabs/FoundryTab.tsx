import type { GameState } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import {
  FOUNDRY_MODULES,
  FOUNDRY_RECIPES,
  FOUNDRY_UPGRADES,
  canBuyFoundryUpgrade,
  foundryCraftTime,
  foundryMaterialCount,
  foundryRecipeLevel,
  foundryUpgradeCost,
  formatFoundryCost,
  foundryRecipeGateLine,
  FOUNDRY_MODULE_SLOTS,
  isFoundryInfinite,
  isFoundryModuleUnlocked,
  isFoundryRecipeUnlocked,
  scaledFoundryCost,
  craftsForNextLevel,
} from '../../game/foundry'
import { formatCompact } from '../../game/format'
import {
  inspectFoundryModule,
  inspectFoundryRecipe,
  inspectFoundryUpgrade,
} from '../../game/inspect'
import { InspectName } from '../InspectName'

interface FoundryTabProps {
  state: GameState
  onSetSlot: (slotIndex: number, recipeId: string | null) => void
  onBuyUpgrade: (upgradeId: string) => void
  onEquip: (moduleId: string) => void
  onUnequip: (moduleId: string) => void
}

export function FoundryTab({
  state,
  onSetSlot,
  onBuyUpgrade,
  onEquip,
  onUnequip,
}: FoundryTabProps) {
  const open = isSystemUnlocked(state, 'foundry')
  const foundry = state.foundry

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <h2>Foundry</h2>
        <p>
          {open
            ? `${formatCompact(foundry.points)} FP · ${foundry.slots.length} smelter${foundry.slots.length === 1 ? '' : 's'}`
            : 'Clear sector 2 to bring the Foundry online.'}
        </p>
      </header>
      {!open ? (
        <p className="muted">Recipes, Foundry Points, and fitted bits land here.</p>
      ) : (
        <div className="panel-scroll">
          <h3 className="foundry-heading">Smelters</h3>
          {foundry.slots.map((slot, i) => (
            <article key={i} className="network-row">
              <div className="network-row-main">
                <strong>Slot {i + 1}</strong>
                <span className="muted">
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
                  <div className="network-fill" aria-hidden>
                    <span style={{ width: `${Math.round(slot.progress * 100)}%` }} />
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

          <h3 className="foundry-heading">Recipes</h3>
          {FOUNDRY_RECIPES.map((recipe) => {
            const unlocked = isFoundryRecipeUnlocked(state, recipe.id)
            const inf = isFoundryInfinite(state, recipe.id)
            const level = foundryRecipeLevel(state, recipe.id)
            const stock = foundryMaterialCount(state, recipe.id)
            const cost = scaledFoundryCost(state, recipe.id)
            const time = foundryCraftTime(state, recipe.id)
            const xp = foundry.recipeXp[recipe.id] ?? 0
            const need = craftsForNextLevel(level)
            const assigned = foundry.slots.findIndex((s) => s.recipeId === recipe.id)
            const idleSlot = foundry.slots.findIndex((s) => !s.recipeId)
            return (
              <article key={recipe.id} className={unlocked ? 'network-row' : 'network-row locked'}>
                <div className="network-row-main">
                  <InspectName name={recipe.name} card={inspectFoundryRecipe(state, recipe.id)} />
                  <span className="muted">
                    {inf ? 'Infinite' : unlocked ? `Lv ${level}` : 'Locked'}
                  </span>
                </div>
                <p className="network-row-stats">
                  {unlocked
                    ? inf
                      ? 'Passive stock'
                      : `${formatFoundryCost(cost)} · ${formatCompact(time, 1)}s · ${xp}/${need} · stock ${formatCompact(Number.isFinite(stock) ? stock : 0)}`
                    : recipe.blurb + ' · ' + foundryRecipeGateLine(recipe)}
                </p>
                {unlocked && !inf ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={idleSlot < 0 && assigned < 0}
                    onClick={() => {
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

          <h3 className="foundry-heading">Ranks</h3>
          {FOUNDRY_UPGRADES.map((up) => {
            const rank = foundry.upgrades[up.id] ?? 0
            const can = canBuyFoundryUpgrade(state, up.id)
            const cost = foundryUpgradeCost(state, up.id)
            return (
              <article key={up.id} className="network-row">
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
                  onClick={() => onBuyUpgrade(up.id)}
                >
                  {rank >= up.maxRank ? 'Maxed' : `Buy · ${cost} FP`}
                </button>
              </article>
            )
          })}

          <h3 className="foundry-heading">Fit</h3>
          <p className="muted">{FOUNDRY_MODULE_SLOTS} fitted bits. Swap only while docked.</p>
          {FOUNDRY_MODULES.map((mod) => {
            const unlocked = isFoundryModuleUnlocked(state, mod.id)
            const fitted = foundry.equipped.includes(mod.id)
            const costBits = Object.entries(mod.cost)
              .map(([id, n]) => `${n} ${FOUNDRY_RECIPES.find((r) => r.id === id)?.name ?? id}`)
              .join(' · ')
            return (
              <article key={mod.id} className={unlocked ? 'network-row' : 'network-row locked'}>
                <div className="network-row-main">
                  <InspectName name={mod.name} card={inspectFoundryModule(state, mod.id)} />
                  <span className="muted">{fitted ? 'Fitted' : unlocked ? 'Ready' : 'Locked'}</span>
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
                    onClick={() => (fitted ? onUnequip(mod.id) : onEquip(mod.id))}
                  >
                    {fitted ? 'Unequip' : 'Equip'}
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}