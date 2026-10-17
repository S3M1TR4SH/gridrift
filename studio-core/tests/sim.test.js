import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertAdapter } from '../sim/adapter.js';
import { buildReport, runComparison } from '../sim/compare.js';
import { chooseAction, resolvePersona } from '../sim/personas.js';
import { formatSummary, writeReport } from '../sim/report.js';
import { wouldReturn } from '../sim/retention.js';
import { mulberry32 } from '../sim/rng.js';
import { runSession } from '../sim/session.js';
import { startStaticServer } from '../sim/static-server.js';

test('mulberry32 repeats for a seed and diverges for another', () => {
  const first = mulberry32(7);
  const second = mulberry32(7);
  const other = mulberry32(8);
  const samples = [first(), first(), first()];
  assert.deepEqual(samples, [second(), second(), second()]);
  assert.notEqual(samples[0], other());
  for (const value of samples) {
    assert.equal(value >= 0 && value < 1, true);
  }
});

test('chooseAction is stable for a seed and can pick different moves', () => {
  const persona = resolvePersona('casual');
  const state = {
    screen: 'play',
    score: 0,
    clears: 0,
    combo: 0,
    failed: false,
    ended: false,
    ad: null,
    actions: [
      { type: 'move', id: 'low', pieceIndex: 0, x: 0, y: 0, lines: 0, cells: 4 },
      { type: 'move', id: 'high', pieceIndex: 1, x: 1, y: 1, lines: 2, cells: 1 }
    ]
  };
  const once = chooseAction({ persona, state, rng: mulberry32(9), step: 0, restarts: 0 });
  const twice = chooseAction({ persona, state, rng: mulberry32(9), step: 0, restarts: 0 });
  assert.deepEqual(once, twice);

  const picks = new Set();
  for (let seed = 1; seed <= 24; seed += 1) {
    const decision = chooseAction({ persona, state, rng: mulberry32(seed), step: 0, restarts: 0 });
    picks.add(decision.type === 'quit' ? 'quit' : decision.action.id);
  }
  assert.ok(picks.size > 1, [...picks].join(','));
});

test('a perfect skill rating takes the clearer move', () => {
  const persona = resolvePersona('skilled', { skill: 1, quitChance: 0, hintRate: 0 });
  const decision = chooseAction({
    persona,
    state: {
      screen: 'play',
      failed: false,
      ended: false,
      ad: null,
      actions: [
        { type: 'move', id: 'low', pieceIndex: 0, x: 0, y: 0, lines: 0, cells: 9 },
        { type: 'move', id: 'high', pieceIndex: 1, x: 3, y: 1, lines: 2, cells: 1 }
      ]
    },
    rng: mulberry32(1),
    step: 0,
    restarts: 0
  });
  assert.equal(decision.type, 'action');
  assert.equal(decision.action.id, 'high');
});

test('ad-averse retention drops further than skilled retention for the same ads', () => {
  const log = {
    clears: 2,
    combos: [{ lines: 2 }],
    peakScore: 40,
    finalScore: 40,
    failPoints: [{ step: 4 }],
    adMoments: [{ kind: 'interstitial' }, { kind: 'rewarded' }, { kind: 'rewarded' }],
    endReason: 'max_steps',
    steps: 40
  };
  const averse = wouldReturn({ persona: resolvePersona('ad-averse'), log });
  const skilled = wouldReturn({ persona: resolvePersona('skilled'), log });
  assert.ok(averse < skilled);
  assert.equal(averse, wouldReturn({ persona: resolvePersona('ad-averse'), log }));
});

function scriptedAdapter(frames, variantId) {
  let index = 0;
  const performed = [];
  return {
    variantId,
    performed,
    async start() {
      index = 0;
    },
    async readState() {
      return frames[Math.min(index, frames.length - 1)];
    },
    async listActions() {
      return (await this.readState()).actions ?? [];
    },
    async perform(action) {
      performed.push(action);
      index += 1;
      return { ok: true };
    },
    async advanceTime() {},
    async stop() {}
  };
}

