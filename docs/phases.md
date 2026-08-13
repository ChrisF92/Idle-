# Cosmic Idle — Implementation Phases

Reference plan for the 100-wave Expedition redesign.  
Source design: uploaded redesign spec. Locked decisions from planning conversations apply.

**Branching:** Each phase branches from the previous phase branch.  
**Save:** Phase 1 introduced save v21 (clean reset). Later phases may bump further when the data model changes.

---

## Phase 1 — Expedition foundation ✅

**Branch:** `cursor/phase1-expedition-arena-706b`

### Scope

- Replace sector/wave model with Sector 1 Expedition waves 1–100 (+ Endless 101+)
- Central orbital-defence arena (radial spawn, targeting, movement)
- Flagship hull and shields
- Push / Pause / Defeat / Manual Extraction
- Base PM calculation (piecewise-linear milestones, +5% Extract bonus)
- Run summary
- Clean save format (v21)
- Deterministic procedural wave packs

### Explicitly out of scope

- Patrol, Directives, Forward Base, full Salvage shop

### Status

Shipped on Phase 1 branch / PR.

---

## Phase 2 — In-run store ✅

**Branch:** `cursor/phase2-in-run-store-706b` (from Phase 1)

### Scope

- Salvage as the only temporary Expedition currency (already earned; now spent)
- Immediate ship-system upgrades (Offence / Defence / Economy / Utility)
- Temporary fitted-module ranks via Salvage (keep / fold existing module level spend)
- Purchase UI on the Combat tab (Upgrades panel)
- Buy 1 / Buy 10 / Max (bulk mode)
- Visible caps and cost curves
- Reset on Extract / Defeat / Prestige (clear upgrade ranks + Salvage)
- Wire upgrade effects into combat stats and rewards
- Save bump to **v22**

### Phase 2 starter unlock set

Available from Expedition start (further unlocks gated later by career wave / Research):

| Category | Upgrades |
|---|---|
| Offence | Weapon Damage, Fire Rate, Boss Damage |
| Defence | Maximum Hull, Maximum Shield, Armour |
| Economy | Salvage per kill, Salvage per wave |
| Utility | Weapon Range |
| Modules | Per-fitted-module temporary ranks (existing Salvage path, shown in store) |

Career-gated in Phase 2:

| Unlock wave | Upgrades |
|---:|---|
| 10 | Critical Chance, Evasion |
| 15 | Critical Damage, Elite Reward |

### Explicitly out of scope

- Forward Base buildings / drones
- Directives
- Patrol
- Pin / AI priority / Salvage reserve (Phase 6+ automation)
- Gunnery Matrix and other building multipliers

### Acceptance

- Player can spend Salvage mid-run and feel stronger immediately
- Caps and next-rank costs are visible
- Extract/Defeat clears Salvage and temporary ranks
- Tests cover purchase, caps, cost curve, combat wiring, reset

---

## Phase 3 — Forward Base ✅

**Branch:** `cursor/phase3-forward-base-706b` (from Phase 2)

### Scope

- Worker deployment capacity (corps-derived; Home Base output unaffected)
- Buildings: Gunnery Matrix, Salvage Relay, Shield Foundry, Repair Dock
- Building panel + drone assignment (Combat tab → Base)
- Short construction / upgrade timers (freeze while Paused)
- Building effects distinct from store (Gunnery scales offensive ranks; Relay Salvage; Foundry defence; Repair Dock between-wave recovery)
- Save bump to **v23**

### Out of scope

- Building evolutions (Phase 5/6 gate)
- Full eight-building endgame set (Reactor / Sensor / Drone Bay / Fabricator later)

### Status

Shipped on Phase 3 branch / PR.

---

## Phase 4 — Directives

**Branches from Phase 3**

### Scope

- Milestone awards (waves 10, 25, 50, 75, 100, Endless +25)
- Three-card selection sheet
- Initial Directive pool (separate names from module/building evolutions)
- Run persistence + Prestige reset
- Optional single Research reroll if already cheap to wire

---

## Phase 5 — Full Sector 1 content

**Branches from Phase 4**

### Scope

- Authored packs for milestone / elite / commander waves
- Wave-100 Entity with phases and telegraphs
- Reward tuning across 1–100
- Keep ordinary waves procedural where useful

---

## Phase 6 — Permanent system replacement

**Branches from Phase 5**

### Scope

- Research overhaul (mechanics unlocks)
- AI refocus (automation / QoL only)
- Mastery → module run-upgrade unlocks
- Essence overhaul (per-family node pages)
- PM shop branches (Fleet / Expedition / Industry)
- Remove Core tab; fold into Forward Base themes
- Fresh save bump if needed

---

## Phase 7 — Endless

**Branches from Phase 6**

### Scope

- Threat cycles (25-wave)
- Endless bosses
- Sector Mastery track
- First-time milestones
- Reward scaling (diminishing PM deep Endless)

---

## Phase 8 — Challenges and post-100

**Branches from Phase 7**

### Scope

- Challenge conversion to 100-wave restrictions
- CP shop without banked bonus
- Signal Cores as permanent post-100 Shipyard equipment
- Ascension content gates
- Offline Expedition automation

---

## Locked cross-phase decisions (do not reopen casually)

- Defeat = full base PM; Extract = base × 1.05
- Store = immediate power; Gunnery Matrix = how offence scales (Phase 3+)
- Module / building / Directive pools stay separate
- Mid-run frame + modules locked after Launch
- Patrol Salvage = 0 (Phase 3+/Patrol)
- Pause freezes all Expedition timers
- Checkpoint skipped waves = 50% PM credit
- Home Base drones not reduced by Expedition deployment
- Piecewise-linear PM interpolation
- Procedural packs Phase 1; authored overrides Phase 5
