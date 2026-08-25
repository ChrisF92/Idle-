# Hiveworks — Act 1 Canonical Design v1.0

**Status:** **FROZEN DESIGN BASELINE FOR ACT 1 IMPLEMENTATION**  
**Act 1 target:** Wave 1 → Wave 1000  
**Purpose:** Preserve agreed design so implementation prompts do not depend on chat memory.

> **Implementation authority:** This document plus the final PR prompt is authoritative. Existing legacy code is not authoritative where it conflicts with this design.

> **Breaking-redesign rule:** Hiveworks is pre-release. **No save migration or backwards compatibility is required.** Old saves may be invalidated/reset. **Do not retain deprecated systems, compatibility aliases, migration code, legacy tests, or dead implementation merely to support the old game.** When a system is replaced, remove the obsolete implementation cleanly.

## 1. Core thesis

**The Tower determines the shape of a run. USI determines the shape of the account. Hiveworks connects them through Cores, industry, layered prestige and automation.**

## 2. Locked architecture

- Repeated automatic-combat **Sorties**.
- **Waves only; no Sectors.**
- Every normal Sortie begins at **Wave 1**; no checkpoint/start-wave selector.
- Continuous timed Waves: later Waves can spawn while earlier enemies remain alive.
- Death ends Sortie; earned persistent rewards remain.
- Voluntary Extraction later; safe end plus modest Scrap bonus.
- Live Sortie hides bottom nav completely; outside Sortie nav is **DOCK | SYSTEMS | MORE**.
- Sortie hamburger: Furnace, Targeting, Combat Overlay, Codex, Run Details, Extract as unlocked.
- Hive anchored, slightly below screen centre; enemies attack 360°.
- Cores are autonomous orbiting combat/support units; Worker Drones are industrial workforce.
- No Route A/B, Echo, abstract Network bars, standalone Reliquary, Specialists or Capital in Act 1.
- Yard is folded into Foundry infrastructure.
- Light story; W1000 establishes temporal-loop/Reinforce direction.

## 3. Continuous Waves

- Initial seed: ~7 simulated seconds between normal reinforcement events.
- Wave N+1 can begin before N is cleared.
- **Wave Reached** = reinforcement starts; **Wave Secured** = its package is fully dead.
- Kills reward immediately; Wave rewards pay on Wave Secured.
- Existing enemies persist; backlog accumulates.
- Mobile target roughly 50–60 active simulated enemies; if threatened, delay/consolidate pending threat rather than delete/weaken it.
- Commander event approximately every 10 Waves.
- Proper Boss every 50 Waves; every 100 is a signature milestone.
- Boss pauses normal Wave timer; W1000 requires Boss defeat.
- Later accounts still begin W1; solved content is reclaimed rapidly through power + reclaim/compression.

## 4. Combat vocabulary

Canonical effects: Armor (diminishing returns), Armor Penetration, Shield Bypass, Pierce, Chain, Explosion, bounded Chain Detonation, Fragmentation, Overkill Retarget, Beam Ramp, Mark, Slow, Tether, Execute, Shield Regen, Hull Repair, Temporary Armor, bounded Damage Reduction, Crit.

**Soft counters, never required counters.** Every major enemy problem must have multiple legitimate solutions.

## 5. Radial targeting / geometry

- True 2D: Hive `(0,0)`, real enemy x/y, real Core orbit position, Euclidean range, actual bearing/arc.
- Projectiles/beams originate at physical Core.
- Replace stateless target-per-shot logic with: Doctrine score → persistent current target → hysteresis/commitment → physical slew/firing solution.
- Doctrines: **Threat, Focus, Execution, Heavy, Shield, Cluster**; authored compatibility/defaults per Core.
- Configurable per physical Core after Research **Fire-Control Doctrine**; defaults are competent before unlock.
- **Acquisition Range > Firing Range**; Cores may pre-acquire/pre-slew before firing range, but no fire until legal. Heavy Lance does not pre-charge by default.
- Each Core authors Orbit radius/class, Slew Rate, Firing Arc, fire-while-traversing, stabilisation and target-loss behaviour.
- Combat Overlay modes: Off / Selected / All. Moving-Core taps optional only; stationary 44px+ Core list is the reliable selector. Same selector pattern is reused in Targeting.

## 6. Frames

All slots are universal; Frames bias builds without typed-slot prohibitions.

- **Standard:** balanced, modest targeting responsiveness, valid W1000 choice.
- **Bastion:** Hull/Shield/defensive identity; lower offensive efficiency/heavier feel.
- **Swarm:** only Act 1 Frame with 6 Cores; weaker Hive and reduced per-Core output.
- **Reactor:** better Ash→Heat efficiency and Furnace output; fragile baseline; no extra Furnace channel count.
- **Harvester:** combat-economy identity (Salvage/Scrap/Ash); lower frontier combat; no offline Foundry exploit.

Core-slot progression: start 2 → early 3 → mid 4 → late 5; Swarm max 6.

## 7. Core progression model

- Every fabricated Core is a stable physical instance.
- Each physical copy has its own Scrap-funded **Core Level**, reset by Rebuild.
- No Salvage-funded temporary Core purchases in Sortie.
- Permanent use-driven **Mastery is shared by Core type**.
- Duplicate Cores share Mastery but have separate Core Levels, Relics and Targeting Doctrine.
- Mastery milestones: M5 identity/stat, M10 behaviour, M20 socket, M30 significant behaviour, M50 defining evolution, M75 advanced unique synergy, M100 unique capstone.

## 8. Final 14 Cores

### Weapons

**Pulse Cannon** — rapid adaptive generalist. Default Threat; Threat/Focus/Execution/Shield; medium commitment; medium fire range, long acquisition, fast slew, ~150° arc, fires while moving. M10 overkill retarget; M30 periodic chain; M50 bounded chain continuation; M75 adaptive lock; M100 periodic bounded Convergence fork/chain.

**Heavy Lance** — slow line-breaking anti-heavy. Default Heavy; Heavy/Focus/Shield/Threat; very high commitment; long fire, very long acquisition, slow slew, ~100° arc, stabilises for charge/fire. M10 predictive traverse; M30 Pierce; M50 Shield bypass; M75 penetration momentum; M100 Armor fracture for whole Hive.

**Flak Array** — backlog-control specialist. Default Cluster; Cluster/Threat/Execution; short fire, medium acquisition, very fast slew, ~220° arc. M10 pack prediction; M30 Fragmentation; M50 bounded death detonation; M75 Saturation; M100 Kill Box airburst.

**Phase Beam** — sustained single-target anchor. Default Focus; Focus/Heavy/Shield; extreme commitment; medium-long fire, long acquisition, medium slew, ~135° arc; slows/stabilises while firing. M10 Ramp; M30 Refraction; M50 ramping Shield bypass; M75 partial lock-memory; M100 max-ramp Exposure.

**Slag Spitter** — persistent area denial / Armor degradation. Default Cluster; Cluster/Heavy/Threat; medium-short fire, medium acquisition, fast slew, ~175°. Base impact + Slag/Burn. M30 Molten Pool; M50 corrosion lowers effective Armor; M75 bounded spread; M100 capped pool merging.

### Defense

**Plate Layer** — big predictable Shield bank. Later impact bracing, bypass protection, Shield-break temporary Armor, recovery replate, M100 Citadel Skin.

**Rapid Aegis** — Shield recovery specialist. Regen ramp, small-hit resilience, break recovery, overflow buffer, M100 Perpetual Aegis recovery loop.

**Ablative Mesh** — Hull/Armor/spike survival. Periodic ablative layer, spike-specialised mitigation, temporary Armor after layer use, regrowth, M100 bounded damage deferral rather than immunity.

**Barrier Projector** — reactive emergency defense. Shield-break slow pulse, low-Hull emergency barrier, long-cooldown lethal intercept, stabilisation, M100 weaker re-arm after successful recovery.

### Utility / economy / control

**Salvage Beacon** — visible marks; marked kills pay extra Salvage. Default Execution (Heavy option). Elite/Commander bounty, deterministic cache, later two marks and group sweep.

**Grav Tether** — control/formation. Default Threat; Threat/Heavy/Cluster; medium fire, long acquisition, fast slew, wide arc. Slow, drag field, twin tether, mass bias, M100 bounded gravity well.

**Nano Lathe** — in-combat Hull repair. Triage at low Hull, active combat repair, excess repair→temporary Armor, later Shield crossfeed, critical repair burst.

**Sensor Array** — targeting support. Improves acquisition/slew. Shared tracks for pre-slew, predictive solution, overkill forecasting, M100 Fire-Control Network.

**Choir Tap** — Ash/Furnace economy. Better Ash, Commander/Boss resonance, Heat interaction, non-swap-exploitable Furnace feed, resonant marking, deterministic Boss harvest.

## 9. Relics

Rules: physical per-Core fitting, typed sockets **Power / Optical / Ballistic / Shield / Industrial / Universal**, free Docked reassignment, no destruction, authored effects, I→II→III, max **one Behavioural Relic per physical Core**, no Catalyst system.

Behavioural families: Overcharge Capacitor, Prismatic Lens, Focusing Array, Phase Needle, Fixed Mount, Shatter Mesh, Penetrator Guide, Aegis Relay, Salvage Matrix, Gravity Lens, Nanite Reservoir, Shield Crossfeed, Predictive Bus, Resonance Tap.

Standard families: Power Coupler, Tracking Gimbal, Ballistic Jacket, Reinforcement Plate, Industrial Optimiser, Universal Resonator.

Behavioural tiers: I introduces behaviour; II improves usability/reduces drawback; III adds synergy/evolution. Standard tiers mainly increase magnitude.

## 10. Generic upgrades

