function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function wouldReturn({ persona, log }) {
  const aversion = Number(persona?.adAversion ?? 0.3);
  let score = 0.55;
  score += Math.min(0.2, (log.clears ?? 0) * 0.025);
  score += Math.min(0.12, (log.combos?.length ?? 0) * 0.04);
  score += Math.min(0.1, (log.peakScore ?? log.finalScore ?? 0) / 500);
  score -= Math.min(0.25, (log.failPoints?.length ?? 0) * 0.07);
  score -= Math.min(0.45, (log.adMoments?.length ?? 0) * 0.08 * (Number.isFinite(aversion) ? aversion : 0));
  if (log.quitReason === 'frustration' || log.quitReason === 'boredom' || log.quitReason === 'ad') score -= 0.04;
  return round(clamp(score, 0, 1));
}
