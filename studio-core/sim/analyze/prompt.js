import { LIMITS } from '../../guardrails/limits.js';

export function buildPrompt({ summary, pacing, tuning }) {
  return [
    'Return JSON only. No markdown.',
    'Shape: {"proposals":[{"id":"string","rank":1,"title":"string","rationale":"string","config":"pacing","patch":{},"expectedEffect":"string"}]}',
    'config is "pacing" or "tuning". rank 1 is the best change. patch is a deep partial of that config. Use only keys the current config already has.',
    `Hard caps: interstitial maxPerSession ${LIMITS.ads.maxPerSession}, minSecondsBetween ${LIMITS.ads.minSecondsBetween}, minRoundsBetween ${LIMITS.ads.minRoundsBetween}.`,
    `Rewarded maxPerSession ${LIMITS.ads.rewarded.maxPerSession}, rewarded minSecondsBetween ${LIMITS.ads.rewarded.minSecondsBetween}.`,
    `difficulty maxTier ${LIMITS.difficulty.maxTier}. failBias must stay 0. continueClears at most ${LIMITS.rewardedEffects.maxContinueRowsCleared}.`,
    'No personalized ads and no network endpoints. Children may see non-personalized ads only, with no analytics and no device or advertising ids.',
    'Summary:',
    JSON.stringify(summary),
    'Current pacing:',
    JSON.stringify(pacing),
    'Current tuning:',
    JSON.stringify(tuning)
  ].join('\n');
}

export function buildRepairPrompt(previous, errors) {
  return [
    'The previous JSON was rejected. Return corrected JSON only, same proposals schema, no markdown.',
    'Errors:',
    errors.join('\n'),
    'Previous:',
    previous
  ].join('\n');
}
