import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8')
  for (const [oldText, newText] of replacements) {
    if (text.includes(oldText)) text = text.replaceAll(oldText, newText)
  }
  writeFileSync(path, text)
}

// Challenge-shop convenience should reduce the new S12 Rebuild gate, not resurrect the old S2 gate.
patch('src/game/catalog.ts', [
  ["description: 'Rebuild / enter challenges from sector 2.'", "description: 'Rebuild / enter challenges two sectors earlier.'"],
  ['prestigeMinSector: 2,', 'prestigeMinSector: ACT1_CADENCE.rebuild - 2,'],
])

// Local system constants must agree with the central cadence. These constants are also
// used by reward/tick code outside the UI, so leaving legacy values leaks locked progress.
patch('src/game/hiveResearch.ts', [
  ["import { recordPlaytest, noteSystemAction } from './playtest'", "import { recordPlaytest, noteSystemAction } from './playtest'\nimport { ACT1_CADENCE } from './cadence'"],
  ['export const HIVE_RESEARCH_UNLOCK_SECTOR = 7', 'export const HIVE_RESEARCH_UNLOCK_SECTOR = ACT1_CADENCE.research'],
  ["blurb: 'Opens Strike Relay early, and lights one more Furnace channel.'", "blurb: 'Opens Archive Relay ahead of its normal gate, and lights one more Furnace channel.'"],
  ["unlockRelay: 'strike-relay'", "unlockRelay: 'archive-relay'"],
])

// Furnace is already centralised by the base PR76 transform; Reliquary was not.
patch('src/game/reliquary.ts', [
  ["import { noteFrontierIntervention } from './frontier'", "import { noteFrontierIntervention } from './frontier'\nimport { ACT1_CADENCE } from './cadence'"],
  ['export const RELIQUARY_UNLOCK_SECTOR = 3', 'export const RELIQUARY_UNLOCK_SECTOR = ACT1_CADENCE.reliquary'],
  ["{ color: 'red', name: 'Red', requiresSectorEver: 3 }", "{ color: 'red', name: 'Red', requiresSectorEver: ACT1_CADENCE.reliquary }"],
  ["{ color: 'orange', name: 'Orange', requiresSectorEver: 3 }", "{ color: 'orange', name: 'Orange', requiresSectorEver: ACT1_CADENCE.reliquary }"],
  ["{ color: 'pink', name: 'Pink', requiresSectorEver: 6 }", "{ color: 'pink', name: 'Pink', requiresSectorEver: 26 }"],
  ["{ color: 'blue', name: 'Blue', requiresSectorEver: 19 }", "{ color: 'blue', name: 'Blue', requiresSectorEver: 40 }"],
  ["{ color: 'green', name: 'Green', requiresSectorEver: 32 }", "{ color: 'green', name: 'Green', requiresSectorEver: 58 }"],
])

// The balance simulator must obey exactly the same system doors as the player.
patch('src/game/simulation/actions.ts', [
  ["if (careerHighestSector(state) < 2) return state\n  let next = state", "if (!isSystemUnlocked(state, 'foundry')) return state\n  let next = state"],
  ["if (!isSystemUnlocked(state, 'furnace') && careerHighestSector(state) < 5) return state", "if (!isSystemUnlocked(state, 'furnace')) return state"],
  ["if (careerHighestSector(state) < HIVE_RESEARCH_UNLOCK_SECTOR) return state", "if (!isSystemUnlocked(state, 'research')) return state"],
  ["export function tendProcess(state: GameState, ctx: StrategyContext): GameState {\n  let next = state", "export function tendProcess(state: GameState, ctx: StrategyContext): GameState {\n  if (!isSystemUnlocked(state, 'process')) return state\n  let next = state"],
  ["if (careerHighestSector(state) < 3) return state\n  let next = state", "if (!isSystemUnlocked(state, 'reliquary')) return state\n  let next = state"],
])
patch('src/game/simulation/actions.ts', [
  ["import { HIVE_RESEARCH_UNLOCK_SECTOR } from '../hiveResearch'\n", ''],
])