Permanent one-time Scrap unlock chain per category. Unlock survives Rebuild and exposes upgrade in Workshop + Sortie; level does not survive Rebuild. Category progress independent. Most are not Best-Wave gated.

**Attack:** Weapon Power → Cycle Rate → Critical Chance → Critical Factor → Armor Penetration → Targeting Servos.

**Defense:** Hull → Shield Capacity → Shield Regeneration → Armor → Repair Rate → Damage Control.

**Economy:** Salvage/Kill → Salvage/Wave → Scrap/Kill → Scrap/Wave → Fragment Find → Ash Recovery (requires Furnace).

Wave economy pays on Wave Secured. Do not force all stats into one 80-level cap/cost curve; use curve families. Temporary Sortie cost uses only Sortie-purchase counter, not Workshop starting level.

## 11. Enemy roster

Families: Swarm, Armored, Veil, Siege, Choir, Apex.

First-contact seed Waves:
1 Void Mite; 30 Needle Skitter; 85 Brood Splitter; 115 Carapace Walker; 140 Cinder Diver; 175 Phase Wisp; 190 Bulwark; 260 Iron Ram; 290 Veil Sniper; 325 Mortar Cyst; 365 Bastion Husk; 395 Mirror Shade; 440 Ashen Chorister; 470 Suppressor Node; 515 Prism Warder; 565 Cantor; 665 Resonance Vessel; 690 Reclaimer; 740 Breach Engine; 815 Choir Sentinel; 865 Null Shepherd; 935 Crowned Husk.

Controlled formation templates: Spear, Pincer, Encirclement, Screen, Siege, Swarm Burst, Mixed Pressure. Support/disruptor density caps. Angular dispersion participates in threat budget.

Codex derives from enemy definitions; sections HOSTILES | BOSSES; discovery on actual first spawn; relative profiles and soft counters, no future spoilers/raw scaling numbers.

## 12. Boss spine

50 Pack Tyrant I — Foundry + Flak discovery. 100 Broodheart Matriarch — Heavy Lance. 150 Iron Behemoth I — Grav Tether. 200 Iron Regent — Slag Spitter. 250 Veil Seer I — Phase Beam. 300 Veil Architect — Sensor Array. 350 Siege Node I — Barrier Projector. 400 Bastion Engine — Aegis Relay. 450 Choir Exarch I — **Furnace unlock**. 500 Ember Cantor — Reactor Frame route / Choir Tap progression. 550 Pack Tyrant II — Prismatic Lens route. 600 Canticle Engine — Phase Needle. 650 Iron Behemoth II — Penetrator Guide. 700 Reclaimer Leviathan — Salvage Matrix. 750 Veil Seer II — advanced resources. 800 Null Battery — Fixed Mount. 850 Siege Node II — Universal Resonator. 900 Crown Shepherd — Crown Signal/finale location. 950 Choir Exarch II — Crown Matrix/finale materials. 1000 **Choir Crown**.

Choir Crown phases: CONVERGENCE (Shield + familiar family echoes), RECONSTRUCTION (Armor + slam + shell support nodes), LOOPBREAK (brief telegraphed Core jams, mixed fronts, rising final pressure, no giant regen). Defeat unlocks Reinforce + Hollow Choir and gives light temporal-anomaly setup.

## 13. Directives

Milestones: **W125, 275, 425, 575, 725, 875**. Offer 3 eligible + Continue Unchanged; deterministic by run seed; no reroll; resets at Sortie end.

Final 14: Overcharge, Precision Protocol, Siege Calibration, Focused Fire, Pack Hunter, Gyro Sync, Reactive Array, Reinforced Bulkheads, Regenerative Loop, Scavenger Sweep, High Tempo, Blueprint Hunt, Burn Hot, Auxiliary Overclock.

Late Process may use an ordered Directive Preference list; no rerolls.

## 14. Research

Unlock target **W525**. Permanent timed/offline; Worker accelerated; initially one active; no combat Data currency. Four branches, 10 nodes each; branches are priority choices, not exclusive permanent forks.

**Hive Engineering:** Cycle Engineering; Workshop Tooling; Thermal Conduits; Core Priming; Frame Calibration; Workshop Template; Reclaim Routing; Thermal Recovery; Cycle Memory; Reconstruction Accelerator.

**Drone Systems:** Fire-Control Doctrine; Gyroscopic Calibration; Predictive Acquisition; Worker Calibration; Drone Racks; Fabrication Assistants; Salvage Coordination; Auxiliary Interfaces; Doctrine Memory; Fire-Control Profiles.

**Industrial Science:** Second Processor; Fabrication Machinery; Relic Tempering (Tier II); Pattern Recovery; Material Yield; Worker Jigs; Duplicate Tooling; Masterwork Tempering (Tier III); Parallel Fabrication; Pattern Archive.

**Computational Systems:** Queue Buffer; Combat Telemetry; Deep Queue; **Process Kernel**; Pressure Analysis; Comparative Inspect; Profile Memory; Parallel Analysis; Systems Overview; Failure Analysis.

No Research combat-speed multiplier; Time Compression is canonical speed progression.

## 15. Challenges

Fresh W1 alternate Sorties; account applies unless restricted; no entry currency; death ends attempt but earned persistent rewards remain; does not trigger/consume Rebuild. Unique first-clear rewards; repeated play uses medal targets/Challenge Points/materials rather than stacking generic damage repeatedly.

1 Glass Frame — target 450; Hull -50%; Ablative Mesh. 2 Knife Fight — 500; short fire-range cap; Tracking Gimbal. 3 Bare Hive — 550; no Utility Cores; Gravity Lens. 4 Single Pattern — 600; all weapon Cores same type; Swarm Frame. 5 Attrition — 650; active Hull repair disabled; Nanite Reservoir. 6 Pressure Front — 700; faster Waves; Shatter Mesh. 7 Silent Bridge — after Fire-Control Doctrine; 725; manual Doctrines disabled, defaults remain; Predictive Bus. 8 Dead Reckoning — 800; Sensor effects off + reduced acquisition; Focusing Array. 9 Cold Furnace — 850; Furnace cannot Ignite; Harvester Frame. 10 Hollow Choir — after W1000; target 1000; Furnace off, Directives off, Hull -25%, modest faster Waves; Loopbreaker + prestige cosmetic.

Process always respects restrictions and visibly reports `DISABLED BY CHALLENGE`.

## 16. Foundry

Panes: **PROCESSING | FABRICATION | MASTERY | BLUEPRINTS**. Permanent/offline.

12 materials: Recovered Stock, Conductive Filament, Tempered Alloy, Ballistic Composite, Optical Glass, Shield Lattice, Control Mesh, Phase Crystal, Nanite Compound, Resonant Ceramic, Thermal Conductor, Crown Matrix.

Material Mastery M0→M5, not 100 recipe levels. Processing cycles grant material-specific XP. Advanced recipes use logical prerequisite materials/Mastery/Research rather than widespread Best-Wave gates.

Blueprint states: UNKNOWN / FRAGMENTED / DISCOVERED / OWNED. Blueprint-specific schematic fragments, e.g. Heavy Lance 2/5; no casing/core/lens parts. Guaranteed source completes Blueprint regardless of fragment count. RNG can accelerate early discovery; completed Blueprint fragments stop dropping. Blueprint discovery does not grant item; item must be fabricated.

Core sources: Pulse+Plate starter; Flak W50; Salvage Beacon early Material Mastery; Heavy Lance W100; Rapid Aegis Shield-Lattice mastery; Grav Tether W150; Slag W200; Nano Lathe advanced Foundry; Phase Beam W250; Sensor W300; Barrier W350; Ablative Mesh Challenge; Choir Tap Resonant/Furnace progression.

Frame sources: Standard starter; Bastion Tempered Alloy mastery ~225–250; Reactor W500; Swarm Single Pattern; Harvester Cold Furnace.

Relic Tier I from Blueprint; II requires Relic Tempering; III requires Masterwork Tempering. Upgrades transform the physical Relic.

Infrastructure compact set: Processing Line, Fabrication Bay, Worker Fabricator, Research Annex, Recovery Storage.

## 17. Furnace

Unlock W450. Ash = Rebuild-cycle; Heat = Sortie. Seed 10 Ash→1 Heat. No passive Heat gen, no drain, no Heat capacity.

Lifecycle **CONFIGURE → PRIME → IGNITE → LOCK**. Primed = UI draft/reservation only, editable/refundable, discarded if sheet closes. Ignited = consumed and immutable until Sortie end, persisted through reload.

Four channels OFF/I/II/III: **Overdrive** (weapon offense), **Bulwark** (Hull/Shield + modest late protection), **Guidance** (slew/acquisition/arc), **Harvest** (Salvage/Scrap + late modest Fragment Find; never Ash).

Initial max selected channels 2; late Engineering max 3; never all 4 in Act 1. No standalone Furnace upgrade shop. Reactor improves conversion/channel strength but no extra channel. Burn Hot boosts channel strength at incoming-damage cost.

## 18. W1→W1000 timeline

W1 fresh Sortie, Standard+Pulse+Plate, 2 slots. First death teaches Workshop. W30 Codex. W50 Foundry+Flak. W75 3rd slot. ~W90 Salvage Beacon. W100 Heavy Lance. ~W110 Worker Drones. W125 Directive 1. ~W140 Rapid Aegis. W150 Grav Tether. W175 Phase Wisp. W190 Bulwark. W200 Slag. ~W210 Rebuild. ~225–250 Bastion Frame. W250 Beam. W275 Directive 2. W300 Sensor. ~W320 Relics Tier I. ~W330 4th slot. W350 Barrier. ~W375 Challenges. W400 Aegis Relay. W425 Directive 3. W450 Furnace. W500 Reactor/Choir Tap progression. W525 Research. W550 Prismatic route. W575 Directive 4. W600 Phase Needle. ~600–700 5th normal slot via Engineering+Foundry. ~625+ Tier II possible, typical 650–725. Process typically ~650–750 depending Research. W650 Penetrator Guide. W700 Salvage Matrix. W725 Directive 5. W800 Fixed Mount. ~800+ Tier III possible, typical 825–900. W850 Universal Resonator. W875 Directive 6. W900 Crown Signal. W950 Crown Matrix/finale materials. W1000 Choir Crown → Reinforce/Hollow Choir.

