import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from '../studio-core/guardrails/limits.js';
import {
  INPUT_GUARD_MS,
  canOfferContinue,
  planBreak,
  planRoundAdvance,
  rowsForContinue,
  shouldIgnoreInput,
  viewModel
} from '../src/flow.js';
import { createPointerState, pointerReducer } from '../src/input.js';
import { CONTROL_GAP_PX, computeLayout, hitTray, snapOrigin } from '../src/layout.js';

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
  assert.equal(shouldIgnoreInput(100, 100 + INPUT_GUARD_MS), true);
  assert.equal(shouldIgnoreInput(500, 100), false);
  assert.throws(() => planBreak({ type: 'on_fail' }));
});

test('drag snaps to the grid and a tap selects', () => {
  assert.deepEqual(snapOrigin(15, 15, 30, [[1]]), { x: 0, y: 0 });
  assert.deepEqual(snapOrigin(45, 45, 30, [[1]]), { x: 1, y: 1 });
  const layout = computeLayout({ width: 390, height: 844, grid: 10 });
  assert.equal(layout.boardSize, layout.cell * 10);
  assert.ok(layout.canvasWidth <= 390);
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
});
