# Hostiles, Commanders, Bosses, and Codex (PR7)

Implementation note. Canonical authority remains `docs/act1-canonical-design.md` (unchanged).

## Families

Exact production vocabulary: `swarm`, `armored`, `veil`, `siege`, `choir`, `apex`.

No `ethereal` / `divine` / `titan`. No compatibility aliases.

## 22 hostiles

| ID | Name | First contact | Family | Role | Unique mechanic |
| --- | --- | --- | --- | --- | --- |
| void-mite | Void Mite | 1 | pending | pending | pending |
| needle-skitter | Needle Skitter | 30 | pending | pending | pending |
| brood-splitter | Brood Splitter | 85 | pending | pending | pending |
| carapace-walker | Carapace Walker | 115 | pending | pending | pending |
| cinder-diver | Cinder Diver | 140 | pending | pending | pending |
| phase-wisp | Phase Wisp | 175 | pending | pending | pending |
| bulwark | Bulwark | 190 | pending | pending | pending |
| iron-ram | Iron Ram | 260 | pending | pending | pending |
| veil-sniper | Veil Sniper | 290 | pending | pending | pending |
| mortar-cyst | Mortar Cyst | 325 | pending | pending | pending |
| bastion-husk | Bastion Husk | 365 | pending | pending | pending |
| mirror-shade | Mirror Shade | 395 | pending | pending | pending |
| ashen-chorister | Ashen Chorister | 440 | pending | pending | pending |
| suppressor-node | Suppressor Node | 470 | pending | pending | pending |
| prism-warder | Prism Warder | 515 | pending | pending | pending |
| cantor | Cantor | 565 | pending | pending | pending |
| resonance-vessel | Resonance Vessel | 665 | pending | pending | **authored** death-position hazard |
| reclaimer | Reclaimer | 690 | pending | pending | pending |
| breach-engine | Breach Engine | 740 | pending | pending | **authored** telegraphed partial Shield-bypass spike |
| choir-sentinel | Choir Sentinel | 815 | pending | **authored elite** | pending |
| null-shepherd | Null Shepherd | 865 | pending | pending | pending |
| crowned-husk | Crowned Husk | 935 | pending | **authored elite** | pending |

Runtime fallback for pending combat profiles: isolated `ROLE_NEUTRAL_BASELINE` in `hostileSeeds.ts`. Not Codex-canonical.

## Ordinary encounters

Catalogue whose first-contact Wave ≤ N, first-contact forced at its Wave, threat budget, seven formations (`spear` … `mixed-pressure`), support/disruptor caps (seed 2/2; classification itself pending so currently vacuous), Sortie-seeded formation RNG isolated from combat/loot RNG.

Existing Challenge (`protocolEnemyDensityMult`) and Directive (`directiveDensityMult`) multipliers scale ordinary pack count and Commander escort count only. PR8/PR10 own those systems; PR7 does not invent Challenge rules. Cap seed: `DENSITY_COUNT_MAX = 14`.

## Commanders

Cadence: every 10 Waves except multiples of 50.

W10 pairing: Void Mite + Vanguard, **pending-pairing** (availability-constrained seed; canonical is silent).

Traits: vanguard, ironclad, wardbearer, rallying, displacer, suppressor, volatile, breacher.

Overlap: max 2 living Commanders; further Commander threat is reserved and released unchanged.

Same-type auras: strongest wins, no multiply.

Rewards: Commander unit only (`COMMANDER_REWARD`). Unified kill path. Family-keyed material recovery is skipped while family is pending.

## Bosses

Exactly 20 production identities W50–W1000. Provider: `productionBossProvider`. Non-Crown unique mechanics **pending**. Choir Crown authored: CONVERGENCE → RECONSTRUCTION → LOOPBREAK.

Boss-clear emits typed milestones. PR5 still owns W50–W350 and W500 Blueprint grants. W400+ Relic routes stay `pending-design`. W450 Furnace is a source event only (PR8). W1000 records Act 1 clear; no Reinforce reset / Act 2.

## Codex

HOSTILES | BOSSES. Discovery on actual spawn. Unlock ~W30 with retroactive W1+ records. Save version **48**. No `seenFamilies` migration.

## Seeds (PR11-tunable)

See `src/game/hostileSeeds.ts`: hull 1.011, damage 1.0085, reward 1.0065, Commander 1.4× wave / role-aware promotion, Trait magnitudes, Boss warning 2s / Crown 2.5s, W950 Crown Matrix grant 1, formation dispersion ≤ 0.12.

## Later PRs

PR8 Directives/Furnace. PR9 Research/Process. PR10 Challenges. PR11 balance.
