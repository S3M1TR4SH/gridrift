export function assertAdapter(adapter) {
  if (!adapter || typeof adapter.id !== 'string' || !adapter.id) {
    throw new Error('ad adapter id is required');
  }
  if (typeof adapter.showInterstitial !== 'function' || typeof adapter.showRewarded !== 'function') {
    throw new Error('ad adapter must implement showInterstitial and showRewarded');
  }
  return adapter;
}
