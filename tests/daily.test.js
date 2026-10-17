import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatch } from '../src/logic.js';
import { mulberry32 } from '../src/rng.js';
import {
  completeDaily,
  dailyObjective,
  dateSeed,
  daysSinceInstall,
  earnFreeze,
  formatUtcDate,
  FREEZE_CAP,
  settleDaily,
  streakDay
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

test('days since install is a count and not a date', () => {
  assert.equal(daysSinceInstall('2026-10-16', '2026-10-16'), 0);
  assert.equal(daysSinceInstall('2026-10-16', '2026-10-17'), 1);
  assert.equal(daysSinceInstall('2026-10-10', '2026-10-17'), 7);
  assert.equal(daysSinceInstall('', '2026-10-17'), 0);
  assert.equal(daysSinceInstall('2026-10-20', '2026-10-17'), 0);
});

test('freezes are earned by play and never by an ad or a sale', () => {
  const base = { lastCompleted: '', streak: 0, freezes: 0 };
  assert.equal(earnFreeze(base, 'play').freezes, 1);
  assert.equal(earnFreeze(base, 'ad').freezes, 0);
  assert.equal(earnFreeze(base, 'sale').freezes, 0);
  const full = { ...base, freezes: FREEZE_CAP };
  assert.equal(earnFreeze(full, 'play').freezes, FREEZE_CAP);
  assert.equal(FREEZE_CAP, 2);
});

test('a freeze is earned every seven completed dailies and the board seed is the utc date', () => {
  let state = { lastCompleted: '', streak: 0, freezes: 0, completions: 0, currency: 0 };
  const day = new Date(2026, 9, 17, 3, 30);
  assert.equal(streakDay(day, 4), '2026-10-16');
  assert.equal(streakDay(new Date(2026, 9, 17, 4, 0), 4), '2026-10-17');
  assert.equal(formatUtcDate(new Date('2026-10-17T03:30:00Z')), '2026-10-17');
  for (let count = 1; count <= 6; count += 1) {
    const today = `2026-10-${String(count).padStart(2, '0')}`;
    state = settleDaily(state, today, { rewardAmount: 20, earnEveryNDays: 7 });
    assert.equal(state.freezes, 0);
    assert.equal(state.currency, count * 20);
  }
  state = settleDaily(state, '2026-10-07', { rewardAmount: 20, earnEveryNDays: 7 });
  assert.equal(state.freezes, 1);
  assert.equal(state.completions, 7);
  const skipped = settleDaily({ ...state, lastCompleted: '2026-10-07', freezes: 0 }, '2026-10-10', {
    rewardAmount: 20,
    earnEveryNDays: 7
  });
  assert.equal(skipped.status, 'reset');
  assert.equal(skipped.currency, state.currency + 20);
  assert.equal(skipped.completions, 8);
  const objective = dailyObjective(dateSeed('2026-10-17'), [8, 20]);
  assert.ok(objective >= 8 && objective <= 20);
  assert.equal(objective, dailyObjective(dateSeed('2026-10-17'), [8, 20]));
});
