# Core targeting foundation (PR2)

Implementation notes for persistent Core fire-control. Canonical design remains `docs/act1-canonical-design.md`.

## Pipeline

1. Eligible living, targetable enemies inside **Acquisition Range**.
2. Score with the Core's effective Targeting Doctrine.
3. Keep a persistent `currentTargetId` on the physical Core combat unit (same ID as the loadout instance).
4. Discretionary switches require the authored hysteresis / commitment threshold.
5. Mechanical **heading** slews toward the target at the effective slew rate.
6. Weapons fire only with a legal firing solution.

`orbitAngle` (ring position) and `heading` (weapon facing) are distinct. Slew uses bearing from the Core's current `(x, y)`, not the Hive origin.

## Doctrines

IDs: `threat`, `focus`, `execution`, `heavy`, `shield`, `cluster`.

| Core | Default | Allowed |
|---|---|---|
| Pulse Cannon | Threat | Threat, Focus, Execution, Shield |
| Heavy Lance | Heavy | Heavy, Focus, Shield, Threat |
| Flak Array | Cluster | Cluster, Threat, Execution |
| Phase Beam | Focus | Focus, Heavy, Shield |
| Slag Spitter (`slag-spit` until PR4) | Cluster | Cluster, Heavy, Threat |

Focus uses a snapshot of other Core commitments (and incoming player shots/beams) so results do not depend on Core processing order. If nothing is committed, Focus uses Threat scoring.

Boss/Commander status is a scoring factor, never an unconditional override.

## Hysteresis

Replacement normally needs ~25% higher score. Seeds: Flak 10%, Slag 20%, Pulse 25%, Heavy 52%, Phase 45% idle / 65% while the beam is connected. Invalid/dead targets bypass hysteresis. Heavy charge and an active Phase beam suppress discretionary switches.

Acquire at Acquisition Range; retain a current target until approximately Acquisition × 1.05. New targets never use the retention bonus.

## Acquisition vs Fire Range

`effectiveCoreFireRange` and `effectiveCoreAcquisitionRange` are separate. PR2 applies identity modifiers only. Later systems (Targeting Servos, Sensor Array, Research, Relics, Directives, Challenges) compose through `collectTargetingModifiers`.

Knife Fight must be able to cap fire range without collapsing acquisition. Dead Reckoning must be able to cut acquisition independently. Silent Bridge should block `canConfigureTargetingDoctrine` without disabling defaults.

## Mechanical heading

Initial heading is radially outward from the Hive (`heading = orbitAngle`). The first acquisition must slew. Heading is simulation state, saved, and the battlefield faces from it. Presentation must not run an independent ease toward a visual target.

Heavy Lance worst-case traverse at 90°/s is about 2 seconds for 180°.

## Firing arcs / stabilisation

Pulse / Flak / Slag may fire while traversing if the target is in fire range and inside the authored arc. Heavy Lance and Phase Beam need near-centre aim (6° / 8° seeds). Heavy does **not** pre-charge outside fire range; a completed charge is held until release is legal. Phase beam connection drops if the solution breaks; the target may remain acquired.

## Fire-Control Doctrine capability

Stable Research id: `d1-fire-control-doctrine`.

`canConfigureTargetingDoctrine(state)` is false until that id is in `hiveResearch.completedIds` (PR9). Tests may call `enableFireControlDoctrineForTests`. There is no fake user unlock. Configuration is allowed Docked or Sortie PAUSED only. Changing Doctrine clears that Core's live target and does not Resume.

## Combat Overlay

Presentation only. Modes Off / Selected Core / All Cores. Opening the sheet from a RUNNING Sortie pauses via `sortiePaused`. Closing does not Resume. Selected mode draws acquisition (dashed), fire range, arc, and target line from simulation values. All mode is subdued coverage. Stationary ~44px Core rows are the reliable selector.

## Targeting telemetry

Per physical Core, simulation-time: target switches, time with no target while enemies exist, time acquired outside fire range, slew-limited time, firing/connected time, shots held for illegal solutions, acquisition delay. Persisted with the live Sortie; reset on a new Sortie.

## Temporary legacy Core fallback (delete in PR4)

Weapon IDs that are not the canonical five use one isolated fallback:

- fire range = catalogue `weapon.range` (else 150)
- acquisition = 1.4× fire range
- Threat, 180° arc, 180°/s slew, 25% commitment

Current IDs on that fallback: `rail-driver`, `ion-burst`, `charge-prism`, `swarm-rack`, `arc-lash`.

## Seed values used

Pulse 170/240/150°/240°/s; Heavy 260/380/100°/90°/s/2.8s charge; Flak 145/210/220°/360°/s; Phase 220/310/135°/150°/s; Slag 180/250/175°/220°/s. Cluster neighbourhood radius 60. Target evaluation interval 0.1s simulated.

Combat firing solution uses these targeting-profile fire ranges, not the leftover catalogue `weapon.range` values (Pulse 132, Heavy 152, Flak 125, Phase 148, Slag 128). PR4 owns the final catalogue alignment.
