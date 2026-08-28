from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text += r'''

# Final PR8 transitional IA assertions: PR9 has not yet moved Research, while
# PR8 moves Furnace to W450. At W170 Furnace is therefore the next major door;
# the W170 Systems hub does not yet contain Furnace.
uia = read('src/game/gdd-ui-ia.test.ts')
uia = uia.replace("expect(nextMajorDoor(afterResearch)?.id).toBe('process')", "expect(nextMajorDoor(afterResearch)?.id).toBe('furnace')")
uia = uia.replace("expect(systemsHubCards(research).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research'])", "expect(systemsHubCards(research).map((c) => c.id)).toEqual(['foundry', 'research'])")
write('src/game/gdd-ui-ia.test.ts', uia)

print('applied final PR8 IA assertions')
'''
p.write_text(text)
print('prepared final PR8 IA assertions')
