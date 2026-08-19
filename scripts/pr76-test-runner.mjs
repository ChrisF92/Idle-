import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...options })
}

function replaceIfPresent(text, oldText, newText) {
  return text.includes(oldText) ? text.replace(oldText, newText) : text
}

// The PR branch temporarily stores the implementation as a deterministic transform so
// both the normal PR preview and the branch validator can exercise exactly the same code.
// Apply it here only when another workflow has not already done so.
if (!existsSync('src/game/cadence.ts')) {
  const py = `from pathlib import Path\nsrc = Path('.github/workflows/pr76-apply.yml').read_text().splitlines()\nstart = next(i for i, line in enumerate(src) if \"python <<'PY'\" in line) + 1\nend = next(i for i in range(start, len(src)) if src[i].strip() == 'PY')\nbody = src[start:end]\nbody = [line[10:] if line.startswith('          ') else line for line in body]\nPath('/tmp/pr76_apply.py').write_text('\\n'.join(body) + '\\n')\n`
  const extract = run('python', ['-c', py])
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

// Process recognises actual Hive Research progress, not only legacy research nodes.
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

// Preserve the intended +4-sector order for Foundry bonus drop bands. Only perform
// the swap while the temporary marker is not already reflected in the final 12/16 order.
{
  const path = 'src/game/catalog.ts'
  let text = readFileSync(path, 'utf8')
  const marker = 'function sectorBonusDropEntries'
  const start = text.indexOf(marker)
  const end = text.indexOf('\n}\n', start) + 3
  if (start < 0 || end < 3) throw new Error('Missing sectorBonusDropEntries')
  let block = text.slice(start, end)
  // The base transform accidentally reverses these two thresholds. Its first two
  // bonus checks are 16 then 12; final cadence is 12 then 16.
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

// Every public unlock constant uses the same dependency-free cadence source.
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
  if (!text.includes(`import { ACT1_CADENCE } from './cadence'`)) {
    text = replaceIfPresent(text, oldImport, newImport)
  }
  text = replaceIfPresent(text, oldConstant, newConstant)
  writeFileSync(path, text)
}

await import('./pr76-test-migrate.mjs')

const test = run('npx', ['vitest', 'run'])
process.stdout.write(`${test.stdout ?? ''}${test.stderr ?? ''}`)
process.exit(test.status ?? 1)
