from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()

post = r'''

# --- PR8 post-transform cleanup: remove retired passive/upgrade Furnace consumers. ---

# Process automation is PR9. PR8 must not preserve the old live Furnace manager,
# presets, automatic Ash conversion, or automatic channel lighting.
auto = read('src/game/automation.ts')
auto = auto.replace('  convertAshToHeat,\n', '')
auto = auto.replace('  applyFurnacePreset,\n', '')
auto = auto.replace('  hiveResearchHeatFromAshMult,\n', '')
auto = re.sub(r"^import \{[^\n]*\} from './furnace'\n", '', auto, flags=re.M)
auto = re.sub(r"\nfunction autoFurnacePush\(.*?^\}\n", '\n', auto, count=1, flags=re.S | re.M)
auto = re.sub(r"\nfunction autoFurnaceManager\(.*?^\}\n", '\n', auto, count=1, flags=re.S | re.M)
auto = re.sub(r'^\s*autoFurnacePush\(state\)\n', '', auto, flags=re.M)
auto = re.sub(r'^\s*autoFurnaceManager\(state\)\n', '', auto, flags=re.M)
write('src/game/automation.ts', auto)

# Offline catch-up is industry-only. A live Sortie freezes; Heat and the locked
# Furnace configuration persist unchanged and do not tick or drain.
off = read('src/game/offline.ts')
off = off.replace("import { tickFurnace } from './furnace'\n", '')
off = off.replace("import { hiveResearchHeatFromAshMult, tickResearch } from './hiveResearch'", "import { tickResearch } from './hiveResearch'")
off = re.sub(r'^\s*tickFurnace\([^\n]*\)\n', '', off, flags=re.M)
write('src/game/offline.ts', off)

# The retired abstract Network must not spend Sortie-only Heat or receive a
# Furnace multiplier. Preserve its old racks Scrap path without inventing a
# replacement persistent currency for Furnace-linked links.
net = read('src/game/network.ts')
net = re.sub(r"^import \{[^\n]*(?:FURNACE_UNLOCK_SECTOR|furnaceNetworkMult)[^\n]*\} from './furnace'\n", '', net, flags=re.M)
net = net.replace('      furnaceNetworkMult(state) *\n', '')
net = net.replace('furnaceNetworkMult(state) * ', '')
net = re.sub(
    r"export function networkLinkCost\(\n  state: GameState,\n  id: NetworkLinkId,\n\): \{ resource: 'heat' \| 'scrap'; amount: number \} \| null \{.*?^\}",
    """export function networkLinkCost(\n  state: GameState,\n  id: NetworkLinkId,\n): { resource: 'heat' | 'scrap'; amount: number } | null {\n  const def = getNetworkLink(id)\n  if (!def) return null\n  const rank = networkLinkRank(state, id)\n  if (def.scrapBase) {\n    return { resource: 'scrap', amount: Math.ceil(def.scrapBase * Math.pow(1.4, rank)) }\n  }\n  return null\n}""",
    net,
    count=1,
    flags=re.S | re.M,
)
net = re.sub(
    r"\n  if \(def\.requiresFurnace && careerBestWave\(state\) < FURNACE_UNLOCK_SECTOR\) \{\n    return \{ ok: false, reason: `Furnace · Wave \$\{FURNACE_UNLOCK_SECTOR\}` \}\n  \}",
    '',
    net,
    count=1,
)
# Give the two legacy Heat-only links a stable unavailable state rather than a
# misleading unknown-link error or a hidden Heat sink.
needle = "  const rank = networkLinkRank(state, id)\n  if (rank >= def.maxRank) return { ok: false, reason: 'Maxed' }"
if needle in net:
    net = net.replace(needle, "  const rank = networkLinkRank(state, id)\n  if (def.requiresFurnace && !def.scrapBase) return { ok: false, reason: 'Unavailable in Act 1' }\n  if (rank >= def.maxRank) return { ok: false, reason: 'Maxed' }", 1)
write('src/game/network.ts', net)

# Inspect cards: remove the old upgrade-shop/track vocabulary and render only
# the four canonical one-time Ignite channels.
insp = read('src/game/inspect.ts')
insp = insp.replace('  FurnaceTrackId,\n', '')
insp = insp.replace('  FurnaceUpgradeId,\n', '')
insp = re.sub(
    r"import \{\n  ASH_PER_HEAT,.*?\n\} from './furnace'",
    """import {\n  ASH_PER_HEAT,\n  FURNACE_CHANNEL_IDS,\n  furnaceChannel,\n  furnaceChannelCost,\n  furnaceLevelDef,\n} from './furnace'""",
    insp,
    count=1,
    flags=re.S,
)
insp = re.sub(
    r"export function inspectFurnaceChannel\(state: GameState, id: FurnaceChannelId\): InspectCard \| null \{.*?^\}\n\nexport function inspectFurnaceUpgrade.*?^\}\n\nexport function inspectFurnaceTrack.*?^\}\n",
    """export function inspectFurnaceChannel(state: GameState, id: FurnaceChannelId): InspectCard | null {\n  const def = furnaceChannel(id)\n  if (!def) return null\n  const level = state.furnace.ignited ? state.furnace.channels[id] : 0\n  const live = furnaceLevelDef(id, level)\n  const stats: InspectStat[] = [\n    { label: 'Level', value: level > 0 ? (level === 1 ? 'I' : level === 2 ? 'II' : 'III') : 'Off' },\n    { label: 'Seed', value: live ? `+${Math.round(live.effect * 100)}%` : 'Dark' },\n    { label: 'Ignite cost', value: `${furnaceChannelCost(level > 0 ? level : 1)} Heat` },\n  ]\n  return {\n    title: def.name,\n    kicker: 'Furnace channel',\n    stats,\n    body: [def.blurb, 'Configure before Ignite. Once Ignited, the Furnace is locked for the rest of the Sortie.'],\n  }\n}\n""",
    insp,
    count=1,
    flags=re.S | re.M,
)
insp = re.sub(
    r"export function inspectFurnaceOverview\(state: GameState\): InspectCard \{.*?^\}\n",
    """export function inspectFurnaceOverview(state: GameState): InspectCard {\n  const ash = state.resources.choirAsh ?? 0\n  const heat = state.resources.heat ?? 0\n  return {\n    title: 'Furnace',\n    kicker: state.furnace.ignited ? 'Locked for this Sortie' : 'Configure → Prime → Ignite',\n    stats: [\n      { label: 'Ash', value: formatCompact(ash, 1) },\n      { label: 'Heat', value: formatCompact(heat, 1) },\n      { label: 'Convert', value: `${ASH_PER_HEAT} Ash → 1 Heat` },\n      ...FURNACE_CHANNEL_IDS.map((id) => {\n        const lv = state.furnace.ignited ? state.furnace.channels[id] : 0\n        return { label: furnaceChannel(id).name, value: lv > 0 ? (lv === 1 ? 'I' : lv === 2 ? 'II' : 'III') : 'Off' }\n      }),\n    ],\n    body: [\n      'Furnace unlocks at Wave 450. Ash lasts for the Rebuild cycle; Heat lasts only for the current Sortie.',\n      'Convert Ash to Heat, configure up to two channels, then Ignite once. There is no passive Heat generation or drain.',\n      'Ignite locks the configuration until the Sortie ends. Sortie end clears Heat and the Furnace; Rebuild also clears Ash.',\n    ],\n  }\n}\n""",
    insp,
    count=1,
    flags=re.S | re.M,
)
insp = insp.replace('  for (const ch of furnacePushChannels()) push(inspectFurnaceChannel(state, ch.id))', '  for (const id of FURNACE_CHANNEL_IDS) push(inspectFurnaceChannel(state, id))')
write('src/game/inspect.ts', insp)

# The simulator is later integration work and must not silently automate a PR8
# Configure/Prime/Ignite decision. Keep the callable surface, but make it inert.
sim = read('src/game/simulation/actions.ts')
sim = sim.replace('  convertAshToHeat,\n', '')
sim = re.sub(r"import \{\n  FURNACE_UPGRADES,.*?\n\} from '../furnace'\n", '', sim, count=1, flags=re.S)
sim = re.sub(
    r"export function tendFurnace\(state: GameState, ctx: StrategyContext\): GameState \{.*?^\}\n\nexport function tendHiveResearch",
    """export function tendFurnace(state: GameState, ctx: StrategyContext): GameState {\n  void ctx\n  return state\n}\n\nexport function tendHiveResearch""",
    sim,
    count=1,
    flags=re.S | re.M,
)
write('src/game/simulation/actions.ts', sim)

# Simulator snapshots can observe the new Furnace state without old slot/shop APIs.
bal = read('src/game/balance/act1.ts')
bal = bal.replace("import { furnaceActiveCount, furnaceChannelSlots, furnaceDamageMult } from '../furnace'", "import { furnaceChannelLimit, furnaceDamageMult, furnaceSelectedCount } from '../furnace'")
bal = bal.replace('    furnaceSlots: furnaceChannelSlots(state),', '    furnaceSlots: furnaceChannelLimit(state),')
bal = bal.replace('    furnaceLit: furnaceActiveCount(state),', '    furnaceLit: state.furnace.ignited ? furnaceSelectedCount(state.furnace.channels) : 0,')
write('src/game/balance/act1.ts', bal)

runner = read('src/game/simulation/runner.ts')
runner = runner.replace("furnaceLit: Object.values(state.furnace?.active ?? {}).filter((n) => (n ?? 0) > 0).length,", "furnaceLit: state.furnace.ignited ? Object.values(state.furnace.channels).filter((n) => n > 0).length : 0,")
write('src/game/simulation/runner.ts', runner)

# Straight schema/cadence assertions from older suites follow the breaking PR8
# save and Furnace door. Do not add compatibility code just to keep these stale
# literals green.
for test_path in list(Path('src/game').glob('*.test.ts')) + list(Path('src/game').glob('*.test.tsx')):
    test = test_path.read_text()
    test = test.replace('expect(SAVE_VERSION).toBe(48)', 'expect(SAVE_VERSION).toBe(49)')
    test = test.replace('expect(ACT1_CADENCE.furnace).toBe(140)', 'expect(ACT1_CADENCE.furnace).toBe(450)')
    test = test.replace("toContain('Reach Wave 140')", "toContain('Reach Wave 450')")
    test_path.write_text(test)

print('applied PR8 retired-surface cleanup')
'''

p.write_text(text + post)
print('prepared PR8 retired-surface cleanup')
