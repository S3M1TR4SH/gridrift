export function createNoopAdapter() {
  return {
    id: 'noop',
    showInterstitial() {
      return { shown: false, rewarded: false, reason: 'noop' };
    },
    showRewarded() {
      return { shown: false, rewarded: false, reason: 'noop' };
    }
  };
}
