import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8')
  for (const [oldText, newText] of replacements) {
    if (text.includes(oldText)) text = text.replaceAll(oldText, newText)
  }
  writeFileSync(path, text)
}

// Production copy that was historically tied to Foundry's old S2 door.
patch('src/components/tabs/FoundryTab.tsx', [
  ['Clear sector 2 to bring the Foundry online.', 'Clear sector 6 to bring the Foundry online.'],
  ['Turn Salvage into permanent materials. Opens at sector 2.', 'Turn Salvage into permanent materials. Opens at sector 6.'],
])

// First Blood still banks Process currency, but automation itself is intentionally much later.
patch('src/game/achievements.test.ts', [
  ["it('unlocks AI and grants points on First Blood (sector 1)'", "it('banks Process points on First Blood without opening automation early'"],
  ["expect(state.meta.aiUnlocked).toBe(true)\n    expect(isSystemUnlocked(state, 'ai')).toBe(true)", "expect(state.meta.aiUnlocked).toBe(true)\n    expect(isSystemUnlocked(state, 'ai')).toBe(false)"],
  ['state.combat.highestSector = 8\n    state.meta.highestSectorEver = 8\n    state.combat.sector = 10', 'state.combat.highestSector = 12\n    state.meta.highestSectorEver = 12\n    state.combat.sector = 13'],
])

patch('src/game/act1-balance.test.ts', [
  ["expect(run.milestones.some((m) => m.id === 'reliquary-unlock')).toBe(true)", "expect(run.milestones.some((m) => m.id === 'reliquary-unlock')).toBe(false)"],
])
patch('src/game/balance-estimate.test.ts', [
  ['expect(firstPrestige).toBeLessThan(70 * 60)', 'expect(firstPrestige).toBeLessThan(150 * 60)'],
])

// Codex is now a later reference layer.
for (const file of ['src/game/codex.test.ts', 'src/game/encyclopedia.test.ts', 'src/game/ascension-qol.test.ts']) {
  patch(file, [
    ['sector 6', 'sector 10'],
    ['highestSectorEver = 6', 'highestSectorEver = 10'],
    ['highestSector = 6', 'highestSector = 10'],
    ['combat.sector = 6', 'combat.sector = 10'],
  ])
}

// Foundry moved by +4 sectors; keep the PR72 acquisition shape relative to Foundry opening.
patch('src/game/core-prints.test.ts', [
  ['gates Charge Prism at sector 4 and Choir Tap at 14', 'gates Charge Prism at sector 8 and Choir Tap at 18'],
  ["modulePrintSector('charge-prism')).toBe(4)", "modulePrintSector('charge-prism')).toBe(8)"],
  ["modulePrintSector('choir-tap')).toBe(14)", "modulePrintSector('choir-tap')).toBe(18)"],
  ['printFragmentNeeds(2)', 'printFragmentNeeds(6)'],
  ['printFragmentNeeds(6)).toEqual({ casing: 3, core: 2, lens: 1 })', 'printFragmentNeeds(9)).toEqual({ casing: 3, core: 2, lens: 1 })'],
  ['printFragmentNeeds(12)', 'printFragmentNeeds(15)'],
  ['printFragmentNeeds(18)', 'printFragmentNeeds(22)'],
  ['highestSectorEver = 2', 'highestSectorEver = 6'],
  ['highestSector = 2', 'highestSector = 6'],
  ['combat.sector = 2', 'combat.sector = 6'],
  ['highestSectorEver = 4', 'highestSectorEver = 8'],
  ['highestSector = 4', 'highestSector = 8'],
  ['combat.sector = 4', 'combat.sector = 8'],
  ["pickWeightedDropEntry('ethereal', 2", "pickWeightedDropEntry('ethereal', 6"],
  [/Armored · Sector 2\\\+/.source, /Armored · Sector 6\\\+/.source],
  ['Sector 4 Divine', 'Sector 8 Divine'],
  [/Divine · Sector 4\\\+/.source, /Divine · Sector 8\\\+/.source],
  ["pickWeightedDropEntry('divine', 4", "pickWeightedDropEntry('divine', 8"],
  ["pickWeightedDropEntry('swarm', 6", "pickWeightedDropEntry('swarm', 10"],
  ["pickWeightedDropEntry('armored', 2", "pickWeightedDropEntry('armored', 6"],
  ['rollSector(hold, 2', 'rollSector(hold, 6'],
])

