/** Tiny Core-practice counters. Kept import-light to avoid circular loads. */

export function practicedCoreWork(state: {
  combat?: { coreRunLevels?: Record<string, number> }
  meta?: { lifetimeCoreRunBuys?: number; moduleMastery?: Record<string, number> }
  shipyard?: { moduleLevels?: Record<string, number> }
}): number {
  const leftover = Object.values(state.shipyard?.moduleLevels ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  const run = Object.values(state.combat?.coreRunLevels ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  const mastery = Object.values(state.meta?.moduleMastery ?? {}).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  )
  return Math.max(leftover, run, state.meta?.lifetimeCoreRunBuys ?? 0, mastery)
}

export function anyCoreRunLevel(state: { combat?: { coreRunLevels?: Record<string, number> } }): number {
  return Object.values(state.combat?.coreRunLevels ?? {}).reduce((a, b) => a + Math.max(0, b), 0)
}
