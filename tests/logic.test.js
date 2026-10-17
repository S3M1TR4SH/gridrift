import assert from 'node:assert/strict';
import { test } from 'node:test';
import pacing from '../config/pacing.json' with { type: 'json' };
import {
  applyClears,
  canPlace,
  clearFullestRows,
  createBoard,
  createMatch,
  dealPieces,
  findClears,
  findSmartHint,
  fitsAnywhere,
  hasAnyMove,
  scorePlacement,
  SHAPES
} from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';

const score = {
  place: 1,
  line: 10,
  comboBonusPerExtraLine: 5,
  streakMultiplierStep: 0.5,
  maxStreakMultiplier: 4
};
const palette = [{ id: 'tile.blue', color: '#3d8bfd' }];

test('placement, line clears, combo, and streak scoring', () => {
  const match = createMatch({
    grid: 4,
    traySize: 2,
    score,
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['line4'],
    palette
  });
  const first = match.place(0, 0, 0);
  assert.equal(first.ok, true);
  assert.equal(first.lines, 1);
  assert.equal(first.gained, 14);
  assert.equal(match.state.streak, 1);
  assert.equal(match.state.board[0].every((cell) => cell === 0), true);
  assert.equal(match.state.pieces[0], null);
  assert.equal(match.state.pieces[1].shapeName, 'line4');

  const second = match.place(1, 0, 0);
  assert.equal(second.lines, 1);
  assert.equal(second.gained, 19);
  assert.equal(match.state.streak, 2);

  const quiet = scorePlacement({ cells: 1, lines: 0, streak: 0, tuning: score });
  assert.equal(quiet, 1);
  const combo = scorePlacement({ cells: 1, lines: 2, streak: 1, tuning: score });
  assert.equal(combo, 26);
  const capped = scorePlacement({ cells: 0, lines: 1, streak: 100, tuning: score });
  assert.equal(capped, 40);
});

test('full rows and columns are found before either is erased', () => {
  const board = [
    ['a', 'a', 'a'],
    ['a', 0, 0],
    ['a', 0, 0]
  ];
  const found = findClears(board);
  assert.deepEqual(found, { rows: [0], cols: [0] });
  const cleared = applyClears(board, found);
  assert.deepEqual(cleared, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]);
});

test('a legal gap still receives a placeable piece', () => {
  const board = createBoard(4);
  for (let i = 0; i < 30; i += 1) {
    const dealt = dealPieces({
      board,
      pool: ['square', 'line4', 'dot'],
      count: 3,
      rng: mulberry32(i + 1),
      palette
    });
    assert.equal(dealt.gameOver, false);
    assert.equal(fitsAnywhere(board, dealt.pieces[0].shape), true);
    assert.equal(hasAnyMove(board, dealt.pieces), true);
  }
});

test('no forced lockout: game over only when nothing in the pool fits', () => {
  const board = createBoard(4);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) board[y][x] = x === 3 && y === 3 ? 0 : '#fff';
  }
  const dealt = dealPieces({
    board,
    pool: ['square', 'line3'],
    count: 3,
    rng: () => 0,
    palette
  });
  assert.equal(dealt.gameOver, true);
  assert.equal(hasAnyMove(board, dealt.pieces), false);
  assert.equal(canPlace(board, dealt.pieces[0].shape, 0, 0), false);
});

test('restart clears the run and continue does not add score', () => {
  const match = createMatch({
    grid: 5,
    traySize: 1,
    score,
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['dot'],
    palette
  });
  assert.equal(match.place(0, 0, 0).ok, true);
  assert.equal(match.state.score, 1);
  const continued = match.continueRun(3);
  assert.equal(continued.score, 1);
  assert.equal(match.state.phase, 'playing');
  assert.equal(match.state.streak, 0);
  match.place(0, 1, 1);
  match.restart(4);
  assert.equal(match.state.score, 0);
  assert.equal(match.state.roundClears, 0);
  assert.equal(match.state.targetClears, 4);
  assert.equal(match.state.board.every((row) => row.every((cell) => cell === 0)), true);
});

