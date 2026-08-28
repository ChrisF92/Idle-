# PR8 Directives and Furnace — implementation note

This note maps the PR8 implementation to `docs/act1-canonical-design.md`. It does not modify the canonical design.

## Directives

Opportunities are exactly W125 / W275 / W425 / W575 / W725 / W875. Each opportunity persists a deterministic three-card offer derived from Sortie seed + milestone + eligible pool, plus **Continue Unchanged**. Offers do not consume combat RNG and cannot reroll on reload. A picked Directive cannot repeat in the same Sortie. All Directives reset at Sortie end.

The 14 mechanical identities use the user-approved PR8 mechanics addendum. Numeric magnitudes are centralized in `DIRECTIVE_SEEDS` for PR11 tuning. High Tempo changes only normal reinforcement interval. Pack Hunter increases the controlled ordinary/Commander-escort threat budget and never creates extra Commanders. Blueprint Hunt accelerates fragment RNG only. Burn Hot snapshots Furnace effect strength at Ignite, so choosing it later cannot rewrite an already-locked Furnace.

## Furnace

Unlock W450. Ash is Rebuild-cycle currency; Heat is Sortie currency. Conversion seed is 10 Ash → 1 Heat. There is no passive Heat generation, drain, or Heat capacity.

Lifecycle is **CONFIGURE → PRIME → IGNITE → LOCK**. Configure/Prime exists only in Furnace UI-local draft state, so closing the sheet discards it without a save-side reservation/refund mechanic. Ignite consumes the total selected Heat cost once, writes the exact locked channel configuration to save state, and cannot be edited for the remainder of the Sortie.

Channels are exactly Overdrive / Bulwark / Guidance / Harvest at OFF/I/II/III. Initial selected-channel limit is two. A typed provider is left for PR9 Engineering to raise the Act 1 limit to three; PR8 production does not activate it. There is no Furnace upgrade shop.

Heat cost seeds are I=10, II=25, III=60. Channel effect seeds follow the canonical numeric package. Harvest never increases Ash. Reactor Frame and Choir Tap use their already-authored conversion/effect hooks; legacy Protocol/Process Furnace runtime multipliers are not part of PR8.

Ash-per-kill exact magnitude is not authored canonically. PR8 therefore centralizes a deliberately neutral PR11-tunable implementation seed (`0.5`, Boss ×4) rather than preserving the legacy Wave-as-Sector formula.

## Boundaries

PR9 owns Research and Process replacement, including Engineering channel-count progression, Furnace presets/auto-Ignite and Directive Preference. PR10 owns final Challenge restrictions. PR11 owns final numeric balance/simulation tuning. No PR9–PR11 feature is pulled forward here.
