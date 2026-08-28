from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text += r'''

# Simulator/playtest fixture must model the canonical Ignited Furnace state.
simtest = read('src/game/gdd-sim-playtest.test.ts')
simtest = simtest.replace(
    "    state.furnace.active = { ...state.furnace.active, weapons: 1 }",
    "    state.furnace = {\n      ignited: true,\n      channels: { overdrive: 1, bulwark: 0, guidance: 0, harvest: 0 },\n      effectStrengthMult: 1,\n    }",
)
write('src/game/gdd-sim-playtest.test.ts', simtest)

print('applied PR8 playtest fixture update')
'''
p.write_text(text)
print('prepared PR8 playtest fixture update')
