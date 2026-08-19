import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...options })
}

function replaceIfPresent(text, oldText, newText) {
  return text.includes(oldText) ? text.replace(oldText, newText) : text
}

if (!existsSync('src/game/cadence.ts')) {
  const extractScript = `from pathlib import Path\nsrc = Path('.github/workflows/pr76-apply.yml').read_text().splitlines()\nstart = next(i for i, line in enumerate(src) if \"python <<'PY'\" in line) + 1\nend = next(i for i in range(start, len(src)) if src[i].strip() == 'PY')\nbody = src[start:end]\nbody = [line[10:] if line.startswith('          ') else line for line in body]\nPath('/tmp/pr76_apply.py').write_text('\\n'.join(body) + '\\n')\n`
  const extract = run('python', ['-c', extractScript])
  if (extract.status !== 0) {
    process.stderr.write(`${extract.stdout ?? ''}${extract.stderr ?? ''}`)
    process.exit(extract.status || 1)
  }
  const apply = run('python', ['/tmp/pr76_apply.py'])
  if (apply.status !== 0) {
    process.stderr.write(`${apply.stdout ?? ''}${apply.stderr ?? ''}`)
    process.exit(apply.status || 1)
  }
}

{
  const path = 'src/game/progression.ts'
  let text = readFileSync(path, 'utf8')
  const oldText = `    const used = (state.process?.purchased?.length ?? 0) > 0 || state.ai.purchased.length > 0
    return used || (
      careerHighestSector(state) >= ACT1_CADENCE.process &&
      (state.prestige.prestigeCount ?? 0) >= PROCESS_MIN_REBUILDS &&
      state.research.unlocked.length >= PROCESS_MIN_RESEARCH
    )
`
  const newText = `    const used = (state.process?.purchased?.length ?? 0) > 0 || state.ai.purchased.length > 0
    const researchProgress =
      state.research.unlocked.length +
      Object.values(state.hiveResearch?.completed ?? {}).filter((n) => n > 0).length
    return used || (
      careerHighestSector(state) >= ACT1_CADENCE.process &&
      (state.prestige.prestigeCount ?? 0) >= PROCESS_MIN_REBUILDS &&
      researchProgress >= PROCESS_MIN_RESEARCH
    )
`
  text = replaceIfPresent(text, oldText, newText)
  writeFileSync(path, text)
}

{
  const path = 'src/game/catalog.ts'
  let text = readFileSync(path, 'utf8')
  const marker = 'function sectorBonusDropEntries'
  const start = text.indexOf(marker)
  const end = text.indexOf('\n}\n', start) + 3
  if (start < 0 || end < 3) throw new Error('Missing sectorBonusDropEntries')
  let block = text.slice(start, end)
  const i16 = block.indexOf('if (sector >= 16) {')
  const i12 = block.indexOf('if (sector >= 12) {')
  if (i16 >= 0 && i12 > i16) {
    block = block.replace('if (sector >= 16) {', 'if (sector >= __PR76_FIRST__) {')
    block = block.replace('if (sector >= 12) {', 'if (sector >= 16) {')
    block = block.replace('if (sector >= __PR76_FIRST__) {', 'if (sector >= 12) {')
    text = text.slice(0, start) + block + text.slice(end)
  }
  writeFileSync(path, text)
}

{
  const path = 'src/game/catalog.ts'
  let text = readFileSync(path, 'utf8')
  const old = `/**\n * Rebuild hangar gate (sector 4). Duplicated here so catalog does not capture\n * \`progression.PRESTIGE_MIN_SECTOR\` during the progression → playtest → frontier\n * → sortieTelemetry → catalog cycle (that binding is still undefined at init).\n */\nexport const PRESTIGE_MIN_SECTOR = 4`
  const next = `/** Rebuild hangar gate. cadence.ts is dependency-free, so this stays cycle-safe. */\nexport const PRESTIGE_MIN_SECTOR = ACT1_CADENCE.rebuild`
  text = replaceIfPresent(text, old, next)
  writeFileSync(path, text)
}

for (const spec of [
  ['src/game/protocols.ts', `import { noteAttempt } from './playtest'`, `import { noteAttempt } from './playtest'\nimport { ACT1_CADENCE } from './cadence'`, 'export const PROTOCOL_UNLOCK_SECTOR = 18', 'export const PROTOCOL_UNLOCK_SECTOR = ACT1_CADENCE.protocols'],
  ['src/game/echo.ts', `import { noteAttempt } from './playtest'`, `import { noteAttempt } from './playtest'\nimport { ACT1_CADENCE } from './cadence'`, 'export const ECHO_UNLOCK_SECTOR = 22', 'export const ECHO_UNLOCK_SECTOR = ACT1_CADENCE.echo'],
  ['src/game/specialists.ts', `import { recordPlaytest, noteSystemAction } from './playtest'`, `import { recordPlaytest, noteSystemAction } from './playtest'\nimport { ACT1_CADENCE } from './cadence'`, 'export const SPECIALIST_UNLOCK_SECTOR = 51', 'export const SPECIALIST_UNLOCK_SECTOR = ACT1_CADENCE.specialists'],
]) {
  const [path, oldImport, newImport, oldConstant, newConstant] = spec
  let text = readFileSync(path, 'utf8')
  if (!text.includes(`import { ACT1_CADENCE } from './cadence'`)) text = replaceIfPresent(text, oldImport, newImport)
  text = replaceIfPresent(text, oldConstant, newConstant)
  writeFileSync(path, text)
}

