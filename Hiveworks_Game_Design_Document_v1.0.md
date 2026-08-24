# Hiveworks
## Game Design Document — Version 1.0

**Status:** Living design document  
**Scope:** Core game and Act 1  
**Primary platform:** Android/mobile portrait, with browser playability retained  
**Genre:** Incremental / idle auto-combat / buildcraft / automation  
**Core inspirations:** *The Tower – Idle Tower Defense* for run structure and in-run versus persistent purchasing; *Unnamed Space Idle* for system depth, pacing, automation and long-term account progression.  

> **Design principle:** Inspiration should inform structure and pacing, not produce a direct clone of either game.

---

# 1. Executive Summary

**Hiveworks** is a portrait-oriented incremental auto-combat game built around repeated combat **Sorties**.

The player operates a mobile industrial **Hive** that deploys into hostile space and anchors itself in a central defensive position. During combat, enemies approach from all directions. Around the Hive operate equipped **Cores**: autonomous combat units that provide weapon fire, shielding, repair, salvage and other utility functions.

Every standard Sortie begins at **Wave 1**.

Combat execution is automatic. The player's skill comes from preparation, resource allocation, buildcraft and automation rather than direct movement or aiming. During a Sortie the player spends temporary **Salvage** to improve the current run, adjusts systems that are explicitly allowed to change in combat, selects run-defining **Directives**, and eventually configures **Process** automation to handle actions they have already mastered.

When the Hive is destroyed, the Sortie ends. Temporary run progression is lost, but persistent resources and account progression remain.

Normal Sorties feed a larger **Rebuild Cycle**. **Scrap** earned during Sorties is spent in the **Workshop** to raise the starting levels of future Sorties within that cycle. Eventually the player performs a **Rebuild**, resetting Scrap and Workshop progression in exchange for permanent **Matter** and a substantial increase in long-term power.

The Act 1 progression hierarchy is therefore:

> **Sortie → Rebuild Cycle → Permanent Account → Reinforce**

The game starts deliberately simple and gradually becomes a deep systems game. Major systems should unfold slowly, and existing systems should expand before unrelated new systems are introduced.

A central late-game pillar is **Process**. It begins with quality-of-life purchases and simple auto-buying, then develops toward a mobile-friendly conditional rules system inspired by the logic of Final Fantasy XII's Gambits. By late Act 1, the player should spend less time repeating solved actions and more time designing how the Hive behaves.

---

# 2. Product Vision

Hiveworks should feel like:

> **A clear auto-battler that gradually reveals itself to be a deep industrial, buildcraft and automation game.**

The opening minutes should be understandable without a wiki or lengthy tutorial.

At first, the player only needs to understand:

1. enemies attack the Hive;
2. kills provide Salvage;
3. Salvage buys temporary power;
4. the Sortie eventually ends;
5. Scrap makes future Sorties stronger.

Later, the player learns:

- Hive Frames;
- multiple combat Cores;
- Core Mastery;
- Relics installed into Cores;
- Workshop development;
- Foundry processing and fabrication;
- Worker Drone allocation;
- Rebuild and Matter;
- Furnace push resources;
- timed Research;
- Directives;
- Challenge runs;
- Process automation.

The player should regularly feel that there is **another meaningful layer ahead**, but never feel that the game has dumped ten unrelated systems onto them at once.

---

# 3. Core Design Pillars

## 3.1 Every Sortie Has a Story

A Sortie has a distinct beginning, escalation and conclusion.

The player:

> launches → builds power → reaches resistance → adapts → pushes → dies or extracts.

A strong run should produce thoughts such as:

- “I invested too much in economy this time.”
- “That new Core solved the Swarm waves.”
- “I should use Furnace on the next push.”
- “The shield Relic bought me another ten waves.”
- “My automation handled the early run perfectly.”

The game should create **runs worth comparing**, not merely one endlessly running progression state.

## 3.2 Failure Still Produces Progress

Death ends the Sortie but should not make the player feel that their time was wasted.

Persistent rewards already earned remain safe.

A failed push may still provide:

- Scrap;
- Core fragments;
- Foundry materials;
- Ash;
- Data;
- Relics or blueprints;
- Foundry Mastery;
- Research time;
- Worker Drone production;
- Challenge knowledge;
- useful telemetry about the current bottleneck.

The emotional loop is:

> **The run failed. The account improved. Try again.**

## 3.3 Fewer Systems, Greater Depth

Hiveworks should not keep systems merely because they have already been coded.

Every major system must have:

- a clear strategic purpose;
- progression that remains relevant over many hours;
- meaningful interaction with other systems;
- understandable UI;
- later automation where repetition develops.

Systems that mostly provide another generic multiplier should be merged, redesigned or removed.

## 3.4 Existing Systems Expand Before New Systems Arrive

A preferred pacing pattern is:

> system unlock → learn it → use it → system expands → master expansion → next system.

Not:

> new system → new system → new system → new system.

## 3.5 UI Must Support Decisions

The player should never be required to remember hidden numbers in order to make a choice.

If the player is choosing a Hive Frame, comparing Cores or preparing to Rebuild, the required statistics must be available in that interface.

The UI principle is:

> **Simple at first glance; detailed on interaction.**

Information density is desirable when structured well. Excessive navigation is not.

## 3.6 Growth Should Become Enormous

Hiveworks is an incremental game. Long-term progression should eventually produce very large numbers.

Growth should come from understandable multiplicative layers rather than arbitrary number inflation.

## 3.7 Automation Is Earned Mastery

The player manually learns a behaviour before Process automates it.

Automation progression should feel like:

> manual action → convenience → auto-action → priority → condition → behavioural programming.

---

# 4. Theme and Narrative Framework

## 4.1 Setting

The player controls a mobile industrial construct called the **Hive**.

The Hive can travel between regions, but during a Sortie it deploys into a stationary defensive configuration while hostile forces converge from all directions.

The Hive:

- fabricates equipment;
- deploys combat Cores;
- manufactures Worker Drones;
- performs Research;
- accumulates knowledge between temporal cycles.

## 4.2 Narrative Tone

Narrative is intentionally light for the initial game.

Use:

- short flavour text;
- environmental hints;
- Codex entries;
- milestone messages;
- subtle discoveries.

Avoid initially:

- dialogue-heavy campaigns;
- long cutscenes;
- NPC conversation systems.

## 4.3 Time-Loop Foundation

The longer-term fiction revolves around a **time-loop / Groundhog Day concept**.

Initially, **Rebuild** appears to be a technological reconstruction process. Over the course of Act 1, subtle evidence suggests that the Hive is not simply reconstructing itself conventionally; information, knowledge and anomalous Matter appear to survive events that should have erased them.

This provides a future narrative explanation for why:

- temporary infrastructure resets;
- Matter persists;
- permanent knowledge survives;
- Research can discover temporal anomalies;
- Reinforce can eventually alter the starting state of the loop itself.

The exact story should remain open for later narrative design.

---

# 5. Core Terminology

## Hive
The player's central combat structure and industrial base.

## Hive Frame
The structural chassis/configuration of the Hive. Frames define broad archetypes rather than functioning solely as linear upgrades.

## Core
An autonomous combat unit associated with the Hive. Cores are visually drone-like, but the UI calls them simply **Cores**.

## Worker Drone
An industrial worker used for processing, fabrication, Research, construction, Worker Drone production and salvage operations.

## Sortie
One standard combat run, always beginning at Wave 1 and ending in death or Extraction.

## Wave
The game's only standard combat progression coordinate. **Sectors are removed.**

## Salvage
Temporary Sortie currency. Resets at the end of every Sortie.

## Scrap
Persistent currency within the current Rebuild Cycle. Used mainly for Workshop development. Resets on Rebuild.

## Matter
Permanent Rebuild currency. Survives Rebuild.

## Workshop
Cycle-level starting upgrades. Workshop levels survive normal Sorties but reset on Rebuild.

## Rebuild
The first major prestige reset. Ends the current Rebuild Cycle and grants Matter.

## Reinforce
Higher-order progression that concludes Act 1 and changes the scale of future progression.

## Directive
A temporary run-defining modifier chosen during a Sortie.

## Relic
An authored augmentation installed directly into a Core.

## Foundry
The Hive's persistent processing and fabrication system.

## Process
The quality-of-life and automation system, eventually becoming a conditional behavioural rules engine.

## Challenge
A special Sortie with defined restrictions or modified combat conditions.

---

# 6. Progression and Reset Architecture

Hiveworks uses three primary progression layers during Act 1.

## 6.1 Layer One — Sortie Progression

A Sortie begins at Wave 1.

### Resets when the Sortie ends

- current Wave;
- Salvage;
- temporary Attack upgrades;
- temporary Defense upgrades;
- temporary Economy upgrades;
- Directives;
- Heat;
- temporary buffs;
- Hull/Shield combat state.

## 6.2 Layer Two — Rebuild Cycle

A Rebuild Cycle contains multiple Sorties.

### Persists between normal Sorties

- Scrap;
- Workshop levels;
- Scrap-funded Core Levels on each physical Core copy;
- Ash;
- current cycle statistics;
- designated cycle-level infrastructure.

