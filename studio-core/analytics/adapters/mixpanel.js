/**
 * Mixpanel browser adapter. The host passes the public project token.
 * This module does not read config and does not load the provider script
 * until start() runs after adult consent. Under-13 players call block()
 * and the script is never requested. No identify and no profile updates.
 */

export const MIXPANEL_SDK_SRC = 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';

export const MIXPANEL_INIT_OPTIONS = Object.freeze({
  ip: false,
  autocapture: false,
  track_pageview: false,
  record_sessions_percent: 0,
  record_heatmap_data: false,
  opt_out_tracking_by_default: true,
  persistence: 'localStorage',
  debug: false
});

const DROPPED_PROPS = new Set([
  'email',
  'name',
  'fullname',
  'firstname',
  'lastname',
  'phone',
  'address',
  'birthdate',
  'birthday',
  'advertisingid',
  'advertising_id',
  'idfa',
  'gaid',
  'ip',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'distinct_id',
  'userid',
  'user_id'
]);

function failure(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

export function defaultLoadSdk() {
  const doc = globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') {
    return Promise.reject(failure('no_document'));
  }
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.async = true;
    script.src = MIXPANEL_SDK_SRC;
    script.onload = () => {
      const client = globalThis.mixpanel;
      if (!client || typeof client.init !== 'function') {
        reject(failure('sdk_failed'));
        return;
      }
      resolve(client);
    };
    script.onerror = () => reject(failure('sdk_failed'));
    const parent = doc.head || doc.documentElement;
    if (!parent || typeof parent.appendChild !== 'function') {
      reject(failure('no_document'));
      return;
    }
    parent.appendChild(script);
  });
}

function providerProps(event) {
  const props = {};
  const source = event && event.props && typeof event.props === 'object' ? event.props : {};
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    const normalized = key.toLowerCase();
    if (key.startsWith('$') || normalized.startsWith('mp_')) continue;
    if (DROPPED_PROPS.has(normalized)) continue;
    props[key] = value;
  }
  if (event && typeof event.v === 'number') props.schema_version = event.v;
  return props;
}

export function createMixpanelAdapter({ token, loadSdk = defaultLoadSdk } = {}) {
  let blocked = false;
  let consentHeld = false;
  let client = null;
  let initialized = false;
  let optedIn = false;
  let starting = null;
  const queue = [];

  function hasToken() {
    return typeof token === 'string' && token.length >= 8;
  }

  function deliver(event) {
    if (!client || typeof client.track !== 'function' || !event || typeof event.name !== 'string') return;
    client.track(event.name, providerProps(event));
  }

  function flush() {
    const pending = queue.splice(0, queue.length);
    for (const event of pending) deliver(event);
  }

  function engage() {
    if (!client) return { ok: false, reason: 'sdk_failed' };
    if (blocked || !consentHeld) {
      optedIn = false;
      queue.length = 0;
      if (typeof client.opt_out_tracking === 'function') client.opt_out_tracking();
      return { ok: false, reason: blocked ? 'child' : 'revoked' };
    }
    if (!initialized) {
      client.init(token, { ...MIXPANEL_INIT_OPTIONS });
      initialized = true;
    }
    if (typeof client.opt_in_tracking === 'function') client.opt_in_tracking();
    optedIn = true;
    flush();
    return { ok: true, reason: 'started' };
  }

  function start() {
    if (blocked) return Promise.resolve({ ok: false, reason: 'child' });
    if (!hasToken()) return Promise.resolve({ ok: false, reason: 'missing_token' });
    consentHeld = true;
    if (client) return Promise.resolve(engage());
    if (starting) return starting;
    let pending;
    try {
      pending = loadSdk();
    } catch (error) {
      return Promise.resolve({ ok: false, reason: error && error.reason ? error.reason : 'sdk_failed' });
    }
    starting = Promise.resolve(pending)
      .then((loaded) => {
        if (!loaded || typeof loaded.init !== 'function') return { ok: false, reason: 'sdk_failed' };
        client = loaded;
        return engage();
      })
      .catch((error) => ({ ok: false, reason: error && error.reason ? error.reason : 'sdk_failed' }))
      .finally(() => {
        starting = null;
      });
    return starting;
  }

  function track(event) {
    if (blocked) return { ok: false, reason: 'child' };
    if (!consentHeld) return { ok: false, reason: 'no_consent' };
    if (!optedIn || !client) {
      queue.push(event);
      return { ok: true, reason: 'queued' };
    }
    deliver(event);
    return { ok: true, reason: 'tracked' };
  }

  function revoke() {
    if (blocked) return { ok: true, reason: 'child' };
    consentHeld = false;
    optedIn = false;
    queue.length = 0;
    if (!client) return { ok: true, reason: 'not_loaded' };
    if (typeof client.opt_out_tracking === 'function') client.opt_out_tracking();
    return { ok: true, reason: 'opt_out_tracking' };
  }

  function block() {
    blocked = true;
    consentHeld = false;
    optedIn = false;
    queue.length = 0;
    if (client && typeof client.opt_out_tracking === 'function') client.opt_out_tracking();
    return { ok: true, reason: 'child' };
  }

  return { start, track, revoke, block };
}
