# Gridrift

Gridrift is a small HTML5 canvas puzzle. Drag pieces onto the grid, clear full rows and columns, and chain a streak. The board is a 6 by 6 grid, and the opening pieces are short lines and small blocks so a line can clear in the first few moves. Rounds raise a clear target, then the same board continues. The run ends when no piece in the tray fits. That is not forced: if any shape in the current mix still fits, the tray keeps a legal move.

Pieces, buttons, fonts, and sounds are drawn or synthesized in the page. `assets.manifest.json` lists the ids this game wants from `S3M1TR4SH/asset-library` at tag `v0.2.0`. That library is not published yet, so the loader keeps the id and uses a placeholder when no local file is available. It does not request the library over the network.

Line clears flash, shake the board, pop the score, and play `sfx.clear`. A single line stays small. A multi-line clear adds more particles, a stronger shake, and a higher pitch. Combos use `sfx.combo`. Streaks step through `sfx.streak.1`, `sfx.streak.2`, and `sfx.streak.3`. A bad drop plays `sfx.invalid` and snaps the piece back. Buttons use `sfx.ui.tap`, and the tutorial uses `sfx.tutorial.step`. Particle sprites are `fx.particle.1` through `fx.particle.8` (grayscale art, tinted with the cleared piece color) and the line flash is `fx.flash`. Until those files exist, the page draws circles and bars and synthesizes the tones. Every effect in `config/tuning.json` stays under 400ms. The Motion button starts from the `prefers-reduced-motion` setting and turns shake and particles off. The Haptics button turns vibration off. The reusable helper is `studio-core/juice/feedback.js`, and it does not import the game.

The best score, the current run, the daily streak, and these toggles are stored in `localStorage` under `gridrift.run.v1`. That record is the board, the tray, the score, the best score, a session count, and the daily streak. It does not store a name, age, or contact details. The age gate keeps its own separate key. A return after 30 minutes with a saved run shows a welcome-back card with the best score and the day streak. A shorter reload continues the run. The first visit plays two scripted boards that each clear a line in one move, with prompts of a few words, then hands off to a real board. Returning players skip that. Daily starts a board seeded from the UTC date, keeps a streak that rolls at 4am local, and can spend a freeze earned every seven completed dailies (two at most). Freezes are not sold and are not granted by an ad. After three losses in a row, the next run deals from the easier pool. That choice does not read ad state.

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

   Those tests do four things. They lock the hard limits in `studio-core/guardrails/limits.js`. They load an over-limit sample and require validation to fail. They load the shipped `config/pacing.json` and `config/tuning.json` and require validation to pass. They run every ad adapter through the guard, including the portal stubs. If a number in those files is past a limit, this command exits with an error and names the rule.

`npm run build` copies the static site into `dist/` and refuses to write it when the shipped config fails the same guardrail check. Preview that folder with `npm start -- dist` only after a successful build. Day-to-day edits are easier with `npm start` on the project root, since you do not need to rebuild to refresh.

## Layout

- `src/` is the game: rules, input, rendering, and the screen flow.
- `levels/` and `config/` tune rounds, scoring, and ad pacing. `config/pacing.json` cannot override the hard limits in `studio-core`.
- `branding/` holds the name, colors, and generated placeholder icons.
- `studio-core/` is a separate package (version 0.1.0). It does not import Gridrift. Copy that folder out when it gets its own repo. See `studio-core/RELEASE_CHECKLIST.md`.
- `assets.manifest.json` is the asset-id list. Its format is the library pin plus a flat array of string ids.

## Ads, privacy, and stats

