import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import difficulty from '../config/difficulty.json' with { type: 'json' };
import {
  ALLOWED_RUN_STATE_KEYS,
  easedRun,
  generateTray,
  goalForRound,
  gridForRound,
  intensity,
  readRunState
} from '../src/difficulty.js';
import { SHAPES, createBoard, fitsAnywhere, nextScoreGoal, scorePlacement } from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';
import tuning from '../config/tuning.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceWithoutComments(relative) {
  return readFileSync(join(root, relative), 'utf8').replace(/\/\/.*$/gm, '');
}

test('the generator only reads board and run state', () => {
  assert.deepEqual(ALLOWED_RUN_STATE_KEYS, ['moves', 'elapsedMs', 'score', 'totalClears', 'assistDealsLeft']);
  const source = sourceWithoutComments('src/difficulty.js');
  assert.doesNotMatch(source, /best|highScore|adAvail|rewarded|canOffer|pacer|localStorage/i);
  const main = sourceWithoutComments('src/main.js');
  const start = main.indexOf('generator:');
  const end = main.indexOf('palette,', start);
  const call = main.slice(start, end);
  for (const word of ['bestScore', 'highScore', 'adAvailable', 'rewardedReady', 'adFill', 'lossHistory', 'localStorage', 'pacer']) {
    assert.equal(call.includes(word), false, word);
  }
  assert.equal(difficulty.hardRules.failBias, 0);
  assert.equal(difficulty.hardRules.forceUnplaceable, false);
  assert.equal(difficulty.hardRules.allowStuckState, false);
  assert.equal(difficulty.roundSetup.prefillAfterRound1, false);
  const empty = createBoard(8);
  const crowded = createBoard(8);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) if ((x + y) % 3 !== 0) crowded[y][x] = '#fff';
  }
  for (const board of [empty, crowded]) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const run = { moves: 40, elapsedMs: 100000, score: 400, totalClears: 8, assistDealsLeft: 0 };
      const clean = generateTray({ board, run, cfg: difficulty, rng: mulberry32(seed) });
      const noisy = generateTray({
        board,
        run: { ...run, bestScore: 9999, highScore: 9999, adAvailable: true, rewardedReady: true, adFill: 1 },
        cfg: difficulty,
        rng: mulberry32(seed)
      });
      assert.equal(noisy.names.join(), clean.names.join());
    }
  }
});

test('slot 0 fits whenever a tier shape fits, and mercy eases without ads', () => {
  const board = createBoard(6);
  for (const moves of [0, 30, 60, 200]) {
    const out = generateTray({
      board,
      run: { moves, elapsedMs: moves * 2500, score: moves * 4, totalClears: Math.floor(moves / 5), assistDealsLeft: 0 },
      cfg: difficulty,
      rng: mulberry32(moves + 3)
    });
    assert.equal(fitsAnywhere(board, SHAPES[out.names[0]]), true);
    assert.equal(out.gameOver, false);
  }
  const late = { moves: 80, elapsedMs: 200000, score: 900, totalClears: 24, assistDealsLeft: 0 };
  const eased = easedRun(late, { mercy: true, cfg: difficulty });
  assert.ok(intensity(eased, difficulty) > 0);
  assert.equal(eased.mercyTierCap, 1);
  assert.ok(eased.elapsedMs <= late.elapsedMs - 29000);
  let capped = true;
  for (let seed = 1; seed <= 24; seed += 1) {
    const names = generateTray({ board, run: eased, cfg: difficulty, rng: mulberry32(seed) }).names;
    if (names.includes('line5')) capped = false;
  }
  assert.equal(capped, true);
  let differed = false;
  for (let seed = 1; seed <= 12; seed += 1) {
    const hard = generateTray({ board, run: late, cfg: difficulty, rng: mulberry32(seed) }).names.join();
    const easy = generateTray({ board, run: eased, cfg: difficulty, rng: mulberry32(seed) }).names.join();
    if (hard !== easy) differed = true;
  }
  assert.equal(differed, true);
  const fastMoves = Math.floor(60 / 2.2);
  assert.equal(intensity({
    moves: fastMoves,
    elapsedMs: Math.round(fastMoves * 2200),
    score: 0,
    totalClears: 0,
    assistDealsLeft: 0
  }, difficulty), 0);
  assert.equal(difficulty.timeModel.secondsPerMove, 2.5);
  assert.equal(intensity({ moves: 24, elapsedMs: 0, score: 0, totalClears: 0, assistDealsLeft: 0 }, difficulty), 0);
  assert.ok(intensity({ moves: 25, elapsedMs: 0, score: 0, totalClears: 0, assistDealsLeft: 0 }, difficulty) > 0);
  assert.equal(gridForRound(1, difficulty), 6);
  assert.equal(gridForRound(2, difficulty), 8);
  assert.deepEqual([1, 2, 3, 4].map((round) => goalForRound(round, difficulty)), [4, 6, 10, 14]);
});

test('combo and streak chains escalate and the next score goal stays visible', () => {
  const gained = scorePlacement({ cells: 4, lines: 1, streak: 1, tuning: tuning.score });
  const plain = scorePlacement({
    cells: 4,
    lines: 1,
    streak: 1,
    tuning: { ...tuning.score, comboChain: undefined, streakChain: undefined }
  });
  assert.equal(gained, plain + 6);
  assert.equal(nextScoreGoal(0, tuning.score.goals), 40);
  assert.equal(nextScoreGoal(40, tuning.score.goals), 100);
  assert.ok(nextScoreGoal(5000, tuning.score.goals) > 1000);
});
