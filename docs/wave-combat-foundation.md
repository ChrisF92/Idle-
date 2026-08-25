# Wave combat foundation (PR1)

Implementation notes for the Act 1 wave-only radial combat runtime. Canonical design remains `docs/act1-canonical-design.md`.

## Wave Reached vs Wave Secured

- **Wave Reached** is the moment that Wave's reinforcement/encounter actually starts. Career Best Wave may update immediately.
- **Wave Secured** is the moment every unit belonging to that Wave package has spawned **and** died. Secure rewards pay exactly once. This can happen after later Waves have already started, and out of numerical order.

Kill rewards still pay on death. Reaching a Wave does not pay the Wave reward.

## Wave-package model

Each reinforcement creates a `WavePackageState` with a stable id, source Wave, kind (`normal` | `commander` | `boss`), spawned unit ids, pending count, and reward flags.

Enemies keep `packageId` + `sourceWave`. Later Waves do not despawn earlier packages. Kill salvage, Blueprint/drop eligibility, discovery focus, and weighted drop tables use **`unit.sourceWave`**, not the latest live Wave. Pending units keep that source Wave when released.

After death is detected, kill rewards are paid, and package accounting is safe, the full `CombatUnit` is pruned from `enemyUnits`. Wave Secured still uses package spawned ids + pending counts. Death VFX uses a lightweight FX payload (world position + serialised FX id) plus the battlefield actor fade.

Commander-candidate Waves (every 10 except 50s) use package kind `commander` so PR7 can attach Commander + escort content without rewriting the scheduler. They remain part of continuous flow.

## Deterministic IDs and RNG

Gameplay IDs (units, projectiles, beams, FX, packages) come from serialised `combat.idSeq`, not JS module counters. A new normal Sortie mints a stable `sortieSeed` from persistent `meta.sortieSerial` at launch; that seed is unchanged for the Sortie and survives save/reload. The next Sortie gets a new serial/seed. Tests may inject `combat.sortieSeed` before launch.

Wave/formation scheduling uses an independent stream `hash(sortieSeed, wave, packageOrdinal, FORMATION_CHANNEL)`. Combat/loot RNG is a separate serialised stream. Consuming extra combat rolls must not change a future Wave's formation.

## Pending threat

`ACTIVE_ENEMY_SOFT_CAP` (55) is the central live-enemy safety limit. Overflow units go into `pendingReinforcements` with the same package identity, Wave, and rewards. A Wave cannot Secure while it still has pending units.

Nothing is despawned, weakened, or auto-killed to relieve pressure.

## Exact Sortie freeze / resume

Closing or reloading freezes live combat. Offline elapsed time advances combat by **0 seconds**. The save schema (`SAVE_VERSION` 42) stores Wave/package/pending state, sim clock, RNG, Hive hull/shield, Core orbit pose, weapon cooldowns, projectiles/beams, and Boss-boundary phase.

The simulation clock uses a fixed 1/30s step. `simTime` advances **before** each combat step so reinforcement, cooldowns, and movement all observe the same timestamp. `simulationRate()` is the single future Time Compression hook (PR3); PR1 keeps it at 1×.

Autosave is interval + hide/unload, not every render frame. Old saves with a different version are discarded (no combat migration).

## Boss provider (PR7)

Proper Bosses occur every 50 Waves. The Boss boundary becomes due when that Wave's **normal reinforcement timestamp** is reached — not merely because `nextWave` equals 50. Then the scheduler holds, finishes pre-Boss backlog, plays the provider's authored `warningDuration`, and starts the encounter (Wave Reached). Hive hull/shield are not healed. Provider name/family/tags stay authoritative; generic legacy 2/3–1/3 phase mutation, add spawns, and X-only support aura are not applied. `bossMechanics.ts` is retired rather than kept as a hidden default.

Dynamically spawned package units must go through `admitUnitToPackage` so Secure waits for them.

`setBossProvider` is the production registry hook. Until PR7 authors the catalogue, `developmentBossFallback` is an isolated noncanonical provider so the engine cannot deadlock. Tests should use `setTestBossProvider`.

## Remaining later-system field

`meta.highestSectorEver` is still written as a Wave-scaled mirror of career Best Wave because Foundry, Network, and other later-PR gates still read that key. Combat and Challenges use `bestWave` / this-run `waveReached`. Do not treat career Best Wave as proof that an active Challenge reached its goal.
