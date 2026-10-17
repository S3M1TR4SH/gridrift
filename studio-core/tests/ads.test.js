import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createGuardedAds } from '../ads/guard.js';
import { createPlaceholderAdapter } from '../ads/placeholder.js';
import { createCrazyGamesAdapter } from '../ads/crazygames/adapter.js';
import { createGameDistributionAdapter } from '../ads/gamedistribution/adapter.js';
import { createPlaygamaAdapter } from '../ads/playgama/adapter.js';
import { createPokiAdapter } from '../ads/poki/adapter.js';
import { createPacer } from '../pacing/pacer.js';

const here = dirname(fileURLToPath(import.meta.url));
const validPacing = JSON.parse(readFileSync(join(here, 'fixtures', 'valid-pacing.json'), 'utf8'));

function pacerAt(isChild = false) {
  let now = 1_000_000;
  const pacer = createPacer({ pacing: validPacing, now: () => now, isChild: () => isChild });
  return {
    pacer,
    advance(ms) {
      now += ms;
    }
  };
}

function spy(adapter) {
  const calls = [];
  return {
    id: adapter.id,
    calls,
    showInterstitial(request) {
      calls.push(['interstitial', request.breakType]);
      return adapter.showInterstitial(request);
    },
    showRewarded(request) {
      calls.push(['rewarded', request.placement]);
      return adapter.showRewarded(request);
    }
  };
}

const factories = [
  createPlaceholderAdapter,
  createPokiAdapter,
  createCrazyGamesAdapter,
  createGameDistributionAdapter,
  createPlaygamaAdapter
];

test('the default adapter is the local placeholder', () => {
  const { pacer } = pacerAt();
  pacer.recordRoundEnded();
  const ads = createGuardedAds({ pacer });
  assert.equal(ads.id, 'placeholder');
  const shown = ads.showInterstitial({ breakType: 'between_rounds' });
  assert.equal(shown.shown, true);
  assert.equal(shown.rewarded, false);
  assert.equal(shown.reason, 'placeholder');
  assert.equal(pacer.snapshot().interstitialsShown, 1);
});

test('every adapter is refused outside a natural break and without opt-in', () => {
  for (const create of factories) {
    const adapter = spy(create());
    const { pacer } = pacerAt();
    pacer.recordRoundEnded();
    const ads = createGuardedAds({ adapter, pacer });
    for (const breakType of ['gameplay', 'start', 'pause', 'on_fail']) {
      const blocked = ads.showInterstitial({ breakType });
      assert.equal(blocked.shown, false, `${adapter.id} ${breakType}`);
      assert.equal(blocked.reason, 'guardrail');
    }
    const reward = ads.showRewarded({ placement: 'continue', optedIn: false });
    assert.equal(reward.rewarded, false);
    assert.equal(reward.reason, 'opt_in_required');
    const banner = ads.showRewarded({ placement: 'banner', optedIn: true });
    assert.equal(banner.reason, 'guardrail');
    assert.deepEqual(adapter.calls, []);
    assert.equal(pacer.snapshot().interstitialsShown, 0);
    assert.equal(pacer.snapshot().rewardedShown, 0);
  }
});

test('guardrails cap interstitials and rewarded grants for every adapter', () => {
  for (const create of factories) {
    const adapter = spy(create());
    const clock = pacerAt();
    const ads = createGuardedAds({ adapter, pacer: clock.pacer });
    clock.pacer.recordRoundEnded();
    assert.equal(ads.showInterstitial({ breakType: 'gameplay' }).reason, 'guardrail');
    assert.equal(ads.showRewarded({ placement: 'continue', optedIn: false }).reason, 'opt_in_required');
    const first = ads.showInterstitial({ breakType: 'game_over' });
    if (adapter.id === 'placeholder') {
      assert.equal(first.shown, true);
      assert.equal(first.rewarded, false);
      assert.equal(ads.showInterstitial({ breakType: 'between_rounds' }).reason, 'guardrail');
      clock.advance(validPacing.ads.interstitial.minSecondsBetween * 1000);
      clock.pacer.recordRoundEnded();
      clock.pacer.recordRoundEnded();
      assert.equal(ads.showRewarded({ placement: 'hint', optedIn: true }).rewarded, true);
      assert.equal(ads.showRewarded({ placement: 'continue', optedIn: true }).reason, 'guardrail');
      clock.advance(validPacing.ads.interstitial.minSecondsBetween * 1000);
      clock.pacer.recordRoundEnded();
      clock.pacer.recordRoundEnded();
      assert.equal(ads.showInterstitial({ breakType: 'between_rounds' }).shown, true);
      assert.equal(adapter.calls.filter((call) => call[0] === 'rewarded').length, 1);
    } else {
      assert.equal(first.shown, false);
      assert.equal(first.reason, 'sdk_not_loaded');
      assert.equal(ads.showRewarded({ placement: 'hint', optedIn: true }).reason, 'sdk_not_loaded');
      assert.equal(clock.pacer.snapshot().interstitialsShown, 0);
      assert.equal(clock.pacer.snapshot().rewardedShown, 0);
    }
    assert.equal(adapter.calls.some((call) => call[1] === 'gameplay'), false);
  }
});

test('children never reach an adapter', () => {
  for (const create of factories) {
    const adapter = spy(create());
    const { pacer } = pacerAt(true);
    pacer.recordRoundEnded();
    const ads = createGuardedAds({ adapter, pacer });
    assert.equal(ads.showInterstitial({ breakType: 'game_over' }).reason, 'guardrail');
    assert.equal(ads.showRewarded({ placement: 'continue', optedIn: true }).reason, 'guardrail');
    assert.deepEqual(adapter.calls, []);
  }
});

test('a promise from an adapter is not treated as a shown ad', () => {
  let fetches = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = () => {
    fetches += 1;
    return Promise.resolve();
  };
  try {
    const { pacer } = pacerAt();
    pacer.recordRoundEnded();
    const ads = createGuardedAds({
      pacer,
      adapter: {
        id: 'lazy',
        showInterstitial() {
          return Promise.resolve({ shown: true, rewarded: true });
        },
        showRewarded() {
          return Promise.resolve({ shown: true, rewarded: true });
        }
      }
    });
    assert.equal(ads.showInterstitial({ breakType: 'between_rounds' }).reason, 'async_blocked');
    assert.equal(ads.showRewarded({ placement: 'continue', optedIn: true }).reason, 'async_blocked');
    assert.equal(pacer.snapshot().interstitialsShown, 0);
    assert.equal(pacer.snapshot().rewardedShown, 0);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('ad modules do not reference a network client or a remote sdk', () => {
  const root = join(here, '..', 'ads');
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.js')) files.push(full);
    }
  }
  walk(root);
  assert.ok(files.length >= 8);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes('fetch('), false, file);
    assert.equal(source.includes('XMLHttpRequest'), false, file);
    assert.equal(source.includes('sendBeacon'), false, file);
    assert.equal(source.includes('WebSocket'), false, file);
    assert.equal(source.includes('importScripts'), false, file);
    assert.equal(/https?:\/\//i.test(source), false, file);
    assert.equal(source.includes('createElement'), false, file);
  }
});
