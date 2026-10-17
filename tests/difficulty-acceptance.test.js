import assert from 'node:assert/strict';
import { test } from 'node:test';
import difficulty from '../config/difficulty.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { easedRun, generateTray, goalForRound, gridForRound, intensity } from '../src/difficulty.js';
import { createBoard, createMatch, placementValue } from '../src/logic.js';
import { openingBoard } from '../src/onboarding.js';
import { mulberry32 } from '../src/rng.js';

const palette = [{ id: 'tile.blue', color: '#3d8bfd' }];

function choose(board, pieces, rng) {
  const ranked = [];
  pieces.forEach((piece, pieceIndex) => {
    const shape = piece?.shape;
    if (!shape) return;
    for (let y = 0; y <= board.length - shape.length; y += 1) {
      for (let x = 0; x <= board[0].length - shape[0].length; x += 1) {
        const value = placementValue(board, shape, x, y);
        if (!Number.isFinite(value)) continue;
        ranked.push({ pieceIndex, x, y, value });
      }
    }
  });
  ranked.sort((a, b) => b.value - a.value || a.pieceIndex - b.pieceIndex || a.y - b.y || a.x - b.x);
  if (!ranked.length) return null;
  if (ranked.length > 1 && rng() < 0.1) return ranked[1];
  return ranked[0];
}

function play(seed, { noise = false, mercy = false, maxMoves = 180 } = {}) {
  const rng = mulberry32(seed);
  let round = 1;
  let moves = 0;
  let lostRound = 0;
  const opening = openingBoard(gridForRound(1, difficulty));
  let match = createMatch({
    grid: gridForRound(1, difficulty),
    traySize: 3,
    score: tuning.score,
    rng,
    targetClears: goalForRound(1, difficulty),
      generator: (board, state, dealRng) => generateTray({
      board,
      run: easedRun({
        moves,
        elapsedMs: moves * 2500,
        score: state.score,
        totalClears: state.totalClears,
        assistDealsLeft: 0,
        ...(noise ? { adAvailable: true, bestScore: 9000, rewardedReady: true, adFill: 1 } : {})
      }, { mercy, cfg: difficulty }),
      cfg: difficulty,
      rng: dealRng
    }),
    palette,
    saved: {
      board: opening.board,
      pieces: opening.pieces,
      phase: 'playing',
      targetClears: goalForRound(1, difficulty)
    }
  });
  while (moves < maxMoves && match.state.phase !== 'game_over') {
    if (match.state.phase === 'round_complete') {
      round += 1;
      const nextGrid = gridForRound(round, difficulty);
      const goal = goalForRound(round, difficulty);
      const kept = match.state;
      if (nextGrid !== kept.grid) {
        match = createMatch({
          grid: nextGrid,
          traySize: 3,
          score: tuning.score,
          rng,
          targetClears: goal,
          generator: (board, state, dealRng) => generateTray({
            board,
            run: easedRun({
              moves,
              elapsedMs: moves * 2500,
              score: state.score,
              totalClears: state.totalClears,
              assistDealsLeft: 0,
              ...(noise ? { adAvailable: false, bestScore: 1 } : { adAvailable: true, bestScore: 9000 })
            }, { mercy, cfg: difficulty }),
            cfg: difficulty,
            rng: dealRng
          }),
          palette,
          saved: {
            board: createBoard(nextGrid),
            pieces: [null, null, null],
            score: kept.score,
            streak: kept.streak,
            bestStreak: kept.bestStreak,
            totalClears: kept.totalClears,
            phase: 'playing',
            targetClears: goal
          }
        });
      } else match.nextRound(goal);
      continue;
    }
    const pick = choose(match.state.board, match.state.pieces, rng);
    if (!pick) {
      lostRound = round;
      break;
    }
    const placed = match.place(pick.pieceIndex, pick.x, pick.y);
    moves += 1;
    if (placed.gameOver) lostRound = round;
  }
  if (match.state.phase === 'game_over' && !lostRound) lostRound = round;
  return { seconds: moves * 2.5, round: lostRound, ended: match.state.phase === 'game_over', moves };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

test('the ramp is monotonic, generous through 60s, and full by 100s', () => {
  assert.equal(difficulty.ramp.startS, 60);
  assert.ok(difficulty.ramp.fullS <= 105);
  assert.ok(difficulty.ramp.fullS < 120);
  let previous = -1;
  for (let seconds = 0; seconds <= 160; seconds += 5) {
    const level = intensity({
      moves: seconds / 2.5,
      elapsedMs: seconds * 1000,
      score: seconds * 3,
      totalClears: 0,
      assistDealsLeft: 0
    }, difficulty);
    assert.ok(level + 1e-9 >= previous, `${seconds}s dipped`);
    previous = level;
  }
  assert.equal(intensity({ moves: 24, elapsedMs: 60_000, score: 0, totalClears: 0, assistDealsLeft: 0 }, difficulty), 0);
  const full = difficulty.ramp.fullS;
  assert.equal(intensity({
    moves: full / 2.5,
    elapsedMs: full * 1000,
    score: 0,
    totalClears: 0,
    assistDealsLeft: 0
  }, difficulty), 1);
  const mid = intensity({ moves: 32, elapsedMs: 80_000, score: 0, totalClears: 0, assistDealsLeft: 0 }, difficulty);
  assert.ok(mid > 0.45);
  const late = { moves: 80, elapsedMs: 200_000, score: 900, totalClears: 20, assistDealsLeft: 0 };
  const eased = easedRun(late, { mercy: true, cfg: difficulty });
  assert.ok(intensity(eased, difficulty) > 0);
  assert.ok(intensity(late, difficulty) > 0);
});

test('loss time stays at least 60s and does not change when ads are on', () => {
  const quiet = [];
  const noisy = [];
  for (let seed = 1; seed <= 12; seed += 1) {
    quiet.push(play(seed, { noise: false }));
    noisy.push(play(seed, { noise: true }));
  }
  assert.deepEqual(noisy, quiet);
  const seconds = quiet.map((result) => result.seconds);
  const mid = median(seconds);
  const early = seconds.filter((value) => value < 60).length / seconds.length;
  const inBand = seconds.filter((value) => value >= 90 && value <= 150).length / seconds.length;
  assert.ok(mid >= 60, `median ${mid}`);
  assert.ok(early <= 0.02, `early share ${early}`);
  assert.ok(inBand >= 0.5, `90-150s share ${inBand}`);
  const late = seconds.filter((value) => value > 180).length;
  assert.ok(late < seconds.length / 2, `late tail ${late}`);
});

test('a mercy run still reaches game over without flattening the ramp', () => {
  const results = [];
  for (let seed = 1; seed <= 8; seed += 1) {
    const result = play(seed, { mercy: true, maxMoves: 400 });
    results.push(result);
    assert.equal(result.ended, true, `seed ${seed} moves ${result.moves}`);
    const eased = easedRun({
      moves: result.moves,
      elapsedMs: result.moves * 2500,
      score: 0,
      totalClears: 0,
      assistDealsLeft: 0
    }, { mercy: true, cfg: difficulty });
    if (result.seconds > difficulty.ramp.startS + 30) assert.ok(intensity(eased, difficulty) > 0);
  }
  assert.ok(results.every((result) => result.ended));
});