Pacing targets cumulative active-equivalent: W100 2–4h; W200 6–10h; W300 12–18h; W400 20–28h; W500 30–40h; W600 42–54h; W700 52–66h; W800 62–78h; W900 72–90h; W1000 80–100h.

## 19. Reset hierarchy

Sortie resets Salvage, temporary generic upgrades, Directives, Heat, Furnace state, temporary buffs. Rebuild resets those plus Scrap, Workshop starting levels, physical Core Levels, Ash and designated cycle infra. Permanent: Matter, Best Wave/unlocks, Frames, Core ownership/type Mastery, Relics, Blueprints, Research, Foundry+Material Mastery, Process, Challenges/stats. Permanent generic upgrade unlock purchases survive Rebuild. Matter is based on cycle achievement/development, not unspent Scrap. Rebuild old-best recovery target ~20–40% original time.

## 20. Persistence/offline

Closing/reloading freezes active Sortie exactly. No offline combat. Save Wave/timer/pending reinforcements/enemies/status/positions/RNG/Hive state/Core angles+targets+cooldowns+beam/charge/temp upgrades/Salvage/Directives/Furnace/Heat/Challenge/Time Compression/temp effects. Reload cannot delete, reset, heal, reroll, refund or duplicate. Foundry and Research continue offline.

## 21. Process v1.0

**Principle: automate decisions the player has already learned.** Unlocked by Computational Research **Process Kernel**, typically ~W650–750. UI: **CAPABILITIES | AUTOMATIONS | RULES | PROFILES**. Process Points are permanent achievement-derived capability points; exact costs tuned later; Act 1 tree is eventually completable.

Process MAY automate: temporary Salvage purchases, Worker assignment/presets, repetitive Processing/stock targets, explicit Research continuation/preferences, saved Furnace one-time Ignite, late Directive preference, late conditional Extraction, foreground-only repeat launch, profile loading.

Process MUST NOT: buy permanent generic unlocks; spend Scrap on Workshop/Core Levels; invent first-time Core/Frame/behavioural-Relic fabrication; modify Ignited Furnace; dynamically swap equipment/Relics; bypass Challenges; perform offline Sorties; conditionally spam Targeting Doctrine changes in Act 1.

Capability progression:
- QoL/execution: Bulk Purchase, Buy Max, Live Readouts, Worker Presets, Processing Repeat.
- Basic automation: Sortie Auto-Buy; Spend Profiles (Attack/Defense/Economy + Salvage reserve); Worker Auto-Fill; Material Stock Targets; Research Queue Assist; Furnace Presets.
- Priorities: Upgrade Priorities; Worker Weights; Dependency Processing; Research Preference; Ash Budgeting.
- Rules: Rule Builder; AND; OR; Extra Rule Slots; Condition Complexity; Profiles.
- Late cross-system: Furnace Auto-Ignite; Directive Preference; Auto Extract; Profile Triggers; foreground-only Repeat Sortie; Challenge Profile.

Sortie auto-buy spends **Salvage only** on already-unlocked temporary upgrades. No automated Scrap investment.

Foundry automation may repeat explicit Processing, maintain floors and process prerequisites toward explicit targets. It does not decide the player needs a new unique item.

Research queue itself handles explicit queued projects; Process can later continue a selected visible branch/preference after explicit queue exhaustion, never hidden nodes.

Furnace automation may use saved preset + max Ash budget + one-time trigger. Once Ignite occurs Process can never change it.

Directive automation uses ordered preferences and chooses highest preferred offered option; otherwise Continue Unchanged; no reroll.

Rule builder uses mobile chips, not code. Conditions may include Wave threshold, Boss active, backlog, Hull%, Shield%, Salvage, Heat, Challenge active, run-purpose/profile. Actions may switch spend/Worker/processing automation profiles, Ignite Furnace once, Extract, or switch Process automation profile. No arbitrary scripting/per-frame logic.

Process Profile stores automation state, not physical build: spend settings, Worker preset, Processing targets, Research preference, Furnace preset/budget/trigger, Directive preference, Extraction condition, enabled rules. Examples PUSH / FARM / BLUEPRINT / CHALLENGE / CUSTOM. Targeting profile may be loaded once at Sortie start, but no dynamic Doctrine flipping.

Repeat Sortie is late Act 1, foreground-only, disabled by default, reuses current explicit loadout/profile and never creates offline combat.

## 22. UI/onboarding principles

Onboarding: **explain one concept → require one action → show visible numerical payoff → finish**. Fresh W1 active; first Salvage pauses/highlights Weapon Power; first death Result→Dock→Workshop→manual second launch. Every rewritten/new system gets detailed but focused onboarding. Tactical Furnace/Targeting sheets pause combat. Mobile target 360–430px widths.

## 23. Simulation

Track single-target DPS, swarm clear, average/peak backlog, secure lag, Boss TTK, Shield/Armor performance, survival, resources, Core/Relic contribution, target switches, acquisition delay, Slew downtime, overkill waste, build usage, Scrap allocation, passive Scrap share, Rebuild cadence. Flag dominance/dead content/hard walls/steamroll/backlog walls/economy traps/Directive exploits. First run ~3–5m; ordinary later runs ~15–30m, exceptional ~30–40m. Passive Worker Scrap target roughly 10–20% of comparable active/hour; >20–25% flagged. Shared Scrap allocation should not have one universal >85%-optimal sink.

---

# 26. Rebuild, Matter and Time Compression — Canonical Design v1.0

## 26.1 Rebuild purpose

Rebuild is the first true prestige layer. It should answer:

> **How much short-term cycle power am I willing to erase in exchange for permanent account development?**

Rebuild becomes relevant around **W210**, after the player has already learned Sorties, Workshop, Foundry, Workers, several Cores and persistent industrial progression.

Rebuild is **not** a mandatory automatic reset at a fixed Wave. Once unlocked, the player chooses when the current cycle is worth cashing in.

## 26.2 Availability

First Rebuild:
- career Best Wave approximately W210 or higher,
- player must be Docked,
- no active Challenge,
- at least several completed normal Sorties before the first Rebuild (seed target: 3) so the player has actually experienced the cycle economy.

Subsequent Rebuilds:
- player must be Docked,
- no active Challenge,
- at least one completed Sortie in the current Rebuild cycle,
- projected Matter gain must be positive.

Do not require another arbitrary Best-Wave door after the system is learned.

Process does **not** automatically Rebuild in Act 1.

## 26.3 Rebuild resets

Rebuild resets:
- active Sortie and all Sortie-only state,
- Salvage,
- temporary generic Sortie upgrades,
- Directives,
- Heat,
- Furnace configuration/ignition,
- Scrap,
- Workshop cycle levels,
- physical Core Levels,
- Ash.

Rebuild does **not** reset:
- Matter,
- career Best Wave / discovered progression,
- physical Core ownership,
- shared Core-type Mastery,
- Frames,
- Relics,
- Blueprint knowledge/fragments,
- Foundry materials,
- Material Mastery,
- Foundry infrastructure,
- Worker Drone ownership/capacity,
- Research progress/completions,
- Process,
- Challenge progress/rewards,
- Codex,
- permanent generic upgrade unlocks.

**Worker Drones are permanent physical workforce in Act 1.** Rebuild does not destroy/remanufacture the existing workforce. Worker capacity can grow through Foundry/Research/Matter and newly available capacity can be filled by fabrication.

Active Foundry/Research jobs continue through Rebuild without losing progress.

## 26.4 Matter gain

Matter payout is based on **what the cycle achieved**, never on how much Scrap happens to be sitting unspent at the moment of Rebuild.

The final formula must have:
- **Cycle Best Wave as the dominant term**.
- **Total Scrap generated during the cycle as a secondary diminishing-return term**.
- No direct reward for simply owning unspent Scrap.
- No direct reward for number of Rebuilds/repeat count.
- No linear “+1 Matter per Workshop rank” behaviour that makes buying cheap ranks solely for prestige payout optimal.
- No incentive to repeatedly perform tiny low-value Rebuilds.

Balance seed formula:

`waveScore = floor((cycleBestWave / 25) ^ 1.25)`

`scrapScore = min(floor(sqrt(cycleScrapGenerated / 250)), floor(waveScore * 0.30))`

`Matter gain = max(1, waveScore + scrapScore)`

The constants/exponents are **simulation seeds, not locked numeric balance**.

Intent:
- first sensible W210-ish Rebuild yields roughly enough Matter to purchase several early permanent improvements,
- higher frontier cycles are dominated by the Wave term,
- farm cycles still gain some Matter through Scrap generation,
- Scrap farming cannot outperform genuine frontier development indefinitely.

The Rebuild confirmation sheet must show the projected payout and a simple breakdown such as:

`Cycle Best W238     +16`
`Scrap generated     +4`
`Matter gained       20`

Do not expose the raw mathematical formula unless an advanced Inspect/telemetry feature later warrants it.

## 26.5 Matter shop identity

Matter purchases are **permanent account progression**. Matter does not become another giant specialist tree.

Use five visual categories:
- **Offensive**
- **Defensive**
- **Industrial**
- **Foundation**
- **Temporal**

The shop should mix modest rankable permanent improvements with a small number of high-value one-time unlocks.

The exact numeric effects/costs remain balance seeds until simulation.

### Offensive