Ads go through `studio-core/ads/guard.js`. The default adapter is a local placeholder: no SDK, no key, and no ad request. Stub folders for Poki, CrazyGames, GameDistribution, and Playgama are documented there and are not loaded. A full-screen placeholder can appear only between rounds or, when a continue offer is not available, after a game over. It does not appear in the player's first session. The shipped gap is 120 seconds, with an A/B arm of 90, 120, and 180 seconds that cannot go under the 60 second guardrail. A rewarded ad also starts that gap and skips the next interstitial. The close control sits away from the button that opened it. The game-over screen offers Restart, and one opt-in Continue per run. The results screen can offer an opt-in Double score, once per run. A Reroll button appears only when the board is stuck, once per run, and only after the player opts in. Declining any of them leaves play available. A Hint button stays hidden until two minutes of play, or until the board is crowded and no piece can finish a line. It can be used once per run, and only after the player opts in. Piece order comes from the match seed and does not change because an ad was available. Notes on portal payouts live in `studio-core/docs/revenue-requirements.md`. The timing notes live in `studio-core/docs/engagement-ad-design.md`. Neither file is used at runtime.

The age gate treats players under 13 as children: no ads and no analytics. Mixpanel is never loaded for them. Everyone else sees an opt-in. The public project token lives only in `config/analytics.json`. The game passes that token into `studio-core/analytics/adapters/mixpanel.js`. The studio-core tracker stays provider-agnostic, keeps the standard event names, and still drops events until consent. The adapter does not inject the Mixpanel script until an adult allows stats. Init turns off IP geolocation, autocapture, pageviews, and session replay, and it does not set a name, email, or profile. "No thanks", or "Stop stats" after allowing, calls `opt_out_tracking` when the library was loaded. Denying before it loads does not load it just to opt out. After consent, the first play sends `first_open` once, every `session_start` includes `days_since_install`, and finishing that day's daily board sends `daily_complete`. The same consent gate covers the retention funnel: `app_open`, `onboarding_step`, `onboarding_complete`, `run_start`, `line_clear`, `run_end`, `daily_start`, `streak_update`, and `freeze_earned`. Those events are dropped until consent, and they are never sent for players under 13.

`npm test` fails if `config/pacing.json` or `config/tuning.json` exceeds a guardrail. The suite includes an over-limit config so that check is not a no-op. GitHub Actions runs the same command.

## Player simulation

`studio-core/sim/` is a headless, game-agnostic session runner. Personas play through `sim/gridrift-adapter.js`, which opens this game in Chromium only when the page is loaded with `?sim=1`. Game rules are unchanged. The adapter forwards placements and buttons through the same paths a player uses, and it serves an alternate `config/pacing.json` per variant.

Playing and `npm test` still need no packages. The simulation does:

```bat
npm install
npx playwright install chromium
npm run sim
```

That runs casual, skilled, quitter, and ad-averse personas against the shipped pacing file and `sim/variants/quiet-ads.json`, using the same seeds for both. They leave from board frustration, boredom, ads (ad-averse), or a finished match. A high safety cap is recorded as an anomaly, not a quit. It writes `sim/out/results.json` and `sim/out/summary.md`, including a quit reason for each session.

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

`vercel.json` records those three settings. It serves `sw.js` with `Cache-Control: no-cache`, and it serves `/.well-known/assetlinks.json` as `application/json`. The build copies that file from `web/.well-known/assetlinks.json` into `dist/`. There are no environment variables to add. Do not point the project at an ad network.

## Google Play

`android/` is a Bubblewrap Trusted Web Activity for the placeholder id `com.gridrift.app` and the placeholder origin `https://gridrift.vercel.app/`. This repo is not linked to Vercel or Play, and nothing here is submitted. The release keystore is not in git. `.github/workflows/android-aab.yml` signs an app bundle only when `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, and `KEY_PASSWORD` are set. Otherwise it builds a debug bundle and skips release signing.

`studio-core/ads/admob` can only use Google's demo ad units, and only through a native bridge. The web page and the TWA do not install that bridge, so the adapter no-ops. The Android project does not include the Mobile Ads SDK. `studio-core/docs/twa-ads.md` compares that with H5 Games Ads or AdSense.

`store/` holds drafts for Data safety, the IARC questionnaire, and the listing. They are not uploaded.