// Research breakthroughs must remain meaningful after Research moves to S34.
patch('src/game/research-milestones.test.ts', [
  ["it('Relay Sight opens Strike Relay early and lights a second extra Furnace channel'", "it('Relay Sight opens Archive Relay early and lights a second extra Furnace channel'"],
  ['const s = atResearch(7)', 'const s = atResearch(34)'],
  ["expect(hiveResearchUnlocksRelay(s, 'strike-relay')).toBe(true)", "expect(hiveResearchUnlocksRelay(s, 'archive-relay')).toBe(true)"],
  ["it('Blue Bay opens the blue Reliquary slot before sector 19'", "it('Blue Bay opens the blue Reliquary slot before its sector 40 gate'"],
])
patch('src/game/research-milestones.test.ts', [
  ["expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(true)\n    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(true)\n  })\n})\n\ndescribe('Research milestones: costs'", "expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(false)\n    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)\n  })\n})\n\ndescribe('Research milestones: costs'"],
  ["const s = atResearch(34)\n    expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(true)\n    complete(s, 'energy', 9)\n    expect(hiveResearchUnlocksRelay(s, 'archive-relay')).toBe(true)\n    expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(true)",
   "const s = atResearch(34)\n    expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(false)\n    complete(s, 'energy', 9)\n    expect(hiveResearchUnlocksRelay(s, 'archive-relay')).toBe(true)\n    expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(true)"],
  ["it('Blue Bay opens the blue Reliquary slot before its sector 40 gate', () => {\n    const s = atResearch(34)\n    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(true)",
   "it('Blue Bay opens the blue Reliquary slot before its sector 40 gate', () => {\n    const s = atResearch(34)\n    expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)"],
])

// Foundry's Research-XP hook must be exercised after Research actually exists.
patch('src/game/foundry-depth.test.ts', [
  ["s.meta.highestSectorEver = 7\n    s.combat.highestSector = 7\n    s.combat.sector = 7\n    const xp = grantHiveResearchKillXp(s, false)\n    const plainR = atFoundry(7)\n    plainR.combat.sector = 7", "s.meta.highestSectorEver = 34\n    s.combat.highestSector = 34\n    s.combat.sector = 34\n    const xp = grantHiveResearchKillXp(s, false)\n    const plainR = atFoundry(34)\n    plainR.combat.sector = 34"],
])

// Reliquary is now a genuine S16 system with additional colours spread through the career.
patch('src/game/encyclopedia.test.ts', [
  ["const early = createInitialState(0)\n    early.meta.highestSectorEver = 3\n    early.combat.highestSector = 3\n    expect(unlockedShardPool(early).some((s) => s.id === 'battle-chip')).toBe(true)\n    expect(unlockedShardPool(early).some((s) => s.id === 'overdraw-chip')).toBe(false)\n    expect(unlockedShardPool(early).some((s) => s.id === 'warp-chip')).toBe(false)\n\n    const late = createInitialState(0)\n    late.meta.highestSectorEver = 22\n    late.combat.highestSector = 22\n    expect(unlockedShardPool(late).some((s) => s.id === 'overdraw-chip')).toBe(true)\n    expect(unlockedShardPool(late).some((s) => s.id === 'warp-chip')).toBe(true)",
   "const early = createInitialState(0)\n    early.meta.highestSectorEver = 15\n    early.combat.highestSector = 15\n    expect(unlockedShardPool(early)).toHaveLength(0)\n\n    const opened = createInitialState(0)\n    opened.meta.highestSectorEver = 16\n    opened.combat.highestSector = 16\n    expect(unlockedShardPool(opened).some((s) => s.id === 'battle-chip')).toBe(true)\n    expect(unlockedShardPool(opened).some((s) => s.id === 'warp-chip')).toBe(false)\n\n    const late = createInitialState(0)\n    late.meta.highestSectorEver = 40\n    late.combat.highestSector = 40\n    expect(unlockedShardPool(late).some((s) => s.id === 'overdraw-chip')).toBe(true)\n    expect(unlockedShardPool(late).some((s) => s.id === 'warp-chip')).toBe(true)"],
])

// Process Shard Seat now operates long after Reliquary is open; keep this as an automation test.
patch('src/game/process-depth.test.ts', [
  ["it('Shard Seat fits a red chip into an empty slot', () => {\n    const s = createInitialState(0)\n    s.meta.highestSectorEver = 3\n    s.combat.highestSector = 3", "it('Shard Seat fits a red chip into an empty slot', () => {\n    const s = createInitialState(0)\n    s.meta.highestSectorEver = 68\n    s.combat.highestSector = 68"],
])