#### Weapon Calibration
- Rankable, seed max 5.
- Modest permanent weapon-Core output increase.
- Seed magnitude: roughly +4% per rank.
- Must remain modest enough that Cores/Relics/Workshop still define builds.

#### Traverse Actuators
- Rankable, seed max 4.
- Modest permanent weapon-Core Slew improvement.
- Does not increase targeting intelligence or Acquisition Range.

### Defensive

#### Structural Memory
- Rankable, seed max 5.
- Modest permanent maximum Hull increase.

#### Field Memory
- Rankable, seed max 5.
- Modest permanent maximum Shield increase.

### Industrial

#### Recovery Charter
- Rankable, seed max 5.
- Modest permanent combat Scrap gain improvement.
- Does not improve Salvage or Ash.

#### Foundry Throughput
- Rankable, seed max 5.
- Modest Processing + Fabrication speed improvement.
- Does not depend on equipped Frame/Relics.

#### Worker Racks
- Rankable, seed max 4.
- +1 permanent Worker Drone capacity per rank.
- Capacity increase does not instantly fabricate the Worker; the player still builds new Workers through the Worker Fabricator.

### Foundation

#### Reconstitution Cache
- Rankable, seed max 5.
- Grants a small starting **Scrap cache after each Rebuild**.
- Intended to shorten repetitive early cycle setup, not replace active Scrap generation.

#### Sortie Provisioning
- Rankable, seed max 5.
- Grants a small starting **Salvage cache at the start of each normal Sortie**.
- Challenge rules may suppress or scale this if required.
- Intended to reduce repeated first-minute clicking while remaining small relative to a mature run economy.

### Temporal

#### Time Compression I
- One-time.
- Unlocks **1.5×** combat simulation speed.

#### Time Compression II
- One-time.
- Requires Time Compression I.
- Unlocks **2×**.

#### Time Compression III
- One-time.
- Requires Time Compression II.
- Unlocks **3×**.

No other permanent system in Act 1 grants a separate general combat-speed multiplier.

Seed cost philosophy:
- Compression I should be affordable from or shortly after the first sensible Rebuild.
- Compression II is a meaningful mid-Act permanent purchase.
- Compression III is a substantial late-Act investment.
- Exact Matter prices are simulation values, not design-locked.

Matter shop has no permanent “Matter gain multiplier” in Act 1; avoid prestige-currency snowball loops.

## 26.6 Time Compression semantics

Time Compression is the **single canonical player-facing combat simulation-speed track**.

Unlocked options:
- 1×
- 1.5×
- 2×
- 3×

Player may select any unlocked speed during a live normal Sortie or Challenge.

Persist the player’s preferred speed account-wide and start future Sorties at that preference unless a tutorial/Challenge explicitly overrides it.

Compression speeds the **simulation clock consistently**, including:
- reinforcement timers,
- enemy movement,
- Core movement/slew,
- weapon cooldowns,
- projectiles,
- Beam Ramp,
- status durations,
- enemy attack timing,
- Boss mechanics/telegraphs,
- all other simulation-time combat systems.

It does **not** speed:
- Foundry real-time jobs,
- Research real-time projects,
- offline elapsed time,
- UI animation that is intentionally independent of simulation.

Implementation must use stable/fixed-step or appropriately sub-stepped simulation so higher speed does not materially change combat outcome, DPS, hit probability, targeting behaviour or reward generation.

Boss telegraphs must be authored with enough simulation duration to remain readable at 3× on a phone rather than secretly slowing the simulation or changing player power.

## 26.7 Reclaim versus Time Compression

Do not create a second general speed system.

**Time Compression** = global player-selectable simulation speed.

**Reclaim Routing / Reconstruction Accelerator Research** = safe reduction of otherwise-empty inter-Wave downtime on content the account has already proven, not a second combat-speed multiplier.

Reclaim acceleration may:
- shorten/batch reinforcement waiting on deeply solved Waves,
- only operate well below the player’s established career frontier,
- automatically back off when backlog/damage indicates the content is no longer trivial,
- never skip Waves,
- never grant rewards for unspawned enemies,
- never despawn enemies,
- never alter Boss results.

All enemies/rewards from W1 onward still occur.

This keeps the promise that every Sortie starts W1 while preventing late-Act accounts from watching many minutes of empty solved-wave downtime.

Exact reclaim threshold/cadence belongs to the simulator.

## 26.8 Rebuild UX

Dock Rebuild card should show:
- current cycle Best Wave,
- projected Matter,
- concise `WHAT RESETS` / `WHAT STAYS`,
- clear Rebuild button.

First Rebuild onboarding:
1. open Rebuild sheet,
2. highlight projected Matter,
3. show reset/persist summary,
4. confirm Rebuild,
5. visibly reset Scrap/Workshop/Core Levels/Ash,
6. award Matter,
7. open Matter shop,
8. require one permanent Matter purchase,
9. return to Dock,
10. next Sortie launch remains manual.

No multi-page lore sequence.

Rebuild should never silently cancel permanent Foundry/Research work.

## 26.9 Matter shop balance requirements

Simulator must test:
- first-Rebuild purchase choices,
- expected Matter/hour across push vs farm cycles,
- whether waiting forever before Rebuild dominates,
- whether rapid tiny Rebuilds dominate,
- whether one Matter node is universally mandatory,
- Time Compression purchase timing,
- starting Scrap/Salvage cache impact on early-run economy,
- permanent raw-stat contribution versus Core/Relic/Workshop contribution.

Warnings:
- **REBUILD SPAM** — short low-frontier cycles outperform normal development.
- **REBUILD HOARD** — optimal strategy delays Rebuild far beyond a healthy cycle.
- **MATTER NODE DOMINANCE** — one non-temporal purchase is effectively mandatory first.
- **CACHE OVERRUN** — starting resources trivialise the early Sortie economy.
- **META POWER CREEP** — Matter raw stats overwhelm buildcraft.
- **COMPRESSION DELAY** — optimal play requires painfully delaying a QoL speed unlock.
- **COMPRESSION OUTCOME DRIFT** — 1× and 3× simulations produce materially different results.

---

---

# 27. Commanders — Canonical Design v1.0

## 27.1 Role

Commanders provide predictable mid-Wave spikes between proper W50 Boss encounters.

A Commander is **not a separate enemy species** and is **not a miniature Boss**. It is an already-known hostile promoted with exactly one authored Commander Trait plus stronger baseline stats/rewards.

Commander events exist to:
- make each 10-Wave band noticeable,
- create target-priority decisions during continuous combat,
- reuse known enemy mechanics in new combinations,
- provide high-value Salvage/Scrap/material targets,
- keep normal Waves interesting without requiring dozens more enemy species.

**Elite** remains a normal authored enemy role (for example Choir Sentinel / Crowned Husk). It is not a second procedural rarity tier.

## 27.2 Cadence

Commander event Waves:
- every multiple of 10,
- excluding every multiple of 50 because those are proper Boss Waves.

Examples:
`10, 20, 30, 40, 60, 70, 80, 90, 110...`

Commander events:
- do **not** pause normal Wave progression,
- do **not** clear backlog,
- do **not** heal the Hive,
- do **not** reset reinforcement timing,
- are part of the normal continuous-Wave threat model.

At W50/W100/etc. the proper Boss encounter replaces the Commander event.

First Commander at W10 uses an authored simple pairing so onboarding is deterministic. After the early tutorial events, Commander composition is deterministically generated from the Sortie seed + Wave.

## 27.3 Commander package generation

A Commander event contains:
- exactly **one Commander unit** under normal conditions,
- an escort package from already-introduced hostiles,
- a higher total threat budget than an ordinary Wave.

Seed threat budget:
- normal Commander Wave total threat approximately **1.30–1.50×** an ordinary Wave of the same band.
- the Commander itself consumes a substantial portion of that budget.
- exact value is simulator-tuned.

The generator selects:
1. an eligible already-introduced base hostile,
2. one unlocked compatible Commander Trait,
3. a compatible escort formation.

Rules:
- no unknown future hostile may become a Commander before its first-contact Wave,
- support-heavy compositions still obey support density caps,
- one Commander has exactly one Trait,
- never stack random adjective chains such as `Armored Frenzied Volatile Suppressor`,
- avoid the same Trait for more than two consecutive Commander events,
- avoid repeatedly promoting the same base hostile when multiple sensible candidates exist,
- Commander frequency is fixed by Wave and is not increased by Pack Hunter / High Tempo / Fragment Find,
- Pack Hunter may alter eligible escorts but never duplicate the Commander.

## 27.4 Simultaneous Commander safety

Because Waves are continuous, a weak build may still have a previous Commander alive when the next Commander Wave arrives.

Act 1 safety:
- target maximum **2 simultaneously active Commanders**,
- if two Commanders are already alive when another Commander package becomes due, reserve the Commander portion of that Wave's threat and deploy it once a Commander slot becomes available,
- do not delete or silently convert away that reserved threat,
- normal non-Commander escorts may still enter if simulation safety allows,
- same-type Commander aura effects never stack multiplicatively; strongest/current applicable effect wins unless a specific rule states otherwise.

Proper W50 Boss preparation requires clearing the existing backlog, so no old Commander enters a Boss encounter.

## 27.5 Commander baseline

Promotion grants a moderate authored baseline increase before the Trait:
- higher Hull/Shield according to the base hostile,
- modestly higher damage,
- visually larger/more prominent presentation,
- Commander reward weighting.

Do not use one universal multiplier blindly across every hostile. A Bulwark Commander does not need the same EHP multiplier as a Void Mite Commander.

Seed target:
- roughly **1.5–3×** the combat persistence/danger of the ordinary version depending on role,
- still dramatically below proper Boss scale.

Commander difficulty should come primarily from **one readable Trait interacting with the surrounding Wave**, not from enormous HP.

## 27.6 Commander Trait roster

