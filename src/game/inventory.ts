/**
 * Canonical owned-item model for Inventory.
 *
 * Relics are stored by Core *type*, not by Core instance:
 * `reliquary.coreFits[moduleId]` is one socket set per module id.
 * Extra Pulse Cannon copies share the same Relic loadout. Do not pretend
 * copies are separately configured unless the save model changes.
 */

import { SHIP_FRAMES, SHIP_MODULES, getFrame, getModule, moduleMasteryRank, type ModuleRole } from './catalog'
import { moduleCopyCount } from './coreProgression'
import { FOUNDRY_RECIPES, foundryMaterialCount, foundryRecipeLevel, getFoundryRecipe } from './foundry'
import {
  RELIC_SOCKET_LABELS,
  SHARDS,
  coreSocketRelics,
  fittedRelicIds,
  getShard,
  relicSocketClass,
  shardOwned,
  type ShardDef,
} from './reliquary'
import type { GameState, RelicSocketClass } from './types'

export type InventoryCategory = 'equipment' | 'relics' | 'materials'
export type MaterialFamily = 'industrial' | 'recovered'

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string }[] = [
  { id: 'equipment', label: 'Equipment' },
  { id: 'relics', label: 'Relics' },
  { id: 'materials', label: 'Materials' },
]

export const RELIC_FILTERS: { id: 'all' | RelicSocketClass; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'power', label: RELIC_SOCKET_LABELS.power },
  { id: 'optical', label: RELIC_SOCKET_LABELS.optical },
  { id: 'ballistic', label: RELIC_SOCKET_LABELS.ballistic },
  { id: 'shield', label: RELIC_SOCKET_LABELS.shield },
  { id: 'industrial', label: RELIC_SOCKET_LABELS.industrial },
  { id: 'universal', label: RELIC_SOCKET_LABELS.universal },
]

export interface FrameInventoryRow {
  kind: 'frame'
  id: string
  name: string
  owned: boolean
  equipped: boolean
  blurb: string
}

export interface CoreInventoryRow {
  kind: 'core'
  id: string
  name: string
  role: ModuleRole
  owned: number
  equipped: number
  available: number
  mastery: number
}

export type EquipmentRow = FrameInventoryRow | CoreInventoryRow

export interface RelicInventoryRow {
  id: string
  name: string
  socket: RelicSocketClass
  tier: number
  owned: number
  equipped: number
  available: number
  blurb: string
  fittedOn: string[]
  upgradesTo?: string
}

export interface MaterialInventoryRow {
  id: string
  name: string
  family: MaterialFamily
  stock: number
  mastery: number
  source: string
  consumedBy: string[]
  producedAs: string
}

export function equippedCoreCount(state: Pick<GameState, 'shipyard'>, moduleId: string): number {
  return (state.shipyard.modules ?? []).filter((id) => id === moduleId).length
}

export function coreCopyBreakdown(state: GameState, moduleId: string): CoreInventoryRow | null {
  const def = getModule(moduleId)
  if (!def) return null
  const owned = moduleCopyCount(state, moduleId)
  if (owned <= 0 && !state.shipyard.unlockedModules.includes(moduleId)) return null
  const equipped = equippedCoreCount(state, moduleId)
  return {
    kind: 'core',
    id: moduleId,
    name: def.name,
    role: def.role,
    owned: Math.max(owned, equipped),
    equipped,
    available: Math.max(0, Math.max(owned, equipped) - equipped),
    mastery: moduleMasteryRank(state, moduleId),
  }
}

export function inventoryEquipment(state: GameState): EquipmentRow[] {
  const frames: FrameInventoryRow[] = SHIP_FRAMES.filter((frame) =>
    state.shipyard.unlockedFrames.includes(frame.id),
  ).map((frame) => ({
    kind: 'frame',
    id: frame.id,
    name: frame.name,
    owned: true,
    equipped: state.shipyard.frameId === frame.id,
    blurb:
      frame.utilitySlots + frame.weaponSlots + frame.defenseSlots > 2
        ? `${frame.weaponSlots}W · ${frame.defenseSlots}D · ${frame.utilitySlots}U`
        : 'Balanced · 2 Core slots',
  }))

  const cores = SHIP_MODULES.map((mod) => coreCopyBreakdown(state, mod.id)).filter(
    (row): row is CoreInventoryRow => Boolean(row && row.owned > 0),
  )
  return [...frames, ...cores]
}

