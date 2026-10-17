import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROWS = [
  ['Session length (ms)', 'meanSessionLengthMs'],
  ['Would-return', 'meanWouldReturn'],
  ['Clears', 'meanClears'],
  ['Combos', 'meanCombos'],
  ['Fail points', 'meanFailPoints'],
  ['Ad moments', 'meanAdMoments'],
  ['Quit rate', 'quitRate']
];

function cell(value) {
  return value == null ? '' : String(value);
}

function table(metrics, variants) {
  const ids = variants.map((variant) => variant.id);
  const header = `| Metric | ${ids.join(' | ')} | delta |`;
  const rule = `| --- | ${ids.map(() => '---:').join(' | ')} | ---: |`;
  const lines = [header, rule];
  for (const [label, key] of ROWS) {
    const row = metrics[key];
    const deltas = ids.slice(1).map((id) => `${id} ${cell(row.delta[id])}`).join(', ');
    lines.push(`| ${label} | ${ids.map((id) => cell(row[id])).join(' | ')} | ${deltas} |`);
  }
  return lines.join('\n');
}

export function formatSummary(report) {
  const { comparison, sessions, seeds, personas, maxSteps, variants } = report;
  const baseline = comparison.baseline;
  const challenger = variants.find((variant) => variant.id !== baseline) ?? variants[0];
  const returns = comparison.metrics.meanWouldReturn;
  const lines = [
    '# Player simulation',
    '',
    `Compared ${variants.length} variants across ${personas.length} persona${personas.length === 1 ? '' : 's'} and ${seeds.length} seed${seeds.length === 1 ? '' : 's'} (${sessions.length} sessions, safety cap ${maxSteps} steps).`,
    `Personas: ${personas.join(', ')}. Seeds: ${seeds.join(', ')}.`,
    `Baseline is ${baseline}. The same seeds are used for every variant. Session length is the sum of persona think time.`,
    '',
    `Would-return for ${challenger.id} is ${returns[challenger.id]} versus ${baseline} ${returns[baseline]} (delta ${returns.delta[challenger.id] ?? 0}).`,
    '',
    '## Metrics',
    '',
    table(comparison.metrics, variants),
    '',
    '## By persona',
    ''
  ];
  for (const persona of personas) {
    const metrics = comparison.byPersona[persona];
    if (!metrics) continue;
    lines.push(`### ${persona}`, '', table(metrics, variants), '');
  }
  lines.push('## Sessions', '', '| Variant | Persona | Seed | Steps | Quit reason | Anomaly |', '| --- | --- | ---: | ---: | --- | --- |');
  for (const session of sessions) {
    lines.push(`| ${cell(session.variant)} | ${cell(session.persona)} | ${cell(session.seed)} | ${cell(session.steps)} | ${cell(session.quitReason)} | ${cell(session.anomaly)} |`);
  }
  lines.push(
    '',
    '## Notes',
    '',
    'Would-return is a 0 to 1 heuristic. Clears, combos, and peak score raise it. Fail points lower it. Ad moments lower it in proportion to that persona\'s ad aversion. A frustration, boredom, or ad quit subtracts 0.04.',
    'Quit reasons are frustration (no-fit moves and failed attempts, with decay), boredom (no clears for that persona\'s move threshold), ad (ad-averse only), or game_over (left a finished match). The safety cap is an anomaly, not a quit.',
    'Ad reactions are close, watch, decline, or quit.',
    ''
  );
  return `${lines.join('\n')}`;
}

export async function writeReport(report, dir) {
  await mkdir(dir, { recursive: true });
  const markdown = formatSummary(report);
  await writeFile(join(dir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(dir, 'summary.md'), markdown, 'utf8');
  return { jsonPath: join(dir, 'results.json'), markdownPath: join(dir, 'summary.md'), markdown };
}
