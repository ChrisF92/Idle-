from pathlib import Path
import re

p = Path('scripts/pr8_apply.py')
text = p.read_text()

# Current main builds Core weapons inline rather than through the older local variables.
old = '''# Weapon Core output/cycle semantics.\nneedle = "  const damage = base.damage * levelMult * mastery.damageMult\\n  const cooldown = base.cooldown * mastery.cooldownMult"\nif needle not in state:\n    raise RuntimeError('state weapon needle missing')\nstate = state.replace(needle, "  const role = getModule(moduleId)?.role\\n  const directiveWeapon = role === 'weapon' ? directiveWeaponCoreMult(state) : 1\\n  const directiveCycle = role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1\\n  const damage = base.damage * levelMult * mastery.damageMult * directiveWeapon\\n  const cooldown = (base.cooldown * mastery.cooldownMult) / Math.max(0.1, directiveCycle)")\n'''
new = '''# Weapon Core output/cycle semantics. Current main builds the weapon inline.\nstate = state.replace(\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      mods.damageMult *",\n    "      moduleWeaponDamage(mod, level, mastery) *\\n      (mod.role === 'weapon' ? directiveWeaponCoreMult(state) : 1) *\\n      mods.damageMult *",\n)\nstate = state.replace(\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / cycleRateMult(state),",\n    "    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / (cycleRateMult(state) * (mod.role === 'weapon' ? directiveWeaponCycleRateMult(state) : 1)),",\n)\n# Siege Calibration is a weapon-cycle drawback, so it also affects the Frame Battery.\nstate = state.replace(\n    "      cooldown: 1 / cycleRateMult(state),",\n    "      cooldown: 1 / (cycleRateMult(state) * directiveWeaponCycleRateMult(state)),",\n)\n'''
if old not in text:
    raise SystemExit('prepare: target state block not found')
text = text.replace(old, new, 1)

# Keep the PR7 encounter generator neutral. PR8 installs Pack Hunter through the provider boundary.
enc_block = re.compile(r"# Encounter generator: PR8 intentionally populates PR7 neutral modifier hook with Directive pressure\..*?write\('src/game/encounterGenerator\.ts', enc\)\n", re.S)
enc_new = '''# Encounter generator stays neutral; install the PR8 Directive provider through the PR7 hook.\nenc = read('src/game/encounterGenerator.ts')\nwrite('src/game/encounterGenerator.ts', enc)\nwrite('src/game/directiveEncounterBridge.ts', r\'''import { directiveEncounterThreatMult } from './directives'\nimport { setEncounterModifierProvider } from './encounterGenerator'\n\nsetEncounterModifierProvider((state) => ({\n  threatMultiplier: directiveEncounterThreatMult(state),\n  countDelta: 0,\n}))\n\''')\nstate = read('src/game/state.ts')\nif "import './directiveEncounterBridge'" not in state:\n    state = "import './directiveEncounterBridge'\\n" + state\nwrite('src/game/state.ts', state)\n'''
text, n = enc_block.subn(enc_new, text, count=1)
if n != 1:
    raise SystemExit('prepare: encounter block not found')

# Current PR2 targeting hook is named TargetingStatModifier, not the older draft type.
text = text.replace('TargetingModifierContribution', 'TargetingStatModifier')

# Approved Precision Protocol is multiplicative Crit Factor, not +0.10 absolute factor.
text = text.replace('precisionCritFactorAdd: 0.10', 'precisionCritFactorMult: 1.10')
text = text.replace('precisionCritFactorAdd', 'precisionCritFactorMult')
text = text.replace('directiveCritFactorAdd', 'directiveCritFactorMult')
text = text.replace(
    "return hasDirective(state, 'precision-protocol') ? DIRECTIVE_SEEDS.precisionCritFactorMult : 0",
    "return hasDirective(state, 'precision-protocol') ? DIRECTIVE_SEEDS.precisionCritFactorMult : 1",
)
text = text.replace(
    'critFactor(state) + directiveCritFactorMult(state)',
    'critFactor(state) * directiveCritFactorMult(state)',
)

