import { createWebAdBridge } from '../bridge.js';
import { GOOGLE_TEST_ADS } from './demo-units.js';

export function createAdMobAdapter({ bridge = createWebAdBridge(), childDirected = () => false } = {}) {
  function extras() {
    if (!childDirected()) return {};
    return {
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
      npa: true
    };
  }

  return {
    id: 'admob',
    showInterstitial() {
      if (!bridge.available) return { shown: false, rewarded: false, reason: 'bridge_unavailable' };
      return bridge.showInterstitial({
        format: 'interstitial',
        appId: GOOGLE_TEST_ADS.appId,
        adUnitId: GOOGLE_TEST_ADS.interstitial,
        ...extras()
      });
    },
    showRewarded() {
      if (!bridge.available) return { shown: false, rewarded: false, reason: 'bridge_unavailable' };
      return bridge.showRewarded({
        format: 'rewarded',
        appId: GOOGLE_TEST_ADS.appId,
        adUnitId: GOOGLE_TEST_ADS.rewarded,
        ...extras()
      });
    }
  };
}
