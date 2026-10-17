const BRIDGE_KEY = '__studioH5Ads';

function synchronousBridge(host) {
  const candidate = host && host[BRIDGE_KEY];
  if (!candidate || candidate.synchronous !== true || typeof candidate.adBreak !== 'function') {
    return null;
  }
  return candidate;
}

function settle(result) {
  if (result && typeof result.then === 'function') {
    return { shown: false, rewarded: false, reason: 'async_blocked' };
  }
  if (!result || typeof result !== 'object') {
    return { shown: false, rewarded: false, reason: 'sdk_not_loaded' };
  }
  return {
    shown: Boolean(result.shown),
    rewarded: Boolean(result.rewarded),
    reason: typeof result.reason === 'string' ? result.reason : 'shown'
  };
}

/**
 * Google H5 Games Ads behind a synchronous host bridge.
 * This module does not load a tag. The host may install `__studioH5Ads`
 * only after a consent decision, and only if `adBreak` returns a plain
 * object. A promise is discarded so a tag cannot hide a request.
 */
export function createH5GamesAdsAdapter({ host = globalThis, childDirected = () => false } = {}) {
  function request(base) {
    if (!childDirected()) return base;
    return { ...base, nonPersonalized: true, childDirected: true };
  }

  return {
    id: 'h5-games-ads',
    showInterstitial({ breakType } = {}) {
      const bridge = synchronousBridge(host);
      if (!bridge) return { shown: false, rewarded: false, reason: 'sdk_not_loaded' };
      return settle(bridge.adBreak(request({ type: 'browse', name: breakType })));
    },
    showRewarded({ placement } = {}) {
      const bridge = synchronousBridge(host);
      if (!bridge) return { shown: false, rewarded: false, reason: 'sdk_not_loaded' };
      return settle(bridge.adBreak(request({ type: 'reward', name: placement })));
    }
  };
}
