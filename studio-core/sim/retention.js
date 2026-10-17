function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function logShare(value, scale) {
  const amount = Math.max(0, Number(value) || 0);
  const width = Math.max(1, Number(scale) || 1);
  return Math.log1p(amount) / Math.log1p(width);
}

// D1 proxy. Each input keeps moving the score: there is no clear, combo, or
// score cap. log1p grows forever, so a longer session, another clear, another
// near-miss, or another voluntary replay still changes the result. Only the
// final probability is clamped to 0..1.
//
// wouldReturn =
//   0.28
//   + 0.20 * log1p(sessionSeconds) / log1p(90)
//   + 0.18 * log1p(clears) / log1p(20)
//   + 0.12 * log1p(nearMisses) / log1p(6)
//   + 0.14 * log1p(voluntaryReplays) / log1p(2)
//   - 0.05 * log1p(failPoints) / log1p(4)
//   - 0.12 * (adMoments * adAversion) / (1 + adMoments * adAversion)
//   - 0.05 when the quit reason is frustration, boredom, or ad
export const RETURN_FORMULA = {
  base: 0.28,
  session: 0.2,
  clears: 0.18,
  nearMisses: 0.12,
  replays: 0.14,
  sessionScaleS: 90,
  clearScale: 20,
  nearMissScale: 6,
  replayScale: 2,
  failWeight: 0.05,
  failScale: 4,
  adWeight: 0.12,
  quitPenalty: 0.05
};

export function wouldReturn({ persona, log }) {
  const formula = RETURN_FORMULA;
  const seconds = Math.max(0, Number(log?.sessionLengthMs) || 0) / 1000;
  const aversion = Number(persona?.adAversion ?? 0.3);
  const ads = log?.adMoments?.length ?? 0;
  const pressure = ads * (Number.isFinite(aversion) ? aversion : 0);
  let score = formula.base;
  score += formula.session * logShare(seconds, formula.sessionScaleS);
  score += formula.clears * logShare(log?.clears ?? 0, formula.clearScale);
  score += formula.nearMisses * logShare(log?.nearMisses ?? 0, formula.nearMissScale);
  score += formula.replays * logShare(log?.replays ?? 0, formula.replayScale);
  score -= formula.failWeight * logShare(log?.failPoints?.length ?? 0, formula.failScale);
  score -= formula.adWeight * (pressure / (1 + pressure));
  if (log?.quitReason === 'frustration' || log?.quitReason === 'boredom' || log?.quitReason === 'ad') {
    score -= formula.quitPenalty;
  }
  return round(clamp(score, 0, 1));
}
