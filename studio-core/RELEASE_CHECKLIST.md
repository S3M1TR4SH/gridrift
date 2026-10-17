# studio-core 0.1.0 release checklist

This folder is self-contained. It must not import game code, asset libraries, ad SDKs, or network endpoints. It can be copied into its own repository without the game.

## Before tagging

- [ ] `VERSION`, `package.json` version, and `version.js` all read `0.1.0` (or the new version, changed together).
- [ ] `node --test tests` from this folder passes.
- [ ] A search of this folder finds no imports of the host game (`src/`, `config/`, `levels/`, `branding/`, or the game name).
- [ ] `guardrails/limits.js` is still hard-coded. No limit reads from game config.
- [ ] `validateGameConfig` rejects pacing that exceeds those limits, including an over-limit fixture in the host test suite.
- [ ] Analytics events use `analytics/schema.js` only. The tracker drops events until consent, and `transmit()` does not perform network I/O. A provider adapter is optional and is passed in by the host. It must not load a script until `start()` after adult consent. Under-13 calls `block()` and never loads a provider.
- [ ] Age gate treats under-13 players as children: no ads, no analytics, and stored consent cannot turn those on.
- [ ] Rewarded placements stay opt-in (`continue` and `hint` only). Interstitials stay on `game_over` and `between_rounds`.
- [ ] PWA helpers do not fetch third-party URLs. The host supplies same-origin precache URLs and generated icons.
- [ ] No ad SDK, API key, or tracking URL was added to config. The optional analytics adapter may name a provider script URL and must not request it at import time.

## Extracting to its own repo

1. Copy `studio-core/` to the new repo root (move `package.json` and `VERSION` up if you want them at the root).
2. Keep relative imports inside this package unchanged.
3. Run `npm test` in the new repo before the first publish.
4. Do not vendor the host game's `config/` next to it. The host keeps calling `validateGameConfig` on its own files.
