import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIMITS } from '../guardrails/limits.js';
import { validateGameConfig, validatePacing } from '../guardrails/validate.js';
import { VERSION } from '../version.js';

const here = dirname(fileURLToPath(import.meta.url));
const overLimit = JSON.parse(readFileSync(join(here, 'fixtures', 'over-limit-pacing.json'), 'utf8'));
const validPacing = JSON.parse(readFileSync(join(here, 'fixtures', 'valid-pacing.json'), 'utf8'));

const validTuning = {
  grid: 10,
  traySize: 3,
  continueClears: 3,
  levelOrder: ['round-01'],
  score: {
    place: 1,
    line: 10,
    comboBonusPerExtraLine: 5,
    streakMultiplierStep: 0.5,
    maxStreakMultiplier: 4
  }
};

test('version pins 0.2.0 across the package', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  const file = readFileSync(join(here, '..', 'VERSION'), 'utf8').trim();
  assert.equal(VERSION, '0.2.0');
  assert.equal(file, '0.2.0');
  assert.equal(pkg.version, '0.2.0');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.exports['.'], './index.js');
});

test('limits are frozen and cannot be widened', () => {
  assert.throws(() => {
    LIMITS.ads.maxPerSession = 100;
  });
  assert.throws(() => {
    LIMITS.ads.allowedBreaks.push('banner');
  });
  assert.equal(LIMITS.ads.maxPerSession, 3);
  assert.deepEqual([...LIMITS.ads.allowedBreaks], ['game_over', 'between_rounds']);
  assert.equal(LIMITS.difficulty.maxFailBias, 0);
  assert.equal(LIMITS.privacy.coppaAge, 13);
});

test('a within-limit pacing config passes', () => {
  const result = validateGameConfig({ pacing: validPacing, tuning: validTuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
});

test('an over-limit config fails validation', () => {
  const result = validatePacing(overLimit);
  assert.equal(result.ok, false);
  const rules = new Set(result.violations.map((item) => item.rule));
  for (const rule of [
    'ads.maxPerSession',
    'ads.minSecondsBetween',
    'ads.minRoundsBetween',
    'ads.break',
    'ads.nearControls',
    'ads.controlSeparationPx',
    'ads.rewardedOptIn',
    'ads.rewardedPlacement',
    'ads.rewardedMaxPerSession',
    'ads.rewardedMinSeconds',
    'ads.personalized',
    'ads.secret',
    'difficulty.failBias',
    'difficulty.forceUnplaceable',
    'difficulty.stuckState',
    'difficulty.maxTier',
    'privacy.childrenAds',
    'privacy.childrenAnalytics',
    'privacy.personalizedAds',
    'privacy.network'
  ]) {
    assert.ok(rules.has(rule), `missing rule ${rule}`);
  }
});

test('raising only the session cap is enough to fail', () => {
  const pacing = structuredClone(validPacing);
  pacing.ads.interstitial.maxPerSession = LIMITS.ads.maxPerSession + 1;
  const result = validateGameConfig({ pacing, tuning: validTuning });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((item) => item.rule === 'ads.maxPerSession'));
});

test('juice tuning is optional and out of range fails', () => {
  assert.equal(validateGameConfig({ pacing: validPacing, tuning: validTuning }).ok, true);
  const tuning = { ...validTuning, juice: { particleCount: 99, shakePx: 40 } };
  const result = validateGameConfig({ pacing: validPacing, tuning });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((item) => item.rule === 'tuning.juice'));
});

test('continue cannot clear more rows than the guardrail', () => {
  const tuning = { ...validTuning, continueClears: LIMITS.rewardedEffects.maxContinueRowsCleared + 5 };
  const result = validateGameConfig({ pacing: validPacing, tuning });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((item) => item.rule === 'tuning.continueClears'));
});
