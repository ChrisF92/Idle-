from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
old = '''# Weapon Core output/cycle semantics.\nneedle = "  const damage = base.damage * levelMult * mastery.damageMult\\n  const cooldown = base.cooldown * mastery.cooldownMult"\nif needle not in state:\n    raise RuntimeError('state weapon needle missing')\nstate = state.replace(needle, "  const role = getModule(moduleId)?.role\\n  const directiveWeapon = role === 'weapon' ? directiveWeaponCoreMult(state) : 1\\n  const directiveCycle = role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1\\n  const damage = base.damage * levelMult * mastery.damageMult * directiveWeapon\\n  const cooldown = (base.cooldown * mastery.cooldownMult) / Math.max(0.1, directiveCycle)")\n'''
new = '''# Weapon Core output/cycle semantics. Current main builds the weapon inline.\nstate = state.replace(\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      mods.damageMult *",\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      (mod.role === 'weapon' ? directiveWeaponCoreMult(state) : 1) *\\n      mods.damageMult *",\n)\nstate = state.replace(\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / cycleRateMult(state),",\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / (cycleRateMult(state) * (mod.role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1)),",\n)\n'''
if old not in text:
    raise SystemExit('prepare: target state block not found')
p.write_text(text.replace(old, new, 1))
print('prepared PR8 transform for current state.ts')
