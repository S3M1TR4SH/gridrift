import assert from 'node:assert/strict';
import { test } from 'node:test';
import pacing from '../config/pacing.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { createPacer } from '../studio-core/index.js';
import {
  canPlace,
  createBoard,
  createMatch,
  findClears,
  hasAnyMove,
  paint,
  SHAPES
} from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';

const palette = [{ id: 'tile.blue', color: '#3d8bfd' }];
const SEEDS = Array.from({ length: 21 }, (_, index) => index + 1);

function pieceMoves(board, pieces) {
  const moves = [];
  pieces.forEach((piece, index) => {
    const shape = piece?.shape;
    if (!shape?.length) return;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        if (!canPlace(board, shape, x, y)) continue;
        const painted = paint(board, shape, x, y, 1);
        const found = findClears(painted);
        let progress = 0;
        const rows = new Set();
        const cols = new Set();
        shape.forEach((row, dy) => row.forEach((cell, dx) => {
          if (!cell) return;
          rows.add(y + dy);
          cols.add(x + dx);
        }));
        for (const row of rows) {
          progress = Math.max(progress, painted[row].filter(Boolean).length);
        }
        for (const col of cols) {
          let filled = 0;
          for (const row of painted) if (row[col]) filled += 1;
          progress = Math.max(progress, filled);
        }
        moves.push({
          index,
          x,
          y,
          lines: found.rows.length + found.cols.length,
          progress
        });
      }
    }
  });
  moves.sort((a, b) => b.lines - a.lines || b.progress - a.progress || a.y - b.y || a.x - b.x || a.index - b.index);
  return moves;
}

function typicalMove(board, pieces, rng) {
  const moves = pieceMoves(board, pieces);
  if (!moves.length) return null;
  if (rng() < 0.35) return moves[0];
  return moves[Math.floor(rng() * moves.length)];
}

function playSeed(seed, maxPlacements) {
  const pacer = createPacer({ pacing, now: () => 0 });
  const rng = mulberry32(seed);
  const chooser = mulberry32(seed + 1000);
  const match = createMatch({
    grid: tuning.grid,
    traySize: tuning.traySize,
    score: tuning.score,
    rng,
    targetClears: 99,
    poolFor: (clears) => pacer.shapePool(clears),
    palette
  });
  assert.equal(pacer.forceUnplaceable, false);
  assert.equal(match.state.phase, 'playing');
  assert.equal(hasAnyMove(match.state.board, match.state.pieces), true);
  let firstClear = null;
  let combo = false;
  let locked = false;
  for (let step = 1; step <= maxPlacements && match.state.phase === 'playing'; step += 1) {
    const move = typicalMove(match.state.board, match.state.pieces, chooser);
    if (!move) break;
    const result = match.place(move.index, move.x, move.y);
    if (firstClear == null && result.lines > 0) firstClear = step;
    if (result.combo >= 2) combo = true;
    if (match.state.phase === 'game_over') {
      locked = hasAnyMove(match.state.board, match.state.pieces) === false;
    }
  }
  return { firstClear, combo, locked };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

test('a seeded typical player clears within the first five placements', () => {
  const runs = SEEDS.map((seed) => playSeed(seed, 40));
  const firstClears = runs.map((run) => run.firstClear ?? 99);
  const mid = median(firstClears);
  assert.ok(mid <= 5, `median ${mid} from ${firstClears.join(',')}`);
});

test('the opening mix can combo two lines in one placement', () => {
  const early = pacing.difficulty.pools[0].shapes;
  const vertical = ['line2v', 'line3v', 'line4v'].find((name) => early.includes(name));
  assert.ok(vertical, `early pool needs a vertical line, got ${early.join(',')}`);
  const shape = SHAPES[vertical];
  const board = createBoard(tuning.grid);
  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < tuning.grid; x += 1) {
      if (x !== tuning.grid - 1) board[y][x] = '#fff';
    }
  }
  const painted = paint(board, shape, tuning.grid - 1, 0, 1);
  const found = findClears(painted);
  assert.ok(found.rows.length >= 2, `${vertical} should clear a combo on the shipped grid`);
});

test('seeded play reaches a real lockout and never starts from a forced one', () => {
  assert.equal(pacing.difficulty.forceUnplaceable, false);
  assert.equal(pacing.difficulty.failBias, 0);
  const runs = SEEDS.map((seed) => playSeed(seed, 80));
  assert.equal(runs.some((run) => run.locked), true);
});
