from pathlib import Path

p = Path('scripts/pr8_apply.py')
text = p.read_text()
text += r'''

# Final compile cleanup after the behavioral suite is green.

bf = read('src/components/Battlefield.tsx')
bf = bf.replace('p.furnacePush?.weapons', 'p.furnacePush?.overdrive')
bf = bf.replace('p.furnacePush?.ward', 'p.furnacePush?.bulwark')
bf = bf.replace('p.furnacePush?.yield', 'p.furnacePush?.harvest')
write('src/components/Battlefield.tsx', bf)

pt = read('src/components/tabs/ProcessTab.tsx')
old_rule_editor = """      {rule.then.kind === 'furnace-preset' ? (
        <select
          value={rule.then.furnacePreset ?? 'push'}
          onChange={(e) => onChange({ ...rule, then: { ...rule.then, furnacePreset: e.target.value as FurnacePresetId } })}
        >
          {(Object.keys(FURNACE_PRESETS) as FurnacePresetId[]).map((id) => (
            <option key={id} value={id}>
              {FURNACE_PRESETS[id].name}
            </option>
          ))}
        </select>
      ) : null}"""
new_rule_editor = """      {rule.then.kind === 'furnace-preset' ? (
        <p className=\"muted\">Furnace preset automation is unavailable until the Process rewrite.</p>
      ) : null}"""
if old_rule_editor not in pt:
    raise RuntimeError('second legacy Process Furnace preset editor missing')
pt = pt.replace(old_rule_editor, new_rule_editor)
write('src/components/tabs/ProcessTab.tsx', pt)

prog = read('src/game/progression.ts')
prog = prog.replace(
    'Object.values(state.furnace.channels).reduce((a, b) => a + b, 0)',
    'Object.values(state.furnace.channels).reduce<number>((a, b) => a + b, 0)',
)
write('src/game/progression.ts', prog)

print('applied final PR8 compile cleanup')
'''
p.write_text(text)
print('prepared final PR8 compile cleanup')
