import assetManifest from '../assets.manifest.json' with { type: 'json' };
import brand from '../branding/brand.json' with { type: 'json' };
import analyticsConfig from '../config/analytics.json' with { type: 'json' };
import difficultyConfig from '../config/difficulty.json' with { type: 'json' };
import pacingConfig from '../config/pacing.json' with { type: 'json' };
import retention from '../config/retention.json' with { type: 'json' };
import tuningConfig from '../config/tuning.json' with { type: 'json' };
import {
  applyAnalyticsChoice,
  canNotify,
  celebrationLevel,
  consentFromBirthYear,
  createAdMobAdapter,
  createConsentStore,
  createFeedback,
  createGuardedAds,
  createH5GamesAdsAdapter,
  createInstallController,
  createMixpanelAdapter,
  createNoopAdapter,
  createPacer,
  createTracker,
  createWebAdBridge,
  evaluateAgeGate,
  memoryStorage,
  neutralizePacing,
  validateGameConfig,
  validateTuning
} from '../studio-core/index.js';
import { loadAssets } from './assets.js';
import { createAudio } from './audio.js';
import { dateSeed, dailyObjective, daysSinceInstall, formatLocalDate, formatUtcDate, settleDaily, streakDay } from './daily.js';
import {
  INPUT_GUARD_MS,
  agePrompt,
  canOfferContinue,
  canOfferDouble,
  canOfferHint,
  canOfferReroll,
  planBreak,
  planRoundAdvance,
  rowsForContinue,
  shouldIgnoreInput,
  viewModel,
  welcomeCopy
} from './flow.js';
import { createPointerState, pointerReducer } from './input.js';
import { CONTROL_GAP_PX, computeLayout, hitTray, pointerScale, snapOrigin, traySlots } from './layout.js';
import { LEVELS } from './levels.js';
import { dangerCue, dropFeedback, placementCount, roundClearedNotice } from './danger.js';
import { easedRun, generateTray, goalForRound, gridForRound } from './difficulty.js';
import { canPlace, createBoard, createMatch, isStuck, nextScoreGoal } from './logic.js';
import { coachMarks, openingBoard, scriptedBoards, shouldSkipOnboarding } from './onboarding.js';
import { beginRun, milestoneHit, noteLoss, noteSuccess, shouldShowWelcome, STREAK_RESET_COPY, bandShapes } from './retention.js';
import { initialHaptics, initialMotion, shouldVibrate } from './settings.js';
import { drawScene } from './render.js';
import { mulberry32 } from './rng.js';
import { createSaveStore } from './save.js';
import { attachSimBridge } from './sim-bridge.js';
import { createUi } from './ui.js';

const FALLBACK_TUNING = {
  grid: 10,
  traySize: 3,
  continueClears: 3,
  levelOrder: ['round-01'],
  score: {
    place: 1,
    line: 10,
    comboBonusPerExtraLine: 5,
    streakMultiplierStep: 0.5,
    maxStreakMultiplier: 4
  }
};

