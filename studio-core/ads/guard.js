import { assertAdapter } from './contract.js';
import { createPlaceholderAdapter } from './placeholder.js';

function settle(result) {
  if (result && typeof result.then === 'function') {
    return { shown: false, rewarded: false, reason: 'async_blocked' };
  }
  return {
    shown: Boolean(result?.shown),
    rewarded: Boolean(result?.rewarded),
    reason: typeof result?.reason === 'string' ? result.reason : 'shown'
  };
}

export function createGuardedAds({ adapter, pacer } = {}) {
  if (!pacer || typeof pacer.canShowInterstitial !== 'function' || typeof pacer.recordAd !== 'function') {
    throw new Error('ad guard requires a pacer');
  }
  const inner = assertAdapter(adapter ?? createPlaceholderAdapter());

  return {
    get id() {
      return inner.id;
    },
    canShowInterstitial(breakType) {
      return pacer.canShowInterstitial(breakType);
    },
    canOfferRewarded(placement) {
      return pacer.canOfferRewarded(placement);
    },
    showInterstitial({ breakType } = {}) {
      if (typeof pacer.consumeInterstitialSkip === 'function' && pacer.consumeInterstitialSkip(breakType)) {
        return { shown: false, rewarded: false, reason: 'rewarded_skip' };
      }
      if (!pacer.canShowInterstitial(breakType)) {
        return { shown: false, rewarded: false, reason: 'guardrail' };
      }
      const result = settle(inner.showInterstitial({ breakType }));
      if (result.reason === 'async_blocked') return result;
      if (result.shown) pacer.recordAd('interstitial');
      return { shown: result.shown, rewarded: false, reason: result.reason };
    },
    showRewarded({ placement, optedIn } = {}) {
      if (optedIn !== true) {
        return { shown: false, rewarded: false, reason: 'opt_in_required' };
      }
      if (!pacer.canOfferRewarded(placement)) {
        return { shown: false, rewarded: false, reason: 'guardrail' };
      }
      const result = settle(inner.showRewarded({ placement }));
      if (result.reason === 'async_blocked') {
        return { shown: false, rewarded: false, reason: 'async_blocked' };
      }
      if (result.shown) pacer.recordAd('rewarded');
      return {
        shown: result.shown,
        rewarded: result.shown && result.rewarded,
        reason: result.reason
      };
    }
  };
}