### Resets on Rebuild

- Scrap;
- Workshop levels;
- Core Levels on each physical Core copy;
- Ash;
- active Sortie state;
- designated cycle-only progression.

## 6.3 Layer Three — Permanent Account

Survives Rebuild.

Includes:

- Matter;
- Matter upgrades;
- career Best Wave;
- system unlocks;
- Hive Frame unlocks;
- Core unlocks;
- Core Mastery;
- Relic collection;
- Foundry recipes and Mastery;
- permanent Worker Drone technology;
- Research;
- Process progression;
- Challenge clears;
- Codex discoveries;
- long-term achievements and statistics.

## 6.4 Reinforce Layer

Reinforce sits above Rebuild.

Act 1 establishes the conceptual hierarchy:

> **Sortie resets temporary power.**  
> **Rebuild resets the current growth cycle.**  
> **Reinforce changes the underlying rules of growth.**

Detailed Reinforce/Act 2 reset rules are intentionally deferred.

---

# 7. Standard Sortie Loop

1. Player is at Dock.
2. Select Hive Frame.
3. Equip Cores.
4. Install Relics.
5. Review loadout statistics.
6. Launch.
7. Begin at Wave 1.
8. Enemies approach from around the Hive.
9. Hive/Cores fight automatically.
10. Enemies provide Salvage and persistent drops.
11. Player purchases temporary run power.
12. Player reaches increasingly difficult waves.
13. Directives modify the run at milestone points.
14. Furnace may be used for a serious push.
15. Player dies or Extracts.
16. Sortie summary is shown.
17. Persistent rewards are retained.
18. Player returns to Dock.
19. Spend Scrap in Workshop and manage persistent systems.
20. Launch another Sortie.
21. Eventually Rebuild when the cycle reaches a meaningful wall.

---

# 8. Every Sortie Begins at Wave 1

This is a fixed design rule.

There is:

- no starting-Wave selector;
- no saved frontier start;
- no normal Frontier Hold;
- no automatic retreat farming;
- no Route A/B.

The player should **feel permanent growth by replaying solved waves dramatically faster**.

Solved content is compressed through:

- overwhelming account power;
- spawn acceleration;
- reduced transition delay;
- game-speed unlocks;
- later Process automation.

It is not bypassed by starting halfway through the run.

---

# 9. Wave Structure

## 9.1 Normal Waves

Most waves contain ordinary enemy compositions based on a controlled threat budget.

Difficulty should increase continuously rather than relying on huge isolated cliffs.

## 9.2 Boss Waves

Every 10th Wave is a Boss Wave:

- W10;
- W20;
- W30;
- etc.

Bosses provide:

- predictable rhythm;
- greater rewards;
- first-clear milestones;
- possible Relic/blueprint discovery;
- authored combat mechanics.

Bosses should not simply be normal enemies with enormous HP.

## 9.3 Major Milestones

Every 25 or 50 Waves can carry additional significance.

Major systems often unlock around milestone Waves, but exact Wave gates remain balance targets rather than immutable design rules.

---

# 10. Controlled Wave Variation

Normal Waves use **controlled procedural variation**.

The goal is to avoid identical runs without making difficulty random and unbalanceable.

Each Wave or Wave band specifies:

- intended threat budget;
- primary enemy family;
- optional secondary families;
- density band;
- permitted elite substitutions;
- allowed formations;
- spawn timing limits.

## Variables Allowed to Vary

- exact enemy count within a narrow range;
- compatible enemy subtype;
- spawn angle around the Hive;
- formation pattern;
- number of approach groups;
- stagger timing;
- elite substitution;
- equivalent support unit selection.

## Variables That Should Stay Controlled

- total expected effective HP;
- total expected incoming damage;
- total intended threat;
- reward budget.

Example:

### Wave 87 — Armoured Assault

Threat Budget: 100

Possible seed A:

- 10 Armoured enemies;
- 4 Skirmishers.

Possible seed B:

- 8 Armoured enemies;
- 5 Skirmishers;
- 1 Elite.

Both should have broadly comparable expected difficulty.

Boss Waves should be more deterministic.

A Sortie's RNG seed should be retained in telemetry so unusual encounters can be reproduced during balance work.

---

# 11. Enemy Families

## Basic
Straightforward baseline threat.

## Swarm
Large numbers of weak enemies. Rewards splash damage and rapid target acquisition.

## Skirmisher
Fast-moving attackers that increase positional and targeting pressure.

## Armoured
High Hull/Armor enemies that reward penetration and sustained damage.

## Shielded
Enemies with meaningful Shield layers and anti-shield requirements.

## Sniper
Long-range pressure unit.

**Important rule:** every enemy must eventually advance into range of the lowest-range valid player weapon. No Core may become permanently useless because an enemy refuses to enter legal range.

## Support
Enemies that heal, shield, buff or otherwise assist other enemies.

## Elite
Enhanced variants with special modifiers.

## Boss
Authored major encounter.

---

# 12. Approximate Enemy Introduction

| Wave Range | Main New Combat Idea |
|---|---|
| W1–9 | Basic enemies |
| W10–19 | Swarm |
| W20–39 | Skirmishers |
| W40–69 | Armoured units |
| W70–99 | Shielded units |
| W100–139 | Snipers |
| W140–179 | Support units |
| W180–219 | Mixed formations |
| W220–259 | Elite modifiers |
| W260–299 | Complex mixed compositions |
| W300 | Act 1 climax |

Exact positions require simulation and playtesting.

Avoid repeatedly introducing a major system and a major enemy mechanic on the same Wave.

---

# 13. Central Hive Combat Presentation

The combat arena has one obvious visual centre: the **Hive**.

The Hive sits slightly below the exact screen centre so that:

- approaching enemies have more visible space above it;
- UI can occupy the lower portion of the screen;
- radial enemy movement remains readable;
- the Hive remains visually dominant.

Enemies approach from all directions.

The camera remains fixed.

The player should understand combat at a glance through:

- enemy density;
- formation;
- Core activity;
- shield state;
- Boss movement;
- visible projectile/ability behaviour.

---

# 14. Hive Frames

Hive Frames define broad build archetypes.

They are not simply linear upgrades.

Potential Act 1 examples:

## Bastion Frame

Strengths:

- Hull;
- Shield;
- defensive Core capacity.

Trade-off:

- lower offensive flexibility.

## Swarm Frame

Strengths:

- more Core slots;
- build flexibility.

Trade-off:

- weaker individual Core efficiency or central durability.

## Reactor Frame

Strengths:

- Furnace/Heat interaction.

Trade-off:

- lower baseline survivability.

## Harvester Frame

Strengths:

- utility/economy;
- resource efficiency.

Trade-off:

- lower direct combat potential.

Frame selection should substantially change the player's build and visually alter the central Hive.

---

# 15. Frame Progression

The player begins with a balanced starter Frame.

Additional Frames may come from:

- major Wave milestones;
- Foundry blueprints;
- Research;
- Challenges.

Frames should remain meaningful sidegrades/archetypes for as long as possible rather than becoming immediately obsolete.

---

# 16. Core System

Cores are autonomous combat machines operating around the Hive.

They may orbit, reposition or hold defensive positions according to their behaviour.

Every fabricated Core is a physical instance with a stable identity. Instance identity carries that copy's Core Level and fitted Relics.

The UI calls them simply **Cores**.

---

# 17. Core Categories

## Weapon Cores

Potential families:

- Pulse;
- Beam;
- Flak;
- Lance;
- kinetic;
- explosive.

## Defense Cores

Potential roles:

- Barrier;
- Repair;
- interception;
- armor support.

## Utility Cores

Potential roles:

- Salvage;
- targeting;
- debuff;
- support;
- collection.

---

# 18. Core Visual Behaviour

Core behaviour should be visually distinct.

### Flak Core

- remains close to Hive;
- rapidly repositions;
- sprays close-range enemies.

### Beam Core

- medium/outer orbit;
- tracks targets smoothly;
- visible beam identity.

### Lance Core

- slow outer movement;
- deliberate high-impact shots.

### Barrier Core

- maintains defensive geometry;
- visibly contributes to Shield effects.

### Repair Core

- works close to the Hive;
- produces obvious repair pulses.

### Utility Core

- may move outward briefly to mark targets, collect resources or perform support actions.

The player should be able to **see their build working**.

---

# 19. Core Durability

Normal enemies damage the **Hive**, not individual Cores.

Cores do not normally have separate HP bars.

Rare special mechanics may temporarily:

- jam;
- disable;
- suppress;
- disrupt

a Core.

These effects must be clearly communicated.

---

# 20. Core Slot Progression

Act 1 target:

- approximately 2–3 Core slots early;
- approximately 5–6 by late Act 1.

Individual Cores should remain visually and strategically important.

---

# 21. Duplicate Cores

Duplicate Core types may be equipped simultaneously.

Example:

- 3 Pulse Cores;
- 1 Barrier Core;
- 1 Salvage Core.

This enables specialised builds.

Copies of the same type:

- share Core Mastery;
- have independent Core Levels;
- have independent Relic loadouts;
- retain stable physical identities when fitted, stored or moved between slots.

Limits may come from:

