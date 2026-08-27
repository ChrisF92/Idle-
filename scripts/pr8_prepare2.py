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
insert = anchor + "\nstate = state.replace(\"import { createEmptyFurnaceState, furnaceDamageMult, furnaceShieldMult } from './furnace'\", \"import { createEmptyFurnaceState, furnaceDamageMult, furnaceHullMult, furnaceShieldMult } from './furnace'\")\nstate = state.replace(\"import { directiveIncomingMult, directiveShieldMult, directiveSplashMult, directiveWeaponMult } from './directives'\", \"import { directiveArmorMult, directiveHullMult, directiveIncomingMult, directiveShieldMult, directiveWeaponCoreMult, directiveWeaponCycleRateMult, directiveWeaponMult } from './directives'\")"
if anchor not in text:
    raise SystemExit('prepare2: state import anchor missing')
text = text.replace(anchor, insert, 1)

# Current state.ts has no frameHullMult/frameArmorMult hooks. Apply the capacity/armor
# Directive multipliers at the actual final stat aggregation points instead.
old_state_block = """state = state.replace('  armor *= frameArmorMult(state)', '  armor *= frameArmorMult(state) * directiveArmorMult(state)')
state = state.replace('  hullMax *= frameHullMult(state)', '  hullMax *= frameHullMult(state) * directiveHullMult(state) * furnaceHullMult(state)')
state = state.replace('  shieldMax *= frameShieldMult(state)', '  shieldMax *= frameShieldMult(state)')"""
new_state_block = """state = state.replace(
    '  hullMax *= matterHullMult(state)',
    '  hullMax *= matterHullMult(state) * directiveHullMult(state) * furnaceHullMult(state)',
)
state = state.replace(
    '  armor += shopArmor(state)',
    '  armor += shopArmor(state)\\n  armor *= directiveArmorMult(state)',
)"""
if old_state_block not in text:
    raise SystemExit('prepare2: capacity state block missing')
text = text.replace(old_state_block, new_state_block, 1)

# Current waveScheduler uses scheduleNextNormal and salvageBonus/waveScrap rather than
# the older waveKind/salvage/scrap shapes the initial transform targeted.
old_ws_block = """ws = read('src/game/waveScheduler.ts')
ws = ws.replace(\"import { waveKind } from './waves'\", \"import { waveKind } from './waves'\\nimport { directiveNormalReinforcementIntervalMult, directiveSalvageMult, directiveScrapMult } from './directives'\\nimport { furnaceSalvageMult, furnaceScrapMult } from './furnace'\")
ws = ws.replace('state.combat.nextReinforcementAt = now + NORMAL_REINFORCEMENT_INTERVAL', 'state.combat.nextReinforcementAt = now + NORMAL_REINFORCEMENT_INTERVAL * directiveNormalReinforcementIntervalMult(state)')
ws = ws.replace('const salvage = salvageWaveBonus(state)', 'const salvage = salvageWaveBonus(state) * directiveSalvageMult(state) * furnaceSalvageMult(state)')
ws = ws.replace('const scrap = scrapWaveBonus(state)', 'const scrap = scrapWaveBonus(state) * directiveScrapMult(state) * furnaceScrapMult(state)')
write('src/game/waveScheduler.ts', ws)"""
new_ws_block = """ws = read('src/game/waveScheduler.ts')
ws = ws.replace(
    \"import { salvageWaveBonus, scrapWaveBonus } from './workshop'\",
    \"import { salvageWaveBonus, scrapWaveBonus } from './workshop'\\nimport { directiveNormalReinforcementIntervalMult, directiveSalvageMult, directiveScrapMult } from './directives'\\nimport { furnaceSalvageMult, furnaceScrapMult } from './furnace'\",
)
ws = ws.replace(
    '  state.combat.nextReinforcementAt = (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL',
    '  state.combat.nextReinforcementAt = (state.combat.simTime ?? 0) + NORMAL_REINFORCEMENT_INTERVAL * directiveNormalReinforcementIntervalMult(state)',
)
ws = ws.replace(
    '  const salvageBonus = salvageWaveBonus(state)',
    '  const salvageBonus = salvageWaveBonus(state) * directiveSalvageMult(state) * furnaceSalvageMult(state)',
)
ws = ws.replace(
    \"  const waveScrap = (drip + scrapWaveBonus(state)) * combatScrapMatterMult(state)\",
    \"  const waveScrap = (drip + scrapWaveBonus(state)) * combatScrapMatterMult(state) * directiveScrapMult(state) * furnaceScrapMult(state)\",
)
write('src/game/waveScheduler.ts', ws)"""
if old_ws_block not in text:
    raise SystemExit('prepare2: old scheduler transform block missing')
text = text.replace(old_ws_block, new_ws_block, 1)

# Focused test harness must use the current PR7 generator signature and scheduler hook.
text = text.replace(
    "const ordinary = encounterForWave(base, 421, 77)",
    "const ordinary = encounterForWave(421, 77, base)",
)
text = text.replace(
    "const pressured = encounterForWave(packed, 421, 77)",
    "const pressured = encounterForWave(421, 77, packed)",
)
text = text.replace(
    "const commander = encounterForWave(packed, 420, 77)",
    "const commander = encounterForWave(420, 77, packed)",
)
text = text.replace(
    "import { NORMAL_REINFORCEMENT_INTERVAL, tickWaveScheduler } from './waveScheduler'",
    "import { tickWaveScheduler } from './waveScheduler'\nimport { NORMAL_REINFORCEMENT_INTERVAL } from './waves'",
)
text = text.replace(
    "tickWaveScheduler(s, 0, {})",
    "tickWaveScheduler(s, 0, { pushLog: () => {} })",
)
# Two level-III channels cost 120 Heat total (60 + 60), so make the unbounded-Heat
# integration assertion actually fund the canonical configuration.
text = text.replace(
    "s.resources.choirAsh = 1000",
    "s.resources.choirAsh = 1200",
)
text = text.replace(
    "expect(s.resources.heat).toBeGreaterThanOrEqual(100)",
    "expect(s.resources.heat).toBeGreaterThanOrEqual(120)",
    1,
)

p.write_text(text)
print('fixed PR8 generated transform integration/tests')
