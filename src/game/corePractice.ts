/** Tiny Core-practice counters. Kept import-light to avoid circular loads. */

export function practicedCoreWork(state: {
  meta?: { lifetimeCoreRunBuys?: number; moduleMastery?: Record<string, number> }
}): number {
  const mastery = Object.values(state.meta?.moduleMastery ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  return Math.max(state.meta?.lifetimeCoreRunBuys ?? 0, mastery)
}
