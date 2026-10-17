# Playgama stub

`adapter.js` implements the shared ad interface and always returns `sdk_not_loaded`.

Do not add the Playgama SDK, a script tag, or a network call here. `createGuardedAds` in `../guard.js` is the only caller, and it still applies the interstitial and rewarded guardrails if this stub is passed in. The default adapter remains the placeholder.
