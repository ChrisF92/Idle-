import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8')
  for (const [oldText, newText] of replacements) {
    if (text.includes(oldText)) text = text.replaceAll(oldText, newText)
  }
  writeFileSync(path, text)
}

// Authoritative cadence assertions and the much wider first-Rebuild chapter.
patch('src/game/act1-balance.test.ts', [
  ['expect(ACT1_UNLOCKS.foundry).toBe(2)', 'expect(ACT1_UNLOCKS.foundry).toBe(6)'],
  ['expect(ACT1_UNLOCKS.reliquary).toBe(3)', 'expect(ACT1_UNLOCKS.reliquary).toBe(16)'],
  ['expect(ACT1_UNLOCKS.furnace).toBe(5)', 'expect(ACT1_UNLOCKS.furnace).toBe(28)'],
  ['expect(ACT1_UNLOCKS.research).toBe(7)', 'expect(ACT1_UNLOCKS.research).toBe(34)'],
  ['expect(ACT1_UNLOCKS.protocols).toBe(18)', 'expect(ACT1_UNLOCKS.protocols).toBe(52)'],
  ['expect(ACT1_UNLOCKS.echo).toBe(22)', 'expect(ACT1_UNLOCKS.echo).toBe(62)'],
  ["it('lists explicit Act 1 windows covering the first hour through S30'", "it('lists explicit progression windows from the opening through late career doors'"],
  ['expect(rebuild.min).toBeGreaterThanOrEqual(6 * 60)', 'expect(rebuild.min).toBeGreaterThanOrEqual(30 * 60)'],
  ['expect(rebuild.max).toBeLessThanOrEqual(70 * 60)', 'expect(rebuild.max).toBeLessThanOrEqual(5 * 60 * 60)'],
  ["['sector-1', 'foundry-unlock', 'reliquary-unlock', 'furnace-unlock'].includes(t.id)", "['sector-1', 'foundry-unlock'].includes(t.id)"],
  ['maxCalendarSeconds: 4 * 3600', 'maxCalendarSeconds: 6 * 3600'],
])

// Any test that actually performs a Rebuild must now reach the legal S12 door.
patch('src/game/ascension-qol.test.ts', [
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
  ['state.meta.highestSectorEver = 10', 'state.meta.highestSectorEver = 12'],
  ['state.combat.highestSector = 10', 'state.combat.highestSector = 12'],
])
patch('src/game/blueprints.test.ts', [
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
  ['state.meta.highestSectorEver = 10', 'state.meta.highestSectorEver = 12'],
  ['state.combat.highestSector = 10', 'state.combat.highestSector = 12'],
])
patch('src/game/core.test.ts', [
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
])
patch('src/game/cosmic-idle-cleanup.test.ts', [
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
  ['state.combat.highestSector = 10', 'state.combat.highestSector = 12'],
  ['state.meta.highestSectorEver = 10', 'state.meta.highestSectorEver = 12'],
])
patch('src/game/foundry.test.ts', [
  ["s.combat.sector = 4\n    s.meta.highestSectorEver = 4\n    s.foundry.recipeLevels['slag-ingot'] = 8", "s.combat.sector = 12\n    s.combat.highestSector = 12\n    s.meta.highestSectorEver = 12\n    s.foundry.recipeLevels['slag-ingot'] = 8"],
])
patch('src/game/foundry-depth.test.ts', [
  ['let s = atFoundry(8)\n    s.combat.sector = 8', 'let s = atFoundry(12)\n    s.combat.sector = 12'],
])
patch('src/game/signal-cores.test.ts', [
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
  ['kept.combat.sector = 10', 'kept.combat.sector = 12'],
])
patch('src/game/slag-bank.test.ts', [
  ["s.combat.sector = 4\n    s.meta.highestSectorEver = 4\n    s.combat.highestSector = 4", "s.combat.sector = 12\n    s.meta.highestSectorEver = 12\n    s.combat.highestSector = 12"],
])

patch('src/game/phase3.test.ts', [
  ["it('allows Rebuild from sector 4 and wipes Core levels'", "it('allows Rebuild from sector 12 and wipes Core levels'"],
  ["s.combat.sector = 4\n    s.meta.highestSectorEver = 4\n    s.combat.highestSector = 4\n    s.shipyard.moduleLevels['pulse-cannon'] = 6", "s.combat.sector = 12\n    s.meta.highestSectorEver = 12\n    s.combat.highestSector = 12\n    s.shipyard.moduleLevels['pulse-cannon'] = 6"],
  ["s.combat.sector = 5\n    s.combat.highestSector = 4\n    s.meta.highestSectorEver = 4\n    s.shipyard.unlockedFrames", "s.combat.sector = 12\n    s.combat.highestSector = 12\n    s.meta.highestSectorEver = 12\n    s.shipyard.unlockedFrames"],
])

