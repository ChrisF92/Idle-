from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text += r'''

# PR8 only moves Furnace to W450. Until PR9/PR10 replace their legacy doors,
# Furnace remains the next advertised major door at the old Process/Challenge
# waves. Do not move those later systems forward/backward in this PR.
uia = read('src/game/gdd-ui-ia.test.ts')
uia = uia.replace("expect(nextMajorDoor(processOpen)?.id).toBe('protocols')", "expect(nextMajorDoor(processOpen)?.id).toBe('furnace')")
uia = uia.replace("expect(nextMajorDoor(challengesOpen)?.id).toBe('reinforce')", "expect(nextMajorDoor(challengesOpen)?.id).toBe('furnace')")
uia = uia.replace("expect(systemsHubCards(process).map((c) => c.id)).toEqual(['foundry', 'furnace', 'research', 'process'])", "expect(systemsHubCards(process).map((c) => c.id)).toEqual(['foundry', 'research', 'process'])")
write('src/game/gdd-ui-ia.test.ts', uia)

print('applied PR8 final door ordering assertions')
'''
p.write_text(text)
print('prepared PR8 final door ordering assertions')
