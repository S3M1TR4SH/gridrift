import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { appendHistory, readHistory } from './history.js';
import { createOllamaClient } from './ollama.js';
import { resolveAnalyzeOptions } from './options.js';
import { formatAnalysis } from './report.js';
import { estimateWithSim } from './resim.js';
import { runAnalyze } from './run.js';
import { formatTrends } from './trends.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function analyze(args) {
  if (!args.input || !args.pacing || !args.tuning) {
    throw new Error('--input, --pacing, and --tuning are required');
  }
  if (args.resim && !args.adapter) throw new Error('--resim requires --adapter');
  const results = readJson(resolve(args.input));
  const pacing = readJson(resolve(args.pacing));
  const tuning = readJson(resolve(args.tuning));
  const client = createOllamaClient({
    baseUrl: args.ollamaUrl,
    model: args.model,
    fallbackModel: args.fallbackModel
  });
  const resim = args.resim
    ? ({ pacing: nextPacing, tuning: nextTuning }) => estimateWithSim({
      adapterPath: args.adapter,
      root: process.cwd(),
      baselinePacingPath: resolve(args.pacing),
      baselineTuningPath: resolve(args.tuning),
      pacing: nextPacing,
      tuning: nextTuning,
      seeds: args.seeds ?? results.seeds,
      personas: args.personas ?? results.personas,
      maxSteps: args.maxSteps ?? results.maxSteps
    })
    : null;
  const { analysis, historyEntry } = await runAnalyze({
    results,
    pacing,
    tuning,
    client,
    resim,
    gitSha: gitSha(),
    ollamaUrl: args.ollamaUrl,
    pacingPath: args.pacing,
    tuningPath: args.tuning
  });
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  const markdown = formatAnalysis(analysis);
  await writeFile(join(out, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  await writeFile(join(out, 'analysis.md'), markdown, 'utf8');
  await appendHistory(resolve(args.history), historyEntry);
  process.stdout.write(markdown);
}

async function trends(args) {
  const entries = await readHistory(resolve(args.history.endsWith('.jsonl') ? dirname(args.history) : args.history));
  const markdown = formatTrends(entries);
  if (args.out) {
    const out = resolve(args.out);
    await mkdir(dirname(out), { recursive: true });
    const target = out.endsWith('.md') ? out : join(out, 'trends.md');
    await writeFile(target, markdown, 'utf8');
  }
  process.stdout.write(markdown);
}

async function main() {
  const args = resolveAnalyzeOptions(process.argv.slice(2), process.env);
  if (args.command === 'trends') await trends(args);
  else await analyze(args);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
