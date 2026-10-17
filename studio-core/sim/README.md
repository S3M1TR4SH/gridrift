# Player simulation

Headless session runner for a host game. Personas play through a small adapter. The runner compares pacing variants with the same seeds and writes `results.json` plus `summary.md`.

This package does not import the host game. The adapter lives in the host repository.

## Adapter interface

An adapter module exports `createAdapter({ root })`. `root` is the host working directory. The factory returns one object that the CLI reuses for every session:

| Method | Required | Role |
| --- | --- | --- |
| `start({ seed, variant, persona })` | yes | Open a fresh session. `variant` is `{ id, pacingPath }`. |
| `readState()` | yes | Return the state fields below. |
| `listActions()` | yes | Return the actions the persona may take right now. |
| `perform(action)` | yes | Run one action. Return `{ ok: true }` or `{ ok: false }`. |
| `stop()` | yes | Close the session. The browser or server may stay up. |
| `advanceTime(ms)` | no | Move the game clock by the persona's think time. |
| `dispose()` | no | Close shared processes when the run finishes. |

`startStaticServer({ root, overrides })` in this folder serves the host tree and can swap a URL for another file. Point that override at `variant.pacingPath` before the page loads so the game keeps its normal config import.

### State

`readState()` returns:

- `screen` — current screen name.
- `score` — current score.
- `clears` — total line clears. This may drop after a restart. The runner counts increases.
- `combo` — `0`, or the number of lines when the last clear removed 2 or more.
- `streak` — optional streak counter.
- `failed` — `true` when the player has no moves or the game-over screen is up.
- `ended` — `true` when nothing else can happen. Leave this `false` if restart is still offered; the persona decides whether to quit.
- `ad` — `null`, or `{ kind, screen, placement }`. `kind` is `interstitial` or `rewarded`.

### Actions

`listActions()` returns plain objects:

- Move: `{ type: 'move', id, pieceIndex, x, y, lines, cells }`. `lines` is how many lines that placement would clear. `cells` is the piece size. Use `0` for either when the game cannot predict them. Higher `lines`, then higher `cells`, is the skilled choice.
- UI: `{ type: 'ui', id, uiId, label }`. `uiId` is what `perform` should activate.

### What the runner records

It diffs successive states:

- A clear event when `clears` increases, including the delta.
- A combo when that increase lands with `combo >= 2`.
- A fail point when `failed` turns on, with score, clears, and screen.
- An ad moment when `ad` changes. The persona reaction is `close`, `watch`, `decline`, or `quit`.
- Session length as the sum of `thinkMs` (simulated time, not wall clock).
- A would-return score from 0 to 1. Clears, combos, and peak score raise it. Fail points lower it. Each ad moment lowers it by `0.08 * adAversion`, capped at 0.45. Quitting before `patience` steps subtracts 0.04.

The session ends on quit, on `ended`, after three rejected actions, or at `maxSteps`.

## Personas

Built in: `casual`, `skilled`, `quitter`, `ad-averse`.

| Param | Meaning |
| --- | --- |
| `skill` | Chance to take the highest-line legal move. Otherwise a legal move is uniform. |
| `quitChance` | Chance to leave on a play or round-clear step. |
| `patience` | Stop after this many actions. |
| `adWatchRate` | Chance to accept a rewarded offer. |
| `quitOnAd` | Chance to leave when an ad is on screen. |
| `continueRate` | Chance to take an offered continue. |
| `restartRate` | Chance to restart after failure. |
| `maxRestarts` | Restart cap. `0` never restarts. |
| `analyticsGrantRate` | Chance to allow on-device stats when asked. |
| `hintRate` | Chance to request a hint while playing. |
| `thinkMs` | Simulated milliseconds added for every decision, including a quit. |
| `adAversion` | Weight on ad moments inside would-return. |
| `ageBand` | `13plus` (default) or `under13` when the game asks. |

A probability of 0 or 1 does not draw a random number. Any other probability draws once from `mulberry32(seed)`. The same seed repeats the same choices.

```js
import { resolvePersona } from './personas.js';

const persona = resolvePersona('casual', { patience: 10, adWatchRate: 0 });
```

From the CLI, `--persona-file overrides.json` merges the same fields. The file is keyed by persona id:

```json
{ "quitter": { "patience": 4 } }
```

## Compare variants

Pass at least two `--variant id=path` arguments. Paths are pacing files the host already knows how to validate. The loop is variant, then seed, then persona, so every variant sees the same seeds.

```bash
node studio-core/sim/cli.js \
  --adapter sim/<game>-adapter.js \
  --variant control=config/pacing.json \
  --variant quiet=sim/variants/quiet-ads.json \
  --seeds 1,2 \
  --personas casual,skilled,quitter,ad-averse \
  --max-steps 48 \
  --out sim/out
```

That writes `sim/out/results.json` and `sim/out/summary.md`.

Use the seed for the game's own RNG as well. A fixed clock time derived from the seed is enough when the game seeds itself from `Date.now()`. Pause that clock before the page loads. A running mock clock drifts by the page-load time, and a one-millisecond change reseeds the game.

## Add a game

1. Leave this folder free of host imports. Put the adapter in the host repo, conventionally `sim/<game>-adapter.js`, and export `createAdapter`.
2. Drive the real game headlessly. Playwright is the expected tool. Block service workers if they would cache the first variant's config.
3. When the page URL contains `?sim=1`, expose a bridge, for example `globalThis.__playerSim = { ready, getState, perform }`. `getState` includes legal moves. `perform` must call the same placement and button paths a player uses, so ads, failure, and round changes stay real.
4. Do not change game rules for the bot. Listing moves may call existing pure helpers. A thin hook in the host boot file is enough to publish state and forward actions.
5. Add a second pacing file that still passes the host's guardrail check. Compare it with the shipped pacing file.
6. Add an `npm run sim` script and a GitHub Actions workflow on `ubuntu-latest`. Cache npm and the Playwright browser directory. Run on `pull_request` and `workflow_dispatch`. Upload `results.json` and `summary.md`, and append the markdown to `$GITHUB_STEP_SUMMARY`.

`node --test` in this package covers the runner with an in-memory adapter. It does not launch a browser. The host's own tests should cover move listing and the variant files.
