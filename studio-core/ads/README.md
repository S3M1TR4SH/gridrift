# Ads

Providers sit behind one interface. The host never calls an adapter directly.

- `contract.js` checks that an adapter has an id plus `showInterstitial` and `showRewarded`.
- `guard.js` is the only entry point. It asks the pacer before every call. Interstitials run only at natural breaks the pacer allows (`game_over` and `between_rounds`, inside the frequency caps). Rewarded ads run only after `optedIn: true`, and only for `continue` or `hint`. A blocked call does not reach the adapter. A result that comes back as a promise is ignored, so an adapter cannot defer work onto the network.
- `placeholder.js` is the default. It records a local stand-in and does not load a script.
- `bridge.js` is the native hook. Browsers and Trusted Web Activities do not install it, so calls no-op.
- `admob/` speaks to that bridge and can only name Google's official Android demo ad units. It does not load the Mobile Ads SDK.

`docs/twa-ads.md` compares a native AdMob app with H5 Games Ads or AdSense inside a Trusted Web Activity.
