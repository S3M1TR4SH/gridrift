# Gridrift

Gridrift is a small HTML5 canvas puzzle. Drag pieces onto the grid, clear full rows and columns, and chain a streak. The board is a 10 by 10 grid. Rounds raise a clear target, then the same board continues.

Pieces, buttons, fonts, and sounds are drawn or synthesized in the page. `assets.manifest.json` lists the ids this game wants from `S3M1TR4SH/asset-library` at tag `v0.2.0`. That library is not published yet, so the loader keeps the id and uses a placeholder when no local file is available. It does not request the library over the network.

## Dev setup

Use Node.js 22 or newer on Windows. The same `npm` scripts work in Command Prompt and PowerShell. No extra packages are required to play or to run `npm test`. The player simulation below installs Playwright.

1. Install Node from [nodejs.org](https://nodejs.org/) if `node -v` is missing or older than 22.
2. Open Command Prompt or PowerShell and go to this folder:

   ```bat
   cd path\to\gridrift
   node -v
   npm install
   ```

3. Start the game:

   ```bat
   npm start
   ```

   Open `http://127.0.0.1:4173` in a browser. Leave that terminal running while you edit. Refresh after a change. `npm start` serves this folder with Node, so the service worker can register. Opening `index.html` from File Explorer will not.

4. Run the full test suite:

   ```bat
   npm test
   ```

   That runs every test under `studio-core/tests` and `tests`, including the guardrail checks. A failing config fails this command, which is also what GitHub Actions runs.

5. Run only the guardrail tests while editing `config/pacing.json` or `config/tuning.json`:

   ```bat
   npm run test:guardrails
   ```

   Those tests do three things. They lock the hard limits in `studio-core/guardrails/limits.js`. They load an over-limit sample and require validation to fail. They load the shipped `config/pacing.json` and `config/tuning.json` and require validation to pass. If a number in those files is past a limit, this command exits with an error and names the rule.

`npm run build` copies the static site into `dist/` and refuses to write it when the shipped config fails the same guardrail check. Preview that folder with `npm start -- dist` only after a successful build. Day-to-day edits are easier with `npm start` on the project root, since you do not need to rebuild to refresh.

## Layout

- `src/` is the game: rules, input, rendering, and the screen flow.
- `levels/` and `config/` tune rounds, scoring, and ad pacing. `config/pacing.json` cannot override the hard limits in `studio-core`.
- `branding/` holds the name, colors, and generated placeholder icons.
- `studio-core/` is a separate package (version 0.1.0). It does not import Gridrift. Copy that folder out when it gets its own repo. See `studio-core/RELEASE_CHECKLIST.md`.
- `assets.manifest.json` is the asset-id list. Its format is the library pin plus a flat array of string ids.

## Ads, privacy, and stats

Ads are placeholder hooks. There is no ad SDK, no key, and no ad request. A full-screen placeholder can appear between rounds or, when a continue offer is not available, after a game over. The close control sits away from the button that opened it. Rewarded continue and hint ads are opt-in, and declining them always returns to a playable choice. Restart is always available.

The age gate treats players under 13 as children: no ads and no analytics. Everyone else sees an opt-in for on-device stats. Until that opt-in, events are dropped. The tracker has no send path.

`npm test` fails if `config/pacing.json` or `config/tuning.json` exceeds a guardrail. The suite includes an over-limit config so that check is not a no-op. GitHub Actions runs the same command.

## Player simulation

`studio-core/sim/` is a headless, game-agnostic session runner. Personas play through `sim/gridrift-adapter.js`, which opens this game in Chromium only when the page is loaded with `?sim=1`. Game rules are unchanged. The adapter forwards placements and buttons through the same paths a player uses, and it serves an alternate `config/pacing.json` per variant.

Playing and `npm test` still need no packages. The simulation does:

```bat
npm install
npx playwright install chromium
npm run sim
```

That runs casual, skilled, quitter, and ad-averse personas against the shipped pacing file and `sim/variants/quiet-ads.json`, using the same seeds for both. It writes `sim/out/results.json` and `sim/out/summary.md`.

The adapter contract and the steps for another game are in `studio-core/sim/README.md`. GitHub Actions workflow `sim` runs the same command on pull requests and `workflow_dispatch`, uploads those two files, and posts the markdown on the job summary.

`npm run analyze` reads `sim/out/results.json` and asks a local Ollama server (default `http://localhost:11434`, model `qwen2.5-coder:3b`) for pacing or tuning changes. Proposals that fail the guardrail check are rejected. Accepted ones are written to `sim/out/analysis/` with a markdown summary. `npm run analyze:trends` summarizes past runs from `sim/history/`. CI runs the analyze unit tests with a mock client and does not call Ollama. `C:\Studio\local-llm\ask.ps1` is an optional manual helper on Windows; analyze does not invoke it.

## Deploy on Vercel

This repository is not linked to a Vercel project, and nothing here deploys it.

1. Push the branch you want to ship.
2. In Vercel, import the Git repository as a new project.
3. Framework preset: Other.
4. Install command: `npm install`
5. Build command: `npm run build`
6. Output directory: `dist`

`vercel.json` records those three settings and tells Vercel to serve `sw.js` with `Cache-Control: no-cache`. There are no environment variables to add. Do not point the project at an ad network.
