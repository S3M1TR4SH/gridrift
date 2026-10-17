# Gridrift: Reward, Juice and Ad Timing Design (policy-safe)
Researched 2026-10-16 (CT). Tag key: **[Policy]** = quoted Google rule, **[Data]** = published benchmark, **[Est]** = our design judgment or estimate, not sourced.

## 1. Hard policy rules (non-negotiable)
- **H5 placement types** [Policy]: `preroll` (max 1 per page load, before UI/sound), `start`, `pause`, `next` (after the player taps "Next"), `browse` (options/menus), `reward` (opt-in). Pick the type that matches the real game state. https://developers.google.com/ad-placement/docs/placement-types
- **H5 frequency** [Policy]: `data-ad-frequency-hint` defaults to `"120s"` (on average, no more than one ad every 2 min). The fastest allowed is one every 30s. The first `adBreak()` is exempt, and Google may override the hint from its servers. https://developers.google.com/ad-placement/docs/ad-rate
- **H5 full-screen ads** [Policy]: only between screens or content pages, or at catalog-to-game transitions, and only through `adBreak()`. https://support.google.com/adsense/answer/9959170
- **adBreakDone statuses** (`frequencyCapped`, `noAdPreloaded`, `ignored`, `viewed`, `dismissed`...) [Policy/docs]: log every one for analytics. If no ad shows, no before/after callbacks fire, so the game must never wait on an ad. https://developers.google.com/ad-placement/apis/adbreak
- **AdMob interstitials** [Policy]: use them at natural transition points. Don't surprise players, show too many, or block use. A close button can take up to 5s to appear (12s for high-engagement video, 30s for some third-party bidders). https://support.google.com/admob/answer/6066980
- **AdMob rewarded** [Policy]: the player must opt in with a clear "yes" before the ad. Before each ad, disclose the action and the reward clearly. Skipping must not hurt normal play. No guilt copy such as "watch to support us". Always deliver the reward. Random rewards need disclosed odds, and the chance must be above 0. No cash or gift-card rewards. Rewarded interstitials need an intro screen with a visible "No". https://support.google.com/admob/answer/7313578
- **Google Play Ads policy** [Policy]: no interstitials during gameplay or at the start of a level. No interstitial right after a button tap and before the action it triggers. No full-screen ad before the splash screen. Interruptive interstitials must be closable within 15s. A post-score-screen ad may run longer. No back-to-back interstitials after consecutive taps ("Made for Ads"). No ads on exit. No fake close buttons. https://support.google.com/googleplay/android-developer/answer/9857753
- **Under-13** [Est/compliance]: if kids could be a meaningful audience, follow Play Families and COPPA rules (non-personalized ads, certified SDKs). This was not researched in depth here.

## 2. Interstitial frequency and placement for Gridrift
- **Where** [Policy-derived]: (a) on "Play again" after the game-over or score screen (`next`/`start`), (b) on `pause`, used lightly, (c) on `browse`, such as opening themes or settings, used sparingly. **Never** mid-board, never on the first tap of a run, and never twice in a row on consecutive taps.
- **How often** [Est]: launch with the default 120s hint and a client-side rule of no interstitial in a player's first session or first 2-3 runs. A/B test 90s against 120s against 180s, and judge on D1/D7 and session count, not just ARPDAU. Don't go faster than 60s without retention data. Interstitials are "system-initiated" ads, the kind payers pay to remove (ironSource via Business of Apps, below).
- **Preroll** [Policy/Est]: one per page load is allowed. Turn it off for returning PWA launches if D1 drops. Test it.
- **Bypass**: a player who just watched a rewarded ad should skip the next interstitial [Est, common practice].

