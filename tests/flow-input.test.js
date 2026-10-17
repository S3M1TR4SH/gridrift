import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from '../studio-core/index.js';
import {
  HINT_MIN_MOVES,
  HINT_MIN_PLAY_MS,
  INPUT_GUARD_MS,
  canOfferContinue,
  canOfferDouble,
  canOfferHint,
  canOfferReroll,
  planBreak,
  planRoundAdvance,
  rowsForContinue,
  settleGameOver,
  shouldIgnoreInput,
  viewModel
} from '../src/flow.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPointerState, pointerReducer } from '../src/input.js';
import { CONTROL_GAP_PX, computeLayout, dragPieceOrigin, hitTray, pointerToBoard, snapOrigin } from '../src/layout.js';

test('ad screens keep their actions off the previous button slot', () => {
  const round = viewModel({ screen: 'round_complete', roundName: 'Shallow drift', score: 12, bestStreak: 2 });
  const ad = viewModel({ screen: 'ad_break' });
  assert.deepEqual(ad.actions.map((action) => action.id), ['close_ad']);
  assert.equal(round.actions[0].id, 'next_round');
  assert.notEqual(round.actions[0].slot, ad.actions[0].slot);

  const over = viewModel({ screen: 'game_over', rewarded: true, score: 40, bestStreak: 3 });
  const offer = over.actions.find((action) => action.id === 'offer_continue');
  const confirm = viewModel({ screen: 'rewarded_confirm', kind: 'continue' });
  const decline = confirm.actions.find((action) => action.id === 'decline');
  const watch = confirm.actions.find((action) => action.id === 'watch');
  assert.equal(decline.slot, offer.slot);
  assert.notEqual(watch.slot, offer.slot);
  assert.equal(over.actions.some((action) => action.id === 'restart'), true);
  assert.equal(over.actions.some((action) => action.id === 'close_ad'), false);
  assert.ok(CONTROL_GAP_PX >= LIMITS.ads.minControlSeparationPx);
});

test('breaks stay on round boundaries and continue is capped', () => {
  assert.equal(planBreak({ type: 'between_rounds', interstitialAllowed: true, rewardedAllowed: true, continueUsed: false }), 'round_card');
  assert.equal(planRoundAdvance({ interstitialAllowed: true }), 'ad_then_next');
  assert.equal(planRoundAdvance({ interstitialAllowed: false }), 'next');
  assert.equal(planBreak({
    type: 'game_over',
    interstitialAllowed: true,
    rewardedAllowed: true,
    continueUsed: false
  }), 'results_with_rewarded');
  assert.equal(planBreak({
    type: 'game_over',
    interstitialAllowed: true,
    rewardedAllowed: false,
    continueUsed: true
  }), 'ad_then_results');
  assert.equal(canOfferContinue(0, true), true);
  assert.equal(canOfferContinue(LIMITS.rewardedEffects.maxContinueUsesPerMatch, true), false);
  assert.equal(rowsForContinue(9), LIMITS.rewardedEffects.maxContinueRowsCleared);
  assert.equal(INPUT_GUARD_MS, 0);
  assert.equal(shouldIgnoreInput(100, 100), false);
  assert.equal(shouldIgnoreInput(99, 100), true);
  assert.equal(shouldIgnoreInput(500, 100), false);
  assert.throws(() => planBreak({ type: 'on_fail' }));
});

