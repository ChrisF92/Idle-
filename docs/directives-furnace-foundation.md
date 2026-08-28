# PR8 — Directives and Furnace implementation authority

This document records the approved PR8 implementation addendum for the Act 1 breaking redesign. It supplements, but does not modify, `docs/act1-canonical-design.md`.

Canonical design remains authoritative wherever it already speaks. This document only resolves the previously unauthored gameplay effects for the final Directive catalogue and records PR8 implementation boundaries.

## Scope and boundaries

PR8 owns:

- final Act 1 Directive catalogue and runtime;
- deterministic Directive opportunities/offers;
- Directive combat/economy integration;
- final Act 1 Furnace lifecycle, Ash/Heat conversion, channels and UI;
- wiring Pack Hunter through the neutral PR7 encounter-generation modifier boundary;
- wiring Burn Hot into Furnace channel effect strength;
- deleting/replacing legacy Directive/Furnace architecture that conflicts with the final design.

PR8 must not:

- modify `docs/act1-canonical-design.md`;
- implement PR9 Research/Process progression or new automation semantics;
- implement PR10 Challenges/acquisition rewrites;
- perform PR11 final balance tuning, onboarding/finale integration, or broad balance simulation work;
- reintroduce Sectors, frontier starts, Route A/B, legacy density coupling, or retired Network/Furnace architecture.

Numeric magnitudes below are centralized PR11-tunable seeds. The mechanical identities are approved PR8 design authority.

## Directive opportunities and offer semantics

Use the canonical six opportunities:

- W125
- W275
- W425
- W575
- W725
- W875

At each opportunity:

- offer exactly 3 eligible Directives plus **Continue Unchanged**;
- offers are deterministic from Sortie seed + milestone Wave + current eligible set;
- persist the pending offer so save/reload cannot reroll it;
- no manual reroll exists;
- a Directive can be picked at most once per Sortie and is removed from later eligibility;
- Continue Unchanged consumes the opportunity and adds no Directive;
- the mandatory choice pauses simulation until resolved without clearing backlog, healing, advancing timers, or mutating encounter state;
- Directives reset when the Sortie ends.

Burn Hot is ineligible before Furnace is unlocked. Blueprint Hunt is ineligible when no relevant Blueprint-fragment target remains.

## Final Directive catalogue and approved seed mechanics

### Overcharge

Aggressive raw-power push.

- weapon output ×1.25;
- incoming damage ×1.12.

### Precision Protocol

Direct-hit / critical specialization.

- +10 percentage-point Crit Chance, still subject to the normal global cap;
- Crit Factor ×1.10;
- secondary Explosion / Chain / Fragmentation damage ×0.85.

### Siege Calibration

Anti-heavy / anti-layer specialization.

- direct damage ×1.20 against targets currently protected by Armor or Shield;
- weapon cycle rate ×0.90.

### Focused Fire

Rewards several weapon Cores concentrating on one target.

- each additional weapon Core currently attacking the same target adds +10% direct damage;
- cap the bonus at +30%;
- secondary AoE / Chain damage ×0.80.

This must be computed from real target assignment rather than guessed from weapon count.

### Pack Hunter

Crowd-pressure / secondary-effect build.

- Explosion / Chain / Fragmentation secondary effect strength ×1.20;
- ordinary and Commander-escort encounter threat target ×1.15 through the PR7 encounter modifier provider;
- never increases Commander count, Commander frequency, Boss bodies, or Boss support-node count;
- composition must still be fitted through the controlled PR7 threat-budget machinery rather than naïvely multiplying enemy count;
- extra ordinary enemies use their ordinary intrinsic rewards; there is no separate Pack Hunter reward multiplier.

### Gyro Sync

Mechanical acquisition / slew specialization.

- Core slew ×1.25;
- Acquisition Range ×1.10;
- firing arc +8 degrees where the Core uses a bounded firing arc.

Do not mutate current heading or bypass the PR2 mechanical slew invariant.

