export function initialMotion({ stored = null, query } = {}) {
  if (stored === true || stored === false) return stored;
  if (typeof query !== 'function') return false;
  try {
    return Boolean(query('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function initialHaptics({ stored = null } = {}) {
  if (stored === true || stored === false) return stored;
  return true;
}

export function shouldVibrate({ enabled = false, reducedMotion = false, supported = true } = {}) {
  return Boolean(enabled) && !reducedMotion && Boolean(supported);
}
