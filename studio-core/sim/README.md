# Player simulation

Headless session runner for a host game. Personas play through a small adapter. The runner compares pacing variants with the same seeds and writes `results.json` plus `summary.md`.

This package does not import the host game. The adapter lives in the host repository.

## Adapter interface

An adapter module exports `createAdapter({ root })`. `root` is the host working directory. The factory returns one object that the CLI reuses for every session:

| Method | Required | Role |
| --- | --- | --- |
| `start({ seed, variant, persona })` | yes | Open a fresh session. `variant` is `{ id, pacingPath, tuningPath? }`. Override the tuning URL only when `tuningPath` is set. |
| `readState()` | yes | Return the state fields below. |
| `listActions()` | yes | Return the actions the persona may take right now. |
| `perform(action)` | yes | Run one action. Return `{ ok: true }` or `{ ok: false }`. |
| `isGameOver()` | yes | True only when the match is over, including a results screen. An empty move list during play is not game over. |
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
- `failed` — `true` when the player has no moves or the game-over screen is up. The runner records a fail point from this flag. It does not treat it as the quit decision.
- `ended` — `true` when nothing else can happen. Leave this `false` if restart is still offered; the persona decides whether to quit.
- `gameOver` — optional mirror of `isGameOver()`. The runner calls the method.
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
- A would-return score from 0 to 1. Clears, combos, and peak score raise it. Fail points lower it. Each ad moment lowers it by `0.08 * adAversion`, capped at 0.45. A frustration, boredom, or ad quit subtracts 0.04.
- `quitReason` on every session: `frustration`, `boredom`, `ad`, `game_over`, or `null`. `anomaly` is `safety_cap` when the safety cap stops the session. That cap is not a quit reason.

The session ends when the persona quits, when the adapter reports game over and they leave, when `ended` is set, or at the safety cap. The cap is high and is reported as an anomaly.

## Personas

Built in: `casual`, `skilled`, `quitter`, `ad-averse`.

| Param | Meaning |
| --- | --- |
| `skill` | Chance to take the highest-line legal move. Otherwise a legal move is uniform. |
| `frustrationThreshold` | Quit when frustration reaches this value. |
| `frustrationDecay` | Subtracted from frustration on each mood tick. |
| `noFitGain` | Added when play is open and no move fits. |
| `failedGain` | Added when `perform` rejects a move. |
| `boredomMoves` | Quit after this many placements with no clear. |
| `adQuitAfter` | Ad-averse only. Quit when this many ad moments have been seen. Omit it and ads are closed or answered instead. |
| `adWatchRate` | Chance to accept a rewarded offer. |
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

const persona = resolvePersona('casual', { boredomMoves: 4, adWatchRate: 0 });
```

From the CLI, `--persona-file overrides.json` merges the same fields. The file is keyed by persona id:

```json
{ "quitter": { "boredomMoves": 2 } }
```

Quit decisions are deterministic from the board. Skill, ads, continues, restarts, hints, and analytics still draw from `mulberry32(seed)`. Frustration starts at 0. Each tick subtracts `frustrationDecay`, then adds `noFitGain` or `failedGain` when that event happened. A clear resets the boredom counter and still decays frustration. A restart, or a board that leaves the failed state, resets both. Ad-averse leaves when `adCount` reaches `adQuitAfter`. Other personas do not quit just because an ad is on screen.

## Compare variants

Pass at least two `--variant id=path` arguments. Paths are pacing files the host already knows how to validate. The loop is variant, then seed, then persona, so every variant sees the same seeds.

```bash
node studio-core/sim/cli.js \
  --adapter sim/<game>-adapter.js \
  --variant control=config/pacing.json \
  --variant quiet=sim/variants/quiet-ads.json \
  --seeds 1,2 \
  --personas casual,skilled,quitter,ad-averse \
  --out sim/out