- Frame capacity;
- slot categories;
- Core restrictions.

---

# 22. Core Levels

Each physical Core copy has its own **Core Level**.

Example:

> Pulse Core · Copy 2
> Core Level 7
> Mastery 12

The player spends Scrap while Docked to raise that copy's Core Level. Core Levels persist between normal Sorties within the current Rebuild Cycle and reset on Rebuild.

Core Levels cannot be purchased with Salvage and cannot be raised during a Sortie.

Mastery belongs to the Core type rather than the physical copy and remains when Core Levels reset.

---

# 23. Core Mastery

Core Mastery belongs to the Core type, is earned through use, and is permanent and deliberately long-lived.

Duplicate copies of the same Core type contribute to and benefit from the same Mastery progression.

It should not be realistically maxed within the opening hours or necessarily within Act 1.

Mastery may improve:

- base effectiveness;
- Core Level scaling;
- firing behaviour;
- special effects;
- socket access;
- targeting options;
- milestone bonuses.

Possible conceptual milestones:

| Mastery | Example Reward |
|---:|---|
| 5 | base effectiveness bonus |
| 10 | first behavioural modifier |
| 20 | additional Relic socket |
| 30 | scaling improvement |
| 50 | evolved mechanic |
| 75 | advanced synergy |
| 100 | major mastery effect |

Exact values are provisional.

---

# 24. Core Acquisition

New Core types should come from a mixture of:

- Wave milestones;
- enemy drops;
- Core fragments;
- blueprints;
- Foundry fabrication;
- Challenge rewards.

Preferred loop:

> **Combat discovers → Foundry constructs → player equips.**

---

# 25. Relics

Relics are augmentations installed directly into Cores.

There is no standalone Reliquary system.

Relics are fitted per physical Core instance. Two copies of the same Core type may carry different Relic loadouts even though they share Mastery.

Relics deepen Core buildcraft rather than functioning as another separate account-wide stat screen.

---

# 26. Relic Sockets

Different Cores can have different:

- socket counts;
- socket types;
- socket unlock milestones.

Possible socket classes:

- Power;
- Optical;
- Ballistic;
- Shield;
- Reactor;
- Sensor;
- Utility;
- Industrial;
- Universal.

Example:

### Phase Beam Core

- Optical socket;
- Power socket;
- Universal socket at Mastery 25.

---

# 27. Relic Effects

Relics should primarily have **authored mechanical effects**, not large random stat rolls.

Examples:

### Resonant Prism II

> Beam can chain once at 45% effectiveness.

### Capacitor Shard III

> Fire rate −10%. Damage ×1.45.

### Salvage Matrix II

> Enemies killed by this Core have increased material drop chance.

Avoid turning Act 1 into random-affix inventory management.

---

# 28. Relic Duplication and Stacking

Relics are inventory items.

If the player owns two copies of a Relic, both may be equipped to different compatible Cores.

A Relic defines whether multiple copies may be installed into the **same Core**.

Most should not stack within one Core unless stacking is deliberately part of the design.

---

# 29. Relic Removal

Relics can be freely removed and reassigned while Docked.

No destruction.

No extraction fee.

Experimentation is encouraged.

---

# 30. Relic Upgrading

Relics use a small number of meaningful tiers, for example:

> I → II → III

Upgrading may require:

- duplicate Relics;
- Foundry materials;
- Challenge rewards;
- blueprint progression.

Relics should not become another 100-level grind.

---

# 31. Relic Acquisition

Relics may be:

- discovered from bosses;
- earned from Challenges;
- unlocked through milestones;
- found as blueprints;
- fabricated/upgraded through Foundry.

The Foundry should remain connected to Relic progression.

---

# 32. Temporary Run Upgrade Shop

During a Sortie the player spends Salvage in three major categories:

> **ATTACK | DEFENSE | ECONOMY**

The shop occupies a substantial portion of the lower Sortie interface while combat remains visible.

---

# 33. Attack Upgrades

Initial options:

- Weapon Power;
- Cycle Rate.

Later possibilities:

- Critical Chance;
- Critical Factor;
- Armor Penetration;
- Targeting Speed.

Do not display all options from the first run.

---

# 34. Defense Upgrades

Initial options:

- Hull;
- Shield Capacity.

Later possibilities:

- Shield Regeneration;
- Armor;
- Emergency Repair;
- Evasion if it proves balanceable.

---

# 35. Economy Upgrades

Initial:

- Salvage/Kill;
- Salvage/Wave.

Later:

- Scrap/Kill;
- Scrap/Wave;
- Fragment Chance;
- Ash Yield;
- Data Yield.

Economy creates a core run decision:

> **Spend for immediate survival, or invest in growth that must repay itself before the Sortie ends?**

---

# 36. Effective Upgrade Levels

Conceptually:

> **Effective Level = Workshop Starting Level + Sortie Purchased Levels**

Workshop raises the starting point.

Salvage purchases the temporary levels above it.

Run upgrades should have caps so progression remains balanceable.

---

# 37. Salvage

Salvage is temporary Sortie currency.

Earned from:

- kills;
- waves;
- bosses;
- economy modifiers.

Spent on:

- Attack upgrades;
- Defense upgrades;
- Economy upgrades.

Salvage resets when the Sortie ends.

This distinction must be taught immediately.

---

# 38. Scrap

Scrap persists across normal Sorties within the current Rebuild Cycle.

Earned from:

- enemies;
- Wave completion;
- Bosses;
- first clears;
- Economy upgrades;
- Extraction bonus.

Spent primarily in Workshop and on individual Core Levels while Docked.

Scrap resets on Rebuild.

---

# 39. Matter

Matter is earned by Rebuilding.

Matter survives Rebuild.

Matter purchases should be among the strongest permanent improvements in the game.

Matter is the first major exponential growth engine.

---

# 40. Secondary Resources

Possible secondary resources include:

- Core fragments;
- Foundry materials;
- Ash;
- Data;
- Relics;
- fabrication components.

These should not all appear globally at all times.

Show a resource prominently where it is relevant.

---

# 41. Workshop

Workshop is the primary **Rebuild-cycle progression system**.

It answers:

> **How should I make future Sorties in this cycle start stronger?**

Workshop levels survive normal Sorties but reset on Rebuild.

---

# 42. Workshop Categories

Workshop mirrors the run shop:

> ATTACK | DEFENSE | ECONOMY

Example:

### Weapon Power

Starting Level:

> 34 → 35

Effect:

> ×3.84 → ×3.91

Cost:

> 1.82K Scrap

The impact must be immediately understandable.

---

# 43. Workshop Progression Feel

A successful normal Sortie should usually provide enough Scrap for noticeable improvement.

Early game target:

> roughly 10–25% effective starting-power improvement from a meaningful spending session.

The exact value is a balance target, not a fixed rule.

Normal Workshop growth should not provide the giant jumps reserved for Rebuild.

---

# 44. Workshop and Rebuild

Workshop resets on Rebuild intentionally.

The hierarchy is:

> Salvage improves this Sortie.  
> Scrap improves this cycle.  
> Matter improves every future cycle.

Permanent Matter upgrades may eventually grant:

- baseline Workshop levels;
- lower Workshop costs;
- stronger Workshop scaling.

This allows later Rebuilds to begin from increasingly advanced foundations.

---

# 45. Extraction

Extraction voluntarily ends the current Sortie.

Death does **not** erase persistent resources already earned.

Extraction therefore provides optimisation rather than insurance.

Initial conceptual reward:

> approximately +10–15% Scrap from that Sortie.

The player decides:

> push further and risk dying, or Extract now and take the bonus.

No unique Extraction currency is required.

---

# 46. Directives

Directives are temporary, run-defining choices.

They reset after the Sortie.

Directives should be impactful enough to alter how the player approaches the run.

Avoid:

> +5% shield.

Prefer:

> ×1.5 Shield Capacity, −20% Weapon Power.

---

# 47. Directive Cadence

Initial target:

- first Directive around W50;
- later selections at major intervals;
- perhaps approximately every 50 Waves;
- limited total choices in an Act 1 run.

Exact cadence must be tested.

---

# 48. Directive Examples

## Overcharge

Weapon output ×1.30.  
Incoming damage ×1.15.

## Scavenger Protocol

Scrap ×1.35.  
Weapon output ×0.90.

## Reactive Array

Shield Capacity ×1.40.  
Shield Regeneration ×0.75.

## Pack Hunter

Splash effectiveness improves.  
Enemy density increases.

## Burn Hot

Heat effectiveness improves.  
Heat consumption increases.

Directives should enable distinct run identities.

---

# 49. Foundry

Foundry is one of the primary backbone systems of Hiveworks.

Identity:

> **What should I produce, and what long-term capability am I building toward?**

Foundry persists:

- across Sorties;
- through Rebuild;
- while Docked;
- offline.

---

# 50. Foundry Structure

Foundry contains two related loops:

## Processing

Continuous material conversion.

## Fabrication

Discrete timed item construction.

---

# 51. Material Processing

Material chains should exist but remain understandable.

Example:

> Recovered Material → Alloy → Tempered Component

Act 1 production chains should normally remain around two or three stages rather than becoming a full factory-management game.

---

