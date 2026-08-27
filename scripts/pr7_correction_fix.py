from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def p(name: str) -> Path:
    return ROOT / name


def read(name: str) -> str:
    return p(name).read_text()


def write(name: str, text: str) -> None:
    p(name).write_text(text)


def exact(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"{label}: expected 1 match, got {n}")
    return text.replace(old, new, 1)


def sub(text: str, pattern: str, repl: str, label: str) -> str:
    out, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError(f"{label}: expected 1 match, got {n}")
    return out


# Allow structural threat fitting to scale deeply solved/high-Wave neutral baselines down far enough.
threat = read('src/game/threatBudget.ts')
threat = exact(
    threat,
    "const mult = scalable > 1e-9 ? Math.max(0.01, (target - armorThreat) / scalable) : 1",
    "const mult = scalable > 1e-9 ? Math.max(1e-6, (target - armorThreat) / scalable) : 1",
    'deep threat fit',
)
write('src/game/threatBudget.ts', threat)

# Remove the remaining balance re-export layer for the deleted sector-era enemy constants.
curves = read('src/game/balance/curves.ts')
curves = sub(
    curves,
    r"export \{\n  ENEMY_HULL_BASE,.*?  SALVAGE_MID_EXPONENT,\n\} from '../combat'",
    "export { salvageWaveBase, salvageFromKill } from '../combat'",
    'balance curves retired enemy exports',
)
curves = curves.replace(
    '- Enemy hull / damage vs Wave (band scale still lives in combat.ts)\n',
    '- Enemy hull / damage vs Wave (canonical PR7 scaling lives in hostileSeeds.ts)\n',
)
write('src/game/balance/curves.ts', curves)

# Retired tests must not keep compatibility exports alive.
balance_test = read('src/game/act1-balance.test.ts')
balance_test = exact(
    balance_test,
    "import {\n  ENEMY_DMG_EARLY,\n  ENEMY_HULL_EARLY,\n  salvageFromKill,\n  salvageWaveBase,\n} from './combat'",
    "import { salvageFromKill, salvageWaveBase } from './combat'",
    'act1 balance imports',
)
balance_test = balance_test.replace("    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)\n", '')
balance_test = balance_test.replace("    expect(ENEMY_DMG_EARLY).toBeGreaterThan(1)\n", '')
write('src/game/act1-balance.test.ts', balance_test)

sim_test = read('src/game/gdd-sim-playtest.test.ts')
sim_test = exact(
    sim_test,
    "import { CURVE_LAYERS, ENEMY_HULL_EARLY, WORKSHOP_WEAPON_POWER_PER_LEVEL } from './balance/curves'",
    "import { CURVE_LAYERS, WORKSHOP_WEAPON_POWER_PER_LEVEL } from './balance/curves'",
    'sim playtest import',
)
sim_test = sim_test.replace("    expect(ENEMY_HULL_EARLY).toBeGreaterThan(1)\n", '')
write('src/game/gdd-sim-playtest.test.ts', sim_test)

wave_copy = read('src/game/gdd-wave-copy.test.ts')
wave_copy = wave_copy.replace("import { roleIntel } from './combat'\n", '')
wave_copy = wave_copy.replace("      roleIntel('skirmisher'),\n", '')
write('src/game/gdd-wave-copy.test.ts', wave_copy)

# PR10 owns Challenge density. Rewrite the retired legacy assertion instead of preserving the hook.
challenge_test = read('src/game/gdd-challenges.test.ts')
challenge_test = sub(
    challenge_test,
    r"  it\('increases encounter density on Swarm Pressure'.*?\n  \}\)\n",
    "  it('does not wire legacy Challenge density into the PR7 encounter generator', () => {\n"
    "    const normal = encounterForWave(20, 1)\n"
    "    const s = createInitialState(0)\n"
    "    s.protocols.activeId = 'mute-network'\n"
    "    const unchanged = encounterForWave(20, 1, s)\n"
    "    expect(unchanged.units.length).toBe(normal.units.length)\n"
    "    expect(unchanged.threat?.spent).toBeCloseTo(normal.threat?.spent ?? 0, 6)\n"
    "  })\n",
    'challenge density boundary test',
)
write('src/game/gdd-challenges.test.ts', challenge_test)

# PR11 owns the finale presentation flag.
boss_rewards = read('src/game/boss-rewards.test.ts')
boss_rewards = exact(
    boss_rewards,
    "    expect(s.meta.act1FinalePending).toBe(true)",
    "    expect(s.meta.act1FinalePending).toBe(false)",
    'boss rewards finale boundary',
)
write('src/game/boss-rewards.test.ts', boss_rewards)

# Focused source-import assertion is covered by the actual module graph/diff and legacy-state identity tests;
# avoid Vite's transformed import.meta URL in Vitest.
focus = read('src/game/pr7-corrections.test.ts')
focus = focus.replace("import { readFileSync } from 'node:fs'\n", '')
focus = focus.replace("  formationDispersionWeight,\n", '')
focus = focus.replace("  buildCommanderPackage,\n", '')
focus = sub(
    focus,
    r"    const source = readFileSync\(new URL\('./encounterGenerator\.ts', import\.meta\.url\), 'utf8'\)\n    expect\(source\)\.not\.toContain\('directiveDensityMult'\)\n    expect\(source\)\.not\.toContain\('protocolEnemyDensityMult'\)\n    expect\(source\)\.not\.toContain\(\"from './directives'\"\)\n    expect\(source\)\.not\.toContain\(\"from './protocols'\"\)\n",
    '',
    'focused static import check',
)
write('src/game/pr7-corrections.test.ts', focus)

print('PR7 correction verification refinements applied')
