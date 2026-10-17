# Capacitor Android scaffold

This is a WebView shell in the Capacitor project shape (`appId` `app.studio.shell`, `minSdk` 24, `compileSdk` 36). Those version pins follow the MIT Capacitor Android template. The activity does not extend Capacitor's `BridgeActivity`, and this folder does not depend on the Google Mobile Ads SDK or the community AdMob plugin.

The packaged page installs `__studioAdsBridge` as a synchronous no-op. `createCapacitorAdMobBridge` uses that bridge. A plugin object is called only when it sets `synchronous: true`. Promise-based AdMob calls are discarded by the guard.

`capacitor.config.json` in the template root is the Capacitor config. To attach the Capacitor runtime later, add the MIT packages `@capacitor/cli` and `@capacitor/android` and point `webDir` at the built page. Do not add an ad SDK in the same change as a store submission.
