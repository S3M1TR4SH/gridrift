import assert from 'node:assert/strict';
import { test } from 'node:test';
import pacing from '../config/pacing.json' with { type: 'json' };
import { createMatch, fitsAnywhere } from '../src/logic.js';
import { SHAPES } from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';
import { createPacer } from '../studio-core/index.js';

const score = {
  place: 1,
  line: 10,
  comboBonusPerExtraLine: 5,
  streakMultiplierStep: 0.5,
  maxStreakMultiplier: 4
};

function pieceNames(seed, { ads }) {
  const rng = mulberry32(seed);
  const source = ads
    ? pacing
    : {
      ...pacing,
      ads: {
        ...pacing.ads,
        personalized: true,
        interstitial: { ...pacing.ads.interstitial, enabled: false },
        rewarded: { ...pacing.ads.rewarded, enabled: false, optInOnly: false }
      },
      difficulty: { ...pacing.difficulty, failBias: 1, forceUnplaceable: true }
    };
  const pacer = createPacer({
    pacing: source,
    now: () => 5_000_000,
    sessionNumber: ads ? 4 : 1,
    isChild: () => !ads
  });
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng,
    targetClears: 99,
    poolFor: (clears) => pacer.shapePool(clears),
    palette: [{ id: 'tile.grey', color: '#8b95a8' }, { id: 'tile.blue', color: '#3d8bfd' }]
  });
  const seen = [];
  const snap = () => seen.push(match.state.pieces.map((piece) => piece?.shapeName || null));
  snap();
  for (let step = 0; step < 12; step += 1) {
    if (ads) pacer.recordAd(step % 2 === 0 ? 'rewarded' : 'interstitial');
    const state = match.state;
    if (state.phase !== 'playing') break;
    let placed = false;
    for (let index = 0; index < state.pieces.length && !placed; index += 1) {
      const piece = state.pieces[index];
      if (!piece) continue;
      for (let y = 0; y < state.grid && !placed; y += 1) {
        for (let x = 0; x < state.grid && !placed; x += 1) {
          const result = match.place(index, x, y);
          if (result.ok) placed = true;
        }
      }
    }
    if (!placed) break;
    snap();
  }
  return { seen, failBias: pacer.failBias, forceUnplaceable: pacer.forceUnplaceable };
}

test('the same seed deals the same pieces whether or not ads and rewards run', () => {
  for (const seed of [1, 7, 42, 99, 256]) {
    const withAds = pieceNames(seed, { ads: true });
    const without = pieceNames(seed, { ads: false });
    assert.deepEqual(withAds.seen, without.seen, `seed ${seed}`);
    assert.equal(withAds.failBias, 0);
    assert.equal(without.failBias, 0);
    assert.equal(withAds.forceUnplaceable, false);
    assert.equal(without.forceUnplaceable, false);
  }
});

test('a dealt tray is never forced into a fail when a pool shape still fits', () => {
  const board = Array.from({ length: 6 }, () => Array(6).fill(0));
  const pool = pacing.difficulty.pools[0].shapes;
  assert.equal(pool.some((name) => fitsAnywhere(board, SHAPES[name])), true);
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng: mulberry32(11),
    targetClears: 4,
    poolFor: () => pool,
    palette: [{ id: 'tile.grey', color: '#8b95a8' }]
  });
  assert.equal(match.state.phase, 'playing');
  assert.equal(pacing.difficulty.forceUnplaceable, false);
  assert.equal(pacing.difficulty.failBias, 0);
});
