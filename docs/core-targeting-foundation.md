# Core targeting foundation (PR2)

Implementation notes for persistent Core fire-control. Canonical design remains `docs/act1-canonical-design.md`.

## Pipeline

1. Eligible living, targetable enemies inside **Acquisition Range**.
2. Score with the Core's effective Targeting Doctrine.
3. Keep a persistent `currentTargetId` on the physical Core combat unit (same ID as the loadout instance).
4. Discretionary switches require the authored hysteresis / commitment threshold **and** a small absolute score floor.
5. Mechanical **heading** slews toward the target at the effective slew rate.
6. Weapons fire only with a legal firing solution.

`orbitAngle` (ring position) and `heading` (weapon facing) are distinct. Slew uses bearing from the Core's current `(x, y)`, not the Hive origin.

`targetLockTime` accumulates simulated seconds while the same valid Current Target is retained. It starts at 0 on fresh acquisition, resets on switch or loss, and does **not** reset on cooldown, pre-slew, pause, Doctrine change, or a valid Phase connection. PR2 does not spend it on damage; PR4 owns Beam Ramp / Lock Memory.

## Doctrines

IDs: `threat`, `focus`, `execution`, `heavy`, `shield`, `cluster`.

| Core | Default | Allowed |
|---|---|---|
| Pulse Cannon | Threat | Threat, Focus, Execution, Shield |
| Heavy Lance | Heavy | Heavy, Focus, Shield, Threat |
| Flak Array | Cluster | Cluster, Threat, Execution |
| Phase Beam | Focus | Focus, Heavy, Shield |
| Slag Spitter (`slag-spit` until PR4) | Cluster | Cluster, Heavy, Threat |

Focus uses a snapshot of **other** Core commitments and other friendly player shots/beams. A Core cannot vote for its own current target or its own in-flight fire. If nothing else is committed among legal candidates, Focus uses Threat scoring. The snapshot is built once per evaluation pass and is order-independent; target assignments are not mutated while it is built.

Shield prefers meaningfully shielded legal candidates. If none exist, Shield falls back to Threat at candidate-selection time (not a zero-score tie-break).

