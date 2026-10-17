import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runComparison } from './compare.js';
import { resolvePersona } from './personas.js';
import { formatSummary, writeReport } from './report.js';
import { SAFETY_CAP } from './session.js';

function parseArgs(argv) {
  const args = {
    adapter: '',
    variants: [],
    seeds: [1, 2],
    personas: ['casual', 'skilled', 'quitter', 'ad-averse'],
    maxSteps: SAFETY_CAP,
    out: 'sim/out',
    personaFile: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--adapter') {
      args.adapter = next;
      index += 1;
    } else if (token === '--variant') {
      const separator = String(next ?? '').indexOf('=');
      const id = separator === -1 ? '' : next.slice(0, separator);
      const pacingPath = separator === -1 ? '' : next.slice(separator + 1);
      if (!id || !pacingPath) throw new Error('--variant expects id=path');
      args.variants.push({ id, pacingPath });
      index += 1;
    } else if (token === '--seeds') {
      args.seeds = String(next).split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
      index += 1;
    } else if (token === '--personas') {
      args.personas = String(next).split(',').map((value) => value.trim()).filter(Boolean);
      index += 1;
    } else if (token === '--max-steps') {
      args.maxSteps = Number(next);
      index += 1;
    } else if (token === '--out') {
      args.out = next;
      index += 1;
    } else if (token === '--persona-file') {
      args.personaFile = next;
      index += 1;
    } else {
      throw new Error(`unknown argument ${token}`);
    }
  }
  if (!args.adapter) throw new Error('--adapter is required');
  if (args.variants.length < 2) throw new Error('pass at least two --variant id=path arguments');
  if (!args.seeds.length) throw new Error('--seeds needs at least one integer');
  if (!Number.isInteger(args.maxSteps) || args.maxSteps < 1) throw new Error('--max-steps must be a positive safety cap');
  return args;
}

function loadPersonas(args) {
  const overrides = args.personaFile ? JSON.parse(readFileSync(resolve(args.personaFile), 'utf8')) : {};
  return args.personas.map((id) => resolvePersona(id, overrides[id] ?? {}));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const imported = await import(pathToFileURL(resolve(args.adapter)).href);
  if (typeof imported.createAdapter !== 'function') {
    throw new Error('adapter module must export createAdapter');
  }
  const adapter = await imported.createAdapter({ root: process.cwd() });
  try {
    const report = await runComparison({
      variants: args.variants,
      personas: loadPersonas(args),
      seeds: args.seeds,
      maxSteps: args.maxSteps,
      createSessionAdapter: async () => adapter
    });
    const written = await writeReport(report, resolve(args.out));
    process.stdout.write(formatSummary(report));
    process.stderr.write(`wrote ${written.jsonPath} and ${written.markdownPath}\n`);
  } finally {
    await adapter.dispose?.();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