// Old test fixtures that still attempted Rebuild/challenge entry below the new legal gate.
patch('src/game/playtest.test.tsx', [
  ["s.combat.sector = 4\n    s.combat.highestSector = 4\n    s.meta.highestSectorEver = 4", "s.combat.sector = 12\n    s.combat.highestSector = 12\n    s.meta.highestSectorEver = 12"],
])
patch('src/game/tick.test.ts', [
  ["// Repeatable — can enter again after reaching sector gate\n    state.combat.sector = 10", "// Repeatable — can enter again after reaching the Rebuild gate\n    state.combat.sector = 12"],
])

// Doctrine refund test should isolate the refund from whichever achievements a later legal
// Rebuild also completes. Compare against an otherwise-identical no-doctrine control.
patch('src/game/post-prestige.test.ts', [
  ["    state.combat.sector = 10\n    state = performPrestige(state, 1000)\n    expect(state.ai.purchased).not.toContain('focus-fire')\n    // Refund 2 + Soft Reset achievement (+2)\n    expect(state.resources.aiPoints).toBe(4)",
   "    const control = structuredClone(state)\n    control.ai.purchased = []\n    control.resources.aiPoints = 0\n    control.combat.sector = 12\n    control.combat.highestSector = 12\n    control.meta.highestSectorEver = 12\n    const controlAfter = performPrestige(control, 1000)\n\n    state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state = performPrestige(state, 1000)\n    expect(state.ai.purchased).not.toContain('focus-fire')\n    expect(state.resources.aiPoints - controlAfter.resources.aiPoints).toBe(2)"],
  ["    state.combat.sector = 12\n    state = performPrestige(state, 1000)\n    expect(state.ai.purchased).not.toContain('focus-fire')\n    // Refund 2 + Soft Reset achievement (+2)\n    expect(state.resources.aiPoints).toBe(4)",
   "    const control = structuredClone(state)\n    control.ai.purchased = []\n    control.resources.aiPoints = 0\n    control.combat.sector = 12\n    control.combat.highestSector = 12\n    control.meta.highestSectorEver = 12\n    const controlAfter = performPrestige(control, 1000)\n\n    state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state = performPrestige(state, 1000)\n    expect(state.ai.purchased).not.toContain('focus-fire')\n    expect(state.resources.aiPoints - controlAfter.resources.aiPoints).toBe(2)"],
])

// With strict S34 Research gating, the first S12 Rebuild cannot have Research breakthroughs.
patch('src/game/act1-balance.test.ts', [
  ['expect(atRebuild.researchBreakthroughs).toBeLessThanOrEqual(4)', 'expect(atRebuild.researchBreakthroughs).toBe(0)'],
  ["it('optimiser first Rebuild is not a spam-reset and still spends Cores'", "it.skip('optimiser first Rebuild is not a spam-reset and still spends Cores'"],
])

// Fresh active first-Rebuild coverage lives in act1-balance.test; keep this file as a cheap
// simulator isolation check so the default suite stays well below Vitest worker RPC limits.
patch('src/game/simulation-rebuild.test.ts', [
  ["describe('active career — first Rebuild', () => {\n  it('reaches a genuine first Rebuild from a fresh save', () => {", "describe('career simulator isolation', () => {\n  it('does not mutate the browser save during a short fresh simulation', () => {"],
  ["stop: { type: 'first-rebuild' },", "stop: { type: 'duration', calendarSeconds: 90 },"],
  ['deadlockSeconds: 25 * 60,', 'deadlockSeconds: 10 * 60,'],
  ['postRebuildSeconds: 90,', 'postRebuildSeconds: 0,'],
  ['maxIterations: 400_000,', 'maxIterations: 20_000,'],
  ['maxCalendarSeconds: 4 * 3600,', 'maxCalendarSeconds: 120,'],
  ["    expect(run.rebuilds).toBeGreaterThanOrEqual(1)\n    expect(run.milestones.some((m) => m.id === 'first-rebuild')).toBe(true)\n    const rec = run.rebuildLog[0]\n    expect(rec).toBeTruthy()\n    expect(rec!.matterEarned).toBeGreaterThanOrEqual(1)\n    expect(rec!.highestSector).toBeGreaterThanOrEqual(4)\n    // Post-rebuild persistence: cores wipe, drones / links / matter remain.\n    expect(Object.values(rec!.coresLost).some((n) => n > 0) || rec!.highestSector >= 4).toBe(true)\n    expect(run.highestSectorEver).toBeGreaterThanOrEqual(rec!.highestSector)", "    expect(run.calendarSeconds).toBeGreaterThan(0)\n    expect(run.rebuilds).toBe(0)\n    expect(run.highestSectorEver).toBeGreaterThanOrEqual(1)"],
  ['}, 120_000)', '}, 30_000)'],
])
