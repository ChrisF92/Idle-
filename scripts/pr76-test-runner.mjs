import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...options })
  return r
}

function mustReplace(text, oldText, newText, label) {
  if (!text.includes(oldText)) throw new Error(`Missing PR76 fix target: ${label}`)
  return text.replace(oldText, newText)
}

// Post-transform fix 1: Process recognises actual Hive Research progress, not only legacy research nodes.
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
  text = mustReplace(text, oldText, newText, 'Process research mastery')
  writeFileSync(path, text)
}

// Post-transform fix 2: preserve the intended +4-sector order for Foundry bonus drop bands.
{
  const path = 'src/game/catalog.ts'
  let text = readFileSync(path, 'utf8')
  const marker = 'function sectorBonusDropEntries'
  const start = text.indexOf(marker)
  const end = text.indexOf('\n}\n', start) + 3
  if (start < 0 || end < 3) throw new Error('Missing sectorBonusDropEntries')
  let block = text.slice(start, end)
  block = block.replace('if (sector >= 16) {', 'if (sector >= __PR76_FIRST__) {')
  block = block.replace('if (sector >= 12) {', 'if (sector >= 16) {')
  block = block.replace('if (sector >= __PR76_FIRST__) {', 'if (sector >= 12) {')
  text = text.slice(0, start) + block + text.slice(end)
  writeFileSync(path, text)
}

const test = run('npx', ['vitest', 'run'])
const output = `${test.stdout ?? ''}${test.stderr ?? ''}`
process.stdout.write(output)

if (test.status !== 0) {
  writeFileSync('pr76-test-output.txt', output)
  run('git', ['config', 'user.name', 'github-actions[bot]'])
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
  run('git', ['add', 'pr76-test-output.txt'])
  run('git', ['commit', '-m', 'chore: capture PR76 test failures'])
  run('git', ['push', 'origin', 'HEAD:chatgpt/pr76-system-cadence-growth'])
  process.exit(test.status || 1)
}

// Tests are green: make the temporary validation plumbing disappear from the PR diff.
run('git', ['config', 'user.name', 'github-actions[bot]'])
run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
run('git', ['checkout', 'origin/chatgpt/pr75-combat-curve-density-range', '--', 'package.json'])
run('git', ['rm', '-f', 'scripts/pr76-test-runner.mjs'])
run('git', ['rm', '-f', '.github/workflows/pr76-push-runner.yml'])
run('git', ['rm', '-f', '.pr76-trigger'])
run('git', ['rm', '-f', 'pr76-test-output.txt'])
run('git', ['add', 'package.json'])
run('git', ['commit', '-m', 'chore: remove temporary PR76 validation plumbing'])
run('git', ['push', 'origin', 'HEAD:chatgpt/pr76-system-cadence-growth'])
process.exit(0)