```

`--max-steps` is optional. It sets the safety cap (default 500), not a session length. Hitting it records `anomaly: safety_cap` and leaves `quitReason` empty. Results JSON includes `quitReason` on every session. The markdown summary lists it per session.

That writes `sim/out/results.json` and `sim/out/summary.md`.

Use the seed for the game's own RNG as well. A fixed clock time derived from the seed is enough when the game seeds itself from `Date.now()`. Pause that clock before the page loads. A running mock clock drifts by the page-load time, and a one-millisecond change reseeds the game.

## Add a game

1. Leave this folder free of host imports. Put the adapter in the host repo, conventionally `sim/<game>-adapter.js`, and export `createAdapter`.
2. Drive the real game headlessly. Playwright is the expected tool. Block service workers if they would cache the first variant's config.
3. When the page URL contains `?sim=1`, expose a bridge, for example `globalThis.__playerSim = { ready, getState, perform, isGameOver }`. `getState` includes legal moves. `isGameOver` is true only when the match is over. `perform` must call the same placement and button paths a player uses, so ads, failure, and round changes stay real.
4. Do not change game rules for the bot. Listing moves may call existing pure helpers. A thin hook in the host boot file is enough to publish state and forward actions.
5. Add a second pacing file that still passes the host's guardrail check. Compare it with the shipped pacing file.
6. Add an `npm run sim` script and a GitHub Actions workflow on `ubuntu-latest`. Cache npm and the Playwright browser directory. Run on `pull_request` and `workflow_dispatch`. Upload `results.json` and `summary.md`, and append the markdown to `$GITHUB_STEP_SUMMARY`.

`node --test` in this package covers the runner with an in-memory adapter. It does not launch a browser. The host's own tests should cover move listing and the variant files.

## Analyze results

`studio-core/sim/analyze/` reads a sim results file, builds a compact summary (comparison metrics and quit-reason counts, not every session), and asks a local Ollama server for ranked config changes. `--resim` forwards `maxSteps` as the safety cap.

```bash
node studio-core/sim/analyze/cli.js \
  --input sim/out/results.json \
  --pacing config/pacing.json \
  --tuning config/tuning.json \
  --out sim/out/analysis \
  --history sim/history/runs.jsonl
```

That writes `analysis.json` and `analysis.md`. The model reply must be JSON:

```json
{
  "proposals": [
    {
      "id": "lower-cap",
      "rank": 1,
      "title": "Lower the interstitial cap",
      "rationale": "The quiet variant kept more of the session.",
      "config": "pacing",
      "patch": { "ads": { "interstitial": { "maxPerSession": 1 } } },
      "expectedEffect": "fewer ad moments"
    }
  ]
}
```

`config` is `pacing` or `tuning`. `patch` is a deep partial of that file. Rank 1 is the preferred change.

The client posts to `{OLLAMA_HOST}/api/chat` with `format: json`. Defaults:

| Setting | Flag | Env | Default |
| --- | --- | --- | --- |
| Server | `--ollama-url` | `OLLAMA_HOST` | `http://localhost:11434` |
| Model | `--model` | `OLLAMA_MODEL` | `qwen2.5-coder:3b` |
| Fallback | `--fallback-model` | `OLLAMA_FALLBACK_MODEL` | `llama3.2:3b` |

Flags win over env. If the first model responds 404, the client tries the fallback once. Pull a model before the first run (`ollama pull qwen2.5-coder:3b`). A response that is not the schema above is sent back once for repair. A second invalid response is rejected and nothing from it is applied.

Each proposal that parses is merged onto a copy of the current pacing or tuning file and checked with `validateGameConfig`. Proposals that break a guardrail are dropped. The output lists them under rejected with the rule and message. Only passing proposals are accepted, and each accepted entry includes the patched config.

`--resim --adapter sim/<game>-adapter.js` re-runs the session runner for each passing proposal, using the same seeds as the input file, and stores the metric delta as `estimate`. A resim error rejects that proposal. Leave the flag off unless a local browser run is worth the time.

### History and trends

Each analyze run appends one JSON line to the history file: timestamp, git SHA, model and config paths, the results summary, and the accepted and rejected proposals. The default path is `sim/history/runs.jsonl`. Those `*.jsonl` files are gitignored because they are local run logs. Copy one into the repo under another path and pass `--history` if a trend should be shared.

```bash
node studio-core/sim/analyze/cli.js trends --history sim/history --out sim/out/analysis/trends.md
```

Trends reads every `*.jsonl` in that directory and prints would-return, clears, ad moments, quit rate, and accept/reject counts in time order.

### Optional Windows helper

Analyze speaks to Ollama over HTTP. It does not call `C:\Studio\local-llm\ask.ps1`. On a machine that already has that helper, you can pipe the written markdown through it for a second opinion:

```powershell
Get-Content sim\out\analysis\analysis.md | & C:\Studio\local-llm\ask.ps1
```

### CI

Unit tests mock the HTTP client and never open a server. Do not run analyze in CI. The sim workflow does not call it.
