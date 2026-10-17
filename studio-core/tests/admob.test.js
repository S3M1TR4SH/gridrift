import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAdMobAdapter } from '../ads/admob/adapter.js';
import { GOOGLE_TEST_ADS } from '../ads/admob/demo-units.js';
import { createWebAdBridge } from '../ads/bridge.js';
import { createGuardedAds } from '../ads/guard.js';
import { createPacer } from '../pacing/pacer.js';

const adsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'ads');

const OFFICIAL = {
  publisherId: '3940256099942544',
  appId: 'ca-app-pub-3940256099942544~3347511713',
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
  native: 'ca-app-pub-3940256099942544/2247696110'
};

function pacing() {
  return {
    ads: {
      personalized: false,
      interstitial: {
        enabled: true,
        breaks: ['game_over', 'between_rounds'],
        minSecondsBetween: 60,
        minRoundsBetween: 1,
        maxPerSession: 3
      },
      rewarded: {
        enabled: true,
        optInOnly: true,
        placements: ['continue', 'hint'],
        maxPerSession: 3,
        minSecondsBetween: 45
      }
    },
    privacy: { childrenAdsAllowed: false }
  };
}

function session({ child = false, bridge } = {}) {
  let now = 1_000_000;
  const calls = [];
  const host = bridge
    ? {
      __studioAdsBridge: {
        showInterstitial(request) {
          calls.push({ method: 'interstitial', request });
          return { shown: true, rewarded: false, reason: 'bridge' };
        },
        showRewarded(request) {
          calls.push({ method: 'rewarded', request });
          return { shown: true, rewarded: true, reason: 'bridge' };
        }
      }
    }
    : {};
  const ads = createGuardedAds({
    adapter: createAdMobAdapter({ bridge: createWebAdBridge(host) }),
    pacer: createPacer({ pacing: pacing(), now: () => now, isChild: () => child })
  });
  return { ads, calls, advance: (ms) => { now += ms; } };
}

function walkJs(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walkJs(full));
    else if (full.endsWith('.js')) files.push(full);
  }
  return files;
}

test('google demo units are the only ad ids, and the web bridge does not load them', () => {
  assert.deepEqual(GOOGLE_TEST_ADS, OFFICIAL);
  assert.equal(Object.isFrozen(GOOGLE_TEST_ADS), true);
  let fetchCalls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error('network');
  };
  try {
    const web = session();
    assert.equal(web.ads.id, 'admob');
    assert.deepEqual(web.ads.showInterstitial({ breakType: 'between_rounds' }), {
      shown: false,
      rewarded: false,
      reason: 'bridge_unavailable'
    });
    assert.equal(fetchCalls, 0);
    assert.equal(web.calls.length, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test('guardrails block the bridge for children, bad breaks, and missing opt-in', () => {
  const child = session({ child: true, bridge: true });
  assert.deepEqual(child.ads.showInterstitial({ breakType: 'between_rounds' }), {
    shown: false,
    rewarded: false,
    reason: 'guardrail'
  });
  assert.deepEqual(child.ads.showRewarded({ placement: 'continue', optedIn: true }), {
    shown: false,
    rewarded: false,
    reason: 'guardrail'
  });
  assert.equal(child.calls.length, 0);

  const adult = session({ bridge: true });
  assert.equal(adult.ads.showInterstitial({ breakType: 'gameplay' }).reason, 'guardrail');
  assert.equal(adult.ads.showRewarded({ placement: 'continue', optedIn: false }).reason, 'opt_in_required');
  assert.equal(adult.calls.length, 0);

  const shown = adult.ads.showInterstitial({ breakType: 'between_rounds' });
  assert.deepEqual(shown, { shown: true, rewarded: false, reason: 'bridge' });
  assert.deepEqual(adult.calls[0].request, {
    format: 'interstitial',
    appId: OFFICIAL.appId,
    adUnitId: OFFICIAL.interstitial
  });
  adult.advance(120_000);
  const reward = adult.ads.showRewarded({ placement: 'hint', optedIn: true });
  assert.deepEqual(reward, { shown: true, rewarded: true, reason: 'bridge' });
  assert.equal(adult.calls[1].request.adUnitId, OFFICIAL.rewarded);
});

test('a promised bridge result is not treated as a shown ad', () => {
  const host = {
    __studioAdsBridge: {
      showInterstitial() {
        return Promise.resolve({ shown: true, rewarded: false });
      },
      showRewarded() {
        return { shown: true, rewarded: true };
      }
    }
  };
  const ads = createGuardedAds({
    adapter: createAdMobAdapter({ bridge: createWebAdBridge(host) }),
    pacer: createPacer({ pacing: pacing(), now: () => 0, isChild: () => false })
  });
  assert.deepEqual(ads.showInterstitial({ breakType: 'game_over' }), {
    shown: false,
    rewarded: false,
    reason: 'async_blocked'
  });
});

test('ad modules do not reference a network client or another publisher', () => {
  const sources = walkJs(adsRoot).map((file) => readFileSync(file, 'utf8'));
  assert.ok(sources.length >= 4);
  for (const source of sources) {
    assert.equal(source.includes('fetch('), false);
    assert.equal(source.includes('XMLHttpRequest'), false);
    assert.equal(source.includes('sendBeacon'), false);
    assert.equal(source.includes('WebSocket'), false);
    assert.equal(/https?:\/\//i.test(source), false);
    assert.equal(source.includes('play-services-ads'), false);
    assert.equal(/gridrift/i.test(source), false);
    const publishers = source.match(/ca-app-pub-\d+/g) ?? [];
    for (const id of publishers) {
      assert.equal(id, 'ca-app-pub-3940256099942544');
    }
  }
});
