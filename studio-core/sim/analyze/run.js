import { buildPrompt, buildRepairPrompt } from './prompt.js';
import { parseProposalContent, validateProposalResponse } from './schema.js';
import { screenProposals } from './screen.js';
import { compactSummary } from './summary.js';

function interpret(content) {
  const parsed = parseProposalContent(content);
  if (!parsed.ok) return parsed;
  return validateProposalResponse(parsed.value);
}

function metricBlock(metric, baseline) {
  if (!metric || typeof metric !== 'object') return { baseline: null, delta: {} };
  return { baseline: metric[baseline] ?? null, delta: metric.delta ?? {} };
}

function historyProposal(proposal) {
  return {
    id: proposal.id ?? null,
    rank: proposal.rank ?? null,
    title: proposal.title ?? null,
    config: proposal.config ?? null,
    patch: proposal.patch ?? null,
    reason: proposal.reason ?? null,
    estimate: proposal.estimate ?? null
  };
}

export async function runAnalyze({
  results,
  pacing,
  tuning,
  client,
  resim = null,
  now = () => new Date().toISOString(),
  gitSha = null,
  ollamaUrl = null,
  pacingPath = null,
  tuningPath = null
}) {
  const summary = compactSummary(results);
  const first = await client.complete(buildPrompt({ summary, pacing, tuning }));
  let parsed = interpret(first.content);
  let model = first.model;
  let repaired = false;
  if (!parsed.ok) {
    repaired = true;
    const second = await client.complete(buildRepairPrompt(first.content, parsed.errors));
    model = second.model;
    parsed = interpret(second.content);
  }
  let accepted = [];
  let rejected = [];
  if (!parsed.ok) {
    rejected = [{
      id: null,
      rank: null,
      title: null,
      config: null,
      patch: null,
      reason: 'invalid proposal JSON after one repair',
      errors: parsed.errors
    }];
  } else {
    const screened = await screenProposals({ proposals: parsed.proposals, pacing, tuning, resim });
    accepted = screened.accepted;
    rejected = screened.rejected;
  }
  const timestamp = now();
  const baseline = summary.baseline;
  const analysis = {
    timestamp,
    gitSha,
    model,
    ollamaUrl,
    repaired,
    summary,
    accepted,
    rejected
  };
  const historyEntry = {
    timestamp,
    gitSha,
    config: { pacingPath, tuningPath, model, ollamaUrl, repaired },
    resultsSummary: {
      wouldReturn: metricBlock(summary.metrics.meanWouldReturn, baseline),
      clears: metricBlock(summary.metrics.meanClears, baseline),
      adMoments: metricBlock(summary.metrics.meanAdMoments, baseline),
      quitRate: metricBlock(summary.metrics.quitRate, baseline),
      sessionLengthMs: metricBlock(summary.metrics.meanSessionLengthMs, baseline)
    },
    accepted: accepted.map(historyProposal),
    rejected: rejected.map(historyProposal)
  };
  return { analysis, historyEntry };
}