### Reactive Array

Large Shield bank at the cost of recovery.

- max Shield ×1.35;
- Shield Regen ×0.75.

### Reinforced Bulkheads

Heavy Hull survival.

- max Hull ×1.35;
- Armor effectiveness ×1.10;
- Core slew ×0.88.

### Regenerative Loop

Recovery specialization.

- Shield Regen ×1.35;
- Hull Repair throughput ×1.35;
- max Hull ×0.80;
- max Shield ×0.80.

### Scavenger Sweep

Resource-farming run.

- Salvage yield ×1.30;
- Scrap generated from eligible Sortie combat sources ×1.30;
- weapon output ×0.88.

Do not apply the Scrap multiplier to Worker production, debug grants, refunds, reconstitution, or other non-combat sources.

### High Tempo

Faster, more dangerous run throughput.

- normal reinforcement interval ×0.85;
- respect the existing centralized minimum/reclaim safeguards;
- do not alter simulation speed, Time Compression, weapon cooldown time, Boss warning duration, Commander Wave frequency, Furnace timing, or persistent industry time;
- no separate reward multiplier.

### Blueprint Hunt

Blueprint-fragment farming.

- Blueprint Fragment Find ×1.50;
- Scrap yield ×0.85.

This accelerates RNG only. It must not create a Blueprint outright, modify guaranteed Blueprint sources, or become required for essential acquisition.

### Burn Hot

Furnace-specialized high-risk push.

- Furnace channel effect strength ×1.20;
- incoming damage ×1.15.

It changes channel effects only. It must not change Ash→Heat conversion, Heat costs, selectable channel count, or bypass Furnace LOCK semantics.

### Auxiliary Overclock

Utility-Core specialization.

- eligible Utility Core effect strength ×1.20;
- weapon Core output ×0.90.

The eligible Utility mapping must be explicit and limited to actual utility semantics, including Salvage Beacon marking/reward effects, Grav Tether control strength, Nano Lathe repair throughput, Sensor Array targeting support, and Choir Tap Ash/Heat interactions where applicable. It must not generically multiply every stat on a Utility Core or directly strengthen Weapon/Defense Cores or Furnace channels.

## Composition rules

Directive effects compose multiplicatively unless an effect is explicitly additive (Crit Chance points, firing-arc degrees, Focused Fire per-attacker bonus).

Use centralized, typed modifier collection rather than scattering `if (hasDirective(...))` branches across unrelated systems. Keep mechanics auditable and independently testable.

Do not restore the retired direct `directiveDensityMult()` dependency in `encounterGenerator.ts`. Pack Hunter should enter through the PR7 identity-default encounter generation modifier/provider boundary.

## Furnace final architecture

Replace the legacy Furnace implementation with the final Act 1 architecture from canonical design.

### Unlock and resources

- unlock at career Best Wave 450;
- Ash is cycle-level and persists between normal Sorties;
- Heat is Sortie-level and resets at Sortie end;
- seed conversion: 10 Ash → 1 Heat;
- no passive Heat generation;
- no passive Heat drain;
- no Heat capacity/cistern mechanic;
- no legacy Furnace rank/upgrade shop;
- no legacy foundry/research/network Furnace channels.

### Lifecycle

Implement the exact player lifecycle:

**CONFIGURE → PRIME → IGNITE → LOCK**

- CONFIGURE: choose the active channel configuration while permitted;
- PRIME: convert/spend Ash into the Heat required for the planned configuration;
- IGNITE: commit the configured Furnace push for the live Sortie;
- LOCK: once Ignited, the configuration cannot be freely edited until the Sortie ends under the canonical rules.

The UI must make the lifecycle and consequences clear before IGNITE.

### Final channels

Exactly four production channels:

- Overdrive
- Bulwark
- Guidance
- Harvest

Two channels are initially selectable at once. Any later increase must come only from canonical/later-system authority, not a retained legacy Extra Tap upgrade.

