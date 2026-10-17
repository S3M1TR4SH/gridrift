import {
  createGuardedAds,
  createNoopAdapter,
  createPacer,
  evaluateAgeGate,
  validateGameConfig
} from '../../../index.js';
import { createGenre } from './genre.js';

export function bootShell({ pacing, tuning, answer = null } = {}) {
  const checked = validateGameConfig({ pacing, tuning });
  if (!checked.ok) {
    const error = new Error('config failed guardrails');
    error.violations = checked.violations;
    throw error;
  }
  const consent = answer ? evaluateAgeGate(answer) : null;
  const pacer = createPacer({
    pacing,
    isChild: () => !consent || consent.isChild
  });
  const ads = createGuardedAds({ adapter: createNoopAdapter(), pacer });
  return { consent, ads, genre: createGenre() };
}
