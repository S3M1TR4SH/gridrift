import { createEvent } from './schema.js';

/**
 * In-memory analytics. Events are dropped until consent allows them.
 * Nothing is transmitted. There is no network path in this module.
 */
export function createTracker({ getConsent = () => null, now = () => Date.now() } = {}) {
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
      return { ok: true, event };
    },
    snapshot() {
      return events.slice();
    },
    transmit() {
      return { sent: 0, reason: 'network_disabled' };
    }
  };
}
