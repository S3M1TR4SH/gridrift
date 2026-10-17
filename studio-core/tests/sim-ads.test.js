import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createH5GamesAdsAdapter } from '../ads/h5/adapter.js';
import { validateGameConfig } from '../guardrails/validate.js';
import { runAdSessions, sessionNumberForSim } from '../sim/ad-schedule.js';
import { wouldReturn } from '../sim/retention.js';
import { resolvePersona } from '../sim/personas.js';
import tuning from '../../config/tuning.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('gate-ads-on uses the quiet timing and the test adapter', () => {
  const gate = JSON.parse(readFileSync(join(root, 'sim/variants/gate-ads-on.json'), 'utf8'));
  const quiet = JSON.parse(readFileSync(join(root, 'sim/variants/quiet-ads.json'), 'utf8'));
  const result = validateGameConfig({ pacing: gate, tuning });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(gate.ads.testMode, true);
  assert.equal(gate.ads.interstitial.enabled, true);
  assert.equal(gate.ads.rewarded.enabled, true);
  assert.equal(gate.ads.interstitial.minSecondsBetween, quiet.ads.interstitial.minSecondsBetween);
  assert.deepEqual(gate.ads.interstitial.breaks, quiet.ads.interstitial.breaks);
  assert.equal(sessionNumberForSim({ variant: { id: 'quiet' }, seed: 2 }), 1);
  assert.equal(sessionNumberForSim({ variant: { id: 'gate', pacingPath: 'sim/variants/gate-ads-on.json' }, seed: 1 }), 1);
  assert.equal(sessionNumberForSim({ variant: { id: 'gate', pacingPath: 'sim/variants/gate-ads-on.json' }, seed: 2 }), 2);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.doesNotMatch(pkg.scripts.sim, /gate-ads-on/);
  assert.match(pkg.scripts['sim:gate'], /gate-ads-on/);
  assert.equal(createH5GamesAdsAdapter().id, 'h5-games-ads');
});

test('the pacing scheduler shows interstitials and rewarded offers across sessions', () => {
  const pacing = JSON.parse(readFileSync(join(root, 'sim/variants/gate-ads-on.json'), 'utf8'));
  const report = runAdSessions({ pacing, sessions: 4 });
  assert.equal(report.firstSessionInterstitials, 0);
  assert.ok(report.interstitials > 0, JSON.stringify(report));
  assert.ok(report.rewardedOffers > 0, JSON.stringify(report));
  assert.equal(report.midMoveAds, 0);
  assert.equal(report.cooldownBreaks, 0);
  const quiet = JSON.parse(readFileSync(join(root, 'sim/variants/quiet-ads.json'), 'utf8'));
  const silent = runAdSessions({ pacing: quiet, sessions: 4 });
  assert.equal(silent.interstitials, 0);
  assert.equal(silent.rewardedOffers, 0);
});

test('the return proxy keeps moving after the old score caps', () => {
  const persona = resolvePersona('casual');
  const scores = [];
  for (let index = 0; index < 160; index += 1) {
    scores.push(wouldReturn({
      persona,
      log: {
        clears: 8 + (index % 40),
        combos: Array.from({ length: 3 + (index % 5) }, () => ({ lines: 2 })),
        peakScore: 500 + index * 25,
        sessionLengthMs: 60_000 + index * 1800,
        nearMisses: index % 7,
        replays: index % 3,
        failPoints: [{ step: 20 }],
        adMoments: [],
        quitReason: 'game_over'
      }
    }));
  }
  const unique = new Set(scores);
  assert.ok(unique.size >= 40, `collapsed to ${unique.size} values`);
  const spread = Math.max(...scores) - Math.min(...scores);
  assert.ok(spread >= 0.15, `spread ${spread}`);
  const base = {
    sessionLengthMs: 90_000,
    clears: 10,
    nearMisses: 2,
    replays: 0,
    failPoints: [],
    adMoments: [],
    quitReason: 'game_over'
  };
  const mid = wouldReturn({ persona, log: base });
  assert.ok(wouldReturn({ persona, log: { ...base, sessionLengthMs: 180_000 } }) > mid);
  assert.ok(wouldReturn({ persona, log: { ...base, clears: 24 } }) > mid);
  assert.ok(wouldReturn({ persona, log: { ...base, nearMisses: 6 } }) > mid);
  assert.ok(wouldReturn({ persona, log: { ...base, replays: 1 } }) > mid);
  const ads = {
    ...base,
    adMoments: [{ kind: 'interstitial' }, { kind: 'rewarded' }, { kind: 'rewarded' }]
  };
  const averse = wouldReturn({ persona: resolvePersona('ad-averse'), log: ads });
  const skilled = wouldReturn({ persona: resolvePersona('skilled'), log: ads });
  assert.ok(averse < skilled);
});
