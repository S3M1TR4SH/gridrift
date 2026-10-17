import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatch } from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';
import {
  completeDaily,
  dateSeed,
  earnFreeze,
  FREEZE_CAP
} from '../src/daily.js';

const score = {
  place: 1,
  line: 10,
  comboBonusPerExtraLine: 5,
  streakMultiplierStep: 0.5,
  maxStreakMultiplier: 4
};

function opening(seed) {
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng: mulberry32(seed),
    targetClears: 8,
    poolFor: () => ['line3', 'line3v', 'line2', 'square', 'corner'],
    palette: [{ id: 'tile.grey', color: '#8b95a8' }]
  });
  return match.state.pieces.map((piece) => piece.shapeName);
}

test('a calendar day maps to one seed and one opening', () => {
  const seed = dateSeed('2026-10-16');
  assert.equal(seed, dateSeed('2026-10-16'));
  assert.notEqual(seed, dateSeed('2026-10-17'));
  assert.deepEqual(opening(seed), opening(dateSeed('2026-10-16')));
  assert.notDeepEqual(opening(seed), opening(dateSeed('2026-10-17')));
});

test('streaks continue, freeze a missed day, and reset past the freeze', () => {
  const started = completeDaily({ lastCompleted: '', streak: 0, freezes: 0 }, '2026-10-16');
  assert.equal(started.streak, 1);
  assert.equal(started.lastCompleted, '2026-10-16');
  const next = completeDaily(started, '2026-10-17');
  assert.equal(next.streak, 2);
  assert.equal(next.status, 'continued');
  const again = completeDaily(next, '2026-10-17');
  assert.equal(again.streak, 2);
  assert.equal(again.status, 'already');

  const held = completeDaily({ ...next, freezes: 1 }, '2026-10-19');
  assert.equal(held.status, 'frozen');
  assert.equal(held.streak, 3);
  assert.equal(held.freezes, 0);

  const broken = completeDaily({ ...next, freezes: 1 }, '2026-10-20');
  assert.equal(broken.status, 'reset');
  assert.equal(broken.streak, 1);
  assert.equal(broken.freezes, 1);
});

test('freezes are earned by play and never by an ad or a sale', () => {
  const base = { lastCompleted: '', streak: 0, freezes: 0 };
  assert.equal(earnFreeze(base, 'play').freezes, 1);
  assert.equal(earnFreeze(base, 'ad').freezes, 0);
  assert.equal(earnFreeze(base, 'sale').freezes, 0);
  const full = { ...base, freezes: FREEZE_CAP };
  assert.equal(earnFreeze(full, 'play').freezes, FREEZE_CAP);
});
