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
p.write_text(text)
print('fixed PR8 generated transform escaping')
