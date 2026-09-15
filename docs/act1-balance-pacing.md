# Act 1 balance and pacing validation

Live targets are defined in `src/game/balance/act1.ts`; shared curves are in
`src/game/balance/curves.ts`. Simulations start from a fresh save unless the
report states otherwise.

## Canonical opening targets

| Beat | Active-time target |
|---|---:|
| First defeat | 3–5 minutes |
| Foundry | 30 minutes–2 hours |
| Workers | 2–5 hours |
| Wave 100 | 2–4 hours |
| Wave 200 | 6–10 hours |
| First Rebuild | 6–12 hours; Wave 210+ and 3 Sorties |

The simulator reports `PASS` inside the window, `WARNING` inside that target's
explicit tolerance, and `FAIL` outside both. Multi-run reports grade the median,
show P10/P90, and state how many requested runs completed. The detailed body is
the representative first seed, not the batch result.

## September 2026 correction pass

The first post-PR23 batch found four connected faults: the opening progressed
far too quickly, Foundry consumed most Scrap, Workers never grew, and Casual
could deadlock after its first offline session.

The correction pass:

- restores a single exponential enemy hull/shield curve suitable for the
  W1–W1000 career;
- changes secured-Wave Scrap from the old large linear drip to a small stepped
  reward, preventing early Workshop snowballing;
- fixes the pre-Commander tutorial at two staged contacts per Wave so seed RNG
  cannot turn first defeat into either 25 seconds or 4+ minutes;
- spends a bounded number of Workshop and physical-Core purchases per decision;
- reserves the first fabrication slot for the Worker Fabricator and keeps its
  Filament/Recovered Stock inputs supplied until the drone cap is filled;
- resumes a paused Sortie when a Casual session opens after offline catch-up;
- stops first-Rebuild tests at the Rebuild by default instead of silently adding
  a repush window;
- yields periodically during accurate simulations so progress and Cancel events
  can be handled by the browser;
- grades multi-run targets from milestone medians rather than seed 1.

The CI regression run requires the Balanced seed-1 opening to reach the first
Rebuild without any `FAIL` result for Foundry, Workers, Wave 100, Wave 200, or
First Rebuild. Warnings remain visible rather than being disguised as passes.
It also rejects a Scrap category above 85%, requires physical-Core spending,
and verifies that ten deterministic openings defeat inside 3–5 minutes.

## How to run the next validation batch

Use an accurate, milestone-logged, fresh-save batch with five runs and seed 1.
Run Balanced Generalist for Balanced, Casual, and Optimiser player patterns to
First Rebuild. Do not add a repush window for this comparison.

Compare the batch median first. Use P10/P90 to spot instability, then inspect the
representative seed for walls, spending concentration, idle Workers, and safety
stops. A missing first Rebuild in any requested run is a batch failure rather
than a skipped target.

Do not begin build-profile comparisons until those three player-pattern runs
complete without a deadlock or target failure. After that gate, hold the player
pattern at Balanced and compare Economy-first, Offensive, and Defensive build
profiles. This isolates decision cadence/quality from equipment and spending
intent.

## Known scope

Specialists, Capital, and the Task List remain deferred and are not operated by
the simulator. Later Act 1 doors remain `SKIP` in a first-Rebuild run. They need
separate long-run validation after the opening baseline is stable.
