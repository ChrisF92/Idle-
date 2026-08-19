from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected generated block not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))


# The first density pass made early combat too heavy and made Route B family
# differences dominate its intended 1.28 danger multiplier. Keep the extra
# bodies, but budget their total pressure as a small fraction of the authored
# encounter instead of cloning source stats at ~60% strength.
old_density = r'''function targetFormationSize(sector: number, bossWave: boolean): number {
  const s = Math.max(1, Math.floor(sector))
  if (bossWave) return s < 6 ? 3 : s < 16 ? 4 : 5
  if (s <= 2) return 3
  if (s <= 8) return 4
  if (s <= 18) return 5
  return 6
}

function densifyEncounter(
  units: CombatUnit[],
  sector: number,
  bossWave: boolean,
): CombatUnit[] {
  const target = targetFormationSize(sector, bossWave)
  if (units.length >= target) return units
  const candidates = units
    .filter((u) => !u.isBoss)
    .sort((a, b) => (a.hullMax + a.shieldMax) - (b.hullMax + b.shieldMax))
  if (candidates.length === 0) return units
  const out = [...units]
  let wing = 0
  while (out.length < target) {
    const source = candidates[wing % candidates.length]!
    wing += 1
    const scale = bossWave ? 0.55 : 0.68
    const clone: CombatUnit = {
      ...source,
      id: nextUnitId(`e-${source.family}-wing`),
      name: `${source.name} Wing ${wing}`,
      hull: source.hullMax * scale,
      hullMax: source.hullMax * scale,
      shield: source.shieldMax * scale,
      shieldMax: source.shieldMax * scale,
      armor: source.armor * 0.75,
      weapons: source.weapons.map((weapon) => ({
        ...weapon,
        id: nextUnitId('ew-wing'),
        damage: weapon.damage * (bossWave ? 0.52 : 0.62),
        cooldownLeft: 0,
        telegraphLeft: 0,
        telegraphToId: undefined,
      })),
      dots: [],
      x: source.x + 8 + wing * 5,
      y: packY(out.length, target),
      phaseWarnLeft: 0,
      regenDelay: 0,
      rewardWeight: bossWave ? 0.3 : 0.4,
    }
    out.push(clone)
  }
  return out
}'''

new_density = r'''function targetFormationSize(sector: number, bossWave: boolean): number {
  const s = Math.max(1, Math.floor(sector))
  if (bossWave) return s < 6 ? 3 : s < 16 ? 4 : 5
  // Preserve the authored tutorial fight. Visual density ramps after S1.
  if (s === 1) return 2
  if (s <= 4) return 3
  if (s <= 8) return 4
  if (s <= 18) return 5
  return 6
}

function densityPressureBudget(sector: number, bossWave: boolean): number {
  if (bossWave) {
    if (sector <= 5) return 0.06
    if (sector <= 15) return 0.12
    return 0.18
  }
  if (sector <= 1) return 0
  if (sector <= 4) return 0.08
  if (sector <= 8) return 0.14
  if (sector <= 18) return 0.22
  return 0.28
}

function densifyEncounter(
  units: CombatUnit[],
  sector: number,
  bossWave: boolean,
): CombatUnit[] {
  const target = targetFormationSize(sector, bossWave)
  if (units.length >= target) return units
  const candidates = units
    .filter((u) => !u.isBoss)
    .sort((a, b) => (a.hullMax + a.shieldMax) - (b.hullMax + b.shieldMax))
  if (candidates.length === 0) return units

  const missing = target - units.length
  const authoredEhp = units.reduce((sum, u) => sum + u.hullMax + u.shieldMax, 0)
  const authoredDps = units.reduce(
    (sum, u) => sum + u.weapons.reduce((wSum, w) => wSum + w.damage / Math.max(0.05, w.cooldown), 0),
    0,
  )
  const budget = densityPressureBudget(sector, bossWave)
  const wingEhp = Math.max(1, (authoredEhp * budget) / Math.max(1, missing))
  const wingDps = Math.max(0.1, (authoredDps * budget * 0.85) / Math.max(1, missing))
  const rewardShare = Math.min(0.35, Math.max(0.12, (budget * units.length) / Math.max(1, missing)))

  const out = [...units]
  let wing = 0
  while (out.length < target) {
    const source = candidates[wing % candidates.length]!
    wing += 1
    const sourceEhp = Math.max(1, source.hullMax + source.shieldMax)
    const shieldShare = source.shieldMax / sourceEhp
    const shieldMax = wingEhp * shieldShare
    const hullMax = Math.max(1, wingEhp - shieldMax)
    const weaponCount = Math.max(1, source.weapons.length)
    const clone: CombatUnit = {
      ...source,
      id: nextUnitId(`e-${source.family}-wing`),
      name: `${source.name} Wing ${wing}`,
      hull: hullMax,
      hullMax,
      shield: shieldMax,
      shieldMax,
      armor: source.armor * 0.55,
      weapons: source.weapons.map((weapon) => ({
        ...weapon,
        id: nextUnitId('ew-wing'),
        damage: (wingDps * Math.max(0.05, weapon.cooldown)) / weaponCount,
        cooldownLeft: 0,
        telegraphLeft: 0,
        telegraphToId: undefined,
      })),
      dots: [],
      x: source.x + 8 + wing * 5,
      y: packY(out.length, target),
      phaseWarnLeft: 0,
      regenDelay: 0,
      rewardWeight: rewardShare,
    }
    out.push(clone)
  }
  return out
}'''
replace_once('src/game/combat.ts', old_density, new_density)

