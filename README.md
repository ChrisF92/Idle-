# Hiveworks

Orbital foundry idle: player-launched sorties, USI-style ship + Cores, sectors as short wave gauntlets. Combat sim keeps running after Launch while you browse the Dock. See [`docs/usi-reskin-plan.md`](docs/usi-reskin-plan.md).

Working package name was `cosmic-idle`; the PWA title is **Hiveworks**. Save key stays `cosmic-idle-save` so existing careers are not wiped.

## Stack

- **Vite + React + TypeScript**
- **PWA** (`vite-plugin-pwa`) — installable on Android from a deployed HTTPS URL
- Local save (`localStorage`) + export/import codes
- Simulation core under `src/game/` (UI-free, unit-tested)

## Systems (tabs)

Bottom nav:

| Tab | Purpose |
|---|---|
| Dock | Home. Launch / Rebuild hangar. Combat keeps simulating while you stay here if a sortie is live. |
| Sortie | USI-style battlefield (ship at the bottom, waves incoming). Advance / Hold sector / Hold wave. Cores sit under the field. |
| Network | Assign drones to Strike / Ward (and later bars). They fill over time — they never appear on the battlefield. |
| Foundry | Recipes, smelters, Core prints, Foundry Points, fitted bits. Unlocks at sector 2. |
| More | Hangar stations (open / coming up / later), save / export, notation, rebuild, build stamp. |

Stations under **More** unfold on sector doors (Reliquary 3, Furnace 5, Codex 6, Research 7, Yard and Slag Bank on first Rebuild, Protocols 18, Echo 22, Specialists 51, Task List 72, Capital 75, Reinforce 80). Process opens after First Blood (clear sector 1).

## Progression notes

- **Act 1** soft climax at sector **30** (6 boss milestones). Infinite push continues after.
- Whole systems unlock by career sector clears; locked stations stay listed with requirements.
- Boss sectors: vanguard waves first, **boss only on wave 5**. Waves use varied packs (fighters, skirmishers, snipers, juggernauts).
- Header resources appear only once their system is unlocked or the resource is earned (Rebuild Matter after a Rebuild).
- An **info** button next to the Hiveworks title explains the screen you are on.
- Process points come from achievements (Process station), not combat drops. Unspent points persist across Rebuild.
- Hive Research (Material / Energy / Observation) is **permanent** across Rebuild / Reinforce.
- Guided onboarding waits until you are docked, keeps the current tip until Continue / Skip, and retires starter dock/launch/salvage tips after the first Rebuild. Reinforce clears the full catalog.
- Research is permanent; enemy hull scales steeply while damage stays flatter so length comes from walls, not death loops.
- Dev tools (More tab): toggle on anytime, or append `?dev=1` / `?dev=0`. Includes jump, boss force, achievements, guide skip.
- Boss telegraphs: titan slams wind up before firing; snipers charge a lock laser; phase shifts flash a warn ring.
- Pulse + Plate start fitted. Salvage ranks Cores during a sortie and wipes on Rebuild.
- Rebuild hangar (Dock, from sector 4) swaps hull and Cores and grants **Rebuild Matter**. Reinforce at sector 80 is the second prestige layer — keeps the foundry.

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

- Art is UI/text-first with simple SVG fleet shapes on Sortie.
- Game logic should stay in `src/game/`; React is presentation + input.
- Solo project: use **one feature per branch/PR** so slices stay reviewable.
- Offline catch-up (up to 8h) runs on load: industry + sector-scaled rewards (no fight simulation).
- Combat is a multi-unit fleet duel (weapons/cooldowns/tags) with hull that persists and repairs over time. Sortie HUD shows hull/shield/salvage; Core cards list Damage, RoF, Range. Advance / Hold sector / Hold wave replace Extract.
- Extra Cores unlock as Foundry prints at sector doors; farm fragments on Hold, Assemble, then fit on Rebuild.
- Entity families (Swarm/Armored/Ethereal/Divine) with module role counters; bosses every 5 sectors.
- Fitted Cores persist through Rebuild; Protocols and Echo runs are optional restricted sorties.
- Essence still exists in the sim; Hive Research is the live spend. Yard arms apply on the next Rebuild.
- Capital scales the ship (Broadside / Bulkhead / Hold). No fighters on the field.
