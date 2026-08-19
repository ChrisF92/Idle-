import { readFileSync, writeFileSync } from 'node:fs'

function replace(path, oldText, newText) {
  let text = readFileSync(path, 'utf8')
  if (text.includes(oldText)) text = text.replaceAll(oldText, newText)
  writeFileSync(path, text)
}

// The prior migration intentionally raises ordinary challenge-shop prestige fixtures to S12,
// but Early Gate itself must still demonstrate the reduced S10 requirement.
replace(
  'src/game/challenge-shop.test.ts',
  `expect(prestigeMinSectorFor(state.prestige.shop)).toBe(10)\n    state.combat.sector = 12\n    expect(canPrestige(state)).toBe(true)`,
  `expect(prestigeMinSectorFor(state.prestige.shop)).toBe(10)\n    state.combat.sector = 10\n    expect(canPrestige(state)).toBe(true)`,
)

// At S16 Codex is already open; mark it seen so this test isolates Reliquary attention.
replace(
  'src/game/hub-attention.test.ts',
  `state.meta.seenContent['codex'] = contentKeys(state, 'codex')`,
  `state = markHubSeen(state, 'codex')`,
)
