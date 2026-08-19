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

patch('src/game/furnace.ts', [
  ["import { noteFrontierIntervention } from './frontier'", "import { noteFrontierIntervention } from './frontier'\nimport { ACT1_CADENCE } from './cadence'"],
  ['export const FURNACE_UNLOCK_SECTOR = 5', 'export const FURNACE_UNLOCK_SECTOR = ACT1_CADENCE.furnace'],
])

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

// The previous direct constant import is now redundant after strict system-gate checks.
patch('src/game/simulation/actions.ts', [
  ["import { HIVE_RESEARCH_UNLOCK_SECTOR } from '../hiveResearch'\n", ''],
])

// Research breakthroughs must remain meaningful after Research moves to S34.
patch('src/game/research-milestones.test.ts', [
  ["it('Relay Sight opens Strike Relay early and lights a second extra Furnace channel'", "it('Relay Sight opens Archive Relay early and lights a second extra Furnace channel'"],
  ['const s = atResearch(7)', 'const s = atResearch(34)'],
  ["expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(false)", "expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(false)"],
  ["expect(hiveResearchUnlocksRelay(s, 'strike-relay')).toBe(true)", "expect(hiveResearchUnlocksRelay(s, 'archive-relay')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(true)", "expect(isNetworkBarUnlocked(s, 'archive-relay')).toBe(true)"],
  ["it('Blue Bay opens the blue Reliquary slot before sector 19'", "it('Blue Bay opens the blue Reliquary slot before its sector 40 gate'"],
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
])

// The old Act-1 aggregate expected Research to be usable before the first Rebuild. With
// strict S34 gating that assertion is obsolete; the simulator should now report zero.
patch('src/game/act1-balance.test.ts', [
  ['expect(atRebuild.researchBreakthroughs).toBeLessThanOrEqual(4)', 'expect(atRebuild.researchBreakthroughs).toBe(0)'],
])
