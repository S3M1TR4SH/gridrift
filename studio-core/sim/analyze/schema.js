function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const ROOT_KEYS = new Set(['proposals']);
const PROPOSAL_KEYS = new Set(['id', 'rank', 'title', 'rationale', 'config', 'patch', 'expectedEffect']);

export function parseProposalContent(text) {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const source = fenced ? fenced[1] : trimmed;
  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    return { ok: false, errors: [`JSON parse failed: ${error.message}`], proposals: [] };
  }
}

function textField(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateProposalResponse(value) {
  const errors = [];
  if (!isPlainObject(value)) return { ok: false, errors: ['root must be an object'], proposals: [] };
  for (const key of Object.keys(value)) {
    if (!ROOT_KEYS.has(key)) errors.push(`root has unexpected field ${key}`);
  }
  if (!Array.isArray(value.proposals)) {
    errors.push('proposals must be an array');
    return { ok: false, errors, proposals: [] };
  }
  const proposals = [];
  value.proposals.forEach((item, index) => {
    const where = `proposals[${index}]`;
    const before = errors.length;
    if (!isPlainObject(item)) {
      errors.push(`${where} must be an object`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!PROPOSAL_KEYS.has(key)) errors.push(`${where} has unexpected field ${key}`);
    }
    if (!textField(item.id)) errors.push(`${where}.id must be a non-empty string`);
    if (!Number.isInteger(item.rank) || item.rank < 1) errors.push(`${where}.rank must be an integer >= 1`);
    if (!textField(item.title)) errors.push(`${where}.title must be a non-empty string`);
    if (!textField(item.rationale)) errors.push(`${where}.rationale must be a non-empty string`);
    if (item.config !== 'pacing' && item.config !== 'tuning') errors.push(`${where}.config must be pacing or tuning`);
    if (!isPlainObject(item.patch) || Object.keys(item.patch).length === 0) errors.push(`${where}.patch must be a non-empty object`);
    if (!textField(item.expectedEffect)) errors.push(`${where}.expectedEffect must be a non-empty string`);
    if (errors.length > before) return;
    proposals.push({
      id: item.id.trim(),
      rank: item.rank,
      title: item.title.trim(),
      rationale: item.rationale.trim(),
      config: item.config,
      patch: item.patch,
      expectedEffect: item.expectedEffect.trim()
    });
  });
  if (errors.length) return { ok: false, errors, proposals: [] };
  proposals.sort((left, right) => left.rank - right.rank);
  return { ok: true, errors: [], proposals };
}
