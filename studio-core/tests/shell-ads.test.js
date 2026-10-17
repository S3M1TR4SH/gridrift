import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdMobAdapter } from '../ads/admob/adapter.js';
import { createCapacitorAdMobBridge } from '../ads/admob/capacitor.js';
import { GOOGLE_TEST_ADS } from '../ads/admob/demo-units.js';
import { createH5GamesAdsAdapter } from '../ads/h5/adapter.js';
import { createGuardedAds } from '../ads/guard.js';
import { createNoopAdapter } from '../ads/noop.js';
import { createPacer } from '../pacing/pacer.js';

const pacing = {
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

function pacer(isChild = false) {
  return createPacer({ pacing, now: () => 0, isChild: () => isChild });
}

test('noop never shows and does not pretend an ad ran', () => {
  const ads = createGuardedAds({ adapter: createNoopAdapter(), pacer: pacer() });
  assert.equal(ads.id, 'noop');
  assert.deepEqual(ads.showInterstitial({ breakType: 'between_rounds' }), {
    shown: false,
    rewarded: false,
    reason: 'noop'
  });
  assert.equal(ads.showRewarded({ placement: 'hint', optedIn: true }).reason, 'noop');
});

test('H5 Games Ads stays unloaded until a synchronous bridge exists', () => {
  const unloaded = createGuardedAds({ adapter: createH5GamesAdsAdapter(), pacer: pacer() });
  assert.equal(unloaded.showInterstitial({ breakType: 'game_over' }).reason, 'sdk_not_loaded');
  const calls = [];
  const host = {
    __studioH5Ads: {
      synchronous: true,
      adBreak(request) {
        calls.push(request);
        return { shown: true, rewarded: request.type === 'reward', reason: 'bridge' };
      }
    }
  };
  const ads = createGuardedAds({ adapter: createH5GamesAdsAdapter({ host }), pacer: pacer() });
  assert.equal(ads.showInterstitial({ breakType: 'gameplay' }).reason, 'guardrail');
  assert.equal(calls.length, 0);
  assert.equal(ads.showInterstitial({ breakType: 'between_rounds' }).shown, true);
  assert.deepEqual(calls[0], { type: 'browse', name: 'between_rounds' });
  const promised = {
    __studioH5Ads: {
      synchronous: true,
      adBreak() {
        return Promise.resolve({ shown: true, rewarded: true });
      }
    }
  };
  const blocked = createGuardedAds({ adapter: createH5GamesAdsAdapter({ host: promised }), pacer: pacer() });
  assert.equal(blocked.showRewarded({ placement: 'continue', optedIn: true }).reason, 'async_blocked');
});

test('Capacitor AdMob uses demo units only on a synchronous plugin', () => {
  const missing = createAdMobAdapter({ bridge: createCapacitorAdMobBridge({}) });
  assert.equal(missing.showInterstitial().reason, 'bridge_unavailable');
  const calls = [];
  const host = {
    Capacitor: {
      Plugins: {
        AdMob: {
          synchronous: true,
          showInterstitial(request) {
            calls.push(request);
            return { shown: true, rewarded: false, reason: 'bridge' };
          },
          showRewarded(request) {
            calls.push(request);
            return { shown: true, rewarded: true, reason: 'bridge' };
          }
        }
      }
    }
  };
  const ads = createGuardedAds({
    adapter: createAdMobAdapter({ bridge: createCapacitorAdMobBridge(host) }),
    pacer: pacer()
  });
  assert.equal(ads.showInterstitial({ breakType: 'between_rounds' }).shown, true);
  assert.equal(calls[0].adUnitId, GOOGLE_TEST_ADS.interstitial);
  const asyncHost = {
    Capacitor: {
      Plugins: {
        AdMob: {
          synchronous: true,
          showInterstitial() {
            return Promise.resolve({ shown: true, rewarded: false });
          },
          showRewarded() {
            return Promise.resolve({ shown: true, rewarded: true });
          }
        }
      }
    }
  };
  const blocked = createGuardedAds({
    adapter: createAdMobAdapter({ bridge: createCapacitorAdMobBridge(asyncHost) }),
    pacer: pacer()
  });
  assert.equal(blocked.showRewarded({ placement: 'hint', optedIn: true }).reason, 'async_blocked');
  const child = createGuardedAds({
    adapter: createAdMobAdapter({ bridge: createCapacitorAdMobBridge(host) }),
    pacer: pacer(true)
  });
  assert.equal(child.showInterstitial({ breakType: 'game_over' }).reason, 'guardrail');
  assert.equal(calls.length, 1);
});
