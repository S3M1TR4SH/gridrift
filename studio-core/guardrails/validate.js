import { LIMITS } from './limits.js';

const SECRET_KEYS = new Set([
  'adunitid',
  'ad_unit_id',
  'sdkkey',
  'sdk_key',
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  'trackingurl',
  'tracking_url',
  'endpoint',
  'beacon',
  'beaconurl',
  'beacon_url'
]);

function violation(rule, message, value) {
  return { rule, message, value };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function findUnsafeLiterals(value, path = '$') {
  const violations = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      violations.push(...findUnsafeLiterals(item, `${path}[${index}]`));
    });
    return violations;
  }
  if (!isPlainObject(value)) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
      violations.push(violation('privacy.network', `${path} is an absolute URL`, value));
    }
    return violations;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/-/g, '');
    const here = `${path}.${key}`;
    if (SECRET_KEYS.has(key.toLowerCase()) || SECRET_KEYS.has(normalized)) {
      violations.push(violation('ads.secret', `${here} is not allowed`, key));
    }
    violations.push(...findUnsafeLiterals(child, here));
  }
  return violations;
}

function expectBoolean(violations, value, rule, message) {
  if (typeof value !== 'boolean') {
    violations.push(violation(rule, message, value));
    return false;
  }
  return true;
}

function expectNumber(violations, value, rule, message) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    violations.push(violation(rule, message, value));
    return false;
  }
  return true;
}

function validateInterstitial(interstitial, violations) {
  if (!isPlainObject(interstitial)) {
    violations.push(violation('ads.interstitial', 'interstitial config is required', interstitial));
    return;
  }
  const allowed = new Set([
    'enabled',
    'breaks',
    'minSecondsBetween',
    'minRoundsBetween',
    'maxPerSession',
    'nearControls',
    'controlSeparationPx',
    'intervalArms'
  ]);
  for (const key of Object.keys(interstitial)) {
    if (!allowed.has(key)) {
      violations.push(violation('ads.unexpected', `unexpected interstitial field ${key}`, key));
    }
  }
  expectBoolean(violations, interstitial.enabled, 'ads.interstitial', 'interstitial.enabled must be boolean');
  if (!Array.isArray(interstitial.breaks) || interstitial.breaks.length === 0) {
    violations.push(violation('ads.break', 'at least one natural break is required', interstitial.breaks));
  } else {
    for (const type of interstitial.breaks) {
      if (!LIMITS.ads.allowedBreaks.includes(type)) {
        violations.push(violation('ads.break', `break "${type}" is not a natural break`, type));
      }
    }
  }
  if (expectNumber(violations, interstitial.maxPerSession, 'ads.maxPerSession', 'maxPerSession is required')) {
    if (interstitial.maxPerSession > LIMITS.ads.maxPerSession || interstitial.maxPerSession < 0) {
      violations.push(violation(
        'ads.maxPerSession',
        `maxPerSession cannot exceed ${LIMITS.ads.maxPerSession}`,
        interstitial.maxPerSession
      ));
    }
  }
  if (expectNumber(violations, interstitial.minSecondsBetween, 'ads.minSecondsBetween', 'minSecondsBetween is required')) {
    if (interstitial.minSecondsBetween < LIMITS.ads.minSecondsBetween) {
      violations.push(violation(
        'ads.minSecondsBetween',
        `minSecondsBetween cannot be under ${LIMITS.ads.minSecondsBetween}`,
        interstitial.minSecondsBetween
      ));
    }
  }
  if (interstitial.intervalArms != null) {
    if (!Array.isArray(interstitial.intervalArms) || interstitial.intervalArms.length === 0) {
      violations.push(violation('ads.minSecondsBetween', 'intervalArms must list the A/B intervals', interstitial.intervalArms));
    } else {
      for (const arm of interstitial.intervalArms) {
        if (typeof arm !== 'number' || arm < LIMITS.ads.minSecondsBetween) {
          violations.push(violation(
            'ads.minSecondsBetween',
            `interval arm cannot be under ${LIMITS.ads.minSecondsBetween}`,
            arm
          ));
        }
      }
      if (
        typeof interstitial.minSecondsBetween === 'number'
        && !interstitial.intervalArms.includes(interstitial.minSecondsBetween)
      ) {
        violations.push(violation(
          'ads.minSecondsBetween',
          'minSecondsBetween must be one of intervalArms',
          interstitial.minSecondsBetween
        ));
      }
    }
  }
  if (expectNumber(violations, interstitial.minRoundsBetween, 'ads.minRoundsBetween', 'minRoundsBetween is required')) {
    if (interstitial.minRoundsBetween < LIMITS.ads.minRoundsBetween) {
      violations.push(violation(
        'ads.minRoundsBetween',
        `minRoundsBetween cannot be under ${LIMITS.ads.minRoundsBetween}`,
        interstitial.minRoundsBetween
      ));
    }
  }
  if (expectBoolean(violations, interstitial.nearControls, 'ads.nearControls', 'nearControls must be false')) {
    if (interstitial.nearControls) {
      violations.push(violation('ads.nearControls', 'ads cannot sit near controls', true));
    }
  }
  if (expectNumber(violations, interstitial.controlSeparationPx, 'ads.controlSeparationPx', 'controlSeparationPx is required')) {
    if (interstitial.controlSeparationPx < LIMITS.ads.minControlSeparationPx) {
      violations.push(violation(
        'ads.controlSeparationPx',
        `control gap must be at least ${LIMITS.ads.minControlSeparationPx}px`,
        interstitial.controlSeparationPx
      ));
    }
  }
}

