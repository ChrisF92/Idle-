import type { CoreInstance, GameState, ShipLoadout } from './types'

function validInstances(loadout: ShipLoadout): CoreInstance[] {
  const seen = new Set<string>()
  const out: CoreInstance[] = []
  for (const value of loadout.coreInstances ?? []) {
    if (!value || typeof value.id !== 'string' || typeof value.moduleId !== 'string') continue
    if (!value.id || !value.moduleId || seen.has(value.id)) continue
    seen.add(value.id)
    out.push({
      id: value.id,
      moduleId: value.moduleId,
      targetingDoctrine: value.targetingDoctrine ?? null,
    })
  }
  return out
}

function nextInstanceId(instances: CoreInstance[], moduleId: string): string {
  const used = new Set(instances.map((instance) => instance.id))
  let copy = 1
  while (used.has(`${moduleId}:${copy}`)) copy += 1
  return `${moduleId}:${copy}`
}

/**
 * `shipyard.coreInstances` is the only physical-ownership list.
 * Knowing/unlocking a type never fabricates a copy. Malformed fitted slots
 * without a matching instance are dropped, not reconstructed.
 */
export function normalizeCoreInstances(loadout: ShipLoadout): ShipLoadout {
  const instances = validInstances(loadout)
  loadout.coreInstances = instances

  const used = new Set<string>()
  const fitted: string[] = []
  const equipped: string[] = []
  for (let slot = 0; slot < (loadout.modules ?? []).length; slot += 1) {
    const moduleId = loadout.modules[slot]!
    const preferred = loadout.equippedCoreIds?.[slot]
    const preferredInstance = instances.find(
      (instance) => instance.id === preferred && instance.moduleId === moduleId && !used.has(instance.id),
    )
    const instance =
      preferredInstance ??
      instances.find((candidate) => candidate.moduleId === moduleId && !used.has(candidate.id))
    if (!instance) continue
    used.add(instance.id)
    fitted.push(moduleId)
    equipped.push(instance.id)
  }
  loadout.modules = fitted
  loadout.equippedCoreIds = equipped
  return loadout
}

/** Reconciles fitted instance IDs after the module list changes. Never fabricates copies. */
export function reconcileEquippedCoreIds(
  loadout: ShipLoadout,
  previousModules: string[] = loadout.modules,
  previousCoreIds: string[] = loadout.equippedCoreIds ?? [],
): void {
  const instances = validInstances(loadout)
  loadout.coreInstances = instances
  const priorByModule = new Map<string, string[]>()
  previousModules.forEach((moduleId, index) => {
    const coreId = previousCoreIds[index]
    if (!coreId) return
    const queue = priorByModule.get(moduleId) ?? []
    queue.push(coreId)
    priorByModule.set(moduleId, queue)
  })

  const used = new Set<string>()
  const fitted: string[] = []
  const equipped: string[] = []
  for (const moduleId of loadout.modules) {
    const prior = priorByModule.get(moduleId)?.find(
      (coreId) =>
        !used.has(coreId) &&
        instances.some((instance) => instance.id === coreId && instance.moduleId === moduleId),
    )
    const available =
      prior ??
      instances.find((instance) => instance.moduleId === moduleId && !used.has(instance.id))?.id
    if (!available) continue
    used.add(available)
    fitted.push(moduleId)
    equipped.push(available)
  }
  loadout.modules = fitted
  loadout.equippedCoreIds = equipped
}

export function addCoreInstance(loadout: ShipLoadout, moduleId: string): CoreInstance {
  const instances = validInstances(loadout)
  const instance = { id: nextInstanceId(instances, moduleId), moduleId }
  loadout.coreInstances = [...instances, instance]
  return instance
}

export function coreInstanceAtSlot(
  state: Pick<GameState, 'shipyard'>,
  slot: number,
): CoreInstance | null {
  const moduleId = state.shipyard.modules?.[slot]
  if (!moduleId) return null
  const coreId = state.shipyard.equippedCoreIds?.[slot]
  if (!coreId) return null
  return (
    state.shipyard.coreInstances?.find(
      (instance) => instance.id === coreId && instance.moduleId === moduleId,
    ) ?? null
  )
}

/** Physical-instance resolver. Requires an exact instance ID — never a Core type ID. */
export function resolveCoreInstance(
  state: Pick<GameState, 'shipyard'>,
  coreInstanceId: string,
): CoreInstance | null {
  return state.shipyard.coreInstances?.find((instance) => instance.id === coreInstanceId) ?? null
}

/** UI helper. Not the instance-state resolver. */
export function firstOwnedCoreInstanceOfType(
  state: Pick<GameState, 'shipyard'>,
  moduleId: string,
): CoreInstance | null {
  return state.shipyard.coreInstances?.find((instance) => instance.moduleId === moduleId) ?? null
}

export function availableCoreInstances(
  state: Pick<GameState, 'shipyard'>,
  moduleId?: string,
  replacingCoreId?: string,
): CoreInstance[] {
  const equipped = new Set(state.shipyard.equippedCoreIds ?? [])
  if (replacingCoreId) equipped.delete(replacingCoreId)
  return (state.shipyard.coreInstances ?? []).filter(
    (instance) =>
      (!moduleId || instance.moduleId === moduleId) &&
      (!equipped.has(instance.id) || instance.id === replacingCoreId),
  )
}

export function coreInstanceCopyNumber(
  state: Pick<GameState, 'shipyard'>,
  coreInstanceId: string,
): number {
  const instance = resolveCoreInstance(state, coreInstanceId)
  if (!instance) return 1
  const copies = (state.shipyard.coreInstances ?? []).filter(
    (candidate) => candidate.moduleId === instance.moduleId,
  )
  const index = copies.findIndex((candidate) => candidate.id === instance.id)
  return index >= 0 ? index + 1 : 1
}
