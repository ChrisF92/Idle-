/** Tiny Core-practice counters. Kept import-light to avoid circular loads. */

export function practicedCoreWork(state: {
  meta?: { lifetimeCoreRunBuys?: number; moduleMastery?: Record<string, number> }
  shipyard?: { moduleLevels?: Record<string, number> }
}): number {
  const leftover = Object.values(state.shipyard?.moduleLevels ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  const mastery = Object.values(state.meta?.moduleMastery ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  return Math.max(leftover, state.meta?.lifetimeCoreRunBuys ?? 0, mastery)
}

export function anyCoreRunLevel(_state?: unknown): number {
  return 0
}
