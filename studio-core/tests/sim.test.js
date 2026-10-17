import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertAdapter } from '../sim/adapter.js';
import { buildReport, runComparison } from '../sim/compare.js';
import { chooseAction, quitReasonForMood, resolvePersona, tickMood } from '../sim/personas.js';
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
  const persona = resolvePersona('skilled', { placement: 'legacy', skill: 1, hintRate: 0 });
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

test('the default human policy uses the calibration file and keeps legacy selectable', () => {
  const casual = resolvePersona('casual');
  assert.equal(casual.placement, 'human');
  assert.equal(casual.lookahead, 1);
  assert.equal(casual.thinkMs, 3000);
  assert.equal(resolvePersona('skilled').lookahead, 2);
  assert.equal(resolvePersona('skilled').thinkMs, 1900);
  assert.equal(resolvePersona('quitter').blunderRate, 0.2);
  assert.equal(resolvePersona('ad-averse').lookProb, 0.8);
  const legacy = resolvePersona('casual', { placement: 'legacy' });
  assert.equal(legacy.placement, 'legacy');
  assert.equal(legacy.skill, 0.35);
});

function playState(actions) {
  return {
    screen: 'play',
    failed: false,
    ended: false,
    ad: null,
    actions
  };
}

test('human placement prefers a clear, visible-tray room, and a nearby spot', () => {
  const persona = resolvePersona('casual', {
    lookahead: 1,
    lookProb: 1,
    noise: 0,
    blunderRate: 0,
    hintRate: 0,
    wFill: 0,
    wContact: 0,
    wHoles: 0,
    wNear: 2
  });
  const clearer = chooseAction({
    persona,
    state: playState([
      { type: 'move', id: 'big', pieceIndex: 0, x: 0, y: 0, lines: 0, cells: 9, rest1: 0 },
      { type: 'move', id: 'clear', pieceIndex: 1, x: 4, y: 4, lines: 1, cells: 1, rest1: 0 }
    ]),
    rng: mulberry32(1),
    restarts: 0
  });
  assert.equal(clearer.action.id, 'clear');

  const room = chooseAction({
    persona,
    state: playState([
      { type: 'move', id: 'strand', pieceIndex: 0, x: 0, y: 0, lines: 0, cells: 1, rest1: -1 },
      { type: 'move', id: 'keep', pieceIndex: 1, x: 2, y: 2, lines: 0, cells: 1, rest1: 1 }
    ]),
    rng: mulberry32(1),
    restarts: 0
  });
  assert.equal(room.action.id, 'keep');

  const near = chooseAction({
    persona,
    state: playState([
      { type: 'move', id: 'far', pieceIndex: 0, x: 5, y: 5, lines: 0, cells: 1, rest1: 0 },
      { type: 'move', id: 'close', pieceIndex: 0, x: 1, y: 0, lines: 0, cells: 1, rest1: 0 }
    ]),
    rng: mulberry32(1),
    lastMove: { x: 0, y: 0 },
    restarts: 0
  });
  assert.equal(near.action.id, 'close');

  const same = chooseAction({
    persona,
    state: playState([
      { type: 'move', id: 'far', pieceIndex: 0, x: 5, y: 5, lines: 0, cells: 1, rest1: 0 },
      { type: 'move', id: 'close', pieceIndex: 0, x: 1, y: 0, lines: 0, cells: 1, rest1: 0 }
    ]),
    rng: mulberry32(1),
    lastMove: { x: 0, y: 0 },
    restarts: 0
  });
  assert.deepEqual(near, same);
});