function validateRewarded(rewarded, violations) {
  if (!isPlainObject(rewarded)) {
    violations.push(violation('ads.rewarded', 'rewarded config is required', rewarded));
    return;
  }
  const allowed = new Set(['enabled', 'optInOnly', 'placements', 'maxPerSession', 'minSecondsBetween']);
  for (const key of Object.keys(rewarded)) {
    if (!allowed.has(key)) {
      violations.push(violation('ads.unexpected', `unexpected rewarded field ${key}`, key));
    }
  }
  expectBoolean(violations, rewarded.enabled, 'ads.rewarded', 'rewarded.enabled must be boolean');
  if (expectBoolean(violations, rewarded.optInOnly, 'ads.rewardedOptIn', 'optInOnly is required')) {
    if (!rewarded.optInOnly) {
      violations.push(violation('ads.rewardedOptIn', 'rewarded ads are opt-in only', rewarded.optInOnly));
    }
  }
  if (!Array.isArray(rewarded.placements) || rewarded.placements.length === 0) {
    violations.push(violation('ads.rewardedPlacement', 'rewarded placements are required', rewarded.placements));
  } else {
    for (const placement of rewarded.placements) {
      if (!LIMITS.ads.rewarded.placements.includes(placement)) {
        violations.push(violation('ads.rewardedPlacement', `placement "${placement}" is not allowed`, placement));
      }
    }
  }
  if (expectNumber(violations, rewarded.maxPerSession, 'ads.rewardedMaxPerSession', 'rewarded maxPerSession is required')) {
    if (rewarded.maxPerSession > LIMITS.ads.rewarded.maxPerSession || rewarded.maxPerSession < 0) {
      violations.push(violation(
        'ads.rewardedMaxPerSession',
        `rewarded maxPerSession cannot exceed ${LIMITS.ads.rewarded.maxPerSession}`,
        rewarded.maxPerSession
      ));
    }
  }
  if (expectNumber(violations, rewarded.minSecondsBetween, 'ads.rewardedMinSeconds', 'rewarded minSecondsBetween is required')) {
    if (rewarded.minSecondsBetween < LIMITS.ads.rewarded.minSecondsBetween) {
      violations.push(violation(
        'ads.rewardedMinSeconds',
        `rewarded minSecondsBetween cannot be under ${LIMITS.ads.rewarded.minSecondsBetween}`,
        rewarded.minSecondsBetween
      ));
    }
  }
}

