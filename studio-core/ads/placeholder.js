export function createPlaceholderAdapter() {
  return {
    id: 'placeholder',
    showInterstitial() {
      return { shown: true, rewarded: false, reason: 'placeholder' };
    },
    showRewarded() {
      return { shown: true, rewarded: true, reason: 'placeholder' };
    }
  };
}