const scriptedPersona = {
  id: 'scripted',
  skill: 1,
  quitChance: 0,
  patience: 100,
  adWatchRate: 0,
  quitOnAd: 0,
  continueRate: 0,
  restartRate: 0,
  maxRestarts: 0,
  analyticsGrantRate: 1,
  hintRate: 0,
  thinkMs: 1000,
  adAversion: 0.5,
  ageBand: '13plus'
};

test('runSession records clears, combos, ads, fail points, and a quit', async () => {
  const frames = [
    {
      screen: 'age_gate',
      score: 0,
      clears: 0,
      combo: 0,
      failed: false,
      ended: false,
      ad: null,
      actions: [{ type: 'ui', id: 'age_13', uiId: 'age_13' }]
    },
    {
      screen: 'analytics_consent',
      score: 0,
      clears: 0,
      combo: 0,
      failed: false,
      ended: false,
      ad: null,
      actions: [
        { type: 'ui', id: 'analytics_yes', uiId: 'analytics_yes' },
        { type: 'ui', id: 'analytics_no', uiId: 'analytics_no' }
      ]
    },
    {
      screen: 'play',
      score: 0,
      clears: 0,
      combo: 0,
      failed: false,
      ended: false,
      ad: null,
      actions: [
        { type: 'move', id: 'low', pieceIndex: 0, x: 0, y: 0, lines: 0, cells: 2 },
        { type: 'move', id: 'high', pieceIndex: 0, x: 1, y: 0, lines: 2, cells: 1 }
      ]
    },
    {
      screen: 'play',
      score: 24,
      clears: 2,
      combo: 2,
      failed: false,
      ended: false,
      ad: null,
      actions: [{ type: 'move', id: 'next', pieceIndex: 0, x: 0, y: 1, lines: 0, cells: 1 }]
    },
    {
      screen: 'ad_break',
      score: 24,
      clears: 2,
      combo: 0,
      failed: false,
      ended: false,
      ad: { kind: 'interstitial', screen: 'ad_break', placement: 'between_rounds' },
      actions: [{ type: 'ui', id: 'close_ad', uiId: 'close_ad' }]
    },
    {
      screen: 'game_over',
      score: 24,
      clears: 2,
      combo: 0,
      failed: true,
      ended: false,
      ad: null,
      actions: [
        { type: 'ui', id: 'offer_continue', uiId: 'offer_continue' },
        { type: 'ui', id: 'restart', uiId: 'restart' }
      ]
    }
  ];
  const adapter = scriptedAdapter(frames, 'control');
  const log = await runSession({
    adapter,
    persona: scriptedPersona,
    seed: 3,
    maxSteps: 20,
    variant: { id: 'control' }
  });
  assert.equal(log.variant, 'control');
  assert.equal(log.persona, 'scripted');
  assert.equal(log.seed, 3);
  assert.equal(log.endReason, 'quit');
  assert.equal(log.clears, 2);
  assert.deepEqual(log.clearEvents, [{ step: 3, delta: 2, total: 2 }]);
  assert.deepEqual(log.combos, [{ step: 3, lines: 2 }]);
  assert.equal(log.failPoints.length, 1);
  assert.equal(log.failPoints[0].score, 24);
  assert.equal(log.failPoints[0].screen, 'game_over');
  assert.equal(log.adMoments.length, 1);
  assert.equal(log.adMoments[0].kind, 'interstitial');
  assert.equal(log.adMoments[0].reaction, 'close');
  assert.equal(log.sessionLengthMs, 6000);
  assert.equal(adapter.performed.at(-1).uiId, 'close_ad');
  assert.equal(adapter.performed.some((action) => action.id === 'high'), true);
  assert.equal(log.retention.wouldReturn, wouldReturn({ persona: scriptedPersona, log }));
  assert.equal(log.retention.wouldReturn >= 0 && log.retention.wouldReturn <= 1, true);
});

