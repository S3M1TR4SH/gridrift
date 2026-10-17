const BRIDGE_KEY = '__studioAdsBridge';

function nativeBridge(host) {
  const bridge = host && host[BRIDGE_KEY];
  if (!bridge || typeof bridge.showInterstitial !== 'function' || typeof bridge.showRewarded !== 'function') {
    return null;
  }
  return bridge;
}

/**
 * Native shells can install a synchronous bridge on the host object.
 * A normal browser, including a Trusted Web Activity, has no bridge.
 * Calls then return without loading an ad SDK.
 */
export function createWebAdBridge(host = globalThis) {
  return {
    get available() {
      return nativeBridge(host) !== null;
    },
    showInterstitial(request) {
      const bridge = nativeBridge(host);
      if (!bridge) return { shown: false, rewarded: false, reason: 'bridge_unavailable' };
      return bridge.showInterstitial(request);
    },
    showRewarded(request) {
      const bridge = nativeBridge(host);
      if (!bridge) return { shown: false, rewarded: false, reason: 'bridge_unavailable' };
      return bridge.showRewarded(request);
    }
  };
}
