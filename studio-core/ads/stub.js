export function createStubAdapter(id) {
  return {
    id,
    showInterstitial() {
      return { shown: false, rewarded: false, reason: 'sdk_not_loaded' };
    },
    showRewarded() {
      return { shown: false, rewarded: false, reason: 'sdk_not_loaded' };
    }
  };
}
