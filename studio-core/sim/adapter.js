export const ADAPTER_METHODS = ['start', 'readState', 'listActions', 'perform', 'isGameOver', 'stop'];

export function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError('adapter must be an object');
  }
  for (const method of ADAPTER_METHODS) {
    if (typeof adapter[method] !== 'function') {
      throw new TypeError(`adapter.${method} must be a function`);
    }
  }
  return adapter;
}
