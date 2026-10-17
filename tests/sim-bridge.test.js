import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import tuning from '../config/tuning.json' with { type: 'json' };
import { createBoard } from '../src/logic.js';
import { listMoves } from '../src/sim-bridge.js';
import { validateGameConfig } from '../studio-core/guardrails/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('move listing reports a completing line and leaves the board unchanged', () => {
  const board = createBoard(4);
  for (let x = 0; x < 3; x += 1) board[0][x] = '#fff';
  const before = board.map((row) => row.slice());
  const moves = listMoves(board, [{ shape: [[1]], shapeName: 'dot' }]);
  const clear = moves.find((move) => move.x === 3 && move.y === 0);
  assert.equal(clear.lines, 1);
  assert.equal(clear.cells, 1);
  assert.equal(clear.type, 'move');
  assert.deepEqual(board, before);
});

test('quiet ad variant stays inside the guardrails', () => {
  const pacing = JSON.parse(readFileSync(join(root, 'sim/variants/quiet-ads.json'), 'utf8'));
  const result = validateGameConfig({ pacing, tuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(pacing.ads.interstitial.enabled, false);
  assert.equal(pacing.ads.rewarded.enabled, false);
});
