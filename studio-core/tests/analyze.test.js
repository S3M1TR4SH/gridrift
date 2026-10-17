import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appendHistory, readHistory } from '../sim/analyze/history.js';
import { createOllamaClient } from '../sim/analyze/ollama.js';
import { resolveAnalyzeOptions } from '../sim/analyze/options.js';
import { estimateWithSim } from '../sim/analyze/resim.js';
import { formatAnalysis } from '../sim/analyze/report.js';
import { runAnalyze } from '../sim/analyze/run.js';
import { parseProposalContent, validateProposalResponse } from '../sim/analyze/schema.js';
import { compactSummary } from '../sim/analyze/summary.js';
import { formatTrends } from '../sim/analyze/trends.js';
import validPacing from './fixtures/valid-pacing.json' with { type: 'json' };

const tuning = {
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

function resultsFixture() {
  return {
    seeds: [1],
    personas: ['casual'],
    maxSteps: 10,
    variants: [
      { id: 'control', pacingPath: 'config/pacing.json' },
      { id: 'quiet', pacingPath: 'sim/variants/quiet-ads.json' }
    ],
    sessions: [{ secretBoard: 'do-not-send', variant: 'control', persona: 'casual', seed: 1 }],
    comparison: {
      baseline: 'control',
      metrics: {
        meanWouldReturn: { control: 0.5, quiet: 0.7, delta: { quiet: 0.2 } },
        meanClears: { control: 1, quiet: 2, delta: { quiet: 1 } },
        meanAdMoments: { control: 1, quiet: 0, delta: { quiet: -1 } },
        quitRate: { control: 0.5, quiet: 0.25, delta: { quiet: -0.25 } },
        meanSessionLengthMs: { control: 1000, quiet: 2000, delta: { quiet: 1000 } },
        meanCombos: { control: 0, quiet: 1, delta: { quiet: 1 } },
        meanFailPoints: { control: 1, quiet: 0, delta: { quiet: -1 } }
      },
      byPersona: {}
    }
  };
}

function proposal(overrides = {}) {
  return {
    id: 'lower-cap',
    rank: 1,
    title: 'Lower interstitial cap',
    rationale: 'Fewer ads should raise would-return.',
    config: 'pacing',
    patch: { ads: { interstitial: { maxPerSession: 1 } } },
    expectedEffect: 'fewer ad moments',
    ...overrides
  };
}

function scriptedClient(contents) {
  const prompts = [];
  let index = 0;
  return {
    prompts,
    async complete(prompt) {
      prompts.push(prompt);
      const content = contents[Math.min(index, contents.length - 1)];
      index += 1;
      return { model: 'mock', content };
    }
  };
}

test('compact summary keeps comparison metrics and drops session payloads', () => {
  const summary = compactSummary(resultsFixture());
  assert.equal(summary.baseline, 'control');
  assert.equal(summary.metrics.meanWouldReturn.quiet, 0.7);
  assert.equal(summary.quitReasons.safety_cap, 0);
  assert.equal(summary.quitReasons.frustration, 0);
  assert.equal(JSON.stringify(summary).includes('do-not-send'), false);
  assert.equal(Object.hasOwn(summary, 'sessions'), false);
});

test('proposal schema accepts ranked JSON and rejects a broken payload', () => {
  const wrapped = '```json\n{"proposals":[]}\n```';
  const empty = parseProposalContent(wrapped);
  assert.equal(validateProposalResponse(empty.value).ok, true);

  const swapped = validateProposalResponse({
    proposals: [proposal({ id: 'second', rank: 2 }), proposal({ id: 'first', rank: 1 })]
  });
  assert.equal(swapped.ok, true);
  assert.deepEqual(swapped.proposals.map((item) => item.id), ['first', 'second']);

  const broken = validateProposalResponse({ proposals: [{ id: 'x' }] });
  assert.equal(broken.ok, false);
  assert.match(broken.errors.join('\n'), /patch/);

  const extra = validateProposalResponse({ proposals: [], note: 'no' });
  assert.equal(extra.ok, false);
});

test('flags override env and otherwise use the local Ollama defaults', () => {
  const fromEnv = resolveAnalyzeOptions(
    ['--input', 'in.json', '--pacing', 'p.json', '--tuning', 't.json'],
    { OLLAMA_MODEL: 'custom', OLLAMA_HOST: 'http://127.0.0.1:11434' }
  );
  assert.equal(fromEnv.model, 'custom');
  assert.equal(fromEnv.ollamaUrl, 'http://127.0.0.1:11434');
  assert.equal(fromEnv.fallbackModel, 'llama3.2:3b');

  const flagged = resolveAnalyzeOptions(
    ['--input', 'in.json', '--pacing', 'p.json', '--tuning', 't.json', '--model', 'flagged', '--fallback-model', 'other:1b'],
    { OLLAMA_MODEL: 'custom' }
  );
  assert.equal(flagged.model, 'flagged');
  assert.equal(flagged.fallbackModel, 'other:1b');
  assert.equal(flagged.ollamaUrl, 'http://localhost:11434');
});

test('a schema failure is repaired once and a second failure is rejected', async () => {
  const good = JSON.stringify({ proposals: [proposal()] });
  const repaired = await runAnalyze({
    results: resultsFixture(),
    pacing: validPacing,
    tuning,
    client: scriptedClient(['{"nope":true}', good]),
    now: () => '2026-10-17T00:00:00.000Z',
    gitSha: 'abc'
  });
  assert.equal(repaired.analysis.repaired, true);
  assert.equal(repaired.analysis.accepted.length, 1);
  assert.equal(repaired.analysis.accepted[0].id, 'lower-cap');
  assert.equal(repaired.analysis.accepted[0].guardrail, 'pass');
  assert.equal(repaired.analysis.accepted[0].patched.ads.interstitial.maxPerSession, 1);
  assert.equal(repaired.analysis.accepted[0].patched.ads.interstitial.minSecondsBetween, 120);

  const client = scriptedClient(['{"nope":true}', '{"still":true}']);
  const failed = await runAnalyze({
    results: resultsFixture(),
    pacing: validPacing,
    tuning,
    client,
    now: () => '2026-10-17T00:00:00.000Z'
  });
  assert.equal(client.prompts.length, 2);
  assert.equal(failed.analysis.accepted.length, 0);
  assert.equal(failed.analysis.rejected.length, 1);
  assert.match(failed.analysis.rejected[0].reason, /repair/i);
  assert.match(client.prompts[0], /meanWouldReturn/);
  assert.match(client.prompts[1], /proposals/);
});

test('guardrails keep only valid proposals and record the rejection reason', async () => {
  const payload = JSON.stringify({
    proposals: [
      proposal({
        id: 'too-many',
        rank: 1,
        title: 'Too many ads',
        patch: { ads: { interstitial: { maxPerSession: 99 } } }
      }),
      proposal({ id: 'lower-cap', rank: 2 })
    ]
  });
  const analysis = await runAnalyze({
    results: resultsFixture(),
    pacing: validPacing,
    tuning,
    client: scriptedClient([payload])
  });
  assert.deepEqual(analysis.analysis.accepted.map((item) => item.id), ['lower-cap']);
  assert.equal(analysis.analysis.rejected.length, 1);
  assert.equal(analysis.analysis.rejected[0].id, 'too-many');
  assert.match(analysis.analysis.rejected[0].reason, /ads\.maxPerSession/);
  const markdown = formatAnalysis(analysis.analysis);
  assert.match(markdown, /lower-cap|Lower interstitial cap/);
  assert.match(markdown, /too-many/);
  assert.match(markdown, /ads\.maxPerSession/);
});

test('a resim failure rejects the proposal and a success keeps the estimate', async () => {
  const payload = JSON.stringify({ proposals: [proposal()] });
  const broken = await runAnalyze({
    results: resultsFixture(),
    pacing: validPacing,
    tuning,
    client: scriptedClient([payload]),
    resim: async () => {
      throw new Error('browser down');
    }
  });
  assert.equal(broken.analysis.accepted.length, 0);
  assert.match(broken.analysis.rejected[0].reason, /resim/);
  assert.match(broken.analysis.rejected[0].reason, /browser down/);

  const estimated = await runAnalyze({
    results: resultsFixture(),
    pacing: validPacing,
    tuning,
    client: scriptedClient([payload]),
    resim: async () => ({ meanWouldReturn: { baseline: 0.5, proposal: 0.6, delta: { proposal: 0.1 } } })
  });
  assert.equal(estimated.analysis.accepted[0].estimate.meanWouldReturn.delta.proposal, 0.1);
});

test('history appends runs and trends lists them in time order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'analyze-history-'));
  try {
    const file = join(dir, 'runs.jsonl');
    await appendHistory(file, {
      timestamp: '2026-10-17T00:00:00.000Z',
      gitSha: 'aaa',
      resultsSummary: { wouldReturn: { baseline: 0.5, delta: {} }, clears: { baseline: 1, delta: {} }, adMoments: { baseline: 1, delta: {} }, quitRate: { baseline: 0.5, delta: {} } },
      accepted: [{ id: 'lower-cap' }],
      rejected: []
    });
    await appendHistory(file, {
      timestamp: '2026-10-18T00:00:00.000Z',
      gitSha: 'bbb',
      resultsSummary: { wouldReturn: { baseline: 0.7, delta: { quiet: 0.1 } }, clears: { baseline: 2, delta: {} }, adMoments: { baseline: 0, delta: {} }, quitRate: { baseline: 0.2, delta: {} } },
      accepted: [],
      rejected: [{ id: 'too-many', reason: 'ads.maxPerSession' }]
    });
    const entries = await readHistory(dir);
    assert.equal(entries.length, 2);
    const markdown = formatTrends(entries);
    assert.match(markdown, /2026-10-17T00:00:00.000Z/);
    assert.match(markdown, /2026-10-18T00:00:00.000Z/);
    assert.match(markdown, /0\.5/);
    assert.match(markdown, /0\.7/);
    assert.match(markdown, /too-many|1/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the Ollama client prefers the configured model and falls back after a 404', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), model: body.model });
    if (body.model === 'qwen2.5-coder:3b') {
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    }
    return { ok: true, status: 200, json: async () => ({ message: { content: '{"proposals":[]}' } }) };
  };
  const client = createOllamaClient({ fetch: fetchImpl });
  const result = await client.complete('summary');
  assert.equal(result.model, 'llama3.2:3b');
  assert.equal(result.content, '{"proposals":[]}');
  assert.equal(calls[0].url, 'http://localhost:11434/api/chat');
  assert.deepEqual(calls.map((call) => call.model), ['qwen2.5-coder:3b', 'llama3.2:3b']);

  const primaryCalls = [];
  const primary = createOllamaClient({
    fetch: async (url, options) => {
      primaryCalls.push({ url: String(url), model: JSON.parse(options.body).model });
      return { ok: true, status: 200, json: async () => ({ message: { content: '{"ok":true}' } }) };
    },
    baseUrl: 'http://127.0.0.1:11434/',
    model: 'qwen2.5-coder:3b'
  });
  const once = await primary.complete('hi');
  assert.equal(once.model, 'qwen2.5-coder:3b');
  assert.deepEqual(primaryCalls.map((call) => call.model), ['qwen2.5-coder:3b']);
  assert.equal(primaryCalls[0].url, 'http://127.0.0.1:11434/api/chat');
});

test('optional resim wires the patched config through the session runner', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'analyze-resim-'));
  const log = join(dir, 'log.txt');
  const adapterPath = join(dir, 'adapter.mjs');
  await writeFile(adapterPath, `
    import { appendFile } from 'node:fs/promises';
    export async function createAdapter() {
      return {
        async start({ variant }) { await appendFile(process.env.ANALYZE_LOG, JSON.stringify(variant) + '\\n'); },
        async readState() { return { screen: 'end', score: 0, clears: 0, combo: 0, failed: false, ended: true, ad: null }; },
        async listActions() { return []; },
        async perform() { return { ok: true }; },
        async isGameOver() { return false; },
        async stop() {},
        async dispose() {}
      };
    }
  `, 'utf8');
  const previous = process.env.ANALYZE_LOG;
  process.env.ANALYZE_LOG = log;
  try {
    const estimate = await estimateWithSim({
      adapterPath,
      root: dir,
      baselinePacingPath: join(dir, 'base-pacing.json'),
      baselineTuningPath: join(dir, 'base-tuning.json'),
      pacing: validPacing,
      tuning,
      seeds: [1],
      personas: ['casual'],
      maxSteps: 1
    });
    assert.equal(typeof estimate.meanWouldReturn.baseline, 'number');
    const lines = (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(lines.some((line) => line.id === 'proposal'), true);
    assert.equal(lines.some((line) => line.id === 'baseline'), true);
    assert.equal(typeof lines.find((line) => line.id === 'proposal').pacingPath, 'string');
    assert.equal(typeof lines.find((line) => line.id === 'proposal').tuningPath, 'string');
  } finally {
    if (previous == null) delete process.env.ANALYZE_LOG;
    else process.env.ANALYZE_LOG = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
