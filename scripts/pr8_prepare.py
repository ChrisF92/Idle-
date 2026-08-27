from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()

old = '''# Weapon Core output/cycle semantics.\nneedle = "  const damage = base.damage * levelMult * mastery.damageMult\\n  const cooldown = base.cooldown * mastery.cooldownMult"\nif needle not in state:\n    raise RuntimeError('state weapon needle missing')\nstate = state.replace(needle, "  const role = getModule(moduleId)?.role\\n  const directiveWeapon = role === 'weapon' ? directiveWeaponCoreMult(state) : 1\\n  const directiveCycle = role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1\\n  const damage = base.damage * levelMult * mastery.damageMult * directiveWeapon\\n  const cooldown = (base.cooldown * mastery.cooldownMult) / Math.max(0.1, directiveCycle)")\n'''
new = '''# Weapon Core output/cycle semantics. Current main builds the weapon inline.\nstate = state.replace(\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      mods.damageMult *",\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      (mod.role === 'weapon' ? directiveWeaponCoreMult(state) : 1) *\\n      mods.damageMult *",\n)\nstate = state.replace(\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / cycleRateMult(state),",\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / (cycleRateMult(state) * (mod.role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1)),",\n)\n'''
if old not in text:
    raise SystemExit('prepare: target state block not found')
text = text.replace(old, new, 1)

old_enc = '''# Encounter generator: PR8 intentionally populates PR7 neutral modifier hook with Directive pressure.\nenc = read('src/game/encounterGenerator.ts')\nenc = enc.replace("import { formationThreatMultiplier } from './formations'", "import { formationThreatMultiplier } from './formations'\\nimport { directiveEncounterThreatMult } from './directives'")\nold = "  const raw = encounterModifierProvider(state, wave, kind) ?? {}\\n  return {\\n    threatMultiplier: clamp(Number(raw.threatMultiplier ?? 1) || 1, 0.5, 2),"\nif old not in enc:\n    raise RuntimeError('encounter modifier needle missing')\nenc = enc.replace(old, "  const raw = encounterModifierProvider(state, wave, kind) ?? {}\\n  const directiveThreat = directiveEncounterThreatMult(state)\\n  return {\\n    threatMultiplier: clamp((Number(raw.threatMultiplier ?? 1) || 1) * directiveThreat, 0.5, 2),")\nwrite('src/game/encounterGenerator.ts', enc)\n'''
new_enc = '''# Encounter generator: PR8 intentionally populates PR7 neutral modifier hook with Directive pressure.\nenc = read('src/game/encounterGenerator.ts')\nenc = enc.replace("import { formationThreatMultiplier } from './formations'", "import { formationThreatMultiplier } from './formations'\\nimport { directiveEncounterThreatMult } from './directives'")\nold = "  const raw = state && encounterModifierProvider ? encounterModifierProvider(state, wave, kind) : {}\\n  return {\\n    threatMultiplier: Math.max(0.1, Number(raw.threatMultiplier ?? 1) || 1),"\nif old not in enc:\n    raise RuntimeError('encounter modifier needle missing')\nenc = enc.replace(old, "  const raw = state && encounterModifierProvider ? encounterModifierProvider(state, wave, kind) : {}\\n  const directiveThreat = state ? directiveEncounterThreatMult(state) : 1\\n  return {\\n    threatMultiplier: Math.max(0.1, (Number(raw.threatMultiplier ?? 1) || 1) * directiveThreat),")\nwrite('src/game/encounterGenerator.ts', enc)\n'''
if old_enc not in text:
    raise SystemExit('prepare: target encounter block not found')
text = text.replace(old_enc, new_enc, 1)

p.write_text(text)
print('prepared PR8 transform for current main')
