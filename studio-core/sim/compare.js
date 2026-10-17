import { resolvePersona } from './personas.js';
import { runSession, SAFETY_CAP } from './session.js';

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(rows, pick) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
}

function median(rows, pick) {
  if (!rows.length) return 0;
  const values = rows.map(pick).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

function metric(byVariant, variants, pick, { integer = false, aggregate = 'mean' } = {}) {
  const baseline = variants[0].id;
  const combine = aggregate === 'median' ? median : mean;
  const result = {};
  for (const variant of variants) {
    const value = combine(byVariant.get(variant.id) ?? [], pick);
    result[variant.id] = integer ? Math.round(value) : round(value);
  }
  result.delta = {};
  for (const variant of variants) {
    if (variant.id === baseline) continue;
    const raw = result[variant.id] - result[baseline];
    result.delta[variant.id] = integer ? Math.round(raw) : round(raw);
  }
  return result;
}

function groupBy(sessions, key) {
  const groups = new Map();
  for (const session of sessions) {
    const id = session[key];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(session);
  }
  return groups;
}

const PICKS = {
  meanSessionLengthMs: [(session) => session.sessionLengthMs, { integer: true }],
  medianSessionLengthMs: [(session) => session.sessionLengthMs, { integer: true, aggregate: 'median' }],
  meanWouldReturn: [(session) => session.retention?.wouldReturn ?? 0],
  meanClears: [(session) => session.clears ?? 0],
  meanCombos: [(session) => session.combos?.length ?? 0],
  meanFailPoints: [(session) => session.failPoints?.length ?? 0],
  meanAdMoments: [(session) => session.adMoments?.length ?? 0],
  quitRate: [(session) => (session.endReason === 'quit' ? 1 : 0)]
};

function metricsFor(sessions, variants) {
  const byVariant = groupBy(sessions, 'variant');
  const metrics = {};
  for (const [name, [pick, options]] of Object.entries(PICKS)) {
    metrics[name] = metric(byVariant, variants, pick, options);
  }
  return metrics;
}

export function buildReport({ variants, seeds, personas, maxSteps, sessions }) {
  const personaIds = personas.map((persona) => (typeof persona === 'string' ? persona : persona.id));
  const byPersona = {};
  for (const personaId of personaIds) {
    const rows = sessions.filter((session) => session.persona === personaId);
    if (rows.length) byPersona[personaId] = metricsFor(rows, variants);
  }
  return {
    seeds: [...seeds],
    personas: personaIds,
    maxSteps,
    variants: variants.map((variant) => ({
      id: variant.id,
      pacingPath: variant.pacingPath ?? null
    })),
    sessions,
    comparison: {
      baseline: variants[0].id,
      targetSessionMs: 60000,
      metrics: metricsFor(sessions, variants),
      byPersona
    }
  };
}

export async function runComparison({
  createSessionAdapter,
  variants,
  personas,
  seeds,
  maxSteps = SAFETY_CAP
}) {
  const sessions = [];
  for (const variant of variants) {
    for (const seed of seeds) {
      for (const personaInput of personas) {
        const persona = resolvePersona(personaInput);
        const adapter = await createSessionAdapter({ variant, seed, persona });
        const log = await runSession({
          adapter,
          persona,
          seed,
          maxSteps,
          variant
        });
        sessions.push(log);
      }
    }
  }
  return buildReport({ variants, seeds, personas, maxSteps, sessions });
}
