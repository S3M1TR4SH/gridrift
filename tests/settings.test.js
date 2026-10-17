import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialHaptics, initialMotion, shouldVibrate } from '../src/settings.js';

test('reduced motion defaults from the system preference and can be overridden', () => {
  const reduce = () => ({ matches: true });
  const motion = () => ({ matches: false });
  assert.equal(initialMotion({ stored: null, query: reduce }), true);
  assert.equal(initialMotion({ stored: null, query: motion }), false);
  assert.equal(initialMotion({ stored: false, query: reduce }), false);
  assert.equal(initialMotion({ stored: true, query: motion }), true);
});

test('haptics default on and stay off when reduced motion is on', () => {
  assert.equal(initialHaptics({ stored: null }), true);
  assert.equal(initialHaptics({ stored: false }), false);
  assert.equal(shouldVibrate({ enabled: true, reducedMotion: false, supported: true }), true);
  assert.equal(shouldVibrate({ enabled: true, reducedMotion: true, supported: true }), false);
  assert.equal(shouldVibrate({ enabled: false, reducedMotion: false, supported: true }), false);
  assert.equal(shouldVibrate({ enabled: true, reducedMotion: false, supported: false }), false);
});