Execution scores remaining effective durability (current Hull, Shield, and Armor contribution, relative to that enemy's own max durability), with low Hull fraction as a lesser term and a modest Threat tie-break. A 5% Hull target with a huge Shield is not treated as more executable than an exposed low-EHP target.

Cluster uses nearby enemy count, local combined effective durability/mass, true 2D geometry, and a small Threat tie-break. Neighbourhood metrics are computed once per evaluation pass (radius 60).

Boss/Commander status is a scoring factor, never an unconditional override.

## Hysteresis

Replacement needs `bestScore > currentScore + max(4, abs(currentScore) × switchAdvantage)`.

Seeds: Flak 10%, Slag 20%, Pulse 25%, Heavy 45%, Phase 60% idle / 65% while the beam is connected. Invalid/dead targets bypass hysteresis. Heavy charge and an active Phase beam suppress discretionary switches.

Acquire at Acquisition Range; retain a current target until approximately Acquisition × 1.05. New targets never use the retention bonus.

## Acquisition vs Fire Range

`effectiveCoreFireRange` and `effectiveCoreAcquisitionRange` are separate. Modifiers compose as: base → multiplicative/additive → optional `fireRangeCap`. A safety invariant then keeps `Acquisition >= Fire Range × 1.05`. Authored profiles still use their full acquisition values when that gap is already larger.

Knife Fight (`short-range`) currently caps Fire Range at `SHORT_RANGE_MAX` (55) without capping Acquisition, so pre-acquisition/pre-slew still works. Dead Reckoning must be able to cut acquisition independently. Silent Bridge should block `canConfigureTargetingDoctrine` without disabling defaults.

## Mechanical heading

Initial heading is radially outward from the Hive (`heading = orbitAngle`). The first acquisition must slew. Heading is simulation state, saved, and the battlefield faces from it. Presentation must not run an independent ease toward a visual target.

Heavy Lance worst-case traverse at 120°/s is 1.5 seconds for 180°.

## Firing arcs / stabilisation

Pulse / Flak / Slag may fire while traversing if the target is in fire range and inside the authored arc. Heavy Lance and Phase Beam need near-centre aim (4° / 6° seeds). Heavy does **not** pre-charge outside fire range; a completed charge is held until release is legal. Phase beam connection drops if the solution breaks; the target may remain acquired.

Heavy Lance's 2.8s charge is the **base** charge/cycle seed. Effective charge duration is `2.8s × (built weapon cooldown / catalogue module cooldown)`, so Cycle Rate and other cooldown modifiers apply. Charge **is** the cycle; a legal release does not start a second full weapon cooldown.

## Fire-Control Doctrine capability

Stable Research id: `d1-fire-control-doctrine`.

`canConfigureTargetingDoctrine(state)` is false until that id is in `hiveResearch.completedIds` (PR9). Tests may call `enableFireControlDoctrineForTests`. There is no fake user unlock.

`canEditTargetingNow(state)` is true only while Docked, or during an active Sortie that is explicitly PAUSED. Other non-running states are rejected. Research unlock is still required.

Changing Doctrine preserves Current Target, aim, `targetLockTime`, and a valid charge/beam. It sets the next discretionary evaluation to happen promptly. After Resume, the new Doctrine plus hysteresis decides whether to switch. Aim is not teleported. An existing Heavy charge is not cancelled by the Doctrine change itself; normal target-loss still cancels charge.

## Combat Overlay

Presentation only. Modes Off / Selected Core / All Cores. Opening the sheet from a RUNNING Sortie pauses via `sortiePaused`. Closing does not Resume. Selected mode draws acquisition (dashed), fire range, arc, and target line from simulation values. All mode is subdued coverage that still includes a faint firing arc, without target lines or labels. Stationary 44 CSS px Core rows are the reliable selector and include a non-colour SELECTED marker.

The Targeting sheet reuses `CoreDetailReadout` for Doctrine, Fire Range, Acquisition Range, Arc, and Slew.

First meaningful Combat Overlay opening runs the `combat-overlay.ranges` onboarding lesson (existing onboarding architecture, not a separate tutorial). The Sortie stays paused; the player must select a physical Core from the stationary list, then explicitly Resume. Fire-Control Doctrine onboarding is PR9.

## Targeting telemetry

Per physical Core, simulation-time:

- `initialAcquisitions`: no-target → a Current Target. Reacquisition after a loss also increments this (a new lock, not a switch).
- `targetSwitches`: Current Target A → Current Target B without an intervening loss.
- time with no target while enemies exist
- time acquired outside fire range
- slew-limited time
- firing/connected time
- `shotsFired`: discrete fire events (projectile volley or beam connect)
- `shotsHeldIllegalSolution`: one count per ready-but-illegal firing opportunity, not per simulation step
- acquisition delay

Persisted with the live Sortie; reset on a new Sortie.

## Temporary legacy Core fallback (delete in PR4)

Weapon IDs that are not the canonical five use one isolated fallback:

- fire range = catalogue `weapon.range` (else 150)
- acquisition = 1.4× fire range
- Threat, 180° arc, 180°/s slew, 25% commitment

Current IDs on that fallback: `rail-driver`, `ion-burst`, `charge-prism`, `swarm-rack`, `arc-lash`.

## Seed values used

Pulse 170 / 240 / 150° / 360°/s / 25% / fire while traversing.

Heavy 260 / 380 / 100° / 120°/s / 45% / 4° aim / 2.8s base charge / no fire while traversing.

Flak 145 / 210 / 220° / 540°/s / 10% / fire while traversing.

Phase 220 / 310 / 135° / 180°/s / 60% idle, 65% connected / 6° aim / no fire while traversing. Phase idle commitment is higher than Heavy.

Slag 180 / 250 / 175° / 300°/s / 20% / fire while traversing.

Cluster neighbourhood radius 60. Target evaluation interval 0.1s simulated. Hysteresis absolute floor 4.

Combat firing solution uses these targeting-profile fire ranges, not the leftover catalogue `weapon.range` values (Pulse 132, Heavy 152, Flak 125, Phase 148, Slag 128). PR4 owns the final catalogue alignment.
