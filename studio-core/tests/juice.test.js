import assert from 'node:assert/strict';
import { test } from 'node:test';
import { celebrationLevel, createFeedback, resolveJuice } from '../juice/feedback.js';

test('juice config drives particles, the score popup, and clear sounds', () => {
  let now = 1000;
  const feedback = createFeedback({
    config: {
      particleCount: 4,
      particleLifeMs: 100,
      popupMs: 80,
      flashMs: 20,
      shakeMs: 50,
      shakePx: 5,
      streakSteps: [2, 4, 6]
    },
    now: () => now,
    random: () => 0.25
  });
  const burst = feedback.clear({
    rows: [1],
    cols: [],
    cell: 10,
    grid: 4,
    color: '#3d8bfd',
    points: 14,
    streak: 1,
    popupX: 12,
    popupY: 20
  });
  assert.deepEqual(burst.sounds, ['sfx.clear']);
  assert.equal(burst.level, 0);
  assert.equal(burst.flashId, 'fx.flash');
  assert.equal(burst.particleIds[0], 'fx.particle.1');
  assert.equal(burst.particleIds[7], 'fx.particle.8');

  now = 1010;
  const live = feedback.sample(now);
  assert.equal(live.particles.length, 4);
  assert.equal(live.particles[0].id, 'fx.particle.3');
  assert.equal(live.particles[0].color, '#3d8bfd');
  assert.equal(live.flashes[0].id, 'fx.flash');
  assert.equal(live.popups[0].text, '+14');
  assert.ok(Math.abs(live.shakeX) + Math.abs(live.shakeY) > 0);

  now = 1200;
  const done = feedback.sample(now);
  assert.equal(done.particles.length, 0);
  assert.equal(done.popups.length, 0);
  assert.equal(done.flashes.length, 0);
});

test('a multi-line clear and each streak step play their own sound ids', () => {
  const feedback = createFeedback({
    config: { particleCount: 1, streakSteps: [2, 4, 6] },
    now: () => 0,
    random: () => 0.5
  });
  const combo = feedback.clear({ rows: [0, 1], cols: [], points: 26, streak: 1 });
  assert.deepEqual(combo.sounds, ['sfx.clear', 'sfx.combo']);
  assert.equal(combo.level, 0);

  const first = feedback.clear({ rows: [0], cols: [], points: 20, streak: 2 });
  assert.equal(celebrationLevel(2, [2, 4, 6]), 1);
  assert.ok(first.sounds.includes('sfx.streak.1'));

  const second = feedback.clear({ rows: [0], cols: [], points: 40, streak: 4 });
  assert.equal(second.level, 2);
  assert.ok(second.sounds.includes('sfx.streak.2'));

  const third = feedback.clear({ rows: [0], cols: [], points: 60, streak: 6 });
  assert.equal(third.level, 3);
  assert.ok(third.sounds.includes('sfx.streak.3'));
});

test('an invalid drop requests the invalid sound and a snap', () => {
  let now = 0;
  const feedback = createFeedback({
    config: { invalidShakeMs: 40, invalidShakePx: 6, snapBackMs: 40 },
    now: () => now,
    random: () => 0
  });
  const result = feedback.invalid({
    index: 1,
    fromX: 10,
    fromY: 10,
    toX: 0,
    toY: 40,
    piece: { shape: [[1]], color: '#fff' }
  });
  assert.deepEqual(result.sounds, ['sfx.invalid']);
  now = 10;
  const sample = feedback.sample(now);
  assert.ok(Math.abs(sample.shakeX) > 0);
  assert.equal(sample.snap.index, 1);
  assert.ok(sample.snap.y > 10);
});

test('juice values clamp and reject remote sound ids', () => {
  const juice = resolveJuice({
    particleCount: 500,
    shakePx: -4,
    sounds: { clear: 'https://example.invalid/clear.wav' },
    flashId: 'fx.flash'
  });
  assert.equal(juice.particleCount, 40);
  assert.equal(juice.shakePx, 0);
  assert.equal(juice.sounds.clear, 'sfx.clear');
  assert.deepEqual(juice.sounds.streak, ['sfx.streak.1', 'sfx.streak.2', 'sfx.streak.3']);
  assert.equal(juice.sounds.tap, 'sfx.ui.tap');
  assert.equal(juice.sounds.tutorial, 'sfx.tutorial.step');
  assert.equal(juice.flashId, 'fx.flash');
  assert.equal(juice.dragLiftPx, 76);
  assert.equal(juice.particleIds.length, 8);
});
