from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text += r'''

# --- PR8 TypeScript teardown cleanup ---
# Remove compile-time consumers of the retired Furnace surface rather than
# restoring aliases for upgrades/presets/wanted/active channels.

# Battlefield VFX uses the canonical channel vocabulary.
bf = read('src/components/Battlefield.tsx')
bf = bf.replace('furnacePush.weapons', 'furnacePush.overdrive')
bf = bf.replace('furnacePush.ward', 'furnacePush.bulwark')
bf = bf.replace('furnacePush.yield', 'furnacePush.harvest')
write('src/components/Battlefield.tsx', bf)

# Persist consumed Directive opportunities in the canonical combat state.
types = read('src/game/types.ts')
if 'directiveOpportunitiesConsumed:' not in types:
    types = types.replace(
        '  directiveOffer: string[] | null\n',
        '  directiveOffer: string[] | null\n  /** Canonical opportunity Waves already consumed this Sortie; prevents save/reload rerolls. */\n  directiveOpportunitiesConsumed: number[]\n',
        1,
    )
# Process remains PR9-owned, but it must not depend on deleted Furnace preset types.
types = types.replace('furnacePreset?: FurnacePresetId', 'furnacePreset?: string')
types = types.replace('furnacePreset?: FurnacePresetId | null', 'furnacePreset?: string | null')
write('src/game/types.ts', types)

# useGame exposes only manual conversion + one-time Ignite for PR8.
ug = read('src/hooks/useGame.ts')
ug = ug.replace('  buyFurnaceUpgrade,\n', '')
ug = ug.replace('  setFurnaceChannel,\n', '')
ug = ug.replace('  setFurnacePriority,\n', '')
ug = ug.replace('  applyFurnacePreset,\n', '')
if '  igniteFurnace,\n' not in ug:
    ug = ug.replace('  convertAshToHeat,\n', '  convertAshToHeat,\n  igniteFurnace,\n', 1)
ug = re.sub(
    r"  \| \{ type: 'furnace-convert' \}\n(?:  \| \{ type: 'furnace-[^\n]+\n)+  \| \{ type: 'research-focus'",
    "  | { type: 'furnace-convert' }\n  | { type: 'furnace-ignite'; channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>> }\n  | { type: 'research-focus'",
    ug,
    count=1,
)
ug = re.sub(
    r"    case 'furnace-convert':\n      return convertAshToHeat\(state\)\n(?:    case 'furnace-[\s\S]*?)+?    case 'research-focus':",
    "    case 'furnace-convert':\n      return convertAshToHeat(state)\n    case 'furnace-ignite':\n      return igniteFurnace(state, action.channels)\n    case 'research-focus':",
    ug,
    count=1,
)
ug = re.sub(
    r"    convertAshToHeat: \(\) => dispatch\(\{ type: 'furnace-convert' \}\),\n[\s\S]*?    setResearchFocus:",
    "    convertAshToHeat: () => dispatch({ type: 'furnace-convert' }),\n    igniteFurnace: (channels: Partial<Record<import('../game/types').FurnaceChannelId, import('../game/types').FurnaceChannelLevel>>) =>\n      dispatch({ type: 'furnace-ignite', channels }),\n    setResearchFocus:",
    ug,
    count=1,
)
write('src/hooks/useGame.ts', ug)

# PR9 owns Process/Furnace automation. Hide its obsolete preset/channel manager
# controls instead of restoring legacy Furnace APIs.
pt = read('src/components/tabs/ProcessTab.tsx')
pt = pt.replace('  FurnaceChannelId,\n', '')
pt = pt.replace('  FurnacePresetId,\n', '')
pt = re.sub(r"import \{ FURNACE_CHANNELS, FURNACE_PRESETS, furnacePriority \} from '../../game/furnace'\n", '', pt)
pt = re.sub(
    r"  if \(nodeId === 'furnace-reserve' \|\| nodeId === 'furnace-presets' \|\| nodeId === 'furnace-channels'\) \{[\s\S]*?\n  \}\n  if \(nodeId === 'protocol-repeat'",
    "  if (nodeId === 'furnace-reserve' || nodeId === 'furnace-presets' || nodeId === 'furnace-channels') {\n    return (\n      <div className=\"process-config-block\">\n        <p className=\"muted\">Furnace automation is unavailable until the Process rewrite. Configure and Ignite the Furnace manually.</p>\n      </div>\n    )\n  }\n  if (nodeId === 'protocol-repeat'",
    pt,
    count=1,
)
write('src/components/tabs/ProcessTab.tsx', pt)

pp = read('src/game/processProfiles.ts')
pp = pp.replace('  FurnacePresetId,\n', '')
pp = pp.replace('  furnacePreset: FurnacePresetId | null', '  furnacePreset: string | null')
write('src/game/processProfiles.ts', pp)

# Combat: Directive incoming-damage drawbacks apply exactly once to hostile
# damage aimed at the Hive. Scavenger/Harvest Scrap bonuses apply to kill Scrap.
combat = read('src/game/combat.ts')
combat = combat.replace(
    "opts?: { shieldBypassFrac?: number; role?: CombatUnit['role'] },",
    "opts?: { shieldBypassFrac?: number; role?: CombatUnit['role']; secondary?: boolean },",
)
combat = combat.replace(
    "  if (state && target.isFlagship && target.side === 'player') {\n    remaining = mitigateIncomingToHive(state, target, remaining, tags)",
    "  if (state && target.isFlagship && target.side === 'player') {\n    remaining *= directiveIncomingMult(state)\n    remaining = mitigateIncomingToHive(state, target, remaining, tags)",
    1,
)
combat = combat.replace(
    "scrapKillBonus(state, unit.isBoss) * rewardWeight * commanderScrap * combatScrapMatterMult(state)",
    "scrapKillBonus(state, unit.isBoss) * rewardWeight * commanderScrap * combatScrapMatterMult(state) * directiveScrapMult(state) * furnaceScrapMult(state)",
    1,
)
write('src/game/combat.ts', combat)

# Targeting modifiers use the existing TargetingStatModifier shape (no source tag).
ct = read('src/game/coreTargeting.ts')
ct = ct.replace("return { source: 'directive', ...d }", 'return { ...d }')
ct = ct.replace("return { source: 'furnace', ...f }", 'return { ...f }')
write('src/game/coreTargeting.ts', ct)

# Numeric union narrowing for canonical Furnace level costs.
fur = read('src/game/furnace.ts')
fur = fur.replace(
    '  return lv <= 0 ? 0 : FURNACE_LEVEL_COST[lv]',
    "  if (lv === 0) return 0\n  return FURNACE_LEVEL_COST[lv]",
)
write('src/game/furnace.ts', fur)

# Player guidance speaks the replacement lifecycle.
pg = read('src/game/playerGuidance.ts')
pg = pg.replace(
    "  if (isSystemUnlocked(state, 'furnace') && (state.furnace?.wanted.shielding ?? 0) <= 0) {\n    items.push('Spend Heat on Shielding')\n  }",
    "  if (isSystemUnlocked(state, 'furnace') && !state.furnace.ignited) {\n    items.push('Convert Ash and Ignite the Furnace during a live Sortie')\n  }",
)
write('src/game/playerGuidance.ts', pg)

# Playtest/readout consumers use ignited canonical channels.
pl = read('src/game/playtest.ts')
pl = pl.replace(
    "Object.values(state.furnace?.active ?? {}).some((n) => (n ?? 0) > 0)",
    "state.furnace.ignited && Object.values(state.furnace.channels).some((n) => n > 0)",
)
pl = pl.replace(
    "const furnace = Object.entries(state.furnace?.active ?? {})",
    "const furnace = Object.entries(state.furnace.channels)",
)
write('src/game/playtest.ts', pl)

proc = read('src/game/process.ts')
proc = proc.replace(
    "Object.values(state.furnace?.active ?? {}).some((n) => n > 0) ||",
    "(state.furnace.ignited && Object.values(state.furnace.channels).some((n) => n > 0)) ||",
)
write('src/game/process.ts', proc)

prog = read('src/game/progression.ts')
prog = re.sub(
    r"    case 'furnace-rank-sum':\n      return \(\n        Object.values\(state\.furnace\?\.upgrades \?\? \{\}\)\.reduce\(\(a, b\) => a \+ b, 0\) \+\n        Object.values\(state\.furnace\?\.wanted \?\? \{\}\)\.reduce\(\(a, b\) => a \+ b, 0\)\n      \)",
    "    case 'furnace-rank-sum':\n      return state.furnace.ignited ? Object.values(state.furnace.channels).reduce((a, b) => a + b, 0) : 0",
    prog,
    count=1,
)
write('src/game/progression.ts', prog)

prot = read('src/game/protocols.ts')
prot = prot.replace(
    "Object.values(state.furnace?.active ?? {}).some((n) => n > 0) ||",
    "(state.furnace.ignited && Object.values(state.furnace.channels).some((n) => n > 0)) ||",
)
prot = prot.replace("'Convert Ash or light a channel first'", "'Convert Ash or Ignite the Furnace first'")
write('src/game/protocols.ts', prot)

# Simulation can observe the new Furnace but must not auto-manage it.
sr = read('src/game/simulation/runner.ts')
sr = sr.replace(
    "(state.furnace?.wanted?.weapons ?? 0) > 0 || (state.furnace?.active?.weapons ?? 0) > 0\n        ? 'Furnace Weapons lit'",
    "state.furnace.ignited\n        ? 'Furnace Ignited'",
)
sr = sr.replace(
    "((state.furnace?.wanted?.weapons ?? 0) > 0 || (state.furnace?.active?.weapons ?? 0) > 0)",
    "state.furnace.ignited",
)
sr = sr.replace("stopReason = 'Furnace Weapons lit'", "stopReason = 'Furnace Ignited'")
sr = sr.replace(
    "      upgrades: { ...(state.furnace?.upgrades ?? {}) },\n      wanted: { ...(state.furnace?.wanted ?? {}) },\n      active: { ...(state.furnace?.active ?? {}) },",
    "      upgrades: {},\n      wanted: { ...state.furnace.channels },\n      active: state.furnace.ignited ? { ...state.furnace.channels } : {},",
)
write('src/game/simulation/runner.ts', sr)

# Retired rank task now recognizes actual Furnace use.
tasks = read('src/game/tasks.ts')
tasks = tasks.replace("blurb: 'Bank Heat or buy a Furnace rank.'", "blurb: 'Convert Ash and Ignite a Furnace channel during a Sortie.'")
tasks = re.sub(
    r"done: \(s\) =>\n      \(s\.resources\.heat \?\? 0\) > 0 \|\|\n      Object.values\(s\.furnace\?\.ranks \?\? \{\}\)\.some\(\(n\) => \(n \?\? 0\) > 0\),",
    "done: (s) => (s.resources.heat ?? 0) > 0 || s.furnace.ignited,",
    tasks,
    count=1,
)
write('src/game/tasks.ts', tasks)

print('applied PR8 TypeScript teardown cleanup')
'''
p.write_text(text)
print('prepared PR8 TypeScript teardown cleanup')