test('a human blunder stays inside the top moves', () => {
  const persona = resolvePersona('skilled', {
    lookahead: 0,
    noise: 0,
    blunderRate: 1,
    blunderTopK: 2,
    hintRate: 0,
    wFill: 0,
    wContact: 0,
    wHoles: 0,
    wNear: 0
  });
  const actions = [
    { type: 'move', id: 'best', pieceIndex: 0, x: 0, y: 0, lines: 3, cells: 1 },
    { type: 'move', id: 'ok', pieceIndex: 0, x: 1, y: 0, lines: 1, cells: 1 },
    { type: 'move', id: 'worst', pieceIndex: 0, x: 2, y: 0, lines: 0, cells: 1 }
  ];
  const picks = new Set();
  for (let seed = 1; seed <= 30; seed += 1) {
    const decision = chooseAction({
      persona,
      state: playState(actions),
      rng: mulberry32(seed),
      restarts: 0
    });
    picks.add(decision.action.id);
  }
  assert.equal(picks.has('worst'), false);
  assert.equal(picks.has('best'), true);
  assert.equal(picks.has('ok'), true);
});

test('ad-averse retention drops further than skilled retention for the same ads', () => {
  const log = {
    clears: 2,
    combos: [{ lines: 2 }],
    peakScore: 40,
    finalScore: 40,
    failPoints: [{ step: 4 }],
    adMoments: [{ kind: 'interstitial' }, { kind: 'rewarded' }, { kind: 'rewarded' }],
    endReason: 'game_over',
    quitReason: 'game_over',
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
    async isGameOver() {
      const state = await this.readState();
      return state.gameOver === true || state.screen === 'game_over';
    },
    async advanceTime() {},
    async stop() {}
  };
}

const scriptedPersona = {
  id: 'scripted',
  skill: 1,
  frustrationThreshold: 20,
  frustrationDecay: 0.5,
  noFitGain: 1,
  failedGain: 1,
  boredomMoves: 20,
  adWatchRate: 0,
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
  assert.equal(log.endReason, 'game_over');
  assert.equal(log.quitReason, 'game_over');
  assert.equal(log.anomaly, null);
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
        quitReason: 'boredom',
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
        endReason: 'anomaly',
        quitReason: null,
        anomaly: 'safety_cap',
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
  assert.equal(built.comparison.metrics.medianSessionLengthMs.control, 1000);
  assert.equal(built.comparison.metrics.medianSessionLengthMs.quiet, 3000);
  assert.equal(built.comparison.metrics.medianSessionLengthMs.delta.quiet, 2000);
  assert.equal(built.comparison.targetSessionMs, 60000);
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
  assert.match(markdown, /boredom/);
  assert.match(markdown, /safety_cap/);
  assert.match(markdown, /Median session/);
  assert.match(markdown, /60000/);

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
  assert.throws(() => assertAdapter({ start() {}, readState() {}, listActions() {}, perform() {} }), /isGameOver/);
  const adapter = {
    async start() {},
    async readState() { return {}; },
    async listActions() { return []; },
    async perform() { return { ok: true }; },
    async isGameOver() { return false; },
    async stop() {}
  };
  assert.equal(assertAdapter(adapter), adapter);
});

test('frustration accumulates with decay and boredom is a move threshold', () => {
  const quitter = resolvePersona('quitter');
  const stuck = tickMood(quitter, { frustration: 0, movesSinceClear: 0 }, 'noFit');
  assert.equal(quitReasonForMood(quitter, stuck), 'frustration');
  const oneMiss = tickMood(quitter, { frustration: 0, movesSinceClear: 0 }, 'failed');
  assert.equal(quitReasonForMood(quitter, oneMiss), 'frustration');
  assert.equal(oneMiss.movesSinceClear, 1);
  const skilled = resolvePersona('skilled');
  const once = tickMood(skilled, { frustration: 0, movesSinceClear: 0 }, 'noFit');
  const again = tickMood(skilled, once, 'noFit');
  assert.equal(quitReasonForMood(skilled, once), null);
  assert.equal(quitReasonForMood(skilled, again), null);
  assert.ok(again.frustration > once.frustration);
  const cooled = tickMood(skilled, once, 'move');
  assert.ok(cooled.frustration < once.frustration);
  assert.equal(cooled.movesSinceClear, 1);
  const recovered = tickMood(skilled, { frustration: 2, movesSinceClear: 4 }, 'clear');
  assert.ok(recovered.frustration < 2);
  assert.equal(recovered.movesSinceClear, 0);

  const bored = chooseAction({
    persona: quitter,
    state: {
      screen: 'play',
      failed: false,
      ended: false,
      ad: null,
      actions: [{ type: 'move', id: 'open', pieceIndex: 0, x: 0, y: 0, lines: 1, cells: 1 }]
    },
    rng: mulberry32(2),
    mood: { frustration: 0, movesSinceClear: quitter.boredomMoves },
    gameOver: false,
    adCount: 0,
    restarts: 0
  });
  assert.equal(bored.quitReason, 'boredom');

  const calm = chooseAction({
    persona: resolvePersona('casual'),
    state: {
      screen: 'play',
      failed: false,
      ended: false,
      ad: null,
      actions: [{ type: 'move', id: 'open', pieceIndex: 0, x: 0, y: 0, lines: 1, cells: 1 }]
    },
    rng: mulberry32(2),
    mood: { frustration: 0, movesSinceClear: 0 },
    gameOver: false,
    adCount: 0,
    restarts: 0,
    step: 1000
  });
  assert.equal(calm.type, 'action');
});