# 52. Material Mastery

Material progression should take far longer than it currently does.

Producing a material grants Mastery XP for that material.

Example:

> Produce Temper Bar → Temper Bar Mastery increases.

Mastery may improve:

- processing time;
- output;
- efficiency;
- downstream recipes;
- rare output chance.

---

# 53. Material Mastery Milestones

Illustrative structure:

| Mastery | Example Effect |
|---:|---|
| 1 | basic recipe |
| 5 | output improvement |
| 10 | refined recipe |
| 20 | efficiency improvement |
| 30 | output multiplier |
| 50 | advanced component |
| 75 | rare-material interaction |
| 100 | major mastery reward |

Act 1 should **not** require maxing every material.

Foundry should still have meaningful growth remaining when the player reaches Reinforce.

---

# 54. Fabrication

Fabrication is not instant.

Jobs take real time.

They continue:

- during Sorties;
- while Docked;
- offline.

The system should feel like manufacturing rather than another shop.

---

# 55. Fabrication Time Philosophy

Illustrative targets:

- tutorial job: ~30 seconds;
- early component: 2–5 minutes;
- early Core: 5–15 minutes;
- mid-Act project: 15–45 minutes;
- significant late-Act project: 1–3 hours.

Exact values require balance testing.

The first Foundry experience must not be “come back in three hours.”

---

# 56. Fabrication Slots

At Foundry unlock:

> **1 active fabrication slot**

Additional parallel fabrication is unlockable later.

One slot initially gives crafting choices real opportunity cost.

---

# 57. Fabrication Opportunity Cost

A meaningful decision might be:

- fabricate a new Core;
- build a Worker Drone Fabricator;
- build Research infrastructure;
- upgrade a Relic.

Because crafting consumes time, the player cannot instantly buy every available option.

---

# 58. Foundry During Combat

Fabrication may complete during a Sortie.

New equipment cannot be fitted until the Sortie ends.

Example toast:

> **HEAVY LANCE COMPLETE**  
> Available next Sortie.

Run identity remains locked once launched.

---

# 59. Worker Drones

Worker Drones replace the previous Network concept.

They are actual industrial workers, not abstract combat multipliers.

Identity:

> **Where should the Hive's limited workforce be allocated?**

---

# 60. Worker Drone Jobs

Potential assignments:

- material processing;
- fabrication;
- Research;
- Worker Drone production;
- construction;
- passive salvage operations.

Worker Drones are assigned to actual work.

---

# 61. Worker Drone Efficiency

Individual jobs may define:

- minimum workers;
- efficient worker range;
- hard cap.

Example:

### Heavy Lance Fabrication

Minimum: 1  
Efficient up to: 4  
Hard cap: 8

This prevents “put every Drone into one task” from always being optimal.

---

# 62. Worker Drone Production

Worker Drones can eventually help manufacture additional Worker Drones.

This creates an idle-game investment decision:

> **Use workers to produce resources now, or divert them into producing more workers for the future?**

Worker growth should be slow enough to remain meaningful.

---

# 63. Worker Drone Scope

Worker Drones should not directly provide arbitrary combat multipliers such as:

- +damage;
- +shield;
- +crit.

Their value comes from the work they perform.

---

# 64. Worker Drone Automation

Assignments begin manually.

Process later unlocks:

- Drone presets;
- minimum staffing rules;
- priority jobs;
- automatic reassignment;
- conditional workforce logic.

This prevents late-game micromanagement.

---

# 65. Foundry Construction / Yard

“Yard” should not remain a separate top-level progression system.

Construction becomes an advanced Foundry/industry layer.

Possible construction includes:

- processing equipment;
- fabrication machinery;
- Worker Drone capacity;
- Research infrastructure;
- storage;
- specialised facilities.

This keeps industrial progression cohesive.

---

# 66. Rebuild

Rebuild is the first true prestige layer.

Identity:

> **Is the current cycle worth resetting in exchange for permanent exponential growth?**

The player should experience the normal Sortie/Workshop loop repeatedly before Rebuild appears.

---

# 67. Rebuild Unlock Target

Initial target:

> around W70

plus sufficient normal Sortie experience.

Possible requirement:

- career Best W70;
- multiple completed Sorties.

Avoid arbitrary real-time locks.

---

# 68. Rebuild Reset Rules

## Reset

- current Sortie;
- Salvage;
- temporary run upgrades;
- Directives;
- Heat;
- Scrap;
- Workshop;
- Core Levels on each physical Core copy;
- Ash;
- explicitly cycle-only progression.

## Keep

- career Best Wave;
- unlocked systems;
- Hive Frames;
- Core unlocks;
- Core Mastery;
- Relics;
- Foundry;
- material Mastery;
- Research;
- Process;
- Challenge progress;
- Matter;
- long-term statistics.

---

# 69. Rebuild Reward Calculation

Matter should primarily reward:

- highest Wave achieved in the cycle;
- meaningful cycle development;
- total Scrap generated;
- significant cycle milestones.

The formula must never incentivise intentionally **not spending Scrap**.

Workshop investment should help create Rebuild value rather than reduce it.

---

# 70. Matter Shop

Matter Shop belongs inside Rebuild.

There is no separate Slag top-level system.

Potential upgrade categories:

## Offensive
Permanent Core/weapon growth.

## Defensive
Permanent Hive durability.

## Industrial
Foundry/Worker Drone progression.

## Foundation
Permanent baseline Workshop levels.

## Temporal
Rebuild effectiveness/reclaim acceleration.

Matter progression should increasingly compound.

---

# 71. Rebuild Power Feel

A meaningful Rebuild should make old walls visibly easier.

Conceptual experience:

Before Rebuild:

> W70–80 is difficult.

After Rebuild:

> W1–40 disappears.  
> W50 is easy.  
> W70 is manageable.  
> W80+ becomes the next frontier.

The first Rebuilds should feel substantial.

---

# 72. Reclaim Acceleration

Replaying solved content should not become tedious.

Reclaim acceleration may reduce:

- spawn delays;
- Wave transitions;
- downtime.

Game-speed progression also contributes.

Reclaim acceleration is primarily **time compression**, not extra combat power.

---

# 73. Furnace

Furnace is a push-resource system.

Identity:

> **Should I consume stored cycle resources to make this Sortie significantly stronger?**

---

# 74. Furnace Resources

## Ash

Earned through combat.  
Persists across normal Sorties.  
Resets on Rebuild.

## Heat

Created from Ash.  
Temporary to the current Sortie.  
Resets when the Sortie ends.

---

# 75. Furnace Channels

Potential initial channels:

## Weapons
Large temporary offensive multiplier.

## Ward
Large temporary defensive multiplier.

## Yield
Temporary economy multiplier.

Furnace bonuses should be large enough to feel like a deliberate push resource.

Conceptually closer to:

> ×1.4 / ×1.8 / ×2.5

than:

> +4%.

Exact values must be balanced.

---

# 76. Furnace Purpose

Furnace creates the decision:

> **“I have farmed enough Ash. This is the run where I seriously attempt the wall.”**

---

# 77. Research

Research is permanent long-term progression.

Identity:

> **Which underlying rule of the Hive should I improve next?**

Research survives Rebuild.

Research continues:

- during Sorties;
- while Docked;
- offline.

---

# 78. Research UI Structure

Research uses a **visual branching tree** divided into named disciplines.

The player chooses a discipline and explores that discipline's branching node map.

Branches may reconnect where appropriate.

---

# 79. Proposed Act 1 Research Disciplines

## Hive Engineering

Focus:

- Frames;
- Hull/Shield;
- Workshop;
- Core capacity;
- reclaim acceleration;
- central Hive mechanics.

## Drone Systems

Focus:

- Core behaviour;
- targeting;
- Worker Drone efficiency;
- Worker Drone manufacturing;
- combat analytics.

## Industrial Science

Focus:

- Foundry;
- processing;
- fabrication;
- material Mastery;
- production capacity.

## Computational Systems

Focus:

- Process;
- automation;
- analytics;
- smart controls;
- additional QoL features.

A future temporal/exotic discipline may appear in later Acts.

---

# 80. Research Project Philosophy

Prefer projects that provide:

- new mechanics;
- formula improvements;
- new options;
- extra queues;
- targeting behaviour;
- automation capabilities.

Small percentage nodes may exist, but they should not dominate the tree.

Research should feel like **technological breakthroughs**, not another stat shop.

---

# 81. Research Slots

Initially:

> **1 active Research project**

Later unlocks may provide:

- queued Research;
- second active slot;
- Worker Drone assistance;
- Process auto-selection.

---

# 82. Research and Worker Drones

Worker Drones can accelerate Research.

This competes with:

- Foundry processing;
- fabrication;
- Drone production;
- salvage operations.

Research therefore participates in the broader industrial allocation game.

---

# 83. Process

Process is intended to become one of Hiveworks' signature systems.

Identity:

> **Automate behaviours the player has already learned.**

Process includes both:

- quality-of-life unlocks;
- automation capabilities.

---

# 84. Process Progression Philosophy

Process begins small and understandable.

It evolves through:

> QoL → Actions → Priorities → Conditions → Cross-System Logic → Run Profiles

