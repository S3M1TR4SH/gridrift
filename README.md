# Gridrift

Gridrift is a small HTML5 canvas puzzle. Drag pieces onto the grid, clear full rows and columns, and chain a streak. The board is a 6 by 6 grid, and the opening pieces are short lines and small blocks so a line can clear in the first few moves. Rounds raise a clear target, then the same board continues. The run ends when no piece in the tray fits. That is not forced: if any shape in the current mix still fits, the tray keeps a legal move.

Pieces, buttons, fonts, and sounds are drawn or synthesized in the page. `assets.manifest.json` lists the ids this game wants from `S3M1TR4SH/asset-library` at tag `v0.2.0`. That library is not published yet, so the loader keeps the id and uses a placeholder when no local file is available. It does not request the library over the network.

Line clears flash, shake the board, pop the score, and play `sfx.clear`. Combos use `sfx.combo`. Streaks step through `sfx.streak.1`, `sfx.streak.2`, and `sfx.streak.3`. A bad drop plays `sfx.invalid` and snaps the piece back. Buttons use `sfx.ui.tap`, and the tutorial uses `sfx.tutorial.step`. Particle sprites are `fx.particle.1` through `fx.particle.8` (grayscale art, tinted with the cleared piece color) and the line flash is `fx.flash`. Until those files exist, the page draws circles and bars and synthesizes the tones. Timings live in `config/tuning.json` under `juice`. The reusable helper is `studio-core/juice/feedback.js`, and it does not import the game.

The best score and the current run are stored in `localStorage` under `gridrift.run.v1`. That record is the board, the tray, the score, and the round. It does not store a name, age, or contact details. The age gate keeps its own separate key. The first visit explains the goal in three steps: drag a piece, fill a row or column, and finish the round. A later visit with a saved run offers to continue.

## Dev setup

Use Node.js 22 or newer on Windows. The same `npm` scripts work in Command Prompt and PowerShell. No extra packages are required.

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

   Those tests do four things. They lock the hard limits in `studio-core/guardrails/limits.js`. They load an over-limit sample and require validation to fail. They load the shipped `config/pacing.json` and `config/tuning.json` and require validation to pass. They run every ad adapter through the guard, including the portal stubs. If a number in those files is past a limit, this command exits with an error and names the rule.

`npm run build` copies the static site into `dist/` and refuses to write it when the shipped config fails the same guardrail check. Preview that folder with `npm start -- dist` only after a successful build. Day-to-day edits are easier with `npm start` on the project root, since you do not need to rebuild to refresh.

## Layout

- `src/` is the game: rules, input, rendering, and the screen flow.
- `levels/` and `config/` tune rounds, scoring, and ad pacing. `config/pacing.json` cannot override the hard limits in `studio-core`.
- `branding/` holds the name, colors, and generated placeholder icons.
- `studio-core/` is a separate package (version 0.1.0). It does not import Gridrift. Copy that folder out when it gets its own repo. See `studio-core/RELEASE_CHECKLIST.md`.
- `assets.manifest.json` is the asset-id list. Its format is the library pin plus a flat array of string ids.

## Ads, privacy, and stats

Ads go through `studio-core/ads/guard.js`. The default adapter is a local placeholder: no SDK, no key, and no ad request. Stub folders for Poki, CrazyGames, GameDistribution, and Playgama are documented there and are not loaded. A full-screen placeholder can appear between rounds or, when a continue offer is not available, after a game over. The close control sits away from the button that opened it. The game-over screen offers Restart, and one opt-in Continue per run. The Continue button asks before it plays a rewarded placeholder, and declining it leaves Restart on screen. A Hint button stays hidden until two minutes of play, or until the board is crowded and no piece can finish a line. It can be used once per run, and only after the player opts in. Notes on portal payouts live in `studio-core/docs/revenue-requirements.md` and are not used at runtime.

The age gate treats players under 13 as children: no ads and no analytics. Everyone else sees an opt-in for on-device stats. Until that opt-in, events are dropped. The tracker has no send path.

`npm test` fails if `config/pacing.json` or `config/tuning.json` exceeds a guardrail. The suite includes an over-limit config so that check is not a no-op. GitHub Actions runs the same command.

## Deploy on Vercel

This repository is not linked to a Vercel project, and nothing here deploys it.

1. Push the branch you want to ship.
2. In Vercel, import the Git repository as a new project.
3. Framework preset: Other.
4. Install command: `npm install`
5. Build command: `npm run build`
6. Output directory: `dist`

`vercel.json` records those three settings and tells Vercel to serve `sw.js` with `Cache-Control: no-cache`. There are no environment variables to add. Do not point the project at an ad network.
