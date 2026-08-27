from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text = text.replace(
    "state = state.replace('export const SAVE_VERSION = 48', 'export const SAVE_VERSION = 49')\\nstate = state.replace(",
    "state = state.replace('export const SAVE_VERSION = 48', 'export const SAVE_VERSION = 49')\nstate = state.replace(",
)
text = text.replace(
    "state = \"import './directiveEncounterBridge'\n\" + state",
    "state = \"import './directiveEncounterBridge'\" + chr(10) + state",
)
anchor = "state = state.replace(\"import { furnaceDamageMult, furnaceShieldMult } from './furnace'\", \"import { furnaceDamageMult, furnaceHullMult, furnaceShieldMult } from './furnace'\")"
insert = anchor + "\nstate = state.replace(\"import { directiveIncomingMult, directiveShieldMult, directiveSplashMult, directiveWeaponMult } from './directives'\", \"import { directiveArmorMult, directiveHullMult, directiveIncomingMult, directiveShieldRegenMult, directiveShieldMult, directiveWeaponCoreMult, directiveWeaponCycleRateMult, directiveWeaponMult } from './directives'\")"
if anchor not in text:
    raise SystemExit('prepare2: state import anchor missing')
text = text.replace(anchor, insert, 1)
p.write_text(text)
print('fixed PR8 generated transform escaping/imports')
