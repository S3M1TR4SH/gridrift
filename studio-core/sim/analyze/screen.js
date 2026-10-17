import { validateGameConfig } from '../../guardrails/validate.js';
import { applyPatch } from './patch.js';

function reasonFrom(violations) {
  return violations.map((item) => `${item.rule}: ${item.message}`).join('; ').slice(0, 1000);
}

export async function screenProposals({ proposals, pacing, tuning, resim = null }) {
  const accepted = [];
  const rejected = [];
  for (const proposal of proposals) {
    let nextPacing = pacing;
    let nextTuning = tuning;
    try {
      if (proposal.config === 'pacing') nextPacing = applyPatch(pacing, proposal.patch);
      else nextTuning = applyPatch(tuning, proposal.patch);
    } catch (error) {
      rejected.push({ ...proposal, reason: error.message });
      continue;
    }
    const guard = validateGameConfig({ pacing: nextPacing, tuning: nextTuning });
    if (!guard.ok) {
      rejected.push({ ...proposal, reason: reasonFrom(guard.violations) });
      continue;
    }
    const record = {
      ...proposal,
      guardrail: 'pass',
      patched: proposal.config === 'pacing' ? nextPacing : nextTuning
    };
    if (resim) {
      try {
        record.estimate = await resim({ proposal, pacing: nextPacing, tuning: nextTuning });
      } catch (error) {
        rejected.push({ ...proposal, reason: `resim failed: ${error.message}` });
        continue;
      }
    }
    accepted.push(record);
  }
  return { accepted, rejected };
}
