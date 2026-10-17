import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MIXPANEL_INIT_OPTIONS, MIXPANEL_SDK_SRC, createMixpanelAdapter } from '../analytics/adapters/mixpanel.js';
import { createEvent } from '../analytics/schema.js';
import { createTracker } from '../analytics/tracker.js';

const here = dirname(fileURLToPath(import.meta.url));

function fakeClient() {
  const calls = [];
  return {
    calls,
    init(token, options) {
      calls.push({ method: 'init', token, options });
    },
    opt_in_tracking() {
      calls.push({ method: 'opt_in_tracking' });
    },
    opt_out_tracking() {
      calls.push({ method: 'opt_out_tracking' });
    },
    track(name, props) {
      calls.push({ method: 'track', name, props });
    },
    identify() {
      calls.push({ method: 'identify' });
    },
    people: {
      set() {
        calls.push({ method: 'people.set' });
      }
    }
  };
}

function harness(consentState) {
  const box = { consent: consentState };
  const client = fakeClient();
  let loads = 0;
  let release = null;
  const gate = {};
  gate.pending = new Promise((resolve) => {
    release = resolve;
  });
  const adapter = createMixpanelAdapter({
    token: 'test-token-public',
    loadSdk() {
      loads += 1;
      return gate.pending.then(() => client);
    }
  });
  const tracker = createTracker({
    getConsent: () => box.consent,
    now: () => 7,
    adapter
  });
  return {
    box,
    client,
    tracker,
    adapter,
    loads: () => loads,
    release: () => release()
  };
}

test('the sdk script is not requested until start, and never before consent', async () => {
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error('network');
  };
  const previousDoc = globalThis.document;
  const scripts = [];
  globalThis.document = {
    createElement() {
      return {};
    },
    head: {
      appendChild(node) {
        scripts.push(node);
      }
    }
  };
  try {
    const href = new URL('../analytics/adapters/mixpanel.js', import.meta.url).href;
    const mod = await import(`${href}?side=import`);
    const idle = mod.createMixpanelAdapter({
      token: 'test-token-public',
      loadSdk() {
        throw new Error('load should not run');
      }
    });
    idle.track({ v: 1, name: 'session_start', props: {} });
    assert.deepEqual(idle.revoke(), { ok: true, reason: 'not_loaded' });
    assert.equal(scripts.length, 0);

    const adapter = createMixpanelAdapter({ token: 'test-token-public' });
    assert.equal(scripts.length, 0);
    const pending = adapter.start();
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, MIXPANEL_SDK_SRC);
    assert.equal(scripts[0].async, true);
    scripts[0].onerror();
    assert.deepEqual(await pending, { ok: false, reason: 'sdk_failed' });

    const session = harness(null);
    assert.deepEqual(await session.tracker.sync(), { ok: true, reason: 'not_loaded' });
    assert.deepEqual(session.tracker.track('session_start', {}), { ok: false, reason: 'no_consent' });
    session.box.consent = { isChild: false, analyticsAllowed: false };
    assert.deepEqual(await session.tracker.sync(), { ok: true, reason: 'not_loaded' });
    assert.equal(session.loads(), 0);
    assert.equal(session.client.calls.length, 0);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(session.tracker.transmit(), { sent: 0, reason: 'network_disabled' });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.document = previousDoc;
  }
});

test('players under 13 never load the sdk, even if analytics is forced on', async () => {
  const session = harness({ isChild: true, analyticsAllowed: true });
  assert.deepEqual(await session.tracker.sync(), { ok: true, reason: 'child' });
  assert.deepEqual(session.tracker.track('session_start', {}), { ok: false, reason: 'no_consent' });
  session.box.consent = { isChild: false, analyticsAllowed: true };
  assert.deepEqual(await session.tracker.sync(), { ok: false, reason: 'child' });
  assert.deepEqual(await session.adapter.start(), { ok: false, reason: 'child' });
  assert.equal(session.loads(), 0);
  assert.equal(session.client.calls.length, 0);
});

