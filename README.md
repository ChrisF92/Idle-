# Hiveworks

Portrait incremental auto-combat. The player runs a stationary industrial **Hive**. Every **Sortie** starts at **Wave 1**, combat is automatic, and death or Extraction ends the run. Temporary **Salvage** powers the current Sortie. **Scrap** and the **Workshop** power the current Rebuild cycle. **Matter** from **Rebuild** powers the account. **Reinforce** after Wave 300 is the Act 1 door to a later scale.

Design authority: [`Hiveworks_Game_Design_Document_v1.0.md`](Hiveworks_Game_Design_Document_v1.0.md).  
Release work plan: [`docs/release-implementation-plan.md`](docs/release-implementation-plan.md).

Working package name was `cosmic-idle`; the PWA title is **Hiveworks**. Save version bumps wipe old careers (pre-release, no migration).

## Stack

- **Vite + React + TypeScript**
- **PWA** (`vite-plugin-pwa`) — installable on Android from a deployed HTTPS URL
- Local save (`localStorage`) + export/import codes
- Simulation core under `src/game/` (UI-free, unit-tested)

## Systems (tabs)

Bottom nav (GDD §109):

| Tab | Purpose |
|---|---|
| Sortie | Live combat. Hive at the centre, enemies from around it. Salvage shop: Attack / Defense / Economy. Cores and Directives. |
| Dock | Loadout (Frame, Cores, Relics), Workshop, Rebuild / Matter, Launch. |
| Systems | Hub for unlocked industry: Foundry, Worker Drones, Furnace, Research, Process. |
| More | Challenges, Codex, Stats, Settings, Reinforce, and **one** next major unlock. |

Locked systems do not appear as a grey list of the whole Act.

### Act 1 doors (career Best Wave)

| Best Wave | Unlock |
|---:|---|
| Start | Sortie, starter Frame, starter Cores, Salvage shop |
| First defeat | Scrap + Workshop |
| 10 | Full Attack / Defense shop, Codex |
| 20 | Foundry |
| 30 | Worker Drones |
| 40 | Expanded Economy |
| 50 | Directives |
| 70 | Rebuild + Matter |
| 90 | Foundry construction |
| 110 | Relic sockets |
| 140 | Furnace |
| 170 | Research |
| 210 | Process |
| 250 | Challenges |
| 300 | Act 1 boss + Reinforce |

Echo, Capital, Specialists, Task List, standalone Reliquary / Yard / Slag, sector routes, and Network combat bars are **removed or deferred**. See GDD §101 and Appendix B.

## Loop

1. Launch from Dock (always Wave 1).
2. Hive and Cores fight automatically. Spend Salvage on this Sortie.
3. Die or Extract (Extract pays a small Scrap bonus). Salvage and run upgrades reset.
4. Spend Scrap in Workshop so the next Sortie starts stronger.
5. Foundry, Workers, Relics, Furnace, Research, and Process unfold on the table above.
6. Rebuild when the cycle walls — Workshop and Scrap reset; Matter stays.
7. Clear Wave 300 to open Reinforce.

Offline: a live Sortie **freezes**. Foundry, Research, and Worker jobs continue.

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
3. After `Deploy GitHub Pages` succeeds on `main`, open **https://chrisf92.github.io/Idle-**
4. Android Chrome → **Install app** / **Add to Home screen**.
5. Saves are per-browser origin — use More → export/import between devices.

Local Pages-shaped build: `npm run build:pages && npm run preview`

### PR preview deploys (no external account)

Each open PR gets a live preview on the same GitHub Pages site:

`https://chrisf92.github.io/Idle-/pr-preview/pr-<number>/`

- Workflow: `.github/workflows/preview-pages.yml` (comments the URL on the PR).
- Production stays at `/Idle-/`; previews live under `/Idle-/pr-preview/`.
- Closing a PR removes its preview folder.
- **Same origin as production** — `localStorage` is shared. Export a save or use a private window / different browser profile when playtesting a branch.

## Notes

- Game logic stays in `src/game/`; React is presentation + input.
- Solo project: **one feature per branch/PR**.
- Header resources appear only once their system is unlocked or the resource is earned.
- An **info** button next to the title explains the current screen.
- Dev tools (More tab): toggle anytime, or `?dev=1` / `?dev=0`. Jump, boss force, achievements, guide skip.
- Onboarding is designed in the GDD (§125–140) and is currently disabled in code (`ONBOARDING_ENABLED`). Re-enable is Phase 6 of the release plan.
- Art is UI/text-first with canvas combat. The GDD target is a central Hive and orbiting Cores; the live battlefield is still mid-migration (see the release plan, Phase 2).
- Stale design notes: [`docs/usi-reskin-plan.md`](docs/usi-reskin-plan.md) and [`docs/act1-balance.md`](docs/act1-balance.md) are **superseded** by the GDD. Do not implement from them.