export function relicCopyBreakdown(state: GameState, relicId: string): RelicInventoryRow | null {
  const def = getShard(relicId)
  if (!def) return null
  return relicRowFromDef(state, def)
}

function relicRowFromDef(state: GameState, def: ShardDef): RelicInventoryRow {
  const available = shardOwned(state, def.id)
  const equipped = fittedRelicIds(state).filter((id) => id === def.id).length
  const fittedOn: string[] = []
  for (const [moduleId, slots] of Object.entries(state.reliquary?.coreFits ?? {})) {
    if (!Array.isArray(slots) || !slots.includes(def.id)) continue
    const name = getModule(moduleId)?.name ?? moduleId
    if (!fittedOn.includes(name)) fittedOn.push(name)
  }
  return {
    id: def.id,
    name: def.name,
    socket: relicSocketClass(def),
    tier: def.tier ?? 1,
    owned: available + equipped,
    equipped,
    available,
    blurb: def.blurb,
    fittedOn,
    upgradesTo: def.upgradesTo,
  }
}

export function inventoryRelics(state: GameState, filter: 'all' | RelicSocketClass = 'all'): RelicInventoryRow[] {
  return SHARDS.map((def) => relicRowFromDef(state, def))
    .filter((row) => row.owned > 0)
    .filter((row) => filter === 'all' || row.socket === filter)
}

export function relicAvailability(state: GameState, relicId: string): {
  owned: number
  equipped: number
  available: number
} {
  const row = relicCopyBreakdown(state, relicId)
  return {
    owned: row?.owned ?? 0,
    equipped: row?.equipped ?? 0,
    available: row?.available ?? 0,
  }
}

function materialFamily(id: string): MaterialFamily {
  const def = getFoundryRecipe(id)
  if (!def) return 'recovered'
  if (def.costs.materials && Object.keys(def.costs.materials).length > 0) return 'industrial'
  return 'recovered'
}

export function inventoryMaterials(state: GameState): MaterialInventoryRow[] {
  const ids = new Set<string>()
  for (const recipe of FOUNDRY_RECIPES) {
    ids.add(recipe.id)
    for (const mat of Object.keys(recipe.costs.materials ?? {})) ids.add(mat)
  }
  for (const id of Object.keys(state.foundry?.materials ?? {})) ids.add(id)

  const rows: MaterialInventoryRow[] = []
  for (const id of ids) {
    const def = getFoundryRecipe(id)
    const stock = foundryMaterialCount(state, id)
    const mastery = foundryRecipeLevel(state, id)
    if (stock <= 0 && mastery <= 0 && !def) continue
    const consumedBy = FOUNDRY_RECIPES.filter((recipe) => (recipe.costs.materials?.[id as never] ?? 0) > 0).map(
      (recipe) => recipe.name,
    )
    const source = def?.costs.salvage
      ? 'Salvage Processing'
      : def?.costs.scrap
        ? 'Scrap Processing'
        : consumedBy.length > 0
          ? 'Foundry Processing'
          : 'Recovered'
    rows.push({
      id,
      name: def?.name ?? id,
      family: materialFamily(id),
      stock,
      mastery,
      source,
      consumedBy,
      producedAs: def?.name ?? id,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export function filterInventoryRows<T extends { name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => row.name.toLowerCase().includes(q))
}

export function inventorySearchUseful(state: GameState): boolean {
  return inventoryEquipment(state).length + inventoryRelics(state).length + inventoryMaterials(state).length >= 12
}

export function loadoutRelicFill(state: GameState): { filled: number; sockets: number } {
  let filled = 0
  let sockets = 0
  for (const moduleId of state.shipyard.modules) {
    const slots = coreSocketRelics(state, moduleId)
    sockets += slots.length
    filled += slots.filter(Boolean).length
  }
  return { filled, sockets }
}

export function frameBlurb(state: GameState): string {
  const frame = getFrame(state.shipyard.frameId)
  if (!frame) return 'Hive'
  const slots = frame.weaponSlots + frame.defenseSlots + frame.utilitySlots
  if (frame.id === 'starter-frame' || slots <= 2) return 'Balanced · 2 Core slots'
  return `${frame.weaponSlots} weapon · ${frame.defenseSlots} defense · ${frame.utilitySlots} utility`
}

export const RELIC_STORAGE_NOTE =
  'Relics are stored by Core type, not by individual Core copies. Extra copies of the same Core share one Relic loadout.'
