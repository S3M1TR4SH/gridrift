# Trusted Web Activity

`twa-manifest.json` is a [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) manifest. The package id `com.gridrift.app` is a placeholder. `host` is the placeholder Vercel domain `gridrift.vercel.app`, and `startUrl` is `/`, so the activity opens `https://gridrift.vercel.app/`. This repository is not linked to a Vercel project. Replace the host, icon URLs, and web manifest URL with the real deployment before building a store artifact.

`signingKey.path` points at `android.keystore`. That file is gitignored. CI creates it only from GitHub secrets and never commits it. When those secrets are absent, the Android workflow builds a debug app bundle and does not sign a release.

The Gradle project in this folder is the TWA shell Bubblewrap would generate. It depends on Android Browser Helper only. It does not depend on the Google Mobile Ads SDK. A TWA opens Chrome and cannot host that native SDK. See `studio-core/docs/twa-ads.md`.

`bubblewrap update` rewrites generated Android files from `twa-manifest.json` and expects the placeholder domain to be reachable. The GitHub workflow does not run Bubblewrap. It builds the checked-in Gradle project so a missing domain does not fail CI.