## 3. Rewarded offers that convert
- **[Data] Unity Mobile Growth & Monetization Report 2024** (via Mobile Marketing Reads): rewarded engagement as a share of DAU was 36% for casual games and 38.4% for word games. Ads tied to in-game moments such as running out of resources reached 38.1%, against 23.8% for ads placed between levels. https://www.mobilemarketingreads.com/2023-sees-3-2-increase-in-global-rewarded-video-ad-engagement-unity/
- **[Data] Kongregate, "Best Practices: In-Game Ads"** (Game Developer): 25-50% of users engage, watching 3-8 ads a day. Their target is at least 30% engagement and about 4 ads per player per day. One game rose from 6.5% to 17% by improving how the offer was surfaced, then to 35-40% after a bug fix. https://www.gamedeveloper.com/business/best-practices-in-game-ads
- **[Data] Unity case study, Next Games** (a battle builder, not a puzzle game, so it's an outlier): 75-80% opt-in and $0.06 ARPDAU from rewarded ads. http://response.unity3d.com/ads-case-study-next-games
- **[Data] ironSource** (Business of Apps): rewarded engagement holds steady even after players pay, so treat rewarded ads as a game feature and A/B test them. https://www.businessofapps.com/insights/the-impact-of-rewarded-video-on-wider-game-metrics/
- **Gridrift offers** [Est]: (1) **Continue** on game over: clear 3 random cells or "undo last 3 pieces", once per run, with a big "No thanks". (2) **Piece reroll** when the board is stuck. (3) **Double score or coins** on the results screen. (4) A cosmetic theme unlock. All are non-transferable, in-game, and disclosed up front. Rewards must not be required to make normal progress.

## 4. Reward pacing, combos and streaks (juice)
- [Est] Escalating feedback: a single line gets a small pop, a multi-line clear adds screen shake, particles and a rising pitch, and a combo chain adds a counter, multiplier text and a color shift. Keep each effect under about 400ms so pace stays snappy. Haptics on PWA where supported, with a toggle and reduced-motion support.
- [Est] Rewards on a variable but honest cadence: score milestones, cosmetic unlocks every few runs, and a daily challenge or seeded board with a streak counter. Allow streak "freezes" earned through play. **Don't** sell streak repair only through ads, since that feels like a pressure tactic.
- Reference talk (not verified to load in this pass): Jonasson & Purho, "Juice it or lose it", GDC Europe 2012.

## 5. Near-miss ethics
- [Est/Policy-derived] **No forced failures**: piece generation must never be rigged to cause a loss right before a rewarded "continue" offer. Use the same RNG whether or not an ad is available, and consider a fairness guarantee that every dealt set has at least one valid placement.
- Showing a natural near-miss (for example "1 line from your best") is fine. Manufacturing near-misses to push ad views is a dark pattern and risks policy trouble (misleading incentives, AdMob 7313578).
- Disclose odds on any random reward (AdMob 7313578).

## 6. Benchmarks for setting targets
- **[Data] GameAnalytics 2025 Mobile Benchmarks** (2024 data, 11.6k games): top-quartile D1 26.5-27.7% (bottom quartile 10-11.5%). Median D7 3.42-3.94%, top quartile 7-8%. 75% of games have D28 under 3%. Puzzle is among the best genres for mid- and long-term retention. North America averages D1/D7/D28 of 20.5% / 4.6% / 1.5%. Median session is 5-6 min, top tier 8-9 min. https://files.gameindustrylibrary.com/documents/mobile-gaming-benchmarks-2025.pdf (summary: https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)
- **[Data] Mobile Casual Benchmarks Report 2025**: per user, puzzle games averaged 69.8 interstitials, 24 rewarded videos and 241.5 banners. "Puzzle and Match games can handle frequent interstitial and banner ads." https://files.gameindustrylibrary.com/documents/mobile-casual-benchmarks-report-2025.pdf
- **Gridrift targets** [Est]: D1 25%+, D7 7%+, D28 3%+ (top quartile), rewarded engagement 30%+ of DAU. Web portal traffic usually retains worse than installed apps. No published web-specific puzzle ARPDAU was found.

## 7. Gaps
- No verified public source was found for interstitial-frequency vs. retention curves for web puzzle games. Measure your own.
- The Deconstructor of Fun, AppLovin and Unity primary PDFs were not pulled directly. The Unity 2024 figures come from secondary coverage.
- **Link check (2026-10-16):** the Google pages, Game Developer and Mobile Marketing Reads links returned 200. The gameindustrylibrary PDFs and the Business of Apps link returned 403 to automated curl (likely bot blocking). Their content was confirmed through search snippets, not a direct fetch. The Unity case-study link timed out in curl but appeared with its content in search results.