function validateDifficulty(difficulty, violations) {
  if (!isPlainObject(difficulty)) {
    violations.push(violation('difficulty.required', 'difficulty config is required', difficulty));
    return;
  }
  const allowed = new Set([
    'failBias',
    'forceUnplaceable',
    'allowStuckState',
    'rampEveryClears',
    'maxTier',
    'pools'
  ]);
  for (const key of Object.keys(difficulty)) {
    if (!allowed.has(key)) {
      violations.push(violation('difficulty.unexpected', `unexpected difficulty field ${key}`, key));
    }
  }
  if (expectNumber(violations, difficulty.failBias, 'difficulty.failBias', 'failBias is required')) {
    if (difficulty.failBias > LIMITS.difficulty.maxFailBias) {
      violations.push(violation('difficulty.failBias', 'fail bias must stay at 0', difficulty.failBias));
    }
  }
  if (expectBoolean(violations, difficulty.forceUnplaceable, 'difficulty.forceUnplaceable', 'forceUnplaceable is required')) {
    if (difficulty.forceUnplaceable) {
      violations.push(violation('difficulty.forceUnplaceable', 'forced unplaceable pieces are not allowed', true));
    }
  }
  if (expectBoolean(violations, difficulty.allowStuckState, 'difficulty.stuckState', 'allowStuckState is required')) {
    if (difficulty.allowStuckState) {
      violations.push(violation('difficulty.stuckState', 'stuck states are not allowed', true));
    }
  }
  if (expectNumber(violations, difficulty.rampEveryClears, 'difficulty.rampEveryClears', 'rampEveryClears is required')) {
    if (difficulty.rampEveryClears < 1) {
      violations.push(violation('difficulty.rampEveryClears', 'rampEveryClears must be at least 1', difficulty.rampEveryClears));
    }
  }
  if (expectNumber(violations, difficulty.maxTier, 'difficulty.maxTier', 'maxTier is required')) {
    if (difficulty.maxTier > LIMITS.difficulty.maxTier || difficulty.maxTier < 0) {
      violations.push(violation('difficulty.maxTier', `maxTier cannot exceed ${LIMITS.difficulty.maxTier}`, difficulty.maxTier));
    }
  }
  if (!Array.isArray(difficulty.pools) || difficulty.pools.length === 0) {
    violations.push(violation('difficulty.pools', 'at least one shape pool is required', difficulty.pools));
  } else {
    for (const pool of difficulty.pools) {
      if (!isPlainObject(pool) || typeof pool.minTier !== 'number' || !Array.isArray(pool.shapes) || pool.shapes.length === 0) {
        violations.push(violation('difficulty.pools', 'each pool needs minTier and shapes', pool));
      }
    }
  }
}

function validatePrivacy(privacy, ads, violations) {
  if (!isPlainObject(privacy)) {
    violations.push(violation('privacy.required', 'privacy config is required', privacy));
    return;
  }
  const allowed = new Set([
    'childrenAdsAllowed',
    'childrenAnalyticsAllowed',
    'personalizedAds',
    'network'
  ]);
  for (const key of Object.keys(privacy)) {
    if (!allowed.has(key)) {
      violations.push(violation('privacy.unexpected', `unexpected privacy field ${key}`, key));
    }
  }
  if (expectBoolean(violations, privacy.childrenAdsAllowed, 'privacy.childrenAds', 'childrenAdsAllowed is required')) {
    if (privacy.childrenAdsAllowed && (privacy.personalizedAds === true || ads?.personalized === true)) {
      violations.push(violation('privacy.childrenAds', 'children can only be shown non-personalized ads', true));
    }
  }
  if (expectBoolean(violations, privacy.childrenAnalyticsAllowed, 'privacy.childrenAnalytics', 'childrenAnalyticsAllowed is required')) {
    if (privacy.childrenAnalyticsAllowed) {
      violations.push(violation('privacy.childrenAnalytics', 'children cannot be tracked', true));
    }
  }
  if (expectBoolean(violations, privacy.personalizedAds, 'privacy.personalizedAds', 'personalizedAds is required')) {
    if (privacy.personalizedAds) {
      violations.push(violation('privacy.personalizedAds', 'personalized ads are not allowed', true));
    }
  }
  if (expectBoolean(violations, privacy.network, 'privacy.network', 'network is required')) {
    if (privacy.network) {
      violations.push(violation('privacy.network', 'config cannot enable network calls', true));
    }
  }
}

