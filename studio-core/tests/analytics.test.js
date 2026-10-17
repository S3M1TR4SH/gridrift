import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ANALYTICS_SCHEMA_VERSION, createEvent } from '../analytics/schema.js';
import { createTracker } from '../analytics/tracker.js';

const here = dirname(fileURLToPath(import.meta.url));

test('schema is one versioned event shape and rejects secrets', () => {
  let now = 10;
  const event = createEvent('piece_placed', { cells: 4, combo: false }, () => now);
  assert.equal(event.v, ANALYTICS_SCHEMA_VERSION);
  assert.equal(event.name, 'piece_placed');
  assert.equal(event.ts, 10);
  assert.deepEqual(event.props, { cells: 4, combo: false });
  assert.throws(() => createEvent('raw_click', {}));
  assert.throws(() => createEvent('piece_placed', { email: 'a@b.c' }));
  assert.throws(() => createEvent('piece_placed', { advertisingId: 'abc' }));
});

test('nothing is recorded or sent before consent', () => {
  let fetchCalls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error('network');
  };
  try {
    const tracker = createTracker({ getConsent: () => null, now: () => 1 });
    const dropped = tracker.track('session_start', {});
    assert.deepEqual(dropped, { ok: false, reason: 'no_consent' });
    assert.deepEqual(tracker.snapshot(), []);
    const child = createTracker({
      getConsent: () => ({ isChild: true, analyticsAllowed: true }),
      now: () => 1
    });
    child.track('session_start', {});
    assert.deepEqual(child.snapshot(), []);
    assert.deepEqual(tracker.transmit(), { sent: 0, reason: 'network_disabled' });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('consented events stay on device', () => {
  const tracker = createTracker({
    getConsent: () => ({ isChild: false, analyticsAllowed: true }),
    now: () => 42
  });
  const recorded = tracker.track('game_over', { score: 20 });
  assert.equal(recorded.ok, true);
  assert.equal(tracker.snapshot().length, 1);
  assert.equal(tracker.snapshot()[0].name, 'game_over');
  assert.deepEqual(tracker.transmit(), { sent: 0, reason: 'network_disabled' });
});

test('analytics modules do not reference a network client', () => {
  const schema = readFileSync(join(here, '..', 'analytics', 'schema.js'), 'utf8');
  const tracker = readFileSync(join(here, '..', 'analytics', 'tracker.js'), 'utf8');
  for (const source of [schema, tracker]) {
    assert.equal(source.includes('fetch('), false);
    assert.equal(source.includes('XMLHttpRequest'), false);
    assert.equal(source.includes('sendBeacon'), false);
    assert.equal(source.includes('WebSocket'), false);
    assert.equal(source.includes('localStorage'), false);
  }
});
