# Gridrift Retention Spec (D1/D7 focus), v1
Written 2026-10-16 (CT). Target: Gridrift (block puzzle, repo S3M1TR4SH/gridrift, Google Play).
This builds on `/workspace/studio/engagement-ad-design.md` (ads, juice, near-miss ethics, GameAnalytics benchmarks) and `/workspace/playtest/` (human playtest on 459e3c3, sim on e6742e4). That work is referenced here, not repeated.

**Tags:** **[Data]** = published figure with a link. **[Obs]** = our own playtest or sim observation. **[Est]** = our judgment or estimate, not sourced. No impact number in this file is a Gridrift forecast. Cited lifts come from other products (often not puzzle games) and only show direction and rough size.

## Baseline targets (from the earlier doc)
GameAnalytics 2025 benchmarks [Data]: top-quartile D1 is 26.5-27.7%, median D7 is 3.42-3.94%, and top-quartile D7 is 7-8%. https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
Gridrift goal [Est]: D1 25%+ and D7 7%+.

## Ranking method
Rank = (expected D1/D7 effect × confidence) ÷ effort. Items that fix observed blockers ([Obs]) rank above new features, because a missing payoff or a progress wipe caps retention no matter what else ships.

---

## 1. Persist progress, best score, and a welcome-back screen. Effort: S. Metric: D1
- **Why:** a reload wipes the score, the run, and the best score, with no welcome-back (playtest fix #3, screenshot 09) [Obs]. Every top title (Block Blast, Woodoku, 1010!) keeps a visible high score and resumes the run [Est, common genre practice; Woodoku's Endless mode is framed around beating your high score: https://www.appireview.com/com.tripledot.blockbash].
- **Expected impact:** [Est] high. Without this, nothing gives a player a reason to return the next day. No published lift exists for this specifically.
- **Compliance:** store data locally only. No account wall (a daily-puzzle dev reported that a signup wall cost first sessions: https://dev.to/andystanly/retention-lessons-from-building-a-daily-puzzle-the-streak-is-not-the-feature-435k).
```json
"persistence": { "saveRunOnEveryPlacement": true, "storage": "local", "trackBestScore": true,
  "welcomeBack": { "enabled": true, "showBestScore": true, "showStreak": true, "minAwayMinutes": 30 } }
```

## 2. Make the core payoff work: clear juice, combos and in-run streaks. Effort: S-M. Metric: D1, session length
- **Why:** clears feel flat and combos showed up in only 2 of 40 sim sessions. Casual sim players averaged 1 clear [Obs]. Woodoku pays out Combo points for multi-clears and Streak points for clearing on consecutive turns (https://kashkick.com/guide/game-tips/woodoku-blast-puzzle-like-a-pro-while-earning-money/). Juice tiers are specified in engagement-ad-design.md §4.
- **Expected impact:** [Data, analogous] Duolingo found that adding a celebration animation on streak extension raised 7-day retention of new learners by +1.7% (relative) (https://blog.duolingo.com/how-duolingo-streak-builds-habit/). This is a different product. For Gridrift, [Est] high, because this is the core reward moment.
- **Note:** make the in-run streak forgiving, allowing 1 non-clearing placement before it resets (playtest fix #5).
```json
"feedback": { "clearFx": ["flash","particles","scorePopup"], "multiClearFx": ["shake","pitchRise"], "maxFxMs": 400,
  "combo": { "enabled": true, "multiplierPerLine": 1.0, "showCounter": true },
  "runStreak": { "enabled": true, "graceMoves": 1, "bonusPerStep": 10 },
  "haptics": { "enabled": true, "userToggle": true }, "respectReducedMotion": true }
```

## 3. Zero-text onboarding with a guaranteed first win. Effort: S-M. Metric: D1
- **Why:** players get a bare board with unexplained "Shallow drift" / "Clears 0/4" labels [Obs]. 15 of 40 sim sessions ended within 8 steps, several at step 2 with score 0 [Obs].
- **Pattern:** 2-3 scripted placements on a pre-filled board that guarantee a line clear inside the first ~15 seconds, then hand off to a real game. No modal tutorial walls. A daily-puzzle developer reported that whether a first session ended solved was their most predictive return metric, and that "the board teaches itself faster than a modal" (dev.to link above, anecdotal and not a controlled study). Woodoku runs a short tutorial first (https://wzz.co.jp/game_app/article1626/).
- **Expected impact:** [Est] high for D1. No published block-puzzle FTUE lift figure was found.
- **Also:** label goals in plain words ("Clear 4 lines") and use a fixed tray (playtest fix #4). Offset the dragged piece above the finger (fix #8).
```json
"onboarding": { "enabled": true, "scriptedBoards": 2, "guaranteeFirstClearWithinMoves": 3, "textMaxWords": 6,
  "skipForReturningPlayers": true, "firstSessionNoInterstitials": true, "dragOffsetPx": 60 }
```

## 4. Difficulty curve: real tension, a fair deal, and gentle mercy. Effort: M. Metric: D1, D7
- **Why:** 0 fails in 40 sim sessions. With no risk there's no excitement, and the restart and continue flow never runs [Obs]. There are about 5 shapes [Obs]. Block Blast reportedly switches to a mode that deals ideal pieces after several losses in a row (https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/).
- **Rule:** dynamic difficulty must be independent of whether an ad is available, and never manufactures a loss (engagement-ad-design.md §5). Mercy only ever makes the game easier.
- **Expected impact:** [Est] medium-high. Validate with the sim (fail rate, session length).
```json
"difficulty": { "shapePool": "full", "minShapes": 15, "rampByScore": [[0,"easy"],[300,"normal"],[1200,"hard"]],
  "fairDeal": { "guaranteeOnePlaceable": true }, "mercy": { "afterLossesInRow": 3, "easierDealRuns": 1 },
  "adIndependentRng": true }
```

## 5. Daily Challenge (seeded board) and day streak with freezes. Effort: M. Metric: D7 (and D1 → D2)
- **Why:** Woodoku runs one Daily Challenge puzzle per day with rewards and a 7-day streak reward (kashkick link above; https://wzz.co.jp/game_app/article1626/). Block Blast shows a streak counter with no milestone rewards, which Balancy calls a missed opportunity (Balancy link above).
- **Expected impact:** [Data, analogous, Duolingo, not a puzzle game]
  - Two equippable freezes raised daily active learners by +0.38% (relative) (https://blog.duolingo.com/how-duolingo-streak-builds-habit/).
  - Separating the daily goal from the streak raised D14 by +3.3% and the share of daily learners on a streak by +10.5% (https://blog.duolingo.com/improving-the-streak/).
  - The "Weekend Amulet" made users 4% more likely to return a week later (https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/).
  - Three freezes were no better than two (https://www.youtube.com/shorts/GnnkWoXaGSo).
  - [Est] for Gridrift: medium-high for D7.
- **Design:** the challenge should be solvable in 2-4 minutes. The streak counts "played the daily" and is kept separate from score. Freezes are earned through play (max 2), and are **never** sold or tied only to ads. No loss-aversion copy ("You'll lose everything!"). Seeds are the same for everyone, which allows a shareable result later.
```json
"dailyChallenge": { "enabled": true, "seed": "utcDate", "targetMinutes": [2,4], "objective": "clearLines", "objectiveRange": [8,20],
  "reward": { "type": "cosmeticCurrency", "amount": 20 } },
"dayStreak": { "enabled": true, "countsOn": "dailyChallengeComplete", "rolloverHourLocal": 4,
  "freezes": { "max": 2, "earnEveryNDays": 7, "purchasable": false, "adOnly": false },
  "milestones": [3,7,14,30], "milestoneFx": true, "lossCopyTone": "neutral" }
```

## 6. Notifications: opt-in after value, few and relevant. Effort: S-M. Metric: D1 → D2, D7
- **Why/data:**
  - [Data] Urban Airship (2,400 apps): games opt-in users open 35% more often, and month-1 retention was 55% for opt-in users vs 29% for opt-out across apps. That's correlational. The same coverage recommends asking after the tutorial, not at launch (https://www.pocketgamer.com/news/chart-of-the-week-why-getting-players-to-opt-in-to-game-push-notifications-matte/).
  - GSN (Solitaire TriPeaks): welcome messages gave +9% week-1 retention (https://www.casestudies.com/company/airship/case-study/gsn-games-takes-mobile-engagement-to-the-next-level-using-airship).
  - Subterfuge's accidental test: D2-D7 retention was 15-26% lower without push (https://www.gamespresso.com/2015/10/subterfuge-developers-accidentally-perform-study-on-push-notifications/).
  - Duolingo credits a late-day streak-saver reminder as its first big streak win (https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth).
- **Expected impact:** [Est] medium for D1→D2 and D7. Vendor figures are correlational.
- **Policy:** on Android 13+, POST_NOTIFICATIONS is a runtime permission. Ask with a pre-prompt only after the first completed run or the first daily, and never at first launch. Allow at most 1 a day, respect quiet hours, and include an in-game toggle. No fake urgency, no "your streak is dying!!" guilt, and no notifications if the user is a known minor or under-13 [Est/compliance].
```json
"notifications": { "enabled": true, "askAfter": "firstDailyOrRunComplete", "prePrompt": true, "maxPerDay": 1,
  "quietHoursLocal": [21,9], "types": { "dailyReady": true, "streakReminder": { "enabled": true, "hoursBeforeRollover": 3, "onlyIfStreakAtLeast": 3 } },
  "stopAfterIgnored": 3, "inGameToggle": true }
```

## 7. Light progression: player level plus a Journey/Adventure track. Effort: M-L. Metric: D7
- **Why:** Woodoku Blast pairs Endless with Journey (objective levels: color quotas, ice, odd boards), credited with keeping it fresh (appireview link). Block Blast's 7-day Adventure has 96 levels that reveal a pixel image, but Balancy notes it has no reward or gallery (Balancy link).
- **Expected impact:** [Est] medium for D7. Ship a minimal version first: XP per run → level → cosmetic unlocks. Journey comes later.
```json
"progression": { "xp": { "perLineClear": 1, "perRun": 5, "dailyBonus": 20 }, "levelCurve": { "base": 50, "growth": 1.15 },
  "journey": { "enabled": false, "levels": 60, "objectives": ["clearLines","collectColor","clearIce"], "collectionGallery": true } }
```

## 8. Cosmetics: earned themes and block skins, deterministic. Effort: S-M. Metric: D7
- **Why:** gives levels and streaks something to pay out. Woodoku's distinctive look is a noted draw (appireview). Rewarded-ad cosmetic unlocks are allowed if disclosed (engagement-ad-design.md §3).
- **Rules:** no loot boxes and no undisclosed random rewards. Show the price or unlock condition up front.
- **Expected impact:** [Est] low-medium on its own. It multiplies the effect of #5 and #7.
```json
"cosmetics": { "themes": 6, "unlock": "deterministic", "sources": ["level","streakMilestone","dailyCurrency","rewardedAdDisclosed"],
  "randomRewards": false, "showUnlockCondition": true }
```

## 9. Session hooks: "one more" without coercion. Effort: S. Metric: sessions/day, D1
- **Pattern:**
  - Results screen: score vs best, "X from your best" (an honest near-miss, §5 of the ad doc), progress to the next level or unlock, and a one-tap "Play again".
  - Undo or revive offer at most once per run, with a clear "No thanks".
  - Rewarded hint only when the player is stuck, and it must point to a meaningful move (sim finding #4, playtest #9).
  - No interstitial in the first session or the first 3 runs. Breaks only on game over (sim finding #5).
- **Expected impact:** [Est] medium. Validate with the sim.
```json
"sessionHooks": { "resultsScreen": { "showDeltaToBest": true, "showNextUnlock": true, "playAgainOneTap": true },
  "revive": { "maxPerRun": 1, "declineButtonProminent": true }, "hint": { "onlyWhenStuck": true, "minMovesBeforeOffer": 15, "cooldownMoves": 20 },
  "ads": { "noInterstitialFirstRuns": 3, "interstitialPlacements": ["gameOverNext"], "frequencyHintSec": 120 } }
```

---

## Policy guardrails (apply to all items)
- **Play Ads policy and AdMob rewarded rules:** see engagement-ad-design.md §1.
- **Banned:** loss-aversion guilt copy, fake timers, streak repair sold or ad-only, rigged deals, and undisclosed random rewards.
- **Families/COPPA:** if a meaningful under-13 audience is possible, use non-personalized ads only and Families-certified SDKs, with no push to known minors and no behavioural tracking. Decide the Play target-audience declaration before launch [Est].

## Sim-runner validation (studio-core/sim)
| Hypothesis | Variant knob | Sim metric | Notes |
|---|---|---|---|
| Juice and combos raise engagement (#2) | `feedback.combo`, `runStreak.graceMoves` 0/1/2 | clears, combos, would-return | The sim can't feel juice. Measure combo frequency only |
| Scripted onboarding cuts early quits (#3) | `onboarding.enabled` | % sessions ≤8 steps | Currently 15/40 |
| Difficulty ramp creates tension (#4) | `rampByScore`, `minShapes`, `mercy` | fail rate (target >0), session length | Currently 0 fails |
| Hint cooldown reduces mid-ad quits (#9) | `hint.minMovesBeforeOffer` 6/15/25 | quits during ad, would-return | |
| Interstitial gating (#9) | `noInterstitialFirstRuns` 0/3 | would-return (skilled) | Earlier −0.053 |
| Daily, streak and notifications (#5, #6) | n/a | not measurable | The sim has no return-visit model. Use live A/B |

## Mixpanel events and funnels
**Events** (props in brackets):
- `app_open` (is_first, days_since_install, streak)
- `onboarding_step` (step) / `onboarding_complete` (ms)
- `run_start` (mode: endless/daily/journey, run_index)
- `line_clear` (lines, combo, run_streak)
- `run_end` (score, best, is_new_best, moves, cause: stuck/quit)
- `daily_start` / `daily_complete` (seed, ms)
- `streak_update` (value, freeze_used)
- `freeze_earned`
- `level_up` (level)
- `cosmetic_unlock` (id, source)
- `notif_preprompt` (accepted), `notif_permission` (granted), `notif_open` (type)
- `revive_offer` / `revive_accept`, `hint_offer` / `hint_accept`
- `ad_break` (placement, adBreakDone status)

**Funnels:**
1. FTUE: `app_open(is_first)` → `onboarding_complete` → first `line_clear` → `run_end` → second `run_start`
2. Daily: `app_open` → `daily_start` → `daily_complete` → `streak_update`
3. Notifications: `notif_preprompt` → `notif_permission` → `notif_open` → `run_start`
4. Monetization fairness: `revive_offer` → `revive_accept` → `run_end`, segmented by D1 retention

**Retention reports:** D1 and D7 by onboarding variant, notification opt-in, and whether the daily was completed on day 0.

## Gaps
- No published block-puzzle-specific A/B lifts were found for onboarding, streaks, or notifications. Every cited lift comes from Duolingo, a solitaire title, or a cross-app vendor study.
- Block Blast and Woodoku mechanics come from third-party reviews and deconstructions, not developer sources.
- Sources were checked by search snippet on 2026-10-16. Pages were not fully fetched.

---

## Playtest 9b0e0c9 evidence (2026-10-17 CT)
Source: `/workspace/playtest/2026-10-17-9b0e0c9/human-pass.md` and screenshots 03-12. The human-feel gate **failed**: average 4.6/10 (needs at least 6), lowest score 2 (Return hook). Observations marked (XD) come from XD S1M's review of the screenshots.

**Ranking decision:** the existing order holds. The playtester's top 3 match items #1 (persist/welcome-back, Return hook score 2), #2 (clear payoff, Juice score 3) and #3 (onboarding, clarity score 4) exactly. The pass adds one **ship blocker** (P0), which is not a retention item but must be fixed before any live ad test.

### P0 (policy). Game-over continue offer: disclose the reward and make Restart primary. Effort: S
Evidence:
- (08, XD) The "No moves left" modal shows **Continue** and **Restart** as identical blue buttons with a large empty gap between them. Continue doesn't say what it costs or what it gives.
- (09) The rewarded placeholder shows "Cancel" and "Grant reward" with no reward described.
- (10) The reward turned out to be rows wiped, which was never disclosed beforehand.

AdMob requires the player to opt in after being told the action and the reward (https://support.google.com/admob/answer/7313578; see engagement-ad-design.md §1).

Fix:
- Label the button "Watch ad: clear 3 rows" (or whatever the fixed reward is), with an ad icon.
- Make Restart the filled primary button and Continue the secondary/outline button. Keep "No thanks" visible.
- Remove the gap.
- Show the same reward text on the ad intro screen.
```json
"sessionHooks.revive": { "maxPerRun": 1, "declineButtonProminent": true,
  "label": "Watch ad: clear {n} rows", "reward": { "type": "clearRows", "n": 3, "deterministic": true },
  "primaryAction": "restart", "reviveButtonStyle": "secondary", "showAdIcon": true, "introRepeatsReward": true }
```

### #1 update: build on the existing per-level clear goal
(b, XD) The header already shows Score, Streak, the level name (Shallow drift → Crosscurrent) and Clears x/4 or x/6, and 07 shows a level-complete card. A level ladder already exists, so persist it instead of inventing a new progression. (11) A reload still resets everything.
```json
"persistence": { "saveRunOnEveryPlacement": true, "storage": "local", "trackBestScore": true,
  "persistLevel": { "enabled": true, "fields": ["levelId","clears","clearsGoal","score","streak","board","tray"] },
  "welcomeBack": { "enabled": true, "minAwayMinutes": 30, "showBestScore": true, "showStreak": true,
    "copy": "{levelName}: {clears}/{clearsGoal} clears. Best {best}", "cta": "Continue level" } },
"progression": { "source": "existingLevelLadder", "xp": { "perLevelComplete": 20 }, "levelCompleteCard": { "fx": true, "showNextLevelGoal": true } }
```

### #2 update: clear payoff
(04b, 07) A row clear and the level-complete card are plain. Also: invalid drops snap back silently (human fix #4), and the tray shifts left after each placement (fix #5).
```json
"feedback": { "clearFx": ["flash","particles","scorePopup"], "streakFx": { "minStreak": 2, "popupText": "Streak x{n}" },
  "levelCompleteFx": ["confetti","goalCheck"], "invalidDropFx": ["shake","softSound"], "maxFxMs": 400 },
"tray": { "fixedSlots": true }
```

### #3 update: onboarding
(c, XD) The first board deals trivial straight pieces onto an empty grid with no instruction text (12). "Clears x/y" is never explained (human fix #3). Keep the easy first deal, since it guarantees an early clear, but add guidance.
```json
"onboarding": { "enabled": true, "scriptedBoards": 2, "prefilledFirstBoard": true, "guaranteeFirstClearWithinMoves": 3,
  "coachMarks": [ { "target": "tray", "text": "Drag a block onto the grid" },
                  { "target": "board", "text": "Fill a row or column to clear it" },
                  { "target": "clearsGoal", "text": "Clear {clearsGoal} lines to finish the level" } ],
  "textMaxWords": 8, "dismissOnAction": true, "skipForReturningPlayers": true }
```

### Mobile layout (supports #1 and #3). Effort: S
(d, XD; 12, human fix #6) At 390px portrait there's a large empty band above the board, the cells are about 37px, and the tray sits low, which is fine for thumb reach. Move the board up and use the top band for the best score and the level goal. This makes the return hook and the goal visible without adding modals.
```json
"layout.mobilePortrait": { "boardAnchor": "upper", "topPanel": { "enabled": true, "show": ["bestScore","levelName","clearsProgressBar"] },
  "trayAnchor": "bottom", "minCellPx": 40, "hudMinFontPx": 14, "dragOffsetPx": 60 }
```

### Seen working (keep)
- Drag input scored 8/10 for responsiveness.
- Game-over copy is kind ("Restart is always available").
- The continue offer is opt-in.

### Not yet verified
- A break ad and the continue re-offer loop the sim found. Re-test both after the P0 fix.

---

## Playtest 65d60f9 evidence (2026-10-17 CT)
Sources:
- `/workspace/playtest/2026-10-17-65d60f9/gridrift-retest-2026-10-17-65d60f9.md` and `raw-session-notes.md`
- Screenshots 01-16. The clips weren't watched; their content is taken from the report text.
- Gate report: `/workspace/playtest/release-gate/gridrift-main-65d60f9-gate.md`

**Gate:** FAIL.
- Median sim session was 32.6s (needs 60s).
- Human-feel average 4.6 (needs 6), with difficulty at 2 (needs 4).
- Ads are disabled in `config/pacing.json`, so the ad gate passed by code review only.

Observations marked (XD) come from XD S1M's review of the screenshots.

### Progress on items #1-#3
| Item | Status | Evidence |
|---|---|---|
| #1 Persist + welcome-back | **Mostly done.** A reload restores score, best, streak, round, lines and the exact board. Return hook went from 2 to 5. Still open: the welcome-back banner hasn't been seen (it needs 30+ min away), and Restart silently resets Round 3 → Round 1 | 10, 08-09 |
| #2 Clear payoff | **Mostly done.** +38 popup, particles, "Combo 2", red ghost on invalid drops, fixed tray slots. Juice went from 3 to 6. Still open: the streak popup is clipped (d), and the invalid-drop shake and sound weren't confirmed | 04b, 02, 05, 06 |
| #3 Onboarding | **Done.** Play starts on the board with a highlighted row and a goal subtitle. The goal is understood in about 5s and the first clear comes at about 20s. Clarity went from 4 to 8. The per-level clear goal (Lines x/4, x/6, x/8) works | 01, 02 |
| P0 Continue disclosure | **Resolved by removal (c).** Game over shows Restart only. Re-open this when a rewarded continue comes back, using the P0 config from the 9b0e0c9 section | 08, 09 |

### Re-rank (warranted)
Now that #1-#3 are largely done, **#4 Difficulty/tension moves to the top**. Difficulty fell from 6 to 2, the tester couldn't lose in Rounds 1-3, and "a reward every move feels cheap" (reward pacing 5). Excitement and replayability are both at 3, and human players are well behind the sim's 60s session target.

New order:
1. **NEW-P0 compliance:** neutral age screen
2. **#4** Tension
3. **Input fixes** (new)
4. Layout (desktop and portrait)
5. Finish #1 (Restart framing, welcome-back)
6. #5 Daily/streak
7. #6 Notifications
8. #9 Session hooks
9. #7 Progression
10. #8 Cosmetics

### NEW-P0 (compliance). Neutral age screen. Effort: S
(b, XD) The first load shows an inline prompt with "I'm under 13 / I'm 13 or older / 13+ and keep stats", and its text says the under-13 option means no ads and no stats. The tester reports the buttons keep re-rendering, so clicks fail (fix #5).

Keeping under-13 players free of ads and stats is correct. The problem is the prompt itself: it shows which answer unlocks features, it's three self-labelled buttons rather than a neutral question, and it overlaps gameplay. For a mixed audience under Play Families, ask in a neutral way that doesn't push the player toward any particular answer [Est/compliance; interpreting the Play Families policy (https://support.google.com/googleplay/android-developer/answer/9893335) and COPPA (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). Neither page was fetched in this pass; legal review recommended].

Fix:
- Show a full-screen birth-year picker before the first board. It has no default value and no copy saying what any answer unlocks.
- Remember the result locally and don't ask again. A wrong answer can't be retried by reloading.
- Derive the policy from the year.
- Ask for stats consent separately, after the age gate and only for 13+.
- Render the picker once, so its controls are stable.
```json
"ageGate": { "enabled": true, "mode": "birthYear", "showBefore": "firstPlay", "defaultValue": null, "yearRange": [1900, "currentYear"],
  "neutralCopy": "What year were you born?", "revealConsequences": false, "rememberResult": true, "allowRetry": false,
  "underAge": 13, "policyUnder": { "ads": false, "analytics": false, "notifications": false, "personalizedAds": false },
  "policyAtOrOver": { "ads": "nonPersonalizedUntilConsent", "analytics": "askConsent" },
  "statsConsent": { "separateScreen": true, "default": "off" }, "stableRender": true }
```

### #4 Tension. Concrete proposal. Effort: M. Metrics: D1, session length
Evidence:
- (a, XD) The board is now 6x6 (it was 10x10) and deals 3-cell straight pieces. Round 3 at Lines 1/8 still has plenty of room (15).
- The opening board is a solved setup, and "nearly every placement cleared something, even when I placed badly on purpose" (04c).

Diagnosis [Est]:
- The genre reference boards are 8x8 (1010!, Block Blast) or 9x9 (Woodoku; see the appireview link in #4 above).
- On a 6x6 board, a 3-cell straight piece fills half a row, so lines complete almost by themselves.
- The tray deals pieces that are guaranteed to fit, which removes all risk.

**Proposal:**
- Go back to **8x8** for normal rounds. Keep 6x6 only for the scripted first board.
- Use a weighted piece mix that adds awkward shapes as rounds go on (L, T, S/Z, 2x2, 3x3, 1x5).
- Weaken the "fit" guarantee from "every piece fits and helps" to **"at least one piece in the tray can be placed"**.
- Rounds start with partial pre-fill and increasing goals.
- Mercy after repeated losses only ever makes the game easier, and **nothing depends on ad availability or fill**.
```json
"difficulty": {
  "boardByRound": [ { "rounds": [1,1], "size": 6, "scripted": true }, { "rounds": [2,999], "size": 8 } ],
  "pieceMix": {
    "tiers": [
      { "rounds": [1,2], "weights": { "mono": 0.10, "line2": 0.20, "line3": 0.30, "L3": 0.25, "sq2": 0.15 } },
      { "rounds": [3,5], "weights": { "line3": 0.20, "line4": 0.15, "L3": 0.15, "L4": 0.15, "T4": 0.10, "S4": 0.10, "sq2": 0.10, "sq3": 0.05 } },
      { "rounds": [6,999], "weights": { "line3": 0.10, "line4": 0.15, "line5": 0.10, "L4": 0.15, "L5": 0.10, "T4": 0.10, "S4": 0.10, "sq2": 0.10, "sq3": 0.10 } } ],
    "ranges": { "anyWeight": [0, 0.4] } },
  "deal": { "guarantee": "atLeastOnePlaceable", "noHelpfulBias": true, "rng": "seededPerRun" },
  "roundSetup": { "prefillRatioByRound": [[1,0.40],[2,0.20],[4,0.30],[7,0.35]], "prefillRange": [0, 0.45],
    "linesGoalByRound": [[1,4],[2,6],[3,8],[5,10],[8,12]] },
  "fillPressure": { "targetMeanFillRatio": [0.45, 0.65], "dangerFillRatio": 0.75 },
  "mercy": { "afterLossesInRow": 3, "effect": { "pieceTier": -1, "prefillRatio": -0.10 }, "durationRuns": 1, "onlyEasier": true },
  "adIndependent": { "rngIgnoresAdFill": true, "rngIgnoresRewardedHistory": true, "mercyIgnoresAds": true }
}
```

**Sim acceptance targets** [Est; starting bands to tune]:

| Round | Loss rate per attempt | Moves per round | Mean fill ratio |
|---|---|---|---|
| 1 (scripted) | ≤2% | 4-8 | — |
| 2 | 5-15% | 10-20 | 0.40-0.55 |
| 3-5 | 15-30% | 15-30 | 0.45-0.65 |
| 6+ | 25-45% | 20-40 | 0.50-0.70 |

Gates:
- Median session ≥60s (the release-gate target).
- Early-quit rate no worse than today's 6%.
- No round may have a 0% loss rate.
- No round may have a loss rate above 60%.
- **The loss-rate difference between ads-on and ads-off variants must be 0 within noise** (the rigging check).

**Sim fidelity:** the report notes that sim personas reach game over within 20-50 steps, while the human couldn't lose. Calibrate the personas against the human placement policy, which places carelessly and still clears, before trusting these bands.

### NEW input fixes (rank 3). Effort: S
Evidence:
- (14) A quick second drag right after a placement or snap-back is ignored.
- (06) The drop target is computed from the piece's center, not the pointer, so drops land a row off.
- The dragged piece sits centered under the finger.
```json
"input": { "acceptDragDuringSettleAnim": true, "inputLockMs": 0, "dropTargetFrom": "pointerWithOffset", "dragOffsetPx": 60 }
```

### Layout (rank 4). Effort: S
- (e, XD; 16) At desktop width, cells stretch to about 213x85 and tray pieces are distorted. Cap the board width, lock cells square, center the HUD, and size the tray cards to their pieces.
- (d, XD; 05) The "Streak x2" popup clips off the top of the board. Keep popups inside the board.
- Portrait (557px): about 240px of dead space between the board and the tray, and the HUD text is about 12px. Keep the 9b0e0c9 `layout.mobilePortrait` delta.
- The Install button disappears at game over (LOW).
```json
"layout": { "board": { "maxWidthPx": 560, "cellAspect": 1, "center": true }, "hud": { "maxWidthPx": 560, "center": true, "minFontPx": 14 },
  "tray": { "cardMaxPx": 180, "pieceScale": "matchBoardCell" },
  "popups": { "clampToBoardBounds": true, "anchor": "clearCentroid" }, "keepInstallButtonOnModals": true }
```

### Finish #1: Restart framing (rank 5)
(08, 09) Restart silently sends you from Round 3 back to Round 1. Before restarting, state what happens ("Back to Round 1. Best 502 kept"), or restart at the current round's checkpoint. The best option is to A/B test the two.
```json
"restart": { "mode": "checkpointRound", "modeOptions": ["round1", "checkpointRound"], "showConsequenceCopy": true,
  "gameOverCard": { "showBest": true, "showDeltaToBest": true, "primary": "restart" } }
```

### Ads
None are shipped. When they're enabled, use the engagement-ad-design.md rules and the P0 continue config, and re-run the ad gate on a live build.

---

## Playtest 512c500 evidence (2026-10-17 CT)
Sources:
- `/workspace/playtest/2026-10-17-512c500/REPORT.md` and `gridrift-retest-2026-10-17-512c500.md`
- Screenshots 01-15 (clips not watched)
- `/workspace/difficulty/gridrift-retune-v1.1-evidence.md`

**Gate:** FAIL, on human feel only (average 4.8, needs 6). All sim gates pass: calibrated median session 112.3s, D1 proxy 0.866. Ads are still off. PR #12 (studio-core extraction) changed no gameplay, so differences in this pass come from deal variance or a closer look, not code. Observations marked (XD) come from XD S1M's review of the screenshots.

### Playtester top issues
1. Difficulty swings with no ramp: careless play lost in about 8 moves in Rounds 1 and 2, while the last build couldn't be lost.
2. Restart drops you to Round 1 without warning.
3. No welcome-back or daily pull.

### #4 Tension: reconciled with the Difficulty Researcher (supersedes the 65d60f9 #4 proposal)
**Ownership:** difficulty tuning (generator, piece tiers, clear bias, placeability, mercy wiring) belongs to the **Difficulty Researcher**: `/workspace/difficulty/gridrift-difficulty-v1.1.json` plus its evidence doc. Round goals and board size (6x6 vs 8x8) are **Gridrift Studio** decisions. The Difficulty Researcher flagged 8x8 and longer round goals (e.g. 6/10/14) as v1.2 candidates.

**Evidence:** (a, XD) a Round 1 loss at Lines 3/4 on 6x6, alongside easy rounds elsewhere, confirms the swing (06, 07, clip-03). The cause is main's score-band deal: an easy pool, then a cliff (difficulty evidence, "What changed"). v1.1 gives a run-state ramp with intensity 0 until 60s, rising to 1 at 120s. In the human model:
- Losses before 60s went from 4% to 0%.
- Losses in the 90-150s window went from 63% to 81%.
- The p25-p75 window narrowed from 47s to 25s.
- casualSim's median went from 25s to 80s.

The human model was calibrated against one tester and is unconfirmed by real players.

**Changes to the 65d60f9 #4 proposal:**
- **Dropped:** `roundSetup.prefillRatioByRound` for rounds 2+. It conflicts with the no-prefill-after-round-1 rule.
- **Superseded by difficulty v1.1:** the per-round loss-rate bands table, `pieceMix` tiers, `deal`, `fillPressure` and `mercy` values. Leave those to the Difficulty Researcher's config.
- **Moved to Gridrift Studio as options, not engagement requirements:** `boardByRound` (8x8) and `linesGoalByRound`.

**Engagement-side acceptance criteria (the only ones this spec keeps):**
1. **Monotonic ramp, no swings.** Within a run, difficulty never drops except through declared mercy. Across seeds, there's no bimodal "unlosable vs. dead in 8 moves" split. Check in the sim: the share of human-model losses before 60s is about 0, and the time-to-loss distribution is unimodal.
2. **Median session ≥ 60s** (release-gate target) on both the calibrated sim and human runs.
3. **Loss rate identical with ads on or off**, with a gap of 0 within noise. v1.1 already whitelists run-state inputs, so ad availability and best score can't reach the generator. Keep `tests/difficulty-guardrail.test.js` as the gate.
```json
"engagementAcceptance.difficulty": { "owner": "difficultyResearcher", "configRef": "/workspace/difficulty/gridrift-difficulty-v1.1.json",
  "criteria": { "monotonicRamp": true, "maxShareLossesBefore60s": 0.02, "unimodalTimeToLoss": true,
    "medianSessionSecMin": 60, "adsOnVsOffLossRateDelta": 0 },
  "studioOptions": { "boardByRound": "gridriftStudio", "linesGoalByRound": "gridriftStudio" },
  "superseded": ["perRoundLossBands@65d60f9", "roundSetup.prefillRatioByRound@65d60f9"] }
```
Related bug for Studio: game over #2 fired while a column clear was still animating, leaving a stray ghost piece (11). Check for game over only after clear animations settle.
```json
"gameOver": { "checkAfterAnimationsSettle": true, "clearGhostOnEnd": true }
```

### Finish #1: Restart framing plus welcome-back/daily pull (re-ranked up)
- (b, XD) Restart from Round 2 shows Round 1 with Best kept, and gives no warning (11, 12).
  - **Spec:** the game-over text must state the outcome: either "Restart from Round N checkpoint" (checkpoint mode) or "Back to Round 1, best kept" (round1 mode).
  - Add "Retry round" as the primary action when checkpoint mode is on.
  - Studio picks the mode, ideally through an A/B test.
  - Also: the starting board is inconsistent. The first board is pre-filled, a restart gives an empty board, and each new round carries the old board over. Define the restart board explicitly (the Difficulty Researcher owns prefill).
- (f, XD; 10) A Daily button exists, but nothing pulls players to it. The return hook dropped from 5 to 4.
  - **Spec:** on load after 30+ minutes away, show a welcome-back card with yesterday's best, today's Daily status (unplayed / done) and the day streak. Primary action: "Play Daily" when unplayed, otherwise "Continue Round N".
  - Show a **Daily badge** on the Daily button while today's Daily is unplayed.
  - Neutral copy, with no loss-aversion wording.
```json
"restart": { "mode": "checkpointRound", "modeOptions": ["round1","checkpointRound"],
  "gameOverCopy": { "checkpointRound": "Restart from Round {n} checkpoint", "round1": "Back to Round 1, best kept" },
  "primary": { "checkpointRound": "retryRound", "round1": "restart" }, "showBest": true, "showDeltaToBest": true,
  "restartBoard": "defineExplicitly" },
"welcomeBack": { "enabled": true, "minAwayMinutes": 30,
  "card": { "show": ["yesterdayBest","dailyStatus","dayStreak"], "primaryCta": { "ifDailyUnplayed": "playDaily", "else": "continueRound" },
    "lossAversionCopy": false } },
"dailyBadge": { "enabled": true, "showWhen": "dailyUnplayedToday", "style": "dot", "clearOnOpen": false, "clearOnComplete": true }
```

### Still open
- **NEW-P0 age screen: still OPEN.** (c, XD) The prompt is unchanged: three buttons that hint at what each unlocks (01). The tester also reports the buttons re-render (no normal click for about 5s), and closing the banner shifts the board about 75px mid-drag, which made the first drop miss. Keep the 65d60f9 `ageGate` config and add:
  ```json
  "ageGate": { "showBefore": "firstPlay", "fullScreen": true, "stableRender": true, "noLayoutShiftOnClose": true }
  ```
- **Layout: still OPEN.**
  - (d, XD) Desktop cells are still stretched, about 320x125 at 1920px (01). Keep the 65d60f9 `layout.board.maxWidthPx` / `cellAspect: 1` delta.
  - (e, XD) At mobile 390x844 there's about 210px of empty space between the board and the tray (13). Fix it with:
  ```json
  "layout.mobilePortrait": { "trayAnchor": "belowBoard", "trayGapPx": 16, "boardScale": "fitWidthThenHeight", "reclaimDeadSpaceTo": "topPanel" }
  ```
- **Input:** the quick second drag is FIXED. The drop target being about one row off the drawn piece on desktop is still OPEN (02, 05). Touch works. Keep `input.dropTargetFrom: "pointerWithOffset"` and draw the ghost exactly at the drop cells.
- **Readability and juice (new, MED/LOW):** grey tray pieces look the same as the pre-filled junk cells. The "+39" popup is small and dim.
  ```json
  "visual": { "trayPiecePalette": "distinctFromPrefill", "prefillColor": "neutralDim" },
  "feedback.scorePopup": { "minFontPx": 24, "contrast": "high" }, "feedback.comboPopup": { "onBoard": true }
  ```
- **Fixed this build:** quick second drag, streak popup clipping, and reachable game over.

### Adopted in this build
Difficulty v1.2 replaces the local ramp steepening. The ramp is still flat through 60s and full at 80s, with tier steps at 0.3, 0.55, and 0.8. `secondsPerMove` stays 2.5 and is only the fallback while elapsed play time is zero. The sim adds each persona's think time to the in-game play clock, so a 2.2s player keeps that full 60s opening. Mercy counts consecutive game overs; clearing a round does not reset the streak. One mercy run shifts the ramp 30s later and caps the deal one shape tier below the top. That ease never flattens difficulty to zero, and the run can still end. Round 3's loss share is reported from the sim and is not retuned past v1.2.

### Re-rank (warranted)
#4 changes owner and Finish #1 moves up because the return hook fell to 4.

New order:
1. NEW-P0 age screen (compliance)
2. #4 Tension: adopt difficulty v1.1 against the engagement acceptance criteria above
3. Finish #1: restart framing, welcome-back card, Daily badge
4. Input: drop target offset, game-over-after-animations
5. Layout: desktop square cells, mobile gap
6. Readability/juice
7. #5 Daily/streak (the welcome-back card and badge feed it)
8. #6 Notifications
9. #9 Session hooks
10. #7 Progression
11. #8 Cosmetics