{
  const path = 'src/game/balance/act1.ts'
  let text = readFileSync(path, 'utf8')
  if (!text.includes(`import { ACT1_CADENCE } from '../cadence'`)) {
    text = text.replace(`import type { GameState } from '../types'`, `import type { GameState } from '../types'\nimport { ACT1_CADENCE } from '../cadence'`)
  }
  text = text.replace(
`export const ACT1_UNLOCKS = {
  foundry: 2,
  reliquary: 3,
  rebuildAvailable: PRESTIGE_MIN_SECTOR,
  furnace: 5,
  codex: 6,
  research: 7,
  process: 1,
  protocols: PROTOCOL_UNLOCK_SECTOR,
  echo: ECHO_UNLOCK_SECTOR,
  act1: ACT1_SECTOR,
} as const`,
`export const ACT1_UNLOCKS = {
  foundry: ACT1_CADENCE.foundry,
  reliquary: ACT1_CADENCE.reliquary,
  rebuildAvailable: PRESTIGE_MIN_SECTOR,
  furnace: ACT1_CADENCE.furnace,
  codex: ACT1_CADENCE.codex,
  research: ACT1_CADENCE.research,
  process: ACT1_CADENCE.process,
  protocols: PROTOCOL_UNLOCK_SECTOR,
  echo: ECHO_UNLOCK_SECTOR,
  act1: ACT1_SECTOR,
} as const`)
  text = text.replace(
`    id: 'first-rebuild',
    label: 'First Rebuild',
    min: 8 * 60,
    max: 50 * 60,
    warningPad: 10 * 60,`,
`    id: 'first-rebuild',
    label: 'First Rebuild',
    min: 30 * 60,
    max: 5 * 60 * 60,
    warningPad: 30 * 60,`)
  text = text.replace(
`    id: 'reliquary-unlock',
    label: 'Reliquary unlock',
    min: 90,
    max: 14 * 60,
    warningPad: 2 * 60,`,
`    id: 'reliquary-unlock',
    label: 'Reliquary unlock',
    min: 60 * 60,
    max: 8 * 60 * 60,
    warningPad: 60 * 60,`)
  text = text.replace(
`    id: 'furnace-unlock',
    label: 'Furnace unlock',
    min: 4 * 60,
    max: 22 * 60,
    warningPad: 4 * 60,`,
`    id: 'furnace-unlock',
    label: 'Furnace unlock',
    min: 3 * 60 * 60,
    max: 18 * 60 * 60,
    warningPad: 2 * 60 * 60,`)
  text = text.replace(
`    id: 'hive-research-unlock',
    label: 'Research unlock',
    min: 8 * 60,
    max: 40 * 60,
    warningPad: 6 * 60,`,
`    id: 'hive-research-unlock',
    label: 'Research unlock',
    min: 5 * 60 * 60,
    max: 24 * 60 * 60,
    warningPad: 3 * 60 * 60,`)
  text = text.replace(
`    id: 'first-research-bt',
    label: 'First Research breakthrough',
    min: 16 * 60,
    max: 90 * 60,
    warningPad: 15 * 60,`,
`    id: 'first-research-bt',
    label: 'First Research breakthrough',
    min: 6 * 60 * 60,
    max: 30 * 60 * 60,
    warningPad: 4 * 60 * 60,`)
  text = text.replace(
`    id: 'protocols-unlock',
    label: 'Protocols',
    min: 50 * 60,
    max: 6 * 60 * 60,
    warningPad: 40 * 60,`,
`    id: 'protocols-unlock',
    label: 'Protocols',
    min: 10 * 60 * 60,
    max: 3 * 24 * 60 * 60,
    warningPad: 6 * 60 * 60,`)
  text = text.replace(
`    id: 'echo-unlock',
    label: 'Echo',
    min: 80 * 60,
    max: 10 * 60 * 60,
    warningPad: 90 * 60,`,
`    id: 'echo-unlock',
    label: 'Echo',
    min: 16 * 60 * 60,
    max: 5 * 24 * 60 * 60,
    warningPad: 10 * 60 * 60,`)
  writeFileSync(path, text)
}

await import('./pr76-test-migrate.mjs')
await import('./pr76-test-migrate-2.mjs')
await import('./pr76-test-migrate-3.mjs')
await import('./pr76-final-fixes.mjs')

const test = run('npx', ['vitest', 'run'])
process.stdout.write(`${test.stdout ?? ''}${test.stderr ?? ''}`)
process.exit(test.status ?? 1)