function validateAds(ads, violations) {
  if (!isPlainObject(ads)) {
    violations.push(violation('ads.required', 'ads config is required', ads));
    return;
  }
  const allowed = new Set(['interstitial', 'rewarded', 'personalized', 'testMode']);
  for (const key of Object.keys(ads)) {
    if (!allowed.has(key)) {
      violations.push(violation('ads.unexpected', `unexpected ads field ${key}`, key));
    }
  }
  if (ads.testMode != null && ads.testMode !== true) {
    violations.push(violation('ads.testMode', 'test mode is only the Google demo units', ads.testMode));
  }
  if (expectBoolean(violations, ads.personalized, 'ads.personalized', 'ads.personalized is required')) {
    if (ads.personalized) {
      violations.push(violation('ads.personalized', 'personalized ads are not allowed', true));
    }
  }
  validateInterstitial(ads.interstitial, violations);
  validateRewarded(ads.rewarded, violations);
}

export function validateTuning(tuning) {
  const violations = [];
  if (!isPlainObject(tuning)) {
    return { ok: false, violations: [violation('tuning.required', 'tuning config is required', tuning)] };
  }
  violations.push(...findUnsafeLiterals(tuning, '$.tuning'));
  const allowed = new Set(['grid', 'traySize', 'continueClears', 'levelOrder', 'score', 'juice', 'rewardedMinMoves']);
  for (const key of Object.keys(tuning)) {
    if (!allowed.has(key)) violations.push(violation('tuning.unexpected', `unexpected tuning field ${key}`, key));
  }
  if (typeof tuning.grid !== 'number' || tuning.grid < 6 || tuning.grid > 12) {
    violations.push(violation('tuning.grid', 'grid must be from 6 to 12', tuning.grid));
  }
  if (typeof tuning.traySize !== 'number' || tuning.traySize < 1 || tuning.traySize > 3) {
    violations.push(violation('tuning.traySize', 'traySize must be from 1 to 3', tuning.traySize));
  }
  if (tuning.rewardedMinMoves != null && (typeof tuning.rewardedMinMoves !== 'number' || tuning.rewardedMinMoves < 0)) {
    violations.push(violation('tuning.rewardedMinMoves', 'rewardedMinMoves must be a non-negative number', tuning.rewardedMinMoves));
  }
  if (typeof tuning.continueClears !== 'number') {
    violations.push(violation('tuning.continueClears', 'continueClears is required', tuning.continueClears));
  } else if (
    tuning.continueClears < 1 ||
    tuning.continueClears > LIMITS.rewardedEffects.maxContinueRowsCleared
  ) {
    violations.push(violation(
      'tuning.continueClears',
      `continue cannot clear more than ${LIMITS.rewardedEffects.maxContinueRowsCleared} rows`,
      tuning.continueClears
    ));
  }
  if (!Array.isArray(tuning.levelOrder) || tuning.levelOrder.length === 0) {
    violations.push(violation('tuning.levelOrder', 'levelOrder is required', tuning.levelOrder));
  }
  const score = tuning.score;
  if (!isPlainObject(score)) {
    violations.push(violation('tuning.score', 'score tuning is required', score));
  } else {
    for (const key of ['place', 'line', 'comboBonusPerExtraLine', 'streakMultiplierStep', 'maxStreakMultiplier']) {
      if (typeof score[key] !== 'number' || score[key] < 0) {
        violations.push(violation('tuning.score', `score.${key} must be a non-negative number`, score[key]));
      }
    }
    for (const key of ['comboChain', 'streakChain']) {
      if (score[key] == null) continue;
      const table = score[key];
      const rising = Array.isArray(table) && table.length >= 2 && table.length <= 12
        && table.every((value) => typeof value === 'number' && value >= 0);
      if (!rising || !table.some((value, index) => index > 0 && value > table[index - 1])) {
        violations.push(violation('tuning.score', `score.${key} must escalate`, table));
      }
    }
    if (score.goals != null) {
      const goals = score.goals;
      const ok = Array.isArray(goals) && goals.length > 0 && goals.every((goal, index) => (
        typeof goal === 'number' && goal > 0 && (index === 0 || goal > goals[index - 1])
      ));
      if (!ok) violations.push(violation('tuning.score', 'score.goals must increase', goals));
    }
  }
  validateJuice(tuning.juice, violations);
  return { ok: violations.length === 0, violations };
}