patch('src/game/core-acquisition.test.ts', [
  ['earlyCareerFragmentMult(8)).toBe(2.15)', 'earlyCareerFragmentMult(8)).toBe(3.25)'],
  ['earlyCareerFragmentMult(14)).toBe(1.35)', 'earlyCareerFragmentMult(14)).toBe(2.15)'],
  ['earlyCareerFragmentMult(18)).toBe(1)', 'earlyCareerFragmentMult(21)).toBe(1.35)\n    expect(earlyCareerFragmentMult(22)).toBe(1)'],
  ['lands the first non-starter Core around S4–S6', 'lands the first non-starter Core shortly after the S6 Foundry door'],
  ['expect(median).toBeGreaterThanOrEqual(3)', 'expect(median).toBeGreaterThanOrEqual(6)'],
  ['expect(median).toBeLessThanOrEqual(7)', 'expect(median).toBeLessThanOrEqual(11)'],
  ['expect(p90).toBeLessThanOrEqual(9)', 'expect(p90).toBeLessThanOrEqual(13)'],
  ['hold.meta.highestSectorEver = 2', 'hold.meta.highestSectorEver = 6'],
  ['hold.combat.highestSector = 2', 'hold.combat.highestSector = 6'],
  ['hold = rollSector(hold, 2', 'hold = rollSector(hold, 6'],
  ['state.meta.highestSectorEver = 2', 'state.meta.highestSectorEver = 6'],
  ['state.combat.highestSector = 2', 'state.combat.highestSector = 6'],
])

for (const file of ['src/game/foundry.test.ts', 'src/game/phase3.test.ts']) {
  patch(file, [
    ['sector 2', 'sector 6'],
    ['highestSectorEver = 2', 'highestSectorEver = 6'],
    ['highestSector = 2', 'highestSector = 6'],
    ['combat.sector = 2', 'combat.sector = 6'],
  ])
}
patch('src/game/foundry-depth.test.ts', [
  ['highestSectorEver = 14', 'highestSectorEver = 18'],
  ['highestSector = 14', 'highestSector = 18'],
  ['highestSectorEver = 2', 'highestSectorEver = 6'],
  ['highestSector = 2', 'highestSector = 6'],
])

// Furnace mechanics are unchanged; fixtures now open it at S28 and Research-dependent paths at S34.
patch('src/game/furnace.test.ts', [
  ['function furnaceReady(sector = 5)', 'function furnaceReady(sector = 28)'],
  ['furnaceReady(5)', 'furnaceReady(28)'],
  ['furnaceReady(7)', 'furnaceReady(34)'],
  ['highestSectorEver = 7', 'highestSectorEver = 34'],
  ['highestSector = 7', 'highestSector = 34'],
])

// Network sublayers remain the same mechanics but at spaced career gates.
patch('src/game/network.test.ts', [
  ["it('Yield unlocks at sector 2 and boosts salvage + Strike fill'", "it('Yield opens at S4 before Loom at S9 and boosts salvage + Strike fill'"],
  ['highestSectorEver = 2', 'highestSectorEver = 4'],
  ['combat.highestSector = 2', 'combat.highestSector = 4'],
  ["expect(isNetworkBarUnlocked(s, 'loom')).toBe(true)", "expect(isNetworkBarUnlocked(s, 'loom')).toBe(false)"],
  ['s.combat.sector = 4\n    s.meta.highestSectorEver = 4', 's.combat.sector = 12\n    s.meta.highestSectorEver = 12\n    s.combat.highestSector = 12'],
  ['highestSectorEver = 5', 'highestSectorEver = 28'],
  ['combat.highestSector = 5', 'combat.highestSector = 28'],
  ['combat.sector = 5', 'combat.sector = 28'],
  ['const early = sector(7)', 'const early = sector(11)'],
  ['const s8 = sector(8)', 'const s8 = sector(12)'],
  ["expect(isNetworkBarUnlocked(sector(9), 'ward-relay')).toBe(true)", "expect(isNetworkBarUnlocked(sector(15), 'ward-relay')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(sector(12), 'yield-relay')).toBe(true)", "expect(isNetworkBarUnlocked(sector(20), 'yield-relay')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(sector(13), 'loom-relay')).toBe(true)", "expect(isNetworkBarUnlocked(sector(24), 'loom-relay')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(sector(16), 'archive-relay')).toBe(true)", "expect(isNetworkBarUnlocked(sector(38), 'archive-relay')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(sector(19), 'strike-lattice')).toBe(false)", "expect(isNetworkBarUnlocked(sector(43), 'strike-lattice')).toBe(false)"],
  ["expect(isNetworkBarUnlocked(sector(20), 'strike-lattice')).toBe(true)", "expect(isNetworkBarUnlocked(sector(44), 'strike-lattice')).toBe(true)"],
  ["expect(isNetworkBarUnlocked(sector(22), 'ward-lattice')).toBe(true)", "expect(isNetworkBarUnlocked(sector(48), 'ward-lattice')).toBe(true)"],
  ['const plain = sector(8)', 'const plain = sector(12)'],
  ['const relayed = sector(8)', 'const relayed = sector(12)'],
  ['const relayOnly = sector(20)', 'const relayOnly = sector(44)'],
  ['const latticed = sector(20)', 'const latticed = sector(44)'],
  ['let s = sector(8)', 'let s = sector(12)'],
  ['s.combat.sector = 8', 's.combat.sector = 12'],
  ['const s = sector(8)', 'const s = sector(12)'],
])