The mature system should resemble a simplified Gambit-style behavioural editor without requiring programming knowledge.

---

# 85. Process Tier 1 — Quality of Life

Possible purchases:

- ×10 Buy;
- Buy Max;
- extra context buttons;
- Core contribution percentages;
- economy ROI display;
- time-to-afford display;
- repeat recipe button;
- saved basic presets;
- additional information panels;
- smart crafting assistance.

These should genuinely improve interaction rather than provide meaningless filler progression.

---

# 86. Process Tier 2 — Simple Actions

Possible automations:

- auto-buy Attack;
- auto-buy Defense;
- auto-buy Economy;
- repeat Foundry recipe;
- simple Worker Drone preset application.

---

# 87. Process Tier 3 — Priorities

Possible controls:

- upgrade priority list;
- Salvage reserve;
- spending ratios;
- Foundry priority;
- Worker Drone allocation presets.

Example:

> Attack 50%  
> Defense 30%  
> Economy 20%

---

# 88. Process Tier 4 — Conditions

Examples:

> IF Wave ≥ 100  
> THEN Economy target = 0%.

> IF Survivability Pressure = High  
> THEN prioritize Defense.

This is where Process begins transitioning from automation to behaviour design.

---

# 89. Process Tier 5 — Cross-System Logic

Examples:

> IF current Wave ≥ 95% of Best  
> AND Ash ≥ 200  
> THEN activate Furnace Push profile.

> IF Foundry fabrication slot is empty  
> THEN fabricate tracked recipe.

> IF Research completes  
> THEN begin next queued project.

---

# 90. Process Tier 6 — Run Management

Potential late capabilities:

- Auto Extract;
- Auto Launch;
- farm profiles;
- push profiles;
- Challenge profiles;
- smarter Worker Drone reassignment;
- Directive preferences.

Full closed-app autonomous Sortie simulation remains deferred beyond standard Act 1 progression.

---

# 91. Process Mastery Requirements

Automation should generally unlock after natural manual use.

Examples:

- Sortie upgrade automation after significant manual Attack, Defense and Economy purchasing;
- Directive logic after repeated Directive selection;
- Foundry repeat after repeated fabrication;
- Worker Drone presets after genuine workforce management.

These conditions must not encourage pointless repetitive actions simply to unlock automation.

---

# 92. Process Points

Process may retain a dedicated progression resource.

Process Points should come from meaningful account accomplishments such as:

- major Best-Wave milestones;
- Rebuild milestones;
- Foundry achievements;
- Research milestones;
- Challenge clears;
- automation-related mastery.

The player chooses which useful capabilities to unlock first.

---

# 93. Process Rule Builder

Late Process uses a mobile-friendly rule builder.

Example:

> **WHEN**  
> Wave ≥ [150]  
>
> **AND**  
> Threat = [Survivability]  
>
> **THEN**  
> Spend Profile → [Defense]

Another:

> **WHEN**  
> Foundry Queue = Empty  
>
> **THEN**  
> Repeat → [Tracked Recipe]

Rules are assembled through selectors, chips and numeric fields.

No typed code is required.

---

# 94. Process Profiles

Later Process supports saved profiles.

## Farm

- high Economy;
- planned Extraction;
- conservative Furnace;
- production-focused Worker Drone allocation.

## Push

- reduced late-run Economy;
- defensive pressure response;
- Furnace enabled;
- no automatic Extraction.

## Challenge

- custom rules appropriate to Challenge restrictions.

Profiles should remain editable.

---

# 95. Challenges

Challenges are the only alternate-run framework in Act 1.

There is no Echo system.

Identity:

> **Can this account solve a modified version of the normal rules?**

Challenges reuse the normal Sortie engine.

---

# 96. Challenge Examples

## Glass Hive

Reduced Hull.

## Mono Core

Restricted Core slots or Core families.

## Swarm Pressure

Greatly increased enemy density.

## Cold Furnace

Furnace unavailable.

## Limited Economy

Economy upgrades restricted.

## Industrial Silence

Selected persistent advantages disabled.

Challenges can test both restrictions and unusual encounter conditions.

---

# 97. Challenge Presentation

Before launch, show:

## Restriction
Exactly what changes.

## Goal
Example: Reach W150.

## Reward
Exactly what is earned.

## Disabled Systems
Explicit list.

## Current Best
The player's best Challenge performance.

Never hide important Challenge rules until after launch.

---

# 98. Challenge Rewards

Rewards should often strengthen or expand the system being tested.

Prefer:

- unique Research nodes;
- Process capabilities;
- Relics;
- Foundry blueprints;
- system-specific permanent improvements.

Avoid making every reward simply global damage.

---

# 99. Specialists

Specialists are deferred from Act 1.

Build identity is already provided through:

- Hive Frames;
- Cores;
- Relics;
- Research;
- Matter;
- Directives.

Specialists may be reconsidered in Act 2.

---

# 100. Capital

Capital is deferred from Act 1.

It fits better at a later scale involving larger infrastructure or fleet-level development.

Existing implementation is not a reason to force it back into Act 1.

---

# 101. Explicitly Removed Systems

## Sectors
Removed. Waves are the single combat progression coordinate.

## Frontier Hold / automatic retreat farming
Removed from standard play. Death ends the Sortie.

## Starting-Wave selection
Removed. Every Sortie starts at W1.

## Route A / Route B
Removed from current Act 1 design.

## Existing Network
Removed. Strike/Ward/Yield-style combat multipliers are replaced by real Worker Drone labour.

## Echo
Removed. Challenges cover alternate combat tests.

## Standalone Reliquary
Removed. Relics install directly into Cores.

## Yard as top-level system
Removed. Construction belongs under Foundry/industry.

## Slag as top-level system
Removed. Matter upgrades belong inside Rebuild.

---

# 102. Act 1 Progression Map

Initial target progression:

| Career Best | Major Unlock / Expansion |
|---:|---|
| Start | Sorties, starter Frame, starter Cores, basic Salvage upgrades |
| First defeat | Scrap + Workshop |
| W10 | Full Attack/Defense upgrade categories |
| W20 | Foundry |
| W30 | Worker Drones |
| W40 | Expanded Economy upgrades |
| W50 | Directives |
| W70 | Rebuild |
| W90 | Foundry construction / advanced fabrication |
| W110 | Deeper Relic/socket progression |
| W140 | Furnace |
| W170 | Research |
| W210 | Process |
| W250 | Challenges |
| W275 | Late Act 1 mastery expansion |
| W300 | Act 1 Boss + Reinforce |

This table is a **balance target**, not an immutable design promise.

---

# 103. Additional Gate Requirements

Some systems should require more than Best Wave.

Possible examples:

## Rebuild

- Best Wave requirement;
- several completed Sorties.

## Process

- Best Wave requirement;
- multiple Rebuilds;
- meaningful manual interaction history.

## Challenges

- Best Wave requirement;
- relevant system familiarity.

## Advanced Relics

- Core Mastery;
- Foundry capability.

Avoid arbitrary real-time gates.

---

# 104. Act 1 Time Targets

Approximate active-equivalent progression targets:

| Milestone | Initial Target |
|---|---:|
| First defeat | 3–5 min |
| Foundry | 30–60 min |
| Worker Drones | 45–90 min |
| Directives | 1–2 h |
| First Rebuild | 2–4 h |
| Advanced Foundry | 4–7 h |
| Relic depth | 6–10 h |
| Furnace | 8–14 h |
| Research | 12–20 h |
| Process | 24–36 h |
| Challenges | 35–55 h |
| Reinforce / W300 | 70–100 h active-equivalent |

For an idle player, Act 1 may unfold over roughly 1–3 weeks or longer.

These are telemetry targets, not time gates.

---

# 105. Sortie Duration Targets

## Opening
3–5 minutes.

## Early Act 1
5–12 minutes.

## Mid Act 1
10–20 minutes.

## Late Act 1
15–30 minutes.

Exceptional push runs may reach 30–40 minutes.

If routine runs become too long, use:

- speed progression;
- reclaim acceleration;
- shorter transitions;
- automation.

---

# 106. Game Speed

Start:

> ×1

Potential progression:

- ×1.5;
- ×2;
- ×3.

Game speed may be unlocked through Rebuild, Research, Process or later progression.

Major decisions and onboarding can pause independently of game speed.

---

# 107. Offline Progression

During Act 1, if the game closes during an active Sortie:

> **The Sortie freezes.**

On return it resumes from the same state.

Persistent systems continue where appropriate:

- Foundry processing;
- fabrication;
- Research;
- industrial Worker Drone jobs.

Full autonomous offline Sorties are deferred to later progression.

---

# 108. UI/UX Vision

The current visual style can remain polished, but the information architecture should be fundamentally improved.

The problem to solve is not primarily appearance.

It is:

> **The player often cannot see enough information at the place where they need to make a decision.**

The redesigned interface should feel like:

> **one persistent game world with panels around it**

rather than a collection of disconnected pages.

---

# 109. Top-Level Mobile Navigation

Recommended bottom navigation:

## SORTIE
Combat and temporary run progression.

## DOCK
Hive preparation, Workshop and Rebuild.

