from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text()


def write(name: str, text: str) -> None:
    (ROOT / name).write_text(text)


def exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


act1 = read('src/game/balance/act1.ts')
act1 = exact(
    act1,
    "import { ENEMY_DMG_EARLY, ENEMY_HULL_EARLY } from './curves'\n",
    "",
    'remove retired enemy curve import',
)
act1 = exact(
    act1,
    "\nvoid ENEMY_HULL_EARLY\nvoid ENEMY_DMG_EARLY\n",
    "",
    'remove retired enemy curve voids',
)
write('src/game/balance/act1.ts', act1)

commanders = read('src/game/commanders.ts')
commanders = exact(
    commanders,
    "import { fitPackToThreat, packThreat, threatBudgetForWave } from './threatBudget'",
    "import { fitPackToThreat, threatBudgetForWave } from './threatBudget'",
    'remove unused Commander packThreat import',
)
write('src/game/commanders.ts', commanders)

print('PR7 final type cleanup applied')