test('runComparison reuses seeds across variants and writes a summary', async () => {
  const seen = [];
  const report = await runComparison({
    variants: [
      { id: 'control', pacingPath: 'config/pacing.json' },
      { id: 'quiet', pacingPath: 'sim/variants/quiet-ads.json' }
    ],
    personas: ['casual'],
    seeds: [4, 5],
    maxSteps: 2,
    createSessionAdapter: async ({ variant, seed }) => {
      seen.push([variant.id, seed]);
      return scriptedAdapter([
        {
          screen: 'play',
          score: seed,
          clears: 0,
          combo: 0,
          failed: false,
          ended: true,
          ad: null,
          actions: []
        }
      ], variant.id);
    }
  });
  assert.deepEqual(seen, [
    ['control', 4],
    ['control', 5],
    ['quiet', 4],
    ['quiet', 5]
  ]);
  assert.equal(report.sessions.length, 4);
  assert.deepEqual(report.sessions.map((session) => [session.variant, session.seed]), seen);

  const built = buildReport({
    variants: [{ id: 'control' }, { id: 'quiet' }],
    seeds: [1],
    personas: ['casual'],
    maxSteps: 10,
    sessions: [
      {
        variant: 'control',
        persona: 'casual',
        seed: 1,
        sessionLengthMs: 1000,
        steps: 1,
        endReason: 'quit',
        finalScore: 0,
        peakScore: 0,
        clears: 0,
        combos: [],
        failPoints: [],
        adMoments: [],
        retention: { wouldReturn: 0.5 }
      },
      {
        variant: 'quiet',
        persona: 'casual',
        seed: 1,
        sessionLengthMs: 3000,
        steps: 3,
        endReason: 'max_steps',
        finalScore: 10,
        peakScore: 10,
        clears: 2,
        combos: [{ lines: 2 }],
        failPoints: [{ step: 2 }],
        adMoments: [],
        retention: { wouldReturn: 0.8 }
      }
    ]
  });
  assert.equal(built.comparison.baseline, 'control');
  assert.equal(built.comparison.metrics.meanSessionLengthMs.control, 1000);
  assert.equal(built.comparison.metrics.meanSessionLengthMs.quiet, 3000);
  assert.equal(built.comparison.metrics.meanSessionLengthMs.delta.quiet, 2000);
  assert.equal(built.comparison.metrics.meanWouldReturn.control, 0.5);
  assert.equal(built.comparison.metrics.meanWouldReturn.quiet, 0.8);
  assert.equal(built.comparison.metrics.meanWouldReturn.delta.quiet, 0.3);
  assert.equal(built.comparison.metrics.meanClears.delta.quiet, 2);
  assert.equal(built.comparison.metrics.quitRate.control, 1);
  assert.equal(built.comparison.metrics.quitRate.quiet, 0);

  const markdown = formatSummary(built);
  assert.match(markdown, /control/);
  assert.match(markdown, /quiet/);
  assert.match(markdown, /would-return/i);
  assert.match(markdown, /delta/i);
  assert.match(markdown, /casual/);

  const dir = await mkdtemp(join(tmpdir(), 'sim-report-'));
  try {
    await writeReport(built, dir);
    const json = JSON.parse(await readFile(join(dir, 'results.json'), 'utf8'));
    const summary = await readFile(join(dir, 'summary.md'), 'utf8');
    assert.equal(json.comparison.metrics.meanWouldReturn.delta.quiet, 0.3);
    assert.equal(summary, markdown);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('assertAdapter rejects a partial adapter', () => {
  assert.throws(() => assertAdapter({ start() {}, readState() {}, listActions() {}, perform() {} }), /stop/);
  const adapter = {
    async start() {},
    async readState() { return {}; },
    async listActions() { return []; },
    async perform() { return { ok: true }; },
    async stop() {}
  };
  assert.equal(assertAdapter(adapter), adapter);
});

test('static server serves an overridden config path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sim-static-'));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, 'index.html'), '<!doctype html><title>ok</title>', 'utf8');
  await writeFile(join(root, 'shipped.json'), '{"name":"shipped"}\n', 'utf8');
  const other = await mkdtemp(join(tmpdir(), 'sim-override-'));
  await writeFile(join(other, 'quiet.json'), '{"name":"quiet"}\n', 'utf8');
  const server = await startStaticServer({
    root,
    overrides: { '/shipped.json': join(other, 'quiet.json') }
  });
  try {
    const response = await fetch(`${server.url}/shipped.json`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"name":"quiet"}\n');
    const page = await fetch(`${server.url}/`);
    assert.match(await page.text(), /ok/);
    const missing = await fetch(`${server.url}/nope.txt`);
    assert.equal(missing.status, 404);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
