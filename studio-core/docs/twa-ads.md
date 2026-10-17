# Ads in a Trusted Web Activity

This is a draft note for the Play package. It does not enable an ad network.

## What a TWA can run

A Trusted Web Activity opens the installed browser, usually Chrome, on the site. The page is the website. The Android package does not own the rendering engine, and it cannot inject the Google Mobile Ads SDK into that browser. `android/app/build.gradle` depends on Android Browser Helper only. It does not depend on `play-services-ads`.

The studio-core AdMob adapter therefore does not call Google. It offers `showInterstitial` and `showRewarded` to the guard in `ads/guard.js`. On the web, and inside the TWA, `createWebAdBridge()` finds no `__studioAdsBridge` and returns `bridge_unavailable`. A custom WebView shell could install that bridge later. A TWA is not that shell. Even then, the adapter hard-codes Google's published Android demo ad units (`ca-app-pub-3940256099942544`). It ignores any unit id a caller might try to pass.

Guardrails still wrap the adapter. Children, disallowed breaks, frequency caps, and a missing rewarded opt-in never reach the bridge. A promise result is discarded, so the adapter cannot hide a network request behind an async call.

## AdMob native

Use the Google Mobile Ads SDK only in an Android app whose UI you draw, or in a WebView you embed yourself. That app needs a real AdMob app id, the `AD_ID` permission behavior that comes with the SDK, a privacy policy, and a Data safety update. Google's demo units are for development. They must be replaced before a production release, and test devices are required if you exercise real units. None of that belongs in this TWA project.

Native AdMob can show an interstitial at a break the game already treats as a natural pause, and a rewarded ad after an explicit opt-in. Those are the same limits `guard.js` enforces. The difference is where the creative renders: in the native activity, not in Chrome.

## H5 Games Ads and AdSense

Ads that are part of the page can run inside a TWA, because the TWA is the page. Google's H5 Games Ads and AdSense tags are web scripts. They are the format that matches this package if ads are turned on later. They still have to pass the studio-core pacer: no ads for under-13 players, interstitials only at `game_over` and `between_rounds`, rewarded placements only `continue` and `hint` after opt-in, and no personalized ads for children. A web tag must not load before that consent decision.

AdSense in a game also changes the Play ads declaration, Families policy if under-13 players can still launch the app, and the Data safety form. The current web build does not include those tags. The in-game advertisement screen is a local placeholder and does not request a network.

## What to ship now

Ship the TWA without an ad SDK. Keep the AdMob adapter as a guarded, test-id-only bridge that no-ops on the web. If the site later enables H5 Games Ads or AdSense, add that provider behind `createGuardedAds` and update `store/data-safety.md` before anyone submits the listing. Do not add `play-services-ads` to the TWA to work around the missing bridge.
