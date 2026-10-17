import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryStorage } from '../studio-core/consent/age-gate.js';
import { createSaveStore } from '../src/save.js';

function run() {
  return {
    board: [
      ['#3d8bfd', 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0]
    ],
    pieces: [
      { shapeName: 'square', color: '#ff6fae', tileId: 'tile.pink' },
      null,
      { shapeName: 'dot', color: '#3d8bfd', tileId: 'tile.blue' }
    ],
    score: 12,
    streak: 2,
    bestStreak: 2,
    roundClears: 1,
    totalClears: 1,
    targetClears: 4,
    levelIndex: 0,
    continueUses: 0,
    phase: 'playing'
  };
}

const EMPTY_SAVE = {
  bestScore: 0,
  tutorialSeen: false,
  sessions: 0,
  installDay: '',
  lastSeen: 0,
  easyRun: false,
  mercy: { lossesInRow: 0, queued: 0 },
  settings: { reducedMotion: null, haptics: null },
  daily: { lastCompleted: '', streak: 0, freezes: 0, marks: 0, completions: 0, currency: 0 },
  run: null
};

test('a run round-trips and an empty store has no run', () => {
  const store = createSaveStore(memoryStorage());
  assert.deepEqual(store.load(), EMPTY_SAVE);
  store.save({ bestScore: 12, tutorialSeen: false, run: run() });
  const loaded = store.load();
  assert.equal(loaded.bestScore, 12);
  assert.equal(loaded.run.score, 12);
  assert.equal(loaded.run.pieces[0].shapeName, 'square');
  assert.equal(loaded.run.pieces[1], null);
  assert.equal(loaded.run.board[0][0], '#3d8bfd');
  assert.equal(store.key, 'gridrift.run.v1');
});

test('best score only rises and personal fields are dropped', () => {
  const storage = memoryStorage();
  const store = createSaveStore(storage);
  store.save({ bestScore: 20, tutorialSeen: false, run: null, email: 'person@example.com', name: 'Sam' });
  const next = store.save({
    bestScore: 5,
    tutorialSeen: true,
    phone: '555-0100',
    run: { ...run(), name: 'Sam', email: 'person@example.com' }
  });
  assert.equal(next.bestScore, 20);
  assert.equal(next.tutorialSeen, true);
  assert.equal(next.email, undefined);
  assert.equal(next.run.name, undefined);
  assert.equal(next.run.email, undefined);
  const raw = storage.getItem(store.key);
  assert.equal(raw.includes('email'), false);
  assert.equal(raw.includes('Sam'), false);
  assert.equal(raw.includes('phone'), false);
  assert.equal(raw.includes('555-0100'), false);
});

test('hint progress stays on the run and is capped at one use', () => {
  const store = createSaveStore(memoryStorage());
  store.save({
    bestScore: 1,
    tutorialSeen: true,
    run: { ...run(), hintsUsed: 4, playMs: 130000, sawStuck: true }
  });
  const loaded = store.load();
  assert.equal(loaded.run.hintsUsed, 1);
  assert.equal(loaded.run.playMs, 130000);
  assert.equal(loaded.run.sawStuck, true);
});

test('daily progress, session count, and toggles stay on the device', () => {
  const store = createSaveStore(memoryStorage());
  store.save({
    bestScore: 3,
    tutorialSeen: true,
    sessions: 2,
    installDay: '2026-10-16',
    settings: { reducedMotion: true, haptics: false },
    daily: { lastCompleted: '2026-10-16', streak: 4, freezes: 1, marks: 2 },
    run: { ...run(), rerollsUsed: 3, doublesUsed: 2, mode: 'daily' }
  });
  const loaded = store.load();
  assert.equal(loaded.sessions, 2);
  assert.equal(loaded.installDay, '2026-10-16');
  assert.equal(loaded.settings.reducedMotion, true);
  assert.equal(loaded.settings.haptics, false);
  assert.equal(loaded.daily.streak, 4);
  assert.equal(loaded.daily.freezes, 1);
  assert.equal(loaded.daily.lastCompleted, '2026-10-16');
  assert.equal(loaded.daily.marks, 2);
  assert.equal(loaded.run.rerollsUsed, 1);
  assert.equal(loaded.run.doublesUsed, 1);
  assert.equal(loaded.run.mode, 'daily');
});

test('a corrupt payload does not restore a run', () => {
  const storage = memoryStorage();
  const store = createSaveStore(storage);
  storage.setItem(store.key, '{');
  assert.deepEqual(store.load(), EMPTY_SAVE);
  storage.setItem(store.key, JSON.stringify({
    bestScore: 8,
    tutorialSeen: false,
    run: { board: [1, 2, 3], pieces: 'no', email: 'person@example.com' }
  }));
  const loaded = store.load();
  assert.equal(loaded.bestScore, 8);
  assert.equal(loaded.run, null);
  assert.equal(JSON.stringify(loaded).includes('email'), false);
});