# Core satellites intentionally have no Hull pool; Focused Fire must count their real target locks.
text = text.replace(
    "(u) => u.hull > 0 && u.isCore && getModule(u.coreModuleId ?? '')?.role === 'weapon' && u.currentTargetId === targetId,",
    "(u) => u.isCore && getModule(u.coreModuleId ?? '')?.role === 'weapon' && u.currentTargetId === targetId,",
)

# Persist consumed Directive opportunities so Continue Unchanged cannot be replayed/rerolled.
text = text.replace(
    "  if (!isDirectiveWave(clearedWave) || hasDirectiveOffer(state)) return false\\n  const offer = makeDirectiveOffer(state, clearedWave)",
    "  if (!isDirectiveWave(clearedWave) || hasDirectiveOffer(state)) return false\\n  if ((state.combat.directiveOpportunitiesConsumed ?? []).includes(clearedWave)) return false\\n  const offer = makeDirectiveOffer(state, clearedWave)",
)
text = text.replace(
    "  state.combat.directiveOffer = offer\\n  return true",
    "  state.combat.directiveOffer = offer\\n  state.combat.directiveOpportunitiesConsumed = [...(state.combat.directiveOpportunitiesConsumed ?? []), clearedWave]\\n  return true",
    1,
)
text = text.replace(
    "  state.combat.directives = []\\n  state.combat.directiveOffer = null",
    "  state.combat.directives = []\\n  state.combat.directiveOffer = null\\n  state.combat.directiveOpportunitiesConsumed = []",
    1,
)

# Add the current-Sortie consumed-wave field to the new schema and initial state.
needle = "write('src/game/types.ts', types2)"
insert = """types2 = types2.replace(\n    \"  directives: string[]\\n  directiveOffer: string[] | null\",\n    \"  directives: string[]\\n  directiveOffer: string[] | null\\n  directiveOpportunitiesConsumed: number[]\",\n)\nwrite('src/game/types.ts', types2)"""
if needle not in text:
    raise SystemExit('prepare: types write not found')
text = text.replace(needle, insert, 1)
text = text.replace(
    "state = state.replace('export const SAVE_VERSION = 48', 'export const SAVE_VERSION = 49')",
    "state = state.replace('export const SAVE_VERSION = 48', 'export const SAVE_VERSION = 49')\\nstate = state.replace('      directiveOffer: null,', '      directiveOffer: null,\\n      directiveOpportunitiesConsumed: [],', 1)",
    1,
)

# Sanitize the current-v49 Sortie field on reload; no v48 migration is retained.
save_anchor = "save = save.replace('    finalizeFurnaceMigration(hydrated)\\n', '')"
save_insert = """save = save.replace(\n    \"    directiveOffer: combat.directiveOffer == null ? null : sanitizeDirectiveIds(combat.directiveOffer),\",\n    \"    directiveOffer: combat.directiveOffer == null ? null : sanitizeDirectiveIds(combat.directiveOffer),\\n    directiveOpportunitiesConsumed: Array.isArray(combat.directiveOpportunitiesConsumed)\\n      ? [...new Set(combat.directiveOpportunitiesConsumed.map((w) => Math.floor(Number(w))).filter((w) => [125, 275, 425, 575, 725, 875].includes(w)))]\\n      : [],\",\n)\nsave = save.replace('    finalizeFurnaceMigration(hydrated)\\n', '')"""
if save_anchor not in text:
    raise SystemExit('prepare: save anchor not found')
text = text.replace(save_anchor, save_insert, 1)

# Strengthen the focused Directive test with consumed-opportunity semantics.
text = text.replace(
    "expect(next.combat.directives).toEqual([])\\n  })",
    "expect(next.combat.directives).toEqual([])\\n    expect(queueDirectiveOffer(next, 125)).toBe(false)\\n  })",
    1,
)

p.write_text(text)
print('prepared PR8 transform for current main and audit invariants')
