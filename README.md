# Cosmic Idle

Working title for a space idle game: fleet combat against alien / godlike entities, with industry, research, an AI Points network, prestige, and ITRTG-style challenges.

## Stack

- **Vite + React + TypeScript**
- **PWA** (`vite-plugin-pwa`) — installable on Android from a deployed HTTPS URL
- Local save (`localStorage`) + export/import codes
- Simulation core under `src/game/` (UI-free, unit-tested)

## Systems (tabs)

| Tab | Purpose |
|---|---|
| Combat | Sector 1 Expedition (100 waves + Endless), Push / Pause / Extract |
| Shipyard | Unlock/fit frames + modules (locked for the Expedition after Launch) |
| Base | Worker-drone stations + Fabrication Bay (gated — career progress) |
| Research | Unlock tree + damage bonuses (gated) |
| Codex | Soft counters (gated — research Tactical Codex **once**; permanent) |
| AI | Achievements → AI Points; permanent automation/QoL + doctrines |
| Prestige | Soft reset after career wave 20+; Ascension after wave 100 |
| Stats | Save management |

## Progression notes (Phase 1 Expedition)

- **Sector 1** is a continuous **100-wave Expedition** with orbital-defence combat (flagship at centre).
- **Push** advances waves; **Pause** freezes simulation (no free repair / no mid-run refit).
- **Extract** (career wave 20+) ends the run for base PM + 5%; **Defeat** awards base PM only.
- Wave 100 is the Sector Entity climax; the run can continue into Endless (101+).
- Procedural deterministic packs for Phase 1; authored milestone waves come later.
- Save format **v21** — older saves reset cleanly (no migration).
- Prestige Matter uses a piecewise-linear milestone curve (wave 20 / 50 / 100 landmarks).
- Remaining permanent systems (Base, Research, AI, challenges, etc.) still exist; Forward Base / Directives / Patrol arrive in later phases.


## Develop

```bash
npm install
npm run dev
npm test
npm run build
npm run build:pages   # GitHub Pages base path (/Idle-/)
npm run preview
```

### Phone install (PWA)

1. In the repo: **Settings → Pages → Source: Deploy from a branch** → branch **`gh-pages`** / folder **`/(root)`**.
2. **Settings → Actions → General → Workflow permissions** → **Read and write** (needed so Actions can push `gh-pages` and PR previews).
3. After `Deploy GitHub Pages` succeeds on `main`, open **https://chrisf92.github.io/Idle-/**
4. Android Chrome → **Install app** / **Add to Home screen**.
5. Saves are per-browser origin — use Stats → export/import between devices.

Local Pages-shaped build: `npm run build:pages && npm run preview`

### PR preview deploys (no external account)

Each open PR gets a live preview on the same GitHub Pages site:

`https://chrisf92.github.io/Idle-/pr-preview/pr-<number>/`

- Workflow: `.github/workflows/preview-pages.yml` (comments the URL on the PR).
- Production stays at `/Idle-/`; previews live under `/Idle-/pr-preview/`.
- Closing a PR removes its preview folder.
- **Same origin as production** — `localStorage` is shared. Export a save or use a private window / different browser profile when playtesting a branch.

## Notes

- Art is UI/text-first with simple SVG fleet shapes in Combat.
- Game logic should stay in `src/game/`; React is presentation + input.
- Solo project: use **one feature per branch/PR** so slices stay reviewable.
- Offline catch-up (up to 8h) runs on load: industry + sector-scaled rewards (no fight simulation).
- Combat is a multi-unit fleet duel (weapons/cooldowns/tags) with Advance/Hold pacing; hull persists and repairs over time. Combat tab shows fleet DPS/hull/shield/armor; module cards list Damage, RoF, Range.
- Entity families (Swarm/Armored/Ethereal/Divine) with module role counters; bosses every 5 sectors drop Essence.
- Fitted loadouts persist through prestige; challenges are repeatable with stack bonuses (ITRTG-style).
- Challenge pack: Silent Bridge, Glass Frame, Data Drought, Bare Rig, Knife Fight, **Mono Pulse**, **Attrition**, plus Ascension-entry runs (**Long Haul**, **Null Signal**, **Hollow Choir**) that start via Ascension at sector 30 rather than Prestige.
- Essence buys permanent constructs; AI Points buy per-run doctrines (Focus Fire, Boss Protocol, Scavenger, Tactical Retreat, Rapid Recovery).
- Challenge Points / Prestige Matter buy permanent shop ranks (or bank for a smaller bonus).
- Ascension: +40% future PM gains each; unlocks deep Matter ranks and Ascension-entry challenges.
