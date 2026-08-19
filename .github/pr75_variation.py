from pathlib import Path

p = Path('src/game/combat.ts')
text = p.read_text()
old = "  const pattern = ((wave - 1) % 5) as 0 | 1 | 2 | 3 | 4\n  const hullScale = enemySectorScale(sector) * waveScale"
new = "  // Keep S1-S8 onboarding deterministic. From S9 onward, rotate the authored\n  // five-pattern sequence each four-sector family cycle so returning families do\n  // not replay the same wave order forever (and climax patterns actually surface).\n  const patternOffset = sector <= 8 ? 0 : Math.floor((sector - 9) / 4) % 5\n  const pattern = ((wave - 1 + patternOffset) % 5) as 0 | 1 | 2 | 3 | 4\n  const hullScale = enemySectorScale(sector) * waveScale"
if old not in text:
    raise SystemExit('buildWavePack pattern anchor missing')
p.write_text(text.replace(old, new, 1))

p = Path('src/game/pr75-combat.test.ts')
text = p.read_text()
needle = "  it('keeps normal and boss formations visually populated through Act 1', () => {"
test = r'''  it('rotates authored wave patterns when a family returns later in Act 1', () => {
    // S9 and S13 are both Route A Swarm sectors. The later cycle should begin
    // on a different authored pattern rather than replaying the same opening wave.
    const s9 = enemyForSector(9, 1, 'A')
    const s13 = enemyForSector(13, 1, 'A')
    expect(s9.family).toBe('swarm')
    expect(s13.family).toBe('swarm')
    const roles9 = s9.units.filter((u) => (u.rewardWeight ?? 1) === 1).map((u) => u.role)
    const roles13 = s13.units.filter((u) => (u.rewardWeight ?? 1) === 1).map((u) => u.role)
    expect(roles13).not.toEqual(roles9)
  })

'''
if needle not in text:
    raise SystemExit('variation test anchor missing')
p.write_text(text.replace(needle, test + needle, 1))

# Self-remove with the validation workflow.
Path('.github/pr75_variation.py').unlink(missing_ok=True)
Path('.github/workflows/pr75-variation.yml').unlink(missing_ok=True)
