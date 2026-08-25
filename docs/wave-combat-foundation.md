# Wave combat foundation (PR1)

Implementation notes for the Act 1 wave-only radial combat runtime. Canonical design remains `docs/act1-canonical-design.md`.

## Wave Reached vs Wave Secured

- **Wave Reached** is the moment that Wave's reinforcement/encounter actually starts. Career Best Wave may update immediately.
- **Wave Secured** is the moment every unit belonging to that Wave package has spawned **and** died. Secure rewards pay exactly once. This can happen after later Waves have already started, and out of numerical order.

Kill rewards still pay on death. Reaching a Wave does not pay the Wave reward.

## Wave-package model

Each reinforcement creates a `WavePackageState` with a stable id, source Wave, kind (`normal` | `commander` | `boss`), spawned unit ids, pending count, and reward flags.

Enemies keep `packageId` + `sourceWave`. Later Waves do not despawn earlier packages.

Commander-candidate Waves (every 10 except 50s) use package kind `commander` so PR7 can attach Commander + escort content without rewriting the scheduler. They remain part of continuous flow.

## Pending threat

`ACTIVE_ENEMY_SOFT_CAP` (55) is the central live-enemy safety limit. Overflow units go into `pendingReinforcements` with the same package identity, Wave, and rewards. A Wave cannot Secure while it still has pending units.

Nothing is despawned, weakened, or auto-killed to relieve pressure.

## Exact Sortie freeze / resume

Closing or reloading freezes live combat. Offline elapsed time advances combat by **0 seconds**. The save schema (`SAVE_VERSION` 42) stores Wave/package/pending state, sim clock, RNG, Hive hull/shield, Core orbit pose, weapon cooldowns, projectiles/beams, and Boss-boundary phase.

Autosave is interval + hide/unload, not every render frame. Old saves with a different version are discarded (no combat migration).

## Boss provider (PR7)

Proper Bosses occur every 50 Waves. The scheduler stops normal reinforcement, waits for backlog to clear, plays a short warning, then starts the encounter (Wave Reached), pauses normal Waves, and resumes after the Boss package Secures. Hive hull/shield are not healed at the boundary.

`setBossProvider` is the production registry hook. Until PR7 authors the catalogue, `developmentBossFallback` is an isolated noncanonical provider so the engine cannot deadlock. Tests should use `setTestBossProvider`.