// Yard is intentionally post-second-Rebuild at S20.
patch('src/game/phase7.test.ts', [
  ["it('opens Yard after Rebuild; buildings produce; arms apply on the next Rebuild'", "it('opens Yard at S20 after two Rebuilds; buildings produce; arms apply on the next Rebuild'"],
  ["s.combat.sector = 4\n    s.meta.highestSectorEver = 4\n    s.combat.highestSector = 4\n    s = performRebuild", "s.combat.sector = 20\n    s.meta.highestSectorEver = 20\n    s.combat.highestSector = 20\n    s.prestige.prestigeCount = 1\n    s = performRebuild"],
  ['expect(yardGridSize(s)).toBe(3)', 'expect(yardGridSize(s)).toBe(4)'],
  ["s.combat.sector = 4\n    s = performRebuild", "s.combat.sector = 20\n    s.combat.highestSector = 20\n    s = performRebuild"],
])

// Campaign tests now target the actual first prestige sector.
patch('src/game/campaign.test.ts', [
  ["for (let i = 0; i < 80 && state.combat.highestSector < 10; i++)", "for (let i = 0; i < 120 && state.combat.highestSector < 12; i++)"],
  ['expect(state.combat.highestSector).toBeGreaterThanOrEqual(10)', 'expect(state.combat.highestSector).toBeGreaterThanOrEqual(12)'],
  ['expect(state.combat.sector).toBeGreaterThanOrEqual(10)', 'expect(state.combat.sector).toBeGreaterThanOrEqual(12)'],
  ["state.combat.sector = 10\n    state.meta.highestSectorEver = 10\n    state = performPrestige", "state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state = performPrestige"],
])

// Challenge entry spends a Rebuild, so challenge functional tests need a legal current run.
for (const file of ['src/game/challenge-depth.test.ts', 'src/game/challenge-pack.test.ts']) {
  patch(file, [
    ['state.combat.sector = 10', 'state.combat.sector = 12'],
  ])
}

// Early Gate still does its job relative to the new S12 baseline.
patch('src/game/challenge-shop.test.ts', [
  ['expect(prestigeMinSectorFor({})).toBe(4)', 'expect(prestigeMinSectorFor({})).toBe(12)'],
  ['expect(prestigeMinSectorFor(state.prestige.shop)).toBe(2)', 'expect(prestigeMinSectorFor(state.prestige.shop)).toBe(10)'],
  ['state.combat.sector = 2', 'state.combat.sector = 10'],
  ['state.combat.sector = 10', 'state.combat.sector = 12'],
])

// Frontier exceptions need their new gates, while ordinary Rebuild still clears hold.
patch('src/game/frontier.test.ts', [
  ['function protocolDock(sectorEver = 18)', 'function protocolDock(sectorEver = 52)'],
  ["s.combat.sector = 5\n    s.combat.highestSector = 4\n    s.meta.highestSectorEver = 4", "s.combat.sector = 13\n    s.combat.highestSector = 12\n    s.meta.highestSectorEver = 12"],
  ['s.meta.highestSectorEver = 22\n    s.combat.highestSector = 22', "s.meta.highestSectorEver = 62\n    s.combat.highestSector = 62\n    s.protocols.ranks['mute-network'] = 1"],
])

// Rebuild/playtest fixtures at the old gate were never actually rebuilding after PR76.
patch('src/game/playtest.test.tsx', [
  ["state.combat.sector = 10\n    state.meta.highestSectorEver = 10\n    state.combat.highestSector = 10", "state.combat.sector = 12\n    state.meta.highestSectorEver = 12\n    state.combat.highestSector = 12"],
])
patch('src/game/post-prestige.test.ts', [
  ["it('grants 6 PM on first sector-10 prestige'", "it('keeps the S10 Matter curve value below the first legal Rebuild'"],
  ['state.combat.sector = 10\n    state = performPrestige', 'state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state = performPrestige'],
])
patch('src/game/tick.test.ts', [
  ["state.combat.sector = 10\n    state.resources.scrap = 999", "state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state.resources.scrap = 999"],
  ["state.meta.act1Cleared = true\n    state.combat.sector = 10", "state.meta.act1Cleared = true\n    state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12"],
  ["state.combat.sector = 10\n    state = performPrestige(state, 1000)\n    // Returning runs start", "state.combat.sector = 12\n    state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state = performPrestige(state, 1000)\n    // Returning runs start"],
])

// At the S34 Research door, career-gated Relay/blue-slot access is expected even with zero Research completions.
patch('src/game/research-milestones.test.ts', [
  ["expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(false)", "expect(isNetworkBarUnlocked(s, 'strike-relay')).toBe(true)"],
  ["expect(isReliquarySlotUnlocked(s, 'blue')).toBe(false)", "expect(isReliquarySlotUnlocked(s, 'blue')).toBe(true)"],
])

// More attention can contain several already-open stations; isolate Reliquary in this test.
patch('src/game/hub-attention.test.ts', [
  ["state.meta.highestSectorEver = 16\n    state.combat.highestSector = 16", "state.meta.highestSectorEver = 16\n    state.combat.highestSector = 16\n    state.meta.seenContent['codex'] = contentKeys(state, 'codex')"],
])

// By S62 challenge content being available is correct; this test is about More auto-navigation.
patch('src/game/onboarding-visibility.test.ts', [
  ['expect(challengesContentUnlocked(state)).toBe(false)', 'expect(challengesContentUnlocked(state)).toBe(true)'],
])