test('ad-averse quits on an ad and casual closes it', () => {
  const state = {
    screen: 'ad_break',
    failed: false,
    ended: false,
    ad: { kind: 'interstitial', screen: 'ad_break', placement: 'between_rounds' },
    actions: [{ type: 'ui', id: 'close_ad', uiId: 'close_ad' }]
  };
  const shared = { state, rng: mulberry32(1), mood: { frustration: 0, movesSinceClear: 0 }, gameOver: false, adCount: 1, restarts: 0 };
  const averse = chooseAction({ ...shared, persona: resolvePersona('ad-averse') });
  const casual = chooseAction({ ...shared, persona: resolvePersona('casual'), rng: mulberry32(1) });
  assert.equal(averse.quitReason, 'ad');
  assert.equal(averse.reaction, 'quit');
  assert.equal(casual.type, 'action');
  assert.equal(casual.action.uiId, 'close_ad');
});

test('a safety cap is an anomaly and game over is not a no-fit quit', async () => {
  const endless = {
    async start() {},
    async readState() {
      return { screen: 'play', score: 1, clears: 1, combo: 0, failed: false, ended: false, ad: null, actions: [] };
    },
    async listActions() {
      return [{ type: 'move', id: 'm', pieceIndex: 0, x: 0, y: 0, lines: 1, cells: 1 }];
    },
    async perform() { return { ok: true }; },
    async isGameOver() { return false; },
    async stop() {}
  };
  const capped = await runSession({
    adapter: endless,
    persona: resolvePersona('skilled', { boredomMoves: 100, frustrationThreshold: 100, hintRate: 0, thinkMs: 0 }),
    seed: 1,
    maxSteps: 4
  });
  assert.equal(capped.endReason, 'anomaly');
  assert.equal(capped.anomaly, 'safety_cap');
  assert.equal(capped.quitReason, null);
  assert.equal(capped.steps, 4);

  const empty = {
    async start() {},
    async readState() {
      return { screen: 'play', score: 0, clears: 0, combo: 0, failed: false, ended: false, ad: null };
    },
    async listActions() { return []; },
    async perform() { return { ok: true }; },
    async isGameOver() { return false; },
    async stop() {}
  };
  const rage = await runSession({
    adapter: empty,
    persona: resolvePersona('quitter', { thinkMs: 0 }),
    seed: 2,
    maxSteps: 10
  });
  assert.equal(rage.quitReason, 'frustration');
  assert.equal(rage.endReason, 'quit');

  const finished = {
    async start() {},
    async readState() {
      return { screen: 'game_over', score: 3, clears: 1, combo: 0, failed: true, ended: false, ad: null };
    },
    async listActions() { return []; },
    async perform() { return { ok: true }; },
    async isGameOver() { return true; },
    async stop() {}
  };
  const over = await runSession({
    adapter: finished,
    persona: resolvePersona('quitter', { continueRate: 0, restartRate: 0, thinkMs: 0 }),
    seed: 3,
    maxSteps: 10
  });
  assert.equal(over.quitReason, 'game_over');
  assert.equal(over.endReason, 'game_over');
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
