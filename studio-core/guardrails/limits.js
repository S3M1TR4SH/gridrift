function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * Hard limits. Games may be stricter. They cannot raise, widen, or turn these off.
 * Runtime helpers clamp to these values; config that exceeds them fails validation.
 */
export const LIMITS = deepFreeze({
  ads: {
    maxPerSession: 3,
    minSecondsBetween: 60,
    minRoundsBetween: 1,
    allowedBreaks: ['game_over', 'between_rounds'],
    minControlSeparationPx: 64,
    rewarded: {
      maxPerSession: 3,
      minSecondsBetween: 45,
      placements: ['continue', 'hint', 'reroll', 'double_score']
    }
  },
  difficulty: {
    maxFailBias: 0,
    maxTier: 8
  },
  privacy: {
    coppaAge: 13
  },
  rewardedEffects: {
    maxContinueUsesPerMatch: 1,
    maxContinueRowsCleared: 4
  }
});
