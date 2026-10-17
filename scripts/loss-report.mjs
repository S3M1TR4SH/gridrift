import difficulty from '../config/difficulty.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { generateTray, goalForRound, gridForRound } from '../src/difficulty.js';
import { createBoard, createMatch, placementValue } from '../src/logic.js';
import { openingBoard } from '../src/onboarding.js';
import { mulberry32 } from '../src/rng.js';

const SEEDS = 24;
const MOVE_CAP = 180;
const palette = [{ id: 'tile.blue', color: '#3d8bfd' }];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

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

function play(seed, cfg) {
  const rng = mulberry32(seed);
  let round = 1;
  let moves = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let totalClears = 0;
  const reached = {};
  let lostRound = 0;
  const opening = openingBoard(gridForRound(1, cfg));
  let match = createMatch({
    grid: gridForRound(1, cfg),
    traySize: 3,
    score: tuning.score,
    rng,
    targetClears: goalForRound(1, cfg),
    generator: (board, state, dealRng) => generateTray({
      board,
      run: {
        moves,
        elapsedMs: moves * 2500,
        score: state.score,
        totalClears: state.totalClears,
        assistDealsLeft: 0
      },
      cfg,
      rng: dealRng
    }),
    palette,
    saved: {
      board: opening.board,
      pieces: opening.pieces,
      phase: 'playing',
      targetClears: goalForRound(1, cfg)
    }
  });
  while (moves < MOVE_CAP) {
    reached[round] = true;
    if (match.state.phase === 'game_over') {
      lostRound = round;
      break;
    }
    if (match.state.phase === 'round_complete') {
      round += 1;
      const nextGrid = gridForRound(round, cfg);
      const goal = goalForRound(round, cfg);
      const kept = match.state;
      score = kept.score;
      streak = kept.streak;
      bestStreak = kept.bestStreak;
      totalClears = kept.totalClears;
      if (nextGrid !== kept.grid) {
        match = createMatch({
          grid: nextGrid,
          traySize: 3,
          score: tuning.score,
          rng,
          targetClears: goal,
          generator: (board, state, dealRng) => generateTray({
            board,
            run: {
              moves,
              elapsedMs: moves * 2500,
              score: state.score,
              totalClears: state.totalClears,
              assistDealsLeft: 0
            },
            cfg,
            rng: dealRng
          }),
          palette,
          saved: {
            board: createBoard(nextGrid),
            pieces: [null, null, null],
            score,
            streak,
            bestStreak,
            totalClears,
            phase: 'playing',
            targetClears: goal
          }
        });
      } else {
        match.nextRound(goal);
      }
      continue;
    }
    const pick = choose(match.state.board, match.state.pieces, rng);
    if (!pick) {
      lostRound = round;
      break;
    }
    match.place(pick.pieceIndex, pick.x, pick.y);
    moves += 1;
  }
  if (!lostRound && moves >= MOVE_CAP) lostRound = round;
  return { moves, seconds: moves * 2.5, lostRound, reached };
}

function summarize(label, cfg) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) runs.push(play(seed, cfg));
  const seconds = runs.map((run) => run.seconds);
  const inWindow = runs.filter((run) => run.seconds >= 90 && run.seconds <= 150).length;
  const underMinute = runs.filter((run) => run.seconds < 60).length;
  const rounds = {};
  for (const run of runs) {
    for (const round of Object.keys(run.reached)) {
      if (!rounds[round]) rounds[round] = { reached: 0, lost: 0 };
      rounds[round].reached += 1;
      if (Number(round) === run.lostRound) rounds[round].lost += 1;
    }
  }
  return {
    label,
    seeds: SEEDS,
    medianSeconds: median(seconds),
    meanSeconds: Math.round(seconds.reduce((sum, value) => sum + value, 0) / seconds.length),
    share90to150: inWindow / runs.length,
    shareUnder60: underMinute / runs.length,
    rounds
  };
}

const eight = structuredClone(difficulty);
const six = structuredClone(difficulty);
six.gridSize = { opening: 6, fromRound: 99, size: 6 };
const report = {
  eight: summarize('8x8 from round 2', eight),
  six: summarize('6x6 all rounds', six)
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
