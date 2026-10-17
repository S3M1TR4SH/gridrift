import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import tuning from '../config/tuning.json' with { type: 'json' };
import { createBoard } from '../src/logic.js';
import { detectGameOver, listMoves } from '../src/sim-bridge.js';
import { validateGameConfig } from '../studio-core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('move listing reports a completing line and leaves the board unchanged', () => {
  const board = createBoard(4);
  for (let x = 0; x < 3; x += 1) board[0][x] = '#fff';
  const before = board.map((row) => row.slice());
  const moves = listMoves(board, [{ shape: [[1]], shapeName: 'dot' }]);
  const clear = moves.find((move) => move.x === 3 && move.y === 0);
  assert.equal(clear.lines, 1);
  assert.equal(clear.cells, 1);
  assert.equal(clear.fill, 4);
  assert.equal(clear.contact, 3);
  assert.equal(clear.holes, 0);
  assert.equal(clear.rest1, 0);
  assert.equal(clear.rest2, 0);
  assert.equal(clear.type, 'move');
  assert.deepEqual(board, before);
});

test('move features mark a stranded tray piece and can skip the deeper search', () => {
  const board = createBoard(3);
  board[1][0] = '#fff';
  board[1][1] = '#fff';
  board[2][0] = '#fff';
  board[2][1] = '#fff';
  const pieces = [{ shape: [[1]] }, { shape: [[1, 1, 1]] }];
  const moves = listMoves(board, pieces);
  const blocking = moves.find((move) => move.pieceIndex === 0 && move.x === 2 && move.y === 0);
  assert.equal(blocking.rest1, -1);
  assert.equal(typeof blocking.rest2, 'number');
  const shallow = listMoves(board, pieces, { lookahead: 1 });
  assert.equal(shallow.find((move) => move.pieceIndex === 0 && move.x === 2 && move.y === 0).rest2, null);
  const open = createBoard(3);
  const room = listMoves(open, pieces).find((move) => move.pieceIndex === 0 && move.x === 0 && move.y === 0);
  assert.ok(room.rest1 >= 0);
});

test('game over is the match phase or the results screen, not an empty tray by itself', () => {
  assert.equal(detectGameOver('game_over', 'play'), true);
  assert.equal(detectGameOver('play', 'game_over'), true);
  assert.equal(detectGameOver('play', 'play'), false);
  assert.equal(detectGameOver('play', 'ad_break'), false);
});

test('quiet ad variant stays inside the guardrails', () => {
  const pacing = JSON.parse(readFileSync(join(root, 'sim/variants/quiet-ads.json'), 'utf8'));
  const result = validateGameConfig({ pacing, tuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(pacing.ads.interstitial.enabled, false);
  assert.equal(pacing.ads.rewarded.enabled, false);
});
