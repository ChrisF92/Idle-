from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# combat.ts — range safety, denser formations, smoother resistance curve, reward normalisation.
replace_once(
    'src/game/combat.ts',
    "  stationRepairBonus,\n} from './catalog'",
    "  stationRepairBonus,\n  SHORT_RANGE_MAX,\n} from './catalog'",
)
replace_once(
    'src/game/combat.ts',
    "  y?: number\n}): CombatUnit {",
    "  y?: number\n  rewardWeight?: number\n}): CombatUnit {",
)
replace_once(
    'src/game/combat.ts',
    "    regenDelay: 0,\n  }\n}",
    "    regenDelay: 0,\n    rewardWeight: opts.rewardWeight ?? 1,\n  }\n}",
)

anchor = "export function enemyForSector(\n"
p = Path('src/game/combat.ts')
text = p.read_text()
if anchor not in text:
    raise SystemExit('enemyForSector anchor missing')
density_helper = r'''/**
 * Minimum on-screen formation size. The authored role/family patterns still decide
 * what a wave is; this only fills sparse formations with lighter wing units so
 * combat reads as a fleet engagement rather than one or two stat blocks.
 *
 * Wing units carry reduced rewards so density does not become an economy buff.
 */
function targetFormationSize(sector: number, bossWave: boolean): number {
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
}

'''
p.write_text(text.replace(anchor, density_helper + anchor, 1))

replace_once(
    'src/game/combat.ts',
    "  const waveScale = (1 + Math.max(0, wave - 1) * 0.1) * routeDangerMult(side) * extraDanger\n  const units = bossWave\n    ? buildBossPack(sector, name, waveScale)\n    : buildWavePack(sector, family, name, wave, waveScale)\n  const reach = Math.min(48, (Math.max(1, sector) - 1) * 2.8)\n  for (const unit of units) {\n    unit.engageRange += reach\n    for (const weapon of unit.weapons) {\n      weapon.range += reach\n    }\n  }",
    "  // Later waves should be tougher, but not a 40% stat cliff before every boss.\n  // Density now carries more of the pressure, so the within-sector ramp is gentler.\n  const waveScale = (1 + Math.max(0, wave - 1) * 0.06) * routeDangerMult(side) * extraDanger\n  let units = bossWave\n    ? buildBossPack(sector, name, waveScale)\n    : buildWavePack(sector, family, name, wave, waveScale)\n  units = densifyEncounter(units, sector, bossWave)\n  const reach = Math.min(48, (Math.max(1, sector) - 1) * 2.8)\n  for (const unit of units) {\n    // Every enemy must eventually enter range of the shortest legal player weapon.\n    // Roles keep their identity through approach speed, telegraphs, shields, armour,\n    // preferred *closer* ranges and kiting; none can permanently invalidate a loadout.\n    unit.engageRange = Math.min(unit.engageRange, SHORT_RANGE_MAX)\n    for (const weapon of unit.weapons) {\n      weapon.range += reach\n    }\n  }",
)
replace_once(
    'src/game/combat.ts',
    "export const ENEMY_HULL_MID = 1.18\nexport const ENEMY_HULL_LATE = 1.22\n\nexport const ENEMY_DMG_BASE = 0.9\nexport const ENEMY_DMG_EARLY = 1.28\nexport const ENEMY_DMG_MID = 1.155\nexport const ENEMY_DMG_LATE = 1.245",
    "export const ENEMY_HULL_MID = 1.2\nexport const ENEMY_HULL_LATE = 1.215\n\nexport const ENEMY_DMG_BASE = 0.9\nexport const ENEMY_DMG_EARLY = 1.28\nexport const ENEMY_DMG_MID = 1.16\nexport const ENEMY_DMG_LATE = 1.225",
)
replace_once(
    'src/game/combat.ts',
    "export function rollEnemyPartDrop(\n  state: GameState,\n  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name'>,\n  rng: () => number = Math.random,\n): PartDropResult[] {",
    "export function rollEnemyPartDrop(\n  state: GameState,\n  unit: Pick<CombatUnit, 'family' | 'isBoss' | 'name'>,\n  rng: () => number = Math.random,\n  rewardWeight = 1,\n): PartDropResult[] {",
)
replace_once(
    'src/game/combat.ts',
    "  let chance =\n    table.chance *\n    earlyMult *",
    "  let chance =\n    table.chance *\n    Math.max(0, Math.min(1, rewardWeight)) *\n    earlyMult *",
)
replace_once(
    'src/game/combat.ts',
    "export function grantEnemyKillRewards(state: GameState, unit: CombatUnit): void {\n  if (unit.side !== 'enemy') return\n  noteSortieKill(state)\n  recordPlaytest(state, 'first_kill', { firstKey: 'kill' })",
    "export function grantEnemyKillRewards(state: GameState, unit: CombatUnit): void {\n  if (unit.side !== 'enemy') return\n  noteSortieKill(state)\n  recordPlaytest(state, 'first_kill', { firstKey: 'kill' })\n  const rewardWeight = Math.max(0, Math.min(1, unit.rewardWeight ?? 1))",
)
replace_once(
    'src/game/combat.ts',
    "  state.resources.salvage +=\n    salvageFromKill(state.combat.sector, unit.isBoss, state.combat.route, state) * salvageMult\n  rollEnemyPartDrop(state, unit)\n  grantSignalCoreDrop(state, 'kill', { family: unit.family })\n  grantReliquaryKillLoot(\n    state,\n    unit.isBoss,\n    Math.random,\n    hiveResearchShardDropBonus(state) + foundryShardDropBonus(state),\n  )\n  grantFurnaceKillLoot(state, unit.isBoss)\n  grantHiveResearchKillXp(\n    state,\n    unit.isBoss,\n    furnaceResearchXpMult(state) * reliquaryResearchXpMult(state),\n  )",
    "  state.resources.salvage +=\n    salvageFromKill(state.combat.sector, unit.isBoss, state.combat.route, state) * salvageMult * rewardWeight\n  rollEnemyPartDrop(state, unit, Math.random, rewardWeight)\n  // Wing enemies exist to make formations richer, not to multiply the economy.\n  // Continuous XP scales directly; discrete loot uses the same expected-value weight.\n  const discreteLoot = rewardWeight >= 1 || Math.random() < rewardWeight\n  if (discreteLoot) {\n    grantSignalCoreDrop(state, 'kill', { family: unit.family })\n    grantReliquaryKillLoot(\n      state,\n      unit.isBoss,\n      Math.random,\n      hiveResearchShardDropBonus(state) + foundryShardDropBonus(state),\n    )\n    grantFurnaceKillLoot(state, unit.isBoss)\n  }\n  grantHiveResearchKillXp(\n    state,\n    unit.isBoss,\n    furnaceResearchXpMult(state) * reliquaryResearchXpMult(state) * rewardWeight,\n  )",
)

