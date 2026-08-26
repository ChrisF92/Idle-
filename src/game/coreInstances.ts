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
 * Hydrates physical Core copies from the legacy count + module arrays.
 * Mutates the supplied loadout so callers can use it during save migration.
 */
export function normalizeCoreInstances(loadout: ShipLoadout): ShipLoadout {
  const instances = validInstances(loadout)
  const moduleIds = new Set<string>([
    ...(loadout.unlockedModules ?? []),
    ...(loadout.modules ?? []),
    ...Object.keys(loadout.moduleCopies ?? {}),
    ...instances.map((instance) => instance.moduleId),
  ])

  for (const moduleId of moduleIds) {
    const fitted = (loadout.modules ?? []).filter((id) => id === moduleId).length
    const legacyCopies = Math.max(0, Math.floor(loadout.moduleCopies?.[moduleId] ?? 0))
    const unlocked = loadout.unlockedModules?.includes(moduleId) ? 1 : 0
    const desired = Math.max(fitted, legacyCopies, unlocked)
    while (instances.filter((instance) => instance.moduleId === moduleId).length < desired) {
      instances.push({ id: nextInstanceId(instances, moduleId), moduleId })
    }
  }

  const used = new Set<string>()
  const equipped = (loadout.modules ?? []).map((moduleId, slot) => {
    const preferred = loadout.equippedCoreIds?.[slot]
    const preferredInstance = instances.find(
      (instance) => instance.id === preferred && instance.moduleId === moduleId && !used.has(instance.id),
    )
    const instance =
      preferredInstance ??
      instances.find((candidate) => candidate.moduleId === moduleId && !used.has(candidate.id))
    if (instance) {
      used.add(instance.id)
      return instance.id
    }
    const created = { id: nextInstanceId(instances, moduleId), moduleId }
    instances.push(created)
    used.add(created.id)
    return created.id
  })

  loadout.coreInstances = instances
  loadout.equippedCoreIds = equipped
  loadout.moduleCopies = {
    ...(loadout.moduleCopies ?? {}),
    ...Object.fromEntries(
      [...moduleIds].map((moduleId) => [
        moduleId,
        instances.filter((instance) => instance.moduleId === moduleId).length,
      ]),
    ),
  }
  return loadout
}

/** Reconciles physical instance IDs after code changes the fitted module list. */
export function reconcileEquippedCoreIds(
  loadout: ShipLoadout,
  previousModules: string[] = loadout.modules,
  previousCoreIds: string[] = loadout.equippedCoreIds ?? [],
): void {
  normalizeCoreInstances(loadout)
  const priorByModule = new Map<string, string[]>()
  previousModules.forEach((moduleId, index) => {
    const coreId = previousCoreIds[index]
    if (!coreId) return
    const queue = priorByModule.get(moduleId) ?? []
    queue.push(coreId)
    priorByModule.set(moduleId, queue)
  })

  const used = new Set<string>()
  loadout.equippedCoreIds = loadout.modules.map((moduleId) => {
    const prior = priorByModule.get(moduleId)?.find(
      (coreId) =>
        !used.has(coreId) &&
        loadout.coreInstances.some(
          (instance) => instance.id === coreId && instance.moduleId === moduleId,
        ),
    )
    const available =
      prior ??
      loadout.coreInstances.find(
        (instance) => instance.moduleId === moduleId && !used.has(instance.id),
      )?.id
    if (available) {
      used.add(available)
      return available
    }
    const created = addCoreInstance(loadout, moduleId)
    used.add(created.id)
    return created.id
  })
}

export function addCoreInstance(loadout: ShipLoadout, moduleId: string): CoreInstance {
  normalizeCoreInstances(loadout)
  const instance = { id: nextInstanceId(loadout.coreInstances, moduleId), moduleId }
  loadout.coreInstances.push(instance)
  loadout.moduleCopies = {
    ...(loadout.moduleCopies ?? {}),
    [moduleId]: loadout.coreInstances.filter((item) => item.moduleId === moduleId).length,
  }
  return instance
}

export function coreInstanceAtSlot(
  state: Pick<GameState, 'shipyard'>,
  slot: number,
): CoreInstance | null {
  const moduleId = state.shipyard.modules?.[slot]
  if (!moduleId) return null
  const coreId = state.shipyard.equippedCoreIds?.[slot]
  const exact = state.shipyard.coreInstances?.find(
    (instance) => instance.id === coreId && instance.moduleId === moduleId,
  )
  if (exact) return exact

  const occurrence = state.shipyard.modules.slice(0, slot + 1).filter((id) => id === moduleId).length - 1
  return (
    state.shipyard.coreInstances?.filter((instance) => instance.moduleId === moduleId)[occurrence] ?? {
      id: `${moduleId}:${occurrence + 1}`,
      moduleId,
    }
  )
}

export function resolveCoreInstance(
  state: Pick<GameState, 'shipyard'>,
  coreIdOrModuleId: string,
): CoreInstance | null {
  const exact = state.shipyard.coreInstances?.find((instance) => instance.id === coreIdOrModuleId)
  if (exact) return exact
  const slot = state.shipyard.modules?.findIndex((moduleId) => moduleId === coreIdOrModuleId) ?? -1
  if (slot >= 0) return coreInstanceAtSlot(state, slot)
  return (
    state.shipyard.coreInstances?.find((instance) => instance.moduleId === coreIdOrModuleId) ?? null
  )
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
