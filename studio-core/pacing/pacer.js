import { LIMITS } from '../guardrails/limits.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function neutralizePacing(pacing = {}) {
  const difficulty = pacing?.difficulty ?? {};
  const pools = Array.isArray(difficulty.pools) && difficulty.pools.length
    ? difficulty.pools
    : [{ minTier: 0, shapes: ['dot'] }];
  return {
    ads: {
      personalized: false,
      interstitial: {
        enabled: false,
        breaks: ['between_rounds'],
        minSecondsBetween: LIMITS.ads.minSecondsBetween,
        minRoundsBetween: LIMITS.ads.minRoundsBetween,
        maxPerSession: 0,
        nearControls: false,
        controlSeparationPx: LIMITS.ads.minControlSeparationPx
      },
      rewarded: {
        enabled: false,
        optInOnly: true,
        placements: [...LIMITS.ads.rewarded.placements],
        maxPerSession: 0,
        minSecondsBetween: LIMITS.ads.rewarded.minSecondsBetween
      }
    },
    difficulty: {
      failBias: 0,
      forceUnplaceable: false,
      allowStuckState: false,
      rampEveryClears: Math.max(1, Number(difficulty.rampEveryClears) || 4),
      maxTier: clamp(Number(difficulty.maxTier) || 1, 0, LIMITS.difficulty.maxTier),
      pools
    },
    privacy: {
      childrenAdsAllowed: false,
      childrenAnalyticsAllowed: false,
      personalizedAds: false,
      network: false
    }
  };
}

export function createPacer({ pacing, now = () => Date.now(), isChild = () => false } = {}) {
  const interstitial = pacing?.ads?.interstitial ?? {};
  const rewarded = pacing?.ads?.rewarded ?? {};
  const difficulty = pacing?.difficulty ?? {};
  const breaks = (Array.isArray(interstitial.breaks) ? interstitial.breaks : [])
    .filter((type) => LIMITS.ads.allowedBreaks.includes(type));
  const interstitialMax = clamp(
    Number(interstitial.maxPerSession) || 0,
    0,
    LIMITS.ads.maxPerSession
  );
  const interstitialGapMs = Math.max(
    LIMITS.ads.minSecondsBetween,
    Number(interstitial.minSecondsBetween) || LIMITS.ads.minSecondsBetween
  ) * 1000;
  const minRounds = Math.max(
    LIMITS.ads.minRoundsBetween,
    Number(interstitial.minRoundsBetween) || LIMITS.ads.minRoundsBetween
  );
  const rewardedMax = clamp(
    Number(rewarded.maxPerSession) || 0,
    0,
    LIMITS.ads.rewarded.maxPerSession
  );
  const rewardedGapMs = Math.max(
    LIMITS.ads.rewarded.minSecondsBetween,
    Number(rewarded.minSecondsBetween) || LIMITS.ads.rewarded.minSecondsBetween
  ) * 1000;
  const rampEvery = Math.max(1, Number(difficulty.rampEveryClears) || 1);
  const maxTier = clamp(Number(difficulty.maxTier) || 0, 0, LIMITS.difficulty.maxTier);
  const pools = Array.isArray(difficulty.pools) ? difficulty.pools : [];

  let interstitialsShown = 0;
  let rewardedShown = 0;
  let lastInterstitialAt = -Infinity;
  let lastRewardedAt = -Infinity;
  let roundsSinceAd = Number.POSITIVE_INFINITY;

  function child() {
    return Boolean(isChild());
  }

  function shapePool(clears) {
    const tier = Math.min(maxTier, Math.floor(Math.max(0, clears) / rampEvery));
    let shapes = pools[0]?.shapes ?? ['dot'];
    for (const pool of pools) {
      if (tier >= pool.minTier && Array.isArray(pool.shapes) && pool.shapes.length) {
        shapes = pool.shapes;
      }
    }
    return shapes.slice();
  }

  return {
    get failBias() {
      return 0;
    },
    get forceUnplaceable() {
      return false;
    },
    shapePool,
    difficultyTier(clears) {
      return Math.min(maxTier, Math.floor(Math.max(0, clears) / rampEvery));
    },
    recordRoundEnded() {
      if (roundsSinceAd !== Number.POSITIVE_INFINITY) roundsSinceAd += 1;
    },
    canShowInterstitial(breakType) {
      if (child()) return false;
      if (!interstitial.enabled || pacing?.privacy?.childrenAdsAllowed) return false;
      if (!breaks.includes(breakType)) return false;
      if (interstitialsShown >= interstitialMax) return false;
      if (now() - lastInterstitialAt < interstitialGapMs) return false;
      if (roundsSinceAd < minRounds) return false;
      return true;
    },
    canOfferRewarded(placement) {
      if (child()) return false;
      if (!rewarded.enabled || rewarded.optInOnly === false) return false;
      if (pacing?.ads?.personalized) return false;
      if (!LIMITS.ads.rewarded.placements.includes(placement)) return false;
      if (Array.isArray(rewarded.placements) && !rewarded.placements.includes(placement)) return false;
      if (rewardedShown >= rewardedMax) return false;
      if (now() - lastRewardedAt < rewardedGapMs) return false;
      if (now() - lastInterstitialAt < interstitialGapMs) return false;
      return true;
    },
    recordAd(kind) {
      const timestamp = now();
      if (kind === 'interstitial') {
        interstitialsShown += 1;
        lastInterstitialAt = timestamp;
        roundsSinceAd = 0;
        return;
      }
      if (kind === 'rewarded') {
        rewardedShown += 1;
        lastRewardedAt = timestamp;
        roundsSinceAd = 0;
      }
    },
    snapshot() {
      return { interstitialsShown, rewardedShown, roundsSinceAd };
    }
  };
}