test('consented events map onto the standard schema without identity or capture', async () => {
  const session = harness({ isChild: false, analyticsAllowed: true });
  const starting = session.tracker.sync();
  const queued = session.tracker.track('piece_placed', { cells: 4, combo: false });
  assert.equal(queued.ok, true);
  assert.equal(session.client.calls.some((call) => call.method === 'track'), false);
  session.release();
  assert.deepEqual(await starting, { ok: true, reason: 'started' });

  const init = session.client.calls.find((call) => call.method === 'init');
  assert.equal(init.token, 'test-token-public');
  assert.deepEqual(init.options, { ...MIXPANEL_INIT_OPTIONS });
  assert.equal(init.options.ip, false);
  assert.equal(init.options.autocapture, false);
  assert.equal(init.options.track_pageview, false);
  assert.equal(init.options.record_sessions_percent, 0);
  assert.equal(init.options.record_heatmap_data, false);
  assert.equal(init.options.opt_out_tracking_by_default, true);
  assert.equal(session.client.calls.some((call) => call.method === 'opt_in_tracking'), true);

  const tracked = session.client.calls.find((call) => call.method === 'track');
  const expected = createEvent('piece_placed', { cells: 4, combo: false }, () => 7);
  assert.equal(tracked.name, expected.name);
  assert.deepEqual(tracked.props, { ...expected.props, schema_version: expected.v });
  assert.equal(session.client.calls.some((call) => call.method === 'identify' || call.method === 'people.set'), false);
  assert.equal(session.loads(), 1);
  assert.deepEqual(session.tracker.transmit(), { sent: 0, reason: 'network_disabled' });
});

test('withdrawing consent calls opt_out_tracking and drops later events', async () => {
  const session = harness({ isChild: false, analyticsAllowed: true });
  const starting = session.tracker.sync();
  session.release();
  await starting;
  session.box.consent = { isChild: false, analyticsAllowed: false };
  assert.deepEqual(await session.tracker.sync(), { ok: true, reason: 'opt_out_tracking' });
  assert.equal(session.client.calls.filter((call) => call.method === 'opt_out_tracking').length, 1);
  assert.deepEqual(session.tracker.track('restart', {}), { ok: false, reason: 'no_consent' });
  assert.equal(session.client.calls.filter((call) => call.method === 'track').length, 0);
  assert.equal(session.loads(), 1);
});

test('a provider payload cannot carry pii, reserved prefixes, or a profile', async () => {
  const client = fakeClient();
  const adapter = createMixpanelAdapter({
    token: 'test-token-public',
    loadSdk: () => Promise.resolve(client)
  });
  await adapter.start();
  adapter.track({
    v: 1,
    name: 'piece_placed',
    props: {
      cells: 2,
      email: 'a@b.c',
      $name: 'Ada',
      mp_country_code: 'US',
      distinct_id: 'person-1',
      note: null
    }
  });
  const tracked = client.calls.find((call) => call.method === 'track');
  assert.deepEqual(tracked.props, { cells: 2, schema_version: 1 });
  assert.equal(client.calls.some((call) => call.method === 'identify' || call.method === 'people.set'), false);
  assert.throws(() => createEvent('piece_placed', { email: 'a@b.c' }));
  assert.throws(() => createEvent('piece_placed', { $name: 'Ada' }));
  assert.throws(() => createEvent('piece_placed', { mp_country_code: 'US' }));
});

test('the adapter source stays provider-local and does not embed a project token', () => {
  const source = readFileSync(join(here, '..', 'analytics', 'adapters', 'mixpanel.js'), 'utf8');
  const tracker = readFileSync(join(here, '..', 'analytics', 'tracker.js'), 'utf8');
  assert.equal(source.includes('ed836db273f067452e974889de916e74'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
  assert.equal(source.includes('sendBeacon'), false);
  assert.equal(/\bidentify\s*\(/.test(source), false);
  assert.equal(/people\.set\s*\(/.test(source), false);
  assert.equal(/gridrift/i.test(source), false);
  assert.equal(tracker.includes('mixpanel'), false);
  assert.equal(tracker.includes('fetch('), false);
  assert.equal(Object.isFrozen(MIXPANEL_INIT_OPTIONS), true);
});
