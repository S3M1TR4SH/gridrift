import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFeedback } from '../studio-core/index.js';
import tuning from '../config/tuning.json' with { type: 'json' };
import { dangerCue, dropFeedback, roundClearedNotice, trayPieceAlpha } from '../src/danger.js';
import { createPointerState, pointerReducer } from '../src/input.js';
import { createBoard, createMatch, fitsAnywhere } from '../src/logic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const score = {
  place: 1,
  line: 10,
  comboBonusPerExtraLine: 0,
  streakMultiplierStep: 0,
  maxStreakMultiplier: 1
};

test('unplaceable tray pieces grey out and low space uses the danger cue', () => {
  assert.equal(trayPieceAlpha(true), 1);
  assert.equal(trayPieceAlpha(false), 0.32);
  const open = createBoard(4);
  assert.equal(trayPieceAlpha(fitsAnywhere(open, [[1]])), 1);
  const full = createBoard(4);
  for (const row of full) row.fill('#fff');
  assert.equal(trayPieceAlpha(fitsAnywhere(full, [[1]])), 0.32);
  assert.equal(dangerCue(9), null);
  assert.equal(dangerCue(0), null);
  const low = dangerCue(6);
  assert.equal(low.label, 'Low space');
  assert.equal(low.level, 1);
  assert.equal(low.sound, null);
  const critical = dangerCue(2);
  assert.equal(critical.label, 'Low space');
  assert.equal(critical.level, 2);
  assert.equal(critical.sound, 'sfx.danger');
  const render = readFileSync(join(root, 'src/render.js'), 'utf8');
  assert.match(render, /trayPieceAlpha\(fitsAnywhere\(board, piece\.shape\)\)/);
  const hud = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.match(hud, /lowSpace: dangerCue\(/);
});

test('a drop onto filled cells shakes and plays sfx.invalid', () => {
  const effect = { type: 'cancel', moved: true, index: 0 };
  assert.equal(dropFeedback(effect, { overBoard: true, ghostValid: false }), 'sfx.invalid');
  assert.equal(dropFeedback(effect, { overBoard: true, ghostValid: true }), null);
  assert.equal(dropFeedback(effect, { overBoard: false, ghostValid: false }), null);
  assert.equal(dropFeedback({ type: 'cancel', moved: false }, { overBoard: true, ghostValid: false }), null);
  const feedback = createFeedback({ config: tuning.juice, now: () => 0, reducedMotion: false });
  const burst = feedback.invalid({ fromX: 10, fromY: 10, toX: 4, toY: 80, piece: { shape: [[1]] } });
  assert.deepEqual(burst.sounds, ['sfx.invalid']);
  const shaken = feedback.sample(10);
  assert.ok(Math.abs(shaken.shakeX) + Math.abs(shaken.shakeY) > 0);
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.match(main, /dropFeedback\(reduced\.effect, hit\) === 'sfx\.invalid'/);
});

test('a drag during the round-cleared popup still places', () => {
  const notice = roundClearedNotice();
  assert.equal(notice.text, 'Round cleared');
  assert.equal(notice.blocking, false);
  assert.equal(notice.pointerEvents, 'none');
  assert.ok(notice.dismissMs > 0 && notice.dismissMs < 4000);
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /\.round-notice\s*\{[^}]*pointer-events:\s*none/);
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /id="round-notice"[^>]*class="round-notice"/);

  const ignore = notice.blocking || notice.pointerEvents !== 'none';
  assert.equal(ignore, false);
  const match = createMatch({
    grid: 4,
    traySize: 1,
    score,
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['dot'],
    palette: [{ id: 'tile.blue', color: '#3d8bfd' }],
    saved: {
      board: createBoard(4),
      pieces: [{ shapeName: 'dot', color: '#3d8bfd', tileId: 'tile.blue' }],
      phase: 'playing',
      targetClears: 99
    }
  });
  let state = createPointerState();
  state = pointerReducer(state, { type: 'down', pointerId: 7, x: 8, y: 180 }, {
    trayIndex: 0, trayFilled: true, overBoard: false, ghostValid: false, ignore
  }).state;
  state = pointerReducer(state, { type: 'move', pointerId: 7, x: 40, y: 40 }, {
    trayIndex: -1, overBoard: true, ghostValid: true, snapX: 1, snapY: 1, ignore
  }).state;
  const up = pointerReducer(state, { type: 'up', pointerId: 7, x: 40, y: 40 }, {
    trayIndex: -1, overBoard: true, ghostValid: true, snapX: 1, snapY: 1, ignore
  });
  assert.equal(up.effect.type, 'place');
  const placed = match.place(up.effect.index, up.effect.x, up.effect.y);
  assert.equal(placed.ok, true);
  assert.notEqual(match.state.board[1][1], 0);

  const swallowed = pointerReducer(state, { type: 'up', pointerId: 7, x: 40, y: 40 }, {
    trayIndex: -1, overBoard: true, ghostValid: true, snapX: 1, snapY: 1, ignore: true
  });
  assert.notEqual(swallowed.effect?.type, 'place');
});
