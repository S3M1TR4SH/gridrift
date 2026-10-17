export function emptyMercy() {
  return { lossesInRow: 0, queued: 0 };
}

export function shouldShowWelcome({ run, lastSeen, now, minAwayMinutes = 30 } = {}) {
  if (!run) return false;
  const seen = Number(lastSeen);
  if (!Number.isFinite(seen) || seen <= 0) return true;
  const awayMs = Math.max(0, Number(now) - seen);
  return awayMs >= minAwayMinutes * 60 * 1000;
}

export function bandName(score, ramp = [[0, 'easy'], [300, 'normal'], [1200, 'hard']]) {
  let name = ramp[0]?.[1] || 'easy';
  for (const step of ramp) {
    if (score >= step[0]) name = step[1];
  }
  return name;
}

const BAND_INDEX = { easy: 0, normal: 1, hard: 2 };

export function bandShapes({ score = 0, easy = false, pools = [], ramp } = {}) {
  const index = easy ? 0 : (BAND_INDEX[bandName(score, ramp)] ?? 0);
  const pool = pools[index] || pools[0];
  return pool?.shapes ? pool.shapes.slice() : [];
}

export function noteLoss(mercy = emptyMercy(), afterLosses = 3) {
  const current = {
    lossesInRow: Math.max(0, Math.floor(Number(mercy.lossesInRow) || 0)),
    queued: Math.max(0, Math.floor(Number(mercy.queued) || 0))
  };
  if (current.queued > 0) return current;
  const lossesInRow = current.lossesInRow + 1;
  if (lossesInRow >= afterLosses) return { lossesInRow: 0, queued: 1 };
  return { lossesInRow, queued: 0 };
}

export function noteSuccess(mercy = emptyMercy()) {
  return {
    lossesInRow: 0,
    queued: Math.max(0, Math.floor(Number(mercy.queued) || 0))
  };
}

export function beginRun(mercy = emptyMercy()) {
  const current = {
    lossesInRow: Math.max(0, Math.floor(Number(mercy.lossesInRow) || 0)),
    queued: Math.max(0, Math.floor(Number(mercy.queued) || 0))
  };
  if (current.queued > 0) {
    return { mercy: { lossesInRow: 0, queued: current.queued - 1 }, easy: true };
  }
  return { mercy: current, easy: false };
}

export function milestoneHit(previous, next, milestones = [3, 7, 14, 30]) {
  const hits = milestones.filter((mark) => previous < mark && next >= mark);
  return hits.length ? hits[hits.length - 1] : 0;
}

export const STREAK_RESET_COPY = 'Streak starts again.';
