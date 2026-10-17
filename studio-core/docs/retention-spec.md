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