### 1. Vanguard
**Available:** W10+

Identity:
> aggressive mobile leader.

Effects:
- Commander movement speed increased,
- modest personal Cycle Rate/attack-frequency increase,
- nearby compatible allies receive a small movement-speed benefit.

Good answers:
- Threat Doctrine,
- Pulse/Flak,
- Grav Tether,
- raw offense.

Compatibility:
- Swarm,
- suitable Armored bruisers,
- suitable Veil skirmishers.

Avoid on enemies whose existing charge mechanic would become unreadably fast; authored compatibility wins.

### 2. Ironclad
**Available:** W20+

Identity:
> unusually durable promoted target.

Effects:
- additional Hull,
- additional Armor or role-appropriate plating,
- slight movement penalty where appropriate.

No aura.

Purpose:
- early introduction to “high-value target that may become backlog”.

Good answers:
- Heavy Lance,
- Armor Penetration,
- Slag,
- Beam Ramp,
- Focus/Heavy targeting.

Compatibility:
- broad, but particularly Armored/Siege/Choir/Apex.

### 3. Wardbearer
**Available:** ~W60+

Identity:
> visible Shield commander.

Effects:
- gains meaningful personal Shield,
- periodically/continuously grants a modest temporary or renewable Shield contribution to nearby eligible allies,
- visible Shield links/field.

Destroying the Commander removes its support contribution.

Good answers:
- Focus/Threat,
- Phase/Shield-bypass builds,
- AoE if escorts cluster,
- simply brute-force the Commander.

Compatibility:
- Veil,
- Choir,
- Siege,
- selected Armored units.

### 4. Rallying
**Available:** ~W120+

Identity:
> offensive support leader.

Effects:
- nearby allies gain a modest attack/Cycle Rate benefit,
- optionally a small movement benefit,
- effect ends immediately when Commander dies,
- visible aura/link language.

Good answers:
- Threat/Focus priority,
- burst damage,
- AoE that damages leader + escorts.

Compatibility:
- Swarm,
- Armored,
- Choir,
- Apex,
- selected Veil units.

### 5. Displacer
**Available:** ~W280+

Identity:
> geometry/traverse test.

Effects:
- periodically telegraphs and moves laterally to a new nearby bearing/radius,
- remains a valid target while moving unless the base hostile independently has a phase rule,
- existing persistent target lock may remain if legal,
- no teleport invulnerability,
- reposition forces physical Core slew/firing-solution updates.

Good answers:
- Targeting Servos,
- Sensor Array,
- broad firing arcs,
- Pulse/Flak,
- committed weapons with good pre-acquisition.

Compatibility:
- Veil,
- Swarm skirmishers,
- suitable Siege units.

### 6. Suppressor
**Available:** ~W330+

Identity:
> fire-control disruption.

Effects:
- while alive, applies a modest visible reduction to weapon-Core Slew and/or acquisition responsiveness,
- never reduces either to zero,
- does not directly reduce weapon damage,
- effect is bounded and clearly indicated.

Good answers:
- Threat/Focus,
- Sensor Array,
- Targeting Servos,
- Gyro Sync,
- fast responsive weapons.

Compatibility:
- Siege,
- Veil,
- Apex,
- selected Choir support.

### 7. Volatile
**Available:** only after Resonance Vessel has introduced death-position danger (~W680+).

Identity:
> kill-location hazard.

Effects:
- Commander death releases a clearly telegraphed radial blast at its physical position,
- blast magnitude/radius is stronger than ordinary Resonance Vessel but still bounded,
- killing it at range is safer,
- no recursive death-chain mechanic.

Good answers:
- long-range kill,
- Grav positioning/control,
- Barrier/Bulwark if it reaches the Hive.

Compatibility:
- Choir,
- Swarm,
- selected Veil/Apex units.

### 8. Breacher
**Available:** only after Breach Engine has introduced partial-bypass spike language (~W760+).

Identity:
> late spike-damage Commander.

Effects:
- periodically charges one clearly telegraphed heavy attack,
- attack has modest partial Shield bypass,
- charge is long/readable even at 3×,
- attack frequency is low,
- no extra universal damage aura.

Good answers:
- kill during charge,
- Barrier Projector,
- Ablative Mesh,
- Damage Control,
- Bulwark Furnace,
- Focus/Threat.

Compatibility:
- Armored,
- Siege,
- Apex,
- selected Choir elites.

## 27.7 Trait unlock philosophy

Commander Traits may only remix mechanics the player has already been taught or can intuit safely.

Therefore:
- early Traits are simple stat/aura concepts,
- Displacer follows established radial/slew gameplay,
- Suppressor appears around the targeting-disruption era,
- Volatile only appears after kill-position danger has been formally introduced,
- Breacher only appears after partial-bypass telegraphed spike attacks are established.

Commanders must never become the first surprise source of a complex late-game mechanic.

## 27.8 Rewards

Commander kill rewards are immediate like ordinary kill rewards.

Seed reward weighting versus an equivalent ordinary unit:
- Salvage: approximately **3–5×** base role-adjusted bounty,
- Scrap: approximately **2–4×** base role-adjusted bounty,
- Core Mastery/use XP: elevated appropriately,
- material recovery chance/value: elevated,
- eligible Blueprint-fragment recovery chance: elevated but never the sole deterministic source,
- Choir-family Commanders: appropriately elevated Ash.

Exact multipliers are simulator values.

Commander rewards are based on the Commander itself, not simply multiplied across the whole escort package.

Salvage Beacon `Priority Claim` intentionally values Commanders.

Commander death does not independently grant the Wave-secure reward; that remains tied to Wave Secured.

## 27.9 Targeting interaction

Commander status contributes to target scoring but does not override Doctrine logic unconditionally.

Examples:
- Threat tends to value a dangerous Rallying/Suppressor/Breacher Commander highly.
- Heavy values high-EHP Commanders where appropriate.
- Shield values Wardbearers/Shield-heavy commanders.
- Execution still prioritises finishing vulnerable targets.
- Cluster still values actual geometry/density.

Do not implement a universal `if commander then always target commander`.

## 27.10 UI / presentation

Commander must be readable at a glance on mobile:
- modestly larger/more distinct silhouette treatment,
- clear Commander chevron/crown marker,
- Trait icon next to name/health,
- visible aura/link/projectile language for Trait effects.

First Commander W10:
`COMMANDER CONTACT`
`Promoted hostiles carry one enhanced trait and improved rewards.`

This onboarding is brief and non-blocking or pauses only once.

Example compact nameplate:
`COMMANDER · BULWARK`
`IRONCLAD`

Do not create separate Codex entries for every base-hostile + Trait combination.

Codex remains **HOSTILES | BOSSES**. Base Hostile details may show:
- Commander encounters defeated,
- known compatible Commander Traits encountered.

A small Commander Trait glossary/help sheet may explain discovered Trait icons without becoming a third Codex catalogue.

Unknown Commander Traits are not spoiled in advance.

## 27.11 Challenges and Directives

Challenges use normal Commander cadence unless the Challenge explicitly states otherwise.

- Pressure Front changes timing pressure, not Commander Wave numbers.
- Pack Hunter may increase escort pressure but not Commander count.
- High Tempo changes reinforcement interval, not Commander cadence.
- Hollow Choir retains Commanders.
- Challenge restrictions always apply to Commander interactions.

## 27.12 Commander balance tests

Simulator/telemetry must track:
- Commander survival time,
- overlap count,
- Trait-specific lethality,
- reward share,
- backlog contribution,
- target-priority behaviour,
- support-aura uptime.

Warnings:
- **COMMANDER WALL** — a normal Commander repeatedly hard-stops progression more than the next proper Boss.
- **COMMANDER OVERLAP** — ordinary healthy frontier play frequently reaches 2 active Commanders.
- **TRAIT DOMINANCE** — one Trait is dramatically more lethal/rewarding than peers.
- **TRAIT IRRELEVANCE** — a Trait has negligible measurable effect.
- **COMMANDER FARM** — Commander reward weighting makes deliberate low-progress farming disproportionately optimal.
- **AURA STACK EXPLOIT** — simultaneous Commanders create unintended multiplicative support spikes.
- **READABILITY FAILURE** — a Trait cannot be reliably identified/understood on target mobile sizes.

---

---

# 28. Process Points — Sources and Seed Costs

## 28.1 Currency rules

**Process Points (PP)** are permanent one-time achievement currency used only to unlock Process capabilities.

- PP may be earned **before Process itself is unlocked**.
- Before Process Kernel is discovered, PP are banked invisibly or shown only as an unrevealed account statistic; they are not spendable.
- When Process Kernel completes, all previously earned PP become available immediately.
- PP are not reset by Sortie, Rebuild or Reinforce.
- PP are not farmable from repeated ordinary kills/waves.
- Process capabilities are permanent once bought.
- No mutually-exclusive Process paths; an advanced account can eventually unlock the full Act 1 capability set.
- No respec system is required in Act 1 because Process unlocks are automation/QoL rather than direct combat power.
- Excess PP carries forward for future-Act Process expansion.

The purpose is to reward broad account mastery rather than creating a second grindable currency loop.

## 28.2 One-time PP achievement sources

### Career frontier — 42 PP total
- Reach W100: +2
- W200: +2
- W300: +3
- W400: +3
- W500: +4
- W600: +4
- W700: +5
- W800: +5
- W900: +6
- Defeat W1000 Choir Crown: +8

### Rebuild mastery — 15 PP total
- First Rebuild: +3
- 3 Rebuilds: +3
- 6 Rebuilds: +4
- 10 Rebuilds: +5

These are lifetime milestones only. Rebuild count never directly increases Matter payout.

