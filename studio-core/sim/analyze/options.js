import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, DEFAULT_OLLAMA_URL } from './ollama.js';

function normalizeUrl(value) {
  if (!value) return DEFAULT_OLLAMA_URL;
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

export function resolveAnalyzeOptions(argv, env = {}) {
  const args = {
    command: 'analyze',
    input: '',
    pacing: '',
    tuning: '',
    out: 'sim/out/analysis',
    history: 'sim/history/runs.jsonl',
    ollamaUrl: normalizeUrl(env.OLLAMA_HOST || DEFAULT_OLLAMA_URL),
    model: env.OLLAMA_MODEL || DEFAULT_MODEL,
    fallbackModel: env.OLLAMA_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
    resim: false,
    adapter: '',
    seeds: null,
    personas: null,
    maxSteps: null
  };
  const tokens = [...argv];
  if (tokens[0] === 'trends') {
    args.command = 'trends';
    tokens.shift();
  } else if (tokens[0] === 'analyze') tokens.shift();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (token === '--input') {
      args.input = next;
      index += 1;
    } else if (token === '--pacing') {
      args.pacing = next;
      index += 1;
    } else if (token === '--tuning') {
      args.tuning = next;
      index += 1;
    } else if (token === '--out') {
      args.out = next;
      index += 1;
    } else if (token === '--history') {
      args.history = next;
      index += 1;
    } else if (token === '--ollama-url') {
      args.ollamaUrl = normalizeUrl(next);
      index += 1;
    } else if (token === '--model') {
      args.model = next;
      index += 1;
    } else if (token === '--fallback-model') {
      args.fallbackModel = next;
      index += 1;
    } else if (token === '--adapter') {
      args.adapter = next;
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
    } else if (token === '--resim') args.resim = true;
    else throw new Error(`unknown argument ${token}`);
  }
  return args;
}
