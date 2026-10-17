import { createEvent } from './schema.js';

/**
 * In-memory analytics. Events are dropped until consent allows them.
 * This module does not load a provider or open a network connection.
 * The host may pass an adapter. sync() starts that adapter only after
 * adult consent, and blocks it forever when the player is under 13.
 */
export function createTracker({ getConsent = () => null, now = () => Date.now(), adapter = null } = {}) {
  const events = [];

  function allowed() {
    const consent = getConsent();
    if (!consent || consent.isChild || !consent.analyticsAllowed) return false;
    return true;
  }

  return {
    track(name, props) {
      if (!allowed()) return { ok: false, reason: 'no_consent' };
      const event = createEvent(name, props, now);
      events.push(event);
      if (adapter && typeof adapter.track === 'function') adapter.track(event);
      return { ok: true, event };
    },
    snapshot() {
      return events.slice();
    },
    transmit() {
      return { sent: 0, reason: 'network_disabled' };
    },
    sync() {
      if (!adapter) return { ok: true, reason: 'no_adapter' };
      const consent = getConsent();
      if (consent && consent.isChild) return adapter.block({ reason: 'child' });
      if (consent && consent.analyticsAllowed) return adapter.start();
      return adapter.revoke();
    }
  };
}
