import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runComparison } from '../compare.js';

export async function estimateWithSim({
  adapterPath,
  root = process.cwd(),
  baselinePacingPath,
  baselineTuningPath,
  pacing,
  tuning,
  seeds,
  personas,
  maxSteps
}) {
  const dir = await mkdtemp(join(tmpdir(), 'analyze-resim-'));
  const pacingFile = join(dir, 'pacing.json');
  const tuningFile = join(dir, 'tuning.json');
  await writeFile(pacingFile, JSON.stringify(pacing));
  await writeFile(tuningFile, JSON.stringify(tuning));
  const imported = await import(pathToFileURL(resolve(root, adapterPath)).href);
  if (typeof imported.createAdapter !== 'function') throw new Error('adapter module must export createAdapter');
  const adapter = await imported.createAdapter({ root });
  try {
    const report = await runComparison({
      variants: [
        { id: 'baseline', pacingPath: baselinePacingPath, tuningPath: baselineTuningPath },
        { id: 'proposal', pacingPath: pacingFile, tuningPath: tuningFile }
      ],
      personas,
      seeds,
      maxSteps,
      createSessionAdapter: async () => adapter
    });
    const metrics = report.comparison.metrics;
    return {
      meanWouldReturn: metrics.meanWouldReturn,
      meanClears: metrics.meanClears,
      meanAdMoments: metrics.meanAdMoments,
      quitRate: metrics.quitRate
    };
  } finally {
    await adapter.dispose?.();
    await rm(dir, { recursive: true, force: true });
  }
}