## SYSTEMS
Foundry, Worker Drones, Furnace, Research and Process.

## MORE
Challenges, Codex, Stats, Settings and secondary utilities.

Locked systems should not create a huge grey list.

---

# 110. Persistent Hive Presentation

At Dock:

- Hive remains visible;
- equipped Cores are visible;
- player interacts through sheets/panels.

During Sortie:

- the same Hive becomes the combat centre.

After Sortie:

- the same Hive is analysed and upgraded.

This provides strong visual continuity.

---

# 111. Sortie Screen Layout

Portrait target.

## Top Status — ~8–10%

Show:

- Salvage;
- Scrap;
- Wave;
- game speed.

## Combat Arena — ~45–50%

Show:

- Hive;
- Cores;
- enemies;
- projectiles;
- barriers;
- combat effects.

## Combat Status Strip

Show:

- Hull;
- Shield;
- current threat/pressure;
- Boss HP when relevant;
- optional run time.

## Bottom Interaction — ~35–40%

Primary tabs:

> UPGRADES | CORES | DIRECTIVES

Inside Upgrades:

> ATTACK | DEFENSE | ECONOMY

Combat remains visible while purchasing.

---

# 112. Default Combat Information

Visible without expansion:

- Wave;
- Hull;
- Shield;
- Salvage;
- Scrap;
- speed;
- run time;
- current pressure diagnosis;
- Boss HP where relevant.

More detailed statistics appear through expansion/tap.

---

# 113. Floating Combat Numbers

Damage numbers should be restrained by default.

Possible settings:

- Minimal;
- Standard;
- Detailed.

Default emphasis:

- important crits;
- large hits;
- shield breaks;
- milestone effects.

Do not obscure radial combat with constant number spam.

---

# 114. Upgrade Card Design

Example:

### WEAPON POWER

Lv 38

Current:

> ×4.82

Next:

> ×4.94

Cost:

> 812 Salvage

Button:

> BUY

Later QoL may add:

> ×10 | MAX | AUTO

---

# 115. Core Combat Card

Compact view:

### PHASE BEAM

Core Level 42
Mastery 17

DPS:

> 18.4K

Expanded view can reveal:

- damage;
- fire rate;
- range;
- targeting;
- contribution percentage;
- Relics;
- Mastery milestones;
- special effects.

---

# 116. Dock Layout

Dock header:

- Career Best Wave;
- current Rebuild Cycle;
- Scrap;
- Matter.

Primary sections:

## LOADOUT

- Hive Frame;
- Cores;
- Relics.

## WORKSHOP

- Attack;
- Defense;
- Economy.

## REBUILD

- Matter preview;
- reset/keep information;
- Matter Shop.

A clear **LAUNCH SORTIE** action should remain easy to reach.

---

# 117. Loadout Comparison UI

Selecting a different Frame or Core should provide contextual before/after information.

Example:

Hull:

> 4.82K → 5.70K (+18.3%)

Shield:

> 2.14K → 3.02K (+41.1%)

DPS:

> 2.41K → 2.08K (−13.7%)

Core Slots:

> 5 → 6

The player should not have to leave the screen to remember their current statistics.

---

# 118. Core Detail UI

A Core detail sheet should be capable of showing:

- category;
- physical instance identity;
- Core Level;
- Mastery;
- permanent base statistics;
- Core Level scaling;
- Relic sockets;
- equipped Relics;
- milestone progress;
- special behaviours;
- contribution to current build;
- acquisition/progression information.

Advanced formulas can live in expandable details.

---

# 119. Rebuild Screen

Rebuild requires a full information-rich interface.

## Current Cycle

Show:

- Best Wave;
- total Sorties;
- Scrap generated;
- Workshop investment;
- cycle duration.

## Current Hive

Show:

- Frame;
- Core loadout;
- relevant Core stats;
- overall combat statistics.

## RESET

Explicit list.

## KEEP

Explicit list.

## GAIN

Matter gained now.

## POWER PREVIEW

Where mathematically honest, show useful before/after information.

Example:

> Permanent weapon multiplier ×1.42 → ×1.61

The player should not need to visit multiple other screens to understand the decision.

---

# 120. Systems Hub

System cards should communicate status without requiring entry.

Example:

## FOUNDRY

Temper Bar Mastery 17  
Heavy Lance: 62%

> MANAGE

## WORKER DRONES

14 / 18 assigned

> MANAGE

## FURNACE

Ash 428  
Heat 0

> MANAGE

## RESEARCH

Smart Targeting  
71%

> MANAGE

## PROCESS

12 capabilities  
4 active rules

> MANAGE

Only unlocked systems appear.

---

# 121. More Screen

Show:

- unlocked secondary systems;
- Codex;
- Stats;
- settings;
- **one next major unlock**.

Example:

> **NEXT SYSTEM**  
> Research — Best Wave 170  
> Unlock permanent branching technology trees.

Avoid displaying every future system at once.

---

# 122. Progressive Disclosure

The UI gains complexity as the player gains mastery.

A new player does not need:

- ROI information;
- auto-buy settings;
- rule states;
- detailed DPS breakdowns;
- five buy modes.

An advanced player does.

Process and Research can unlock improved control surfaces and information.

This makes UI sophistication itself part of progression.

---

# 123. Universal Information Rule

Every decision screen should answer:

1. What is this?
2. What do I currently have?
3. What changes if I act?
4. What does it cost?
5. What trade-off am I making?
6. Is this temporary, cycle-level or permanent?

If those questions cannot be answered from the current screen, the UI is incomplete.

---

# 124. Toast and Notification System

Use three levels.

## Minor Toast

Short-lived.

Example:

> Research milestone reached.

## Action Toast

Clickable.

Example:

> **HEAVY LANCE COMPLETE**  
> Available next Sortie.  
> VIEW

## Major Unlock

Persistent until interacted with.

Example:

> **FOUNDRY ONLINE**  
> Process recovered material into permanent equipment progression.  
> OPEN FOUNDRY

Major unlocks should queue rather than overlap.

---

# 125. Onboarding Philosophy

Every tutorial should ideally:

1. explain one concept;
2. require one real action;
3. show one immediate payoff;
4. end.

Avoid long slide sequences.

Use actual gameplay as the tutorial.

Pause only where necessary.

---

# 126. Exact Opening Experience

## Initial State

Starter Hive Frame and starter Cores are already equipped.

Primary CTA:

> **LAUNCH**

No loadout decisions are required before the first run.

---

# 127. First Salvage Tutorial

When enough Salvage is available:

Combat pauses.

Highlight a useful purchase.

> **SALVAGE**  
> Enemies drop Salvage during a Sortie.  
> Spend it now — Salvage resets when the Sortie ends.

Player buys the upgrade.

Show immediate stat change.

Resume.

---

# 128. First Defensive Guidance

Only trigger if it matches real combat pressure.

Example:

> Incoming pressure is increasing.  
> Hull and Shield upgrades can extend this Sortie.

Do not force a scripted purchase when unnecessary.

---

# 129. First Defeat

Use:

# SORTIE COMPLETE

Show:

- Wave reached;
- New Best indicator;
- Scrap earned;
- enemies destroyed;
- significant drops.

Then introduce Scrap/Workshop.

---

# 130. First Workshop Tutorial

> **SCRAP**  
> Scrap survives normal Sorties.  
> Spend it in Workshop to make future Sorties begin stronger.

Guide one purchase.

Show:

> Next Sortie starts at Weapon Power Lv1.

Clarify:

> Workshop progress lasts until Rebuild.

---

# 131. Second Sortie

At launch:

> **STRONGER START**  
> Workshop upgrades carried into this Sortie.

The player has now learned the core temporary-versus-cycle loop.

---

# 132. Foundry Onboarding

Foundry should unlock only when the player already possesses enough material for a useful first action.

Tutorial:

1. explain recovered material;
2. show Processing;
3. start a short job;
4. show Material Mastery;
5. explain offline progress.

Never introduce Foundry as an empty screen.

---

# 133. Worker Drone Onboarding

Teach one real assignment.

Example:

> Assign 1 Worker Drone to Temper Bar Processing.

Immediately show:

> Processing time 60s → 52s

Then explain Worker Drones are limited and must be allocated.

---

# 134. Directive Onboarding

At the first Directive milestone:

Combat pauses.

> **DIRECTIVE AVAILABLE**  
> Directives strongly alter this Sortie only.

Show three options.

Player selects one.

Immediately show changed effects.

Resume.

---

# 135. Rebuild Onboarding

First Rebuild is a major progression moment.

Show:

## RESET

Clear list.

## KEEP

Clear list.

## GAIN

Matter.

Explain:

> Rebuild trades current-cycle development for permanent growth.

Do not force the player to confirm immediately.

---

# 136. Relic Onboarding

First Relic discovery:

> **RELIC RECOVERED**

At Dock:

- guide player to a compatible Core;
- highlight an empty socket;
- install Relic;
- show changed effect/stat.

Done.

---

# 137. Furnace Onboarding

Ensure the player already has enough Ash to produce a meaningful effect.

Teach:

1. Ash persists across Sorties in this cycle;
2. Ash converts to Heat;
3. Heat is temporary;
4. Heat is allocated to a channel;
5. show a large immediate multiplier.