test('drag snaps to the grid and a tap selects', () => {
  assert.deepEqual(snapOrigin(15, 15, 30, [[1]]), { x: 0, y: 0 });
  assert.deepEqual(snapOrigin(45, 45, 30, [[1]]), { x: 1, y: 1 });
  const cell = 64;
  const pointer = { x: cell * 2 + 8, y: cell * 2 + 8 };
  const landed = snapOrigin(dragPieceOrigin(pointer, 0).x, dragPieceOrigin(pointer, 0).y, cell);
  assert.equal(landed.y, 2);
  const centered = snapOrigin(pointer.x, pointer.y - (3 * cell) / 2, cell);
  assert.notEqual(centered.y, landed.y);
  const wide = computeLayout({ width: 1400, height: 900, grid: 8 });
  const rect = { left: 12, top: 20, width: wide.canvasWidth / 2, height: wide.canvasHeight / 2 };
  const clientX = rect.left + ((3 + 0.5) * wide.cell) / 2;
  const clientY = rect.top + ((2 + 0.5) * wide.cell) / 2;
  const boardPoint = pointerToBoard(clientX, clientY, rect, wide);
  assert.equal(snapOrigin(boardPoint.x, boardPoint.y, wide.cell).x, 3);
  assert.equal(snapOrigin(boardPoint.x, boardPoint.y, wide.cell).y, 2);
  const unscaled = pointerToBoard(40, 80, { left: 0, top: 0, width: 200, height: 400 }, {
    canvasWidth: 200,
    canvasHeight: 400
  });
  assert.deepEqual(unscaled, { x: 40, y: 80 });
  assert.equal(settleGameOver({ gameOver: true, lines: 1, animating: true }), false);
  assert.equal(settleGameOver({ gameOver: true, lines: 1, animating: false }), true);
  assert.equal(settleGameOver({ gameOver: true, lines: 0, animating: true }), true);
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/styles.css'), 'utf8');
  assert.match(css, /#overlay\s*\{[^}]*position:\s*fixed/s);
  const layout = computeLayout({ width: 390, height: 844, grid: 10 });
  assert.equal(layout.boardSize, layout.cell * 10);
  assert.ok(layout.canvasWidth <= 390);
  assert.ok(layout.boardSize >= 360);
  assert.equal(hitTray(layout.cell, layout.boardSize + layout.gap + 4, layout), 0);

  let state = createPointerState();
  const down = pointerReducer(state, { type: 'down', pointerId: 1, x: 10, y: 10 }, {
    trayIndex: 1, overBoard: false, ghostValid: false, snapX: 0, snapY: 0, ignore: false
  });
  state = down.state;
  const move = pointerReducer(state, { type: 'move', pointerId: 1, x: 40, y: 10 }, {
    trayIndex: -1, overBoard: true, ghostValid: true, snapX: 2, snapY: 3, ignore: false
  });
  state = move.state;
  const up = pointerReducer(state, { type: 'up', pointerId: 1, x: 40, y: 10 }, {
    trayIndex: -1, overBoard: true, ghostValid: true, snapX: 2, snapY: 3, ignore: false
  });
  assert.equal(up.effect.type, 'place');
  assert.deepEqual({ x: up.effect.x, y: up.effect.y, index: up.effect.index }, { x: 2, y: 3, index: 1 });

  const tapped = pointerReducer(createPointerState(), { type: 'down', pointerId: 2, x: 4, y: 4 }, {
    trayIndex: 0, overBoard: false, ghostValid: false, snapX: 0, snapY: 0, ignore: false
  });
  const selected = pointerReducer(tapped.state, { type: 'up', pointerId: 2, x: 6, y: 5 }, {
    trayIndex: 0, overBoard: false, ghostValid: false, snapX: 0, snapY: 0, ignore: false
  });
  assert.equal(selected.effect.type, 'select');
  assert.equal(selected.state.selected, 0);

  const ignored = pointerReducer(tapped.state, { type: 'up', pointerId: 2, x: 6, y: 5 }, {
    trayIndex: 0, overBoard: true, ghostValid: true, snapX: 1, snapY: 1, ignore: true
  });
  assert.notEqual(ignored.effect?.type, 'place');
  assert.equal(ignored.effect.moved, false);
});

test('a second drag is accepted immediately', () => {
  let state = createPointerState();
  state = pointerReducer(state, { type: 'down', pointerId: 1, x: 10, y: 10 }, {
    trayIndex: 0, trayFilled: true, overBoard: false, ghostValid: false, ignore: false
  }).state;
  state = pointerReducer(state, { type: 'up', pointerId: 1, x: 12, y: 11 }, {
    trayIndex: 0, overBoard: false, ghostValid: false, ignore: false
  }).state;
  const second = pointerReducer(state, { type: 'down', pointerId: 2, x: 80, y: 10 }, {
    trayIndex: 1,
    trayFilled: true,
    overBoard: false,
    ghostValid: false,
    ignore: shouldIgnoreInput(200, 200 + INPUT_GUARD_MS)
  });
  assert.equal(second.state.drag.index, 1);
});

test('game over offers an opt-in continue once and always offers restart', () => {
  const over = viewModel({ screen: 'game_over', rewarded: true, score: 40, bestStreak: 3 });
  assert.deepEqual(over.actions.map((action) => action.id), ['offer_continue', 'restart']);
  const reward = over.actions.find((action) => action.id === 'offer_continue');
  assert.match(reward.label, /Watch ad: clear 3 rows/);
  assert.equal(reward.primary, false);
  assert.equal(over.actions.find((action) => action.id === 'restart').primary, true);
  assert.equal(over.separated, false);
  assert.match(over.body, /Back to Round 1, best kept/);
  const checkpoint = viewModel({
    screen: 'game_over',
    rewarded: false,
    score: 40,
    bestScore: 80,
    checkpoint: true,
    roundNumber: 3
  });
  assert.match(checkpoint.body, /Restart from Round 3 checkpoint/);
  assert.equal(checkpoint.actions.find((action) => action.id === 'retry_round').label, 'Retry round');
  assert.equal(checkpoint.actions.find((action) => action.id === 'retry_round').primary, true);
  const spent = viewModel({ screen: 'game_over', rewarded: false, score: 40, bestStreak: 3 });
  assert.deepEqual(spent.actions.map((action) => action.id), ['restart']);
  const restart = viewModel({ screen: 'restart_confirm', bestScore: 40 });
  assert.match(restart.body, /Back to Round 1/);
  assert.match(restart.body, /Best 40 kept/);
  assert.equal(restart.actions.find((action) => action.id === 'restart').label, 'Back to Round 1');
  assert.equal(canOfferContinue(0, true), true);
  assert.equal(canOfferContinue(1, true), false);
  assert.equal(canOfferContinue(0, false), false);
  const confirm = viewModel({ screen: 'rewarded_confirm', kind: 'continue', continueRows: 3 });
  assert.match(confirm.body, /Watch ad: clear 3 rows/);
  assert.match(confirm.actions.find((action) => action.id === 'watch').label, /clear 3 rows/);
  const playing = viewModel({ screen: 'rewarded_play', kind: 'continue', continueRows: 3 });
  assert.match(playing.body, /Watch ad: clear 3 rows/);
  assert.equal(confirm.actions.some((action) => action.id === 'decline'), true);
  assert.equal(confirm.actions.some((action) => action.id === 'watch'), true);
  assert.equal(canOfferContinue(0, true, true), false);
});

test('reroll and double score share the hint move floor and are once each', () => {
  const floor = { moves: HINT_MIN_MOVES, minMoves: HINT_MIN_MOVES };
  assert.equal(canOfferReroll({ stuck: false, rerollsUsed: 0, rewardedAllowed: true, ...floor }), false);
  assert.equal(canOfferReroll({ stuck: true, rerollsUsed: 0, rewardedAllowed: true, moves: 14, minMoves: 15 }), false);
  assert.equal(canOfferReroll({ stuck: true, rerollsUsed: 0, rewardedAllowed: true, ...floor }), true);
  assert.equal(canOfferReroll({ stuck: true, rerollsUsed: 1, rewardedAllowed: true, ...floor }), false);
  assert.equal(canOfferReroll({ stuck: true, rerollsUsed: 0, rewardedAllowed: false, ...floor }), false);
  assert.equal(canOfferDouble({ doublesUsed: 0, rewardedAllowed: true, moves: 14, minMoves: 15 }), false);
  assert.equal(canOfferDouble({ doublesUsed: 0, rewardedAllowed: true, ...floor }), true);
  assert.equal(canOfferDouble({ doublesUsed: 1, rewardedAllowed: true, ...floor }), false);
  assert.equal(canOfferDouble({ doublesUsed: 0, rewardedAllowed: false, ...floor }), false);
  const doubled = viewModel({
    screen: 'game_over',
    rewarded: true,
    doubleScore: true,
    score: 40,
    bestStreak: 3
  });
  assert.ok(doubled.actions.some((action) => action.id === 'offer_continue'));
  assert.ok(doubled.actions.some((action) => action.id === 'offer_double'));
  assert.ok(doubled.actions.some((action) => action.id === 'restart' || action.id === 'retry_round'));
  const confirm = viewModel({ screen: 'rewarded_confirm', kind: 'reroll' });
  assert.match(confirm.body, /new tray/i);
  assert.equal(confirm.actions.find((action) => action.id === 'decline').label, 'No thanks');
  const scoreConfirm = viewModel({ screen: 'rewarded_confirm', kind: 'double_score' });
  assert.match(scoreConfirm.body, /doubled score/i);
  const results = viewModel({ screen: 'round_complete', doubleScore: true, score: 12, bestStreak: 1 });
  assert.ok(results.actions.some((action) => action.id === 'offer_double'));
  assert.ok(results.actions.some((action) => action.id === 'next_round'));
});

test('a rewarded hint waits two minutes or a stuck board, and never before step 15', () => {
  assert.equal(HINT_MIN_MOVES, 15);
  assert.equal(HINT_MIN_PLAY_MS, 120_000);
  const open = { elapsedMs: 0, stuck: false, hintsUsed: 0, rewardedAllowed: true, moves: 15 };
  assert.equal(canOfferHint(open), false);
  assert.equal(canOfferHint({ ...open, moves: 14, stuck: true }), false);
  assert.equal(canOfferHint({ ...open, moves: 0, elapsedMs: HINT_MIN_PLAY_MS }), false);
  assert.equal(canOfferHint({ ...open, elapsedMs: HINT_MIN_PLAY_MS - 1 }), false);
  assert.equal(canOfferHint({ ...open, elapsedMs: HINT_MIN_PLAY_MS }), true);
  assert.equal(canOfferHint({ ...open, stuck: true }), true);
  assert.equal(canOfferHint({ ...open, stuck: true, hintsUsed: 1 }), false);
  assert.equal(canOfferHint({ ...open, elapsedMs: HINT_MIN_PLAY_MS, hintsUsed: 1 }), false);
  assert.equal(canOfferHint({ ...open, elapsedMs: HINT_MIN_PLAY_MS, rewardedAllowed: false }), false);
  assert.equal(canOfferHint({ ...open, stuck: true, rewardedAllowed: false }), false);
});

test('welcome back shows yesterday, the daily, and the streak', () => {
  const welcome = viewModel({
    screen: 'welcome_back',
    yesterdayBest: 15,
    streak: 4,
    roundNumber: 2,
    dailyStatus: 'unplayed'
  });
  assert.equal(welcome.title, 'Welcome back');
  assert.match(welcome.body, /Yesterday's best 15/);
  assert.match(welcome.body, /Daily unplayed/);
  assert.match(welcome.body, /Streak 4/);
  assert.doesNotMatch(welcome.body, /lose|miss|hurry|gone/i);
  assert.equal(welcome.actions.find((action) => action.id === 'daily').label, 'Play Daily');
  assert.equal(welcome.actions.find((action) => action.id === 'daily').primary, true);
  assert.equal(welcome.actions.find((action) => action.id === 'resume').label, 'Continue Round 2');
  const done = viewModel({
    screen: 'welcome_back',
    yesterdayBest: 15,
    streak: 4,
    roundNumber: 3,
    dailyStatus: 'done'
  });
  assert.match(done.body, /Daily done/);
  assert.equal(done.actions.find((action) => action.id === 'resume').primary, true);
  assert.equal(welcome.separated, false);
  assert.equal(viewModel({ screen: 'ad_break' }).separated, true);
  assert.equal(viewModel({ screen: 'rewarded_confirm', kind: 'hint' }).separated, true);
});
