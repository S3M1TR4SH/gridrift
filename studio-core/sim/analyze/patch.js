function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function merge(target, patch) {
  const next = structuredClone(target);
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(next[key])) next[key] = merge(next[key], value);
    else next[key] = structuredClone(value);
  }
  return next;
}

export function applyPatch(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) throw new Error('patch must be an object');
  return merge(base, patch);
}