### Research — 30 PP total
- Complete first Research project: +2
- Complete first Breakthrough in each of the four disciplines: +2 each (+8)
- Complete Process Kernel: +5
- Complete 20 Research nodes: +4
- Complete 30 Research nodes: +5
- Complete all 40 Act 1 Research nodes: +6

### Challenges — 42 PP total
For each of the nine pre-finale Challenges:
- Bronze first clear: +2
- Silver first clear: +1
- Gold first clear: +1

Nine Challenges = 36 PP.

Hollow Choir first clear:
- +6 PP

Repeated clears beyond first medal acquisition do not award more PP.

### Foundry / buildcraft — 21 PP total
- Fabricate first Tier II Relic: +3
- Fabricate first Tier III Relic: +4
- Own 8 distinct Core types: +3
- Own all 14 Act 1 Core types: +5
- Fabricate first non-Standard Frame: +2
- Own all 5 Act 1 Frames: +4

### Core Mastery — 10 PP total
- First Core type reaches M50: +2
- First Core type reaches M75: +3
- First Core type reaches M100: +5

**Act 1 total available: 160 PP.**

The complete seed Process tree costs **151 PP**, leaving a small surplus and allowing full Act 1 automation completion without requiring every possible post-finale activity.

## 28.3 Process capability seed costs

### Tier A — QoL / explicit execution — 12 PP
- Bulk Purchase: 2
- Buy Max: 2
- Live Readouts: 2
- Worker Presets: 3
- Processing Repeat: 3

### Tier B — basic automation — 27 PP
- Sortie Auto-Buy: 6
- Spend Profiles: 4
- Worker Auto-Fill: 5
- Material Stock Targets: 5
- Research Queue Assist: 4
- Furnace Presets: 3

Cumulative through Tier B: 39 PP.

### Tier C — priorities — 25 PP
- Upgrade Priorities: 5
- Worker Weights: 4
- Dependency Processing: 6
- Research Preference: 6
- Ash Budgeting: 4

Cumulative: 64 PP.

### Tier D — rules / profiles — 33 PP
- Rule Builder: 8
- AND: 4
- OR: 4
- Extra Rule Slots: 5
- Condition Complexity: 6
- Process Profiles: 6

Cumulative: 97 PP.

### Tier E — late cross-system automation — 54 PP
- Furnace Auto-Ignite: 10
- Directive Preference: 8
- Auto Extract: 8
- Profile Triggers: 10
- Repeat Sortie: 10
- Challenge Profile: 8

Total seed cost: **151 PP**.

Logical prerequisite edges remain required even if the player has enough PP:
- Buy Max → Bulk Purchase
- Spend Profiles → Sortie Auto-Buy
- Worker Auto-Fill → Worker Presets
- Material Stock Targets → Processing Repeat
- Dependency Processing → Material Stock Targets
- Rule logic upgrades → Rule Builder
- Furnace Auto-Ignite → Furnace Presets + Ash Budgeting + Rule Builder
- Directive Preference requires Directives already learned
- Auto Extract requires Extraction already learned
- Repeat Sortie is late and requires Process Profiles

Costs are seed balance, but the stage structure, achievement-only earning model and automation boundaries are locked.

---

# 29. Detailed Buildcraft / Foundry Addenda

This section preserves implementation details that must not be lost when the catalogue is translated into code. Where this section is more specific than an earlier summary, this section wins.

## 29.1 Mature Core socket layouts

Socket layouts are authored per Core and unlocked through the Core's Mastery milestones; socket type is not inferred simply from role.

Seed mature layouts:

- Pulse Cannon: **Power → Optical → Universal**
- Heavy Lance: **Ballistic → Power → Universal**
- Flak Array: **Ballistic → Power → Universal**
- Phase Beam: **Optical → Power → Universal**
- Slag Spitter: **Ballistic → Power → Universal**
- Plate Layer: **Shield → Shield/Universal**
- Rapid Aegis: **Shield → Universal**
- Ablative Mesh: **Shield → Industrial/Universal**
- Barrier Projector: **Shield → Optical/Universal**
- Salvage Beacon: **Industrial → Optical/Universal**
- Grav Tether: **Optical → Industrial/Universal**
- Nano Lathe: **Industrial → Shield/Universal**
- Sensor Array: **Optical → Industrial/Universal**
- Choir Tap: **Industrial → Power/Universal**

Not every M100 Core must automatically have three sockets. Exact socket-count unlock milestones remain authored by each Core; M20 is the canonical point at which meaningful Relic capability expands.

## 29.2 Relic acquisition staging

Early Relic period:
- Power Coupler
- Reinforcement Plate
- Overcharge Capacitor
- Aegis Relay

Mid:
- Shatter Mesh
- Focusing Array
- Prismatic Lens
- Salvage Matrix
- Ballistic Jacket

Advanced:
- Phase Needle
- Fixed Mount
- Penetrator Guide
- Gravity Lens
- Industrial Optimiser

Late:
- Nanite Reservoir
- Shield Crossfeed
- Predictive Bus
- Resonance Tap
- Universal Resonator

Tracking Gimbal is earned through Knife Fight and enters the pool when that Challenge reward is obtained.

## 29.3 Legacy-concept mapping

Do **not** preserve these as separate final Cores merely because current code contains them:

- Rail Driver → Heavy Lance behavioural Relic / Mastery concept
- Charge Prism → Heavy Lance/energy behavioural Relic concept
- Ion Burst → Phase/Flak behavioural Relic concept
- Swarm Rack → Flak behavioural Relic concept
- Arc Lash → Pulse/Phase behavioural Relic concept
- Vector Thruster → Frame/Relic/evasion concept
- Keel Baffle → Ablative Mesh Relic concept
- Mirror Plate → defensive behavioural Relic concept
- Surge Capacitor → offensive/utility Relic concept
- Salvage Rig → Salvage Beacon Relic/Mastery concept
- Sensor Whisker → Sensor Array
- old Plate variants → Plate/Aegis/Ablative Relics

Legacy implementation is removed, not kept as aliases, unless an internal identifier is intentionally reused with no compatibility requirement.

## 29.4 Generic-upgrade unlock seed costs

Each category begins with two permanently known starter upgrades. Four additional upgrades are unlocked sequentially with one-time Scrap purchases.

Seed permanent unlock ladder **per category**:
1. third upgrade: ~75 Scrap
2. fourth: ~250 Scrap
3. fifth: ~750 Scrap
4. sixth: ~2,000 Scrap

These values are simulator seeds. The category chains remain independent.

Fresh-account onboarding clarification:
- At W1 the UI initially exposes only **Weapon Power, Hull and Salvage/Kill** to avoid tutorial overload.
- Cycle Rate, Shield Capacity and Salvage/Wave are already starter-known but are revealed immediately after the first-death Workshop onboarding.
- After that point the normal two-starter-upgrades-per-category model is fully visible.

## 29.5 Foundry processing network

Seed deterministic recipe relationships:

- Recovered Stock: Scrap → Recovered Stock
- Conductive Filament: Scrap → Conductive Filament
- Tempered Alloy: Recovered Stock + Scrap
- Ballistic Composite: Recovered Stock + Conductive Filament
- Optical Glass: Conductive Filament + Scrap
- Shield Lattice: Tempered Alloy + Conductive Filament
- Control Mesh: Optical Glass + Conductive Filament
- Phase Crystal: Optical Glass + advanced processing
- Nanite Compound: Control Mesh + Tempered Alloy
- Resonant Ceramic: Tempered Alloy + Ash
- Thermal Conductor: Resonant Ceramic + Conductive Filament + Ash
- Crown Matrix: late Choir/Apex recovery + advanced processing

Exact input ratios/times are simulator values.

Enemy-family direct material recoveries accelerate this network:
- Swarm: Stock / Filament / Ballistic Composite
- Armored: Stock / Tempered Alloy
- Veil: Optical Glass / Shield Lattice / Phase Crystal
- Siege: Filament / Ballistic Composite / Control Mesh
- Choir: Resonant Ceramic / thermal materials / Ash
- Apex: Control Mesh / Phase Crystal / Nanite Compound / rare Crown material

Direct recoveries never replace deterministic Processing.

## 29.6 Blueprint fragment rule

Blueprint-specific fragments only:
`Heavy Lance Schematic 2/5`.

No casing/core/lens multi-part Blueprint system.

Guaranteed discovery immediately completes the Blueprint regardless of current fragment count. Existing partial progress is simply superseded; there is no fragment refund requirement. Once a Blueprint is discovered, its fragments stop dropping.

## 29.7 Extraction

Extraction becomes available with the Rebuild-era account loop, seed around **W210**.

- Voluntary.
- Ends active Sortie safely and returns to Dock.
- All already-earned persistent rewards are retained.
- Seed bonus: **+12.5% Scrap earned during that Sortie**.
- Does not multiply Ash, materials, Blueprint fragments or prior cycle Scrap.
- No death penalty is added simply to make Extraction attractive.
- Late Process may Auto Extract under explicit player-authored conditions.

Exact bonus tunes within the previously approved ~10–15% range.

---

# 30. Numeric Balance Seed Package

**Important:** these are implementation/simulator seeds, not immutable final balance. Store them centrally so the balance pass can tune without rewriting system logic.

## 30.1 Spatial / timing seed

- Hive combat origin: `(0,0)`
- Typical enemy reinforcement spawn radius: ~300 simulation units, formation-adjusted
- Core orbit radius seed band: ~38–58 units by Core
- Base normal Wave reinforcement interval: **7.0 simulated seconds**
- High Tempo seed: **15% shorter interval** → ~5.95s
- Deep solved-Wave reclaim may reduce otherwise-empty interval toward a seed floor of ~1.5–2.0 simulated seconds, then smoothly return toward 7.0s as the run approaches meaningful pressure/frontier
- Proper Boss warning/entrance: approximately 1.5–2.5 simulated seconds before Boss becomes fully active, authored per encounter
- Active-enemy simulation target: ~50–60; pending threat is preserved if safety throttling occurs

