import assert from 'node:assert/strict';
import { test } from 'node:test';
import pacing from '../config/pacing.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { createFeedback } from '../studio-core/index.js';
import { PERSONAS, chooseAction } from '../studio-core/sim/index.js';
import { agePrompt, bootScreen, continueRewardLabel } from '../src/flow.js';
import { computeLayout, traySlots } from '../src/layout.js';
import { createMatch, fitsAnywhere, SHAPES } from '../src/logic.js';
import { coachMarks, openingBoard, wordCount } from '../src/onboarding.js';
import { mulberry32 } from '../src/rng.js';
import { listMoves } from '../src/sim-bridge.js';

test('launch can accept a move immediately and age stays one light prompt', () => {
  assert.equal(bootScreen(), 'play');
  const prompt = agePrompt(null);
  assert.equal(prompt.blocking, false);
  assert.ok(prompt.actions.some((action) => action.id === 'age_under'));
  assert.ok(prompt.actions.some((action) => action.id === 'age_13'));
  assert.equal(agePrompt({ isChild: true }), null);
  assert.ok(continueRewardLabel(tuning.continueClears).includes('clear 3 rows'));
});

test('the opening board is partly filled and a casual player clears inside 15s', () => {
  const persona = PERSONAS.casual;
  for (const seed of [1, 2, 3, 4]) {
    const opening = openingBoard(tuning.grid);
    assert.ok(opening.pieces.every((piece) => fitsAnywhere(opening.board, SHAPES[piece.shapeName])));
    const match = createMatch({
      grid: tuning.grid,
      traySize: tuning.traySize,
      score: tuning.score,
      rng: mulberry32(seed),
      targetClears: 99,
      poolFor: () => pacing.difficulty.pools[0].shapes,
      palette: [{ id: 'tile.blue', color: '#3d8bfd' }],
      saved: {
        board: opening.board,
        pieces: opening.pieces,
        phase: 'playing',
        targetClears: 99
      }
    });
    const rng = mulberry32(seed + 50);
    let ms = 0;
    let steps = 0;
    while (match.state.totalClears === 0 && steps < 20) {
      const moves = listMoves(match.state.board, match.state.pieces);
      assert.ok(moves.length > 0, `seed ${seed} has a legal move`);
      const decision = chooseAction({
        persona,
        state: { actions: moves, screen: 'play' },
        rng,
        gameOver: false
      });
      ms += persona.thinkMs;
      assert.equal(decision.type, 'action');
      const action = decision.action;
      match.place(action.pieceIndex, action.x, action.y);
      steps += 1;
    }
    assert.ok(match.state.totalClears > 0, `seed ${seed} cleared`);
    assert.ok(ms < 15_000, `seed ${seed} cleared in ${ms}ms`);
    assert.ok(ms <= persona.thinkMs * 2, `seed ${seed} cleared on an early move`);
  }
  for (const tip of coachMarks(4)) assert.ok(wordCount(tip.text) <= 8);
});

test('portrait layout fills the width and tray slots stay fixed', () => {
  const phone = computeLayout({ width: 390, height: 844, grid: 6 });
  assert.equal(phone.anchor, 'upper');
  assert.ok(phone.cell >= 40);
  assert.equal(phone.canvasWidth, phone.cell * 6);
  assert.ok(phone.canvasWidth >= 360);
  assert.ok(phone.canvasWidth <= 390);
  const slots = traySlots(phone);
  assert.deepEqual(slots.map((slot) => slot.x), [0, slots[0].w, slots[0].w * 2]);
  assert.equal(slots[0].y, slots[2].y);
  const filled = computeLayout({ width: 390, height: 844, grid: 6, playHeight: 640 });
  assert.equal(filled.canvasHeight, 640);
  assert.ok(filled.cell >= 40);
  assert.ok(filled.canvasWidth <= 390);
  const filledSlots = traySlots(filled);
  assert.equal(filledSlots[0].y + filledSlots[0].h, filled.canvasHeight);
  assert.ok(filledSlots[0].y > filled.boardSize);
});

test('an invalid drop shakes and names sfx.invalid, and a streak of 2 pops up', () => {
  const feedback = createFeedback({
    config: tuning.juice,
    now: () => 0,
    reducedMotion: false
  });
  const invalid = feedback.invalid({ fromX: 1, fromY: 1, toX: 2, toY: 2, piece: { shape: [[1]] } });
  assert.deepEqual(invalid.sounds, ['sfx.invalid']);
  const shaken = feedback.sample(10);
  assert.ok(Math.abs(shaken.shakeX) + Math.abs(shaken.shakeY) > 0);
  const quiet = createFeedback({ config: tuning.juice, now: () => 0, reducedMotion: true });
  quiet.clear({ rows: [0], cols: [], cell: 10, grid: 6, points: 10, streak: 2, popupX: 4, popupY: 4 });
  const reduced = quiet.sample(10);
  assert.equal(reduced.particles.length, 0);
  assert.ok(reduced.popups.some((popup) => popup.text === 'Streak x2'));
  for (const key of ['flashMs', 'particleLifeMs', 'popupMs', 'shakeMs', 'invalidShakeMs']) {
    assert.ok(tuning.juice[key] < 400, key);
  }
  assert.equal(pacing.difficulty.failBias, 0);
  assert.equal(pacing.difficulty.forceUnplaceable, false);
  assert.equal(pacing.difficulty.allowStuckState, false);
  assert.equal(pacing.ads.interstitial.enabled, false);
  assert.equal(pacing.ads.rewarded.enabled, false);
});
