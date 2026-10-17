# Third-party notices

studio-core 0.2.0 does not vendor copyleft code. Packages below are MIT. They are not committed as dependencies. The Android scaffold builds without them.

## Capacitor Android template

- Project: Capacitor, `android-template`
- Source: https://github.com/ionic-team/capacitor/tree/main/android-template
- Copyright: 2017-present Drifty Co.
- License: MIT
- What we reused: the SDK pins (`minSdk` 24, `compileSdk` 36) and the idea of a WebView host configured by `capacitor.config.json`.
- What we did not copy: `BridgeActivity`, the Gradle wrapper binaries, `capacitor.settings.gradle`, or the Google services plugin. The shell activity is original and does not depend on `com.capacitorjs` artifacts.

Optional later, still MIT, not installed here:

- `@capacitor/cli` and `@capacitor/android` from the same repository.
- `@capacitor-community/admob` (MIT, Capacitor Community). Its show methods return promises. The guard rejects promise results, so the scaffold does not call that plugin. A synchronous bridge is the supported hook.

## Everything else

Pacing, consent, the ad guard, the noop and H5 adapters, the analytics tracker, the PWA helpers, and the new-game template are original to this package. No GPL, LGPL, or unclear-license code is included.