Use the canonical centralized I/II/III effect and Heat-cost seed tables. Keep those values in one data package so PR11 can tune them without changing mechanics.

Burn Hot multiplies the resulting channel effect strength, not the cost or lifecycle.

## Legacy teardown requirements

Remove or rewrite production dependencies on legacy PR8 concepts, including as applicable:

- W50/every-50 Directive cadence and five-pick cap;
- the old five-Directive catalogue;
- direct Directive density multipliers in encounter generation;
- legacy Furnace W140 gate;
- Weapons / Ward / Yield naming and three-channel-only model;
- network / foundry / research Furnace channels;
- Furnace capacity/cistern;
- passive/idle generation machinery;
- Hearth, Cistern, Flue, Bellows, Extra Tap, Kindling, Ember Lock upgrade shop;
- old Furnace presets/manager behavior owned by legacy Process;
- old sector-named Furnace constants/types where they no longer serve the final Wave-only design;
- compatibility wrappers that preserve retired behavior solely for old tests.

Rewrite tests/consumers to the final architecture rather than retaining shims.

Do not delete PR9-owned Process data merely because it currently references the legacy Furnace. PR8 should neutralize or adapt the integration boundary so PR9 can replace Process deliberately in the next PR without pulling that work forward.

## Required focused verification

PR8 should include focused tests proving at minimum:

1. Directive opportunities occur exactly at W125/275/425/575/725/875 and nowhere else.
2. Offers contain 3 eligible Directives plus Continue Unchanged, persist across save/reload, are seed-deterministic, and cannot reroll.
3. A Directive cannot repeat in one Sortie and Continue Unchanged consumes the opportunity.
4. Directive choice pauses without advancing/clearing combat state.
5. Each of the 14 approved Directive identities modifies the intended mechanical surface, including drawbacks.
6. High Tempo changes reinforcement cadence only, not global simulation/time compression/cooldowns.
7. Pack Hunter feeds controlled threat pressure through the PR7 provider while never creating extra Commanders.
8. Focused Fire derives its bonus from actual same-target attackers and respects its cap.
9. Gyro Sync changes acquisition/slew/arc without teleporting heading.
10. Blueprint Hunt only accelerates eligible fragment RNG and cannot grant/guarantee Blueprints.
11. Furnace is locked before W450 and opens at W450.
12. 10 Ash → 1 Heat; no passive generation, passive drain, or capacity mechanic exists.
13. Furnace exposes exactly Overdrive/Bulwark/Guidance/Harvest with canonical I/II/III costs/effects and initial two-channel configuration limit.
14. CONFIGURE → PRIME → IGNITE → LOCK is enforced through save/reload and Sortie end reset.
15. Burn Hot changes channel effects only, not Heat cost/conversion/channel count/lock state.
16. Ash persists across ordinary Sorties and resets on Rebuild; Heat resets when a Sortie ends.
17. Legacy Furnace upgrade shop/presets/live legacy channels and old Directive W50 behavior are not reachable in production.
18. PR7 encounter/Commander/Boss tests remain green and `encounterGenerator.ts` does not regain direct legacy Directive-density coupling.
19. Save hydration for the new PR8 state is sanitized and deterministic under the current breaking-save policy; increment save version only if the new state shape requires it, with no migration unless canonical explicitly requires one.
20. Mobile UI remains usable in portrait with touch targets and no mandatory hover-only information.

Run and report:

- focused PR8 tests;
- PR7 regression tests relevant to encounters/Commanders/Bosses;
- `npm run lint`;
- `npm test` with exact passed/skipped totals;
- `npm run build`;
- `npm run build:pages`.

## Completion report

Before merge, report:

- exact PR head SHA;
- changed files;
- focused test results;
- full test totals;
- lint/build/build:pages status;
- save-version decision;
- legacy teardown status;
- canonical-design changes: **NONE**;
- PR9/PR10/PR11 work pulled forward: **NONE**.