## 30.2 Global enemy scaling seed

Use family/unit profiles multiplied by central Wave curves rather than hand-writing a full separate stat table for every Wave.

Seed:
- ordinary Hull/Shield scale: approximately `1.011 ^ (Wave - 1)`
- ordinary outgoing damage scale: approximately `1.0085 ^ (Wave - 1)`
- ordinary reward-value scale: approximately `1.0065 ^ (Wave - 1)`

Armor should primarily come from authored enemy profile/band progression and diminishing-return formulas rather than scaling linearly to immunity.

Boss/Commander profiles apply separate authored threat multipliers; do not simply multiply every stat equally.

The simulator is expected to change these growth constants.

## 30.3 Weapon geometry / cadence seeds

These are starting points for implementation and comparative simulation:

### Pulse Cannon
- Fire Range ~170
- Acquisition Range ~240
- Firing Arc ~150°
- Slew class: fast
- base cycle ~0.80s
- direct-hit base output unit: ~4

### Heavy Lance
- Fire Range ~260
- Acquisition Range ~380
- Arc ~100°
- Slew class: slow
- charge/cycle seed ~2.8s
- direct-hit base output unit: ~28
- no pre-charge before legal firing solution

### Flak Array
- Fire Range ~145
- Acquisition ~210
- Arc ~220°
- Slew: very fast
- cycle ~1.0s
- impact output ~3
- base explosion radius ~45

### Phase Beam
- Fire Range ~220
- Acquisition ~310
- Arc ~135°
- Slew: medium
- continuous/tick implementation equivalent to ~8 base DPS before ramp
- ramp should reward same-target contact over several seconds rather than reaching maximum instantly

### Slag Spitter
- Fire Range ~180
- Acquisition ~250
- Arc ~175°
- Slew: fast
- cycle ~1.2s
- impact output ~4
- seed Burn/Slag DoT ~2 output/sec for ~4s
- seed Molten Pool radius ~35 once Mastery unlocks it

All output units are arbitrary baseline balance units and must be tuned with the simulator. Relative identities are authoritative.

## 30.4 Target switching seed

Target hysteresis seed:
- new candidate normally needs roughly **25% better targeting score** than current target before a discretionary switch.
- immediate switch remains allowed when current target dies/becomes invalid or a Core-specific emergency rule explicitly says so.

Seed commitment modifiers:
- Flak: lower threshold / cluster-responsive
- Pulse: around baseline
- Heavy Lance: significantly higher
- Phase Beam: highest while Ramp is established

Exact scoring weights are authored/tuned; avoid frame-to-frame oscillation.

## 30.5 Generic upgrade seed curves

Central curve families rather than one global cap.

High-cap scaling examples:
- Weapon Power: ~+10–12% multiplicative/equivalent output per effective level at very early seed, subject to later curve softening
- Hull / Shield Capacity: similar early magnitude
- Cycle Rate: use cooldown-efficiency curve, not an uncapped linear `-X% cooldown`

Moderate-cap:
- Armor
- Shield Regen
- Repair
- Scrap yields
- Targeting Servos

Hard/diminishing:
- Crit Chance generic cap seed ~40%
- base Crit Factor seed ~1.5×
- Armor Penetration hard/diminishing cap below complete universal Armor negation
- Targeting Servos must preserve Heavy Lance's slow-slew identity
- Slow global conceptual cap ~60%

Temporary Economy-upgrade payback is validated by simulation, not a fixed percentage formula.

## 30.6 Furnace numeric seeds

Heat level cost seed:
- I: 10 Heat
- II: 25 Heat
- III: 60 Heat

Overdrive:
- I ~+20% weapon output
- II ~+45%
- III ~+80%

Bulwark:
- I ~+20% max Hull/Shield
- II ~+40%
- III ~+65%
- later levels may add modest Armor/spike support as specified, not giant flat DR

Guidance:
- I ~+20% Slew
- II ~+35% Slew + ~10% Acquisition
- III ~+55% Slew + ~15% Acquisition + ~10–15° firing arc

Harvest:
- I ~+20% Salvage/Scrap
- II ~+45%
- III ~+80% plus modest Fragment Find
- never increases Ash

Ash conversion seed: **10 Ash → 1 Heat**.

Reactor Frame, Research and Choir Tap may improve conversion/effect through their authored modifiers.

## 30.7 Matter seed economics

Matter payout seed is defined in Rebuild section.

Matter-shop seed cost curves:
- ordinary rankable permanent stat node: base ~4 Matter, growth ~1.8× per rank
- industrial/foundation node: base ~5 Matter, growth ~1.8×
- Time Compression I: ~8 Matter
- Time Compression II: ~35 Matter
- Time Compression III: ~120 Matter

Compression I should be practical from/shortly after the first meaningful Rebuild.

Starting-resource cache design target:
- each rank should remove roughly under a minute of trivial early setup at its intended stage
- even maxed caches should not replace several minutes of mature Sortie economy
- simulator may replace flat amounts with carefully bounded career-scaled amounts if flat values age badly

## 30.8 Commander/Boss seeds

Commander Wave total threat:
- ~1.4× ordinary Wave seed, role-adjusted

Commander reward:
- Salvage ~3–5× equivalent unit
- Scrap ~2–4×
- elevated appropriate material/fragment/Mastery rewards

Frontier Boss TTK targets at 1× simulated time:
- W50 champion-style Bosses: roughly 20–40s for an appropriately developed near-frontier build
- W100 signature Bosses: roughly 35–70s
- Choir Crown finale: roughly 90–150s total across phases

A Boss should fail a build because of mechanics/pressure, not because the player must watch an undifferentiated HP bar for several minutes.

## 30.9 Run / career pacing seeds

- first fresh run: ~3–5 real minutes at 1×
- early failed frontier runs should commonly produce visible permanent/cycle improvement
- later ordinary runs: roughly 15–30 minutes at chosen available compression
- exceptional push runs: roughly 30–40 minutes
- healthy new wall: usually ~1–3 failed pushes before a meaningful account/build change can progress it
- old Best Wave reclaim target after Rebuild: roughly 20–40% of the original time, improving later through account power, Time Compression and solved-wave reclaim

Cumulative active-equivalent career target:
- W100: 2–4h
- W200: 6–10h
- W300: 12–18h
- W400: 20–28h
- W500: 30–40h
- W600: 42–54h
- W700: 52–66h
- W800: 62–78h
- W900: 72–90h
- W1000: **80–100h**

Offline Research/Foundry progress contributes alongside this and is not counted as mandatory screen-on time.

---

# 31. Simulator Acceptance Criteria

The simulator is not just a DPS calculator. It must exercise deterministic Waves, geometry, targeting, backlog, economy and progression.

## 31.1 Required simulation profiles

At minimum:
- Balanced Generalist
- Swarm Control
- Boss Killer
- Shield Breaker
- Defensive Sustain
- Economy/Farm

Run each across representative Frames, Core combinations, Relic choices, Doctrine settings and account-investment strategies.

Also explicitly test:
- Workshop-heavy Scrap allocation
- Core-Level-heavy allocation
- permanent-unlock-heavy allocation
- balanced allocation
- duplicate-Core builds
- no-specialist/generalist builds

## 31.2 Combat acceptance

At representative frontier bands:
- no single Core should be effectively mandatory across all six profile types
- every Core should be a meaningful near-optimal choice in at least one plausible build/problem
- one identical six-Core Swarm loadout must not dominate all encounter families
- specialist counters should outperform generalist answers on their intended problem without making generalists non-viable
- Boss mechanics must have at least 2–3 viable soft-answer paths
- sustained normal backlog for a healthy near-frontier build should generally remain manageable; peaks are allowed
- frequent Commander overlap at healthy progression is a failure
- normal Commander should not be a harder recurring wall than the next proper Boss

Suggested telemetry thresholds for flags, not absolute pass/fail truths:
- average healthy-frontier backlog roughly <10
- peak ordinary healthy-frontier backlog typically <25
- >20 sustained backlog for a meaningful period indicates backlog-wall pressure
- simultaneous Commanders reaching 2 frequently indicates tuning failure

## 31.3 Targeting acceptance

Track:
- target switches/minute
- time acquiring legal target
- Slew downtime
- shots/cycles wasted because firing solution lost
- Beam Ramp loss
- overkill waste
- Doctrine target distribution

Flags:
- **TARGET THRASH** if target changes repeatedly without meaningful threat change
- **SLEW TAX** if a responsive Core routinely spends a large fraction of useful time traversing
- **HEAVY TELEPORT** if global Slew bonuses erase Heavy Lance's deliberate identity
- **DOCTRINE DOMINANCE** if one Doctrine is optimal for virtually every compatible Core/encounter
- **SENSOR MANDATORY** if late encounters become broadly non-viable without Sensor Array
- **SENSOR IRRELEVANT** if Sensor support has negligible targeting effect

1× versus 3× deterministic simulations using identical seed/build should produce materially equivalent outcomes. Minor floating-point/order differences are acceptable; meaningful Best-Wave/TTK/reward divergence is not.

## 31.4 Buildcraft acceptance

Core/Relic contribution reporting should flag:
- one Core appearing in >~70% of all near-optimal simulated loadouts without strong contextual reason
- one Core below ~5% usefulness across every tested build/problem
- Behavioural Relic that never changes preferred encounter/build behaviour
- Standard Relic universally outperforming compatible Behavioural options
- one Frame universally >~10–15% ahead across nearly all encounter profiles
- Frame downside so severe that its intended specialist build cannot repay it

These percentages are diagnostic seeds.

## 31.5 Economy acceptance

