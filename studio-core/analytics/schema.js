export const ANALYTICS_SCHEMA_VERSION = 1;

export const EVENT_NAMES = Object.freeze([
  'first_open',
  'session_start',
  'consent_updated',
  'round_start',
  'piece_placed',
  'lines_cleared',
  'combo',
  'round_complete',
  'daily_complete',
  'game_over',
  'restart',
  'ad_break_shown',
  'ad_break_closed',
  'rewarded_offered',
  'rewarded_accepted',
  'rewarded_declined',
  'rewarded_completed',
  'install_prompted',
  'install_choice'
]);

const FORBIDDEN_PROP_KEYS = new Set([
  'email',
  'name',
  'fullname',
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
  'longitude'
]);

export function createEvent(name, props = {}, now = Date.now) {
  if (!EVENT_NAMES.includes(name)) {
    throw new Error(`Unknown analytics event: ${name}`);
  }
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    throw new Error('Analytics props must be an object');
  }
  const clean = {};
  for (const [key, value] of Object.entries(props)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_PROP_KEYS.has(normalized) || key.startsWith('$') || normalized.startsWith('mp_')) {
      throw new Error(`Forbidden analytics prop: ${key}`);
    }
    const type = typeof value;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      throw new Error(`Analytics prop ${key} must be a string, number, or boolean`);
    }
    if (type === 'string' && value.length > 80) {
      throw new Error(`Analytics prop ${key} is too long`);
    }
    clean[key] = value;
  }
  return Object.freeze({
    v: ANALYTICS_SCHEMA_VERSION,
    name,
    ts: now(),
    props: Object.freeze(clean)
  });
}