# types.ts — optional reward weight used only by density-added wing units.
replace_once(
    'src/game/types.ts',
    "  /** Seconds until in-combat shield regen resumes after a hit. */\n  regenDelay?: number\n}",
    "  /** Seconds until in-combat shield regen resumes after a hit. */\n  regenDelay?: number\n  /** Kill-reward share. Authored enemies default to 1; density wing units are fractional. */\n  rewardWeight?: number\n}",
)

# frontier.ts — preserve the basic arithmetic invariant in aggregated historical records.
replace_once(
    'src/game/frontier.ts',
    "  const rec = ensureSectorAttempt(state, failedSector, route)\n  rec.failures += 1",
    "  const rec = ensureSectorAttempt(state, failedSector, route)\n  rec.failures += 1\n  rec.attempts = Math.max(rec.attempts, rec.failures + rec.clears)",
)
replace_once(
    'src/game/frontier.ts',
    "  const rec = ensureSectorAttempt(state, clearedSector, route)\n  rec.clears += 1",
    "  const rec = ensureSectorAttempt(state, clearedSector, route)\n  rec.clears += 1\n  rec.attempts = Math.max(rec.attempts, rec.failures + rec.clears)",
)

Path('src/game/pr75-combat.test.ts').write_text(r'''import { describe, expect, it } from 'vitest'
import {
  ENEMY_HULL_EARLY,
  ENEMY_HULL_LATE,
  ENEMY_HULL_MID,
  enemyForSector,
  enemySectorScale,
} from './combat'
import { SHORT_RANGE_MAX } from './catalog'
import { wavesForSector } from './sectors'

function minExpectedPack(sector: number, boss: boolean): number {
  if (boss) return sector < 6 ? 3 : sector < 16 ? 4 : 5
  if (sector <= 2) return 3
  if (sector <= 8) return 4
  if (sector <= 18) return 5
  return 6
}

describe('PR75 combat pacing', () => {
  it('forces every enemy preferred range inside the shortest legal player weapon range', () => {
    for (let sector = 1; sector <= 80; sector += 1) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        for (const enemy of encounter.units) {
          expect(enemy.engageRange, `S${sector} W${wave} ${enemy.name}`).toBeLessThanOrEqual(SHORT_RANGE_MAX)
        }
      }
    }
  })

  it('keeps normal and boss formations visually populated through Act 1', () => {
    for (const sector of [1, 3, 8, 9, 15, 19, 30, 51, 80]) {
      for (let wave = 1; wave <= wavesForSector(sector); wave += 1) {
        const encounter = enemyForSector(sector, wave)
        expect(encounter.units.length).toBeGreaterThanOrEqual(minExpectedPack(sector, encounter.isBoss))
        expect(encounter.units.length).toBeLessThanOrEqual(7)
      }
    }
  })

  it('adds fractional-reward wing units instead of multiplying the kill economy', () => {
    const encounter = enemyForSector(30, 1)
    const wings = encounter.units.filter((u) => (u.rewardWeight ?? 1) < 1)
    expect(wings.length).toBeGreaterThan(0)
    expect(wings.every((u) => (u.rewardWeight ?? 1) <= 0.4)).toBe(true)
  })

  it('keeps enemy hull scaling monotonic while strengthening the previously soft mid band', () => {
    expect(ENEMY_HULL_EARLY).toBe(1.235)
    expect(ENEMY_HULL_MID).toBeGreaterThan(1.18)
    expect(ENEMY_HULL_LATE).toBeGreaterThan(1.2)
    for (let sector = 1; sector < 80; sector += 1) {
      expect(enemySectorScale(sector + 1)).toBeGreaterThan(enemySectorScale(sector))
    }
  })
})
''')

for temp in [
    '.github/workflows/pr75-implement.yml',
    '.github/workflows/pr75-pr.yml',
    '.github/pr75_apply.py',
]:
    path = Path(temp)
    if path.exists():
        path.unlink()