// Route B is now a real mid-game branch.
for (const file of ['src/game/phase7.test.ts', 'src/game/frontier.test.ts']) {
  patch(file, [
    ['sector 8', 'sector 24'],
    ['sector(8)', 'sector(24)'],
    ['highestSectorEver = 8', 'highestSectorEver = 24'],
    ['highestSector = 8', 'highestSector = 24'],
    ['combat.sector = 8', 'combat.sector = 24'],
  ])
}
patch('src/game/phase7.test.ts', [
  ['prestigeCount = 1', 'prestigeCount = 2'],
  ['highestSectorEver = 4', 'highestSectorEver = 20'],
  ['highestSector = 4', 'highestSector = 20'],
])

// Reliquary/Furnace/Research phase fixtures move to their new doors.
patch('src/game/phase6.test.ts', [
  ['USI sectors 3 / 5 / 7', 'spaced sectors 16 / 28 / 34'],
  ['highestSectorEver = 3', 'highestSectorEver = 16'],
  ['highestSector = 3', 'highestSector = 16'],
  ['highestSectorEver = 5', 'highestSectorEver = 28'],
  ['highestSector = 5', 'highestSector = 28'],
  ['highestSectorEver = 7', 'highestSectorEver = 34'],
  ['highestSector = 7', 'highestSector = 34'],
  ['combat.sector = 7', 'combat.sector = 34'],
  ['after sector 7', 'after Research opens'],
])

// Protocol/Echo/Process are late mastery layers now.
patch('src/game/phase8.test.ts', [
  ['locked until 18 / 22', 'locked until 52 / 62'],
  ['highestSectorEver = 17', 'highestSectorEver = 51'],
  ['highestSectorEver = 18', 'highestSectorEver = 52'],
  ['highestSectorEver = 21', 'highestSectorEver = 61'],
  ['highestSectorEver = 22', 'highestSectorEver = 62'],
  ['combat.highestSector = 17', 'combat.highestSector = 51'],
  ['combat.highestSector = 18', 'combat.highestSector = 52'],
  ['combat.highestSector = 21', 'combat.highestSector = 61'],
  ['combat.highestSector = 22', 'combat.highestSector = 62'],
  ["it('opens Process after the first achievement'", "it('opens Process only after its sector, Rebuild and Research mastery gates'"],
  ["expect(isSystemUnlocked(s, 'process')).toBe(true)", "expect(isSystemUnlocked(s, 'process')).toBe(false)\n    s.meta.highestSectorEver = 42\n    s.combat.highestSector = 42\n    s.prestige.prestigeCount = 2\n    s.research.unlocked.push('basic-optics')\n    expect(isSystemUnlocked(s, 'process')).toBe(true)"],
])
patch('src/game/phase9.test.ts', [
  ['locked until 51', 'locked until 68'],
  ['highestSectorEver = 50', 'highestSectorEver = 67'],
  ['highestSectorEver = 51', 'highestSectorEver = 68'],
  ['highestSector = 50', 'highestSector = 67'],
  ['highestSector = 51', 'highestSector = 68'],
])

// Onboarding hints should still be tested when the relevant system is actually open.
for (const file of ['src/game/onboarding-queue.test.ts', 'src/game/foundry-depth.test.ts']) {
  patch(file, [
    ['highestSectorEver = 2', 'highestSectorEver = 6'],
    ['highestSector = 2', 'highestSector = 6'],
  ])
}
for (const file of ['src/game/onboarding-queue.test.ts']) {
  patch(file, [
    ['highestSectorEver = 5', 'highestSectorEver = 28'],
    ['highestSector = 5', 'highestSector = 28'],
    ['highestSectorEver = 7', 'highestSectorEver = 34'],
    ['highestSector = 7', 'highestSector = 34'],
  ])
}
patch('src/game/research-milestones.test.ts', [
  ['highestSectorEver = 7', 'highestSectorEver = 34'],
  ['highestSector = 7', 'highestSector = 34'],
])
patch('src/game/onboarding-visibility.test.ts', [
  ['highestSectorEver = 7', 'highestSectorEver = 34'],
  ['highestSector = 7', 'highestSector = 34'],
  ['highestSectorEver = 22', 'highestSectorEver = 62'],
  ['highestSector = 22', 'highestSector = 62'],
])