---

# 138. Research Onboarding

Reveal only a small portion of the first Research discipline.

Player:

1. selects a project;
2. sees its duration;
3. sees its permanent effect;
4. learns Research continues offline.

Do not reveal the entire mature tree immediately.

---

# 139. Process Onboarding

Use player history.

Example:

> **PROCESS ONLINE**  
> You've manually purchased 428 Sortie upgrades.  
> Process can now automate behaviours you've already learned.

Guide one simple automation or QoL purchase.

Do not expose the mature rule builder on first open.

---

# 140. Challenge Onboarding

Before launch show:

- restriction;
- goal;
- reward;
- disabled systems;
- current best.

Require confirmation.

No hidden Challenge rules.

---

# 141. Balance Philosophy

Balancing is a first-class part of the design.

The new structure separates four major curves:

## Enemy Curve
How quickly pressure rises with Wave.

## Salvage Curve
How quickly temporary Sortie power can grow.

## Scrap Curve
How quickly the next Sortie's starting power improves.

## Matter Curve
How quickly future Rebuild Cycles become stronger.

These should be tuned independently.

---

# 142. Balance by Time and Behaviour

Do not primarily ask:

> Is 2,000 Salvage expensive?

Ask:

> How many seconds of expected income does this upgrade cost at W80?

Do not ask:

> Is 50K Scrap generous?

Ask:

> How much stronger will the player's next Sortie begin after spending it?

This remains meaningful as raw numbers grow.

---

# 143. Enemy Scaling

Enemy formulas should be smooth.

Conceptually:

> Enemy HP = Base × Growth^Wave × Role × WaveModifier

> Enemy Damage = Base × Growth^Wave × Role × WaveModifier

Bosses sit above the normal curve without creating absurd isolated cliffs.

---

# 144. Boss Balance Rule

Good progression:

- W99 is challenging;
- W100 Boss is a meaningful peak;
- W101 remains relatively close to the new difficulty level.

Bad progression:

- W100 is ten times harder;
- W101 becomes trivial again.

Bosses are peaks on an upward slope.

---

# 145. Multiple Difficulty Axes

Difficulty should not scale only through HP and damage.

Use:

- density;
- speed;
- armor;
- shields;
- range;
- support units;
- formations;
- elite mechanics.

This keeps Core composition meaningful.

---

# 146. Economy Return on Investment

Economy upgrades must be mathematically monitored.

For a purchase:

> **Payback Horizon = Cost / Additional Expected Income**

An Economy upgrade is not automatically correct.

Early Economy purchases should generally repay themselves within a sensible portion of expected remaining Sortie duration.

Late Economy purchases may intentionally be bad investments.

That creates real decision-making.

---

# 147. Workshop Balance Target

After a normal successful Sortie, the player should usually be able to make noticeable Workshop progress.

Early conceptual target:

> roughly 10–25% effective starting-power improvement from meaningful spending.

Exact tuning requires simulation.

Workshop should not produce the giant leap reserved for Rebuild.

---

# 148. Normal Run Improvement Targets

Early progression:

> +2–4 Best Waves on a successful push.

Mid progression:

> +1–3.

Late Act 1:

> 0–2 may be normal.

A run can still be valuable without a New Best if it makes meaningful persistent progress.

---

# 149. Healthy Wall Target

A healthy wall generally lasts:

> **1–3 unsuccessful push attempts**

before the player solves it through one or more of:

- Workshop;
- Core loadout;
- Relics;
- Foundry;
- Furnace;
- Research;
- Rebuild.

Many runs with no meaningful movement should be treated as a balance warning.

---

# 150. Rebuild Recovery Ratio

A key prestige metric is:

> **How long does it take after Rebuild to return to the previous cycle's Best Wave?**

Initial target:

> approximately 20–40% of the original time.

Example:

If the first cycle takes three hours to reach W70, the first post-Rebuild return to that frontier should be dramatically faster.

---

# 151. Rebuild Breakthrough Target

After reclaiming old content, early Rebuilds should enable visible new progression.

Initial target:

> roughly +5–15 Best Waves across the first several post-Rebuild push attempts.

Exact Wave delta is provisional.

The rule is:

- not negligible;
- not so explosive that whole systems are skipped.

---

# 152. System Contribution Analysis

The game should eventually be able to estimate effective contribution from:

- Core base/Level/Mastery;
- temporary upgrades;
- Workshop;
- Matter;
- Relics;
- Furnace;
- Research;
- Directives;
- Frame.

Foundry/Worker Drones should primarily accelerate long-term progression rather than becoming another giant generic combat multiplier.

Process automates.

Challenges test.

---

# 153. Automated Balance Profiles

Balancing should model multiple player strategies.

## Casual
Broad spending, imperfect choices.

## Balanced
Responds sensibly to obvious pressure.

## Offensive
Damage-heavy.

## Defensive
Survivability-heavy.

## Economy First
Prioritises ROI.

## Optimiser
Near-optimal behaviour.

The normal game should not require Optimiser-level play.

Casual and Balanced profiles matter most.

---

# 154. Sortie Telemetry Summary

Every Sortie should be describable through data such as:

- Sortie number;
- RNG seed;
- starting Best Wave;
- ending Wave;
- duration;
- death cause;
- Salvage earned;
- Salvage spent;
- Attack spend share;
- Defense spend share;
- Economy spend share;
- Scrap earned;
- fragments;
- Ash;
- Data;
- Directive choices;
- Furnace use;
- New Best delta;
- death or Extraction.

This makes balance analysis run-centric.

---

# 155. Automated Balance Warnings

## WALL
Several push Sorties without New Best.

## HARD WALL
Many runs without meaningful progress.

## STEAMROLL
Unexpectedly large Best-Wave jump.

## ECON TRAP
Economy payback exceeds expected remaining run duration.

## DEAD UPGRADE
Rarely selected by viable profiles.

## DOMINANT UPGRADE
Consumes disproportionate spending across profiles.

## SYSTEM IRRELEVANT
Major system contributes negligibly long after unlock.

## SYSTEM DOMINANT
One system overwhelms intended progression.

## REBUILD WEAK
Old frontier recovery takes too long.

## REBUILD EXPLOSIVE
Rebuild skips excessive new content.

---

# 156. Real Player Telemetry Events

Useful event categories:

- Sortie start;
- run upgrade buy;
- Dock Core Level purchase with Scrap;
- Directive selection;
- Furnace activation;
- Worker Drone reassignment;
- Wave clear;
- Boss clear;
- New Best;
- Extraction;
- defeat;
- Sortie end;
- Workshop purchase;
- Foundry job started;
- fabrication complete;
- Research selected/completed;
- Process action;
- Rebuild;
- Challenge start/end;
- system unlock;
- first meaningful interaction.

Telemetry should answer specific design questions rather than simply record everything.

---

# 157. Solo-Developer Balance Workflow

Recommended workflow:

1. deterministic simulations identify obviously broken curves;
2. automated player profiles test progression;
3. regression tests protect previous assumptions;
4. fresh manual playtests validate feel;
5. run-centric telemetry is exported;
6. real play is compared with simulated profiles;
7. one major balance layer is changed at a time;
8. repeat.

Avoid casually changing enemy HP, Salvage, Scrap, Core scaling, Foundry and Matter simultaneously. Doing so makes it impossible to identify the cause of an improvement or regression.

---

# 158. Balance Data Philosophy

Balance should remain inspectable and organised around clear categories such as:

- enemy growth;
- Wave rewards;
- temporary upgrade curves;
- Workshop curves;
- Matter curves;
- Foundry rates;
- Worker Drone rates;
- Furnace;
- Research;
- system gates.

This GDD does not prescribe code architecture. It does prescribe that balance should be understandable and testable.

---

# 159. Audio and VFX Philosophy

Combat should feel satisfying without becoming visually noisy.

Strong feedback should be reserved for meaningful events:

- Boss arrival;
- shield break;
- powerful Core attack;
- major crit;
- Relic proc;
- fabrication complete;
- Research complete;
- system unlock;
- Rebuild;
- Reinforce.

Routine combat should remain readable.

---

# 160. Core Visual Identity

Different Core families should be recognisable through:

- silhouette;
- orbit behaviour;
- projectile style;
- firing rhythm;
- VFX.

Examples:

- Beam: clear sustained/charging energy line;
- Flak: close-range bursts;
- Lance: slow high-impact projectile;
- Barrier: visible shield interaction;
- Repair: pulse around Hive.

---

# 161. Enemy Visual Identity

Enemy families should be identifiable by:

- shape;
- movement;
- size;
- formation;
- VFX.

The player should learn enemy roles visually without constantly opening Codex entries.

---

# 162. Monetisation Principles

Hiveworks should be **lightly monetised and non-P2W**.

Core principles:

- no forced ads;
- no premium power currency;
- no loot-box monetisation;
- no energy system;
- no aggressive FOMO;
- no combat-power purchases;
- no paywalled essential automation.

Potential monetisation:

## Supporter Upgrade

Possible benefits:

- cosmetic Hive skins;
- UI themes;
- supporter cosmetics;
- non-power visual customisation;
- optional presentation/stat-history conveniences where they do not create gameplay advantage.

