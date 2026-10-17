import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIMITS } from '../guardrails/limits.js';
import { validateGameConfig } from '../guardrails/validate.js';
import { createPacer, neutralizePacing } from '../pacing/pacer.js';

const here = dirname(fileURLToPath(import.meta.url));
const validPacing = JSON.parse(readFileSync(join(here, 'fixtures', 'valid-pacing.json'), 'utf8'));

test('interstitials only fire on natural breaks and then cool down', () => {
  let now = 1_000_000;
  const pacer = createPacer({ pacing: validPacing, now: () => now, isChild: () => false });
  assert.equal(pacer.canShowInterstitial('on_fail'), false);
  assert.equal(pacer.canShowInterstitial('gameplay'), false);
  pacer.recordRoundEnded();
  assert.equal(pacer.canShowInterstitial('between_rounds'), true);
  pacer.recordAd('interstitial');
  assert.equal(pacer.canShowInterstitial('between_rounds'), false);
  pacer.recordRoundEnded();
  assert.equal(pacer.canShowInterstitial('between_rounds'), false);
  pacer.recordRoundEnded();
  now += validPacing.ads.interstitial.minSecondsBetween * 1000;
  assert.equal(pacer.canShowInterstitial('between_rounds'), true);
});

test('session cap and clock are clamped to hard limits', () => {
  const pacing = structuredClone(validPacing);
  pacing.ads.interstitial.maxPerSession = 999;
  pacing.ads.interstitial.minSecondsBetween = 1;
  let now = 0;
  const pacer = createPacer({ pacing, now: () => now, isChild: () => false });
  for (let i = 0; i < LIMITS.ads.maxPerSession; i += 1) {
    pacer.recordRoundEnded();
    pacer.recordRoundEnded();
    now += LIMITS.ads.minSecondsBetween * 1000;
    assert.equal(pacer.canShowInterstitial('game_over'), true, `show ${i}`);
    pacer.recordAd('interstitial');
  }
  pacer.recordRoundEnded();
  pacer.recordRoundEnded();
  now += 10_000_000;
  assert.equal(pacer.canShowInterstitial('game_over'), false);
  assert.equal(pacer.snapshot().interstitialsShown, LIMITS.ads.maxPerSession);
});

test('children, opted-out rewarded, and fail bias cannot be overridden', () => {
  const pacing = structuredClone(validPacing);
  pacing.difficulty.failBias = 0.9;
  pacing.difficulty.forceUnplaceable = true;
  pacing.ads.rewarded.optInOnly = false;
  const child = createPacer({ pacing, now: () => 10_000, isChild: () => true });
  child.recordRoundEnded();
  assert.equal(child.canShowInterstitial('game_over'), false);
  assert.equal(child.canOfferRewarded('continue'), false);
  assert.equal(child.failBias, 0);
  assert.equal(child.forceUnplaceable, false);

  const adult = createPacer({ pacing: validPacing, now: () => 10_000, isChild: () => false });
  assert.equal(adult.canOfferRewarded('continue'), true);
  assert.equal(adult.canOfferRewarded('hint'), true);
  assert.equal(adult.canOfferRewarded('forced_banner'), false);
  adult.recordAd('rewarded');
  assert.equal(adult.canOfferRewarded('hint'), false);
});

test('an interstitial blocks a rewarded ad during the cooldown', () => {
  let now = 50_000;
  const pacer = createPacer({ pacing: validPacing, now: () => now, isChild: () => false });
  pacer.recordRoundEnded();
  pacer.recordAd('interstitial');
  assert.equal(pacer.canOfferRewarded('continue'), false);
  now += validPacing.ads.interstitial.minSecondsBetween * 1000;
  assert.equal(pacer.canOfferRewarded('continue'), true);
});

test('difficulty ramps through pools without a fail bias', () => {
  const pacer = createPacer({ pacing: validPacing, now: () => 0 });
  assert.deepEqual(pacer.shapePool(0), validPacing.difficulty.pools[0].shapes);
  assert.deepEqual(pacer.shapePool(8), validPacing.difficulty.pools[1].shapes);
  assert.ok(pacer.difficultyTier(10_000) <= LIMITS.difficulty.maxTier);
  assert.equal(pacer.failBias, 0);
});

test('neutralize strips an over-limit config back inside the guardrails', () => {
  const over = JSON.parse(readFileSync(join(here, 'fixtures', 'over-limit-pacing.json'), 'utf8'));
  const safe = neutralizePacing(over);
  const tuning = {
    grid: 10,
    traySize: 3,
    continueClears: 3,
    levelOrder: ['round-01'],
    score: { place: 1, line: 10, comboBonusPerExtraLine: 5, streakMultiplierStep: 0.5, maxStreakMultiplier: 4 }
  };
  const result = validateGameConfig({ pacing: safe, tuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  const pacer = createPacer({ pacing: safe, now: () => 10_000 });
  pacer.recordRoundEnded();
  assert.equal(pacer.canShowInterstitial('between_rounds'), false);
  assert.equal(pacer.canOfferRewarded('continue'), false);
});