Temporary Economy upgrade diagnostics:
- **ECON TRAP** when expected payback exceeds ~60% of remaining expected Sortie duration in its intended use case
- **ECON AUTO-BUY** when expected payback is <~10% of remaining run so consistently that skipping is irrational
- desirable common payback band roughly 20–45% depending push/farm intent

Passive Worker Scrap:
- target roughly 10–20% of comparable active/hour after opportunity cost
- flag above roughly 20–25% persistent share

Shared Scrap allocation:
- if one of Workshop / physical Core Levels / permanent generic unlocks receives >~85% of optimal spend in nearly all representative account states, rebalance

Extraction:
- bonus must be useful for deliberate farming but not make death-path normal pushing feel punished
- repeated early Extraction must not beat meaningful frontier progression for Matter/hour

Blueprint RNG:
- essential Core/Relic/Frame access must remain deterministic through authored source
- Fragment Find/RNG only accelerates acquisition
- simulator should report expected early-discovery distribution and ensure rare luck cannot skip multiple progression phases catastrophically

## 31.6 Rebuild / Matter acceptance

Flag:
- **REBUILD SPAM** if repeated shallow cycles outperform intended cycles for Matter/hour
- **REBUILD HOARD** if optimal play routinely delays Rebuild far beyond any meaningful new cycle progress
- **MATTER NODE DOMINANCE** if one non-temporal first purchase is optimal in >~75–80% representative states
- **COMPRESSION DELAY** if rational players should delay 1.5× so long that early game QoL suffers
- **CACHE OVERRUN** if Foundation caches trivialise early economy
- **META POWER CREEP** if raw Matter stats outweigh Core/Relic/Workshop identity

First sensible Rebuild should present several credible purchases, not one mathematically compulsory answer.

## 31.7 Directive acceptance

Track pick value by build/run purpose.

Flag:
- Directive chosen whenever offered across almost all profiles
- Directive never beneficial in any reasonable profile
- specific combination dominates all others
- Pack Hunter reward multiplication creates farm exploit
- High Tempo becomes mandatory on all solved-content runs
- economic Directive turns deliberate stagnation into optimal play

A Directive should change how a Sortie feels, not merely add a hidden percentage.

## 31.8 Research / Foundry / Process acceptance

Research:
- no branch should be a mandatory first path for every account
- Fire-Control Doctrine is useful customization but defaults remain viable
- Process Kernel timing roughly W650–750 for a typical account, with deliberate Compute focus able to shift earlier
- total Research duration supports ~30–40h unaccelerated tree while Workers/offline progress meaningfully help

Foundry:
- no material creates a prolonged single-resource choke unrelated to player goals
- Material Mastery unlocks arrive before their designs become obsolete
- first fabrication of a newly discovered Blueprint is meaningfully affordable within its progression phase
- duplicates become easier later without becoming free

Process:
- useful immediately when unlocked because previously earned PP are banked
- basic automation cannot perform strategic actions it has not been explicitly taught/authorized
- late automation removes repetition without creating offline combat
- rule evaluation remains performant on target mobile devices

## 31.9 Performance / mobile acceptance

Target layouts:
- 360×800
- 390×844
- 412×915
- also tolerate ~430px-wide modern devices

Minimum reliable touch targets: ~44 CSS px.

Stress test:
- ~60 active enemies
- 6 Cores
- projectiles/beams/DoTs/fields
- Commander aura
- targeting overlay
- 3× Time Compression

No gameplay rule should depend on animation frame rate.

If performance cap is reached:
- preserve threat/rewards deterministically via pending/consolidated packages
- never silently despawn enemies or reduce their reward value

---

# 32. Final Consistency Audit / Authoritative Clarifications

This section explicitly resolves possible ambiguity across earlier design discussions. If earlier wording conflicts with this section, **this section is authoritative**.

1. **No Sectors.** All final progression language is Waves.
2. **Act 1 finale is W1000**, not W300. Old W300 cadence/constants are legacy and should be deleted.
3. **No save migration/backward compatibility.** Breaking reset is accepted.
4. **Delete legacy systems/code/tests** rather than preserving deprecated Echo, Route B, Network-bar, Reliquary, old Sector, old W300 finale, typed-slot, old per-Sortie Core-upgrade or obsolete compatibility architecture.
5. **Core slots are universal.** Role tags affect behaviour/relic compatibility, not hard Frame slot legality.
6. **Swarm Frame gives +1 relative usable Core position, capped at 6.** It may initially provide 5 if the account's normal bus is still at 4; later reaches 6.
7. **Worker Drones persist through Rebuild.** Foundry infrastructure persists through Rebuild.
8. **Ash resets on Rebuild; Foundry materials made using Ash persist.**
9. **Heat resets every Sortie.** There is no Heat capacity or passive Heat generation.
10. **After Furnace Ignite, further Ash→Heat conversion has no current-Sortie purpose and the UI should disable or clearly prevent wasteful conversion.** Primed-but-unignited state is a UI draft; closing it releases reservation.
11. **Research E3 Thermal Conduits** improves Ash→Heat conversion. **E8 Thermal Recovery** instead modestly reduces Heat required by selected Furnace channels. They are not duplicate nodes.
12. **Choir Tap M30 Hot Recovery:** high-value Choir/Commander/Boss recovery while fitted can grant a small bounded immediate Heat packet during the current Sortie. **M50 Furnace Feed:** Ash→Heat conversion performed while Choir Tap is fitted becomes more efficient for that Sortie. Neither changes an already-Ignited Furnace configuration.
13. **Time Compression is the only general combat simulation-speed multiplier.** Research reclaim improvements reduce proven dead inter-Wave waiting only.
14. **Combat freezes exactly when the app closes/reloads.** Foundry and Research progress offline; Sorties do not.
15. **Targeting defaults are competent.** Fire-Control Doctrine unlocks customization, not basic intelligence.
16. **No dynamic Process Doctrine flipping in Act 1.** Targeting profiles may be loaded once or manually switched.
17. **Standard enemies attack the Hive, not Core HP.** Cores have no normal independent health/destruction loop.
18. **Every proper Boss waits for prior backlog to clear, then pauses normal advancement.** Commander events do not pause.
19. **Maximum target simultaneous Commanders is 2; excess Commander threat is delayed, not deleted.**
20. **Blueprint = design; physical Core/Relic requires fabrication.**
21. **Core Level resets on Rebuild; Core Mastery is permanent and shared by type.**
22. **Relics are physical, fixed-effect, freely removable Docked, and max one Behavioural Relic per Core in Act 1.**
23. **No Data Research currency and no Data Capture Economy upgrade.**
24. **No separate Furnace upgrade shop.**
25. **No standalone Yard.** Infrastructure lives in Foundry.
26. **No offline combat / autonomous offline Sorties in Act 1.**
27. **Challenges use the player's normal account unless a stated restriction disables something.** Matter Sortie Provisioning applies unless a specific Challenge says otherwise.
28. **Codex unlocked around W30 retroactively knows already encountered Void Mite/Commander contact; it does not spoil future hostiles.**
29. **Extraction unlocks in the Rebuild era (~W210), with ~12.5% Sortie-Scrap seed bonus.**
30. **Permanent generic upgrade unlocks persist through Rebuild; their Workshop levels do not.**
31. **Fresh UI reveal is not the same as account unlock.** The six starter-known generic upgrades are Weapon Power, Cycle Rate, Hull, Shield Capacity, Salvage/Kill, Salvage/Wave; first-run onboarding initially reveals only three.
32. **No direct battlefield Core tapping is required.** Stationary selector is the reliable accessibility/mobile control.
33. **Soft counters only.** No enemy/Boss/Challenge is mathematically gated by one specific Core.
34. **RNG accelerates but never gates essential progression.**
35. **Furnace/Process/Research/Foundry equipment swaps must not create offline production exploits.**
36. **Final 100 Waves introduce no new top-level system.** W901–1000 is payoff/convergence.
37. **Reinforce is only exposed after Choir Crown.** Exact Act 2 reset boundary is intentionally deferred; Act 1 implementation must not invent full Act 2 systems.
38. **The canonical design owns game design.** Cursor may tune seed constants only within explicit balance work; it must not silently substitute legacy mechanics or invent alternatives.

---

# 33. Implementation Contract for Cursor PRs

Every implementation PR prompt must begin from the following contract:

> **Read `docs/act1-canonical-design.md` in full before changing code. It is the authoritative game-design baseline. This is a pre-release breaking redesign: no save migration or backwards compatibility is required. Old saves may be invalidated/reset. Do not preserve deprecated systems, compatibility aliases, migration helpers, dead tests, or obsolete architecture merely because they exist on `main`. Remove superseded legacy implementation cleanly. Do not invent alternative mechanics where the canonical design specifies behaviour. If implementation reality forces a deviation, stop and report the deviation instead of silently redesigning the game.**

Every PR must also:
- inspect current `main` before editing,
- state its exact scope and explicitly preserve out-of-scope canonical behaviour,
- update tests to the **new design**, not compatibility expectations,
- remove obsolete tests for removed behaviour,
- include onboarding/presentation changes for every newly exposed/reworked system in that PR,
- maintain target mobile layouts and touch targets,
- update canonical-adjacent docs where implementation details genuinely change,
- run lint/typecheck/tests/build available in the repo,
- report any seed balance values added/changed,
- report any deviation from canonical design,
- avoid leaving “temporary legacy bridge” code unless the PR prompt explicitly requires a short-lived intra-PR implementation scaffold that is removed before completion.

The ordered PR pack will reference this document rather than relying on chat history.

---

# 34. Frozen Status

**Act 1 mechanical/content design is now frozen at v1.0 for implementation.**

Further changes should happen deliberately through:
1. implementation findings,
2. simulator evidence,
3. playtest evidence,
4. explicit design revision.

Cursor must not independently redesign the catalogue during implementation.

The next work product is the **ordered Cursor PR implementation pack**.
