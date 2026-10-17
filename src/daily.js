export const FREEZE_CAP = 3;

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateSeed(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error('date seed needs YYYY-MM-DD');
  let hash = 2166136261;
  for (let index = 0; index < isoDate.length; index += 1) {
    hash ^= isoDate.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function daysBetween(earlier, later) {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function dailyState(state = {}) {
  return {
    lastCompleted: typeof state.lastCompleted === 'string' ? state.lastCompleted : '',
    streak: Math.max(0, Math.floor(Number(state.streak) || 0)),
    freezes: Math.max(0, Math.min(FREEZE_CAP, Math.floor(Number(state.freezes) || 0))),
    marks: Math.max(0, Math.floor(Number(state.marks) || 0))
  };
}

export function completeDaily(state, today) {
  const current = dailyState(state);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return { ...current, status: 'invalid' };
  }
  if (!current.lastCompleted) {
    return { ...current, lastCompleted: today, streak: 1, status: 'started' };
  }
  if (current.lastCompleted === today) {
    return { ...current, status: 'already' };
  }
  const gap = daysBetween(current.lastCompleted, today);
  if (gap <= 0) return { ...current, status: 'already' };
  if (gap === 1) {
    return { ...current, lastCompleted: today, streak: current.streak + 1, status: 'continued' };
  }
  const missed = gap - 1;
  if (missed <= current.freezes) {
    return {
      ...current,
      lastCompleted: today,
      streak: current.streak + 1,
      freezes: current.freezes - missed,
      status: 'frozen'
    };
  }
  return { ...current, lastCompleted: today, streak: 1, status: 'reset' };
}

export function earnFreeze(state, source = 'play') {
  const current = dailyState(state);
  if (source !== 'play' || current.freezes >= FREEZE_CAP) return current;
  return { ...current, freezes: current.freezes + 1 };
}