Future content expansions may be considered if the game develops an audience.

---

# 163. Release Scope

A polished Act 1 is sufficient for initial release.

Act 2 is not required before launch.

Act 1 should provide:

- a strong opening;
- repeated meaningful runs;
- deep progression;
- persistent industry;
- prestige;
- buildcraft;
- automation;
- Challenge mastery;
- a real climax.

Shipping a polished Act 1 is more important than indefinitely expanding pre-launch content.

---

# 164. Act 1 Finale

Wave 300 is the initial target for the Act 1 climax.

W300 should be an authored major Boss encounter.

Clearing it reveals:

> **REINFORCE**

The player should understand that Rebuild has reached the limit of its current scale.

The temporal narrative can become more explicit here.

---

# 165. Reinforce Fiction

Rebuild represents carrying knowledge/power backward through the current temporal loop.

Reinforce represents changing the **starting architecture of the Hive and the loop itself**.

Detailed Reinforce mechanics belong to later design work.

---

# 166. Future Act Hooks

Act 1 may hint at future possibilities without committing to them.

Potential future ideas:

- Capital-scale infrastructure;
- larger Hive structures;
- fleets;
- deeper temporal systems;
- additional Research disciplines;
- full offline automated Sorties;
- richer Process programming;
- specialised Worker Drones;
- additional Core families;
- deeper Relic systems;
- new Challenge types.

These are hooks, not launch requirements.

---

# 167. Explicit Scope Boundaries

Not required for Act 1 launch:

- PvP;
- guilds;
- tournaments;
- battle passes;
- gacha;
- loot boxes;
- daily-login pressure;
- alternate Routes;
- Echo;
- Capital;
- Specialists;
- fleet combat;
- full offline combat automation;
- giant random-affix inventories;
- tower placement;
- direct manual Hive movement.

---

# 168. Provisional Values to Validate

The following are deliberately **not final**:

- W300 Act 1 length;
- exact Boss spacing/mechanics;
- Core roster;
- Frame roster;
- temporary upgrade list;
- temporary upgrade caps;
- Workshop cost curves;
- Matter formula;
- Rebuild timing;
- Foundry Mastery rate;
- fabrication durations;
- Worker Drone growth;
- Research duration;
- Process gate/order;
- Directive cadence;
- Directive strength;
- Extraction bonus;
- Furnace rates;
- Challenge count;
- total Act 1 hours.

These should be decided through simulation and playtesting.

---

# 169. Condensed Act 1 Player Journey

## Opening

Learn:

- Hive combat;
- Salvage;
- temporary upgrades;
- defeat.

## Early Progression

Learn:

- Scrap;
- Workshop;
- persistent strength between Sorties;
- basic Core building.

## First Deep System

Unlock:

- Foundry;
- processing;
- timed fabrication.

## Industrial Expansion

Unlock:

- Worker Drones;
- workforce allocation.

## Run Variation

Unlock:

- Directives.

## First Prestige

Unlock:

- Rebuild;
- Matter;
- exponential permanent growth.

## Buildcraft Expansion

Develop:

- Core Mastery;
- Relics;
- advanced fabrication.

## Push Resource

Unlock:

- Furnace.

## Rule-Changing Progression

Unlock:

- Research.

## Automation Era

Unlock:

- Process;
- QoL;
- auto-buy;
- priorities;
- conditions;
- profiles.

## Mastery

Unlock:

- Challenges.

## Finale

Reach:

- Wave 300;
- Act 1 Boss;
- Reinforce.

---

# 170. Intended Emotional Progression

### First hour

> “I can make each run stronger.”

### Early Act 1

> “My account is beginning to develop.”

### First Rebuild

> “I reset a lot, but I am now dramatically stronger.”

### Mid Act 1

> “My build and industry actually matter.”

### Research

> “I'm changing the rules of systems I already understand.”

### Process

> “I don't need to manually repeat solved actions anymore.”

### Late Act 1

> “I'm designing how the Hive behaves.”

### W300

> “I've mastered this loop. Something larger is happening.”

---

# 171. One-Sentence Feature Test

Whenever a new feature is proposed, ask:

> **Does this make Sorties more interesting, long-term progression deeper, automation more satisfying, buildcraft richer, or information clearer?**

If the answer is no, it probably does not belong in Act 1.

---

# 172. Final Act 1 Design Statement

Hiveworks Act 1 is a repeated-run incremental game centred on a stationary combat Hive.

Every Sortie begins at Wave 1.

Temporary power comes from Salvage. Rebuild-cycle power comes from Scrap and Workshop. Permanent exponential growth comes from Rebuild and Matter.

Cores form the visible combat build. Relics modify those Cores. Foundry turns recovered resources into long-term equipment and infrastructure. Worker Drones operate the industrial economy. Furnace turns stored cycle resources into temporary push power. Research permanently changes the rules of systems through branching disciplines. Process gradually turns repetitive manual play into increasingly sophisticated automation. Challenges test the player's understanding under modified rules.

The UI remains anchored around the Hive and provides the information necessary to make decisions without forcing constant navigation.

The game begins simple, unfolds slowly, and ends Act 1 with the player no longer merely controlling a stronger Hive, but designing an increasingly self-managing system.

The design priority is not the number of systems.

> **It is the quality, longevity and interaction of the systems that remain.**

---

# Appendix A — Act 1 Major Systems

| System | Layer | Primary Question |
|---|---|---|
| Sortie | Run | How far can this build go? |
| Run Upgrades | Run | Where should Salvage be spent now? |
| Cores | Rebuild Cycle + Permanent Mastery | What combat build am I using? |
| Relics | Permanent | How should each Core be customised? |
| Workshop | Rebuild Cycle | How should future runs in this cycle start stronger? |
| Foundry | Permanent | What should I manufacture next? |
| Worker Drones | Industry | Where should limited workforce be assigned? |
| Directives | Run | How should this Sortie develop? |
| Rebuild | Prestige | Is it time to trade this cycle for permanent growth? |
| Matter | Permanent | Where should prestige power be invested? |
| Furnace | Cycle + Run | Is this run worth spending stored push resources on? |
| Research | Permanent | Which underlying rule should improve next? |
| Process | Permanent/QoL | What solved behaviour should now be automated? |
| Challenges | Mastery | Can this account solve a modified ruleset? |
| Reinforce | Higher Prestige | Is the Hive ready to change the scale of progression? |

---

# Appendix B — Removed / Deferred Feature Register

| Feature | Status | Reason |
|---|---|---|
| Sectors | Removed | Waves provide a cleaner single progression coordinate |
| Frontier Hold | Removed from standard play | Death now ends a meaningful Sortie |
| Starting Wave selection | Removed | Every Sortie begins W1 |
| Route A/B | Removed/deferred | Complexity without enough current value |
| Network | Removed | Abstract combat multipliers replaced by Worker Drone labour |
| Echo | Removed | Challenges cover alternate combat tests |
| Standalone Reliquary | Removed | Relics install directly into Cores |
| Yard top-level system | Removed | Folded into Foundry/construction |
| Slag top-level system | Removed | Matter Shop belongs to Rebuild |
| Specialists | Deferred | Frame/Core/Relic identity is sufficient for Act 1 |
| Capital | Deferred | Better suited to later large-scale progression |
| Offline automated combat | Deferred | Should be earned at a higher progression layer |
| Random-affix Relic loot | Not planned for Act 1 | Avoid inventory comparison clutter |

---

# Appendix C — UI Decision Checklist

For every major screen, verify:

- Can the player see the resource being spent?
- Can the player see what they currently have?
- Can the player see what the action will change?
- Is temporary vs cycle vs permanent progression obvious?
- Can alternatives be compared without leaving the screen?
- Is the next useful action obvious?
- Is advanced information available without overwhelming the default view?
- Does the interface work at mobile portrait width?
- Can the player quickly return to live combat?
- Does the screen avoid unnecessary navigation layers?

---

# Appendix D — Balance Health Checklist

A healthy Act 1 build should generally demonstrate:

- first Sortie ends within several minutes;
- early runs improve Best Wave consistently;
- Economy purchases have understandable ROI;
- Workshop spending visibly improves the next Sortie;
- first Rebuild feels powerful;
- old Waves are rapidly reclaimed after Rebuild;
- Foundry remains relevant for the entire Act;
- Worker Drones always have meaningful competing jobs;
- no Core family is invalidated by unreachable enemy range;
- no single run upgrade absorbs nearly all spending;
- no major system becomes irrelevant shortly after unlock;
- Furnace meaningfully helps push runs;
- Research unlocks feel more meaningful than tiny percentage increases;
- Process automation arrives after manual mastery;
- repetitive late-Act play becomes increasingly automated;
- Challenges test builds rather than merely multiplying enemy stats;
- W300 feels like a culmination rather than an arbitrary number.

---

# Appendix E — Living GDD Rule

This document defines the **intended player experience**, not implementation details.

When implementation conflicts with the design, the conflict should be reviewed explicitly rather than silently changing the game to fit existing code.

> **Existing code is not a reason to preserve a mechanic. Player experience is the authority.**