function bootStorage() {
  try {
    const probe = '__gridrift_storage__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

function activePacing(tuning) {
  if (validateGameConfig({ pacing: pacingConfig, tuning }).ok) return pacingConfig;
  const neutralized = neutralizePacing(pacingConfig);
  if (validateGameConfig({ pacing: neutralized, tuning }).ok) return neutralized;
  return neutralizePacing({});
}

function start() {
  const registry = loadAssets(assetManifest);
  const tuning = validateTuning(tuningConfig).ok ? tuningConfig : FALLBACK_TUNING;
  const pacing = activePacing(tuning);
  document.documentElement.style.setProperty('--control-gap', `${CONTROL_GAP_PX}px`);
  document.documentElement.style.setProperty('--accent', registry.get('ui.button_rectangle_flat.blue').color);
  document.body.style.fontFamily = registry.get('font.kenney-future').family;

  const storage = bootStorage();
  const saveStore = createSaveStore(storage);
  let progress = saveStore.load();
  if (progress.run && progress.run.board.length !== tuning.grid) progress = { ...progress, run: null };
  const consentStore = createConsentStore(storage);
  let consent = consentStore.load();
  const tracker = createTracker({
    getConsent: () => consent,
    adapter: createMixpanelAdapter({ token: analyticsConfig.token })
  });
  void tracker.sync();
  const pacer = createPacer({
    pacing,
    isChild: () => !consent || Boolean(consent.isChild),
    sessionNumber: (progress.sessions || 0) + 1
  });
  const adBridge = createWebAdBridge();
  const noopAds = createNoopAdapter();
  const h5Ads = createH5GamesAdsAdapter();
  const admobAds = createAdMobAdapter({ bridge: adBridge });
  function liveAdapter() {
    if (!consent?.birthYear || consent.isChild || consent.adsAllowed === false || !pacing.ads?.testMode) return noopAds;
    if (canNotify(consent) === false && consent.isChild) return noopAds;
    return adBridge.available ? admobAds : h5Ads;
  }
  const ads = createGuardedAds({
    pacer,
    adapter: {
      get id() {
        return liveAdapter().id;
      },
      showInterstitial(request) {
        return liveAdapter().showInterstitial(request);
      },
      showRewarded(request) {
        return liveAdapter().showRewarded(request);
      }
    }
  });
  let reducedMotion = initialMotion({
    stored: progress.settings?.reducedMotion ?? null,
    query: typeof matchMedia === 'function' ? matchMedia.bind(window) : null
  });
  let hapticsOn = initialHaptics({ stored: progress.settings?.haptics ?? null });
  let sessions = progress.sessions || 0;
  let installDay = progress.installDay || formatLocalDate(new Date());
  let daily = progress.daily || { lastCompleted: '', streak: 0, freezes: 0, marks: 0 };
  const feedback = createFeedback({
    config: tuning.juice,
    reducedMotion,
    now: () => performance.now()
  });
  const audio = createAudio(registry);
  const install = createInstallController();
  const ui = createUi(document);
  ui.setBrand(brand.name);

  const canvas = document.querySelector('#board');
  const ctx = canvas.getContext('2d');
  const palette = registry.tileIds().map((id) => ({ id, color: registry.get(id).color }));
  let layout = computeLayout({
    width: window.innerWidth,
    height: window.innerHeight,
    grid: tuning.grid
  });
  let levelIndex = progress.run?.levelIndex || 0;
  let continueUses = progress.run?.continueUses || 0;
  let continueClosed = progress.run?.continueClosed === true;
  let hintsUsed = progress.run?.hintsUsed || 0;
  let rerollsUsed = progress.run?.rerollsUsed || 0;
  let doublesUsed = progress.run?.doublesUsed || 0;
  let playMs = progress.run?.playMs || 0;
  let sawStuck = progress.run?.sawStuck === true;
  let mode = progress.run?.mode === 'daily' ? 'daily' : 'arcade';
  let mercy = progress.mercy || { lossesInRow: 0, queued: 0 };
  let easyRun = progress.easyRun === true;
  let lossNoted = progress.run?.phase === 'game_over';
  let onboardingIndex = null;
  let onboardingStarted = 0;
  let coachStep = shouldSkipOnboarding(progress) ? null : 0;
  let welcomeOpen = false;
  let moves = 0;
  let dailyNote = '';
  let lastTick = performance.now();
  let pointer = createPointerState();
  let pointerKind = 'mouse';
  let ignoreUntil = 0;
  let overlay = null;
  let rewardKind = null;
  let sessionNoted = false;
  let overlayKey = '';
  let assistDealsLeft = 0;
  let roundNoticeUntil = 0;
  let lastDangerLevel = 0;
  const roundNotice = roundClearedNotice();

  function roundNumber() {
    return levelIndex + 1;
  }

  function level() {
    const id = tuning.levelOrder[Math.min(levelIndex, tuning.levelOrder.length - 1)];
    return LEVELS[id] ?? LEVELS['round-01'];
  }

  function roundGoal() {
    return goalForRound(roundNumber(), difficultyConfig);
  }

  function roundGrid() {
    return gridForRound(roundNumber(), difficultyConfig);
  }

  function scoreTuning() {
    return {
      ...tuning.score,
      graceMoves: retention.feedback.runStreak.graceMoves,
      bonusPerStep: retention.feedback.runStreak.bonusPerStep
    };
  }

  function dealPool(_clears, score) {
    return bandShapes({
      score,
      easy: easyRun,
      pools: pacing.difficulty.pools,
      ramp: retention.difficulty.rampByScore
    });
  }

  function utcSeed() {
    return dateSeed(formatUtcDate(new Date()));
  }

  function makeMatch(saved) {
    const dailyTarget = dailyObjective(utcSeed(), retention.dailyChallenge.objectiveRange);
    const grid = saved?.board?.length || (mode === 'daily' ? tuning.grid : roundGrid());
    return createMatch({
      grid,
      traySize: tuning.traySize,
      score: scoreTuning(),
      rng: mulberry32(mode === 'daily'
        ? utcSeed()
        : ((Date.now() ^ ((levelIndex + 1) * 997)) >>> 0)),
      targetClears: saved?.targetClears || (mode === 'daily' ? dailyTarget : roundGoal()),
      poolFor: dealPool,
      generator: difficultyConfig && mode !== 'daily'
        ? (board, state, rng) => {
          const run = easedRun({
            moves,
            elapsedMs: playMs,
            score: state.score,
            totalClears: state.totalClears,
            assistDealsLeft
          }, { mercy: easyRun });
          const out = generateTray({
            board,
            run,
            cfg: difficultyConfig,
            rng,
            count: tuning.traySize
          });
          if (out.assist && assistDealsLeft > 0) assistDealsLeft -= 1;
          return out;
        }
        : null,
      palette,
      saved
    });
  }

  function scriptedMatch(index, keptScore = 0) {
    const script = scriptedBoards()[index];
    return createMatch({
      grid: tuning.grid,
      traySize: tuning.traySize,
      score: scoreTuning(),
      rng: () => 0,
      targetClears: 99,
      poolFor: () => ['dot'],
      palette,
      saved: {
        board: script.board,
        pieces: script.pieces,
        score: keptScore,
        phase: 'playing',
        targetClears: 99
      }
    });
  }

  function startEasyRun() {
    const started = beginRun(mercy);
    mercy = started.mercy;
    easyRun = started.easy;
    lossNoted = false;
  }

  function freshOpening() {
    const opening = openingBoard(tuning.grid);
    return makeMatch({
      board: opening.board,
      pieces: opening.pieces,
      phase: 'playing',
      targetClears: level().targetClears
    });
  }

  let match;
  if (progress.run) match = makeMatch(progress.run);
  else if (retention.onboarding.enabled && coachStep !== null) {
    onboardingStarted = performance.now();
    match = freshOpening();
    match.showHint();
  } else match = makeMatch();

  function trackRunStart() {
    tracker.track('run_start', {
      mode: mode === 'daily' ? 'daily' : 'endless',
      run_index: sessions
    });
  }

  function screen() {
    if (!consent?.birthYear) return 'age_gate';
    if (consent.needsAnalyticsPrompt) return 'stats_consent';
    if (overlay?.screen) return overlay.screen;
    return 'play';
  }

  function noteSession() {
    if (sessionNoted || screen() !== 'play') return;
    sessionNoted = true;
    const today = formatLocalDate(new Date());
    if (!installDay) installDay = today;
    const days = daysSinceInstall(installDay, today);
    if (sessions === 0) tracker.track('first_open', { game: 'gridrift' });
    const isFirst = sessions === 0;
    sessions += 1;
    tracker.track('session_start', { game: 'gridrift', days_since_install: days });
    tracker.track('app_open', {
      is_first: isFirst,
      days_since_install: days,
      streak: daily.streak || 0
    });
    tracker.track('round_start', { round: level().id });
    if (coachStep === null) trackRunStart();
    else tracker.track('onboarding_step', { step: coachStep + 1 });
    persist();
  }

  function armIgnore() {
    ignoreUntil = performance.now() + INPUT_GUARD_MS;
  }

  function show(next) {
    overlay = next;
    publishOverlay(true);
  }

  function tap() {
    audio.play(feedback.config.sounds.tap);
  }

  function persist() {
    const state = match.state;
    progress = saveStore.save({
      bestScore: Math.max(progress.bestScore || 0, state.score),
      tutorialSeen: progress.tutorialSeen === true,
      sessions,
      installDay,
      lastSeen: Date.now(),
      easyRun,
      mercy,
      settings: { reducedMotion, haptics: hapticsOn },
      daily,
      run: {
        board: state.board,
        pieces: state.pieces.map((piece) => (piece ? {
          shapeName: piece.shapeName,
          color: piece.color,
          tileId: piece.tileId
        } : null)),
        score: state.score,
        streak: state.streak,
        bestStreak: state.bestStreak,
        roundClears: state.roundClears,
        totalClears: state.totalClears,
        targetClears: state.targetClears,
        levelIndex,
        continueUses,
        continueClosed,
        hintsUsed,
        rerollsUsed,
        doublesUsed,
        playMs: Math.floor(playMs),
        sawStuck,
        mode,
        dryMoves: state.dryMoves,
        phase: state.phase
      }
    });
  }

  function openEntry() {
    const away = retention.persistence.welcomeBack;
    welcomeOpen = Boolean(away.enabled && shouldShowWelcome({
      run: progress.run,
      lastSeen: progress.lastSeen,
      now: Date.now(),
      minAwayMinutes: away.minAwayMinutes
    }));
    if (!welcomeOpen) overlay = null;
    publishOverlay(true);
  }

  function playSounds(ids, rate = 1) {
    for (const id of ids) audio.play(id, rate);
  }

  function vibrateFor(lines) {
    const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    if (!shouldVibrate({ enabled: hapticsOn, reducedMotion, supported })) return;
    if (lines < 2) return;
    navigator.vibrate(lines >= 3 ? [16, 20, 16] : [12]);
  }

  function handoff(keptScore) {
    onboardingIndex = null;
    progress = { ...progress, tutorialSeen: true };
    startEasyRun();
    const board = Array.from({ length: tuning.grid }, () => Array(tuning.grid).fill(0));
    match = makeMatch({
      board,
      pieces: [null, null, null],
      score: keptScore,
      phase: 'playing',
      targetClears: level().targetClears
    });
    overlay = null;
    pointer = createPointerState();
    persist();
  }

  function advanceOnboarding() {
    const kept = match.state.score;
    if (onboardingIndex < scriptedBoards().length - 1) {
      onboardingIndex += 1;
      match = scriptedMatch(onboardingIndex, kept);
      pointer = createPointerState();
      tracker.track('onboarding_step', { step: onboardingIndex + 1 });
      persist();
      return;
    }
    const elapsed = onboardingStarted ? Math.round(performance.now() - onboardingStarted) : 0;
    handoff(kept);
    tracker.track('onboarding_complete', { ms: elapsed });
    trackRunStart();
  }

  function interstitialAllowed(breakType) {
    if (pacer.consumeInterstitialSkip(breakType)) return false;
    return ads.canShowInterstitial(breakType);
  }

  function doubleReady() {
    if (consent?.isChild) return false;
    const rewarded = pacing.ads?.rewarded;
    if (!rewarded?.enabled || !rewarded.placements?.includes('double_score')) return false;
    return canOfferDouble({
      doublesUsed,
      rewardedAllowed: ads.canOfferRewarded('double_score')
    });
  }

  function finishRound() {
    pacer.recordRoundEnded();
    if (!easyRun) mercy = noteSuccess(mercy);
    if (mode === 'daily') {
      const before = daily.streak || 0;
      const beforeFreezes = daily.freezes || 0;
      daily = settleDaily(daily, streakDay(new Date(), retention.dayStreak.rolloverHourLocal), {
        rewardAmount: retention.dailyChallenge.reward.amount,
        earnEveryNDays: retention.dayStreak.freezes.earnEveryNDays
      });
      dailyNote = daily.status === 'reset' ? STREAK_RESET_COPY : '';
      const hit = milestoneHit(before, daily.streak, retention.dayStreak.milestones);
      if (hit && retention.dayStreak.milestoneFx) {
        audio.play('sfx.streak.3');
        vibrateFor(2);
      }
      if (['started', 'continued', 'frozen', 'reset'].includes(daily.status)) {
        tracker.track('daily_complete', {
          streak: daily.streak,
          freezes: daily.freezes,
          seed: utcSeed(),
          ms: Math.round(playMs)
        });
        tracker.track('streak_update', {
          value: daily.streak,
          freeze_used: daily.status === 'frozen'
        });
        if ((daily.freezes || 0) > beforeFreezes) tracker.track('freeze_earned', { freezes: daily.freezes });
      }
    }
    tracker.track('round_complete', { score: match.state.score, round: level().id });
    audio.play('sfx.win');
    feedback.levelComplete({
      cell: layout.cell,
      grid: tuning.grid,
      color: '#5ee1b4',
      popupX: layout.boardSize / 2,
      popupY: layout.boardSize / 2,
      streak: match.state.streak
    });
    persist();
    roundNoticeUntil = performance.now() + roundNotice.dismissMs;
    ui.setRoundNotice(roundNotice.text);
    const advance = planRoundAdvance({
      interstitialAllowed: interstitialAllowed('between_rounds')
    });
    if (advance === 'ad_then_next') {
      const result = ads.showInterstitial({ breakType: 'between_rounds' });
      if (result.shown) {
        tracker.track('ad_break_shown', { break: 'between_rounds' });
        show({ screen: 'ad_break', after: 'next_round' });
        return;
      }
    }
    startNextRound();
  }

  function finishGame() {
    pacer.recordRoundEnded();
    if (!lossNoted) {
      mercy = easyRun ? { lossesInRow: 1, queued: 0 } : noteLoss(mercy, retention.difficulty.mercy.afterLossesInRow);
      easyRun = false;
      lossNoted = true;
    }
    tracker.track('game_over', { score: match.state.score });
    tracker.track('run_end', {
      score: match.state.score,
      best: Math.max(progress.bestScore || 0, match.state.score),
      is_new_best: match.state.score > (progress.bestScore || 0),
      moves,
      cause: 'stuck'
    });
    audio.play('sfx.game_over');
    const rewardedAllowed = ads.canOfferRewarded('continue');
    const continueOffered = canOfferContinue(continueUses, rewardedAllowed, continueClosed);
    const plan = planBreak({
      type: 'game_over',
      interstitialAllowed: continueOffered ? false : interstitialAllowed('game_over'),
      rewardedAllowed,
      continueUsed: !continueOffered
    });
    persist();
    if (plan === 'ad_then_results') {
      const result = ads.showInterstitial({ breakType: 'game_over' });
      if (result.shown) {
        tracker.track('ad_break_shown', { break: 'game_over' });
        show({ screen: 'ad_break', after: 'game_over' });
        return;
      }
    }
    show({
      screen: 'game_over',
      rewarded: plan === 'results_with_rewarded',
      doubleScore: doubleReady()
    });
  }

  function startNextRound() {
    const kept = match.state;
    levelIndex = Math.min(levelIndex + 1, tuning.levelOrder.length - 1);
    const nextGrid = roundGrid();
    const goal = roundGoal();
    if (nextGrid !== kept.grid) {
      match = makeMatch({
        board: createBoard(nextGrid),
        pieces: [null, null, null],
        score: kept.score,
        streak: kept.streak,
        bestStreak: kept.bestStreak,
        totalClears: kept.totalClears,
        roundClears: 0,
        phase: 'playing',
        targetClears: goal
      });
    } else {
      match.nextRound(goal);
    }
    overlay = null;
    if (!pointer.drag) pointer = createPointerState();
    tracker.track('round_start', { round: level().id });
    tap();
    persist();
    if (match.state.phase === 'game_over') finishGame();
  }

  function resetRunCounters() {
    continueUses = 0;
    continueClosed = false;
    hintsUsed = 0;
    rerollsUsed = 0;
    doublesUsed = 0;
    playMs = 0;
    sawStuck = false;
    assistDealsLeft = 0;
    moves = 0;
  }

  function hintReady() {
    if (screen() !== 'play' || consent?.isChild) return false;
    const rewarded = pacing.ads?.rewarded;
    if (!rewarded?.enabled || !rewarded.placements?.includes('hint')) return false;
    return canOfferHint({
      elapsedMs: playMs,
      stuck: sawStuck,
      hintsUsed,
      moves,
      minMoves: tuning.hintMinMoves ?? 15,
      rewardedAllowed: ads.canOfferRewarded('hint')
    });
  }

  function rerollReady() {
    if (screen() !== 'play' || consent?.isChild) return false;
    const rewarded = pacing.ads?.rewarded;
    if (!rewarded?.enabled || !rewarded.placements?.includes('reroll')) return false;
    return canOfferReroll({
      stuck: isStuck(match.state.board, match.state.pieces),
      rerollsUsed,
      rewardedAllowed: ads.canOfferRewarded('reroll')
    });
  }

  function restart() {
    levelIndex = 0;
    mode = 'arcade';
    welcomeOpen = false;
    coachStep = null;
    resetRunCounters();
    rewardKind = null;
    startEasyRun();
    match = makeMatch();
    moves = 0;
    overlay = null;
    pointer = createPointerState();
    armIgnore();
    tracker.track('restart', {});
    trackRunStart();
    tap();
    persist();
  }

  function grantReward() {
    const kind = rewardKind || 'continue';
    const result = ads.showRewarded({ placement: kind, optedIn: true });
    if (!result.rewarded) {
      rewardKind = null;
      overlay = null;
      armIgnore();
      return;
    }
    tracker.track('rewarded_completed', { kind });
    armIgnore();
    if (rewardKind === 'hint') {
      hintsUsed = 1;
      match.showHint();
      overlay = null;
      tap();
    } else if (rewardKind === 'reroll') {
      rerollsUsed = 1;
      const outcome = match.reroll();
      overlay = null;
      audio.play('sfx.clear');
      if (outcome.gameOver) finishGame();
    } else if (rewardKind === 'double_score') {
      doublesUsed = 1;
      match.doubleScore();
      audio.play('sfx.win');
      if (match.state.phase === 'round_complete') show({ screen: 'round_complete', doubleScore: false });
      else {
        show({
          screen: 'game_over',
          rewarded: ads.canOfferRewarded('continue') && canOfferContinue(continueUses, true, continueClosed),
          doubleScore: false
        });
      }
    } else {
      continueUses += 1;
      assistDealsLeft = difficultyConfig.assist?.continueAssistDeals || 0;
      const outcome = match.continueRun(rowsForContinue(tuning.continueClears));
      overlay = null;
      audio.play('sfx.clear');
      if (outcome.gameOver) finishGame();
    }
    rewardKind = null;
    persist();
  }

  function resumeRun() {
    tap();
    if (match.state.phase === 'game_over') {
      show({
        screen: 'game_over',
        rewarded: ads.canOfferRewarded('continue') && canOfferContinue(continueUses, true, continueClosed),
        doubleScore: doubleReady()
      });
      return;
    }
    if (match.state.phase === 'round_complete') {
      show({ screen: 'round_complete', doubleScore: doubleReady() });
      return;
    }
    overlay = null;
    armIgnore();
    publishOverlay(true);
  }

  function onAction(id) {
    if (id === 'mute') {
      audio.toggleMute();
      return;
    }
    if (id === 'install') {
      tracker.track('install_prompted', {});
      install.prompt().then((choice) => {
        tracker.track('install_choice', { outcome: choice.outcome || 'dismissed' });
      });
      return;
    }
    if (id.startsWith('birth_year:')) {
      const year = Number(id.slice('birth_year:'.length));
      try {
        consent = consentStore.save(consentFromBirthYear(year));
      } catch {
        return;
      }
      ui.clearAgeGate();
      tap();
      void tracker.sync();
      return;
    }
    if (id === 'age_under') {
      const year = new Date().getFullYear() - 8;
      consent = consentStore.save(consentFromBirthYear(year));
      consent = consentStore.save(applyAnalyticsChoice(consent, 'denied'));
      ui.clearAgeGate();
      tap();
      void tracker.sync();
      return;
    }
    if (id === 'age_13') {
      const year = new Date().getFullYear() - 20;
      consent = consentStore.save(consentFromBirthYear(year));
      ui.clearAgeGate();
      tap();
      void tracker.sync();
      return;
    }
    if (id === 'ask_restart') {
      tap();
      show({ screen: 'restart_confirm' });
      return;
    }
    if (id === 'cancel_restart') {
      tap();
      show({
        screen: 'game_over',
        rewarded: ads.canOfferRewarded('continue') && canOfferContinue(continueUses, true, continueClosed),
        doubleScore: doubleReady()
      });
      return;
    }
    if (id === 'analytics_yes' || id === 'analytics_no') {
      const choice = id === 'analytics_yes' ? 'granted' : 'denied';
      if (!consent || consent.isChild) {
        consent = consentStore.save(evaluateAgeGate({ band: '13plus' }));
      }
      consent = consentStore.save(applyAnalyticsChoice(consent, choice));
      tap();
      void tracker.sync();
      tracker.track('consent_updated', { granted: choice === 'granted' });
      return;
    }
    if (id === 'analytics_revoke') {
      if (!consent || consent.isChild || !consent.analyticsAllowed) return;
      consent = consentStore.save(applyAnalyticsChoice(consent, 'denied'));
      void tracker.sync();
      return;
    }
    if (id === 'start_play') {
      tap();
      openEntry();
      return;
    }
    if (id === 'resume') {
      welcomeOpen = false;
      resumeRun();
      return;
    }
    if (id === 'motion') {
      reducedMotion = !reducedMotion;
      feedback.setReducedMotion(reducedMotion);
      tap();
      persist();
      return;
    }
    if (id === 'haptics') {
      hapticsOn = !hapticsOn;
      tap();
      persist();
      return;
    }
    if (id === 'daily') {
      mode = 'daily';
      levelIndex = 0;
      resetRunCounters();
      rewardKind = null;
      onboardingIndex = null;
      startEasyRun();
      match = makeMatch();
      moves = 0;
      pointer = createPointerState();
      overlay = null;
      armIgnore();
      tap();
      tracker.track('daily_start', { seed: utcSeed() });
      trackRunStart();
      persist();
      return;
    }
    if (id === 'new_game') {
      levelIndex = 0;
      mode = 'arcade';
      resetRunCounters();
      rewardKind = null;
      onboardingIndex = null;
      progress = { ...progress, tutorialSeen: true };
      startEasyRun();
      match = makeMatch();
      moves = 0;
      pointer = createPointerState();
      tap();
      overlay = null;
      armIgnore();
      trackRunStart();
      persist();
      return;
    }
    if (id === 'close_ad') {
      const after = overlay?.after;
      tracker.track('ad_break_closed', { break: after === 'game_over' ? 'game_over' : 'between_rounds' });
      armIgnore();
      if (after === 'next_round') startNextRound();
      else {
        tap();
        show({ screen: 'game_over', rewarded: false, doubleScore: doubleReady() });
      }
      return;
    }
    if (id === 'next_round') {
      const advance = planRoundAdvance({
        interstitialAllowed: interstitialAllowed('between_rounds')
      });
      if (advance === 'ad_then_next') {
        const result = ads.showInterstitial({ breakType: 'between_rounds' });
        if (result.shown) {
          tracker.track('ad_break_shown', { break: 'between_rounds' });
          show({ screen: 'ad_break', after: 'next_round' });
        } else startNextRound();
      } else startNextRound();
      return;
    }
    if (id === 'restart') {
      restart();
      return;
    }
    if (id === 'offer_continue' || id === 'offer_hint' || id === 'offer_reroll' || id === 'offer_double') {
      const kind = id === 'offer_hint'
        ? 'hint'
        : id === 'offer_reroll'
          ? 'reroll'
          : id === 'offer_double'
            ? 'double_score'
            : 'continue';
      if (kind === 'hint' && !hintReady()) return;
      if (kind === 'reroll' && !rerollReady()) return;
      if (kind === 'continue' && !canOfferContinue(continueUses, ads.canOfferRewarded('continue'), continueClosed)) return;
      if (kind === 'double_score' && !canOfferDouble({ doublesUsed, rewardedAllowed: ads.canOfferRewarded('double_score') })) return;
      if (!ads.canOfferRewarded(kind)) return;
      rewardKind = kind;
      tracker.track('rewarded_offered', { kind });
      tap();
      show({ screen: 'rewarded_confirm', kind });
      return;
    }
    if (id === 'decline') {
      const kind = rewardKind || 'continue';
      tracker.track('rewarded_declined', { kind });
      tap();
      rewardKind = null;
      if (kind === 'continue') {
        continueClosed = true;
        show({ screen: 'game_over', rewarded: false, doubleScore: doubleReady() });
        persist();
        return;
      }
      if (match.state.phase === 'round_complete') {
        show({ screen: 'round_complete', doubleScore: doubleReady() });
        return;
      }
      if (match.state.phase === 'game_over') {
        show({
          screen: 'game_over',
          rewarded: false,
          doubleScore: doubleReady()
        });
        return;
      }
      overlay = null;
      armIgnore();
      return;
    }
    if (id === 'watch') {
      tracker.track('rewarded_accepted', { kind: rewardKind || 'continue' });
      tap();
      show({ screen: 'rewarded_play', kind: rewardKind });
      return;
    }
    if (id === 'grant_reward') {
      grantReward();
    }
  }

  ui.onAction(onAction);

  function publishOverlay(force) {
    const state = match.state;
    const name = screen();
    if (name === 'age_gate') {
      const current = new Date().getFullYear();
      const years = [];
      for (let year = current; year >= 1900; year -= 1) years.push(year);
      ui.setAgeGate({ years, copy: 'What year were you born?' });
      return;
    }
    ui.clearAgeGate();
    const view = viewModel({
      screen: name,
      rewarded: Boolean(overlay?.rewarded),
      doubleScore: Boolean(overlay?.doubleScore),
      kind: overlay?.kind || rewardKind,
      step: overlay?.step || 0,
      score: state.score,
      bestScore: Math.max(progress.bestScore || 0, state.score),
      streak: daily.streak || 0,
      bestStreak: state.bestStreak,
      roundName: level().name,
      levelName: level().name,
      clears: state.roundClears,
      clearsGoal: state.targetClears,
      continueRows: tuning.continueClears
    });
    const key = JSON.stringify(view);
    if (!force && key === overlayKey) return;
    overlayKey = key;
    ui.setOverlay(view);
    if (name === 'play') noteSession();
  }

  function chromePlayHeight() {
    const header = document.querySelector('header');
    const app = document.querySelector('#app');
    const headerH = header?.getBoundingClientRect().height || 0;
    const appStyle = app ? getComputedStyle(app) : null;
    const padY = appStyle
      ? (parseFloat(appStyle.paddingTop) || 0) + (parseFloat(appStyle.paddingBottom) || 0)
      : 0;
    const gap = appStyle ? (parseFloat(appStyle.rowGap || appStyle.gap) || 0) : 0;
    return Math.max(280, Math.floor(window.innerHeight - headerH - padY - gap));
  }

  function measure() {
    const playHeight = chromePlayHeight();
    layout = computeLayout({
      width: window.innerWidth,
      height: window.innerHeight,
      grid: tuning.grid,
      playHeight
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(layout.canvasWidth * dpr);
    canvas.height = Math.round(layout.canvasHeight * dpr);
    canvas.style.width = `${layout.canvasWidth}px`;
    canvas.style.height = `${layout.canvasHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return pointerScale(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      rect,
      layout
    );
  }

  function liftPx() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (coarse || pointerKind === 'touch') return retention.onboarding.dragOffsetPx;
    return 0;
  }

  function hitAt(point, piece) {
    const overBoard = point.x >= 0 && point.y >= 0 && point.x < layout.boardSize && point.y < layout.boardSize;
    const trayIndex = hitTray(point.x, point.y, layout);
    let snapX = 0;
    let snapY = 0;
    let ghostValid = false;
    if (piece && overBoard) {
      const snap = snapOrigin(point.x, point.y, layout.cell, piece.shape);
      snapX = snap.x;
      snapY = snap.y;
      ghostValid = canPlace(match.state.board, piece.shape, snapX, snapY);
    }
    return {
      trayIndex,
      trayFilled: trayIndex >= 0 && Boolean(match.state.pieces[trayIndex]),
      overBoard,
      snapX,
      snapY,
      ghostValid,
      ignore: screen() !== 'play' || roundNotice.blocking || shouldIgnoreInput(performance.now(), ignoreUntil)
    };
  }

  function commitPlace(index, x, y, point = null) {
    moves += 1;
    const result = match.place(index, x, y);
    if (!result.ok) moves -= 1;
    if (!result.ok) {
      if (point) {
        const piece = match.state.pieces[index];
        const slot = traySlots(layout)[index];
        const burst = feedback.invalid({
          index,
          fromX: point.x,
          fromY: point.y - liftPx(),
          toX: slot ? slot.x + slot.w / 2 : point.x,
          toY: slot ? slot.y + slot.h / 2 : point.y,
          piece
        });
        playSounds(burst.sounds);
      } else {
        audio.play('sfx.error');
      }
      return result;
    }
    audio.play('sfx.place');
    tracker.track('piece_placed', { cells: result.gained, x, y });
    if (result.lines > 0) {
      const burst = feedback.clear({
        rows: result.rows,
        cols: result.cols,
        cell: layout.cell,
        grid: tuning.grid,
        color: result.color,
        points: result.gained,
        streak: match.state.streak,
        popupX: (x + 0.5) * layout.cell,
        popupY: (y + 0.5) * layout.cell
      });
      playSounds(burst.sounds, burst.pitch);
      vibrateFor(result.lines);
      tracker.track('lines_cleared', { lines: result.lines, score: match.state.score });
      tracker.track('line_clear', {
        lines: result.lines,
        combo: result.combo || 0,
        run_streak: match.state.streak
      });
      if (result.combo >= 2) tracker.track('combo', { lines: result.combo });
    }
    if (coachStep !== null) {
      coachStep += 1;
      if (coachStep >= coachMarks(match.state.targetClears).length) {
        const elapsed = onboardingStarted ? Math.round(performance.now() - onboardingStarted) : 0;
        coachStep = null;
        progress = { ...progress, tutorialSeen: true };
        tracker.track('onboarding_complete', { ms: elapsed });
        trackRunStart();
      } else {
        tracker.track('onboarding_step', { step: coachStep + 1 });
      }
    }
    welcomeOpen = false;
    if (onboardingIndex !== null && result.lines > 0) {
      advanceOnboarding();
      return result;
    }
    persist();
    if (result.roundComplete) finishRound();
    else if (result.gameOver) finishGame();
    return result;
  }

  function onPointer(type, event) {
    pointerKind = event.pointerType || pointerKind;
    const point = pointFrom(event);
    const previewPiece = pointer.drag
      ? match.state.pieces[pointer.drag.index]
      : (pointer.selected != null ? match.state.pieces[pointer.selected] : null);
    const hit = hitAt(point, type === 'down' ? previewPiece : (pointer.drag ? match.state.pieces[pointer.drag.index] : previewPiece));
    const reduced = pointerReducer(pointer, {
      type,
      pointerId: event.pointerId,
      x: point.x,
      y: point.y
    }, hit);
    pointer = reduced.state;
    if (!reduced.effect || reduced.effect.type === 'select' || reduced.effect.type === 'cancel') {
      if (dropFeedback(reduced.effect, hit) === 'sfx.invalid' && Number.isInteger(reduced.effect.index)) {
        const piece = match.state.pieces[reduced.effect.index];
        const slot = traySlots(layout)[reduced.effect.index];
        const burst = feedback.invalid({
          index: reduced.effect.index,
          fromX: point.x,
          fromY: point.y - liftPx(),
          toX: slot ? slot.x + slot.w / 2 : point.x,
          toY: slot ? slot.y + slot.h / 2 : point.y,
          piece
        });
        playSounds(burst.sounds);
      }
      return;
    }
    if (reduced.effect.type === 'place') {
      commitPlace(reduced.effect.index, reduced.effect.x, reduced.effect.y, point);
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    audio.unlock();
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // The pointer is already gone, or the event was not a live contact.
    }
    onPointer('down', event);
  });
  canvas.addEventListener('pointermove', (event) => onPointer('move', event));
  canvas.addEventListener('pointerup', (event) => onPointer('up', event));
  canvas.addEventListener('pointercancel', (event) => onPointer('cancel', event));
  window.addEventListener('resize', measure);

  window.addEventListener('beforeinstallprompt', (event) => {
    install.capture(event);
  });
  window.addEventListener('appinstalled', () => install.markInstalled());

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => {});
  }

  function hintMode() {
    return hintReady() ? 'ready' : 'off';
  }

  function frame() {
    const now = performance.now();
    const elapsed = Math.max(0, Math.min(1000, now - lastTick));
    lastTick = now;
    if (screen() === 'play') playMs += elapsed;
    if (!sawStuck && screen() === 'play' && isStuck(match.state.board, match.state.pieces)) sawStuck = true;
    const state = match.state;
    if (roundNoticeUntil && now >= roundNoticeUntil) {
      roundNoticeUntil = 0;
      ui.setRoundNotice('');
    }
    const cue = screen() === 'play'
      ? dangerCue(placementCount(state.board, state.pieces), difficultyConfig.danger)
      : null;
    if (cue?.sound && !reducedMotion && cue.level !== lastDangerLevel) audio.play(cue.sound);
    lastDangerLevel = cue?.level || 0;
    const fx = feedback.sample(now);
    let ghost = null;
    let drag = null;
    const active = pointer.drag ? state.pieces[pointer.drag.index] : null;
    if (screen() === 'play' && pointer.drag?.moved && active) {
      const overBoard = pointer.drag.x >= 0
        && pointer.drag.y >= 0
        && pointer.drag.x < layout.boardSize
        && pointer.drag.y < layout.boardSize;
      if (overBoard) {
        const snap = snapOrigin(pointer.drag.x, pointer.drag.y, layout.cell, active.shape);
        ghost = {
          ...snap,
          shape: active.shape,
          color: active.color,
          valid: canPlace(state.board, active.shape, snap.x, snap.y)
        };
      }
      drag = {
        x: pointer.drag.x,
        y: pointer.drag.y,
        index: pointer.drag.index,
        piece: active,
        lift: liftPx()
      };
    }
    drawScene(ctx, {
      layout,
      board: state.board,
      pieces: state.pieces,
      registry,
      drag,
      ghost,
      hint: state.hint,
      selected: pointer.selected,
      juice: fx,
      danger: cue ? { level: cue.level, reduced: reducedMotion, time: now } : null
    });
    const steps = feedback.config.streakSteps;
    const meterMax = steps[steps.length - 1] || 6;
    ui.setHud({
      score: state.score,
      nextGoal: nextScoreGoal(state.score, tuning.score.goals),
      lowSpace: dangerCue(placementCount(state.board, state.pieces), difficultyConfig.danger)?.label || '',
      best: Math.max(progress.bestScore || 0, state.score),
      streak: state.streak,
      combo: state.combo,
      round: level().name,
      clears: state.roundClears,
      target: state.targetClears,
      goal: coachStep !== null
        ? coachMarks(state.targetClears)[Math.min(coachStep, coachMarks(state.targetClears).length - 1)].text
        : mode === 'daily'
          ? `Daily streak ${daily.streak || 0} · freezes ${daily.freezes || 0}${dailyNote ? ` · ${dailyNote}` : ''}`
          : `Clear ${state.targetClears} lines · Next ${nextScoreGoal(state.score, tuning.score.goals)}`,
      meter: Math.max(0, Math.min(1, state.streak / meterMax)),
      meterMax,
      celebrate: celebrationLevel(state.streak, steps),
      hintNote: state.hint?.label || '',
      hint: hintMode(),
      reroll: rerollReady() ? 'ready' : 'off',
      dailyLabel: mode === 'daily' ? `Daily ${daily.streak || 0}` : 'Daily',
      dailyOn: mode === 'daily',
      reducedMotion,
      haptics: hapticsOn,
      install: install.available,
      stats: screen() === 'play' && Boolean(consent && !consent.isChild && consent.analyticsAllowed),
      muted: audio.muted
    });
    paintBanner();
    publishOverlay(false);
    const headerH = document.querySelector('header')?.offsetHeight || 0;
    if (headerH !== lastHeaderH) {
      lastHeaderH = headerH;
      measure();
    }
    requestAnimationFrame(frame);
  }

  let lastHeaderH = 0;

  function paintBanner() {
    const state = match.state;
    const prompt = agePrompt(consent);
    if (prompt) ui.setBanner(prompt);
    else if (welcomeOpen) {
      ui.setBanner({
        body: welcomeCopy({
          levelName: level().name,
          clears: state.roundClears,
          clearsGoal: state.targetClears,
          bestScore: Math.max(progress.bestScore || 0, state.score),
          streak: daily.streak || 0
        }),
        actions: [
          { id: 'new_game', label: 'New game', primary: false },
          { id: 'resume', label: 'Continue level', primary: true }
        ]
      });
    } else ui.setBanner(null);
  }

  attachSimBridge({
    getMatch: () => match.state,
    getView: () => viewModel({
      screen: screen(),
      rewarded: Boolean(overlay?.rewarded),
      kind: overlay?.kind || rewardKind,
      score: match.state.score,
      bestStreak: match.state.bestStreak,
      roundName: level().name
    }),
    getRewardKind: () => overlay?.kind || rewardKind || null,
    getBreak: () => overlay?.after || null,
    getRound: () => level().name,
    canHint: () => hintReady(),
    performUi: (id) => onAction(id),
    performMove: (index, x, y) => commitPlace(index, x, y)
  });

  openEntry();
  paintBanner();
  measure();
  lastHeaderH = document.querySelector('header')?.offsetHeight || 0;
  if (typeof ResizeObserver === 'function') {
    const header = document.querySelector('header');
    if (header) {
      new ResizeObserver(() => {
        const next = header.offsetHeight;
        if (next === lastHeaderH) return;
        lastHeaderH = next;
        measure();
      }).observe(header);
    }
  }
  requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  const node = document.querySelector('#boot-error');
  if (node) {
    node.hidden = false;
    node.textContent = 'Gridrift could not start.';
  }
  console.error(error);
}
