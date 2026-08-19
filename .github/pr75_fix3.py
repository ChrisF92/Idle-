from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected generated block not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


# Do not hard-clamp preferred range. Ranged enemies may establish their standoff
# first, but that preferred distance compresses as the fight continues until
# even the shortest legal weapon (55) can engage.
replace_once(
    'src/game/combat.ts',
    "    // Every enemy must eventually enter range of the shortest legal player weapon.\n    // Roles keep their identity through approach speed, telegraphs, shields, armour,\n    // preferred *closer* ranges and kiting; none can permanently invalidate a loadout.\n    unit.engageRange = Math.min(unit.engageRange, SHORT_RANGE_MAX)\n    for (const weapon of unit.weapons) {",
    "    // Preferred standoff remains role-specific. moveUnits() progressively compresses\n    // long-range positions until every enemy eventually enters SHORT_RANGE_MAX.\n    for (const weapon of unit.weapons) {",
)

# Undo the hard boss phase caps added by the previous corrective pass; dynamic
# approach targets handle phase ranges too.
replace_once('src/game/combat.ts', '    boss.engageRange = Math.min(80, SHORT_RANGE_MAX)\n', '    boss.engageRange = 80\n')
replace_once('src/game/combat.ts', '    boss.engageRange = Math.min(125, SHORT_RANGE_MAX)\n', '    boss.engageRange = 125\n')

old_move = r'''function moveUnits(state: GameState, dt: number): void {
  // Player flagship stays at x=0, y=0. Escorts hold relative slots.
  for (const unit of state.combat.playerUnits) {
    if (!unit.isFlagship) continue
    unit.x = 0
    unit.y = 0
  }

  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const target = unit.engageRange
    if (unit.x > target + 2) {
      unit.x = Math.max(target, unit.x - unit.speed * dt)
    } else if (unit.kite && unit.x < target - 6) {
      unit.x = Math.min(target, unit.x + unit.speed * dt * 0.85)
    }
    // Slight vertical drift so packs don't stack perfectly
    unit.y += Math.sin(unit.x * 0.04 + unit.y) * 0.15
    unit.y = Math.max(-80, Math.min(80, unit.y))
  }
}'''

new_move = r'''/**
 * Long-range roles establish their preferred standoff first, then pressure
 * gradually collapses that distance. This preserves sniper/boss identity while
 * guaranteeing that no legal short-range loadout is permanently soft-locked.
 */
export const ENEMY_CLOSE_DELAY_S = 6
export const ENEMY_CLOSE_RATE = 2.6

export function enemyApproachTarget(unit: Pick<CombatUnit, 'engageRange'>, fightElapsed: number): number {
  const preferred = Math.max(0, unit.engageRange)
  if (preferred <= SHORT_RANGE_MAX) return preferred
  const closing = Math.max(0, fightElapsed - ENEMY_CLOSE_DELAY_S) * ENEMY_CLOSE_RATE
  return Math.max(SHORT_RANGE_MAX, preferred - closing)
}

function moveUnits(state: GameState, dt: number): void {
  // Player flagship stays at x=0, y=0. Escorts hold relative slots.
  for (const unit of state.combat.playerUnits) {
    if (!unit.isFlagship) continue
    unit.x = 0
    unit.y = 0
  }

  const elapsed = Math.max(0, state.combat.fightElapsed ?? 0)
  for (const unit of state.combat.enemyUnits) {
    if (unit.hull <= 0) continue
    const target = enemyApproachTarget(unit, elapsed)
    if (unit.x > target + 2) {
      unit.x = Math.max(target, unit.x - unit.speed * dt)
    } else if (unit.kite && unit.x < target - 6) {
      unit.x = Math.min(target, unit.x + unit.speed * dt * 0.85)
    }
    // Slight vertical drift so packs don't stack perfectly
    unit.y += Math.sin(unit.x * 0.04 + unit.y) * 0.15
    unit.y = Math.max(-80, Math.min(80, unit.y))
  }
}'''
replace_once('src/game/combat.ts', old_move, new_move)

# Make reward weighting part of rollEnemyPartDrop's unit contract, so direct
# deterministic simulations and live grantEnemyKillRewards cannot disagree.
replace_once(
    'src/game/combat.ts',
    "  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name'>,\n  rng: () => number = Math.random,\n  rewardWeight = 1,\n): PartDropResult[] {",
    "  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name' | 'rewardWeight'>,\n  rng: () => number = Math.random,\n  rewardWeight = unit.rewardWeight ?? 1,\n): PartDropResult[] {",
)

# Use the unit's actual fractional reward share for fragments as well. Authored
# enemies remain exactly the PR72 baseline; extra visual wings add only a small
# amount of expected fragment income.
replace_once(
    'src/game/combat.ts',
    "  const fragmentRewardWeight = rewardWeight >= 1 ? 1 : Math.max(0.8, rewardWeight)\n  rollEnemyPartDrop(state, unit, Math.random, fragmentRewardWeight)",
    "  rollEnemyPartDrop(state, unit, Math.random, rewardWeight)",
)

# Replace the static engageRange test with the actual behavioural guarantee:
# ranged units may start outside 55, but their dynamic approach target reaches
# 55 during a sufficiently long fight.
p = Path('src/game/pr75-combat.test.ts')
text = p.read_text()
text = text.replace(
    "  enemyForSector,\n  enemySectorScale,",
    "  enemyApproachTarget,\n  enemyForSector,\n  enemySectorScale,",
    1,
)
old_test = r'''  it('forces every enemy preferred range inside the shortest legal player weapon range', () => {
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          expect(enemy.engageRange, `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(SHORT_RANGE_MAX)
        }
      }
    }
  })'''
new_test = r'''  it('lets ranged enemies establish standoff but eventually brings every enemy into minimum weapon range', () => {
    let sawLongRange = false
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          if (enemy.engageRange > SHORT_RANGE_MAX) sawLongRange = true
          expect(enemyApproachTarget(enemy, 180), `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(SHORT_RANGE_MAX)
        }
      }
    }
    expect(sawLongRange).toBe(true)
  })'''
if old_test not in text:
    raise SystemExit('Old PR75 range test not found')
p.write_text(text.replace(old_test, new_test, 1))

Path('.github/pr75_fix3.py').unlink(missing_ok=True)
