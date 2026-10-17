import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import pacing from '../config/pacing.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { findUnsafeLiterals, LIMITS, validateGameConfig } from '../studio-core/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relative) {
  return JSON.parse(readFileSync(join(root, relative), 'utf8'));
}

test('shipped game config stays inside the guardrails', () => {
  const result = validateGameConfig({ pacing, tuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.deepEqual(pacing.ads.interstitial.intervalArms, [90, 120, 180]);
  assert.equal(pacing.ads.interstitial.minSecondsBetween, 120);
  assert.equal(pacing.ads.rewarded.optInOnly, true);
  assert.deepEqual(pacing.ads.rewarded.placements, ['continue', 'hint', 'reroll', 'double_score']);
  for (const key of ['flashMs', 'particleLifeMs', 'popupMs', 'shakeMs', 'invalidShakeMs', 'snapBackMs']) {
    assert.ok(tuning.juice[key] < 400, key);
  }
  for (const folder of ['config', 'levels', 'branding']) {
    for (const name of readdirSync(join(root, folder))) {
      if (!name.endsWith('.json')) continue;
      const violations = findUnsafeLiterals(readJson(join(folder, name)), name);
      assert.deepEqual(violations, [], name);
    }
  }
});

test('an over-limit game config fails the build gate', () => {
  const broken = structuredClone(pacing);
  broken.ads.interstitial.maxPerSession = LIMITS.ads.maxPerSession + 10;
  broken.ads.interstitial.minSecondsBetween = 1;
  broken.ads.interstitial.breaks = ['on_fail'];
  broken.difficulty.failBias = 0.4;
  const result = validateGameConfig({ pacing: broken, tuning });
  assert.equal(result.ok, false);
  const rules = new Set(result.violations.map((item) => item.rule));
  assert.ok(rules.has('ads.maxPerSession'));
  assert.ok(rules.has('ads.minSecondsBetween'));
  assert.ok(rules.has('ads.break'));
  assert.ok(rules.has('difficulty.failBias'));

  const greedy = structuredClone(tuning);
  greedy.continueClears = LIMITS.rewardedEffects.maxContinueRowsCleared + 1;
  const tuningResult = validateGameConfig({ pacing, tuning: greedy });
  assert.equal(tuningResult.ok, false);
  assert.ok(tuningResult.violations.some((item) => item.rule === 'tuning.continueClears'));
});