function validateJuice(juice, violations) {
  if (juice == null) return;
  if (!isPlainObject(juice)) {
    violations.push(violation('tuning.juice', 'juice config must be an object', juice));
    return;
  }
  const ranges = {
    flashMs: [0, 399],
    particleCount: [0, 40],
    particleLifeMs: [0, 399],
    popupMs: [0, 399],
    shakeMs: [0, 399],
    shakePx: [0, 16],
    invalidShakeMs: [0, 399],
    invalidShakePx: [0, 16],
    snapBackMs: [0, 399],
    dragLiftPx: [0, 160]
  };
  const allowed = new Set([...Object.keys(ranges), 'streakSteps', 'sounds', 'particleIds', 'flashId']);
  for (const key of Object.keys(juice)) {
    if (!allowed.has(key)) violations.push(violation('tuning.juice', `unexpected juice field ${key}`, key));
  }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (juice[key] == null) continue;
    if (typeof juice[key] !== 'number' || juice[key] < min || juice[key] > max) {
      violations.push(violation('tuning.juice', `juice.${key} must be from ${min} to ${max}`, juice[key]));
    }
  }
  if (juice.streakSteps != null) {
    const steps = juice.streakSteps;
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8 || steps.some((step) => typeof step !== 'number' || step < 1)) {
      violations.push(violation('tuning.juice', 'streakSteps must be 1 to 8 numbers of at least 1', steps));
    }
  }
  if (juice.flashId != null && (typeof juice.flashId !== 'string' || /^https?:/i.test(juice.flashId))) {
    violations.push(violation('tuning.juice', 'flashId must be an asset id', juice.flashId));
  }
  if (juice.particleIds != null) {
    const ids = juice.particleIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 8 || ids.some((id) => typeof id !== 'string' || /^https?:/i.test(id))) {
      violations.push(violation('tuning.juice', 'particleIds must be 1 to 8 asset ids', ids));
    }
  }
  if (juice.sounds != null) {
    if (!isPlainObject(juice.sounds)) {
      violations.push(violation('tuning.juice', 'juice.sounds must be an object', juice.sounds));
    } else {
      const soundKeys = new Set(['clear', 'combo', 'invalid', 'streak', 'tap', 'tutorial']);
      for (const key of Object.keys(juice.sounds)) {
        if (!soundKeys.has(key)) violations.push(violation('tuning.juice', `unexpected juice sound ${key}`, key));
      }
      for (const key of ['clear', 'combo', 'invalid', 'tap', 'tutorial']) {
        const id = juice.sounds[key];
        if (id != null && (typeof id !== 'string' || /^https?:/i.test(id))) {
          violations.push(violation('tuning.juice', `juice.sounds.${key} must be an asset id`, id));
        }
      }
      const streak = juice.sounds.streak;
      if (streak != null) {
        const ids = Array.isArray(streak) ? streak : [streak];
        if (!ids.length || ids.length > 3 || ids.some((id) => typeof id !== 'string' || /^https?:/i.test(id))) {
          violations.push(violation('tuning.juice', 'juice.sounds.streak must be 1 to 3 asset ids', streak));
        }
      }
    }
  }
}

export function validatePacing(pacing) {
  const violations = [];
  if (!isPlainObject(pacing)) {
    return { ok: false, violations: [violation('pacing.required', 'pacing config is required', pacing)] };
  }
  violations.push(...findUnsafeLiterals(pacing, '$.pacing'));
  const allowed = new Set(['ads', 'difficulty', 'privacy']);
  for (const key of Object.keys(pacing)) {
    if (!allowed.has(key)) violations.push(violation('pacing.unexpected', `unexpected pacing field ${key}`, key));
  }
  validateAds(pacing.ads, violations);
  validateDifficulty(pacing.difficulty, violations);
  validatePrivacy(pacing.privacy, pacing.ads, violations);
  return { ok: violations.length === 0, violations };
}

export function validateGameConfig({ pacing, tuning } = {}) {
  const pacingResult = validatePacing(pacing);
  const tuningResult = validateTuning(tuning);
  const violations = [...pacingResult.violations, ...tuningResult.violations];
  return { ok: violations.length === 0, violations };
}
