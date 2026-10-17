# New game

studio-core 0.2.0 is the shell. A new game adds genre code. Budget about a day for rules, a first board, and store copy. Do not reimplement ads, consent, pacing, or the Play bundle.

## What you replace

| File | Work |
| --- | --- |
| `templates/new-game/game/genre.js` | Rules, scoring, and the end of a run. This is the genre. |
| `templates/new-game/branding/brand.json` | Name and icons. |
| `templates/new-game/store/` | Listing, data safety, and content rating drafts. |
| `templates/new-game/config/tuning.json` | Grid size and score weights, inside the guardrails. |

Leave `game/shell.js` on the public API (`studio-core/index.js`). It validates config, asks the age gate, and builds guarded ads with the noop adapter.

## What you do not replace

- Consent and the under-13 lock live in `consent/age-gate.js`.
- Pacing, difficulty limits, and `validateGameConfig` live in `guardrails/`. Config that raises a limit fails tests.
- Ads go through `createGuardedAds`. Adapters are `createNoopAdapter`, `createH5GamesAdsAdapter`, and `createAdMobAdapter` with `createCapacitorAdMobBridge`.
- Analytics goes through `createTracker`. A provider adapter is optional and stays off until an adult opts in.
- The Capacitor-shaped Android project is `templates/new-game/android`. It is a WebView shell with a synchronous no-op ad bridge. It does not ship the Mobile Ads SDK.

## Checks

From `templates/new-game`:

```bash
npm test
```

That runs the template shell test plus the shared guardrail, pacing, consent, ads, and AdMob suites. Every game that keeps this package script runs those suites. Dropping a file from the script fails `studio-core/tests/template.test.js`.

The Android bundle is `.github/workflows/studio-shell-aab.yml` in a host repo, and `templates/new-game/.github/workflows/android-aab.yml` when studio-core is the repository root. Both sign a release bundle when the keystore secrets exist, and otherwise build a debug bundle.

## Ads

Start on noop. Switch only after the age gate exists in the genre flow.

- H5 Games Ads: the page may install `__studioH5Ads` with `synchronous: true` and an `adBreak` function that returns a plain object. Do not load a tag before adult consent. A promise result is ignored.
- AdMob via Capacitor: call `createAdMobAdapter({ bridge: createCapacitorAdMobBridge() })`. The bridge uses `__studioAdsBridge` or a plugin that sets `synchronous: true`. Demo ad units stay inside the adapter. Do not add `play-services-ads` to the scaffold.

## Copying the shell out

Copy this `studio-core` directory to the root of a new repository. `templates/new-game` and this document move with it. Run `npm test` from `templates/new-game` before the first genre commit. Licenses for the pieces that were reused are in `THIRD_PARTY.md`.