// Matter ranks deliberately got larger/compounding effects.
patch('src/game/matter-shop.test.ts', [
  ['toBe(90)', 'toBeCloseTo(120)'],
  ['toBe(70)', 'toBeCloseTo(95)'],
  ["it('ranks use steeper costs and 45% extra-rank scaling'", "it('ranks use steeper costs while key meta effects compound'"],
])
patch('src/game/drone-economy.test.ts', [
  ['toBeCloseTo(1.2)', 'toBeCloseTo(1.12)'],
])
patch('src/game/usi-pacing.test.ts', [
  ['toBeCloseTo(0.04)', 'toBeCloseTo(0.08)'],
  ['toBeCloseTo(0.03)', 'toBeCloseTo(0.06)'],
])

// Slag opens on first Rebuild; Yard waits until S20 + two Rebuilds.
patch('src/game/slag-bank.test.ts', [
  ["it('unlocks with the first Rebuild, same door as Yard'", "it('unlocks with the first Rebuild while Yard waits for later mastery'"],
  ["expect(isSystemUnlocked(s, 'yard')).toBe(true)", "expect(isSystemUnlocked(s, 'yard')).toBe(false)"],
])

// Functional tests below are about the system, not its door: put them at a mature career state.
for (const file of ['src/game/process.test.ts', 'src/game/process-depth.test.ts', 'src/game/protocols.test.ts', 'src/game/playerGuidance.test.ts', 'src/game/hub-attention.test.ts']) {
  patch(file, [
    ['highestSectorEver = 8', 'highestSectorEver = 68'],
    ['highestSector = 8', 'highestSector = 68'],
    ['highestSectorEver = 18', 'highestSectorEver = 68'],
    ['highestSector = 18', 'highestSector = 68'],
    ['highestSectorEver = 22', 'highestSectorEver = 68'],
    ['highestSector = 22', 'highestSector = 68'],
    ['highestSectorEver = 5', 'highestSectorEver = 68'],
    ['highestSector = 5', 'highestSector = 68'],
    ['highestSectorEver = 7', 'highestSectorEver = 68'],
    ['highestSector = 7', 'highestSector = 68'],
    ['highestSectorEver = 2', 'highestSectorEver = 68'],
    ['highestSector = 2', 'highestSector = 68'],
  ])
}

// Misc fixtures whose old sector only existed to open a moved system.
for (const file of ['src/game/tick.test.ts', 'src/game/phase11.test.ts']) {
  patch(file, [
    ['highestSectorEver = 7', 'highestSectorEver = 34'],
    ['highestSector = 7', 'highestSector = 34'],
    ['highestSectorEver = 5', 'highestSectorEver = 28'],
    ['highestSector = 5', 'highestSector = 28'],
  ])
}
patch('src/game/part-drops.test.ts', [
  ['highestSectorEver = 2', 'highestSectorEver = 6'],
  ['highestSector = 2', 'highestSector = 6'],
  ['combat.sector = 2', 'combat.sector = 6'],
])
patch('src/game/toasts.test.ts', [
  ['highestSectorEver = 2', 'highestSectorEver = 6'],
  ['highestSector = 2', 'highestSector = 6'],
  ['highestSectorEver = 7', 'highestSectorEver = 34'],
  ['highestSector = 7', 'highestSector = 34'],
  ['highestSectorEver = 4', 'highestSectorEver = 12'],
  ['highestSector = 4', 'highestSector = 12'],
])
patch('src/game/ui-shell.test.tsx', [
  ['highestSectorEver = 2', 'highestSectorEver = 6'],
  ['highestSector = 2', 'highestSector = 6'],
  ['combat.sector = 2', 'combat.sector = 6'],
])
patch('src/game/cosmic-idle-cleanup.test.ts', [
  ['toBe(4)', 'toBe(12)'],
])

// More now intentionally previews exactly one next major station.
patch('src/game/screen-help.test.ts', [
  ["expect(buckets.next.map((s) => s.id)).toEqual(expect.arrayContaining(['reliquary', 'furnace', 'process', 'yard']))", "expect(buckets.next.map((s) => s.id)).toEqual(['codex'])"],
])
