import assetManifest from '../assets.manifest.json' with { type: 'json' };
import brand from '../branding/brand.json' with { type: 'json' };
import analyticsConfig from '../config/analytics.json' with { type: 'json' };
import pacingConfig from '../config/pacing.json' with { type: 'json' };
import tuningConfig from '../config/tuning.json' with { type: 'json' };
import { createMixpanelAdapter } from '../studio-core/analytics/adapters/mixpanel.js';
import { createTracker } from '../studio-core/analytics/tracker.js';
import {
  applyAnalyticsChoice,
  createConsentStore,
  evaluateAgeGate,
  memoryStorage
} from '../studio-core/consent/age-gate.js';
import { validateGameConfig, validateTuning } from '../studio-core/guardrails/validate.js';
import { createPacer, neutralizePacing } from '../studio-core/pacing/pacer.js';
import { createInstallController } from '../studio-core/pwa/install.js';
import { loadAssets } from './assets.js';
import { createAudio } from './audio.js';
import {
  INPUT_GUARD_MS,
  canOfferContinue,
  planBreak,
  planRoundAdvance,
  rowsForContinue,
  shouldIgnoreInput,
  viewModel
} from './flow.js';
import { createPointerState, pointerReducer } from './input.js';
import { CONTROL_GAP_PX, computeLayout, hitTray, pointerScale, snapOrigin } from './layout.js';
import { LEVELS } from './levels.js';
import { canPlace, createMatch } from './logic.js';
import { drawScene } from './render.js';
import { mulberry32 } from './rng.js';
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

  const consentStore = createConsentStore(bootStorage());
  let consent = consentStore.load();
  const tracker = createTracker({
    getConsent: () => consent,
    adapter: createMixpanelAdapter({ token: analyticsConfig.token })
  });
  void tracker.sync();
  const pacer = createPacer({ pacing, isChild: () => Boolean(consent?.isChild) });
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
  let levelIndex = 0;
  let continueUses = 0;
  let pointer = createPointerState();
  let ignoreUntil = 0;
  let overlay = null;
  let rewardKind = null;
  let sessionNoted = false;
  let overlayKey = '';

  function level() {
    const id = tuning.levelOrder[Math.min(levelIndex, tuning.levelOrder.length - 1)];
    return LEVELS[id] ?? LEVELS['round-01'];
  }

  function makeMatch() {
    return createMatch({
      grid: tuning.grid,
      traySize: tuning.traySize,
      score: tuning.score,
      rng: mulberry32((Date.now() ^ (levelIndex + 1) * 997) >>> 0),
      targetClears: level().targetClears,
      poolFor: (clears) => pacer.shapePool(clears),
      palette
    });
  }

  let match = makeMatch();

  function screen() {
    if (!consent) return 'age_gate';
    if (consent.needsAnalyticsPrompt) return 'analytics_consent';
    if (overlay?.screen) return overlay.screen;
    return 'play';
  }

  function noteSession() {
    if (sessionNoted || screen() !== 'play') return;
    sessionNoted = true;
    tracker.track('session_start', { game: 'gridrift' });
    tracker.track('round_start', { round: level().id });
  }

  function armIgnore() {
    ignoreUntil = performance.now() + INPUT_GUARD_MS;
  }

  function show(next) {
    overlay = next;
    publishOverlay(true);
  }

  function finishRound() {
    pacer.recordRoundEnded();
    tracker.track('round_complete', { score: match.state.score, round: level().id });
    audio.play('sfx.win');
    show({ screen: 'round_complete' });
  }

  function finishGame() {
    pacer.recordRoundEnded();
    tracker.track('game_over', { score: match.state.score });
    audio.play('sfx.game_over');
    const rewardedAllowed = pacer.canOfferRewarded('continue');
    const plan = planBreak({
      type: 'game_over',
      interstitialAllowed: pacer.canShowInterstitial('game_over'),
      rewardedAllowed,
      continueUsed: !canOfferContinue(continueUses, true)
    });
    if (plan === 'ad_then_results') {
      pacer.recordAd('interstitial');
      tracker.track('ad_break_shown', { break: 'game_over' });
      show({ screen: 'ad_break', after: 'game_over' });
      return;
    }
    show({ screen: 'game_over', rewarded: plan === 'results_with_rewarded' });
  }

  function startNextRound() {
    levelIndex = Math.min(levelIndex + 1, tuning.levelOrder.length - 1);
    match.nextRound(level().targetClears);
    overlay = null;
    armIgnore();
    tracker.track('round_start', { round: level().id });
    audio.play('sfx.click');
    if (match.state.phase === 'game_over') finishGame();
  }

  function restart() {
    levelIndex = 0;
    continueUses = 0;
    rewardKind = null;
    match = makeMatch();
    overlay = null;
    pointer = createPointerState();
    armIgnore();
    tracker.track('restart', {});
    audio.play('sfx.click');
  }

  function grantReward() {
    pacer.recordAd('rewarded');
    tracker.track('rewarded_completed', { kind: rewardKind || 'continue' });
    armIgnore();
    if (rewardKind === 'hint') {
      match.showHint();
      overlay = null;
      audio.play('sfx.click');
    } else {
      continueUses += 1;
      const outcome = match.continueRun(rowsForContinue(tuning.continueClears));
      overlay = null;
      audio.play('sfx.line_clear');
      if (outcome.gameOver) finishGame();
    }
    rewardKind = null;
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
    if (id === 'age_under') {
      consent = consentStore.save(evaluateAgeGate({ band: 'under13' }));
      void tracker.sync();
      show({ screen: 'kid_mode' });
      return;
    }
    if (id === 'age_13') {
      consent = consentStore.save(evaluateAgeGate({ band: '13plus' }));
      overlay = null;
      publishOverlay(true);
      return;
    }
    if (id === 'analytics_yes' || id === 'analytics_no') {
      const choice = id === 'analytics_yes' ? 'granted' : 'denied';
      consent = consentStore.save(applyAnalyticsChoice(consent, choice));
      overlay = null;
      void tracker.sync();
      tracker.track('consent_updated', { granted: choice === 'granted' });
      publishOverlay(true);
      return;
    }
    if (id === 'analytics_revoke') {
      if (!consent || consent.isChild || !consent.analyticsAllowed) return;
      consent = consentStore.save(applyAnalyticsChoice(consent, 'denied'));
      void tracker.sync();
      return;
    }
    if (id === 'start_play') {
      overlay = null;
      publishOverlay(true);
      return;
    }
    if (id === 'close_ad') {
      const after = overlay?.after;
      tracker.track('ad_break_closed', { break: after === 'game_over' ? 'game_over' : 'between_rounds' });
      armIgnore();
      if (after === 'next_round') startNextRound();
      else show({ screen: 'game_over', rewarded: false });
      return;
    }
    if (id === 'next_round') {
      const advance = planRoundAdvance({
        interstitialAllowed: pacer.canShowInterstitial('between_rounds')
      });
      if (advance === 'ad_then_next') {
        pacer.recordAd('interstitial');
        tracker.track('ad_break_shown', { break: 'between_rounds' });
        show({ screen: 'ad_break', after: 'next_round' });
      } else startNextRound();
      return;
    }
    if (id === 'restart') {
      restart();
      return;
    }
    if (id === 'offer_continue' || id === 'offer_hint') {
      const kind = id === 'offer_hint' ? 'hint' : 'continue';
      if (!pacer.canOfferRewarded(kind)) return;
      rewardKind = kind;
      tracker.track('rewarded_offered', { kind });
      show({ screen: 'rewarded_confirm', kind });
      return;
    }
    if (id === 'decline') {
      tracker.track('rewarded_declined', { kind: rewardKind || 'continue' });
      const backToResults = match.state.phase === 'game_over';
      rewardKind = null;
      if (backToResults) {
        show({
          screen: 'game_over',
          rewarded: pacer.canOfferRewarded('continue') && canOfferContinue(continueUses, true)
        });
      } else {
        overlay = null;
        armIgnore();
      }
      return;
    }
    if (id === 'watch') {
      tracker.track('rewarded_accepted', { kind: rewardKind || 'continue' });
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
    const view = viewModel({
      screen: name,
      rewarded: Boolean(overlay?.rewarded),
      kind: overlay?.kind || rewardKind,
      score: state.score,
      bestStreak: state.bestStreak,
      roundName: level().name
    });
    const key = JSON.stringify(view);
    if (!force && key === overlayKey) return;
    overlayKey = key;
    ui.setOverlay(view);
    if (name === 'play') noteSession();
  }

  function measure() {
    layout = computeLayout({
      width: window.innerWidth,
      height: window.innerHeight,
      grid: tuning.grid
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

  function hitAt(point, piece) {
    const overBoard = point.x >= 0 && point.y >= 0 && point.x < layout.boardSize && point.y < layout.boardSize;
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
      trayIndex: hitTray(point.x, point.y, layout),
      overBoard,
      snapX,
      snapY,
      ghostValid,
      ignore: screen() !== 'play' || shouldIgnoreInput(performance.now(), ignoreUntil)
    };
  }

  function onPointer(type, event) {
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
      if (reduced.effect?.type === 'cancel') audio.play('sfx.error');
      return;
    }
    if (reduced.effect.type === 'place') {
      const result = match.place(reduced.effect.index, reduced.effect.x, reduced.effect.y);
      if (!result.ok) {
        audio.play('sfx.error');
        return;
      }
      audio.play('sfx.place');
      tracker.track('piece_placed', { cells: result.gained, x: reduced.effect.x, y: reduced.effect.y });
      if (result.lines > 0) {
        audio.play(result.combo >= 2 ? 'sfx.combo' : 'sfx.line_clear');
        tracker.track('lines_cleared', { lines: result.lines, score: match.state.score });
        if (result.combo >= 2) tracker.track('combo', { lines: result.combo });
      }
      if (result.roundComplete) finishRound();
      else if (result.gameOver) finishGame();
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

  function frame() {
    const state = match.state;
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
      } else {
        drag = { x: pointer.drag.x, y: pointer.drag.y, index: pointer.drag.index, piece: active };
      }
    }
    drawScene(ctx, {
      layout,
      board: state.board,
      pieces: state.pieces,
      registry,
      drag,
      ghost,
      hint: state.hint,
      selected: pointer.selected
    });
    ui.setHud({
      score: state.score,
      streak: state.streak,
      combo: state.combo,
      round: level().name,
      clears: state.roundClears,
      target: state.targetClears,
      hint: screen() === 'play' && !consent?.isChild && pacer.canOfferRewarded('hint'),
      install: install.available && screen() === 'play',
      stats: screen() === 'play' && Boolean(consent && !consent.isChild && consent.analyticsAllowed),
      muted: audio.muted
    });
    publishOverlay(false);
    requestAnimationFrame(frame);
  }

  measure();
  publishOverlay(true);
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