# Fragment acquisition was deliberately made generous in PR72. Extra visual
# bodies should not undo that cadence, so wing fragment rolls retain most of an
# authored enemy's chance even while Salvage/XP/discrete loot stay normalized.
replace_once(
    'src/game/combat.ts',
    "  rollEnemyPartDrop(state, unit, Math.random, rewardWeight)\n  // Wing enemies exist to make formations richer, not to multiply the economy.",
    "  const fragmentRewardWeight = rewardWeight >= 1 ? 1 : Math.max(0.8, rewardWeight)\n  rollEnemyPartDrop(state, unit, Math.random, fragmentRewardWeight)\n  // Wing enemies exist to make formations richer, not to multiply the economy.",
)

# Boss phase changes happen after enemyForSector(), so cap those preferred
# ranges too. Every enemy must eventually enter the 55-unit legal minimum.
replace_once('src/game/combat.ts', '    boss.engageRange = 80\n', '    boss.engageRange = Math.min(80, SHORT_RANGE_MAX)\n')
replace_once('src/game/combat.ts', '    boss.engageRange = 125\n', '    boss.engageRange = Math.min(125, SHORT_RANGE_MAX)\n')

# Update focused density test to keep S1 at its authored tutorial size.
replace_once(
    'src/game/pr75-combat.test.ts',
    "  if (sector <= 2) return 3\n  if (sector <= 8) return 4",
    "  if (sector === 1) return 2\n  if (sector <= 4) return 3\n  if (sector <= 8) return 4",
)

# Add a regression that proportional densification preserves Route B's intended
# danger relationship instead of magnifying family composition differences.
p = Path('src/game/pr75-combat.test.ts')
text = p.read_text()
needle = "  it('adds fractional-reward wing units instead of multiplying the kill economy', () => {"
route_test = r'''  it('keeps density pressure proportional across Route A and Route B', () => {
    const a = enemyForSector(9, 1, 'A')
    const b = enemyForSector(9, 1, 'B')
    const aHull = a.units.reduce((sum, u) => sum + u.hullMax, 0)
    const bHull = b.units.reduce((sum, u) => sum + u.hullMax, 0)
    expect(bHull / aHull).toBeGreaterThan(1.15)
    expect(bHull / aHull).toBeLessThan(1.45)
  })

'''
if needle not in text:
    raise SystemExit('PR75 test insertion anchor missing')
p.write_text(text.replace(needle, route_test + needle, 1))

# The primary patch removes its own temp files before this follow-up runs. Also
# remove this follow-up script so the final PR contains only production changes.
Path('.github/pr75_fix.py').unlink(missing_ok=True)