test('clearing the target ends the round before a lockout', () => {
  const match = createMatch({
    grid: 4,
    traySize: 1,
    score,
    rng: () => 0,
    targetClears: 1,
    poolFor: () => ['line4'],
    palette
  });
  const result = match.place(0, 0, 0);
  assert.equal(result.roundComplete, true);
  assert.equal(match.state.phase, 'round_complete');
});

test('tray slots stay put until every slot is empty', () => {
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['dot', 'line2', 'square'],
    palette
  });
  const kept = match.state.pieces[1].shapeName;
  assert.equal(match.place(0, 0, 0).ok, true);
  assert.equal(match.state.pieces.length, 3);
  assert.equal(match.state.pieces[0], null);
  assert.equal(match.state.pieces[1].shapeName, kept);
  assert.ok(match.state.pieces[2]);
});

test('the shape catalog has 15 or more placeable shapes', () => {
  const names = Object.keys(SHAPES);
  assert.ok(names.length >= 15);
  const board = createBoard(10);
  const seen = new Set();
  for (const pool of pacing.difficulty.pools) {
    for (const name of pool.shapes) {
      assert.ok(SHAPES[name], name);
      seen.add(name);
    }
  }
  assert.ok(seen.size >= 15);
  for (const name of names) {
    const shape = SHAPES[name];
    assert.ok(shape.length > 0);
    for (const row of shape) {
      assert.equal(row.length, shape[0].length);
      for (const cell of row) assert.ok(cell === 0 || cell === 1);
    }
    assert.equal(fitsAnywhere(board, shape), true, name);
  }
  const dealt = dealPieces({
    board,
    pool: names,
    count: 3,
    rng: mulberry32(4),
    palette
  });
  assert.equal(dealt.pieces.length, 3);
  for (const piece of dealt.pieces) assert.ok(names.includes(piece.shapeName));
});

test('the hint prefers a line clear over the top-left cell', () => {
  const board = createBoard(4);
  board[0] = ['#fff', '#fff', '#fff', 0];
  const hint = findSmartHint(board, SHAPES.dot);
  assert.deepEqual({ x: hint.x, y: hint.y }, { x: 3, y: 0 });
  assert.ok(hint.value >= 1000);

  const empty = findSmartHint(createBoard(4), SHAPES.dot);
  assert.equal(empty.x === 0 && empty.y === 0, false);

  const match = createMatch({
    grid: 4,
    traySize: 1,
    score,
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['dot'],
    palette
  });
  const shown = match.showHint();
  assert.equal(shown.label, 'Fits here');
  assert.equal(shown.x === 0 && shown.y === 0, false);
});

test('a saved run restores score and stable tray slots', () => {
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng: () => 0,
    targetClears: 4,
    poolFor: () => ['dot'],
    palette,
    saved: {
      board: createBoard(6),
      pieces: [
        { shapeName: 'line2', color: '#ffffff', tileId: 'tile.blue' },
        null,
        { shapeName: 'dot', color: '#ffffff', tileId: 'tile.red' }
      ],
      score: 9,
      streak: 1,
      bestStreak: 3,
      roundClears: 1,
      totalClears: 2,
      targetClears: 6,
      phase: 'playing'
    }
  });
  assert.equal(match.state.score, 9);
  assert.equal(match.state.targetClears, 6);
  assert.equal(match.state.pieces[0].shapeName, 'line2');
  assert.equal(match.state.pieces[1], null);
  assert.equal(match.place(0, 0, 0).ok, true);
  assert.equal(match.state.pieces[2].shapeName, 'dot');
});

test('continue opens the fullest rows', () => {
  const board = [
    [0, 0, 0, 0],
    ['a', 'a', 0, 0],
    ['a', 'a', 'a', 'a'],
    ['a', 0, 0, 0]
  ];
  const next = clearFullestRows(board, 1);
  assert.deepEqual(next[2], [0, 0, 0, 0]);
  assert.equal(next[1][0], 'a');
});
