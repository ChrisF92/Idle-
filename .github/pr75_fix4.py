from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected generated block not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/game/combat.ts',
    "export const ENEMY_CLOSE_DELAY_S = 6\nexport const ENEMY_CLOSE_RATE = 2.6\n\nexport function enemyApproachTarget(unit: Pick<CombatUnit, 'engageRange'>, fightElapsed: number): number {\n  const preferred = Math.max(0, unit.engageRange)\n  if (preferred <= SHORT_RANGE_MAX) return preferred\n  const closing = Math.max(0, fightElapsed - ENEMY_CLOSE_DELAY_S) * ENEMY_CLOSE_RATE\n  return Math.max(SHORT_RANGE_MAX, preferred - closing)\n}",
    "export const ENEMY_CLOSE_DELAY_S = 6\nexport const ENEMY_CLOSE_RATE = 2.6\n\n/** Shortest player weapon that can legally exist at this point in progression. */\nexport function minimumPlayerWeaponRangeForSector(sector: number): number {\n  // S1 only has the starter Pulse battery/module available. Flak (55) enters at S2.\n  return sector <= 1 ? 180 : SHORT_RANGE_MAX\n}\n\nexport function enemyApproachTarget(\n  unit: Pick<CombatUnit, 'engageRange'>,\n  fightElapsed: number,\n  sector = 2,\n): number {\n  const preferred = Math.max(0, unit.engageRange)\n  const minimumReach = minimumPlayerWeaponRangeForSector(sector)\n  if (preferred <= minimumReach) return preferred\n  const closing = Math.max(0, fightElapsed - ENEMY_CLOSE_DELAY_S) * ENEMY_CLOSE_RATE\n  return Math.max(minimumReach, preferred - closing)\n}",
)
replace_once(
    'src/game/combat.ts',
    "    const target = enemyApproachTarget(unit, elapsed)\n",
    "    const target = enemyApproachTarget(unit, elapsed, state.combat.sector)\n",
)

p = Path('src/game/pr75-combat.test.ts')
text = p.read_text()
text = text.replace(
    "  enemyForSector,\n  enemySectorScale,",
    "  enemyForSector,\n  enemySectorScale,\n  minimumPlayerWeaponRangeForSector,",
    1,
)
old = "          expect(enemyApproachTarget(enemy, 180), `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(SHORT_RANGE_MAX)"
new = "          const floor = minimumPlayerWeaponRangeForSector(sector)\n          expect(enemyApproachTarget(enemy, 180, sector), `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(floor)"
if old not in text:
    raise SystemExit('range expectation anchor missing')
text = text.replace(old, new, 1)
# Explicitly protect the S2+ Flak guarantee.
needle = "    expect(sawLongRange).toBe(true)\n  })"
replacement = "    expect(sawLongRange).toBe(true)\n    expect(minimumPlayerWeaponRangeForSector(1)).toBe(180)\n    expect(minimumPlayerWeaponRangeForSector(2)).toBe(SHORT_RANGE_MAX)\n  })"
if needle not in text:
    raise SystemExit('range test tail missing')
p.write_text(text.replace(needle, replacement, 1))

Path('.github/pr75_fix4.py').unlink(missing_ok=True)
