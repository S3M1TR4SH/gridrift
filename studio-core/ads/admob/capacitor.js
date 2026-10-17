import { createWebAdBridge } from '../bridge.js';

function settle(result) {
  if (result && typeof result.then === 'function') {
    return { shown: false, rewarded: false, reason: 'async_blocked' };
  }
  return result;
}

/**
 * AdMob through a Capacitor plugin object on the host.
 * The community plugin returns promises. Those are not a valid show,
 * and this bridge only calls a plugin that sets `synchronous: true`.
 * Otherwise it uses the same synchronous `__studioAdsBridge` a
 * Capacitor shell can install. No Mobile Ads SDK is loaded here.
 */
export function createCapacitorAdMobBridge(host = globalThis) {
  const plugin = host?.Capacitor?.Plugins?.AdMob;
  if (
    plugin?.synchronous === true
    && typeof plugin.showInterstitial === 'function'
    && typeof plugin.showRewarded === 'function'
  ) {
    return {
      get available() {
        return true;
      },
      showInterstitial(request) {
        return settle(plugin.showInterstitial(request));
      },
      showRewarded(request) {
        return settle(plugin.showRewarded(request));
      }
    };
  }
  return createWebAdBridge(host);
}
